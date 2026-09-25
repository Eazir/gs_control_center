import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, Inject } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth';
import { ManualSaleSchema } from '@gs/contracts';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    @Inject(SalesService)
    private readonly salesService: SalesService
  ) {}

  @Get('project/:projectId')
  async listProjectSales(@Param('projectId') projectId: string) {
    if (!this.salesService) {
      return [];
    }
    return this.salesService.listSales(projectId);
  }

  @Post('project/:projectId/manual')
  async registerManualSale(
    @Param('projectId') projectId: string,
    @Body() payload: unknown,
    @Request() req: { user: { id: string } }
  ) {
    const result = ManualSaleSchema.safeParse(payload);
    if (!result.success) {
      throw new BadRequestException(result.error.errors);
    }
    
    return this.salesService.registerManualSale(projectId, result.data, req.user.id);
  }

  @Post('project/:projectId/import')
  async importSales(
    @Param('projectId') projectId: string,
    @Body() payload: unknown[],
    @Request() req: { user: { id: string } }
  ) {
    if (!Array.isArray(payload)) {
      throw new BadRequestException('El payload debe ser un array de ventas');
    }

    const results = { successful: 0, failed: 0, errors: [] as any[] };
    
    for (const item of payload) {
      const parsed = ManualSaleSchema.safeParse(item);
      if (parsed.success) {
        try {
          await this.salesService.registerManualSale(projectId, parsed.data, req.user.id);
          results.successful++;
        } catch (e: any) {
          results.failed++;
          results.errors.push({ item, error: e.message });
        }
      } else {
        results.failed++;
        results.errors.push({ item, error: parsed.error.errors });
      }
    }
    
    return results;
  }
}

