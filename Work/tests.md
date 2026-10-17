# Work/tests.md — Fase F1

> **Fase:** F1 — Filtros, paginación y contadores de listados (req 1, 3, 7, 11, 12).
> **Estilo:** scripts de verificación `tsx test/verify-*.ts` (patrón del repo, no Jest/Vitest).
> **Referencia:** `Work/plan.md` (F1) y `Work/instructions.md`.

## Cómo se ejecutan

```bash
# Unit (función pura, sin BD)
pnpm --filter api test:list-filters

# Calidad global (DoD)
make check   # = pnpm lint + pnpm typecheck + pnpm test
```

---

## T1 — Unit: Zod de filtros (`ListFiltersSchema`)

**Archivo nuevo:** `apps/api/test/verify-list-filters.ts`
**Script nuevo:** `"test:list-filters": "tsx test/verify-list-filters.ts"` en `apps/api/package.json`

**Qué verifica:** `ListFiltersSchema` de `packages/contracts/src/sales/sales.ts`.

| Caso | Entrada | Esperado |
|---|---|---|
| defaults | `{}` | `origin='todos'`, `limit=25` |
| coerce limit | `{ limit: '10' }` | `limit=10` |
| día válido | `{ day: '2026-10-01' }` | éxito |
| día inválido | `{ day: '10/01/2026' }` | error |
| origen válido | `{ origin: 'comercial' }` | éxito |
| origen inválido | `{ origin: 'otro' }` | error |
| closer UUID válido | `{ closerId: '<uuid v4>' }` | éxito |
| closer inválido | `{ closerId: 'no-uuid' }` | error |
| limit fuera de rango | `{ limit: '1000' }` | error (max 100) |

---

## T2 — Unit: helpers de filtros (`core/sales/list-filters.ts`)

**Mismo archivo de test.** Verifica funciones puras:

**`buildOriginClause`:**
| origen | Predicado esperado |
|---|---|
| `todos` | `undefined` |
| `comercial` | `OR: [{ closerId: { not: null } }, { metadata: { path: ['attribution'], equals: 'COMERCIAL' } }]` |
| `marketing` | `AND: [{ closerId: null }, { NOT: { metadata: { path: ['attribution'], equals: 'COMERCIAL' } } }]` |

**`buildDateRange`:**
| Entrada | Esperado |
|---|---|
| `('2026-10-01', undefined, undefined)` | `{ gte: 2026-10-01T00:00Z, lt: 2026-10-01T23:59:59.999Z }` |
| `(undefined, '2026-10-01', '2026-10-31')` | `gte` día 01, `lt` día 31 fin |
| `(undefined, undefined, undefined)` | `undefined` |

**`buildSaleWhereClause`** (con `projectId` fijo):
| Opciones + filtros | Esperado |
|---|---|
| `approvedOnly: true`, sin `status` | `status.in` = whitelist APPROVED (insensitive) |
| `approvedOnly: true`, `status:'REFUNDED'` | `status.equals = 'REFUNDED'` (sin whitelist) |
| `approvedOnly: false` | sin predicado de estado (salvo `status`) |
| `role:'CLOSER', userId:'U'` | incluye `closerId = 'U'` |
| `closerId:'C'` | incluye `closerId = 'C'` |
| `productId:'P'` | incluye `productId = 'P'` |
| `origin:'comercial'` | incluye el OR de comercial |

**`buildLeadWhereClause`** (con `projectId` fijo):
| Opciones + filtros | Esperado |
|---|---|
| `role:'CLOSER', userId:'U'` | incluye `OR: [closerId='U', sales.some.closerId='U']` |
| `closerId:'C'` | incluye `OR: [closerId='C', sales.some.closerId='C']` |
| `productId:'P'` | incluye `sales.some.productId = 'P'` |
| `origin:'comercial'` | incluye `OR: [closerId != null, sales.some(comercialSale)]` |
| `search:'abc'` | incluye `OR` con name/email/phone/externalTxnId/externalOrderId `contains` |

---

## T3 — Unit: cursor keyset

**Mismo archivo de test.**

| Caso | Esperado |
|---|---|
| `decodeCursor(encodeCursor(d, id))` | roundtrip `{ createdAt, id }` igual al original (mismo instante) |
| `decodeCursor('no-valido')` | `null` |
| `decodeCursor(Buffer.from('hola').toString('base64url'))` | `null` (sin `\|` o fecha inválida) |

**Criterio de aceptación T1–T3:** el script termina con `verify-list-filters: OK` (exit 0).

---

## T4 — Verificación operativa (David, tras `correcciones.md`)

No automáticas; las ejecuta David sobre la plataforma con el dump de producción:

1. **Ventas:** filtrar por `closerId=X` solo devuelve ventas de X. Un CLOSER no puede pasar un `closerId` ajeno
   (se ignora / sigue viendo solo lo suyo).
2. **Origen:** filtro `comercial` incluye las ventas con closer y las "COMERCIAL sin closer" (`metadata.attribution
   = COMERCIAL`); filtro `marketing` las excluye. Coincide visualmente con el dashboard.
3. **Día:** dashboard con `day=YYYY-MM-DD` devuelve solo ese día; con `from`/`to` devuelve ese rango.
4. **Transacciones:** filtrar por producto, closer y estado devuelve los subconjuntos correctos.
5. **Paginación:** en transacciones y ventas, la navegación Anterior/Siguiente aparece **al inicio** de la tabla
   y recorre el listado sin repetir ni saltar filas.
6. **Contador:** "Total de transacciones/leads/ventas: N" refleja los filtros activos (N cambia al filtrar).
7. **URL:** los filtros + cursor se reflejan en el query string y se pueden compartir/enlazar.

---

## Trazabilidad con el plan F1 ("Terminado cuando")

| Criterio del plan | Cubierto por |
|---|---|
| Listado filtrado por closer solo devuelve lo suyo | T2 (whereClause) + T4 #1 |
| Dashboard acepta day/from/to | T4 #3 |
| Filtro origen usa clasificación F3 | T2 (origin) + T4 #2 |
| Paginación keyset sin OFFSET | T3 (cursor) + T4 #5 |
| Contador "Total de N" con filtros | T4 #6 + T2 (count = same whereClause) |
| Paginación al inicio de la tabla | T4 #5 |
| URL con filtros/cursor | T4 #7 |
| `make check` en verde | `pnpm lint` + `pnpm typecheck` + T1–T3 |

## Definition of Done (fragmento aplicable a F1)

- [ ] `pnpm lint` y `pnpm typecheck` sin errores.
- [ ] T1–T3 en verde.
- [ ] Sin `any` nuevo, TSDoc en lo exportado, sin OFFSET, sin tocar F0/F3.
- [ ] Frontend con los 4 estados de UI en las vistas modificadas.
