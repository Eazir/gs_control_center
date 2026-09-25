import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AuthPublicService, type UserPublicProfile } from '../auth';
import { PrismaService } from '../../core/database';
import { RedisService } from '../../core/redis';
import { HotmartAdapter } from '../../infrastructure/providers/hotmart/hotmart.adapter';
import { RawSale, ManualSaleDto } from '@gs/contracts';

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
  ) {}

  onModuleInit() {
    const isWorker = process.argv.some(arg => arg === '--role=worker');
    if (isWorker) {
      this.startWorkerLoop().catch(err => {
        this.logger.error('Error crítico al iniciar el Worker Loop', err);
      });
    }
  }

  async getSaleDetails(saleId: string, closerId: string) {
    const profile = await this.authService.getProfile(closerId);
    return {
      saleId,
      closer: profile.email,
      amount: 497,
      currency: 'USD',
    };
  }

  private async startWorkerLoop() {
    const client = this.redis.getClient().duplicate();
    this.logger.log('Iniciando Worker de Integraciones y Ventas...');
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
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processEvent(eventId: string) {
    try {
      const event = await this.prisma.integrationEvent.findUnique({ where: { id: eventId } });
      if (!event || event.status !== 'RECEIVED') return;

      await this.prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSING' }
      });

      let rawSale: RawSale;
      if (event.provider === 'HOTMART') {
        rawSale = HotmartAdapter.parseWebhook(event.payload as Record<string, unknown>);
      } else {
        throw new Error(`Proveedor no soportado: ${event.provider}`);
      }

      await this.prisma.$transaction(async (tx) => {
        const existingSale = await tx.sale.findUnique({
          where: {
            source_externalOrderId_externalTxnId: {
              source: rawSale.source,
              externalOrderId: rawSale.externalOrderId,
              externalTxnId: rawSale.externalTxnId
            }
          }
        });

        if (existingSale) {
          throw new Error('DUPLICATE');
        }

        const lead = await tx.lead.upsert({
          where: {
            projectId_email: {
              projectId: event.projectId,
              email: rawSale.leadEmail
            }
          },
          create: {
            projectId: event.projectId,
            email: rawSale.leadEmail,
            name: rawSale.leadName ?? null,
            phone: rawSale.leadPhone ?? null,
            pipelineStage: this.determineStage(rawSale.status)
          },
          update: {
            name: rawSale.leadName ?? null,
            phone: rawSale.leadPhone ?? null,
            pipelineStage: this.determineStage(rawSale.status)
          }
        });

        await tx.sale.create({
          data: {
            projectId: event.projectId,
            leadId: lead.id,
            source: rawSale.source,
            externalOrderId: rawSale.externalOrderId,
            externalTxnId: rawSale.externalTxnId,
            productName: rawSale.productName,
            productId: rawSale.productId ?? null,
            status: rawSale.status,
            amount: rawSale.amount,
            currency: rawSale.currency,
            paymentMethod: rawSale.paymentMethod ?? null,
            installments: rawSale.installments
          }
        });
      });

      await this.prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: new Date() }
      });

      this.logger.log(`[OK] Evento ${eventId} procesado. Venta Normalizada.`);

    } catch (error) {
      const err = error as Error;
      if (err.message === 'DUPLICATE') {
        this.logger.warn(`[DUPLICADO] Evento ${eventId} descartado.`);
        await this.prisma.integrationEvent.update({
          where: { id: eventId },
          data: { status: 'DUPLICATE', processedAt: new Date() }
        });
      } else {
        this.logger.error(`[ERROR] Evento ${eventId}`, err);
        await this.prisma.integrationEvent.update({
          where: { id: eventId },
          data: { status: 'FAILED', errorReason: err.message, processedAt: new Date() }
        });
      }
    }
  }

  private determineStage(status: string): string {
    switch (status) {
      case 'APPROVED': return 'WON';
      case 'CANCELED': 
      case 'BILLET_PRINTED': return 'RECOVERABLE';
      case 'REFUNDED': 
      case 'CHARGEBACK': return 'LOST';
      default: return 'NEW';
    }
  }

  async listSales(projectId: string) {
    try {
      if (!this.prisma || !(this.prisma as any).sale) {
        this.logger.warn(`Prisma model 'sale' no está disponible aún.`);
        return [];
      }

      const sales = await this.prisma.sale.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: { name: true, email: true, closerId: true }
          }
        }
      });
      
      return sales.map(s => ({
        id: s.id,
        source: s.source,
        externalOrderId: s.externalOrderId,
        productName: s.productName,
        productId: s.productId,
        status: s.status,
        amount: Number(s.amount),
        currency: s.currency,
        createdAt: s.createdAt.toISOString(),
        lead: {
          name: s.lead?.name || 'Sin Nombre',
          email: s.lead?.email || 'Sin Correo',
          closerId: s.lead?.closerId || null
        }
      }));
    } catch (err) {
      this.logger.error(`Error loading sales for project ${projectId}`, err);
      // Fallback para evitar error 500 en frontend si la tabla no existe o projectId es inválido
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
          ...(dto.date ? { createdAt: new Date(dto.date) } : {})
        }
      });

      return { saleId: sale.id, leadId: lead.id };
    });
  }
}

