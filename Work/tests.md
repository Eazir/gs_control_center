# Work/tests.md — Fase F0

> **Fase:** F0 — Higiene de métricas: refresco de vistas materializadas + normalización de reembolso.
> **Estilo:** el repo usa scripts de verificación `tsx test/verify-*.ts` (no Jest/Vitest). Seguir ese patrón.
> **Referencia:** `Work/plan.md` (F0 "Terminado cuando") y `Work/instructions.md` (cambios exactos).

## Cómo se ejecutan

```bash
# Tests unitarios (sin BD)
pnpm --filter api test:sale-status

# Tests de integración (contra la BD de dev, que YA tiene datos reales + MVs)
pnpm --filter api test:metrics-refresh

# Calidad global (DoD)
make check   # = pnpm lint + pnpm typecheck + pnpm test
```

> Nota: `make check` hoy **no** ejecuta los `verify-*.ts` (no están en `turbo run test`). Para el DoD de F0,
> correr además los dos scripts de arriba. (Opcional, fuera de alcance de F0: cablear un script `test` en
> `apps/api/package.json` que agrupe los `verify-*` para que `make check` los recoja.)

---

## T1 — Unit: normalización de estado (`normalizeSaleStatus`)

**Archivo nuevo:** `apps/api/test/verify-sale-status.ts`
**Script nuevo:** `"test:sale-status": "tsx test/verify-sale-status.ts"` en `apps/api/package.json`

**Qué verifica:** el mapa `CANONICAL` de `apps/api/src/core/sales/normalize-sale-status.ts` ahora normaliza los
estados de reembolso nuevos. Importar `normalizeSaleStatus` y hacer `assert(...)` (estilo `verify-kpi-metrics.ts`).

**Casos obligatorios (nuevos):**

| Entrada | Esperado |
|---|---|
| `PURCHASE_REFUNDED` | `REFUNDED` |
| `REEMBOLSADO` | `REFUNDED` |
| `REEMBOLSO` | `REFUNDED` |
| `REFUNDED` | `REFUNDED` |
| `purchase_refunded` (minúsculas) | `REFUNDED` |
| `  purchase refunded  ` (espacios) | `REFUNDED` |

**Casos de regresión (no deben cambiar):**

| Entrada | Esperado |
|---|---|
| `COMPLETE` / `COMPLETED` / `PURCHASE_COMPLETE` | `COMPLETE` |
| `APPROVED` / `PURCHASE_APPROVED` / `APROBADO` | `APPROVED` |
| `CANCELED` / `CANCELLED` / `PURCHASE_CANCELED` | `CANCELED` |
| `EXPIRED` / `PURCHASE_EXPIRED` | `EXPIRED` |
| `ABANDONED_CART` / `PURCHASE_OUT_OF_SHOPPING_CART` | `ABANDONED_CART` |
| `CHARGEBACK` / `DISPUTE` | `CHARGEBACK` / `DISPUTE` |
| `SOMETHING_NEW` (desconocido) | `SOMETHING_NEW` (pasa tal cual) |
| `null` / `undefined` / `''` | `''` |

**Criterio de aceptación:** el script termina con `verify-sale-status: OK` (exit 0).

---

## T2 — Integración: consistencia de MVs y `refreshMetricsViews()`

**Archivo nuevo:** `apps/api/test/verify-metrics-refresh.ts`
**Script nuevo:** `"test:metrics-refresh": "tsx test/verify-metrics-refresh.ts"` en `apps/api/package.json`

**Precondición:** BD de dev levantada con datos reales (las MVs ya fueron refrescadas por el `pg_dump`). Hoy la
fuente tiene **221** aprobadas/completadas (`COMPLETE` 174 + `APPROVED` 47) y la MV también 221.

### 2a. Consistencia fuente vs MV (read-only)

1. Conectar `PrismaClient` (patrón de `verify-prisma.ts`: `new PrismaClient()`, `$connect()`, `$disconnect()`).
2. Calcular el **conteo fuente** con la **misma whitelist de estados aprobados/completados que usa la MV**
   (leerla de la migración `20261002020000_kpi_dashboard_source_splits/migration.sql`).
3. Calcular `SUM(ventas_totales)` de `sales.mv_project_daily_metrics` (y el conteo de las otras dos MVs, si
   aplica).
4. `assert(SUM_mv === conteo_fuente)`.

**Criterio:** consistencia exacta (en dev: 221 === 221). Si no coincide, falla.

### 2b. `refreshMetricsViews()` ejecuta sin error y es idempotente

1. Instanciar `CommissionService` con un `PrismaService` conectado (el constructor recibe `PrismaService`).
2. Llamar `await commissionService.refreshMetricsViews()` y `assert` que **no lanza**.
3. Volver a calcular `SUM(ventas_totales)` y `assert` que sigue igual al conteo fuente (refrescar no altera
   datos ya consistentes).

**Criterio:** el método refresca las 3 MVs sin error y el resultado sigue consistente.

### 2c. (Integración, con revert) Un reembolso sale del conteo tras el refresco

1. Elegir una venta con `status = 'COMPLETE'` (hay 174 en dev).
2. Registrar `antes = SUM(ventas_totales)`.
3. `UPDATE sales.sales SET status = 'REFUNDED' WHERE id = <id>` (directo con Prisma).
4. Llamar `await commissionService.refreshMetricsViews()`.
5. `assert(SUM(ventas_totales) === antes - 1)`.
6. **Revertir** en `finally`: `UPDATE ... SET status = 'COMPLETE'` + `refreshMetricsViews()` para dejar dev igual.

**Criterio:** el reembolso se refleja (la venta sale del conteo) sin refresco manual extra. Marcar como test
que **siempre revierte** (usar `try/finally`); no ejecutar contra producción.

---

## T3 — Verificación operativa (David, tras `correcciones.md`)

Estas no son automáticas; las ejecuta David sobre la plataforma cuando F0 esté aprobado:

1. **Importar una venta** (webhook/CSV/manual) → el dashboard de métricas refleja el incremento **sin** correr
   SQL manual.
2. **Reembolsar una venta existente** → el dashboard la saca del conteo.
3. Confirmar que `sales.mv_*` ya no quedan desactualizadas tras estas operaciones.

---

## Trazabilidad con el plan F0 ("Terminado cuando")

| Criterio del plan | Cubierto por |
|---|---|
| Dashboard refleja cambios sin refresco manual | T2c (reembolso) + T3 (operativa) |
| `PURCHASE_REFUNDED`/`REEMBOLSADO` → `REFUNDED` | T1 |
| MVs consistentes tras refresco | T2a, T2b |
| `make check` en verde | `pnpm lint` + `pnpm typecheck` + T1 + T2 |

## Definition of Done (fragmento aplicable a F0)

- [ ] `pnpm lint` y `pnpm typecheck` sin errores.
- [ ] T1 (unit) y T2 (integración) en verde.
- [ ] Sin `any`, sin secretos en logs, TSDoc en `refreshMetricsViews`.
- [ ] No se tocan `affiliation.ts` ni lógica de comisiones (frontera F3/F4).
