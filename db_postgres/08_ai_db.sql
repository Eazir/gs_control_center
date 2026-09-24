-- ============================================================================
-- 08 — AI SERVICE (ai_db)
-- Ejecutar: psql -h localhost -U postgres -d ai_db -f 08_ai_db.sql
-- ============================================================================
SET search_path TO public;

-- ----------------------------------------------------------------------------
-- project_context
-- ----------------------------------------------------------------------------
CREATE TABLE project_context (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL UNIQUE,
    context         JSONB NOT NULL DEFAULT '{}'::jsonb,
    system_prompt   TEXT,
    guardrails      JSONB DEFAULT '{}'::jsonb,
    access_rules    JSONB DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX project_context_idx_context_gin
    ON project_context USING GIN (context jsonb_path_ops);
CREATE INDEX project_context_idx_guardrails_gin
    ON project_context USING GIN (guardrails jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- conversations
-- ----------------------------------------------------------------------------
CREATE TABLE conversations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID,
    user_id           UUID,
    channel           TEXT NOT NULL
                      CHECK (channel IN ('TELEGRAM','CRM','API','WHATSAPP')),
    external_chat_id  TEXT,
    messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
    tokens_used       INTEGER DEFAULT 0,
    cost_usd          NUMERIC(10,6) DEFAULT 0,
    started_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at          TIMESTAMPTZ
);

CREATE INDEX conversations_idx_ai_conversations_project
    ON conversations(project_id, started_at DESC);
CREATE INDEX conversations_idx_ai_conversations_user
    ON conversations(user_id, started_at DESC);
CREATE INDEX conversations_idx_ai_conversations_chat
    ON conversations(external_chat_id);
CREATE INDEX conversations_idx_ai_conversations_messages_gin
    ON conversations USING GIN (messages jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- feedback
-- ----------------------------------------------------------------------------
CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_index   INTEGER NOT NULL,
    user_id         UUID,
    rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
    correction      TEXT,
    is_approved     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX feedback_idx_ai_feedback_conversation
    ON feedback(conversation_id);
CREATE INDEX feedback_idx_ai_feedback_rating
    ON feedback(rating) WHERE rating <= 2;

-- ----------------------------------------------------------------------------
-- telegram_links
-- ----------------------------------------------------------------------------
CREATE TABLE telegram_links (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL,
    telegram_id        TEXT NOT NULL UNIQUE,
    telegram_username  TEXT,
    link_code          TEXT,
    linked_at          TIMESTAMPTZ,
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX telegram_links_idx_telegram_links_user
    ON telegram_links(user_id) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_ai;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_ai;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_ai;