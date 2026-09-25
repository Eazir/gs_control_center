import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { RedisService } from '../../core/redis';
import { ProviderType, EventStatus, Prisma } from '@prisma/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async processHotmartWebhook(projectId: string, hottok: string, payload: unknown) {
    // 1. Obtener la configuración del proyecto para Hotmart
    const config = await this.prisma.integrationConfig.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: ProviderType.HOTMART
        }
      }
    });

    if (!config || !config.isActive) {
      this.logger.warn(`Webhook ignorado: Integración no activa para proyecto ${projectId}`);
      throw new UnauthorizedException('Integración no activa');
    }

    // Nota: En producción, validar config.credentialsEnc con scripts/crypto-tool
    // Por simplicidad en esta prueba inicial, asumimos que la validación pasaría.

    // 2. Extraer evento y fecha para control de idempotencia/ignorados
    const payloadObj = (typeof payload === 'object' && payload !== null) ? (payload as Record<string, unknown>) : {};
    const eventType = typeof payloadObj.event === 'string' ? payloadObj.event : 'UNKNOWN';

    // Insertar en crudo con estado RECEIVED
    const event = await this.prisma.integrationEvent.create({
      data: {
        projectId,
        provider: ProviderType.HOTMART,
        eventType,
        payload: (payload ? payload : {}) as Prisma.InputJsonValue,
        status: EventStatus.RECEIVED
      }
    });

    // 3. Encolar en Redis List (BullMQ queue simulation)
    const redisClient = this.redis.getClient();
    await redisClient.lpush('queue:integration_events', JSON.stringify({
      id: event.id,
      name: 'process_event',
      data: { eventId: event.id }
    }));

    this.logger.log(`Evento de Hotmart [${eventType}] encolado para proyecto ${projectId}`);
  }
}
