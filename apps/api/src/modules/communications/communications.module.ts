import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsWorker } from './communications.worker';
import { RedisModule } from '../../core/redis';

@Module({
  imports: [RedisModule],
  providers: [CommunicationsService, CommunicationsWorker],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
