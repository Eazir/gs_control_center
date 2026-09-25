import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { DatabaseModule } from '../../core/database';
import { RedisModule } from '../../core/redis';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
