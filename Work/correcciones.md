# Work/correcciones.md — Auditoría de Opencode

> **Autor:** Opencode (auditor) · **Corrige:** Antigravity (Gemini)

## Fase auditada

- **Identificador:** Fase F1 — Filtros, paginación y contadores de listados (req 1, 3, 7, 11, 12).
- **Fecha:** 2026-10-17
- **Veredicto:** ✅ **APROBADO** — F1 completa (5 entregas), vista buena para revisión operativa.

## Archivos auditados

| Entrega | Archivo | Estado |
|---|---|---|
| 1 — Contratos | `packages/contracts/src/sales/sales.ts` (`ListFiltersSchema`, `OriginFilterEnum`, `Paginated<T>`) | ✅ |
| 2 — Helpers | `apps/api/src/core/sales/list-filters.ts` (cursor + `buildDateRange` + `buildOriginClause` + `buildSaleWhereClause` + `buildLeadWhereClause`, con TSDoc) | ✅ |
| 2 — Re-export/tests | `core/sales/index.ts` + `apps/api/test/verify-list-filters.ts` + script `test:list-filters` | ✅ |
| 3 — Backend sales | `sales.service.ts` (`listSales`/`listTransactions`/`listLeads` con filtros + keyset + envelope) + `sales.controller.ts` (Zod) | ✅ |
| 4 — Dashboard | `kpi.controller.ts` + `kpi.service.ts` (`buildDateFilterSql`, `day`/`from`/`to`, 5 consultas raw) | ✅ |
| 5 — Frontend | `TransactionsView.tsx`, `SalesView.tsx`, `admin/projects/[id]/page.tsx` (envelope + filtros + paginación + contador), `DashboardView.tsx` (`day`/`from`/`to`) | ✅ |

## Verificación automática (ejecutada por Opencode)

| Comando | Resultado |
|---|---|
| `pnpm --filter api test:list-filters` | ✅ OK (T1 Zod, T2 helpers, T3 cursor) |
| `pnpm typecheck` | ✅ 0 errores (4 packages) |
| `pnpm --filter api lint` | ✅ 0 errores |
| `pnpm lint` (web) | ✅ solo warnings pre-existentes (`LeadDetailModal.tsx` useEffect, no introducidos por F1) |

## Hallazgos

| ID | Severidad | Zona | Problema | Corrección obligatoria |
|---|---|---|---|---|
| — | — | — | Sin hallazgos bloqueantes. | — |

**Categorías revisadas sin hallazgos:** lógica ❌, `any` ❌, imports ❌, variables sin uso ❌, TSDoc ❌,
OFFSET ❌, RLS/aislamiento CLOSER ❌, frontera de módulo ❌, SQL con params tipados (sin interpolación directa) ❌.

**Observaciones (no bloqueantes):**
- `decodeCursor` devuelve `{ createdAt, id }`; en `listLeads` ese timestamp es en realidad `updatedAt`. Funcional
  (se codifica con `updatedAt` y se decodifica/usa igual), pero el nombre del campo es confuso. Cosméticamente
  mejorable; no afecta el comportamiento.
- Keyset sobre `id` (UUID) como tie-break: correcto, `id` es único y la comparación lexicográfica es estable.

## Criterio de aprobación

- [x] 0 hallazgos bloqueantes abiertos
- [x] `pnpm typecheck` + `pnpm lint` + `test:list-filters` en verde
- [x] `Work/tests.md` T1–T3 en verde; T4 (operativa) pendiente de David
- [x] Done de F1 en `Work/instructions.md` cumplido (5 entregas)

## Visto bueno

- ✅ **Opencode — 2026-10-17** — F1 completa (5 entregas). Pendiente: reconstruir contenedores y revisión
  operativa de David (T4).
