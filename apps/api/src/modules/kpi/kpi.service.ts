import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { CommissionGroup } from '@gs/contracts';

@Injectable()
export class KpiService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getProjectDashboardMetrics(projectId: string, periodDays: number | null) {
    let dateFilterSql = '';
    if (periodDays !== null) {
      dateFilterSql = `AND kpi_date >= CURRENT_DATE - INTERVAL '${periodDays} days'`;
    }

    const rawGlobal = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 
        SUM(facturacion_bruta) AS facturacion_bruta,
        SUM(facturacion_proxima) AS facturacion_proxima,
        SUM(ventas_totales) AS ventas_totales,
        SUM(marketing_ventas) AS marketing_ventas,
        SUM(comercial_ventas) AS comercial_ventas,
        SUM(hotmart_ventas) AS hotmart_ventas,
        SUM(externas_ventas) AS externas_ventas,
        SUM(sum_commission) AS sum_commission
      FROM sales.mv_project_daily_metrics
      WHERE project_id = $1::uuid ${dateFilterSql}
    `, projectId);

    const global = rawGlobal[0] || {};
    const facturacionBruta = Number(global.facturacion_bruta || 0);
    const facturacionProxima = Number(global.facturacion_proxima || 0);
    const ventasTotales = Number(global.ventas_totales || 0);
    const marketingVentas = Number(global.marketing_ventas || 0);
    const comercialVentas = Number(global.comercial_ventas || 0);
    const hotmartVentas = Number(global.hotmart_ventas || 0);
    const externasVentas = Number(global.externas_ventas || 0);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { commissionConfig: true, products: true }
    });

    const rawProducts = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 
        product_name,
        SUM(count_sales) as ventas,
        SUM(sum_gross) as facturacion
      FROM sales.mv_product_daily_kpis
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY product_name
      ORDER BY facturacion DESC
    `, projectId);

    // Calc precise net and team revenue based on products and commission groups
    let facturacionNeta = 0;
    let facturacionEquipo = 0;
    let defaultExternal = 5;
    let defaultTeam = 13;

    let groups: CommissionGroup[] = [];
    if (project?.commissionConfig && typeof project.commissionConfig === 'object') {
      const cc = project.commissionConfig as Record<string, unknown>;
      defaultExternal = (cc.defaultExternalPercentage as number) ?? 5;
      defaultTeam = ((cc.defaultCloserPercentage as number) ?? 10) + ((cc.defaultDirectorPercentage as number) ?? 3);
      if (Array.isArray(cc.groups)) {
        groups = cc.groups as CommissionGroup[];
      }
    }

    // Resolve product IDs to names from project.products JSON
    const projectProductsArray = Array.isArray(project?.products) ? project.products : [];
    const idToName = new Map(
      projectProductsArray
        .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
        .map(p => [p.id as string, p.name as string])
    );

    rawProducts.forEach(row => {
      const name = row.product_name as string;
      const amount = Number(row.facturacion || 0);

      // Find if this product belongs to a group
      const matchingGroup = groups.find(g => 
        g.productIds.some(pid => idToName.get(pid) === name)
      );

      let externalPct = defaultExternal;
      let teamPct = defaultTeam;

      if (matchingGroup?.basePercentages) {
        externalPct = matchingGroup.basePercentages.external ?? 0;
        teamPct = matchingGroup.basePercentages.teamTotal ?? 0;
      }

      facturacionNeta += amount * ((100 - externalPct) / 100);
      facturacionEquipo += amount * (teamPct / 100);
    });

    if (rawProducts.length === 0) {
      // Fallback si no hay desglose de productos pero sí facturación bruta global
      facturacionNeta = facturacionBruta * ((100 - defaultExternal) / 100);
      facturacionEquipo = facturacionBruta * (defaultTeam / 100);
    }

    const rawChart = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 
        TO_CHAR(kpi_date, 'YYYY-MM-DD') as date,
        SUM(ventas_totales) as ventas,
        SUM(facturacion_bruta) as facturacion
      FROM sales.mv_project_daily_metrics
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY kpi_date
      ORDER BY kpi_date ASC
    `, projectId);
    
    const salesVolumeChart = rawChart.map(row => ({
      date: row.date as string,
      ventas: Number(row.ventas || 0),
      facturacion: Number(row.facturacion || 0)
    }));

    const rawClosers = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 
        closer_id,
        SUM(count_sales) as ventas,
        SUM(sum_gross) as facturacion
      FROM sales.mv_closer_daily_kpis
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY closer_id
      ORDER BY facturacion DESC
      LIMIT 10
    `, projectId);

    const closerIds = rawClosers.map(r => r.closer_id as string).filter(Boolean);
    const users = closerIds.length > 0 
      ? await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT id, full_name, email FROM auth.users WHERE id = ANY($1::uuid[])`, closerIds)
      : [];
    const userMap = new Map(users.map(u => [u.id as string, (u.full_name as string) || (u.email as string) || (u.id as string).slice(0, 8)]));

    const closersRanking = rawClosers.map(row => {
      const id = row.closer_id as string;
      return {
        id,
        closer: userMap.get(id) || id.slice(0, 8),
        ventas: Number(row.ventas || 0),
        facturacion: Number(row.facturacion || 0),
        conversion: 0 
      };
    });

    const launchMetrics = {
      totalFacturado: facturacionBruta,
      totalVentas: ventasTotales,
      productos: rawProducts.map(row => ({
        producto: row.product_name as string,
        ventas: Number(row.ventas || 0),
        facturacion: Number(row.facturacion || 0)
      }))
    };

    return {
      kpis: {
        facturacionBruta,
        facturacionProxima,
        facturacionNeta,
        facturacionEquipo,
        ventasTotales,
      },
      salesVolumeChart,
      closersRanking,
      launchMetrics,
      comparatives: {
        sources: [
          { name: 'Hotmart', value: hotmartVentas },
          { name: 'Cuentas Externas', value: externasVentas }
        ],
        teams: [
          { name: 'Marketing', ventas: marketingVentas },
          { name: 'Comercial', ventas: comercialVentas }
        ]
      }
    };
  }
}
