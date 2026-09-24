-- ============================================================================
-- 02 — AUTH SERVICE (auth_db)
-- Ejecutar: psql -h localhost -U postgres -d auth_db -f 02_auth_db.sql
-- ============================================================================
SET search_path TO public;

CREATE TYPE user_role AS ENUM
    ('SUPER_ADMIN','ADMIN','DIRECTOR','CLOSER','CLIENTE');
CREATE TYPE user_status AS ENUM
    ('ACTIVE','SUSPENDED','INVITED','DELETED');

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    role            user_role NOT NULL,
    status          user_status NOT NULL DEFAULT 'INVITED',
    mfa_secret_enc  TEXT,
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    failed_attempts SMALLINT DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    preferences     JSONB DEFAULT '{}'::jsonb,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX users_idx_users_role
    ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX users_idx_users_email_trgm
    ON users USING GIN (email gin_trgm_ops);
CREATE INDEX users_idx_users_metadata_gin
    ON users USING GIN (metadata jsonb_path_ops);
CREATE INDEX users_idx_users_telegram
    ON users((metadata->>'telegram_id')) WHERE metadata ? 'telegram_id';

-- ----------------------------------------------------------------------------
-- sessions
-- ----------------------------------------------------------------------------
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_hash    TEXT NOT NULL,
    ip              TEXT,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX sessions_idx_sessions_user
    ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_idx_sessions_expires
    ON sessions(expires_at) WHERE revoked_at IS NULL;

-- ----------------------------------------------------------------------------
-- audit_log
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID,
    action          TEXT NOT NULL,
    target_id       UUID,
    target_type     TEXT,
    ip              TEXT,
    details         JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX audit_log_idx_audit_user
    ON audit_log(user_id, created_at DESC);
CREATE INDEX audit_log_idx_audit_action
    ON audit_log(action, created_at DESC);

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_auth;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_auth;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_auth;