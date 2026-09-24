---
name: prisma-postgres-rls
description: Escribir migraciones Prisma, políticas de Row Level Security, particiones e índices en PostgreSQL 16 para gs_control_center. Úsala siempre que se toque el esquema de base de datos, se cree una tabla o columna, se necesite aislar datos por rol o proyecto, o aparezcan dudas sobre RLS, JSONB, índices GIN o tablas particionadas.
---

# Migraciones, RLS e índices

## Migraciones

- Siempre `pnpm --filter api prisma migrate dev --name <accion_entidad>`.
- El SQL que Prisma no modela (políticas RLS, vistas materializadas, particiones, triggers) se escribe
  a mano **dentro** del archivo de migración generado.
- Toda migración debe aplicar limpia desde una base vacía. Verifícalo antes de cerrar.
- Actualiza `db_postgres/DICCIONARIO.md` en el mismo cambio.

## Plantilla de tabla

```sql
CREATE TABLE pipeline.rows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL,
  closer_id     uuid,
  current_stage text NOT NULL,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version   integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX ON pipeline.rows (project_id, current_stage, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX ON pipeline.rows USING gin (data jsonb_path_ops);
```

Sin foreign keys hacia otros schemas. `project_id` y `closer_id` son referencias lógicas.

## RLS

```sql
ALTER TABLE pipeline.rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline.rows FORCE ROW LEVEL SECURITY;

CREATE POLICY rows_closer_isolation ON pipeline.rows
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN','ADMIN','DIRECTOR')
    OR closer_id = current_setting('app.current_user_id', true)::uuid
  );
```

La política no sustituye a CASL. Es la red de seguridad por si un query se escapa.

## Helper obligatorio en la aplicación

```ts
export function withRls<T>(prisma: PrismaClient, ctx: AuthCtx, fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_user_role', $2, true)`,
      ctx.userId, ctx.role,
    );
    return fn(tx);
  });
}
```

`SET LOCAL` fuera de una transacción no hace nada con el pool de Prisma. Es el error más común aquí.

## Alto volumen

- `integrations.events` y `pipeline.row_history`: particionadas por mes (`RANGE` sobre `created_at`),
  con job mensual que crea la partición siguiente.
- En esas tablas usa UUIDv7 generado en la aplicación para evitar fragmentación del índice B-tree.
- Idempotencia de ingesta: `UNIQUE (source, external_order_id, external_txn_id)`.

## Vistas materializadas

Siempre con índice único para permitir `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
El refresco lo dispara un repeatable job de BullMQ, nunca `pg_cron`.
