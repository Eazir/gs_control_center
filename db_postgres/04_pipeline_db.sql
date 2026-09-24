-- ============================================================================
-- 04 — PIPELINE SERVICE (pipeline_db)
-- Ejecutar: psql -h localhost -U postgres -d pipeline_db -f 04_pipeline_db.sql
-- ============================================================================
SET search_path TO public;

-- ----------------------------------------------------------------------------
-- pipelines
-- ----------------------------------------------------------------------------
CREATE TABLE pipelines (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL,
    name              TEXT NOT NULL DEFAULT 'Pipeline principal',
    template_version  TEXT NOT NULL DEFAULT 'v1',
    columns           JSONB NOT NULL DEFAULT '[]'::jsonb,
    transitions       JSONB DEFAULT '[]'::jsonb,
    is_active         BOOLEAN DEFAULT TRUE,
    created_by        UUID,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX pipelines_idx_pipelines_project
    ON pipelines(project_id) WHERE is_active = TRUE;
CREATE INDEX pipelines_idx_pipelines_columns_gin
    ON pipelines USING GIN (columns jsonb_path_ops);
CREATE INDEX pipelines_idx_pipelines_transitions_gin
    ON pipelines USING GIN (transitions jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- pipeline_rows
-- ----------------------------------------------------------------------------
CREATE TABLE pipeline_rows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL,
    lead_name       TEXT,
    lead_email      TEXT,
    lead_phone      TEXT,
    closer_id       UUID,
    current_stage   TEXT,
    potential_value NUMERIC(14,2),
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    row_version     INTEGER DEFAULT 1,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX pipeline_rows_idx_pipeline_rows_project
    ON pipeline_rows(project_id) WHERE deleted_at IS NULL;
CREATE INDEX pipeline_rows_idx_pipeline_rows_closer
    ON pipeline_rows(closer_id) WHERE deleted_at IS NULL;
CREATE INDEX pipeline_rows_idx_pipeline_rows_stage
    ON pipeline_rows(project_id, current_stage) WHERE deleted_at IS NULL;
CREATE INDEX pipeline_rows_idx_pipeline_rows_closer_stage
    ON pipeline_rows(closer_id, current_stage) WHERE deleted_at IS NULL;
CREATE INDEX pipeline_rows_idx_pipeline_rows_data_gin
    ON pipeline_rows USING GIN (data jsonb_path_ops);
CREATE INDEX pipeline_rows_idx_pipeline_rows_email_trgm
    ON pipeline_rows USING GIN (lead_email gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- row_history (particionado por mes)
-- ----------------------------------------------------------------------------
CREATE TABLE row_history (
    id              BIGSERIAL,
    row_id          UUID NOT NULL,
    project_id      UUID NOT NULL,
    user_id         UUID,
    action          TEXT NOT NULL,
    field_changed   TEXT,
    old_value       JSONB,
    new_value       JSONB,
    from_stage      TEXT,
    to_stage        TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE row_history_2026_08 PARTITION OF row_history
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE row_history_2026_09 PARTITION OF row_history
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE row_history_2026_10 PARTITION OF row_history
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE row_history_2026_11 PARTITION OF row_history
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE row_history_2026_12 PARTITION OF row_history
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX row_history_idx_row
    ON row_history(row_id, created_at DESC);
CREATE INDEX row_history_idx_project
    ON row_history(project_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- bulk_operations
-- ----------------------------------------------------------------------------
CREATE TABLE bulk_operations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    operation_type  TEXT NOT NULL
                    CHECK (operation_type IN
                          ('MOVE_STAGE','ASSIGN_CLOSER','UPDATE_FIELD','DELETE')),
    row_ids         UUID[] NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROCESSING','DONE','FAILED')),
    processed_count INTEGER DEFAULT 0,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at     TIMESTAMPTZ
);

CREATE INDEX bulk_operations_idx_bulk_ops_status
    ON bulk_operations(status) WHERE status IN ('PENDING','PROCESSING');
CREATE INDEX bulk_operations_idx_bulk_ops_payload_gin
    ON bulk_operations USING GIN (payload jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_pipeline;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_pipeline;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_pipeline;