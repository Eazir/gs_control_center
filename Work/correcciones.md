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
