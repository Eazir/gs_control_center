import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { CommissionGroup, UserRole } from '@gs/contracts';
import {
  buildGoalsProgress,
  findGroupForProduct,
  parseDashboardPeriod,
  splitProductRevenue,
  type ProductKpiRow,
} from './kpi-metrics.util';

type DashboardOptions = {
  hideOperational?: boolean;
};

@Injectable()
export class KpiService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * Agrega KPIs del dashboard desde las vistas materializadas del schema `sales`.
   * La neta es bruta menos el % externo del grupo de cada producto; la del equipo
   * comercial usa el % teamTotal. Las metas avanzan con la neta del grupo, no con la bruta.
   */
  async getProjectDashboardMetrics(
    projectId: string,
    period: string | undefined,
    role?: UserRole
  ) {
    const periodDays = parseDashboardPeriod(period);
    const hideOperational = role === 'CLIENTE';
    return this.buildDashboard(projectId, periodDays, { hideOperational });
  }

  private async buildDashboard(
    projectId: string,
    periodDays: number | null,
    options: DashboardOptions
  ) {
    const dateFilterSql =
      periodDays !== null ? `AND kpi_date >= CURRENT_DATE - CAST($2 AS INTEGER)` : '';
    const params: Array<string | number> =
      periodDays !== null ? [projectId, periodDays] : [projectId];

    const rawGlobal = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      SELECT
        SUM(facturacion_bruta) AS facturacion_bruta,
        SUM(facturacion_proxima) AS facturacion_proxima,
        SUM(ventas_totales) AS ventas_totales,
        SUM(marketing_ventas) AS marketing_ventas,
        SUM(marketing_facturacion) AS marketing_facturacion,
        SUM(comercial_ventas) AS comercial_ventas,
        SUM(comercial_facturacion) AS comercial_facturacion,
        SUM(hotmart_ventas) AS hotmart_ventas,
        SUM(hotmart_facturacion) AS hotmart_facturacion,
        SUM(externas_ventas) AS externas_ventas,
        SUM(externas_facturacion) AS externas_facturacion
      FROM sales.mv_project_daily_metrics
      WHERE project_id = $1::uuid ${dateFilterSql}
    `,
      ...params
    );

    const global = rawGlobal[0] || {};
    const facturacionBruta = Number(global.facturacion_bruta || 0);
    const facturacionProxima = Number(global.facturacion_proxima || 0);
    const ventasTotales = Number(global.ventas_totales || 0);
    const marketingVentas = Number(global.marketing_ventas || 0);
    const marketingFacturacion = Number(global.marketing_facturacion || 0);
    const comercialVentas = Number(global.comercial_ventas || 0);
    const comercialFacturacion = Number(global.comercial_facturacion || 0);
    const hotmartVentas = Number(global.hotmart_ventas || 0);
    const hotmartFacturacion = Number(global.hotmart_facturacion || 0);
    const externasVentas = Number(global.externas_ventas || 0);
    const externasFacturacion = Number(global.externas_facturacion || 0);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { commissionConfig: true, products: true },
    });

    const rawProducts = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      SELECT
        product_name,
        product_id,
        SUM(count_sales) as ventas,
        SUM(sum_gross) as facturacion
      FROM sales.mv_product_daily_kpis
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY product_name, product_id
      ORDER BY facturacion DESC
    `,
      ...params
    );

    const productRows: ProductKpiRow[] = rawProducts.map((row) => ({
      productName: String(row.product_name ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      ventas: Number(row.ventas || 0),
      facturacion: Number(row.facturacion || 0),
    }));

    let facturacionNeta = 0;
    let facturacionEquipo = 0;
    let groups: CommissionGroup[] = [];
    if (project?.commissionConfig && typeof project.commissionConfig === 'object') {
      const cc = project.commissionConfig as Record<string, unknown>;
      if (Array.isArray(cc.groups)) {
        groups = cc.groups as CommissionGroup[];
      }
    }

    const projectProductsArray = Array.isArray(project?.products) ? project.products : [];
    const idToName = new Map(
      projectProductsArray
        .filter((p): p is { id: string; name: string } =>
          p !== null &&
          typeof p === 'object' &&
          typeof (p as Record<string, unknown>).id === 'string' &&
          typeof (p as Record<string, unknown>).name === 'string'
        )
        .map((p) => [p.id, p.name])
    );

    for (const row of productRows) {
      const matchingGroup = findGroupForProduct(groups, row, idToName);
      if (!matchingGroup) {
        facturacionNeta += row.facturacion;
        continue;
      }
      const split = splitProductRevenue(row.facturacion, matchingGroup, 0, 0);
      facturacionNeta += split.net;
      facturacionEquipo += split.team;
    }

    if (productRows.length === 0) {
      facturacionNeta = facturacionBruta;
      facturacionEquipo = 0;
    }

    const goalsProgress = buildGoalsProgress(groups, productRows, idToName);

    const rawChart = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      SELECT
        TO_CHAR(kpi_date, 'YYYY-MM-DD') as date,
        SUM(ventas_totales) as ventas,
        SUM(facturacion_bruta) as facturacion
      FROM sales.mv_project_daily_metrics
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY kpi_date
      ORDER BY kpi_date ASC
    `,
      ...params
    );

    const salesVolumeChart = rawChart.map((row) => ({
      date: row.date as string,
      ventas: Number(row.ventas || 0),
      facturacion: Number(row.facturacion || 0),
    }));

    const rawClosers = options.hideOperational
      ? []
      : await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `
      SELECT
        closer_id,
        SUM(count_sales) as ventas,
        SUM(sum_gross) as facturacion
      FROM sales.mv_closer_daily_kpis
      WHERE project_id = $1::uuid ${dateFilterSql}
      GROUP BY closer_id
      ORDER BY facturacion DESC
    `,
          ...params
        );

    const closerIds = rawClosers.map((r) => r.closer_id as string).filter(Boolean);
    const users =
      closerIds.length > 0
        ? await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT id, full_name, email FROM auth.users WHERE id = ANY($1::uuid[])`,
            closerIds
          )
        : [];
    const userMap = new Map(
      users.map((u) => [
        u.id as string,
        (u.full_name as string) || (u.email as string) || (u.id as string).slice(0, 8),
      ])
    );

    const closerFacturacionTotal = rawClosers.reduce((acc, row) => acc + Number(row.facturacion || 0), 0);
    
    // Sort by facturacion desc
    rawClosers.sort((a, b) => Number(b.facturacion || 0) - Number(a.facturacion || 0));

    const closersRanking = rawClosers.map((row, index) => {
      const id = row.closer_id as string;
      const ventas = Number(row.ventas || 0);
      const facturacion = Number(row.facturacion || 0);
      return {
        rank: index + 1,
        id,
        closer: userMap.get(id) || id.slice(0, 8),
        ventas,
        facturacion,
        sharePct: closerFacturacionTotal > 0 ? (facturacion / closerFacturacionTotal) * 100 : 0,
      };
    });

    const launchMetrics = {
      totalFacturado: facturacionBruta,
      totalVentas: ventasTotales,
      productos: productRows.map((row) => ({
        producto: row.productName,
        productId: row.productId,
        ventas: row.ventas,
        facturacion: row.facturacion,
      })),
    };

    const kpis: Record<string, number> = {
      facturacionBruta,
      facturacionProxima,
      facturacionNeta,
      ventasTotales,
    };
    if (!options.hideOperational) {
      kpis.facturacionEquipo = facturacionEquipo;
    }

    return {
      calculatedAt: new Date().toISOString(),
      kpis,
      salesVolumeChart,
      closersRanking,
      goalsProgress,
      launchMetrics,
      comparatives: {
        sources: [
          { name: 'Hotmart', ventas: hotmartVentas, facturacion: hotmartFacturacion },
          { name: 'Cuentas Externas', ventas: externasVentas, facturacion: externasFacturacion },
        ],
        teams: [
          {
            name: 'Marketing',
            ventas: marketingVentas,
            facturacion: marketingFacturacion,
          },
          {
            name: 'Comercial',
            ventas: comercialVentas,
            facturacion: comercialFacturacion,
          },
        ],
      },
    };
  }
}
