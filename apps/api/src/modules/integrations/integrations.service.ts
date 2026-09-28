import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { RedisService } from '../../core/redis';
import { ProviderType, EventStatus, Prisma } from '@prisma/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  private prisma: PrismaService;
  private redis: RedisService;

  constructor(
    @Inject(PrismaService)
    prisma?: PrismaService,
    @Inject(RedisService)
    redis?: RedisService,
  ) {
    this.prisma = prisma ?? new PrismaService();
    this.redis = redis ?? new RedisService();
  }

  async processHotmartWebhook(projectId: string, hottok: string | undefined, payload: unknown) {
    // 1. Obtener o crear automáticamente la configuración del proyecto para Hotmart si es la primera prueba
    let config = await this.prisma.integrationConfig.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: ProviderType.HOTMART
        }
      }
    });

    if (!config) {
      this.logger.log(`Creando configuración inicial de Hotmart para proyecto ${projectId}`);
      config = await this.prisma.integrationConfig.create({
        data: {
          projectId,
          provider: ProviderType.HOTMART,
          isActive: true,
          credentialsEnc: hottok || 'hotmart_token',
          ignoreSubsequent: true,
        }
      });
    } else if (!config.isActive) {
      this.logger.warn(`Webhook ignorado: Integración no activa para proyecto ${projectId}`);
      return { received: true, ignored: true, reason: 'integration_inactive' };
    }

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

    // 3. Encolar en Redis List (BullMQ queue simulation) de forma tolerante a fallos locales
    try {
      const redisClient = this.redis.getClient();
      await redisClient.lpush('queue:integration_events', JSON.stringify({
        id: event.id,
        name: 'process_event',
        data: { eventId: event.id }
      }));
      this.logger.log(`Evento de Hotmart [${eventType}] encolado para proyecto ${projectId}`);
    } catch (redisErr) {
      this.logger.warn(`Redis no disponible para encolar inmediatamente, pero evento ${event.id} guardado en BD`, redisErr);
    }

    return { received: true, eventId: event.id };
  }

  async getConfig(projectId: string, provider: ProviderType = ProviderType.HOTMART) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider
        }
      }
    });
    return (
      config || {
        projectId,
        provider,
        isActive: true,
        credentialsEnc: '',
        validFrom: null,
        ignoreSubsequent: true
      }
    );
  }

  async saveConfig(
    projectId: string,
    data: {
      provider?: ProviderType;
      credentialsEnc?: string;
      validFrom?: string | null;
      ignoreSubsequent?: boolean;
      isActive?: boolean;
    }
  ) {
    const provider = data.provider || ProviderType.HOTMART;
    const updateData: Prisma.IntegrationConfigUncheckedUpdateInput = {};
    if (data.credentialsEnc !== undefined) {
      updateData.credentialsEnc = data.credentialsEnc || null;
    }
    if (data.validFrom !== undefined) {
      updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    }
    if (data.ignoreSubsequent !== undefined) {
      updateData.ignoreSubsequent = data.ignoreSubsequent;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return this.prisma.integrationConfig.upsert({
      where: {
        projectId_provider: {
          projectId,
          provider
        }
      },
      create: {
        projectId,
        provider,
        credentialsEnc: data.credentialsEnc || null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        ignoreSubsequent: data.ignoreSubsequent ?? true,
        isActive: data.isActive ?? true
      },
      update: updateData
    });
  }
}

