# Work/instructions.md — Fase F1

> **Fase:** F1 — Filtros, paginación y contadores de listados (req 1, 3, 7, 11, 12).
> **Referencia:** `Work/plan.md` (F1) — verificado contra `sales.controller.ts`, `sales.service.ts`,
> `kpi.controller.ts`, `kpi.service.ts`, `packages/contracts` y las vistas del frontend.
> **Ejecutor:** Antigravity (una entrega a la vez, en orden). Opencode audita al final de cada entrega.

## Cómo ejecutar (entregas)

F1 se divide en **5 entregas secuenciales**. Antigravity implementa **una entrega a la vez**; David valida su
verificación y pasa a la siguiente. No se avanza a la entrega N+1 sin que la entrega N pase su "Verificar".

| # | Entrega | Qué | Rompe frontend? |
|---|---|---|---|
| 1 | Contratos | `ListFiltersSchema` + `Paginated<T>` | No (aditivo) |
| 2 | Helpers puros + tests | `core/sales/list-filters.ts` + `test/verify-list-filters.ts` | No (aditivo) |
| 3 | Backend sales | `listSales`/`listTransactions`/`listLeads` + controller | **Sí** (hasta Entrega 5) |
| 4 | Backend dashboard | filtro `day`/`from`/`to` en kpi | No |
| 5 | Frontend | consumir envelope + filtros + paginación + contador | — (repara Entrega 3) |

---

## Decisiones de diseño (innegociables, aplican a todas las entregas)

1. **Envelope de respuesta paginada.** Los 3 endpoints de listado devuelven:
   ```ts
   { items: T[], total: number, pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor } }
   ```
   `total` se calcula con los **mismos filtros** que `items` (sin el predicado de cursor).
2. **Paginación keyset** sobre `(createdAt DESC, id DESC)`. Cursor = `base64url(ISO(createdAt)|id)`.
   Se pide `limit + 1` filas para calcular `hasNextPage`; `endCursor` = cursor de la última fila devuelta.
3. **Filtro de origen (F3).** `comercial` = `closer_id IS NOT NULL` **OR** `metadata.attribution = 'COMERCIAL'`;
   `marketing` = complemento (`closer_id IS NULL` **AND NOT** `metadata.attribution = 'COMERCIAL'`).
4. **Fecha:** `day` o `from`/`to` (rango inclusivo), sobre `created_at` (listados) y `kpi_date`/`created_at::date`
   (dashboard). `day`/`from`/`to` tienen prioridad sobre `period`.
5. **Fuente única de verdad:** el `whereClause` se construye en funciones puras (`core/sales/list-filters.ts`),
   reutilizadas por el listado y por el `count`.

---

## Entrega 1 — Contratos

**Objetivo:** añadir el schema de filtros y el envelope paginado al paquete compartido.

**Archivos:** `packages/contracts/src/sales/sales.ts`

**Cambios:** agregar al final del archivo:

```ts
export const OriginFilterEnum = z.enum(['marketing', 'comercial', 'todos']);

export const ListFiltersSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  origin: OriginFilterEnum.default('todos'),
  productId: z.string().optional(),
  closerId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListFilters = z.infer<typeof ListFiltersSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}
```

**Verificar:** `pnpm typecheck` (el paquete compila y los exports se resuelven en `index.ts` vía `export *`).

---

## Entrega 2 — Helpers puros + tests unitarios

**Objetivo:** crear la capa pura de filtros/cursor y sus tests, sin tocar servicios todavía.

**Archivos:**
- `apps/api/src/core/sales/list-filters.ts` (nuevo)
- `apps/api/src/core/sales/index.ts` (re-exportar)
- `apps/api/test/verify-list-filters.ts` (nuevo)
- `apps/api/package.json` (script `test:list-filters`)

**Cambios — `list-filters.ts`:**

```ts
import { Prisma } from '@prisma/client';
import type { ListFilters } from '@gs/contracts';

export type OriginFilter = 'marketing' | 'comercial' | 'todos';

// ── Cursor keyset (createdAt DESC, id DESC) ────────────────────────────────
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}
export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.lastIndexOf('|');
    if (sep < 0) return null;
    const d = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (Number.isNaN(d.getTime()) || !id) return null;
    return { createdAt: d, id };
  } catch {
    return null;
  }
}

// ── Rango de fechas (genérico, aplicar a createdAt o updatedAt) ─────────────
export function buildDateRange(day?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  const gte = from ?? day;
  if (!gte) return undefined;
  const gteDate = new Date(`${gte}T00:00:00.000Z`);
  const lt = to ?? day;
  const ltDate = new Date(`${lt}T23:59:59.999Z`);
  return { gte: gteDate, lt: ltDate };
}

// ── Filtro de origen (F3) ──────────────────────────────────────────────────
export function buildOriginClause(origin: OriginFilter): Prisma.SaleWhereInput | undefined {
  if (origin === 'todos') return undefined;
  const attrComercial: Prisma.SaleWhereInput = {
    metadata: { path: ['attribution'], equals: 'COMERCIAL' },
  };
  if (origin === 'comercial') {
    return { OR: [{ closerId: { not: null } }, attrComercial] };
  }
  return { AND: [{ closerId: null }, { NOT: attrComercial }] };
}

// ── whereClause de ventas/transacciones ────────────────────────────────────
const APPROVED = ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];

export interface SaleWhereOptions {
  role?: string;
  userId?: string;
  /** true para listSales (solo aprobadas por defecto); false para listTransactions (todos los estados). */
  approvedOnly?: boolean;
}

export function buildSaleWhereClause(
  projectId: string,
  filters: ListFilters,
  options: SaleWhereOptions = {}
): Prisma.SaleWhereInput {
  const and: Prisma.SaleWhereInput[] = [{ projectId }];

  if (options.role === 'CLOSER' && options.userId) {
    and.push({ closerId: options.userId });
  }

  if (options.approvedOnly && !filters.status) {
    and.push({ status: { in: APPROVED, mode: 'insensitive' } });
  } else if (filters.status) {
    and.push({ status: { equals: filters.status, mode: 'insensitive' } });
  }

  if (filters.productId) and.push({ productId: filters.productId });
  if (filters.closerId) and.push({ closerId: filters.closerId });

  const origin = buildOriginClause(filters.origin);
  if (origin) and.push(origin);
  const range = buildDateRange(filters.day, filters.from, filters.to);
  if (range) and.push({ createdAt: range });

  return and.length === 1 ? and[0] : { AND: and };
}

// ── whereClause de leads ───────────────────────────────────────────────────
export interface LeadWhereOptions {
  role?: string;
  userId?: string;
}

export function buildLeadWhereClause(
  projectId: string,
  filters: ListFilters,
  options: LeadWhereOptions = {}
): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [{ projectId }];

  if (options.role === 'CLOSER' && options.userId) {
    and.push({
      OR: [
        { closerId: options.userId },
        { sales: { some: { closerId: options.userId } } },
      ],
    });
  }

  if (filters.closerId) {
    and.push({
      OR: [
        { closerId: filters.closerId },
        { sales: { some: { closerId: filters.closerId } } },
      ],
    });
  }

  if (filters.productId) {
    and.push({ sales: { some: { productId: filters.productId } } });
  }

  if (filters.status) {
    and.push({ sales: { some: { status: { equals: filters.status, mode: 'insensitive' } } } });
  }

  const comercialSale: Prisma.SaleWhereInput = {
    OR: [{ closerId: { not: null } }, { metadata: { path: ['attribution'], equals: 'COMERCIAL' } }],
  };
  if (filters.origin === 'comercial') {
    and.push({ OR: [{ closerId: { not: null } }, { sales: { some: comercialSale } }] });
  } else if (filters.origin === 'marketing') {
    and.push({ AND: [{ closerId: null }, { NOT: { sales: { some: comercialSale } } }] });
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          sales: {
            some: {
              OR: [
                { externalTxnId: { contains: q, mode: 'insensitive' } },
                { externalOrderId: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  const range = buildDateRange(filters.day, filters.from, filters.to);
  if (range) and.push({ updatedAt: range });

  return and.length === 1 ? and[0] : { AND: and };
}
```

**Cambios — `index.ts`:** añadir `export * from './list-filters';`

**Cambios — `package.json`:** script `"test:list-filters": "tsx test/verify-list-filters.ts"`.

**Cambios — `verify-list-filters.ts`:** implementar T1–T3 de `tests.md` (Zod de `ListFiltersSchema`,
`buildOriginClause`, `buildDateRange`, `buildSaleWhereClause`, `buildLeadWhereClause`, roundtrip de cursor).

**Verificar:** `pnpm --filter api test:list-filters` (debe imprimir `verify-list-filters: OK`) + `pnpm typecheck`.

---

## Entrega 3 — Backend sales (service + controller)

**Objetivo:** aplicar filtros + paginación keyset + envelope en los 3 listados. **Rompe el frontend** (que hoy
lee `Array.isArray`); no desplegar sin la Entrega 5.

**Archivos:** `apps/api/src/modules/sales/sales.service.ts`, `apps/api/src/modules/sales/sales.controller.ts`

### 3.1 — `listSales(projectId, filters, user)`

```ts
async listSales(projectId: string, filters: ListFilters, user?: { id: string; role: string })
```
- `whereClause = buildSaleWhereClause(projectId, filters, { role: user?.role, userId: user?.id, approvedOnly: true })`.
- Keyset: si `filters.cursor`, decodificar y fusionar (vía `AND`) el predicado:
  `OR: [ { createdAt: { lt: cur.createdAt } }, { AND: [{ createdAt: cur.createdAt }, { id: { lt: cur.id } }] } ]`.
- `take: filters.limit + 1`, `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`, mismo `select` actual
  (conservar `id` y `createdAt` para el cursor).
- `const hasNext = rows.length > filters.limit; const items = hasNext ? rows.slice(0, filters.limit) : rows;`
- `const total = await this.prisma.sale.count({ where: whereClause });` (sin cursor).
- Enriquecer `items` igual que hoy y devolver:
  ```ts
  return {
    items: enriched,
    total,
    pageInfo: {
      hasNextPage: hasNext,
      hasPreviousPage: !!filters.cursor,
      startCursor: items.length ? encodeCursor(items[0].createdAt, items[0].id) : null,
      endCursor: items.length ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id) : null,
    },
  };
  ```
  > Para el cursor necesitas el `createdAt` (Date) e `id` de cada fila en el resultado mapeado. Si el mapeo actual
  serializa `createdAt` a ISO string, guarda también el `Date` interno para `encodeCursor`.

### 3.2 — `listTransactions(projectId, filters)`

Igual que 3.1 pero `approvedOnly: false` (todos los estados) y **sin** filtro CLOSER (ya bloqueado en el
controlador). Mismo `select`, enriquecimiento y envelope.

### 3.3 — `listLeads(projectId, filters, user)`

- Reemplazar firma `(projectId, user, search)` → `(projectId, filters, user)`.
- `whereClause = buildLeadWhereClause(projectId, filters, { role: user?.role, userId: user?.id })`.
- Keyset sobre `(updatedAt DESC, id DESC)` (mismo patrón que 3.1, cambiando `createdAt` por `updatedAt`).
- `total = await this.prisma.lead.count({ where: whereClause })` (sin cursor).
- Devolver `{ items, total, pageInfo }` con el mapping por lead actual (no tocar el resto).

### 3.4 — Controlador

Bindear y validar con Zod en los 3 `@Get`:

```ts
@Get('project/:projectId')
async listProjectSales(@Param('projectId') projectId: string, @Query() query: Record<string, string>, @Request() req: { user: JwtPayload }) {
  const parsed = ListFiltersSchema.safeParse(query);
  if (!parsed.success) throw new BadRequestException(parsed.error.errors);
  return this.salesService.listSales(projectId, parsed.data, { id: req.user.sub, role: req.user.role });
}
```
- `/transactions`: igual, pasar `parsed.data` (mantener el guard de CLOSER con `ForbiddenException`).
- `/leads`: quitar `@Query('search')`; usar `parsed.data` (que ya incluye `search`).
- Importar `ListFiltersSchema` desde `@gs/contracts`.

**Verificar:** `pnpm typecheck` + `pnpm --filter api lint`. (Los tests unitarios de la Entrega 2 siguen en verde.)

---

## Entrega 4 — Backend dashboard (kpi)

**Objetivo:** filtro por día/rango en el dashboard. No rompe nada (aditivo).

**Archivos:** `apps/api/src/modules/kpi/kpi.controller.ts`, `apps/api/src/modules/kpi/kpi.service.ts`

### 4.1 — Controlador

```ts
@Get('project/:projectId/dashboard')
async getDashboardMetrics(
  @Param('projectId') projectId: string,
  @Query('period') period?: string,
  @Query('day') day?: string,
  @Query('from') from?: string,
  @Query('to') to?: string,
  @Request() req?: { user: JwtPayload },
) {
  return this.kpiService.getProjectDashboardMetrics(projectId, period, req?.user?.role, { day, from, to });
}
```

### 4.2 — Servicio

- Extender `getProjectDashboardMetrics(projectId, period, role, filters: { day?, from?, to? })`.
- Helper privado `buildDateFilterSql(column: 'kpi_date' | 'created_at::date', periodDays, filters, startParam: number)`
  que devuelva `{ sql, params }` con prioridad:
  - `day` → `AND ${column} = $n::date`
  - `from` + `to` → `AND ${column} BETWEEN $n::date AND $m::date`
  - `from` solo → `AND ${column} >= $n::date`
  - `to` solo → `AND ${column} <= $n::date`
  - si no hay day/from/to → `period` actual (`AND ${column} >= CURRENT_DATE - $n`)
- Reemplazar la lógica de `dateFilterSql`/`params` (líneas ~43–46) por este helper y usarlo en las 5 consultas
  raw (`rawGlobal`, `rawProducts`, `rawCommercialProducts`, `rawChart`, `rawClosers`). Columna `kpi_date` para MVs
  y `created_at::date` para `rawCommercialProducts`. Mantener orden `[projectId, ...dateParams]`.
- Validar `day`/`from`/`to` con regex `^\d{4}-\d{2}-\d{2}$` (reutilizable de `ListFiltersSchema`).

**Verificar:** `pnpm typecheck` + `pnpm --filter api lint`.

---

## Entrega 5 — Frontend

**Objetivo:** consumir el envelope, añadir filtros + contador + paginación al inicio de la tabla, y el selector
de día en el dashboard. Repara la rotura de la Entrega 3.

**Archivos:**
- `apps/web/src/components/admin/projects/TransactionsView.tsx`
- `apps/web/src/components/admin/projects/SalesView.tsx`
- `apps/web/src/app/admin/projects/[id]/page.tsx` (base de leads)
- `apps/web/src/components/admin/projects/DashboardView.tsx`

### 5.1 — `TransactionsView.tsx` y `SalesView.tsx`

- Leer `data.items` en `loadTransactions`/`loadSales`; guardar `total` y `pageInfo` en estado.
- **Barra de filtros** (arriba de la tabla): `Select` origen (marketing/comercial/todos), `Select` estado,
  `Select`/`Input` producto, `Select` closer y `Input type="date"` de día (o rango `from`/`to`). Cada cambio
  refresca con los query params y resetea a la primera página.
- Sustituir el filtro de búsqueda **cliente** por los filtros **servidor**.
- **Contador:** "Total de transacciones: {total}" / "Total de ventas: {total}".
- **Paginación al inicio de la tabla** (encima de `<Table>`): Anterior/Siguiente por `cursor`, usando
  `pageInfo.hasNextPage`/`hasPreviousPage`; mostrar página actual; deshabilitar según `pageInfo`.
- Reflejar filtros + cursor en la URL con `useSearchParams`/`useRouter`.
- Mantener los 4 estados (skeleton/empty/error/data). Empty: "No hay X con esos filtros".

### 5.2 — Base de leads (`admin/projects/[id]/page.tsx`)

- En `loadLeads` (líneas ~445–533): leer `data.items` de `/leads`, guardar `total` y `pageInfo` en estado.
- Añadir la misma barra de filtros (origen, producto, closer, estado, día) + contador "Total de leads: N" +
  paginación al inicio de la tabla de leads.
- No romper el mapeo de `sales`/`leads` (kanban) existente.

### 5.3 — `DashboardView.tsx`

- Añadir selector de día (`Input type="date"`) y/o rango (`from`/`to`) junto al `period` existente.
- Al elegir día/rango, llamar a `/kpi/project/:id/dashboard?day=...&from=...&to=...` (si hay día/rango se ignora
  `period`). Mantener `period` para el caso "sin fecha".

> **UI:** solo shadcn/ui (`Select`, `Input`, `Button`, `Badge`, `Table`, `Skeleton`) + Tailwind + Lucide. Tipar
> los estados (evitar `any[]` nuevos).

**Verificar:** `pnpm typecheck` + `pnpm lint` + verificación operativa de David (T4 de `tests.md`).

---

## Restricciones y límites (globales)

- **TypeScript `strict`**: `any` prohibido. En frontend, tipar estados nuevos.
- **Sin migración Prisma**: F1 es solo código (`metadata.attribution` ya existe).
- **Sin OFFSET**: paginación keyset obligatoria (AGENTS.md).
- **RLS / aislamiento:** CLOSER solo ve sus ventas/leads; `listTransactions` sigue cerrado a CLOSER.
- **Frontera de módulo:** `sales` consulta su propio schema; enriquecimiento de closers por
  `authService.getUsersByIds` (no tocar). `kpi` sigue leyendo MVs/`sales` por SQL como hoy.
- **No tocar** F0 (`refreshMetricsViews`, `normalize-sale-status`) ni F3 (`resolveAttribution`).
- **TSDoc** en lo exportado nuevo (`encodeCursor`, `decodeCursor`, `buildDateRange`, `buildOriginClause`,
  `buildSaleWhereClause`, `buildLeadWhereClause`, `ListFiltersSchema`).

## Criterio de aceptación (por entrega)

- **E1:** `ListFiltersSchema` compila y exporta; `pnpm typecheck` verde.
- **E2:** `test:list-filters` en verde (T1–T3).
- **E3:** `pnpm typecheck` + `api lint` verde; endpoints devuelven `{ items, total, pageInfo }`.
- **E4:** `pnpm typecheck` + `api lint` verde; dashboard acepta `day`/`from`/`to`.
- **E5:** `pnpm typecheck` + `pnpm lint` verde + T4 operativa de David en verde.
