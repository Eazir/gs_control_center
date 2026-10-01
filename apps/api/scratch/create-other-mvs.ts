import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const validStatuses = "'APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo'";

    console.log("Creating mv_closer_daily_kpis...");
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_closer_daily_kpis AS
      SELECT
          project_id,
          closer_id,
          DATE(created_at) AS kpi_date,
          COUNT(*) FILTER (WHERE status IN (${validStatuses})) AS count_sales,
          SUM(amount) FILTER (WHERE status IN (${validStatuses})) AS sum_gross
      FROM sales.sales
      WHERE closer_id IS NOT NULL
      GROUP BY project_id, closer_id, DATE(created_at);
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_closer_kpis_u ON sales.mv_closer_daily_kpis(project_id, closer_id, kpi_date);`);

    console.log("Creating mv_product_daily_kpis...");
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_product_daily_kpis AS
      SELECT
          project_id,
          product_name,
          DATE(created_at) AS kpi_date,
          COUNT(*) FILTER (WHERE status IN (${validStatuses})) AS count_sales,
          SUM(amount) FILTER (WHERE status IN (${validStatuses})) AS sum_gross
      FROM sales.sales
      WHERE product_name IS NOT NULL
      GROUP BY project_id, product_name, DATE(created_at);
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_kpis_u ON sales.mv_product_daily_kpis(project_id, product_name, kpi_date);`);

    console.log("MVs created.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
