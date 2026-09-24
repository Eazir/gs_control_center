-- ============================================================================
-- 01 — EXTENSIONES
-- Ejecutar en CADA base de datos (una por una):
--   psql -h localhost -U postgres -d <db> -f 01_extensions.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- pg_cron solo en sales_db y pipeline_db (para refrescar MVs).
-- Si tu PostgreSQL no tiene pg_cron, comenta las siguientes líneas.
DO $$
BEGIN
    IF current_database() IN ('sales_db', 'pipeline_db') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS "pg_cron";
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron no disponible en %. Se omite.', current_database();
        END;
    END IF;
END
$$;