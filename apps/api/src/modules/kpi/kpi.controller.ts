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
    @Request() _req?: { user: JwtPayload }
  ) {
    let periodDays = null;
    if (period === '7d') periodDays = 7;
    else if (period === '15d') periodDays = 15;
    else if (period === '30d') periodDays = 30;

    return this.kpiService.getProjectDashboardMetrics(projectId, periodDays);
  }
}
