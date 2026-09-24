-- ============================================================================
-- 07 — AUTOMATION SERVICE (automation_db)
-- Ejecutar: psql -h localhost -U postgres -d automation_db -f 07_automation_db.sql
-- ============================================================================
SET search_path TO public;

-- ----------------------------------------------------------------------------
-- automations
-- ----------------------------------------------------------------------------
CREATE TABLE automations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL
                    CHECK (type IN ('N8N_WEBHOOK','TELEGRAM','EMAIL','INTERNAL')),
    trigger_event   TEXT NOT NULL,
    conditions      JSONB DEFAULT '{}'::jsonb,
    actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    n8n_workflow_id TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX automations_idx_automations_project
    ON automations(project_id) WHERE is_active = TRUE;
CREATE INDEX automations_idx_automations_trigger
    ON automations(trigger_event) WHERE is_active = TRUE;
CREATE INDEX automations_idx_automations_conditions_gin
    ON automations USING GIN (conditions jsonb_path_ops);
CREATE INDEX automations_idx_automations_actions_gin
    ON automations USING GIN (actions jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- notifications_log
-- ----------------------------------------------------------------------------
CREATE TABLE notifications_log (
    id              BIGSERIAL PRIMARY KEY,
    automation_id   UUID REFERENCES automations(id),
    project_id      UUID NOT NULL,
    channel         TEXT NOT NULL
                    CHECK (channel IN ('TELEGRAM','EMAIL','WHATSAPP','SMS')),
    recipient       TEXT NOT NULL,
    message         TEXT,
    payload         JSONB,
    status          TEXT DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','SENT','FAILED')),
    error           TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX notifications_log_idx_notifications_project
    ON notifications_log(project_id, created_at DESC);
CREATE INDEX notifications_log_idx_notifications_status
    ON notifications_log(status) WHERE status = 'PENDING';
CREATE INDEX notifications_log_idx_notifications_payload_gin
    ON notifications_log USING GIN (payload jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- telegram_bindings
-- ----------------------------------------------------------------------------
CREATE TABLE telegram_bindings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL,
    chat_id           TEXT NOT NULL,
    chat_type         TEXT NOT NULL
                      CHECK (chat_type IN ('GROUP','CHANNEL','PRIVATE')),
    events            TEXT[] NOT NULL,
    message_template  TEXT,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX telegram_bindings_idx_telegram_bindings_project
    ON telegram_bindings(project_id) WHERE is_active = TRUE;
CREATE INDEX telegram_bindings_idx_telegram_bindings_events
    ON telegram_bindings USING GIN (events);

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_automation;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_automation;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_automation;