import { Module } from '@nestjs/common';
import { SuperAdminService } from './application/super-admin.service';
import { SuperAdminController } from './api/super-admin.controller';
import { AuthModule } from '../auth';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
