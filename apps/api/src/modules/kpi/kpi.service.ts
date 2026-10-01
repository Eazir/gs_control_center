import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../core/database';

@Injectable()
export class KpiService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getProjectDashboardMetrics(projectId: string, periodDays: number | null) {
    let dateFilterSql = '';
    if (periodDays !== null) {
      // Usar kpi_date >= (CURRENT_DATE - periodDays) en Postgres
      dateFilterSql = `AND kpi_date >= CURRENT_DATE - INTERVAL '${periodDays} days'`;
    }

    // 1. Métricas Globales del Dashboard (sales.mv_project_daily_metrics)
    const rawGlobal = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 
        SUM(facturacion_bruta) AS facturacion_bruta,
        SUM(facturacion_proxima) AS facturacion_proxima,
        SUM(ventas_totales) AS ventas_totales,
        SUM(marketing_ventas) AS marketing_ventas,
        SUM(comercial_ventas) AS comercial_ventas,
        SUM(hotmart_ventas) AS hotmart_ventas,
        SUM(externas_ventas) AS externas_ventas
      FROM sales.mv_project_daily_metrics
      WHERE project_id = $1::uuid ${dateFilterSql}
    `, projectId);

    const global = rawGlobal[0] || {};
    const facturacionBruta = Number(global.facturacion_bruta || 0);
    const facturacionProxima = Number(global.facturacion_proxima || 0);
    const ventasTotales = Number(global.ventas_totales || 0);
    const facturacionNeta = facturacionBruta * 0.90; // Asumiendo 10% costos fijos

    const marketingVentas = Number(global.marketing_ventas || 0);
    const comercialVentas = Number(global.comercial_ventas || 0);
    const hotmartVentas = Number(global.hotmart_ventas || 0);
    const externasVentas = Number(global.externas_ventas || 0);

    const rawChart = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 
        TO_CHAR(kpi_date, 'YYYY-MM-DD') as date,
        SUM(ventas_totales) as ventas
      FROM sales.mv_project_daily_metrics
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY kpi_date
      ORDER BY kpi_date ASC
    `, projectId);
    
    const salesVolumeChart = rawChart.map(row => ({
      date: row.date as string,
      ventas: Number(row.ventas || 0)
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

    const closersRanking = rawClosers.map(row => ({
      id: row.closer_id as string,
      closer: (row.closer_id as string).slice(0, 8), // Placeholder hasta hacer JOIN con usuarios
      ventas: Number(row.ventas || 0),
      facturacion: Number(row.facturacion || 0),
      conversion: 0 
    }));

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
