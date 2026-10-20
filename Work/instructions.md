# Work/instructions.md — Fase F8

> **Fase:** F8 — Correcciones de UX: filtros globales, pipeline y rendimiento.
> **Referencia:** `Work/plan.md` (F8). Verificado contra `list-filters.ts`, `sales.service.ts`,
> `sales.controller.ts`, `page.tsx`, `SalesView.tsx`, `TransactionsView.tsx`.
> **Ejecución:** Antigravity implementa **en orden** F8.1 → F8.2 → F8.3 → F8.4 → F8.5 → F (pendientes).
> Si algo del plan falta, reportarlo en lugar de improvisar.

## Decisiones de diseño (leer primero)

- **Caché:** usar **SWR** (liviano). Key = `string` del endpoint con query; invalidación por prefijo.
- **Estado de filtros:** un único objeto `ProjectFilters` liftado a `page.tsx` y pasado por **props** a
  `SalesView`/`TransactionsView`. **No** usar Context (más simple; la página ya es el contenedor).
- **Centinela unificado de "sin asignar":** `closer === 'UNASSIGNED'` en frontend; en backend el parámetro
  `unassigned=true`. Eliminar los centinelas `"none"` / `"Por Asignar"`.
- **Calendario:** agregar `react-day-picker` + `date-fns` + los componentes shadcn `Calendar` y `Popover`.
- **Frontera de módulo:** `kpi` sigue intacto. `sales` solo toca su schema. Sin `any` nuevo.

---

## Parte A — F8.1 · Backend: filtros `unassigned` + `stage` y endpoint `/pipeline`

### A.1 — Contratos (`packages/contracts/src/sales/sales.ts`)

En `ListFiltersSchema` añadir dos campos opcionales (mantener `closerId` para closer concreto):

```ts
stage: z.string().optional(),
unassigned: z.coerce.boolean().optional(),
```

### A.2 — `apps/api/src/core/sales/list-filters.ts`

En `buildSaleWhereClause` (después del bloque de `closerId`, ~línea 86):

```ts
if (filters.unassigned) and.push({ closerId: null });
if (filters.stage) and.push({ pipelineStage: filters.stage });
```

En `buildLeadWhereClause` (después del bloque de `closerId`, ~línea 127):

```ts
if (filters.unassigned) {
  and.push({
    AND: [
      { closerId: null },
      { NOT: { sales: { some: { closerId: { not: null } } } } },
    ],
  });
}
if (filters.stage) and.push({ pipelineStage: filters.stage });
```

> TSDoc: "sin asignar" en leads = lead sin closer **y** sin ventas con closer; en ventas = `closer_id IS NULL`.

### A.3 — `apps/api/src/modules/sales/sales.service.ts`: extraer mapper + `listPipeline`

1. **Extraer** el mapeo inline de `listLeads` (líneas 1161–1262) a un método privado:

   ```ts
   private mapLeadToDto(
     lead: /* tipo Lead + includes: sales, interestedProducts */,
     projectProducts: Array<{ id: string; name: string }>
   ) { /* el mismo cuerpo que hoy va inline en listLeads, devolviendo el DTO */ }
   ```

   `listLeads` pasa a llamar `this.mapLeadToDto(lead, projectProducts)` (sin duplicar). El tipo del lead se
   puede tipar con `Prisma.LeadGetPayload<{ include: { sales: true; interestedProducts: true } }>`.

2. **Nuevo método** `listPipeline(projectId, filters, user)`:

   ```ts
   async listPipeline(projectId: string, filters: ListFilters, user?: { id: string; role: string }) {
     const empty = { stages: [], totalLeads: 0 };
     if (!this.prisma || !('lead' in this.prisma)) return empty;

     const whereClause = buildLeadWhereClause(projectId, filters, { role: user?.role, userId: user?.id });
     const totalLeads = await this.prisma.lead.count({ where: whereClause });

     const grouped = await this.prisma.lead.groupBy({
       by: ['pipelineStage'], where: whereClause, _count: { _all: true },
     });

     const project = await this.prisma.project.findUnique({
       where: { id: projectId }, select: { products: true },
     });
     const projectProducts = (project?.products as Array<{ id: string; name: string }>) || [];

     const stages = [];
     for (const g of grouped) {
       const stageId = g.pipelineStage;
       const rows = await this.prisma.lead.findMany({
         where: { ...whereClause, pipelineStage: stageId },
         include: { sales: { orderBy: { createdAt: 'desc' } }, interestedProducts: true },
         orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
         take: 20,
       });
       stages.push({ stageId, total: g._count._all, items: rows.map((l) => this.mapLeadToDto(l, projectProducts)) });
     }
     return { stages, totalLeads };
   }
   ```

   > El `total` por etapa sale de `groupBy` (conteo completo filtrado); `items` son las primeras 20 por etapa
   > (orden `updatedAt DESC, id DESC`, igual que `listLeads`). N+1 aceptable porque hay pocas etapas.

### A.4 — `apps/api/src/modules/sales/sales.controller.ts`: nuevo endpoint

```ts
@Get('project/:projectId/pipeline')
async listProjectPipeline(
  @Param('projectId') projectId: string,
  @Query() query: Record<string, string>,
  @Request() req: { user: JwtPayload }
) {
  const parsed = ListFiltersSchema.safeParse(query);
  if (!parsed.success) throw new BadRequestException(parsed.error.errors);
  return this.salesService.listPipeline(projectId, parsed.data, { id: req.user.sub, role: req.user.role });
}
```

> Colocarlo **antes** de `@Get('project/:projectId/products/:productId/sales-count')` no es necesario, pero sí
> antes de cualquier ruta que pueda capturar `pipeline` como `:leadId`. No hay conflicto con `:projectId`.

### A.5 — Tests

Extender `apps/api/test/verify-list-filters.ts` (ver `tests.md`).

**Terminado cuando (A):** `leads?unassigned=true` solo devuelve sin closer; `leads?stage=won` solo esa etapa;
`pipeline` devuelve `{ stages: [{stageId,total,items}], totalLeads }`; `make check` en verde.

---

## Parte B — F8.2 · Pipeline: 20 tarjetas por etapa + total en el encabezado

**Ámbito:** `apps/web/src/app/admin/projects/[id]/page.tsx` (kanban ~1907–2076).

1. Añadir estado `const [pipelineData, setPipelineData] = useState<{ stages: PipelineBucket[]; totalLeads: number }>()`.
   Definir `interface PipelineBucket { stageId: string; total: number; items: ProjectLead[] }`.
2. El kanban deja de leer `filteredBaseLeads` (línea 1908). Construir un `Map<stageId, PipelineBucket>` y,
   para cada `pipelineStages.map((stage) => ...)`, usar `bucket = map.get(stage.id)`:
   - Encabezado (badge ~línea 1949): `bucket?.total ?? 0` (no `stageLeads.length`).
   - Tarjetas (línea 1966): `bucket?.items ?? []` (ya limitadas a 20 en backend). Eliminar `slice(0, 20)`.
   - "+N ocultos" (líneas 2066–2070): si `(bucket?.total ?? 0) > (bucket?.items.length ?? 0)` mostrar
     `+ {(bucket.total - bucket.items.length)} prospectos ocultos`.
   - Total valor de etapa (`stageTotalVal`, ~1915): sumar `estimatedValue` de `bucket.items` (o mantener
     cálculo sobre las tarjetas visibles; confirmar consistencia con el total real solo si se decide mostrar
     suma filtrada completa — ver nota).
3. "Total Leads" del toolbar (línea 1899): usar `pipelineData.totalLeads` en lugar de `filteredBaseLeads.length`.
4. El badge de la pestaña Pipeline (línea 1757) sigue usando el total filtrado (`pipelineData.totalLeads`).

> **Nota de alcance:** `stageTotalVal` (suma $ por etapa) hoy se calcula sobre las tarjetas visibles. El
> requisito de David solo pide el **número** total por etapa; mantener la suma sobre `bucket.items` (visibles)
> es aceptable en F8.2 y evita otro agregado.

**Terminado cuando (B):** cada etapa muestra ≤20 tarjetas y su total real en el encabezado; el total solo
cambia al aplicar filtro; mover un lead actualiza origen/destino (vía invalidación de F8.4).

---

## Parte C — F8.3 · Sidebar global de filtros + selector de calendario

### C.1 — Tipo y builder compartidos (`apps/web/src/lib/project-filters.ts`, nuevo)

```ts
export interface ProjectFilters {
  search: string;
  origin: 'todos' | 'comercial' | 'marketing';
  status: string;      // 'ALL' = sin filtro
  productId: string;   // 'ALL' = sin filtro
  closer: string;      // 'ALL' | 'UNASSIGNED' | uuid
  stage: string;       // 'ALL' = sin filtro
  day: string;         // '' = sin filtro (YYYY-MM-DD)
  from: string;        // '' = sin filtro (YYYY-MM-DD)
  to: string;          // '' = sin filtro (YYYY-MM-DD)
}
export const DEFAULT_FILTERS: ProjectFilters = { search:'', origin:'todos', status:'ALL', productId:'ALL', closer:'ALL', stage:'ALL', day:'', from:'', to:'' };

export function buildFilterQuery(f: ProjectFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.origin !== 'todos') p.set('origin', f.origin);
  if (f.status !== 'ALL') p.set('status', f.status);
  if (f.productId !== 'ALL') p.set('productId', f.productId);
  if (f.closer === 'UNASSIGNED') p.set('unassigned', 'true');
  else if (f.closer !== 'ALL') p.set('closerId', f.closer);
  if (f.stage !== 'ALL') p.set('stage', f.stage);
  if (f.day) p.set('day', f.day);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.search.trim()) p.set('search', f.search.trim());
  return p;
}

export function hasActiveFilters(f: ProjectFilters): boolean { /* true si difiere de DEFAULT_FILTERS */ }
```

### C.2 — Componente `<ProjectFilterSidebar>` (nuevo)

Fichero: `apps/web/src/components/admin/projects/ProjectFilterSidebar.tsx`.

Props: `filters: ProjectFilters`, `onChange: (f: ProjectFilters) => void`, y las opciones:
`stages: PipelineStageConfig[]`, `closers: Array<{ id: string; name: string }>`, `products: Array<{ id: string; name: string }>`, `isCloser: boolean`.

Contenido (izquierda, columna fija `w-64`):
- **Búsqueda** (`search`).
- **Closer** (Select): "Todos" (`ALL`), "Por asignar" (`UNASSIGNED`), y cada closer (`id`). Oculto si `isCloser`.
- **Etapa** (Select): "Todas" (`ALL`) + cada `stages` (`id`).
- **Origen** (Select): todos/comercial/marketing.
- **Estado** (Select): ALL/APPROVED/COMPLETE/PENDING/REFUNDED/CANCELED (mismos valores que hoy).
- **Producto** (Select): ALL + `products`.
- **Fecha** (selector de calendario, ver C.3).
- Botón **"Limpiar filtros"** (visible si `hasActiveFilters`).

### C.3 — Selector de fecha (calendario)

1. Agregar dependencias: `react-day-picker`, `date-fns`; crear `apps/web/src/components/ui/calendar.tsx` y
   `apps/web/src/components/ui/popover.tsx` (estándar shadcn).
2. Un `Popover` con dos modos **mutuamente excluyentes**:
   - **"Día específico"**: selecciona `day` (un `Calendar` mode `single`).
   - **"Rango"**: selecciona `from`/`to` (mode `range`).
   - Un toggle/radio decide el modo; al elegir "día" se limpian `from`/`to` y se deshabilitan; al elegir
     "rango" se limpia `day` y se deshabilita. El valor se muestra como texto resumido dentro del trigger
     (p. ej. "15/10/2026" o "10–15 oct 2026"), nunca como `<input type="date">` crudo.

### C.4 — Integración en `page.tsx`

1. Sustituir los estados sueltos (`leadSearch`, `leadOriginFilter`, `leadStatusFilter`, `leadProductFilter`,
   `closerFilter`, `stageFilter`, `leadDayFilter`) por un solo `const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_FILTERS)`.
2. Renderizar `<ProjectFilterSidebar>` a la izquierda de las vistas (layout `flex`), visible en
   `pipeline | leads | sales | transactions`; **oculto** en `metrics | settings`.
3. Eliminar las barras de filtros de: pipeline (toolbar ~1844–1903), base de leads (~2086–2283).
4. Sincronizar a URL (query params) en **un solo punto**: `useEffect` que escriba `router.replace`/`history`
   con `buildFilterQuery(filters)` al cambiar `filters` (preservando enlazar/compartir).
5. `handleMoveLeadStage`, `handleCreateLead` y el resto de mutaciones usan el nuevo `filters` (o invalidan
   caché, F8.4).

### C.5 — `SalesView.tsx` y `TransactionsView.tsx`

- Añadir prop `filters: ProjectFilters` y eliminar el estado local de filtros (`originFilter`, `statusFilter`,
  `productFilter`, `closerFilter`, `dayFilter`, `searchTerm`) y su `window.history.replaceState`.
- Construir la query con `buildFilterQuery(filters)` para su fetch (en F8.4 pasará a `useSWR`).
- Eliminar sus toolbars de filtros (la UI vive ahora en el sidebar). Mantener sus botones de acción
  (importar, agregar venta, refrescar solo si aplica).

**Terminado cuando (C):** una sola barra lateral izquierda compartida entre las 4 pestañas; métricas sin
sidebar; calendario con día ↔ rango excluyentes; los filtros persisten entre pestañas y van a la URL.

---

## Parte D — F8.4 · Rendimiento: carga diferida y recarga dinámica

1. Agregar dependencia `swr`. Crear `apps/web/src/lib/swr-fetcher.ts`:

   ```ts
   export const jsonFetcher = async (url: string) => {
     const res = await fetchWithAuth(url);
     if (!res.ok) throw new Error(`Error ${res.status}`);
     return res.json();
   };
   ```

2. **Pipeline** (`page.tsx`): `const pipelineKey = `/sales/project/${projectId}/pipeline?${buildFilterQuery(filters)}``;
   `const { data: pipelineData, mutate: mutatePipeline } = useSWR(pipelineKey, jsonFetcher, { keepPreviousData: true })`.
   Eliminar el fetch monolítico de `loadLeads` para pipeline.

3. **Base de leads** (`page.tsx`): `const leadsKey = `/sales/project/${projectId}/leads?${buildFilterQuery(filters)}&limit=25&cursor=...``
   con `useSWR`. La paginación keyset actual (cursor/stack) se preserva añadiendo `cursor` a la key.

4. **Ventas / Transacciones** (`SalesView`/`TransactionsView`): `useSWR` con keys
   `/sales/project/${projectId}` y `/sales/project/${projectId}/transactions` + `buildFilterQuery(filters)`.
   Se cargan **solo al montar** cada vista (pestaña activa); dejar de fetchear al arranque si la pestaña
   activa es `metrics`/`settings`.

5. **Invalidación tras mutaciones.** Helper común `invalidateSales(projectId, mutateGlobal)` que llama:
   `mutateGlobal((k) => typeof k === 'string' && k.startsWith('/sales/project/' + projectId))`.
   Invocarlo al terminar: `handleMoveLeadStage`, `handleCreateLead`, `updateLead`, registrar/editar venta,
   `updateTransactionStatus`, importar CSV (leads y ventas). Con esto las vistas se recargan solas.

6. **Sin reload completo:** verificar que el cambio de pestaña usa `setMainView` (ya) y no hay
   `window.location`/`router.push` para cambiar de vista; la recarga de datos no remonta el árbol completo.

7. **Tipado:** eliminar los `any` introducidos en el refactor (`leadsList`, `sale`, mapeos). Usar
   `SaleListItem`/`ProjectLead` de contratos y el tipo del DTO de leads.

**Terminado cuando (D):** cambiar de pestaña no refetchea lo cacheado; tras mutar (mover/crear/editar/importar)
las vistas afectadas se actualizan solas; el arranque no dispara las 3 consultas si la pestaña activa es
métricas; `make check` en verde y sin `any` nuevo.

---

## Parte E — F8.5 · UX de layout: sidebar de filtros colapsable + padding reducido

**Objetivo:** que el sidebar de filtros quede a la izquierda y sea **colapsable**, y reducir el padding /
ancho máximo del contenido de proyectos para que el pipeline y las demás pestañas se vean **sin scroll
horizontal**.

**Contexto actual (verificado en el código):**
- `AdminShell` (`apps/web/src/components/layout/admin-shell.tsx`) envuelve TODO el contenido en:
  - `<main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#090A0F] relative">` (línea 482).
  - `<div className="max-w-7xl mx-auto space-y-6 relative z-10">` (línea 486).
  El `max-w-7xl` (1280px) + el padding son los que fuerzan el scroll horizontal del kanban.
- `ProjectFilterSidebar` (`apps/web/src/components/admin/projects/ProjectFilterSidebar.tsx`) hoy es
  `<aside className="w-64 shrink-0 flex flex-col gap-4 border-r border-border/60 pr-4">`, sin toggle.
- `page.tsx` monta el layout `<div className="flex gap-4 items-start pt-2">` con el sidebar + contenido.

### E.1 — Sidebar de filtros colapsable

1. En `ProjectFilterSidebar.tsx` añadir estado `const [collapsed, setCollapsed] = useState(false)` y
   persistir en `localStorage` (clave `gs_filters_sidebar_collapsed`), igual que hace `AdminShell` con
   `gs_sidebar_expanded` (leer en `useEffect`, escribir en el toggle).
2. En el encabezado del sidebar (bloque "Filtros") añadir un botón de toggle con icono
   `PanelLeftClose` / `PanelLeftOpen` (o `ChevronLeft`/`ChevronRight` de lucide).
3. Comportamiento:
   - **Expandido:** ancho `w-64` (como hoy).
   - **Colapsado:** ancho `w-12` (solo la franja con el botón para re-expandir; ocultar los campos).
   - Transición `transition-all duration-200`.
4. Mantenerlo SIEMPRE a la izquierda (orden: sidebar → contenido, como ya está).

### E.2 — Padding y ancho del contenido de proyectos

1. Añadir a `AdminShellProps` un flag opcional, p. ej. `fluid?: boolean` (o `contentClassName?: string`).
2. En el `<main>` y en el `<div>` interior, aplicar condicionalmente cuando `fluid` sea true:
   - `<main className="flex-1 overflow-y-auto p-3 md:p-4 ...">` (padding menor; no `p-6 md:p-8`).
   - `<div className="w-full space-y-6 relative z-10">` (sin `max-w-7xl mx-auto`; full-width).
   - Si no `fluid`, conservar los valores actuales (no romper el resto de páginas admin).
3. En `page.tsx` (proyectos) pasar `fluid` al `<AdminShell>` para que el contenido ocupe todo el ancho con
   menos padding.
4. El kanban (VISTA 1) ya usa `overflow-x-auto`; con `fluid` + sidebar colapsable debe caber completo en
   pantallas normales. Si aun así hay desborde por muchas etapas, se mantiene el scroll del propio kanban
   como fallback (no del `<main>`).

### E.3 — Verificación

- Colapsar/expandir el sidebar de filtros funciona y **persiste** entre recargas (localStorage).
- Con el sidebar colapsado + `fluid`, el pipeline y las pestañas se ven sin scroll horizontal innecesario.
- El resto de páginas admin (usuarios, analytics, etc.) conservan su padding/ancho actual (solo cambia
  proyectos).

**Terminado cuando (E):** sidebar de filtros colapsable a la izquierda; proyectos usa `fluid` (padding
reducido + full-width); las demás páginas admin intactas; `make check` en verde.

---

## Parte F — Pendientes consolidados (para Antigravity)

Además de F8.1–F8.5, quedan estos puntos por **cerrar y verificar**. Antigravity debe ejecutarlos y, al
terminar, correr `make check`, reconstruir `api`/`web` y dejar la rama lista para commit.

### F.1 — Completar el caché SWR en la base de leads (`page.tsx`)

La tabla de leads hoy se carga con un `loadLeads` monolítico. Convertir a SWR (Parte D.3):

1. Clave: `/sales/project/${projectId}/leads?${buildFilterQuery(filters)}&cursor=${leadsCursor}&limit=50`
   (para CLOSER, borrar `closerId` y `unassigned` de la query antes de construir la clave).
2. `const { data: leadsData } = useSWR<LeadsListResponse>(leadsKey, jsonFetcher, { keepPreviousData: true })`.
3. Sincronizar en `useEffect`: `setBaseLeads(mappedLeads)`, `setLeadsTotal`, `setLeadsPageInfo` (el mapper
   de lead DTO → `ProjectLead` ya existe; reutilizarlo).
4. Los datos auxiliares (`/sales` para "Facturación Ganada" y `/transactions` para los modales) también van
   con `useSWR` (claves `/sales/project/:id` y `/sales/project/:id/transactions`), con sus `useEffect` de sync.
5. Eliminar el `useCallback loadLeads` y reemplazar sus llamadas (`loadLeads()`) por `invalidateSalesData()`
   (que ya revalida por prefijo `/sales/project/:id`). Revisar `onDataChange={loadLeads}` en `<SalesView>`.

### F.2 — Verificación de los cambios SWR ya aplicados

En la rama actual ya están convertidos a SWR `SalesView.tsx` y `TransactionsView.tsx` (y la base de leads en
parte). Antigravity debe:
- Correr `pnpm typecheck` y `pnpm lint` y **corregir cualquier error** de tipos/lint de esos archivos.
- Confirmar que no quedan referencias a `loadSales`/`loadTransactions`/`loadLeads` ni imports sin usar.

### F.3 — F8.5 (Parte E)

Sidebar de filtros colapsable + padding/ancho `fluid` en proyectos. Ver Parte E.

### F.4 — Cierre

- [ ] `make check` en verde (lint + typecheck + tests).
- [ ] Reconstruir contenedores: `docker compose up -d --build --force-recreate api web`.
- [ ] Reportar en `correcciones.md` el detalle de lo entregado.

**Terminado cuando (F):** la base de leads usa SWR (cacheada e invalidable), sin `loadLeads` monolítico;
`make check` verde; contenedores reconstruidos; F8.5 implementado y verificado.

---

## Restricciones y límites

- **Sin migración Prisma** (los filtros `stage`/`unassigned` usan columnas ya existentes).
- **No tocar** F0/F3/F3.1/F1/F2 (salvo añadir campos a `ListFiltersSchema` y a los where-builders, que es
  aditivo). **No tocar** `kpi`.
- **`any` prohibido** (strict). Sin secretos/PII en logs.
- `SalesView`/`TransactionsView` conservan su contrato de props existente salvo el añadido `filters` y la
  retirada de su estado interno de filtros.
- TSDoc en lo exportado (`ProjectFilters`, `buildFilterQuery`, `listPipeline`, endpoint, componente sidebar).

## Criterio de aceptación (→ `tests.md`)

- Filtros "Por Asignar" y "Etapa" funcionan (backend + frontend).
- Calendario con día ↔ rango excluyentes.
- Pipeline: 20 tarjetas por etapa + total real en encabezado.
- Sidebar global a la izquierda, compartido entre pipeline/leads/ventas/transacciones (no métricas).
- Sidebar de filtros colapsable (persistido en localStorage) + proyectos con `fluid` (padding reducido y full-width).
- Carga diferida + recarga dinámica + caché.
- `make check` en verde.
