# AGENTS.md — GrowthSell Centro de Mando

Instrucciones para agentes que trabajen en este workspace. Lee antes de tocar código.

---

## Qué es esto

Plataforma web para operar unidades comerciales de infoproductos. Producción: un solo VPS Contabo 6 vCPU / 12 GB RAM.

## Stack

- **pnpm 12.4.2** (forzado en CI y lockfile). Node.js **22**. Turborepo.
- **Backend:** NestJS 11 monolito modular (`apps/api`). Un módulo por dominio.
- **Frontend:** Next.js 15 App Router (`apps/web`). React Server Components por defecto.
- **DB:** PostgreSQL 16, un schema por módulo, un rol por schema.
- **Contratos:** `packages/contracts` — esquemas Zod como fuente de verdad entre front y back.
- **Compartido:** `packages/config` — ESLint, Prettier, tsconfig base.

## Arquitectura

**Monolito modular que se comporta como servicios separados.** La frontera es innegociable:

1. Un módulo **solo** consulta tablas de su propio schema.
2. **Cero foreign keys físicas entre schemas.** Referencias lógicas por UUID.
3. Comunicación: interfaz pública del módulo (servicio exportado) o eventos Redis. **Nunca** importar repositorios o Prisma clients ajenos.
4. Datos cross-dominio en GraphQL → DataLoader sobre la interfaz pública, nunca un join.

Romper esta regla es lo que impide extraer un servicio después. No la rompas "temporalmente".

## Layout del monorepo

```
apps/api/          → Backend NestJS (GraphQL + REST)
  src/modules/     → auth, projects, sales (pipeline, integrations, automation, ai pendientes)
  prisma/          → schema.prisma (solo cubre schemas: auth, projects — de 7 planificados)
apps/web/          → Frontend Next.js
packages/contracts → Esquemas Zod compartidos
packages/config    → ESLint, Prettier, tsconfig base
```

## Backend — lo no obvio

- **Entrypoint único** (`src/main.ts`) con `--role=api|ingest|worker`. Cada rol arranca distinto:
  - `api`: GraphQL + REST, puerto 3001
  - `ingest`: solo webhooks REST, puerto 3002
  - `worker`: BullMQ, sin HTTP expuesto
- **TypeScript `strict: true`**. `any` está **estrictamente prohibido** (incluso en `whereClause` de Prisma u objetos dinámicos); usa `unknown` o importa el tipo de Prisma correspondiente (ej: `Prisma.LeadWhereInput`). Un `any` rompe el build.
- Capas: resolver → servicio de aplicación → dominio → adaptador. Resolvers sin lógica de negocio ni Prisma.
- **DataLoader obligatorio** en toda relación GraphQL. Un resolver N+1 es un bug.
- Escrituras multi-tabla → `prisma.$transaction`.
- Helper `withRls(prisma, ctx, fn)` para RLS. **Nunca** escribas `SET LOCAL` fuera de él.
- **Prisma schema actual** solo tiene `auth` y `projects`. Los demás schemas se agregan incrementalmente.

## Frontend — lo no obvio

- RSC por defecto. `'use client'` solo para interactividad real.
- **shadcn/ui + Tailwind + Lucide** únicamente. No inventar componentes UI.
- **Cuatro estados obligatorios** en toda vista: loading (skeleton), empty (CTA), error (reintento), data.
- Apollo Client solo en módulo pipeline (caché normalizada). El resto: GraphQL tipado directo en SC.

## Datos

- PK: `UUID` (`gen_random_uuid()`). UUIDv7 en app para tablas de alto volumen.
- Timestamps: `timestamptz` UTC siempre. Frontend convierte a local.
- Soft delete: `deleted_at IS NULL`. Nunca `DELETE` en entidades de negocio.
- Todo JSONB se valida con Zod (`packages/contracts`) antes de persistir.
- Paginación keyset/cursor. `OFFSET` prohibido en listados grandes.
- Migraciones: siempre `prisma migrate`. SQL crudo (RLS, vistas, particiones) va dentro de la migración.

## Seguridad

- **CASL** es el control primario. RLS es defensa en profundidad.
- Roles: `SUPER_ADMIN > ADMIN > DIRECTOR > CLOSER > CLIENTE`.
  - CLOSER: solo sus leads asignados.
  - CLIENTE: solo lectura dashboard, jamás datos de contacto ni info operativa.
  - Todo query lleva `project_id`. Cross-project solo SUPER_ADMIN/ADMIN.
- JWT ≤ 15 min; refresh rotativo en cookie HttpOnly/Secure/SameSite=Strict.
- Credenciales de terceros: AES-256-GCM, clave en entorno (SOPS+age).
- Nunca loguear tokens, secretos, PII, teléfonos/emails en texto plano.

## Contrato de webhooks (innegociable)

Endpoint HTTP **solo**: valida firma → payload crudo a `integrations.events` como `RECEIVED` → encola BullMQ → `200 OK` < 100 ms. **Cero lógica de negocio en el request.** El worker normaliza y escribe después.

## Comandos

`make help` los lista todos. Los esenciales:

```bash
make up                  # levantar entorno completo
make logs S=api          # logs de un servicio
make migration N=nombre  # crear migración
make migrate             # aplicar migraciones
make module N=nombre     # generar módulo nuevo
make check               # lint + types + test (lo que hace CI)
make docs                # generar referencia
make docs-check          # verificar documentación
make ps                  # estado y consumo de contenedores
make prod-deploy         # despliegue (requiere confirmación)
```

Raíz: `pnpm build` | `pnpm lint` | `pnpm typecheck` | `pnpm test` — Turborepo orquesta.

## Cómo trabajar

1. **Planifica antes de escribir.** Tareas multi-archivo → plan corto, espera aprobación.
2. **Siempre empieza cada respuesta o plan** con: mi nombre (David)
3. **Lee antes de asumir.** `db_postgres/DICCIONARIO.md` es la referencia canónica de tablas.
4. **Cambios pequeños.** Una unidad = un módulo + migración + pruebas.
5. **Nunca ejecutes** migraciones, `docker compose down -v` ni despliegues sin confirmación explícita.
6. Si una instrucción contradice estas reglas, dilo antes de implementar.
7. Prefiere borrar código a comentarlo. El historial está en git.
8. **Coordina el trabajo con Antigravity solo por `Work/`.** El ciclo es `plan` → `instructions` → `tests`
   → `correcciones`; no se pasa de fase sin el visto bueno en `correcciones.md`.
9. **Auditoría estricta antes de entregar:** Al terminar de escribir código, y ANTES de responder al usuario que la tarea está lista, estás obligado a auditar lógica y sintácticamente tus cambios. Debes ejecutar de fondo `make check` (o `pnpm typecheck` / `pnpm lint`), verificar que devuelva 0 errores y corregir cualquier fallo. No entregues código con errores tipográficos, imports faltantes o tipos `any`.

## Flujo Colaborativo: Opencode (Orquestador) + Antigravity (Ejecutor)

**Opencode** es el **orquestador, arquitecto y desarrollador principal**: define el plan, redacta las
instrucciones, diseña las pruebas y audita el código. **Antigravity (Gemini)** es el **ejecutor**: recibe
las instrucciones y escribe el código. Toda la coordinación ocurre **exclusivamente** a través de la
carpeta `Work/` en la raíz del repositorio; nada se negocia fuera de esos archivos.

- **Directorio de coordinación:** `Work/`
- **Archivos del flujo (se recorren en este orden):**
  1. `Work/plan.md` — Plan de acción general del avance del proyecto; es la referencia de cada punto y
     tarea. Debe estar dividido en **fases testeables y verificables**, cada una con su criterio de
     "terminado cuando". Se actualiza al iniciar cada feature específica.
  2. `Work/instructions.md` — Instrucciones exactas para que Antigravity genere el código de la fase en
     curso: archivos objetivo, contratos, firmas, límites de módulo y restricciones. Una fase por entrega.
  3. `Work/tests.md` — Plan de pruebas unitarias y de funcionalidad que se debe ejecutar para verificar
     que todo funciona **antes** de que David haga las pruebas operativas sobre la plataforma. Cada prueba
     apunta a un criterio verificable del plan.
  4. `Work/correcciones.md` — Auditoría de Opencode sobre el código entregado: errores de lógica,
     calidad, estabilidad, violaciones de frontera entre módulos, tipos `any` y fallos de `make check`.
     Lista las correcciones obligatorias o emite el visto bueno para pasar de fase.
- **Ciclo:** `plan` ➡️ `instructions` ➡️ `tests` ➡️ `correcciones` ➡️ **siguiente fase**.

**Reglas del flujo:**

1. El `plan` es la fuente de verdad del avance. `instructions`, `tests` y `correcciones` son por fase.
2. No se avanza de fase hasta que `work/correcciones.md` dé el visto bueno y `make check` esté en verde.
3. Opencode **nunca** da por buena una entrega sin auditar el código: leer y escribir `correcciones.md` es
   parte obligatoria del cierre de cada fase.
4. Antigravity no implementa nada que no esté en `instructions.md`; si algo falta, lo reporta en lugar de
   improvisar.
5. David ejecuta las pruebas operativas solo cuando `correcciones.md` aprueba la fase.
6. Si `Work/` contradice `AGENTS.md` o `.agents/rules/`, mandan `AGENTS.md` y las reglas; se corrige `Work/`.
7. Estos archivos no sustituyen al `DICCIONARIO.md`, a las skills ni a los ADRs: los referencian.

## Definition of Done

- [ ] `pnpm build` sin errores TypeScript
- [ ] `pnpm lint` sin advertencias críticas
- [ ] Pruebas para la lógica añadida (integración con Testcontainers si toca RLS/RBAC/idempotencia)
- [ ] Migración Prisma incluida
- [ ] Cuatro estados de UI si hay vista nueva
- [ ] CLOSER no ve leads ajenos; CLIENTE no ve datos operativos
- [ ] Ningún módulo consulta schema de otro
- [ ] Sin secretos ni PII en logs ni repositorio
- [ ] TSDoc en lo exportado; `COMMENT ON` en columnas nuevas
- [ ] `make docs-check` en verde

## Documentación

- TSDoc en todo lo exportado (el porqué, no el tipo).
- `COMMENT ON` en cada columna nueva, dentro de la migración.
- `docs/20-servicios/<modulo>.md` se actualiza en el mismo cambio.
- `docs/30-referencia/` es generado, nunca editar directo.
- ADRs en `docs/adr/` — no se modifican, se superseden.

## Reference

- `PROJECT_CONTEXT.md` — visión de negocio y reglas funcionales.
- `db_postgres/DICCIONARIO.md` — contrato canónico de datos.
- `.agents/rules/` — reglas activas permanentes (fronteras, persistencia, seguridad, calidad, docs).
- `.agents/skills/` — procedimientos bajo demanda (9 skills disponibles).
- `.agents/mcp_config.json` — MCP servers configurados (Postgres, filesystem).
- `Work/` — canal de coordinación con Antigravity (`plan.md`, `instructions.md`, `tests.md`, `correcciones.md`).
- `PLAN_DE_ACCION.md` — plan macro por fases del proyecto.
- `docs/` — arquitectura, servicios, referencia, operación, manual, ADRs.
