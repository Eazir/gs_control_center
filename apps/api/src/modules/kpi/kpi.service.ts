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

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DashboardDateFilters {
  day?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

type DashboardOptions = {
  hideOperational?: boolean | undefined;
  filters?: DashboardDateFilters | undefined;
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
    role?: UserRole,
    filters?: DashboardDateFilters
  ) {
    const periodDays = parseDashboardPeriod(period);
    const hideOperational = role === 'CLIENTE';
    return this.buildDashboard(projectId, periodDays, { hideOperational, filters });
  }

  /**
   * Construye el fragmento SQL y parámetros para el filtro temporal del dashboard.
   * Prioridad:
   * 1. day: AND column = $n::date
   * 2. from + to: AND column BETWEEN $n::date AND $m::date
   * 3. from solo: AND column >= $n::date
   * 4. to solo: AND column <= $n::date
   * 5. periodDays: AND column >= CURRENT_DATE - CAST($n AS INTEGER)
   * 6. sin filtro: ''
   */
  private buildDateFilterSql(
    column: 'kpi_date' | 'created_at::date',
    periodDays: number | null,
    filters: DashboardDateFilters | undefined,
    startParam: number
  ): { sql: string; params: Array<string | number> } {
    const validDay = filters?.day && DATE_REGEX.test(filters.day) ? filters.day : undefined;
    const validFrom = filters?.from && DATE_REGEX.test(filters.from) ? filters.from : undefined;
    const validTo = filters?.to && DATE_REGEX.test(filters.to) ? filters.to : undefined;

    if (validDay) {
      return {
        sql: `AND ${column} = $${startParam}::date`,
        params: [validDay],
      };
    }

    if (validFrom && validTo) {
      return {
        sql: `AND ${column} BETWEEN $${startParam}::date AND $${startParam + 1}::date`,
        params: [validFrom, validTo],
      };
    }

    if (validFrom) {
      return {
        sql: `AND ${column} >= $${startParam}::date`,
        params: [validFrom],
      };
    }

    if (validTo) {
      return {
        sql: `AND ${column} <= $${startParam}::date`,
        params: [validTo],
      };
    }

    if (periodDays !== null) {
      return {
        sql: `AND ${column} >= CURRENT_DATE - CAST($${startParam} AS INTEGER)`,
        params: [periodDays],
      };
    }

    return {
      sql: '',
      params: [],
    };
  }

  private async buildDashboard(
    projectId: string,
    periodDays: number | null,
    options: DashboardOptions
  ) {
    const mvFilter = this.buildDateFilterSql('kpi_date', periodDays, options.filters, 2);
    const mvParams: Array<string | number> = [projectId, ...mvFilter.params];

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
      WHERE project_id = $1::uuid ${mvFilter.sql}
    `,
      ...mvParams
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
      WHERE project_id = $1::uuid ${mvFilter.sql}
      GROUP BY product_name, product_id
      ORDER BY facturacion DESC
    `,
      ...mvParams
    );

    const productRows: ProductKpiRow[] = rawProducts.map((row) => ({
      productName: String(row.product_name ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      ventas: Number(row.ventas || 0),
      facturacion: Number(row.facturacion || 0),
    }));

    // Bruto/Detalle del equipo comercial = SOLO ventas con closer_id (NO marketing).
    // Usamos sales.sales directamente y replicamos el FILTER de aprobado de las MVs
    // para ser consistentes con la regla reciente de normalización de estados.
    const commercialFilter = this.buildDateFilterSql('created_at::date', periodDays, options.filters, 2);
    const commercialParams: Array<string | number> = [projectId, ...commercialFilter.params];

    const rawCommercialProducts = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      SELECT
        product_name,
        product_id,
        COUNT(*) AS ventas,
        SUM(amount) AS facturacion
      FROM sales.sales
      WHERE project_id = $1::uuid
        AND closer_id IS NOT NULL
        AND status IN ('APPROVED','PURCHASE_APPROVED','COMPLETE','PURCHASE_COMPLETE','APROBADO','COMPLETA','COMPLETO')
        ${commercialFilter.sql}
      GROUP BY product_name, product_id
      ORDER BY facturacion DESC
    `,
      ...commercialParams
    );

    const commercialProductRows: ProductKpiRow[] = rawCommercialProducts.map((row) => ({
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
      // facturacionEquipo NO se suma desde productRows: el equipo comercial
      // solo corresponde a split.team de las ventas con closer asignado.
    }

    // Equipo comercial = split.team de comerciales (ventas con closer asignado)
    facturacionEquipo = 0;
    for (const row of commercialProductRows) {
      const matchingGroup = findGroupForProduct(groups, row, idToName);
      if (!matchingGroup) {
        facturacionEquipo += row.facturacion;
        continue;
      }
      const split = splitProductRevenue(row.facturacion, matchingGroup, 0, 0);
      facturacionEquipo += split.team;
    }

    if (productRows.length === 0) {
      facturacionNeta = facturacionBruta;
      facturacionEquipo = 0;
    } else if (commercialProductRows.length === 0) {
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
      WHERE project_id = $1::uuid ${mvFilter.sql}
      GROUP BY kpi_date
      ORDER BY kpi_date ASC
    `,
      ...mvParams
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
      WHERE project_id = $1::uuid ${mvFilter.sql}
      GROUP BY closer_id
      ORDER BY facturacion DESC
    `,
          ...mvParams
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
