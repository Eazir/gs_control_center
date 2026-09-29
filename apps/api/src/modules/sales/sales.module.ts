import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ProjectsModule } from '../projects';
import { IntegrationsModule } from '../integrations';
import { DatabaseModule } from '../../core/database';
import { RedisModule } from '../../core/redis';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [AuthModule, forwardRef(() => ProjectsModule), IntegrationsModule, DatabaseModule, RedisModule],
  controllers: [SalesController, PipelineController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
