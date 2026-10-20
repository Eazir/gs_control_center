# Work/tests.md — Fase F8

> **Fase:** F8 — Correcciones de UX: filtros globales, pipeline y rendimiento.
> **Referencia:** `Work/plan.md` (F8) y `Work/instructions.md`.
> **Estilo:** unit puro con `tsx test/verify-*.ts` (backend); operativo para UI/UX (David).

## Cómo se ejecutan

```bash
pnpm --filter api test:list-filters     # unit: where-builders con unassigned + stage
make check                              # lint + typecheck + tests
```

---

## T1 — Unit: filtros `unassigned` y `stage` (backend)

**Archivo:** `apps/api/test/verify-list-filters.ts` (extender el existente).

**Qué verifica:** `buildLeadWhereClause` y `buildSaleWhereClause` (funciones puras) con los filtros nuevos.

Casos:

| # | Llamada | Esperado |
|---|---|---|
| 1 | `buildSaleWhereClause(p, { unassigned: true })` | incluye `{ closerId: null }` |
| 2 | `buildSaleWhereClause(p, { stage: 'won' })` | incluye `{ pipelineStage: 'won' }` |
| 3 | `buildLeadWhereClause(p, { unassigned: true })` | `AND: [{ closerId: null }, { NOT: { sales: { some: { closerId: { not: null } } } } }]` |
| 4 | `buildLeadWhereClause(p, { stage: 'won' })` | incluye `{ pipelineStage: 'won' }` |
| 5 | `buildLeadWhereClause(p, { closerId: <uuid> })` | **no** se altera (regresión del closer concreto) |
| 6 | `buildSaleWhereClause(p, { origin: 'comercial' })` | **no** se altera (regresión origen F3) |

> Comparar el resultado con `toEqual`/`deepEqual` sobre sub-objetos relevantes (no el objeto entero, para
> no acoplarse al orden interno). El existing `verify-list-filters.ts` ya importa ambos builders.

**Criterio de aceptación:** `verify-list-filters: OK` (exit 0).

---

## T2 — Unit: builder de query del frontend (opcional si hay runner)

Si `apps/web` dispone de runner `tsx`, añadir `apps/web/test/verify-project-filters.ts` con:

| # | `buildFilterQuery` input | Esperado |
|---|---|---|
| 1 | `{ closer: 'UNASSIGNED' }` | `unassigned=true` (y **sin** `closerId`) |
| 2 | `{ closer: '<uuid>' }` | `closerId=<uuid>` (y **sin** `unassigned`) |
| 3 | `{ origin: 'todos', status: 'ALL', productId: 'ALL', stage: 'ALL' }` | sin esos params |
| 4 | `{ day: '2026-10-18' }` | `day=2026-10-18` |
| 5 | `{ from: '2026-10-01', to: '2026-10-18' }` | `from=…&to=…` |

> Si no hay runner en web, este test se cubre de forma operativa (T3) y no bloquea.

---

## T3 — Verificación operativa (David, tras `correcciones.md`)

1. **Por Asignar:** elegir "Por asignar" en el sidebar → pipeline/leads/ventas muestran solo sin closer.
2. **Etapa:** elegir una etapa → solo esa etapa (en pipeline y base de leads).
3. **Calendario:** el filtro de fecha abre un calendario (no un input de texto); al elegir "día" se
   desactivan desde/hasta y viceversa.
4. **Pipeline:** cada etapa muestra hasta 20 tarjetas y su total real en el encabezado; el total solo cambia
   al aplicar un filtro.
5. **Sidebar global:** una sola barra lateral izquierda en pipeline/leads/ventas/transacciones; métricas sin
   sidebar; cambiar un filtro en una pestaña se refleja en las demás.
6. **Rendimiento:** cambiar de pestaña es rápido y no recarga todo; al mover un lead o crear una venta, las
   vistas afectadas se actualizan solas (sin botón "Refrescar").

---

## Trazabilidad con el plan F8 ("Terminado cuando")

| Entrega | Criterio | Cubierto por |
|---|---|---|
| F8.1 | filtros `unassigned`/`stage` + `/pipeline` | T1 + T3 #1/#2 |
| F8.2 | 20 tarjetas/etapa + total encabezado | T3 #4 |
| F8.3 | sidebar global + calendario excluyente | T3 #3/#5 |
| F8.4 | carga diferida + recarga dinámica | T3 #6 |

## Definition of Done (fragmento aplicable a F8)

- [ ] `pnpm lint` y `pnpm typecheck` sin errores.
- [ ] T1 (y T2 si hay runner) en verde.
- [ ] Sin `any` nuevo; TSDoc en lo exportado; sin tocar F0/F3/F1/F2/kpi.
- [ ] Frontend con los 4 estados de UI en las vistas tocadas.
