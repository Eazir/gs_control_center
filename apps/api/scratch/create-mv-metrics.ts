import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Creating materialized view sales.mv_project_daily_metrics...");
    
    // Status valid for sales
    const validStatuses = "'APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo'";

    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_project_daily_metrics AS
      SELECT 
        project_id,
        DATE(created_at) AS kpi_date,
        
        -- facturacionBruta
        SUM(amount) FILTER (WHERE status IN (${validStatuses})) AS facturacion_bruta,
        
        -- facturacionProxima
        SUM(amount * (installments - 1)) FILTER (WHERE status IN (${validStatuses}) AND installments > 1) AS facturacion_proxima,
        
        -- ventasTotales
        COUNT(*) FILTER (WHERE status IN (${validStatuses})) AS ventas_totales,
        
        -- marketing vs comercial
        COUNT(*) FILTER (WHERE status IN (${validStatuses}) AND closer_id IS NULL) AS marketing_ventas,
        COUNT(*) FILTER (WHERE status IN (${validStatuses}) AND closer_id IS NOT NULL) AS comercial_ventas,
        
        -- hotmart vs externas
        COUNT(*) FILTER (WHERE status IN (${validStatuses}) AND external_txn_id LIKE 'HP%') AS hotmart_ventas,
        COUNT(*) FILTER (WHERE status IN (${validStatuses}) AND (external_txn_id NOT LIKE 'HP%' OR external_txn_id IS NULL)) AS externas_ventas

      FROM sales.sales
      GROUP BY project_id, DATE(created_at);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_daily_metrics_unique 
      ON sales.mv_project_daily_metrics(project_id, kpi_date);
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_mv_project_daily_metrics_date 
      ON sales.mv_project_daily_metrics(kpi_date DESC);
    `);

    console.log("Materialized view created.");

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
