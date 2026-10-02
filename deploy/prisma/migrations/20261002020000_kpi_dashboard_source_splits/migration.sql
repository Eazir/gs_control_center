-- Recrea las MVs del dashboard: Hotmart por código HP*, facturación (no solo conteo)
-- de marketing/comercial y de cuentas Hotmart vs externas.

DROP MATERIALIZED VIEW IF EXISTS sales.mv_project_daily_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sales.mv_closer_daily_kpis CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sales.mv_product_daily_kpis CASCADE;

CREATE MATERIALIZED VIEW sales.mv_project_daily_metrics AS
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

CREATE UNIQUE INDEX idx_mv_project_daily_metrics_unique
ON sales.mv_project_daily_metrics(project_id, kpi_date);

CREATE INDEX idx_mv_project_daily_metrics_date
ON sales.mv_project_daily_metrics(kpi_date DESC);

COMMENT ON MATERIALIZED VIEW sales.mv_project_daily_metrics IS
  'KPIs diarios por proyecto. Hotmart = código de transacción HP*; externas = ventas sin código Hotmart. Marketing = sin closer; comercial = con closer.';

COMMENT ON COLUMN sales.mv_project_daily_metrics.hotmart_facturacion IS
  'Suma de amount de ventas aprobadas cuyo external_txn_id empieza por HP (código Hotmart), no el source.';

COMMENT ON COLUMN sales.mv_project_daily_metrics.externas_facturacion IS
  'Suma de amount de ventas aprobadas sin código HP: altas manuales u otras fuentes sin intervención Hotmart.';

COMMENT ON COLUMN sales.mv_project_daily_metrics.marketing_facturacion IS
  'Suma de amount de ventas aprobadas sin closer_id.';

COMMENT ON COLUMN sales.mv_project_daily_metrics.comercial_facturacion IS
  'Suma de amount de ventas aprobadas con closer_id asignado.';

CREATE MATERIALIZED VIEW sales.mv_closer_daily_kpis AS
SELECT
    project_id,
    closer_id,
    DATE(created_at) AS kpi_date,
    COUNT(*) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS count_sales,
    SUM(amount) FILTER (WHERE status IN ('APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo')) AS sum_gross
FROM sales.sales
WHERE closer_id IS NOT NULL
GROUP BY project_id, closer_id, DATE(created_at);

CREATE UNIQUE INDEX idx_mv_closer_kpis_u
ON sales.mv_closer_daily_kpis(project_id, closer_id, kpi_date);

CREATE MATERIALIZED VIEW sales.mv_product_daily_kpis AS
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

CREATE UNIQUE INDEX idx_mv_product_kpis_u
ON sales.mv_product_daily_kpis (
  project_id,
  (COALESCE(product_id::text, '00000000-0000-0000-0000-000000000000')),
  product_name,
  kpi_date
);
