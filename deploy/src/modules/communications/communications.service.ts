import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../core/redis';
import { SendEmailEvent } from '@gs/contracts/src/communications/email.schema';
import { randomUUID } from 'crypto';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);
  private readonly QUEUE_NAME = 'queue:emails';

  constructor(
    @Inject(RedisService)
    private readonly redis: RedisService
  ) {}

  /**
   * Encola un evento de envío de correo en Redis.
   */
  async enqueueEmail(event: SendEmailEvent): Promise<void> {
    const redisClient = this.redis.getClient();
    const jobId = randomUUID();
    
    try {
      await redisClient.lpush(this.QUEUE_NAME, JSON.stringify({
        id: jobId,
        type: 'SEND_EMAIL',
        data: event,
        timestamp: new Date().toISOString()
      }));
      this.logger.log(`Correo a ${event.to} encolado exitosamente con ID ${jobId}`);
    } catch (error) {
      this.logger.error(`Error al encolar correo a ${event.to}`, error);
      // Fallback síncrono o reintento en caso de fallo crítico en redis si fuera necesario
      throw error;
    }
  }
}
