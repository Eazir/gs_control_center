import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { SalesService } from './sales.service';

@Module({
  imports: [AuthModule],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
