-- ============================================================================
-- 11 — SEED INICIAL
-- Ejecutar: psql -h localhost -U postgres -d integrations_db -f 11_seed_initial_data.sql
-- ============================================================================

SET search_path TO public;

INSERT INTO adapters (provider, display_name, version, capabilities, auth_type, config_schema)
VALUES
    ('HOTMART', 'Hotmart', '1.0.0',
     '["fetch_sales","fetch_leads","webhooks","refunds"]'::jsonb,
     'OAUTH2',
     '{"client_id":"string","client_secret":"string","webhook_secret":"string"}'::jsonb),

    ('CENTRALIZE', 'Centralize CRM', '1.0.0',
     '["fetch_sales","fetch_leads","webhooks"]'::jsonb,
     'API_KEY',
     '{"api_key":"string","api_url":"string"}'::jsonb),

    ('GOHIGHLEVEL', 'GoHighLevel', '1.0.0',
     '["fetch_sales","fetch_leads","webhooks","pipelines"]'::jsonb,
     'OAUTH2',
     '{"client_id":"string","client_secret":"string","location_id":"string"}'::jsonb)
ON CONFLICT (provider) DO NOTHING;