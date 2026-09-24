-- ============================================================================
-- 09 — VISTAS MATERIALIZADAS
-- Se aplica el mismo archivo a sales_db y pipeline_db.
-- Detecta por current_database() qué MVs crear.
-- Ejecutar:
--   psql -h localhost -U postgres -d sales_db    -f 09_materialized_views.sql
--   psql -h localhost -U postgres -d pipeline_db -f 09_materialized_views.sql
-- ============================================================================

DO $$
DECLARE
    v_db text := current_database();
BEGIN

    -- ------------------------------------------------------------------------
    -- MVs de SALES
    -- ------------------------------------------------------------------------
    IF v_db = 'sales_db' THEN

        EXECUTE $mv$
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_kpis AS
            SELECT
                s.project_id,
                DATE(s.payment_date)                          AS kpi_date,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED') AS count_sales,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED'
                                   AND s.payment_type = 'ONE_TIME')    AS count_one_time,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED'
                                   AND s.payment_type = 'INSTALLMENT') AS count_installments,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED')                    AS sum_gross,
                SUM(s.amount - COALESCE(s.commission_amount, 0))
                    FILTER (WHERE s.status = 'APPROVED')                              AS sum_net,
                SUM(s.commission_amount) FILTER (WHERE s.status = 'APPROVED')         AS sum_commission,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED'
                                      AND s.payment_type = 'INSTALLMENT')             AS sum_installment_amount,
                AVG(s.amount) FILTER (WHERE s.status = 'APPROVED')                    AS avg_ticket,
                COUNT(*) FILTER (WHERE s.status = 'REFUNDED')                         AS count_refunds,
                SUM(s.amount) FILTER (WHERE s.status = 'REFUNDED')                    AS sum_refunded,
                MAX(s.updated_at)                             AS last_update
            FROM sales s
            WHERE s.payment_date IS NOT NULL
            GROUP BY s.project_id, DATE(s.payment_date)
        $mv$;

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_kpis
                 ON mv_daily_kpis(project_id, kpi_date)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_daily_kpis_date
                 ON mv_daily_kpis(kpi_date DESC)';

        EXECUTE $mv$
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_closer_daily_kpis AS
            SELECT
                s.project_id,
                s.closer_id,
                DATE(s.payment_date)                          AS kpi_date,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED') AS count_sales,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED')                    AS sum_gross,
                SUM(s.amount - COALESCE(s.commission_amount, 0))
                    FILTER (WHERE s.status = 'APPROVED')                              AS sum_net,
                SUM(s.commission_amount) FILTER (WHERE s.status = 'APPROVED')         AS sum_commission,
                AVG(s.amount) FILTER (WHERE s.status = 'APPROVED')                    AS avg_ticket
            FROM sales s
            WHERE s.payment_date IS NOT NULL
              AND s.closer_id IS NOT NULL
            GROUP BY s.project_id, s.closer_id, DATE(s.payment_date)
        $mv$;

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_closer_kpis
                 ON mv_closer_daily_kpis(project_id, closer_id, kpi_date)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_closer_kpis_date
                 ON mv_closer_daily_kpis(kpi_date DESC)';

        EXECUTE $mv$
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_daily_kpis AS
            SELECT
                s.project_id,
                s.product_id,
                s.product_name,
                DATE(s.payment_date)                          AS kpi_date,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED') AS count_sales,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED')                    AS sum_gross,
                SUM(s.amount - COALESCE(s.commission_amount, 0))
                    FILTER (WHERE s.status = 'APPROVED')                              AS sum_net,
                SUM(s.commission_amount) FILTER (WHERE s.status = 'APPROVED')         AS sum_commission,
                BOOL_OR(COALESCE((s.product_data->>'is_launch_product')::boolean, FALSE))
                    AS is_launch_product
            FROM sales s
            WHERE s.payment_date IS NOT NULL
              AND s.product_id IS NOT NULL
            GROUP BY s.project_id, s.product_id, s.product_name, DATE(s.payment_date)
        $mv$;

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_kpis
                 ON mv_product_daily_kpis(project_id, product_id, kpi_date)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_product_kpis_date
                 ON mv_product_daily_kpis(kpi_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_product_kpis_launch
                 ON mv_product_daily_kpis(project_id) WHERE is_launch_product = TRUE';

        EXECUTE $mv$
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_account_daily_kpis AS
            SELECT
                s.project_id,
                (s.product_data->>'account_id')               AS account_id,
                (s.product_data->>'account_name')             AS account_name,
                (s.product_data->>'account_type')             AS account_type,
                DATE(s.payment_date)                          AS kpi_date,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED') AS count_sales,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED')                    AS sum_gross,
                SUM(s.amount - COALESCE(s.commission_amount, 0))
                    FILTER (WHERE s.status = 'APPROVED')                              AS sum_net,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED'
                                      AND s.payment_type = 'INSTALLMENT')             AS sum_installments,
                SUM(s.amount) FILTER (WHERE s.status = 'APPROVED'
                                      AND s.payment_type = 'ONE_TIME')                AS sum_one_time
            FROM sales s
            WHERE s.payment_date IS NOT NULL
              AND s.product_data ? 'account_id'
            GROUP BY s.project_id,
                     (s.product_data->>'account_id'),
                     (s.product_data->>'account_name'),
                     (s.product_data->>'account_type'),
                     DATE(s.payment_date)
        $mv$;

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_account_kpis
                 ON mv_account_daily_kpis(project_id, account_id, kpi_date)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_account_kpis_date
                 ON mv_account_daily_kpis(kpi_date DESC)';

        -- Permisos
        EXECUTE 'GRANT SELECT ON mv_daily_kpis, mv_closer_daily_kpis,
                        mv_product_daily_kpis, mv_account_daily_kpis TO svc_sales';

        RAISE NOTICE 'MVs de sales_db creadas.';
    END IF;

    -- ------------------------------------------------------------------------
    -- MVs de PIPELINE
    -- ------------------------------------------------------------------------
    IF v_db = 'pipeline_db' THEN

        EXECUTE $mv$
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_closer_daily_leads AS
            SELECT
                project_id,
                closer_id,
                DATE(created_at) AS kpi_date,
                COUNT(*)         AS count_leads,
                COUNT(*) FILTER (WHERE current_stage = 'Cerrado') AS count_closed
            FROM pipeline_rows
            WHERE deleted_at IS NULL
              AND closer_id IS NOT NULL
            GROUP BY project_id, closer_id, DATE(created_at)
        $mv$;

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_closer_leads
                 ON mv_closer_daily_leads(project_id, closer_id, kpi_date)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_closer_leads_date
                 ON mv_closer_daily_leads(kpi_date DESC)';

        EXECUTE $mv$
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funnel AS
            SELECT
                project_id,
                current_stage,
                closer_id,
                COUNT(*)             AS lead_count,
                SUM(potential_value) AS potential_value,
                MAX(updated_at)      AS last_activity
            FROM pipeline_rows
            WHERE deleted_at IS NULL
            GROUP BY project_id, current_stage, closer_id
        $mv$;

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_funnel
                 ON mv_funnel(project_id, current_stage, closer_id)';

        EXECUTE 'GRANT SELECT ON mv_closer_daily_leads, mv_funnel TO svc_pipeline';

        RAISE NOTICE 'MVs de pipeline_db creadas.';
    END IF;

END
$$;