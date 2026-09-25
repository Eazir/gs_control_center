import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [AuthModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
