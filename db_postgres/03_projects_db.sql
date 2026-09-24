-- ============================================================================
-- 03 — PROJECTS SERVICE (projects_db)
-- Ejecutar: psql -h localhost -U postgres -d projects_db -f 03_projects_db.sql
-- ============================================================================
SET search_path TO public;

CREATE TYPE project_status AS ENUM ('DRAFT','ACTIVE','PAUSED','ARCHIVED');
CREATE TYPE project_role   AS ENUM ('DIRECTOR','CLOSER','CLIENTE');

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              TEXT NOT NULL,
    slug              TEXT NOT NULL UNIQUE,
    description       TEXT,
    status            project_status DEFAULT 'DRAFT',
    director_id       UUID,
    products          JSONB NOT NULL DEFAULT '[]'::jsonb,
    goals_config      JSONB NOT NULL DEFAULT '{}'::jsonb,
    commission_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    automation_config JSONB DEFAULT '{}'::jsonb,
    settings          JSONB DEFAULT '{}'::jsonb,
    start_date        DATE,
    end_date          DATE,
    created_by        UUID,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX projects_idx_projects_status
    ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX projects_idx_projects_director
    ON projects(director_id) WHERE deleted_at IS NULL;
CREATE INDEX projects_idx_projects_products_gin
    ON projects USING GIN (products jsonb_path_ops);
CREATE INDEX projects_idx_projects_goals_config_gin
    ON projects USING GIN (goals_config jsonb_path_ops);
CREATE INDEX projects_idx_projects_commission_config_gin
    ON projects USING GIN (commission_config jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- project_users
-- ----------------------------------------------------------------------------
CREATE TABLE project_users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    role_in_project project_role NOT NULL,
    permissions     JSONB DEFAULT '{}'::jsonb,
    assigned_by     UUID,
    assigned_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

CREATE INDEX project_users_idx_project_users_user
    ON project_users(user_id);
CREATE INDEX project_users_idx_project_users_project_role
    ON project_users(project_id, role_in_project);

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
CREATE TABLE products (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_id       TEXT NOT NULL,
    offer_code        TEXT,
    name              TEXT NOT NULL,
    platform          TEXT,
    sck_team_config   JSONB DEFAULT '{}'::jsonb,
    price_pay_config  JSONB,
    commission_config JSONB DEFAULT '{}'::jsonb,
    is_launch_product BOOLEAN DEFAULT FALSE,
    account_id        TEXT,
    account_name      TEXT,
    account_type      TEXT CHECK (account_type IN ('OWN','EXTERNAL')),
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, external_id, platform)
);

CREATE INDEX products_idx_products_project
    ON products(project_id) WHERE is_active = TRUE;
CREATE INDEX products_idx_products_launch
    ON products(project_id) WHERE is_launch_product = TRUE;
CREATE INDEX products_idx_products_account
    ON products(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX products_idx_products_sck_team_gin
    ON products USING GIN (sck_team_config jsonb_path_ops);
CREATE INDEX products_idx_products_price_pay_gin
    ON products USING GIN (price_pay_config jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- goals
-- ----------------------------------------------------------------------------
CREATE TABLE goals (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id           UUID,
    product_id        TEXT,
    goal_type         TEXT NOT NULL
                      CHECK (goal_type IN ('SALES_COUNT','REVENUE','CONVERSION')),
    target_value      NUMERIC(14,2) NOT NULL,
    period            TEXT NOT NULL,
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    commission_config JSONB DEFAULT '{}'::jsonb,
    valid_products    JSONB DEFAULT '[]'::jsonb,
    is_active         BOOLEAN DEFAULT TRUE,
    created_by        UUID,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX goals_idx_goals_project_period
    ON goals(project_id, period_start, period_end) WHERE is_active = TRUE;
CREATE INDEX goals_idx_goals_user
    ON goals(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX goals_idx_goals_valid_products_gin
    ON goals USING GIN (valid_products jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- goal_progress
-- ----------------------------------------------------------------------------
CREATE TABLE goal_progress (
    id              BIGSERIAL PRIMARY KEY,
    goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL,
    user_id         UUID,
    product_id      TEXT,
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    current_value   NUMERIC(14,2) NOT NULL,
    target_value    NUMERIC(14,2) NOT NULL,
    percentage      NUMERIC(5,2) NOT NULL,
    breakdown       JSONB DEFAULT '{}'::jsonb,
    calculated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(goal_id, snapshot_date)
);

CREATE INDEX goal_progress_idx_goal_date
    ON goal_progress(goal_id, snapshot_date DESC);
CREATE INDEX goal_progress_idx_project_date
    ON goal_progress(project_id, snapshot_date DESC);

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_projects;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_projects;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_projects;