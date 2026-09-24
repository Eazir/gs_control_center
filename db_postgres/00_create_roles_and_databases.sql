-- ============================================================================
-- 00 — ROLES Y BASES DE DATOS
-- Ejecutar conectado a la DB "postgres" como superusuario:
--   psql -h localhost -U postgres -d postgres -f 00_create_roles_and_databases.sql
--
-- IMPORTANTE: CREATE DATABASE no puede correr dentro de una transacción.
-- Ejecutar con psql -f (que NO envuelve el script en BEGIN/COMMIT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROLES (idempotente)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_auth') THEN
        CREATE ROLE svc_auth WITH LOGIN PASSWORD 'auth_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_projects') THEN
        CREATE ROLE svc_projects WITH LOGIN PASSWORD 'projects_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_pipeline') THEN
        CREATE ROLE svc_pipeline WITH LOGIN PASSWORD 'pipeline_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_sales') THEN
        CREATE ROLE svc_sales WITH LOGIN PASSWORD 'sales_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_integrations') THEN
        CREATE ROLE svc_integrations WITH LOGIN PASSWORD 'integrations_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_automation') THEN
        CREATE ROLE svc_automation WITH LOGIN PASSWORD 'automation_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_ai') THEN
        CREATE ROLE svc_ai WITH LOGIN PASSWORD 'ai_tyr_051025';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svc_n8n') THEN
        CREATE ROLE svc_n8n WITH LOGIN PASSWORD 'n8n_tyr_051025';
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. BASES DE DATOS (idempotente con \gexec)
-- ----------------------------------------------------------------------------
SELECT 'CREATE DATABASE auth_db         OWNER svc_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db')\gexec

SELECT 'CREATE DATABASE projects_db     OWNER svc_projects'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'projects_db')\gexec

SELECT 'CREATE DATABASE pipeline_db     OWNER svc_pipeline'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pipeline_db')\gexec

SELECT 'CREATE DATABASE sales_db        OWNER svc_sales'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sales_db')\gexec

SELECT 'CREATE DATABASE integrations_db OWNER svc_integrations'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'integrations_db')\gexec

SELECT 'CREATE DATABASE automation_db   OWNER svc_automation'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'automation_db')\gexec

SELECT 'CREATE DATABASE ai_db           OWNER svc_ai'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_db')\gexec

SELECT 'CREATE DATABASE n8n_db          OWNER svc_n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n_db')\gexec

-- ----------------------------------------------------------------------------
-- 3. REVOCAR ACCESO PÚBLICO POR DEFECTO
-- ----------------------------------------------------------------------------
REVOKE ALL ON DATABASE auth_db, projects_db, pipeline_db, sales_db,
                       integrations_db, automation_db, ai_db, n8n_db
    FROM PUBLIC;

-- Cada rol dueño puede conectarse a su DB
GRANT CONNECT ON DATABASE auth_db         TO svc_auth;
GRANT CONNECT ON DATABASE projects_db     TO svc_projects;
GRANT CONNECT ON DATABASE pipeline_db     TO svc_pipeline;
GRANT CONNECT ON DATABASE sales_db        TO svc_sales;
GRANT CONNECT ON DATABASE integrations_db TO svc_integrations;
GRANT CONNECT ON DATABASE automation_db   TO svc_automation;
GRANT CONNECT ON DATABASE ai_db           TO svc_ai;
GRANT CONNECT ON DATABASE n8n_db          TO svc_n8n;

-- ----------------------------------------------------------------------------
-- 4. VERIFICACIÓN
-- ----------------------------------------------------------------------------
-- \du svc_*
-- \l