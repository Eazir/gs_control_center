-- ============================================================================
-- 12 — VISTAS MATERIALIZADAS V2 (Dashboard Metrics)
-- Este script crea las vistas materializadas necesarias para el Dashboard de KPIs,
-- adaptado a la estructura Multi-Schema de Prisma (esquema 'sales').
-- Ejecutar:
--   psql -h localhost -U postgres -d gs_control_center -f 12_materialized_views_v2.sql
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_project_daily_metrics AS
SELECT
    project_id,
    DATE(created_at) AS kpi_date,

    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS facturacion_bruta,
    SUM(amount * (installments - 1)) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND installments > 1) AS facturacion_proxima,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS ventas_totales,

    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND closer_id IS NULL) AS marketing_ventas,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND closer_id IS NULL) AS marketing_facturacion,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND closer_id IS NOT NULL) AS comercial_ventas,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND closer_id IS NOT NULL) AS comercial_facturacion,

    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND UPPER(COALESCE(external_txn_id, '')) LIKE 'HP%') AS hotmart_ventas,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND UPPER(COALESCE(external_txn_id, '')) LIKE 'HP%') AS hotmart_facturacion,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND UPPER(COALESCE(external_txn_id, '')) NOT LIKE 'HP%') AS externas_ventas,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo') AND UPPER(COALESCE(external_txn_id, '')) NOT LIKE 'HP%') AS externas_facturacion,

    SUM(commission_amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS sum_commission
FROM sales.sales
GROUP BY project_id, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_daily_metrics_unique
ON sales.mv_project_daily_metrics(project_id, kpi_date);

CREATE INDEX IF NOT EXISTS idx_mv_project_daily_metrics_date
ON sales.mv_project_daily_metrics(kpi_date DESC);

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

CREATE MATERIALIZED VIEW IF NOT EXISTS sales.mv_product_daily_kpis AS
SELECT
    project_id,
    product_name,
    product_id,
    DATE(created_at) AS kpi_date,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS count_sales,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS sum_gross
FROM sales.sales
WHERE product_name IS NOT NULL
GROUP BY project_id, product_name, product_id, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_kpis_u
ON sales.mv_product_daily_kpis (
  project_id,
  (COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  product_name,
  kpi_date
);
