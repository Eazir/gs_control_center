import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { AuthPublicService } from '../auth';
import { PrismaService } from '../../core/database';
import { RedisService } from '../../core/redis';
import { HotmartAdapter } from '../../infrastructure/providers/hotmart/hotmart.adapter';
import { RawSale, ManualSaleDto, ProductItem, CsvLeadImportDto, CsvSaleImportDto } from '@gs/contracts';
import { ListProjectProductsUseCase } from '../projects';
import { IntegrationsService } from '../integrations';
import { EventStatus, Prisma } from '@prisma/client';
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
      const existingSale = await this.prisma.sale.findFirst({
        where: {
          source: rawSale.source,
          externalOrderId: rawSale.externalOrderId,
        },
      });

      // Idempotencia estricta: si ya existe una transacción con el mismo ID Y el mismo estado,
      // es un evento duplicado literal y se descarta sin procesar.
      // Si el estado difiere, es una actualización de trazabilidad (ej. carrito → aprobado) y se continúa.
      if (existingSale && existingSale.status === rawSale.status) {
        this.logger.warn(`[SKIP-IDEMPOTENT] Transacción ${rawSale.externalTxnId} con estado ${rawSale.status} ya existe. Evento duplicado.`);
        await this.prisma.integrationEvent.update({
          where: { id: eventId },
          data: { status: EventStatus.PROCESSED, processedAt: new Date() },
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
            name: existingSale.productName,
            price: Number(existingSale.amount),
            currency: existingSale.currency,
            installments: existingSale.installments || 1,
            offerCode: existingSale.offerCode,
            sck: existingSale.sck,
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
            `[DESCARTE] Código de oferta '${rawSale.offerCode}' no corresponde a ningún producto ACTIVO en el proyecto ${event.projectId}.`
          );
          await this.prisma.integrationEvent.update({
            where: { id: eventId },
            data: {
              status: EventStatus.SKIPPED_UNKNOWN_PRODUCT,
              errorReason: `El código de oferta '${rawSale.offerCode}' no coincide con ningún producto activo del proyecto`,
              processedAt: new Date(),
            },
          });
          return;
        }

        // Validar SCK si el producto activo lo tiene configurado
        if (matchedProduct.sck && matchedProduct.sck.trim()) {
          const expectedSck = matchedProduct.sck.trim().toLowerCase();
          const incomingSck = rawSale.sck?.trim().toLowerCase();
          if (incomingSck !== expectedSck) {
            this.logger.warn(
              `[DESCARTE SCK] Evento ${eventId}: SCK no coincide. Esperado: '${expectedSck}', Recibido: '${incomingSck}'.`
            );
            await this.prisma.integrationEvent.update({
              where: { id: eventId },
              data: {
                status: EventStatus.FAILED,
                errorReason: `SCK no coincide (esperado: '${expectedSck}', recibido: '${incomingSck || 'vacío'}')`,
                processedAt: new Date(),
              },
            });
            return;
          }
        }
      }

      // 4. Atribución de closer:
      // Prioridad 1: El producto tiene ownerCloserId asignado en el catálogo del proyecto.
      // Prioridad 2: El SCK del webhook coincide con el SCK de algún miembro del proyecto (buscando por username, email o UUID).
      // Si no hay ningún closer => Atribución Marketing (venta orgánica desde campaña o sin asignación).
      let closerId: string | null = matchedProduct.ownerCloserId || null;

      if (!closerId && rawSale.sck) {
        try {
          const sck = rawSale.sck.trim();
          // 2a. Si el SCK parece email, buscar por email
          if (sck.includes('@')) {
            const closerUser = await this.authService.getUserByEmail(sck);
            if (closerUser) { closerId = closerUser.id; }
          // 2b. Si el SCK es UUID de 36 chars, buscar por id
          } else if (sck.length === 36) {
            const closerUser = await this.authService.getUserById(sck);
            if (closerUser) { closerId = closerUser.id; }
          }
          // Nota: SCKs como "closer-1", "marketing" etc. son identificadores externos de Hotmart,
          // no se mapean a usuarios del sistema. El producto ya trae ownerCloserId si aplica.
        } catch {
          // Ignorar si el SCK no resuelve a ningún usuario conocido
        }
      }

      // 5. Valores comerciales tomados estrictamente del producto oficial del proyecto o de la BD histórica
      const officialProductName = matchedProduct.name!;
      const officialAmount = matchedProduct.price!;
      const officialCurrency = matchedProduct.currency || 'USD';
      const officialInstallments = matchedProduct.installments || 1;
      // Tipo de venta: CLOSED = cierre de equipo comercial; ORGANIC = marketing / sin closer
      // const saleType: 'CLOSED' | 'ORGANIC' = attribution === 'COMERCIAL' ? 'CLOSED' : 'ORGANIC';
      const saleCreatedAt = rawSale.date ? new Date(rawSale.date) : new Date();

      await this.prisma.$transaction(async (tx) => {
        // Upsert del Lead (comprador): crear si no existe, actualizar si ya existe
        const lead = await tx.lead.upsert({
          where: {
            projectId_email: {
              projectId: event.projectId,
              email: rawSale.leadEmail,
            },
          },
          create: {
            projectId: event.projectId,
            email: rawSale.leadEmail,
            name: rawSale.leadName ?? null,
            phone: rawSale.leadPhone ?? null,
            pipelineStage: this.determineStage(rawSale.status),
            closerId: closerId ?? null,
          },
          update: {
            ...(rawSale.leadName ? { name: rawSale.leadName } : {}),
            ...(rawSale.leadPhone ? { phone: rawSale.leadPhone } : {}),
            pipelineStage: this.determineStage(rawSale.status),
            ...(closerId ? { closerId } : {}),
            updatedAt: new Date(),
          },
        });

        if (existingSale) {
          // Transacción existente -> actualizar estado
          const currentMetadata = (existingSale.metadata as Record<string, unknown>) || {};
          const currentHistory = Array.isArray(currentMetadata.history) ? currentMetadata.history : [];
          
          // Agregamos el historial si el estado cambió
          let newHistory = currentHistory;
          if (existingSale.status !== rawSale.status || currentHistory.length === 0) {
            if (currentHistory.length === 0) {
              newHistory = [this.buildHistoryEvent('STATUS_CHANGE', { status: existingSale.status, timestamp: existingSale.createdAt })];
            }
            newHistory = [...newHistory, this.buildHistoryEvent('STATUS_CHANGE', { status: rawSale.status })];
          }

          const newMetadata = {
            ...currentMetadata,
            ...(rawSale.metadata ? (rawSale.metadata as object) : {}),
            history: newHistory,
          };

          await tx.sale.update({
            where: { id: existingSale.id },
            data: {
              status: rawSale.status,
              amount: officialAmount,
              currency: officialCurrency,
              installments: officialInstallments,
              paymentMethod: rawSale.paymentMethod ?? existingSale.paymentMethod,
              offerCode: rawSale.offerCode ?? matchedProduct.offerCode ?? null,
              sck: rawSale.sck ?? matchedProduct.sck ?? null,
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
        } else {
          // Transacción nueva -> crear
          const initialMetadata = {
            ...(rawSale.metadata ? (rawSale.metadata as object) : {}),
            history: [this.buildHistoryEvent('STATUS_CHANGE', { status: rawSale.status, timestamp: saleCreatedAt })],
          };

          await tx.sale.create({
            data: {
              projectId: event.projectId,
              leadId: lead.id,
              source: rawSale.source,
              externalOrderId: rawSale.externalOrderId,
              externalTxnId: rawSale.externalTxnId,
              productName: officialProductName,
              productId: rawSale.productId ?? matchedProduct.id ?? null,
              status: rawSale.status,
              amount: officialAmount,
              currency: officialCurrency,
              paymentMethod: rawSale.paymentMethod ?? null,
              installments: officialInstallments,
              offerCode: rawSale.offerCode ?? matchedProduct.offerCode ?? null,
              sck: rawSale.sck ?? matchedProduct.sck ?? null,
              closerId: lead.closerId ?? null,
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

  private determineStage(status: string): string {
    switch (status) {
      case 'APPROVED': 
      case 'PURCHASE_APPROVED': 
      case 'COMPLETE': 
        return 'won';
      case 'REFUNDED': 
      case 'DISPUTE': 
        return 'lost';
      case 'ABANDONED_CART':
      case 'CANCELED': 
      case 'CHARGEBACK': 
      case 'EXPIRED':
        return 'recovery';
      case 'WAITING_PAYMENT':
      case 'DELAYED':
      case 'BILLET_PRINTED': 
        return 'followup';
      default: 
        return 'uncontacted';
    }
  }

  private buildHistoryEvent(type: 'STATUS_CHANGE' | 'PIPELINE_MOVE', data: { status?: string, stage?: string, authorName?: string, timestamp?: Date }) {
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
        status: { in: ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED'] } 
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
          metadata: true,
          closerId: true,
          lead: {
            select: { id: true, name: true, email: true, phone: true, closerId: true },
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
          metadata: s.metadata || {},
          createdAt: s.createdAt.toISOString(),
          lead: {
            id: s.lead?.id || null,
            name: s.lead?.name || 'Sin Nombre',
            email: s.lead?.email || 'Sin Correo',
            phone: s.lead?.phone || null,
            closerId: s.lead?.closerId || null,
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
          metadata: true,
          closerId: true,
          lead: {
            select: { id: true, name: true, email: true, phone: true, closerId: true },
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
          metadata: t.metadata || {},
          createdAt: t.createdAt.toISOString(),
          lead: {
            id: t.lead?.id || null,
            name: t.lead?.name || 'Sin Nombre',
            email: t.lead?.email || 'Sin Correo',
            phone: t.lead?.phone || null,
            closerId: t.lead?.closerId || null,
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
      const lead = await tx.lead.upsert({
        where: {
          projectId_email: { projectId, email: dto.leadEmail }
        },
        create: {
          projectId,
          email: dto.leadEmail,
          name: dto.leadName,
          phone: dto.leadPhone ?? null,
          closerId: dto.closerId ?? null,
          pipelineStage: this.determineStage(dto.status)
        },
        update: {
          name: dto.leadName,
          phone: dto.leadPhone ?? null,
          ...(dto.closerId ? { closerId: dto.closerId } : {}),
          pipelineStage: this.determineStage(dto.status)
        }
      });

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

    const leads = await this.prisma.lead.findMany({
      where: whereClause,
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    return leads.map(lead => {
      const EFFECTIVE_STATUSES = ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED'];
      // El valor estimado se calcula solo sobre ventas efectivas (aprobadas)
      const effectiveSales = lead.sales.filter(s => EFFECTIVE_STATUSES.includes(s.status));
      // Si hay ventas efectivas, tomar la más reciente; si no, tomar la última transacción cualquiera para mostrar info del producto
      const representativeSale = effectiveSales[0] ?? lead.sales[0];
      // Valor = precio del producto * cuotas de la venta más reciente aprobada (no suma duplicados)
      const estimatedValue = representativeSale ? Number(representativeSale.amount) : 0;
      
      // Atribución: si la sale tiene closerId => Comercial, sino => Marketing
      const hasCloser = !!(representativeSale?.closerId || lead.closerId);
      const attribution = hasCloser ? 'COMERCIAL' : 'MARKETING';

      return {
        id: lead.id,
        fullName: lead.name || 'Sin Nombre',
        email: lead.email,
        phone: lead.phone || '',
        stageId: lead.pipelineStage || 'uncontacted',
        lastContact: lead.updatedAt.toISOString(),
        estimatedValue,
        productName: representativeSale?.productName || 'N/A',
        closerId: representativeSale?.closerId || lead.closerId || undefined,
        // closerName se resuelve en el frontend usando la lista de miembros del proyecto
        source: representativeSale?.source || 'MANUAL',
        installments: representativeSale?.installments || 1,
        offerCode: representativeSale?.offerCode || undefined,
        attribution,
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
          lead: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone
          },
          // Historial de todas las transacciones del lead para trazabilidad
          history: lead.sales.map(s => ({
            id: s.id,
            status: s.status,
            externalTxnId: s.externalTxnId,
            productName: s.productName,
            amount: Number(s.amount),
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            source: s.source,
            sck: s.sck,
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

  // -------------------------------------------------------------
  // IMPORTACIÓN MASIVA DESDE CSV
  // -------------------------------------------------------------
  
  async importLeadCsv(projectId: string, dto: CsvLeadImportDto, requestedBy: string) {
    return withRls(this.prisma, { userId: requestedBy, role: 'ADMIN' }, async (tx: Prisma.TransactionClient) => {
      // Usar upsert para no duplicar correos dentro del mismo proyecto
      const lead = await tx.lead.upsert({
        where: {
          projectId_email: { projectId, email: dto.email }
        },
        create: {
          projectId,
          email: dto.email,
          name: dto.name ?? null,
          phone: dto.phone ?? null,
          closerId: dto.closerId ?? null,
          pipelineStage: 'uncontacted', // Columna por defecto según plan
        },
        update: {
          name: dto.name ?? null,
          phone: dto.phone ?? null,
          closerId: dto.closerId ?? null,
          // Mantener pipelineStage existente si ya estaba
        }
      });
      return lead;
    });
  }

  async importSaleCsv(projectId: string, dto: CsvSaleImportDto, requestedBy: string) {
    return withRls(this.prisma, { userId: requestedBy, role: 'ADMIN' }, async (tx: Prisma.TransactionClient) => {
      // 1. Validar que la transacción no exista globalmente o en el proyecto
      const existingSale = await tx.sale.findFirst({
        where: {
          projectId,
          externalTxnId: dto.externalTxnId,
        }
      });
      
      if (existingSale) {
        throw new Error(`La transacción ${dto.externalTxnId} ya existe en el proyecto.`);
      }

      // 2. Crear o actualizar Lead comprador
      const lead = await tx.lead.upsert({
        where: {
          projectId_email: { projectId, email: dto.leadEmail }
        },
        create: {
          projectId,
          email: dto.leadEmail,
          name: dto.leadName ?? null,
          closerId: dto.closerId ?? null,
          pipelineStage: 'uncontacted',
        },
        update: {
          name: dto.leadName ?? null,
          closerId: dto.closerId ?? null,
        }
      });

      // 3. Crear Venta
      const sale = await tx.sale.create({
        data: {
          projectId,
          leadId: lead.id,
          source: 'CSV_IMPORT',
          externalOrderId: dto.externalTxnId, // Usamos el mismo como orderId
          externalTxnId: dto.externalTxnId,
          productName: dto.productName,
          status: 'APPROVED',
          amount: dto.amount,
          currency: dto.currency,
          createdAt: dto.date ? new Date(dto.date) : new Date(),
          closerId: dto.closerId ?? lead.closerId ?? null,
          metadata: { history: [this.buildHistoryEvent('STATUS_CHANGE', { status: 'APPROVED' })] }
        }
      });
      
      return sale;
    });
  }
}

