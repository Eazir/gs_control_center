# Work/instructions.md — Fase F2 (+ mini-fix pipeline)

> **Fase:** F2 — KPIs por origen: comercial vs marketing (req 2) + mini-fix pipeline (20 tarjetas por etapa).
> **Referencia:** `Work/plan.md` (F2) — verificado contra `kpi.service.ts`, `kpi-metrics.util.ts`,
> `DashboardView.tsx`, `Comparatives.tsx`, `page.tsx` (kanban) y `packages/contracts`.
> **Alcance:** backend `kpi` + frontend métricas + mini-fix de límite en el pipeline.

## Objetivo

1. **F2:** desglosar en el dashboard los KPIs de **volumen**, **facturación bruta** y **facturación neta** en
   `{ comercial, marketing }`, usando la clasificación de F3 (`metadata.attribution` con fallback a `closer_id`).
2. **Mini-fix:** que el pipeline (kanban) muestre las primeras **20 tarjetas por etapa** (hoy carga 50 leads en
   general, insuficiente para llenar 20 por etapa).

---

## Decisiones de diseño (F2)

- La clasificación de origen es `metadata.attribution` (F3); para filas sin etiqueta se usa el fallback
  `closer_id IS NOT NULL ⇒ COMERCIAL`, `closer_id IS NULL ⇒ MARKETING`. Esto alinea el dashboard con F3/F3.1
  (las ventas "COMERCIAL sin closer" se cuentan como **comercial**, no marketing).
- El desglose se devuelve en un campo **aditivo** `origins` (no se rompe `kpis`, que sigue con los totales).
- Invariante a respetar: `origins.comercial.X + origins.marketing.X == total` para cada KPI (salvo redondeo).

---

## Parte A — Backend (`kpi.service.ts`)

### A.1 — Clasificación de origen (fragmento SQL reutilizable)

Definir una constante privada en `KpiService`:

```ts
const ORIGIN_CASE = `
  CASE
    WHEN metadata->>'attribution' = 'COMERCIAL' THEN 'COMERCIAL'
    WHEN metadata->>'attribution' = 'MARKETING' THEN 'MARKETING'
    WHEN closer_id IS NOT NULL THEN 'COMERCIAL'
    ELSE 'MARKETING'
  END`;
```

### A.2 — Consulta `rawOrigins` (volumen + bruta por origen)

Tras `rawGlobal`, añadir:

```ts
const rawOrigins = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
  `
  SELECT ${ORIGIN_CASE} AS origin,
         COUNT(*) AS ventas,
         SUM(amount) AS facturacion
  FROM sales.sales
  WHERE project_id = $1::uuid
    AND status IN ('APPROVED','PURCHASE_APPROVED','COMPLETE','PURCHASE_COMPLETE','APROBADO','COMPLETA','COMPLETO')
    ${mvFilter.sql}
  GROUP BY origin
  `,
  ...mvParams
);
```

Con esto: `comercial.ventas/bruta` y `marketing.ventas/bruta`.

### A.3 — `facturacionNeta` por origen

La neta ya se calcula con `findGroupForProduct` + `splitProductRevenue` sobre `productRows`. Para desglosarla:

- Añadir una consulta `rawOriginProducts` que agrupe por `(origin, product_name, product_id)` con `SUM(amount)`
  (mismo WHERE de aprobados + `mvFilter`), usando `ORIGIN_CASE` en el `GROUP BY`.
- Calcular:
  ```ts
  let netaComercial = 0;
  for (const row of originProductRows) {
    const matchingGroup = findGroupForProduct(groups, row, idToName);
    const split = splitProductRevenue(row.facturacion, matchingGroup, 0, 0);
    if (row.origin === 'COMERCIAL') netaComercial += split.net;
  }
  const netaMarketing = facturacionNeta - netaComercial;
  ```
  (o sumar `split.net` para `MARKETING` por separado; ambas deben coincidir salvo redondeo).

### A.4 — Respuesta: campo `origins`

Añadir al `return` (sin tocar `kpis`):

```ts
origins: {
  comercial: {
    ventas: comercialVentas,          // de rawOrigins
    facturacionBruta: comercialFacturacion, // de rawOrigins
    facturacionNeta: netaComercial,
  },
  marketing: {
    ventas: marketingVentas,
    facturacionBruta: marketingFacturacion,
    facturacionNeta: netaMarketing,
  },
},
```

> `comercialVentas`/`marketingVentas`/`comercialFacturacion`/`marketingFacturacion` salen de `rawOrigins`
> (no de las columnas de la MV, que son `closer_id`-based y ya no alinean con F3). Las variables
> `comparatives.teams` pueden seguir derivando de `origins` para consistencia.

## Parte B — Frontend (`DashboardView.tsx`)

1. Extender `DashboardPayload` con `origins: { comercial: OriginSplit; marketing: OriginSplit }`
   donde `OriginSplit = { ventas: number; facturacionBruta: number; facturacionNeta: number }`.
2. Renderizar un bloque "Comercial vs Marketing" (reusando `Comparatives.tsx` o un bloque nuevo) que muestre,
   por equipo, **volumen**, **bruta** y **neta**.
3. Mantener los 4 estados de UI. Sin componentes inventados (solo shadcn/ui + Tailwind + Lucide).

---

## Parte C — Mini-fix: pipeline 20 tarjetas por etapa

**C.1 — Contratos** (`packages/contracts/src/sales/sales.ts`): subir el techo de `limit` en `ListFiltersSchema`
de `max(100)` a `max(500)`.

**C.2 — Frontend** (`apps/web/src/app/admin/projects/[id]/page.tsx`, `loadLeads` ~línea 480): reemplazar

```ts
leadParams.set('limit', '50');
```

por un límite por etapa:

```ts
leadParams.set('limit', String(Math.max(20 * Math.max(pipelineStages.length, 1), 50)));
```

> El kanban ya hace `stageLeads.slice(0, 20)` por etapa; este cambio asegura que se carguen suficientes leads
> para llenar 20 en cada etapa (antes el `limit=50` global dejaba etapas incompletas).

---

## Restricciones y límites

- **Sin migración Prisma**: F2 y mini-fix son solo código.
- **`any` prohibido** (strict). Tipar `origins` y los nuevos estados.
- **No tocar** F0 (`refreshMetricsViews`, `normalize-sale-status`), F3 (`resolveAttribution`/`computeBackfillAttribution`),
  ni los endpoints de F1 (salvo el techo de `limit`, que es aditivo).
- **Frontera de módulo:** `kpi` sigue leyendo `sales.sales`/MVs por SQL como hoy.
- La MV sigue siendo `closer_id`-based; **no** se modifica la MV en F2 (se calcula en el servicio).

## Criterio de aceptación (→ `tests.md`)

- `GET /kpi/project/:projectId/dashboard` devuelve `origins.comercial` y `origins.marketing` con los 3 KPIs.
- Consistencia: `comercial + marketing == total` para volumen, bruta y neta.
- El pipeline muestra hasta 20 tarjetas por etapa.
- `make check` en verde.
