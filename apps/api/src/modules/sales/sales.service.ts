import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { AuthPublicService } from '../auth';
import { PrismaService } from '../../core/database';
import { RedisService } from '../../core/redis';
import { HotmartAdapter } from '../../infrastructure/providers/hotmart/hotmart.adapter';
import { RawSale, ManualSaleDto, ProductItem, CsvLeadImportDto, CsvSaleImportDto } from '@gs/contracts';
import { ListProjectProductsUseCase } from '../projects';
import { IntegrationsService } from '../integrations';
import { EventStatus, Prisma, LeadSituacion } from '@prisma/client';
import { withRls } from '../../core/database';

@Injectable()
export class SalesService implements OnModuleInit {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(AuthPublicService)
    private readonly authService: AuthPublicService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
    @Inject(forwardRef(() => ListProjectProductsUseCase))
    private readonly listProjectProductsUseCase: ListProjectProductsUseCase,
    @Inject(IntegrationsService)
    private readonly integrationsService: IntegrationsService,
  ) {}

  onModuleInit() {
    const isWorker = process.argv.some((arg) => arg === '--role=worker');
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isWorker || isDev) {
      this.startWorkerLoop().catch((err) => {
        this.logger.error('Error crítico al iniciar el Worker Loop', err);
      });
    }
  }

  async getSaleDetails(saleId: string, closerId: string) {
    const profile = await this.authService.getUserById(closerId);
    return {
      saleId,
      closer: profile?.email || 'desconocido',
      amount: 497,
      currency: 'USD',
    };
  }

  private async startWorkerLoop() {
    // 1. Drenar eventos acumulados en estado RECEIVED
    await this.processPendingEvents();

    let client;
    try {
      client = this.redis.getClient().duplicate();
      this.logger.log('Iniciando Worker de Integraciones y Ventas...');
    } catch (err) {
      this.logger.warn('Cliente Redis no listo para worker, reintentando en 3s...', err);
      setTimeout(() => this.startWorkerLoop(), 3000);
      return;
    }

    while (true) {
      try {
        const result = await client.brpop('queue:integration_events', 5);
        if (result) {
          const [, item] = result;
          const job = JSON.parse(item);
          await this.processEvent(job.data.eventId);
        }
      } catch (err) {
        this.logger.error('Error en el polling de Redis', err);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Ejecuta un proceso de recuperación (drain) sobre eventos atascados en estado RECEIVED.
   * Se invoca automáticamente al arranque del servicio para garantizar que ningún
   * webhook se pierda por reinicios del sistema.
   */
  private async processPendingEvents() {
    try {
      const pendingEvents = await this.prisma.integrationEvent.findMany({
        where: { status: EventStatus.RECEIVED },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
      if (pendingEvents.length > 0) {
        this.logger.log(`Procesando ${pendingEvents.length} eventos pendientes acumulados...`);
        for (const event of pendingEvents) {
          await this.processEvent(event.id);
        }
      }
    } catch (err) {
      this.logger.warn('No se pudieron procesar eventos pendientes acumulados al inicio', err);
    }
  }

  /**
   * Procesa de forma idempotente un evento crudo de integración (ej. Hotmart).
   * 1. Extrae y formatea el payload usando el adaptador de Hotmart.
   * 2. Aplica las políticas de admisión de la integración (validFrom).
   * 3. Filtra la transacción verificando la existencia y estado activo del producto.
   * 4. Valida estrictamente el SCK si el producto lo requiere.
   * 5. Actualiza o crea el registro en Lead y Sale sin colisiones, capturando
   *    el código de oferta y metadatos técnicos.
   * 
   * @param eventId ID del evento almacenado en la tabla `IntegrationEvent`.
   */
  private async processEvent(eventId: string) {
    try {
      const event = await this.prisma.integrationEvent.findUnique({ where: { id: eventId } });
      if (!event || event.status !== EventStatus.RECEIVED) return;

      await this.prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: EventStatus.PROCESSING },
      });

      let rawSale: RawSale;
      if (event.provider === 'HOTMART') {
        rawSale = HotmartAdapter.parseWebhook(event.payload as Record<string, unknown>);
      } else {
        throw new Error(`Proveedor no soportado: ${event.provider}`);
      }

      // 1. Validar fecha contra validFrom de la configuración de la integración
      const config = await this.integrationsService.getConfig(event.projectId);
      if (config?.validFrom && rawSale.date) {
        const saleDate = new Date(rawSale.date);
        const cutoffDate = new Date(config.validFrom);
        if (saleDate < cutoffDate) {
          this.logger.warn(
            `[DESCARTE POR FECHA] Evento ${eventId}: ${saleDate.toISOString()} < ${cutoffDate.toISOString()}`
          );
          await this.prisma.integrationEvent.update({
            where: { id: eventId },
            data: {
              status: EventStatus.SKIPPED_BY_DATE,
              errorReason: `Transacción anterior a la fecha configurada (${saleDate.toISOString()} < ${cutoffDate.toISOString()})`,
              processedAt: new Date(),
            },
          });
          return;
        }
      }

      // 2. Buscar transacción previa para determinar si es nueva o actualización
      let existingSale = await this.prisma.sale.findFirst({
        where: {
          source: rawSale.source,
          externalOrderId: rawSale.externalOrderId,
        },
      });

      // Recuperación de carritos abandonados:
      // Si la transacción actual NO es de carrito y no se encontró por ID (compra nueva),
      // buscamos si existe un carrito abandonado previo del mismo lead (email) y mismo producto o código de oferta.
      if (!existingSale && rawSale.status !== 'PURCHASE_OUT_OF_SHOPPING_CART' && rawSale.leadEmail) {
        const abandonedCart = await this.prisma.sale.findFirst({
          where: {
            projectId: event.projectId,
            status: 'PURCHASE_OUT_OF_SHOPPING_CART',
            lead: { email: rawSale.leadEmail },
            OR: [
              ...(rawSale.productId ? [{ productId: rawSale.productId }] : []),
              ...(rawSale.offerCode ? [{ offerCode: rawSale.offerCode }] : []),
              { productName: rawSale.productName }
            ]
          },
          orderBy: { createdAt: 'desc' }
        });

        if (abandonedCart) {
          existingSale = abandonedCart;
          this.logger.log(`[ABANDONED_CART_RECOVERY] Adoptando carrito abandonado ${abandonedCart.externalOrderId} por nueva transacción ${rawSale.externalOrderId}`);
        }
      }

      // Idempotencia estricta: si ya existe una transacción con el mismo ID Y el mismo estado,
      // es un evento duplicado literal y se descarta sin procesar.
      // Excepción: Pago de cuotas (recurrencyNumber > 1) se permite para sumar al monto.
      if (existingSale && existingSale.status === rawSale.status && (rawSale.recurrencyNumber || 1) <= 1) {
        this.logger.warn(`[SKIP-IDEMPOTENT] Transacción ${rawSale.externalTxnId} con estado ${rawSale.status} ya existe. Evento duplicado.`);
        await this.prisma.integrationEvent.update({
          where: { id: eventId },
          data: { status: EventStatus.PROCESSED, processedAt: new Date() },
        });
        return;
      }

      // Validar si es una cuota (recurrencia > 1) de una venta NO registrada
      if ((rawSale.recurrencyNumber || 1) > 1 && !existingSale) {
        this.logger.warn(`[DESCARTE] Evento ${eventId} es una cuota (${rawSale.recurrencyNumber}) pero no existe transacción original.`);
        await this.prisma.integrationEvent.update({
          where: { id: eventId },
          data: {
            status: EventStatus.SKIPPED_UNKNOWN_PRODUCT,
            errorReason: `Pago de cuota sin transacción original registrada`,
            processedAt: new Date(),
          },
        });
        return;
      }

      // 3. Obtener productos y filtrar estrictamente solo los ACTIVOS
      const allProducts: ProductItem[] = await this.listProjectProductsUseCase
        .execute(event.projectId)
        .catch(() => []);
      const activeProducts = allProducts.filter((p) => p.active === true);

      let matchedProduct: Partial<ProductItem> | null = null;

      if (existingSale) {
        // ES ACTUALIZACIÓN:
        // No exigimos que el webhook traiga offerCode. 
        // Intentamos mapear con el producto del catálogo (incluso inactivo).
        const catalogProduct = allProducts.find(
          (p) =>
            p.offerCode &&
            existingSale.offerCode &&
            p.offerCode.trim().toLowerCase() === existingSale.offerCode.trim().toLowerCase()
        );

        if (catalogProduct) {
          matchedProduct = catalogProduct;
        } else {
          // Si el producto original fue eliminado del JSON de proyectos, usamos los datos históricos
          matchedProduct = {
            id: 'legacy-history',
            name: existingSale.productName,
            isMarketing: false,
            price: Number(existingSale.amount),
            currency: existingSale.currency,
            installments: existingSale.installments || 1,
            active: true,
            offerCode: existingSale.offerCode,
            ownerCloserId: existingSale.closerId,
          };
        }
      } else {
        // ES TRANSACCIÓN NUEVA:
        // Exigencia estricta de offerCode y producto ACTIVO
        if (!rawSale.offerCode) {
          this.logger.warn(`[DESCARTE] Evento ${eventId} es una nueva transacción y no contiene código de oferta.`);
          await this.prisma.integrationEvent.update({
            where: { id: eventId },
            data: {
              status: EventStatus.SKIPPED_UNKNOWN_PRODUCT,
              errorReason: 'Nueva transacción sin código de oferta',
              processedAt: new Date(),
            },
          });
          return;
        }

        matchedProduct = activeProducts.find(
          (p) =>
            p.offerCode &&
            p.offerCode.trim().toLowerCase() === rawSale.offerCode?.trim().toLowerCase()
        ) || null;

        if (!matchedProduct) {
          this.logger.warn(
            `[DESCARTE] Código de oferta '${rawSale.offerCode}' no corresponde a ningún producto ACTIVO en el proyecto ${event.projectId}. Descartando.`
          );
          await this.prisma.integrationEvent.update({
            where: { id: eventId },
            data: {
              status: EventStatus.SKIPPED_UNKNOWN_PRODUCT,
              errorReason: `Producto o código de oferta (${rawSale.offerCode}) no registrado en el catálogo del proyecto`,
              processedAt: new Date(),
            },
          });
          return;
        }

      }

      // 4. Atribución de closer:
      // Única vía: El SCK del webhook coincide con el SCK de algún miembro del proyecto.
      let closerId: string | null = null;

      if (rawSale.sck && !matchedProduct?.isMarketing) {
        try {
          const sck = rawSale.sck.trim();
          const closerUser = await this.prisma.projectUser.findFirst({
            where: {
              projectId: event.projectId,
              sckCodes: {
                has: sck,
              },
            },
          });
          if (closerUser) { closerId = closerUser.userId; }
        } catch {
          // Ignorar si el SCK no resuelve a ningún usuario conocido o si falla la query
        }
      }

      let attribution = closerId ? 'COMERCIAL' : 'MARKETING';

      // Validación de afiliados si no hay closer asignado
      if (!closerId) {
        const affiliates = rawSale.affiliates || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasReynald = affiliates.some((a: any) => 
          a?.affiliate_code === 'B100311196F' && a?.name && a.name.includes('Reynald')
        );
        if (hasReynald) {
          attribution = 'COMERCIAL'; // Ventas equipo comercial sin closer, suman facturación pero sin comisión
        }
      }

      // 5. Valores comerciales tomados estrictamente del producto oficial del proyecto o de la BD histórica
      const officialProductName = matchedProduct!.name!;
      const officialAmount = matchedProduct!.price!;
      const officialCurrency = matchedProduct!.currency || 'USD';
      const officialInstallments = matchedProduct!.installments || 1;
      // Tipo de venta: CLOSED = cierre de equipo comercial; ORGANIC = marketing / sin closer
      // const saleType: 'CLOSED' | 'ORGANIC' = attribution === 'COMERCIAL' ? 'CLOSED' : 'ORGANIC';
      const saleCreatedAt = rawSale.date ? new Date(rawSale.date) : new Date();

      await this.prisma.$transaction(async (tx) => {
        // 6. Determinar situación y etapa en pipeline
        let situacion = this.determineSituacion(rawSale.status);
        let pipelineStage = this.determineStage(rawSale.status, situacion, !!closerId);

        // Upsert manual del Lead (comprador): priorizar teléfono, luego email
        let lead = null;
        if (rawSale.leadPhone) {
          lead = await tx.lead.findFirst({
            where: { projectId: event.projectId, phone: rawSale.leadPhone },
            include: { sales: true }
          });
        }
        if (!lead && rawSale.leadEmail) {
          lead = await tx.lead.findFirst({
            where: { projectId: event.projectId, email: rawSale.leadEmail },
            include: { sales: true }
          });
        }

        let manualSaleToAdopt = null;

        if (lead) {
          const hasExistingSale = existingSale && lead.sales.some(s => s.id === existingSale.id);

          if (!hasExistingSale && !existingSale) {
            // Evento nuevo: buscar si el lead tiene una venta MANUAL que adoptar
            manualSaleToAdopt = lead.sales.find(s => 
              s.source === 'MANUAL' && 
              s.productName === officialProductName &&
              (!closerId || s.closerId === closerId)
            );

            // Si no hay venta manual para adoptar y el lead ya tiene OTRAS ventas,
            // creamos un nuevo lead (1 lead x transacción)
            if (!manualSaleToAdopt && lead.sales.length > 0) {
              lead = null; // Forzar creación de nuevo lead abajo
            }
          } else if (existingSale && !hasExistingSale) {
            // La venta existente pertenece a otro lead. Recuperamos ese lead original.
            lead = await tx.lead.findUnique({ where: { id: existingSale.leadId }, include: { sales: true } });
          }
        }

        if (lead) {
          // El lead existe: actualizar datos faltantes si vienen en la transacción
          const updateData: Prisma.LeadUpdateInput = { updatedAt: new Date() };
          if (!lead.name && rawSale.leadName) updateData.name = rawSale.leadName;
          if (!lead.email && rawSale.leadEmail) updateData.email = rawSale.leadEmail;
          if (!lead.phone && rawSale.leadPhone) updateData.phone = rawSale.leadPhone;
          
          updateData.pipelineStage = pipelineStage;
          if (situacion) updateData.situacion = situacion;
          if (closerId && !lead.closerId) updateData.closerId = closerId;

          lead = await tx.lead.update({
            where: { id: lead.id },
            data: updateData,
            include: { sales: true }
          });
        } else {
          // No existe o se forzó creación por 1:1: crear
          lead = await tx.lead.create({
            data: {
              projectId: event.projectId,
              email: rawSale.leadEmail ?? null,
              name: rawSale.leadName ?? null,
              phone: rawSale.leadPhone ?? null,
              pipelineStage,
              situacion: situacion ?? null,
              closerId: closerId ?? null,
            },
            include: { sales: true }
          });
        }

        if (existingSale) {
          // Transacción existente -> actualizar estado
          const currentMetadata = (existingSale.metadata as Record<string, unknown>) || {};
          const currentHistory = Array.isArray(currentMetadata.history) ? currentMetadata.history : [];
          
          let newHistory = currentHistory;
          let newAmount = Number(existingSale.amount);
          
          // Lógica de Recurrencia (Cuota)
          if ((rawSale.recurrencyNumber || 1) > 1) {
            newAmount = newAmount + officialAmount;
            newHistory = [...newHistory, this.buildHistoryEvent('STATUS_CHANGE', { 
              status: `CUOTA_${rawSale.recurrencyNumber}_${rawSale.status}`, 
              timestamp: saleCreatedAt 
            })];
            this.logger.log(`[CUOTA] Sumando cuota ${rawSale.recurrencyNumber} a venta ${existingSale.externalTxnId}. Nuevo monto: ${newAmount}`);
          } else if (existingSale.status !== rawSale.status || currentHistory.length === 0) {
            if (currentHistory.length === 0) {
              newHistory = [this.buildHistoryEvent('STATUS_CHANGE', { status: existingSale.status, timestamp: existingSale.createdAt, authorName: 'Hotmart' })];
            }
            newHistory = [...newHistory, this.buildHistoryEvent('STATUS_CHANGE', { status: rawSale.status, authorName: 'Hotmart' })];
          }

          const newMetadata = {
            ...currentMetadata,
            ...(rawSale.metadata ? (rawSale.metadata as object) : {}),
            attribution,
            history: newHistory,
          };

          await tx.sale.update({
            where: { id: existingSale.id },
            data: {
              externalOrderId: rawSale.externalOrderId,
              externalTxnId: rawSale.externalTxnId,
              status: rawSale.status,
              amount: newAmount,
              currency: officialCurrency,
              installments: officialInstallments,
              paymentMethod: rawSale.paymentMethod ?? existingSale.paymentMethod,
              offerCode: rawSale.offerCode ?? matchedProduct?.offerCode ?? null,
              sck: rawSale.sck ?? null,
              pipelineStage: pipelineStage,
              metadata: newMetadata as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
            select: {
              id: true,
            },
          });
          this.logger.log(
            `[ACTUALIZADO] Transacción ${rawSale.externalTxnId} actualizada a estado ${rawSale.status}.`
          );
        } else if (manualSaleToAdopt) {
          // Adoptar Venta Manual
          const currentMetadata = (manualSaleToAdopt.metadata as Record<string, unknown>) || {};
          const currentHistory = Array.isArray(currentMetadata.history) ? currentMetadata.history : [];
          const newHistory = [...currentHistory, this.buildHistoryEvent('STATUS_CHANGE', { status: rawSale.status, timestamp: saleCreatedAt, authorName: 'Hotmart' })];
          
          const newMetadata = {
            ...currentMetadata,
            ...(rawSale.metadata ? (rawSale.metadata as object) : {}),
            attribution,
            adoptedFromManual: true,
            history: newHistory,
          };

          await tx.sale.update({
            where: { id: manualSaleToAdopt.id },
            data: {
              source: rawSale.source, // Cambia de MANUAL a HOTMART
              externalOrderId: rawSale.externalOrderId,
              externalTxnId: rawSale.externalTxnId,
              status: rawSale.status,
              amount: officialAmount,
              currency: officialCurrency,
              paymentMethod: rawSale.paymentMethod ?? null,
              installments: officialInstallments,
              offerCode: rawSale.offerCode ?? matchedProduct?.offerCode ?? null,
              sck: rawSale.sck ?? null,
              pipelineStage: pipelineStage,
              metadata: newMetadata as Prisma.InputJsonValue,
              updatedAt: new Date(),
            }
          });
          this.logger.log(`[ADOPTADO] Venta MANUAL ${manualSaleToAdopt.externalTxnId} sobrescrita con ${rawSale.externalTxnId}.`);
        } else {
          // Transacción nueva -> crear
          const initialMetadata = {
            ...(rawSale.metadata ? (rawSale.metadata as object) : {}),
            attribution,
            history: [this.buildHistoryEvent('STATUS_CHANGE', { status: rawSale.status, timestamp: saleCreatedAt, authorName: 'Hotmart' })],
          };

          await tx.sale.create({
            data: {
              projectId: event.projectId,
              leadId: lead.id,
              source: rawSale.source,
              externalOrderId: rawSale.externalOrderId,
              externalTxnId: rawSale.externalTxnId,
              productName: officialProductName,
              productId: rawSale.productId ?? matchedProduct?.id ?? null,
              status: rawSale.status,
              amount: officialAmount,
              currency: officialCurrency,
              paymentMethod: rawSale.paymentMethod ?? null,
              installments: officialInstallments,
              offerCode: rawSale.offerCode ?? matchedProduct?.offerCode ?? null,
              sck: rawSale.sck ?? null,
              closerId: lead.closerId ?? null,
              pipelineStage: pipelineStage,
              metadata: initialMetadata as Prisma.InputJsonValue,
              createdAt: saleCreatedAt,
            },
            select: {
              id: true,
            },
          });
          this.logger.log(
            `[CREADO] Venta ${rawSale.externalTxnId} registrada con producto oficial '${officialProductName}'.`
          );
        }
      });

      await this.prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: EventStatus.PROCESSED, processedAt: new Date() },
      });

      this.logger.log(`[OK] Evento ${eventId} procesado exitosamente.`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[ERROR] Evento ${eventId}`, err);
      await this.prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: EventStatus.FAILED, errorReason: err.message, processedAt: new Date() },
      });
    }
  }

  private determineStage(status: string, situacion: string | null = null, hasCloser: boolean = false): string {
    const sit = situacion || '';
    
    // Ganado
    if (['PAGO_COMPLETO', 'PAGO_A_CUOTAS'].includes(sit) || ['APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE'].includes(status)) {
      return 'won';
    }
    // Perdido / Descartado
    if (['NO_RESPONDE', 'NO_CALIFICA', 'SIN_WSP'].includes(sit) || ['REFUNDED', 'PURCHASE_REFUNDED'].includes(status)) {
      return 'lost';
    }
    // En recuperacion
    if (['ABANDONED_CART', 'PURCHASE_OUT_OF_SHOPPING_CART', 'CHARGEBACK', 'PURCHASE_CHARGEBACK', 'DISPUTE', 'PURCHASE_PROTEST', 'CANCELED', 'PURCHASE_CANCELED', 'EXPIRED'].includes(status)) {
      return 'recovery';
    }
    // En seguimiento
    if (['SEGUIMIENTO', 'POR_PAGAR', 'RESERVA'].includes(sit) || ['WAITING_PAYMENT', 'DELAYED', 'PURCHASE_DELAYED', 'BILLET_PRINTED', 'PURCHASE_BILLET_PRINTED'].includes(status)) {
      return 'followup';
    }
    // Sin contactar
    if (!sit || !hasCloser) {
      return 'uncontacted';
    }

    return 'uncontacted';
  }

  private determineSituacion(status: string): LeadSituacion | null {
    switch (status) {
      case 'APPROVED': 
      case 'PURCHASE_APPROVED': 
      case 'COMPLETE': 
      case 'PURCHASE_COMPLETE':
        return 'PAGO_COMPLETO';
      case 'WAITING_PAYMENT':
      case 'BILLET_PRINTED':
      case 'PURCHASE_BILLET_PRINTED':
        return 'POR_PAGAR';
      case 'DELAYED':
      case 'PURCHASE_DELAYED':
      case 'ABANDONED_CART':
      case 'PURCHASE_OUT_OF_SHOPPING_CART':
      case 'CANCELED':
      case 'PURCHASE_CANCELED':
      case 'CHARGEBACK':
      case 'PURCHASE_CHARGEBACK':
      case 'EXPIRED':
      case 'PURCHASE_PROTEST':
        return 'SEGUIMIENTO';
      default:
        return null;
    }
  }


  private buildHistoryEvent(type: 'STATUS_CHANGE' | 'PIPELINE_MOVE' | 'MANUAL_UPDATE', data: { status?: string, stage?: string, authorName?: string, timestamp?: Date, changes?: Record<string, unknown> }) {
    return {
      type,
      status: data.status,
      stage: data.stage,
      authorName: data.authorName || 'Automático',
      timestamp: (data.timestamp || new Date()).toISOString()
    };
  }

  /**
   * Obtiene la lista de ventas "efectivas" (compras aprobadas o completadas) de un proyecto.
   * Excluye carritos abandonados, reembolsos, etc.
   * Si el usuario es CLOSER, se aplica un filtro RLS implícito para retornar únicamente sus ventas asignadas.
   * Resuelve asíncronamente el nombre y correo del closer asignado.
   *
   * @param projectId Identificador del proyecto.
   * @param user Perfil opcional del usuario para aplicar RLS/aislamiento por rol.
   * @returns Lista de ventas filtradas y enriquecidas con la entidad Closer.
   */
  async listSales(projectId: string, user?: { id: string; role: string }) {
    try {
      if (!this.prisma || !('sale' in this.prisma)) {
        this.logger.warn(`Prisma model 'sale' no está disponible aún.`);
        return [];
      }

      const whereClause: import('@prisma/client').Prisma.SaleWhereInput = { 
        projectId,
        status: { in: ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE'] } 
      };
      
      // Aplicar filtro de aislamiento si el rol global del usuario es CLOSER
      if (user && user.role === 'CLOSER') {
        whereClause.closerId = user.id;
      }

      const sales = await this.prisma.sale.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          source: true,
          externalOrderId: true,
          externalTxnId: true,
          productName: true,
          productId: true,
          offerCode: true,
          sck: true,
          status: true,
          amount: true,
          currency: true,
          paymentMethod: true,
          installments: true,
          createdAt: true,
          pipelineStage: true,
          pipelineSubstatus: true,
          metadata: true,
          closerId: true,
          lead: {
            select: { id: true, name: true, email: true, phone: true, closerId: true, pipelineStage: true, situacion: true, interestedProducts: true },
          },
        },
      });

      const closerIds = Array.from(new Set(sales.map(s => (s as typeof s & { closerId?: string | null }).closerId || s.lead?.closerId).filter(Boolean))) as string[];
      const closers = await this.authService.getUsersByIds(closerIds);
      const closerMap = new Map(closers.map(c => [c.id, c]));

      return sales.map((s) => {
        const cId = (s as typeof s & { closerId?: string | null }).closerId || s.lead?.closerId;
        const closer = cId ? closerMap.get(cId) : null;
        return {
          id: s.id,
          source: s.source,
          externalOrderId: s.externalOrderId,
          externalTxnId: s.externalTxnId,
          productName: s.productName,
          productId: s.productId,
          offerCode: s.offerCode,
          sck: s.sck,
          closerId: cId || null,
          closerName: closer ? closer.fullName || closer.email : null,
          closerEmail: closer ? closer.email : null,
          status: s.status,
          amount: Number(s.amount),
          currency: s.currency,
          paymentMethod: s.paymentMethod || null,
          installments: s.installments || 1,
          pipelineStage: s.pipelineStage || null,
          pipelineSubstatus: s.pipelineSubstatus || null,
          metadata: s.metadata || {},
          createdAt: s.createdAt.toISOString(),
          lead: {
            id: s.lead?.id || null,
            name: s.lead?.name || 'Sin Nombre',
            email: s.lead?.email || 'Sin Correo',
            phone: s.lead?.phone || null,
            closerId: s.lead?.closerId || null,
            pipelineStage: s.lead?.pipelineStage || null,
            situacion: s.lead?.situacion || null,
            interestedProducts: s.lead?.interestedProducts || [],
          },
        };
      });
    } catch (err) {
      this.logger.error(`Error loading sales for project ${projectId}`, err);
      return [];
    }
  }

  /**
   * Obtiene la lista completa de transacciones (trazabilidad total) de un proyecto.
   * Incluye ventas aprobadas, rechazadas, pendientes, reembolsadas y carritos abandonados.
   * Restringido a roles gerenciales (ADMIN, DIRECTOR, SUPER_ADMIN). Los closers no tienen acceso.
   * Resuelve asíncronamente el nombre y correo del closer asignado a la transacción.
   *
   * @param projectId Identificador del proyecto.
   * @returns Lista completa de transacciones históricas enriquecidas.
   */
  async listTransactions(projectId: string) {
    try {
      if (!this.prisma || !('sale' in this.prisma)) {
        this.logger.warn(`Prisma model 'sale' no está disponible aún.`);
        return [];
      }

      const transactions = await this.prisma.sale.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          source: true,
          externalOrderId: true,
          externalTxnId: true,
          productName: true,
          productId: true,
          offerCode: true,
          sck: true,
          status: true,
          amount: true,
          currency: true,
          paymentMethod: true,
          installments: true,
          createdAt: true,
          pipelineStage: true,
          pipelineSubstatus: true,
          metadata: true,
          closerId: true,
          lead: {
            select: { id: true, name: true, email: true, phone: true, closerId: true, situacion: true, interestedProducts: true },
          },
        },
      });

      const closerIds = Array.from(new Set(transactions.map(t => (t as typeof t & { closerId?: string | null }).closerId || t.lead?.closerId).filter(Boolean))) as string[];
      const closers = await this.authService.getUsersByIds(closerIds);
      const closerMap = new Map(closers.map(c => [c.id, c]));

      return transactions.map((t) => {
        const cId = (t as typeof t & { closerId?: string | null }).closerId || t.lead?.closerId;
        const closer = cId ? closerMap.get(cId) : null;
        return {
          id: t.id,
          source: t.source,
          externalOrderId: t.externalOrderId,
          externalTxnId: t.externalTxnId,
          productName: t.productName,
          productId: t.productId,
          offerCode: t.offerCode,
          sck: t.sck,
          closerId: cId || null,
          closerName: closer ? closer.fullName || closer.email : null,
          closerEmail: closer ? closer.email : null,
          status: t.status,
          amount: Number(t.amount),
          currency: t.currency,
          paymentMethod: t.paymentMethod || null,
          installments: t.installments || 1,
          pipelineStage: t.pipelineStage || null,
          pipelineSubstatus: t.pipelineSubstatus || null,
          metadata: t.metadata || {},
          createdAt: t.createdAt.toISOString(),
          lead: {
            id: t.lead?.id || null,
            name: t.lead?.name || 'Sin Nombre',
            email: t.lead?.email || 'Sin Correo',
            phone: t.lead?.phone || null,
            closerId: t.lead?.closerId || null,
            situacion: t.lead?.situacion || null,
            interestedProducts: t.lead?.interestedProducts?.map((ip) => ip.productId) || [],
          },
        };
      });
    } catch (err) {
      this.logger.error(`Error loading transactions for project ${projectId}`, err);
      return [];
    }
  }

  async registerManualSale(projectId: string, dto: ManualSaleDto, _userId: string) {
    // Generate a unique transaction ID for manual sales
    const externalTxnId = `MANUAL-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    return this.prisma.$transaction(async (tx) => {
      let lead = null;
      if (dto.leadPhone) {
        lead = await tx.lead.findFirst({ where: { projectId, phone: dto.leadPhone }, include: { sales: true } });
      }
      if (!lead && dto.leadEmail) {
        lead = await tx.lead.findFirst({ where: { projectId, email: dto.leadEmail }, include: { sales: true } });
      }

      // Si el lead ya tiene transacciones activas, creamos uno nuevo para esta transacción manual
      if (lead && lead.sales.length > 0) {
        lead = null;
      }

      if (lead) {
        lead = await tx.lead.update({
          where: { id: lead.id },
          data: {
            name: dto.leadName,
            phone: dto.leadPhone ?? null,
            ...(dto.closerId ? { closerId: dto.closerId } : {}),
            pipelineStage: this.determineStage(dto.status)
          },
          include: { sales: true }
        });
      } else {
        lead = await tx.lead.create({
          data: {
            projectId,
            email: dto.leadEmail,
            name: dto.leadName,
            phone: dto.leadPhone ?? null,
            closerId: dto.closerId ?? null,
            pipelineStage: this.determineStage(dto.status)
          },
          include: { sales: true }
        });
      }

      const initialMetadata = {
        history: [this.buildHistoryEvent('STATUS_CHANGE', { status: dto.status, timestamp: dto.date ? new Date(dto.date) : new Date() })],
      };

      const sale = await tx.sale.create({
        data: {
          projectId,
          leadId: lead.id,
          source: 'MANUAL',
          externalOrderId: externalTxnId,
          externalTxnId: externalTxnId,
          productName: dto.productName,
          productId: dto.productId ?? null,
          status: dto.status,
          amount: dto.amount,
          currency: dto.currency,
          metadata: initialMetadata as Prisma.InputJsonValue,
          ...(dto.date ? { createdAt: new Date(dto.date) } : {})
        },
        select: {
          id: true,
        },
      });

      return { saleId: sale.id, leadId: lead.id };
    });
  }

  /**
   * Cuenta las transacciones históricas asociadas a un producto dentro de un proyecto.
   * Utilizado para validación defensiva previa a eliminación física.
   */
  async countSalesForProduct(projectId: string, productId: string, _offerCode?: string | null): Promise<number> {
    return this.prisma.sale.count({
      where: {
        projectId,
        productId,
      },
    });
  }

  /**
   * Obtiene la base de leads de un proyecto con sus métricas sumadas.
   * Aplica aislamiento de permisos si el usuario es CLOSER.
   */
  async listLeads(projectId: string, user?: { id: string; role: string }) {
    if (!this.prisma || !('lead' in this.prisma)) return [];

    const whereClause: import('@prisma/client').Prisma.LeadWhereInput = { projectId };
    if (user && user.role === 'CLOSER') {
      whereClause.closerId = user.id;
    }

    const [leads, project] = await Promise.all([
      this.prisma.lead.findMany({
        where: whereClause,
        include: {
          sales: {
            orderBy: { createdAt: 'desc' },
          },
          interestedProducts: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { products: true }
      })
    ]);
    const projectProducts = (project?.products as Array<{ id: string; name: string }>) || [];

    return leads.map(lead => {
      const EFFECTIVE_STATUSES = ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];
      // El valor estimado se calcula solo sobre ventas efectivas (aprobadas)
      const effectiveSales = lead.sales.filter(s => EFFECTIVE_STATUSES.includes(s.status));
      // Si hay ventas efectivas, tomar la más reciente; si no, tomar la última transacción cualquiera para mostrar info del producto
      const representativeSale = effectiveSales[0] ?? lead.sales[0];
      // Valor = precio del producto * cuotas de la venta más reciente aprobada (no suma duplicados)
      const estimatedValue = representativeSale ? Number(representativeSale.amount) : 0;
      
      // Atribución: si la sale tiene closerId => Comercial, sino => Marketing
      const hasCloser = !!(representativeSale?.closerId || lead.closerId);
      const attribution = hasCloser ? 'COMERCIAL' : 'MARKETING';

      // Productos de interés (formato string separado por comas o primer producto)
      let firstProductName = 'N/A';
      if (representativeSale?.productName) {
        firstProductName = representativeSale.productName;
      } else if (lead.interestedProducts.length > 0) {
        firstProductName = 'Interesado en Producto(s)'; // Se ajusta visualmente en el frontend si hace falta
      }

      // Agrupar historial por externalOrderId para evitar transacciones repetidas en frontend
      const historyByOrder = new Map<string, Record<string, unknown>[]>();
      lead.sales.forEach(s => {
        const orderId = s.externalOrderId || s.externalTxnId;
        if (!historyByOrder.has(orderId)) {
          historyByOrder.set(orderId, []);
        }
        historyByOrder.get(orderId)!.push({
          id: s.id,
          status: s.status,
          externalTxnId: s.externalTxnId,
          externalOrderId: s.externalOrderId,
          productName: s.productName,
          amount: Number(s.amount),
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          source: s.source,
          sck: s.sck,
          pipelineStage: s.pipelineStage,
          pipelineSubstatus: s.pipelineSubstatus
        });
      });

      return {
        id: lead.id,
        fullName: lead.name || 'Sin Nombre',
        email: lead.email,
        phone: lead.phone || '',
        stageId: lead.pipelineStage || 'uncontacted',
        situacion: lead.situacion,
        lastContact: lead.updatedAt.toISOString(),
        estimatedValue,
        productName: representativeSale?.productName || firstProductName,
        closerId: representativeSale?.closerId || lead.closerId || undefined,
        source: representativeSale?.source || 'MANUAL',
        installments: representativeSale?.installments || 1,
        offerCode: representativeSale?.offerCode || undefined,
        attribution,
        interestedProducts: lead.interestedProducts.map(ip => {
          const match = projectProducts.find(p => p.id === ip.productId);
          return match ? match.name : ip.productId;
        }),
        latestTransaction: representativeSale ? {
          id: representativeSale.id,
          status: representativeSale.status,
          externalTxnId: representativeSale.externalTxnId,
          externalOrderId: representativeSale.externalOrderId,
          createdAt: representativeSale.createdAt.toISOString(),
          paymentMethod: representativeSale.paymentMethod,
          productName: representativeSale.productName,
          amount: Number(representativeSale.amount),
          currency: representativeSale.currency,
          installments: representativeSale.installments,
          offerCode: representativeSale.offerCode,
          sck: representativeSale.sck,
          closerId: representativeSale.closerId || lead.closerId || null,
          metadata: representativeSale.metadata,
          source: representativeSale.source,
          attribution,
          pipelineStage: representativeSale.pipelineStage,
          pipelineSubstatus: representativeSale.pipelineSubstatus,
          lead: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone
          },
          // Pasamos el history agrupado
          history: Array.from(historyByOrder.entries()).map(([orderId, txns]) => ({
            orderId,
            transactions: txns
          }))
        } : null
      };
    });
  }

  /**
   * Actualiza la etapa del pipeline de un lead manualmente.
   */
  async updateLeadStage(projectId: string, leadId: string, stageId: string, user?: { id: string; role: string }) {
    const whereClause: import('@prisma/client').Prisma.LeadWhereInput = { id: leadId, projectId };
    if (user && user.role === 'CLOSER') {
      whereClause.closerId = user.id;
    }

    const lead = await this.prisma.lead.findFirst({ 
      where: whereClause,
      include: { sales: true }
    });
    if (!lead) throw new Error('Lead no encontrado o sin permisos');

    // Obtener información del autor
    let authorName = 'Sistema';
    if (user) {
      const actor = await this.authService.getUserById(user.id).catch(() => null);
      if (actor) authorName = actor.fullName || actor.email;
    }

    // Nombres de las etapas para el historial (para mayor legibilidad)
    const stageMap: Record<string, string> = {
      won: 'Ganado',
      lost: 'Perdido',
      recovery: 'Para Recuperación',
      followup: 'En Seguimiento',
      uncontacted: 'Sin contactar',
    };
    const stageName = stageMap[stageId] || stageId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar estado del lead
      await tx.lead.update({
        where: { id: lead.id },
        data: { pipelineStage: stageId, updatedAt: new Date() }
      });

      // 2. Inyectar evento de movimiento de pipeline en todas las transacciones asociadas
      const pipelineEvent = this.buildHistoryEvent('PIPELINE_MOVE', { stage: stageName, authorName });

      for (const sale of lead.sales) {
        const meta = (sale.metadata as Record<string, unknown>) || {};
        let currentHistory = Array.isArray(meta.history) ? meta.history : [];
        if (currentHistory.length === 0) {
           currentHistory = [this.buildHistoryEvent('STATUS_CHANGE', { status: sale.status, timestamp: sale.createdAt })];
        }

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            metadata: {
              ...meta,
              history: [...currentHistory, pipelineEvent]
            }
          }
        });
      }
    });

    return { success: true };
  }

  /**
   * Actualiza los datos de un lead manualmente.
   */
  async updateLead(projectId: string, leadId: string, data: import('@gs/contracts').UpdateLeadDto, user?: { id: string; role: string }) {
    const whereClause: import('@prisma/client').Prisma.LeadWhereInput = { id: leadId, projectId };
    if (user && user.role === 'CLOSER') {
      whereClause.closerId = user.id;
    }

    const lead = await this.prisma.lead.findFirst({ where: whereClause });
    if (!lead) throw new Error('Lead no encontrado o sin permisos');

    const updateData: import('@prisma/client').Prisma.LeadUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.closerId !== undefined) updateData.closerId = data.closerId;
    if (data.situacion !== undefined) updateData.situacion = data.situacion as import('@prisma/client').LeadSituacion | null;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.lead.update({
          where: { id: lead.id },
          data: updateData
        });
      }

      if (data.productOfInterest) {
        try {
          const project = await tx.project.findUnique({ where: { id: projectId }, select: { products: true }});
          const products = (project?.products as Array<{ id: string; name: string }>) || [];
          const matchedProd = products.find(p => p.name.toLowerCase().includes(data.productOfInterest!.toLowerCase()));
          const logicalId = matchedProd ? matchedProd.id : data.productOfInterest;

          await tx.leadInterestedProduct.upsert({
            where: {
              leadId_productId: { leadId: lead.id, productId: logicalId }
            },
            create: {
              leadId: lead.id,
              productId: logicalId,
              note: 'Asignado manualmente',
            },
            update: {}
          });
        } catch (err) {
          // Log error para depurar por qué no se inserta
          this.logger.error('Error insertando producto de interes:', err);
        }
      }
    });

    return { success: true };
  }

  /**
   * Actualiza el estado o etapa de una transacción manualmente.
   */
  async updateTransactionStatus(projectId: string, txnId: string, data: import('@gs/contracts').UpdateTransactionStatusDto, user?: { id: string; role: string }) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: txnId, projectId },
      include: { lead: true }
    });

    if (!sale) throw new Error('Transacción no encontrada o sin permisos');

    // Validar permisos del closer (solo puede modificar si el lead o la venta están asignados a él)
    if (user && user.role === 'CLOSER') {
      if (sale.closerId !== user.id && sale.lead?.closerId !== user.id) {
        throw new Error('Permisos insuficientes para modificar esta transacción');
      }
    }

    const updateData: import('@prisma/client').Prisma.SaleUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.pipelineStage !== undefined) updateData.pipelineStage = data.pipelineStage;
    if (data.pipelineSubstatus !== undefined) updateData.pipelineSubstatus = data.pipelineSubstatus;

    // Registrar en el historial
    let authorName = 'Sistema';
    if (user) {
      const actor = await this.authService.getUserById(user.id).catch(() => null);
      if (actor) authorName = actor.fullName || actor.email;
    }

    const meta = (sale.metadata as Record<string, unknown>) || {};
    let currentHistory = Array.isArray(meta.history) ? meta.history : [];
    if (currentHistory.length === 0) {
       currentHistory = [this.buildHistoryEvent('STATUS_CHANGE', { status: sale.status, timestamp: sale.createdAt })];
    }
    const updateEvent = this.buildHistoryEvent('STATUS_CHANGE', { 
      status: updateData.status as string || sale.status,
      authorName, 
      changes: updateData 
    });

    updateData.metadata = {
      ...meta,
      history: [...currentHistory, updateEvent]
    };

    const statusChanged = data.status !== undefined && data.status !== sale.status;
    let newLeadStage = data.pipelineStage;
    let newLeadSituacion = this.determineSituacion(data.status || sale.status);

    // Si la venta cambia a aprobada, automáticamente actualizar el stage a 'won'
    if (statusChanged && data.status && ['APPROVED', 'COMPLETE', 'COMPLETED', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE'].includes(data.status)) {
      updateData.pipelineStage = 'won';
      if (!updateData.pipelineSubstatus) updateData.pipelineSubstatus = 'PAGO COMPLETO';
      newLeadStage = 'won';
    } else if (statusChanged && data.status && ['REFUNDED', 'PURCHASE_REFUNDED', 'CHARGEBACK', 'PURCHASE_CHARGEBACK', 'CANCELED', 'PURCHASE_CANCELED'].includes(data.status)) {
      updateData.pipelineStage = 'lost';
      newLeadStage = 'lost';
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar la transacción
      await tx.sale.update({
        where: { id: sale.id },
        data: updateData
      });

      // 2. Sincronizar el lead si cambió de estado o etapa
      if (statusChanged || newLeadStage) {
        const leadUpdateData: import('@prisma/client').Prisma.LeadUpdateInput = {};
        if (newLeadStage) leadUpdateData.pipelineStage = newLeadStage;
        if (newLeadSituacion) leadUpdateData.situacion = newLeadSituacion;

        if (Object.keys(leadUpdateData).length > 0) {
          await tx.lead.update({
            where: { id: sale.leadId },
            data: leadUpdateData
          });
        }
      }
    });

    return { success: true };
  }


  // -------------------------------------------------------------
  // IMPORTACIÓN MASIVA DESDE CSV
  // -------------------------------------------------------------
  
  async importLeadCsv(projectId: string, dto: CsvLeadImportDto, requestedBy: string) {
    // ── Resolución de closerId y configuraciones cross-schema ──
    let closerId: string | null = null;

    if (dto.sck) {
      const closerUser = await this.prisma.projectUser.findFirst({
        where: { projectId, sckCodes: { has: dto.sck.trim() } },
      });
      if (closerUser) closerId = closerUser.userId;
    }

    if (!closerId && dto.closerId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.closerId) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.closerId);
      if (isUUID) {
        // UUID directo: verificar que sea miembro del proyecto
        const isMember = await this.prisma.projectUser.findFirst({
          where: { projectId, userId: dto.closerId },
        });
        if (isMember) closerId = dto.closerId;
      } else if (dto.closerId.includes('@')) {
        const u = await this.authService.getUserByEmail(dto.closerId).catch(() => null);
        if (u) closerId = u.id;
      }
    }

    // ── Determinar etapa del pipeline ──
    let derivedStage = 'uncontacted';
    if (dto.pipelineStage) {
      derivedStage = dto.pipelineStage;
    } else if (dto.situacion) {
      derivedStage = this.determineStage('', dto.situacion, !!closerId);
    } else {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { settings: true },
      });
      const settings = project?.settings as { pipelineStages?: { id: string }[] } | null;
      if (settings?.pipelineStages?.[0]?.id) {
        derivedStage = settings.pipelineStages[0].id;
      }
    }

    return withRls(this.prisma, { userId: requestedBy, role: 'ADMIN' }, async (tx: Prisma.TransactionClient) => {
      let lead = null;
      if (dto.phone) {
        lead = await tx.lead.findFirst({ where: { projectId, phone: dto.phone } });
      }
      if (!lead && dto.email) {
        lead = await tx.lead.findFirst({ where: { projectId, email: dto.email } });
      }

      if (lead) {
        const updateData: Prisma.LeadUpdateInput = { updatedAt: new Date() };
        if (!lead.name && dto.name) updateData.name = dto.name;
        if (!lead.email && dto.email) updateData.email = dto.email;
        if (!lead.phone && dto.phone) updateData.phone = dto.phone;
        if (closerId) updateData.closerId = closerId;
        
        // Si se envía pipelineStage o situacion explicitamente, se actualizan. 
        // Si situacion viene pero pipelineStage no, pipelineStage tomará derivedStage que se calculó arriba.
        updateData.pipelineStage = derivedStage;
        if (dto.situacion !== undefined) updateData.situacion = dto.situacion;
        
        lead = await tx.lead.update({
          where: { id: lead.id },
          data: updateData
        });
      } else {
        lead = await tx.lead.create({
          data: {
            projectId,
            email: dto.email ?? null,
            name: dto.name ?? null,
            phone: dto.phone ?? null,
            closerId: closerId ?? null,
            situacion: dto.situacion ?? null,
            pipelineStage: derivedStage,
          }
        });
      }

      // ── Mapear Producto de Interés (si viene en el CSV) ────────────────
      if (dto.productOfInterest) {
        try {
          // Buscamos el producto en el JSON de configuracion del proyecto
          const project = await tx.project.findUnique({ where: { id: projectId }, select: { products: true }});
          const products = (project?.products as Array<{ id: string; name: string }>) || [];
          const matchedProd = products.find(p => p.name.toLowerCase().includes(dto.productOfInterest!.toLowerCase()));
          
          // Usamos el ID si se encuentra, si no usamos el nombre directamente como ID lógico temporal
          const logicalId = matchedProd ? matchedProd.id : dto.productOfInterest;

          await tx.leadInterestedProduct.upsert({
            where: {
              leadId_productId: { leadId: lead.id, productId: logicalId }
            },
            create: {
              leadId: lead.id,
              productId: logicalId,
              note: 'Importado vía CSV',
            },
            update: {} // Si ya existe, no hace nada
          });
        } catch {
          // Fallback silencioso si no se encuentra el producto o hay error
        }
      }

      return lead;
    });
  }

  async importSaleCsv(projectId: string, dto: CsvSaleImportDto, requestedBy: string) {
    return withRls(this.prisma, { userId: requestedBy, role: 'ADMIN' }, async (tx: Prisma.TransactionClient) => {
      // 1. Validar unicidad por ID de transacción
      const existingSale = await tx.sale.findFirst({
        where: { projectId, externalTxnId: dto.externalTxnId }
      });
      if (existingSale) throw new Error(`La transacción ${dto.externalTxnId} ya existe.`);

      // ── Resolución de closerId ──────────────────────────────────
      let closerId: string | null = null;
      if (dto.sck) {
        try {
          const closerUser = await tx.projectUser.findFirst({
            where: { projectId, sckCodes: { has: dto.sck.trim() } },
          });
          if (closerUser) closerId = closerUser.userId;
        } catch {
          // Ignorar si el SCK no resuelve
        }
      }

      // 2. Determinar etapa en pipeline para esta transacción
      const situacion = this.determineSituacion(dto.status);
      const pipelineStage = this.determineStage(dto.status, situacion, !!closerId);

      // 3. Crear o actualizar Lead comprador (Priorizar Teléfono)
      let lead = null;
      if (dto.leadPhone) {
        lead = await tx.lead.findFirst({ 
          where: { projectId, phone: dto.leadPhone },
          include: { sales: true }
        });
      }
      if (!lead && dto.leadEmail) {
        lead = await tx.lead.findFirst({ 
          where: { projectId, email: dto.leadEmail },
          include: { sales: true } 
        });
      }

      // Si el lead ya tiene transacciones (y esta importación es una transacción NUEVA),
      // creamos un nuevo lead para cumplir la regla 1 Lead x Transacción
      if (lead && lead.sales.length > 0) {
        lead = null;
      }

      if (lead) {
        const updateData: Prisma.LeadUpdateInput = { updatedAt: new Date() };
        if (!lead.name && dto.leadName) updateData.name = dto.leadName;
        if (!lead.email && dto.leadEmail) updateData.email = dto.leadEmail;
        if (!lead.phone && dto.leadPhone) updateData.phone = dto.leadPhone;
        // Solo actualizar el pipeline stage del lead si la nueva transacción
        // representa un avance o cambio relevante (por simplicidad, lo sobreescribimos)
        updateData.pipelineStage = pipelineStage;
        if (situacion) updateData.situacion = situacion;
        if (closerId && !lead.closerId) updateData.closerId = closerId;
        
        lead = await tx.lead.update({ where: { id: lead.id }, data: updateData, include: { sales: true } });
      } else {
        lead = await tx.lead.create({
          data: {
            projectId,
            email: dto.leadEmail ?? null,
            name: dto.leadName ?? null,
            phone: dto.leadPhone ?? null,
            pipelineStage,
            situacion: situacion ?? null,
            closerId,
          },
          include: { sales: true }
        });
      }

      // 4. Crear Venta
      const parsedDate = dto.date ? new Date(dto.date) : new Date();
      const saleDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const orderId = dto.externalOrderId || dto.externalTxnId;

      const sale = await tx.sale.create({
        data: {
          projectId,
          leadId: lead.id,
          source: 'CSV_IMPORT',
          externalOrderId: orderId, 
          externalTxnId: dto.externalTxnId,
          productName: dto.productName || 'Importado CSV',
          status: dto.status,
          amount: dto.amount ?? 0,
          currency: dto.currency ?? 'USD',
          createdAt: saleDate,
          closerId: closerId ?? null,
          offerCode: dto.offerCode ?? null,
          sck: dto.sck ?? null,
          paymentMethod: dto.paymentMethod ?? null,
          installments: dto.installments,
          pipelineStage,
          metadata: { 
            history: [this.buildHistoryEvent('STATUS_CHANGE', { status: dto.status, timestamp: saleDate })],
            isFirstInstallment: dto.isFirstInstallment
          }
        }
      });
      return sale;
    });
  }
}

