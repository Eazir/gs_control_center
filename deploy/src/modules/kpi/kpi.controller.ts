import { Controller, Get, Param, Query, UseGuards, Request, Inject } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../auth';
import { JwtPayload } from '@gs/contracts';

@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(
    @Inject(KpiService)
    private readonly kpiService: KpiService
  ) {}

  @Get('project/:projectId/dashboard')
  async getDashboardMetrics(
    @Param('projectId') projectId: string,
    @Query('period') period?: string,
    @Request() req?: { user: JwtPayload }
  ) {
    return this.kpiService.getProjectDashboardMetrics(projectId, period, req?.user?.role);
  }
}
