-- ==============================================================================
-- Row Level Security (RLS) Policies — Red de seguridad a nivel de motor Postgres
-- Según AGENTS.md y prisma-postgres-rls:
-- Aplicado en conjunto con el helper transaccional withRls(prisma, ctx, fn)
-- ==============================================================================

-- 0. Rol de aplicación no-superusuario para ejecutar transacciones con RLS
DO $do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gs_app') THEN
    CREATE ROLE gs_app WITH NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT ALL ON SCHEMA auth, projects TO gs_app;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, projects TO gs_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth, projects TO gs_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth, projects GRANT ALL ON TABLES TO gs_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth, projects GRANT ALL ON SEQUENCES TO gs_app;
    GRANT gs_app TO gs_admin;
  END IF;
END
$do$;

-- Función helper SECURITY DEFINER para verificar directores sin causar recursión RLS
CREATE OR REPLACE FUNCTION projects.is_project_director(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM projects.project_users
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND role_in_project = 'DIRECTOR'
  );
$func$;

GRANT EXECUTE ON FUNCTION projects.is_project_director(uuid, uuid) TO gs_app;
GRANT EXECUTE ON FUNCTION projects.is_project_director(uuid, uuid) TO gs_admin;

-- 1. auth.users
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_isolation_policy ON auth.users;
CREATE POLICY users_isolation_policy ON auth.users
  FOR ALL
  USING (
    NULLIF(current_setting('app.current_user_role', true), '') IS NULL
    OR current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'ADMIN')
    OR id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

-- 2. auth.invitations
ALTER TABLE auth.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.invitations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_isolation_policy ON auth.invitations;
CREATE POLICY invitations_isolation_policy ON auth.invitations
  FOR ALL
  USING (
    NULLIF(current_setting('app.current_user_role', true), '') IS NULL
    OR current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'ADMIN')
    OR invited_by_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

-- 3. projects.projects
ALTER TABLE projects.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_isolation_policy ON projects.projects;
CREATE POLICY projects_isolation_policy ON projects.projects
  FOR ALL
  USING (
    NULLIF(current_setting('app.current_user_role', true), '') IS NULL
    OR current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'ADMIN')
    OR id IN (
      SELECT project_id FROM projects.project_users
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- 4. projects.project_users
ALTER TABLE projects.project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.project_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_users_isolation_policy ON projects.project_users;
CREATE POLICY project_users_isolation_policy ON projects.project_users
  FOR ALL
  USING (
    NULLIF(current_setting('app.current_user_role', true), '') IS NULL
    OR current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'ADMIN')
    OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR projects.is_project_director(project_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );