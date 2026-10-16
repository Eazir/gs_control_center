# Work/instructions.md — Fase F0

> **Fase:** F0 — Higiene de métricas: refresco de vistas materializadas + normalización de reembolso.
> **Fuente de referencia:** `fix-metricas-mv.md` (especificación exacta de David). Estas instrucciones la
> aterrizan a los bloques reales del código actual, verificados contra el repo.

## Objetivo

El dashboard de métricas lee 3 vistas materializadas (`sales.mv_project_daily_metrics`,
`sales.mv_closer_daily_kpis`, `sales.mv_product_daily_kpis`) que solo se refrescan en un único punto. Si se
ingresa/reembolsa una venta por otra ruta, el dashboard queda desactualizado. Hay que: (1) extraer el refresco
a un método reutilizable, (2) invocarlo tras cada ruta de escritura relevante, (3) añadir un respaldo
periódico, y (4) normalizar el estado de reembolso `PURCHASE_REFUNDED`/`REEMBOLSADO` a `REFUNDED`.

**No se toca lógica de atribución ni de comisiones** (eso es F3/F4). Solo se extrae/llama el refresco.

## Archivos objetivo

1. `apps/api/src/modules/sales/commission.service.ts`
2. `apps/api/src/modules/sales/sales.service.ts`
3. `apps/api/src/modules/sales/sales.controller.ts`
4. `apps/api/src/core/sales/normalize-sale-status.ts`

---

## Cambio 1 — `commission.service.ts`: extraer `refreshMetricsViews()`

**Encontrar:** al final de `reconcileCloserCommissions` existe este bloque (hoy líneas ~96–103):

```ts
    // Refrescar vistas materializadas para que el dashboard refleje los cambios
    try {
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_project_daily_metrics;`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_closer_daily_kpis;`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_product_daily_kpis;`);
    } catch (e) {
      this.logger.error(`Error refrescando vistas tras recalcular comisiones:`, e);
    }
```

**Reemplazar por:**

```ts
    // Refrescar vistas materializadas para que el dashboard refleje los cambios
    await this.refreshMetricsViews();
```

**Agregar** el siguiente método dentro de `CommissionService`, justo después del cierre de
`reconcileCloserCommissions` (antes de la llave de cierre de la clase):

```ts
  /**
   * Refresca las vistas materializadas que alimentan el dashboard de métricas.
   * Debe ejecutarse tras CUALQUIER escritura que cambie el conteo o monto de
   * ventas efectivas: alta webhook/CSV/manual, cambio de estado (aprobación o
   * REEMBOLSO) o reasignación de closer. Un reembolso saca la venta del conteo
   * porque las MVs solo cuentan estados aprobados/completados.
   */
  async refreshMetricsViews(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_project_daily_metrics;`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_closer_daily_kpis;`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_product_daily_kpis;`);
    } catch (e) {
      this.logger.error(`Error refrescando vistas materializadas de métricas:`, e);
    }
  }
```

---

## Cambio 2 — `sales.service.ts`: exponer `refreshMetricsViews()` al controlador

**Agregar** este método público en `SalesService` (junto a `onModuleInit` o `getSaleDetails`):

```ts
  /**
   * Refresca las vistas materializadas de métricas. Expuesto para que el
   * controlador lo invoque UNA vez tras una importación masiva de ventas.
   */
  async refreshMetricsViews(): Promise<void> {
    await this.commissionService.refreshMetricsViews();
  }
```

> `commissionService` ya está inyectado en el constructor de `SalesService` (verificado).

---

## Cambio 3 — `sales.service.ts`: refrescar tras procesar cada evento (webhook)

**Encontrar** en `processEvent` (hoy línea ~563):

```ts
      this.logger.log(`[OK] Evento ${eventId} procesado exitosamente.`);
```

**Agregar inmediatamente después:**

```ts
      // Refrescar métricas: el evento puede ser una venta nueva, una aprobación
      // o un REEMBOLSO; en todos los casos el dashboard debe reflejarlo.
      await this.commissionService.refreshMetricsViews().catch((e) =>
        this.logger.error(`Error refrescando métricas tras evento ${eventId}:`, e)
      );
```

---

## Cambio 4 — `sales.service.ts`: refrescar en cambio de estado (incluido reembolso)

**Encontrar** en `updateTransactionStatus` (hoy líneas ~1349–1354):

```ts
    // Re-calcular comisiones asíncronamente si tiene closer asignado
    if (sale.closerId) {
      this.commissionService.reconcileCloserCommissions(projectId, sale.closerId, sale.createdAt || new Date()).catch(e => {
        this.logger.error(`Error recalculating commissions:`, e);
      });
    }
```

**Reemplazar por** (agregar la rama `else`):

```ts
    // Re-calcular comisiones asíncronamente si tiene closer asignado
    if (sale.closerId) {
      this.commissionService.reconcileCloserCommissions(projectId, sale.closerId, sale.createdAt || new Date()).catch(e => {
        this.logger.error(`Error recalculating commissions:`, e);
      });
    } else {
      // Sin closer (marketing): refrescar métricas directo, p. ej. tras un REEMBOLSO
      this.commissionService.refreshMetricsViews().catch(e => {
        this.logger.error(`Error refrescando métricas tras cambio de estado:`, e);
      });
    }
```

---

## Cambio 5 — `sales.service.ts`: respaldo periódico

**Encontrar** `onModuleInit` (hoy líneas ~35–43):

```ts
  onModuleInit() {
    const isWorker = process.argv.some((arg) => arg === '--role=worker');
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isWorker || isDev) {
      this.startWorkerLoop().catch((err) => {
        this.logger.error('Error crítico al iniciar el Worker Loop', err);
      });
    }
  }
```

**Reemplazar por** (agregar la llamada al loop de refresco):

```ts
  onModuleInit() {
    const isWorker = process.argv.some((arg) => arg === '--role=worker');
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isWorker || isDev) {
      this.startWorkerLoop().catch((err) => {
        this.logger.error('Error crítico al iniciar el Worker Loop', err);
      });
      this.startMetricsRefreshLoop();
    }
  }
```

**Agregar** este método privado junto a `startWorkerLoop`:

```ts
  /**
   * Respaldo: refresca las vistas materializadas de métricas cada N minutos.
   * Garantiza que el dashboard nunca quede desactualizado aunque alguna ruta
   * de escritura (webhook, CSV, manual, reembolso) no dispare el refresco.
   */
  private startMetricsRefreshLoop() {
    const INTERVAL_MS = 60_000; // 1 minuto
    const timer = setInterval(() => {
      this.commissionService.refreshMetricsViews().catch((e) =>
        this.logger.error('Error en el refresco periódico de métricas:', e)
      );
    }, INTERVAL_MS);
    timer.unref(); // no mantiene vivo el proceso solo por el timer
  }
```

---

## Cambio 6 — `sales.controller.ts`: refrescar UNA vez tras importación masiva

**Encontrar** en `importSalesCsv` (hoy línea ~198), justo antes del `return results;`:

```ts
    return results;
```

**Agregar antes:**

```ts
    // Refrescar métricas una sola vez tras el lote completo (no por fila)
    await this.salesService.refreshMetricsViews().catch(() => {});
```

> Nota: `importSaleCsv` (método por fila en `sales.service.ts`) invoca `reconcileCloserCommissions` solo si la
> venta tiene `closerId`; esa ruta ya refresca (comportamiento actual, no se modifica). El refresco aquí
> garantiza también el caso de ventas de marketing (sin `closerId`) y cierra el lote de forma explícita.

---

## Cambio 7 — `normalize-sale-status.ts`: normalizar reembolso

**Encontrar** en el mapa `CANONICAL` (hoy líneas ~47–48):

```ts
  REFUNDED: 'REFUNDED',
  REEMBOLSO: 'REFUNDED',
```

**Reemplazar por:**

```ts
  REFUNDED: 'REFUNDED',
  REEMBOLSO: 'REFUNDED',
  REEMBOLSADO: 'REFUNDED',
  PURCHASE_REFUNDED: 'REFUNDED',
```

---

## Restricciones y límites

- **TypeScript `strict`**: `any` prohibido. Los snippets provistos no introducen `any`.
- **Sin migración Prisma** en F0: es solo código (extraer/llamar refresco + ampliar mapa de estados).
- **No tocar** la lógica de atribución (`affiliation.ts`) ni de comisiones (es F3). `reconcileCloserCommissions`
  mantiene su comportamiento; solo cambia que su refresco final ahora delega en `refreshMetricsViews()`.
- **TSDoc** obligatorio en los métodos exportados (`refreshMetricsViews` en `CommissionService` y `SalesService`).
- El `REFRESH MATERIALIZED VIEW` sin `CONCURRENTLY` toma un `ACCESS EXCLUSIVE LOCK`; las llamadas no están
  dentro de una transacción, así que es seguro. `CONCURRENTLY` es una optimización opcional (ver `fix-metricas-mv.md`),
  NO requerida para esta entrega.
- `$executeRawUnsafe` aquí es aceptable: los identificadores de las MVs son constantes del sistema (no vienen
  del usuario), por lo que no hay riesgo de inyección.

## Criterio de aceptación (→ `tests.md`)

Referencia al plan F0 "Terminado cuando":

- Tras importar (webhook/CSV/manual) o cambiar estado (aprobación/reembolso), el dashboard refleja el cambio
  sin refresco manual.
- `PURCHASE_REFUNDED`/`REEMBOLSADO` se normalizan a `REFUNDED`.
- `make check` en verde (lint + types + tests).
