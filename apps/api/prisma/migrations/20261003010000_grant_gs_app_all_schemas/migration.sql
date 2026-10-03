-- Otorgar al rol gs_app (usado por SET LOCAL ROLE en withRls) acceso a TODOS
-- los schemas de dominio, no solo auth/projects como quedaba en 20260917202848.
GRANT ALL ON SCHEMA pipeline, sales, integrations, automation, ai TO gs_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pipeline, sales, integrations, automation, ai TO gs_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pipeline, sales, integrations, automation, ai TO gs_app;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA pipeline, sales, integrations, automation, ai TO gs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline, sales, integrations, automation, ai GRANT ALL ON TABLES TO gs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline, sales, integrations, automation, ai GRANT ALL ON SEQUENCES TO gs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline, sales, integrations, automation, ai GRANT ALL ON ROUTINES TO gs_app;
