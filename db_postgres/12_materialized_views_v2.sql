-- ============================================================================
-- 12 — VISTAS MATERIALIZADAS V2 (Dashboard Metrics)
-- Este script crea las vistas materializadas necesarias para el Dashboard de KPIs,
-- adaptado a la estructura Multi-Schema de Prisma (esquema 'sales').
-- Ejecutar:
--   psql -h localhost -U postgres -d gs_control_center -f 12_materialized_views_v2.sql
-- ============================================================================

-- 1. Vista global para KPIs del Dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_project_daily_metrics AS
SELECT 
    project_id,
    DATE(created_at) AS kpi_date,
    
    -- facturacionBruta
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS facturacion_bruta,
    
    -- facturacionProxima (cuotas restantes)
    SUM(amount * (installments - 1)) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND installments > 1) AS facturacion_proxima,
    
    -- ventasTotales
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS ventas_totales,
    
    -- marketing vs comercial
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND closer_id IS NULL) AS marketing_ventas,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND closer_id IS NOT NULL) AS comercial_ventas,
    
    -- hotmart vs externas
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND source = 'HOTMART') AS hotmart_ventas,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND source != 'HOTMART') AS externas_ventas,

    -- comisiones sumadas
    SUM(commission_amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS sum_commission

FROM sales.sales
GROUP BY project_id, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_daily_metrics_unique 
ON sales.mv_project_daily_metrics(project_id, kpi_date);

CREATE INDEX IF NOT EXISTS idx_mv_project_daily_metrics_date 
ON sales.mv_project_daily_metrics(kpi_date DESC);

-- 2. Vista de KPIs por Closer
CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_closer_daily_kpis AS
SELECT
    project_id,
    closer_id,
    DATE(created_at) AS kpi_date,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS count_sales,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS sum_gross
FROM sales.sales
WHERE closer_id IS NOT NULL
GROUP BY project_id, closer_id, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_closer_kpis_u 
ON sales.mv_closer_daily_kpis(project_id, closer_id, kpi_date);

-- 3. Vista de KPIs por Producto
CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_product_daily_kpis AS
SELECT
    project_id,
    product_name,
    DATE(created_at) AS kpi_date,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS count_sales,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS sum_gross
FROM sales.sales
WHERE product_name IS NOT NULL
GROUP BY project_id, product_name, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_kpis_u 
ON sales.mv_product_daily_kpis(project_id, product_name, kpi_date);
