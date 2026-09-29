import { Controller, Post, Body, Param, UseGuards, Request, BadRequestException, Inject } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth';
import { JwtPayload, CsvLeadImportSchema } from '@gs/contracts';

@Controller('pipeline')
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(
    @Inject(SalesService)
    private readonly salesService: SalesService
  ) {}

  @Post('projects/:projectId/leads/import-csv')
  async importLeadsCsv(
    @Param('projectId') projectId: string,
    @Body() payload: unknown[],
    @Request() req: { user: JwtPayload }
  ) {
    if (!Array.isArray(payload)) {
      throw new BadRequestException('El payload debe ser un arreglo de leads');
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
          results.failed++;
          results.errors.push({
            item,
            error: e instanceof Error ? e.message : 'Error desconocido al procesar lead',
          });
        }
      } else {
        results.failed++;
        results.errors.push({ item, error: parsed.error.errors });
      }
    }

    return results;
  }
}
