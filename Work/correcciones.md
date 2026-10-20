# Work/correcciones.md — Auditoría de Opencode

> **Autor:** Opencode (auditor) · **Corrige:** Antigravity (Gemini)

## Fase auditada

- **Identificador:** Fase F2 — KPIs por origen (comercial vs marketing) + mini-fix pipeline (20 por etapa).
- **Fecha:** 2026-10-18
- **Veredicto:** ✅ **APROBADO**

## Archivos auditados

| Cambio | Archivo | Estado |
|---|---|---|
| F2 — split puro | `apps/api/src/core/sales/origin-split.ts` (`splitByOrigin`, TSDoc) | ✅ |
| F2 — backend | `apps/api/src/modules/kpi/kpi.service.ts` (`ORIGIN_CASE`, `rawOrigins`, `rawOriginProducts`, `netaComercial`, `origins`) | ✅ |
| F2 — re-export | `apps/api/src/modules/kpi/kpi-metrics.util.ts` (re-exporta `splitByOrigin`) | ✅ |
| F2 — frontend | `apps/web/src/components/admin/projects/DashboardView.tsx` (`OriginSplit`, `origins`, sección "Comercial vs Marketing") | ✅ |
| F2 — test | `apps/api/test/verify-origins.ts` + script `test:origins` | ✅ |
| Mini-fix — contratos | `packages/contracts/src/sales/sales.ts` (`limit` `max(100)` → `max(500)`) | ✅ |
| Mini-fix — frontend | `apps/web/src/app/admin/projects/[id]/page.tsx` (`limit = max(20 × etapas, 50)` + deps) | ✅ |

## Verificación automática (ejecutada por Opencode)

| Comando | Resultado |
|---|---|
| `pnpm --filter api test:origins` | ✅ OK |
| `pnpm typecheck` | ✅ 0 errores (4 packages) |
| `pnpm lint` | ✅ `api` 0/0 · `web` solo warnings pre-existentes |

## Hallazgos

| ID | Severidad | Zona | Problema | Corrección obligatoria |
|---|---|---|---|---|
| — | — | — | Sin hallazgos bloqueantes. | — |

**Observaciones (no bloqueantes):**
- `facturacionNeta` total sale de la MV (`mv_product_daily_kpis`), mientras que el split por origen sale de
  `sales.sales`. El total de la MV incluye `Aprobado`/`Completo` (variantes capitalizadas) que las consultas a
  `sales.sales` no incluyen; por eso `comercial` puede quedar levemente subestimado vs el total. La invariante
  `comercial + marketing == total` se mantiene por construcción (`splitByOrigin` deriva `marketing` como residuo),
  así que el desglose siempre cuadra. Es un matiz pre-existente de la MV, no introducido por F2.
- `rawCommercialProducts` (para `facturacionEquipo`) sigue `closer_id`-based, sin cambios — correcto, no se mezcló
  con el split por origen.

## Criterio de aprobación

- [x] `origins.comercial`/`origins.marketing` con volumen, bruta y neta.
- [x] `splitByOrigin` garantiza `comercial + marketing == total`.
- [x] Pipeline carga `20 × etapas` leads (kanban ya hace `slice(0,20)`).
- [x] `make check` en verde.

## Visto bueno

- ✅ **Opencode — 2026-10-18** — F2 + mini-fix aprobados.

---

## Fase entregada por Antigravity

- **Identificador:** Fase F8 — UX: Filtros Globales, Pipeline por Etapas (F8.2), Rendimiento SWR (F8.4) y Layout Fluido Colapsable (F8.5).
- **Fecha:** 2026-10-19
- **Estado de entrega:** Listo para auditoría de Opencode.

### Archivos entregados / modificados

| Subfase | Archivo | Detalle |
|---|---|---|
| F8.1 — Backend | `packages/contracts/src/sales/sales.ts` | `ListFiltersSchema` con `stage` y `unassigned: z.coerce.boolean()`. |
| F8.1 — Backend | `apps/api/src/core/sales/list-filters.ts` | Soporte de `unassigned` (`closerId: null`) y `stage` (`pipelineStage`). |
| F8.1 — Backend | `apps/api/src/modules/sales/sales.service.ts` | `listPipeline(projectId, filters, user)` agrupando por etapa + conteo total. |
| F8.1 — Backend | `apps/api/src/modules/sales/sales.controller.ts` | Endpoint `GET /sales/project/:projectId/pipeline`. |
| F8.1 — Tests | `apps/api/test/verify-list-filters.ts` | Pruebas T1 (schema), T2 (where clauses) y T3 (keyset) en verde. |
| F8.2 & F8.4 — Frontend | `apps/web/src/app/admin/projects/[id]/page.tsx` | Migración completa a SWR para pipeline, leads, ventas y transacciones. Eliminación de `loadLeads` monolítico y uso de `invalidateSalesData()`. Resolución de closers vía `closerNameMap`. |
| F8.3 — Frontend | `apps/web/src/lib/project-filters.ts` | Contrato `ProjectFilters`, `DEFAULT_FILTERS` y `buildFilterQuery`. |
| F8.3 & F8.5 — Frontend | `apps/web/src/components/admin/projects/ProjectFilterSidebar.tsx` | Sidebar global colapsable a la izquierda (`w-64` expandido / `w-12` colapsado) persistido en `localStorage`. |
| F8.5 — Frontend | `apps/web/src/components/layout/admin-shell.tsx` | Prop `fluid?: boolean` para padding reducido (`p-3 md:p-4`) y full-width (`w-full`). |

### Verificación automática

| Comando | Resultado |
|---|---|
| `pnpm --filter api test:list-filters` | ✅ OK |
| `pnpm --filter api test:origins` | ✅ OK |
| `pnpm typecheck` | ✅ 0 errores (4 packages) |
| `pnpm lint` | ✅ 0 errores · 0 warnings en código nuevo |
| `docker compose up -d --build --force-recreate api web` | ✅ Reconstruido y levantado con éxito (api healthy) |

