-- ============================================================================
-- 10 — ROW LEVEL SECURITY (opcional, fase 2)
-- Ejecutar en pipeline_db y sales_db.
-- Requiere que el back setee por conexión:
--   SET LOCAL app.current_user_id   = '<uuid>';
--   SET LOCAL app.current_user_role = 'CLOSER';
-- ============================================================================

DO $$
DECLARE
    v_db text := current_database();
BEGIN

    IF v_db = 'pipeline_db' THEN

        EXECUTE 'ALTER TABLE pipeline_rows ENABLE ROW LEVEL SECURITY';

        EXECUTE $pol$
            CREATE POLICY closer_sees_own_leads ON pipeline_rows
                FOR SELECT
                USING (
                    current_setting('app.current_user_role', true) = 'CLOSER'
                    AND closer_id = current_setting('app.current_user_id', true)::uuid
                )
        $pol$;

        EXECUTE $pol$
            CREATE POLICY director_sees_project_leads ON pipeline_rows
                FOR SELECT
                USING (
                    current_setting('app.current_user_role', true) = 'DIRECTOR'
                    AND project_id IN (
                        SELECT project_id FROM project_users
                        WHERE user_id = current_setting('app.current_user_id', true)::uuid
                          AND role_in_project = 'DIRECTOR'
                    )
                )
        $pol$;

        EXECUTE $pol$
            CREATE POLICY admin_sees_all_leads ON pipeline_rows
                FOR ALL
                USING (
                    current_setting('app.current_user_role', true) IN ('ADMIN','SUPER_ADMIN')
                )
        $pol$;

        RAISE NOTICE 'RLS aplicado en pipeline_db.';
    END IF;

    IF v_db = 'sales_db' THEN

        EXECUTE 'ALTER TABLE sales ENABLE ROW LEVEL SECURITY';

        EXECUTE $pol$
            CREATE POLICY closer_sees_own_sales ON sales
                FOR SELECT
                USING (
                    current_setting('app.current_user_role', true) = 'CLOSER'
                    AND closer_id = current_setting('app.current_user_id', true)::uuid
                )
        $pol$;

        EXECUTE $pol$
            CREATE POLICY admin_sees_all_sales ON sales
                FOR ALL
                USING (
                    current_setting('app.current_user_role', true) IN ('ADMIN','SUPER_ADMIN')
                )
        $pol$;

        RAISE NOTICE 'RLS aplicado en sales_db.';
    END IF;

END
$$;