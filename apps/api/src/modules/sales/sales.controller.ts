import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, BadRequestException, Inject, ForbiddenException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth';
import { JwtPayload, ManualSaleSchema, CsvSaleImportSchema, CsvLeadImportSchema, UpdateLeadDto, UpdateTransactionStatusDto } from '@gs/contracts';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    @Inject(SalesService)
    private readonly salesService: SalesService
  ) {}

  @Get('project/:projectId')
  async listProjectSales(
    @Param('projectId') projectId: string,
    @Request() req: { user: JwtPayload }
  ) {
    if (!this.salesService) {
      return [];
    }
    return this.salesService.listSales(projectId, { id: req.user.sub, role: req.user.role });
  }

  @Get('project/:projectId/transactions')
  async listProjectTransactions(
    @Param('projectId') projectId: string,
    @Request() req: { user: JwtPayload }
  ) {
    if (req.user.role === 'CLOSER') {
      throw new ForbiddenException('Los closers no tienen acceso al historial de transacciones global.');
    }
    if (!this.salesService) {
      return [];
    }
    return this.salesService.listTransactions(projectId);
  }

  @Get('project/:projectId/leads')
  async listProjectLeads(
    @Param('projectId') projectId: string,
    @Query('search') search: string | undefined,
    @Request() req: { user: JwtPayload }
  ) {
    if (!this.salesService) return [];
    return this.salesService.listLeads(projectId, { id: req.user.sub, role: req.user.role }, search);
  }

  @Post('project/:projectId/leads/import-csv')
  async importLeadsCsv(
    @Param('projectId') projectId: string,
    @Body() payload: unknown[],
    @Request() req: { user: JwtPayload }
  ) {
    // Ingesta masiva es gerencial. Un CLOSER solo administra los leads que ya tiene
    // asignados: la matriz CASL no le concede `create Lead`, así que aquí se cierra igual.
    if (req.user.role === 'CLOSER') {
      throw new ForbiddenException('Los closers no pueden importar leads de forma masiva.');
    }
    if (!Array.isArray(payload)) {
      throw new BadRequestException('El payload debe ser un array de leads');
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ item: unknown; error: unknown }>,
    };
    
    for (const item of payload) {
      const parsed = CsvLeadImportSchema.safeParse(item);
      if (parsed.success) {
        try {
          await this.salesService.importLeadCsv(projectId, parsed.data, req.user.sub);
          results.successful++;
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
          console.error(`[importLeadsCsv] Error insertando lead:`, errorMessage, 'Payload:', parsed.data);
          results.failed++;
          results.errors.push({ item, error: errorMessage });
        }
      } else {
        console.error(`[importLeadsCsv] Error de validación Zod:`, parsed.error.errors, 'Item:', item);
        results.failed++;
        results.errors.push({ item, error: parsed.error.errors });
      }
    }
    
    return results;
  }

  @Post('project/:projectId/leads/:leadId/stage')
  async updateLeadStage(
    @Param('projectId') projectId: string,
    @Param('leadId') leadId: string,
    @Body('stageId') stageId: string,
    @Request() req: { user: JwtPayload }
  ) {
    if (!stageId) {
      throw new BadRequestException('El stageId es obligatorio');
    }
    return this.salesService.updateLeadStage(projectId, leadId, stageId, { id: req.user.sub, role: req.user.role });
  }

  @Post('project/:projectId/leads')
  async createLead(
    @Param('projectId') projectId: string,
    @Body() payload: { name: string; email: string; phone?: string; stageId: string; closerId?: string; productId?: string },
    @Request() req: { user: JwtPayload }
  ) {
    return this.salesService.createManualLead(projectId, payload, { id: req.user.sub, role: req.user.role });
  }

  @Post('project/:projectId/leads/:leadId')
  async updateLead(
    @Param('projectId') projectId: string,
    @Param('leadId') leadId: string,
    @Body() data: UpdateLeadDto,
    @Request() req: { user: JwtPayload }
  ) {
    return this.salesService.updateLead(projectId, leadId, data, { id: req.user.sub, role: req.user.role });
  }

  @Post('project/:projectId/transactions/:txnId')
  async updateTransactionStatus(
    @Param('projectId') projectId: string,
    @Param('txnId') txnId: string,
    @Body() data: UpdateTransactionStatusDto,
    @Request() req: { user: JwtPayload }
  ) {
    return this.salesService.updateTransactionStatus(projectId, txnId, data, { id: req.user.sub, role: req.user.role });
  }

  @Get('project/:projectId/products/:productId/sales-count')
  async getProductSalesCount(
    @Param('projectId') projectId: string,
    @Param('productId') productId: string
  ) {
    const count = await this.salesService.countSalesForProduct(projectId, productId);
    return { count, hasSales: count > 0 };
  }

  @Post('project/:projectId/manual')
  async registerManualSale(
    @Param('projectId') projectId: string,
    @Body() payload: unknown,
    @Request() req: { user: JwtPayload }
  ) {
    const result = ManualSaleSchema.safeParse(payload);
    if (!result.success) {
      throw new BadRequestException(result.error.errors);
    }
    
    return this.salesService.registerManualSale(projectId, result.data, req.user.sub);
  }

  @Post('project/:projectId/import-csv')
  async importSalesCsv(
    @Param('projectId') projectId: string,
    @Body() payload: unknown[],
    @Request() req: { user: JwtPayload }
  ) {
    // Igual que la importación de leads: cargar transacciones es tarea gerencial.
    // Cerrarlo aquí evita que un CLOSER registre ventas ajenas o altere comisiones.
    if (req.user.role === 'CLOSER') {
      throw new ForbiddenException('Los closers no pueden importar transacciones de forma masiva.');
    }
    if (!Array.isArray(payload)) {
      throw new BadRequestException('El payload debe ser un array de ventas');
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ item: unknown; error: unknown }>,
    };
    
    for (const item of payload) {
      // Usar schema de importación CSV
      const parsed = CsvSaleImportSchema.safeParse(item);
      if (parsed.success) {
        try {
          await this.salesService.importSaleCsv(projectId, parsed.data, req.user.sub);
          results.successful++;
        } catch (e: unknown) {
          results.failed++;
          results.errors.push({
            item,
            error: e instanceof Error ? e.message : 'Error desconocido',
          });
        }
      } else {
        results.failed++;
        results.errors.push({ item, error: parsed.error.errors });
      }
    }
    
    return results;
  }

  // Import leads movido arriba para evitar colisión con :leadId
}

