# GrowthShell — Base de Datos

Instrucciones para levantar la base de datos de GrowthShell desde cero.
Arquitectura: **1 base de datos por microservicio**, cada una con su rol dueño.

## Requisitos

- PostgreSQL 16 (Docker con `pg_cron` o instalación nativa)
- Cliente `psql` para ejecutar los scripts
- Acceso como superusuario (`postgres`) para crear roles y DBs

## Estructura

| Base de datos     | Servicio             | Rol dueño         | Password             |
|-------------------|----------------------|-------------------|----------------------|
| `auth_db`         | auth-service         | `svc_auth`        | `auth_tyr_051025`    |
| `projects_db`     | projects-service     | `svc_projects`    | `projects_tyr_051025`|
| `pipeline_db`     | pipeline-service     | `svc_pipeline`    | `pipeline_tyr_051025`|
| `sales_db`        | sales-service        | `svc_sales`       | `sales_tyr_051025`   |
| `integrations_db` | integrations-service | `svc_integrations`| `integrations_tyr_051025`|
| `automation_db`   | automation-service   | `svc_automation`  | `automation_tyr_051025`|
| `ai_db`           | ai-service           | `svc_ai`          | `ai_tyr_051025`      |

## Proceso de instalación

### Paso 0 — Preparar PostgreSQL con pg_cron

Si usas Docker, usa una imagen con `pg_cron` incluido:

```yaml
services:
  postgres:
    image: ghcr.io/eigenwallet/postgres-pgcron:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: <password_segura>
      POSTGRES_DB: postgres
    command: >
      postgres
      -c shared_preload_libraries=pg_cron
      -c cron.database_name=postgres
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
volumes:
  pg_data:
```

Si usas instalación nativa, instala `postgresql-16-cron` y añade
`shared_preload_libraries = 'pg_cron'` en `postgresql.conf`.

### Paso 1 — Crear roles y bases de datos

```bash
psql -h localhost -U postgres -d postgres -f 00_create_roles_and_databases.sql
```

> ⚠️ `CREATE DATABASE` no puede correr dentro de una transacción.
> El script está diseñado para ejecutarse con `psql -f`, que NO envuelve
> el script en una transacción.

### Paso 2 — Crear extensiones en cada base de datos

```bash
for db in auth_db projects_db pipeline_db sales_db integrations_db automation_db ai_db; do
  psql -h localhost -U postgres -d $db -f 01_extensions.sql
done
```

### Paso 3 — Crear las tablas (una por servicio)

```bash
psql -h localhost -U postgres -d auth_db         -f 02_auth_db.sql
psql -h localhost -U postgres -d projects_db     -f 03_projects_db.sql
psql -h localhost -U postgres -d pipeline_db     -f 04_pipeline_db.sql
psql -h localhost -U postgres -d sales_db        -f 05_sales_db.sql
psql -h localhost -U postgres -d integrations_db -f 06_integrations_db.sql
psql -h localhost -U postgres -d automation_db   -f 07_automation_db.sql
psql -h localhost -U postgres -d ai_db           -f 08_ai_db.sql
```

### Paso 4 — Crear las vistas materializadas

```bash
psql -h localhost -U postgres -d sales_db    -f 09_materialized_views.sql
psql -h localhost -U postgres -d pipeline_db -f 09_materialized_views.sql
```

> El mismo archivo se aplica a dos DBs. Detecta por `current_database()`
> qué MVs crear en cada una.

### Paso 5 — Aplicar Row Level Security (opcional, fase 2)

```bash
psql -h localhost -U postgres -d pipeline_db -f 10_security_rls.sql
psql -h localhost -U postgres -d sales_db    -f 10_security_rls.sql
```

### Paso 6 — Insertar datos iniciales

```bash
psql -h localhost -U postgres -d integrations_db -f 11_seed_initial_data.sql
```

### Paso 7 — Programar refrescos de MVs

Si tienes `pg_cron` (ver Paso 0):

```bash
psql -h localhost -U postgres -d sales_db    -c "SELECT cron.schedule('refresh-sales',    '*/5 * * * *',  \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_kpis; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_closer_daily_kpis; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_daily_kpis;\$\$);"
psql -h localhost -U postgres -d sales_db    -c "SELECT cron.schedule('refresh-account',  '*/15 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_account_daily_kpis;\$\$);"
psql -h localhost -U postgres -d pipeline_db -c "SELECT cron.schedule('refresh-pipeline', '*/5 * * * *',  \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_closer_daily_leads; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel;\$\$);"
```

Si NO tienes `pg_cron`, programa un crontab del sistema o usa n8n.

## Cadenas de conexión

Cada microservicio NestJS usa su propio rol:

```
postgresql://svc_auth:auth_tyr_051025@<host>:5432/auth_db
postgresql://svc_projects:projects_tyr_051025@<host>:5432/projects_db
postgresql://svc_pipeline:pipeline_tyr_051025@<host>:5432/pipeline_db
postgresql://svc_sales:sales_tyr_051025@<host>:5432/sales_db
postgresql://svc_integrations:integrations_tyr_051025@<host>:5432/integrations_db
postgresql://svc_automation:automation_tyr_051025@<host>:5432/automation_db
postgresql://svc_ai:ai_tyr_051025@<host>:5432/ai_db
```

## Reglas de oro para el desarrollo

1. **Cada servicio solo escribe en su propia DB.** Para leer de otra, se hace
   por GraphQL Federation en el gateway o por eventos (Redis/BullMQ).
2. **No hay foreign keys cross-DB.** Las referencias a entidades de otros
   servicios son UUIDs sin FK física.
3. **Los ENUMs son del dominio del servicio.** El back debe mapearlos con
   `@nestjs/graphql` como `registerEnumType`.
4. **Todo JSONB tiene una estructura documentada** (ver `DICCIONARIO.md`).
   No agregar campos arbitrarios sin actualizar el diccionario.
5. **Los timestamps son `timestamptz`**, no `timestamp`. Siempre en UTC.
6. **Los IDs son UUID v4** generados por la DB con `uuid_generate_v4()`.
7. **Soft delete**: `deleted_at IS NULL` significa activo. Nunca borrar
   físicamente entidades con historial.
8. **Idempotencia**: los webhooks y eventos usan `dedupe_key` o
   `external_order_id` para evitar duplicados.

## Verificación final

```bash
# Listar roles
psql -U postgres -c "\du"

# Listar bases
psql -U postgres -c "\l"

# Verificar tablas por DB
psql -U postgres -d auth_db -c "\dt"
psql -U postgres -d sales_db -c "\dt"
psql -U postgres -d sales_db -c "\dm"   # MVs
```