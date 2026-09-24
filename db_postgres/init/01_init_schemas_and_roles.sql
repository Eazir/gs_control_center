-- ============================================================================
-- 01 — INICIALIZACIÓN DE ESQUEMAS, ROLES Y PERMISOS (gs_control_center)
-- Implementa la arquitectura schema-per-module (AJUSTES_STACK.md y AGENTS.md):
-- Una sola base de datos, siete esquemas modulares y un rol por esquema.
-- ============================================================================

-- 1. Extensiones globales en gs_control_center
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Creación idempotente de roles de servicio
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

-- 3. Creación de los siete esquemas de dominio
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS projects;
CREATE SCHEMA IF NOT EXISTS pipeline;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS integrations;
CREATE SCHEMA IF NOT EXISTS automation;
CREATE SCHEMA IF NOT EXISTS ai;

-- 4. Aislar esquemas revocando permisos públicos por defecto
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA auth, projects, pipeline, sales, integrations, automation, ai FROM PUBLIC;

-- 5. Asignar permisos estrictos: cada rol SOLO accede a su propio esquema
-- auth
GRANT USAGE, CREATE ON SCHEMA auth TO svc_auth;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO svc_auth;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO svc_auth;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA auth TO svc_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO svc_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO svc_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON ROUTINES TO svc_auth;

-- projects
GRANT USAGE, CREATE ON SCHEMA projects TO svc_projects;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA projects TO svc_projects;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA projects TO svc_projects;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA projects TO svc_projects;
ALTER DEFAULT PRIVILEGES IN SCHEMA projects GRANT ALL ON TABLES TO svc_projects;
ALTER DEFAULT PRIVILEGES IN SCHEMA projects GRANT ALL ON SEQUENCES TO svc_projects;
ALTER DEFAULT PRIVILEGES IN SCHEMA projects GRANT ALL ON ROUTINES TO svc_projects;

-- pipeline
GRANT USAGE, CREATE ON SCHEMA pipeline TO svc_pipeline;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pipeline TO svc_pipeline;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pipeline TO svc_pipeline;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA pipeline TO svc_pipeline;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline GRANT ALL ON TABLES TO svc_pipeline;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline GRANT ALL ON SEQUENCES TO svc_pipeline;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline GRANT ALL ON ROUTINES TO svc_pipeline;

-- sales
GRANT USAGE, CREATE ON SCHEMA sales TO svc_sales;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA sales TO svc_sales;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sales TO svc_sales;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA sales TO svc_sales;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales GRANT ALL ON TABLES TO svc_sales;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales GRANT ALL ON SEQUENCES TO svc_sales;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales GRANT ALL ON ROUTINES TO svc_sales;

-- integrations
GRANT USAGE, CREATE ON SCHEMA integrations TO svc_integrations;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA integrations TO svc_integrations;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA integrations TO svc_integrations;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA integrations TO svc_integrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA integrations GRANT ALL ON TABLES TO svc_integrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA integrations GRANT ALL ON SEQUENCES TO svc_integrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA integrations GRANT ALL ON ROUTINES TO svc_integrations;

-- automation
GRANT USAGE, CREATE ON SCHEMA automation TO svc_automation;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA automation TO svc_automation;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA automation TO svc_automation;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA automation TO svc_automation;
ALTER DEFAULT PRIVILEGES IN SCHEMA automation GRANT ALL ON TABLES TO svc_automation;
ALTER DEFAULT PRIVILEGES IN SCHEMA automation GRANT ALL ON SEQUENCES TO svc_automation;
ALTER DEFAULT PRIVILEGES IN SCHEMA automation GRANT ALL ON ROUTINES TO svc_automation;

-- ai
GRANT USAGE, CREATE ON SCHEMA ai TO svc_ai;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ai TO svc_ai;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ai TO svc_ai;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA ai TO svc_ai;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT ALL ON TABLES TO svc_ai;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT ALL ON SEQUENCES TO svc_ai;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT ALL ON ROUTINES TO svc_ai;

-- 6. Rol administrador (gs_admin) mantiene acceso global sobre todos los esquemas
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gs_admin') THEN
        GRANT ALL ON SCHEMA auth, projects, pipeline, sales, integrations, automation, ai TO gs_admin;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, projects, pipeline, sales, integrations, automation, ai TO gs_admin;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth, projects, pipeline, sales, integrations, automation, ai TO gs_admin;
        GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA auth, projects, pipeline, sales, integrations, automation, ai TO gs_admin;
        ALTER DEFAULT PRIVILEGES IN SCHEMA auth, projects, pipeline, sales, integrations, automation, ai GRANT ALL ON TABLES TO gs_admin;
    END IF;
END
$$;
