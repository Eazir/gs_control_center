-- ============================================================================
-- 06 — INTEGRATIONS SERVICE (integrations_db)
-- Ejecutar: psql -h localhost -U postgres -d integrations_db -f 06_integrations_db.sql
-- ============================================================================
SET search_path TO public;

CREATE TYPE integration_status   AS ENUM
    ('DISCONNECTED','CONNECTED','ERROR','SYNCING');
CREATE TYPE integration_provider AS ENUM
    ('HOTMART','CENTRALIZE','GOHIGHLEVEL','CUSTOM');

-- ----------------------------------------------------------------------------
-- adapters
-- ----------------------------------------------------------------------------
CREATE TABLE adapters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider        TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    version         TEXT NOT NULL,
    capabilities    JSONB NOT NULL,
    auth_type       TEXT NOT NULL
                    CHECK (auth_type IN ('OAUTH2','API_KEY','WEBHOOK')),
    config_schema   JSONB NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    registered_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX adapters_idx_adapters_capabilities_gin
    ON adapters USING GIN (capabilities jsonb_path_ops);
CREATE INDEX adapters_idx_adapters_config_schema_gin
    ON adapters USING GIN (config_schema jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- integrations
-- ----------------------------------------------------------------------------
CREATE TABLE integrations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL,
    provider          integration_provider NOT NULL,
    name              TEXT NOT NULL,
    status            integration_status DEFAULT 'DISCONNECTED',
    credentials_enc   TEXT NOT NULL,
    config            JSONB NOT NULL DEFAULT '{}'::jsonb,
    field_mapping     JSONB DEFAULT '{}'::jsonb,
    webhook_secret    TEXT,
    webhook_url       TEXT,
    last_sync_at      TIMESTAMPTZ,
    last_sync_cursor  TEXT,
    last_error        TEXT,
    error_count       INTEGER DEFAULT 0,
    adapter_meta      JSONB DEFAULT '{}'::jsonb,
    is_active         BOOLEAN DEFAULT TRUE,
    created_by        UUID,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX integrations_idx_integrations_project
    ON integrations(project_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX integrations_idx_integrations_project_provider
    ON integrations(project_id, provider) WHERE is_active = TRUE;
CREATE INDEX integrations_idx_integrations_config_gin
    ON integrations USING GIN (config jsonb_path_ops);
CREATE INDEX integrations_idx_integrations_field_mapping_gin
    ON integrations USING GIN (field_mapping jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- events (particionado por mes)
-- ----------------------------------------------------------------------------
CREATE TABLE events (
    id              BIGSERIAL,
    integration_id  UUID NOT NULL,
    project_id      UUID NOT NULL,
    event_type      TEXT NOT NULL,
    external_id     TEXT,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'RECEIVED'
                    CHECK (status IN ('RECEIVED','PROCESSED','FAILED','RETRYING')),
    attempts        SMALLINT DEFAULT 0,
    error           TEXT,
    dedupe_key      TEXT NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMPTZ,
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

CREATE TABLE events_2026_08 PARTITION OF events
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE events_2026_09 PARTITION OF events
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE events_2026_10 PARTITION OF events
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE events_2026_11 PARTITION OF events
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE events_2026_12 PARTITION OF events
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE UNIQUE INDEX events_idx_integration_events_dedupe
    ON events(integration_id, dedupe_key, received_at);
CREATE INDEX events_idx_integration_events_status
    ON events(status, received_at)
    WHERE status IN ('RECEIVED','FAILED','RETRYING');
CREATE INDEX events_idx_integration_events_project
    ON events(project_id, received_at DESC);
CREATE INDEX events_idx_integration_events_payload_gin
    ON events USING GIN (payload jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_integrations;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_integrations;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_integrations;