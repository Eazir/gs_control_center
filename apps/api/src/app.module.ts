import { Module } from '@nestjs/common';
import { DatabaseModule } from './core/database';
import { SecurityModule } from './core/security';
import { RedisModule } from './core/redis';
import { CaslModule } from './core/casl';
import { AuthModule } from './modules/auth';
import { ProjectsModule } from './modules/projects';
import { SalesModule } from './modules/sales';
import { IntegrationsModule } from './modules/integrations';
import { SuperAdminModule } from './modules/super-admin';

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    RedisModule,
    CaslModule,
    AuthModule,
    ProjectsModule,
    SalesModule,
    IntegrationsModule,
    SuperAdminModule,
  ],
})
export class AppModule {}

