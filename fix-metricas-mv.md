# Fix — Panel de métricas desactualizado (45 de 226 ventas)

**Problema:** el dashboard de métricas lee exclusivamente de vistas materializadas
(`sales.mv_project_daily_metrics`, `sales.mv_closer_daily_kpis`, `sales.mv_product_daily_kpis`)
que quedan **desactualizadas** porque no se refrescan tras importar/ingresar ventas.
Resultado: muestra 45 ventas cuando la tabla fuente tiene 226 aprobadas/completadas.

**Cubre también los reembolsos:** al reembolsar, el estado pasa de `APPROVED`/`COMPLETE`
a `REFUNDED` y la venta debe salir del conteo; hoy tampoco se refresca, así que el panel
la sigue contando. La Fase 2 instrumenta todas las rutas de escritura (incluido reembolso)
y la Fase 3 normaliza `PURCHASE_REFUNDED -> REFUNDED`.

---

## Fase 1 — Remedio inmediato (SQL, one-shot)

Ejecutar contra la base de datos (producción primero, luego dev):

```sql
REFRESH MATERIALIZED VIEW sales.mv_project_daily_metrics;
REFRESH MATERIALIZED VIEW sales.mv_closer_daily_kpis;
REFRESH MATERIALIZED VIEW sales.mv_product_daily_kpis;

-- Verificación: debe devolver 226 (no 45)
SELECT project_id, SUM(ventas_totales) AS ventas, SUM(facturacion_bruta) AS facturacion
FROM sales.mv_project_daily_metrics
GROUP BY project_id;
```

---

## Fase 2 — Refrescar métricas tras cada escritura

### 2.1 Extraer el refresco a un método reutilizable

Archivo: `apps/api/src/modules/sales/commission.service.ts`

Reemplazar el bloque final de `reconcileCloserCommissions`:

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

por:

```ts
    // Refrescar vistas materializadas para que el dashboard refleje los cambios
    await this.refreshMetricsViews();
```

Agregar este método dentro de `CommissionService` (justo después de `reconcileCloserCommissions`):

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

### 2.2 Exponer el refresco desde `SalesService`

Archivo: `apps/api/src/modules/sales/sales.service.ts`

Agregar (para que el controlador pueda invocarlo UNA vez tras una importación masiva):

```ts
  /**
   * Refresca las vistas materializadas de métricas. Expuesto para que el
   * controlador lo invoque UNA vez tras una importación masiva de ventas.
   */
  async refreshMetricsViews(): Promise<void> {
    await this.commissionService.refreshMetricsViews();
  }
```

### 2.3 Webhook — refrescar tras procesar cada evento

En `processEvent` (mismo archivo `sales.service.ts`), justo después de
`this.logger.log('[OK] Evento ... procesado exitosamente.')`, agregar:

```ts
      // Refrescar métricas: el evento puede ser una venta nueva, una aprobación
      // o un REEMBOLSO; en todos los casos el dashboard debe reflejarlo.
      await this.commissionService.refreshMetricsViews().catch((e) =>
        this.logger.error(`Error refrescando métricas tras evento ${eventId}:`, e)
      );
```

### 2.4 Cambio de estado (incluye reembolso manual) — refrescar siempre

En `updateTransactionStatus` (mismo archivo `sales.service.ts`), reemplazar:

```ts
    // Re-calcular comisiones asíncronamente si tiene closer asignado
    if (sale.closerId) {
      this.commissionService.reconcileCloserCommissions(projectId, sale.closerId, sale.createdAt || new Date()).catch(e => {
        this.logger.error(`Error recalculating commissions:`, e);
      });
    }
```

por:

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

### 2.5 CSV masivo — refrescar UNA vez al final del lote

Archivo: `apps/api/src/modules/sales/sales.controller.ts`

En `importSalesCsv`, justo antes del `return results;`, agregar:

```ts
    // Refrescar métricas una sola vez tras el lote completo (no por fila)
    await this.salesService.refreshMetricsViews().catch(() => {});
```

> **Por qué no dentro de `importSaleCsv`:** el controlador importa fila por fila;
> refrescar por fila haría 226 refrescos (lentísimo). Refrescar una vez al final
> del lote es suficiente y correcto.

### 2.6 Respaldo (opcional) — refresco periódico cada N minutos

Red de seguridad: refresca las MVs por tiempo, por si alguna ruta de escritura
(webhook, CSV, manual, reembolso) no disparó el refresco. Corre en el worker
(y en dev, que arranca el loop igual).

Archivo: `apps/api/src/modules/sales/sales.service.ts`

En `onModuleInit`, agregar la llamada `this.startMetricsRefreshLoop();`:

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

Agregar el método (junto a `startWorkerLoop`):

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

> **Optimización (opcional):** si el refresco cada minuto genera bloqueos de lectura
> notorios, cambia el SQL dentro de `refreshMetricsViews()` (Fase 2.1) a
> `REFRESH MATERIALIZED VIEW CONCURRENTLY sales.mv_...;`. Las tres MVs ya tienen
> índice único (requisito de `CONCURRENTLY`), pero recuerda que `CONCURRENTLY` no
> puede ejecutarse dentro de una transacción — aquí no lo está, así que es seguro.

---

## Fase 3 — Normalizar `PURCHASE_REFUNDED`

Archivo: `apps/api/src/core/sales/normalize-sale-status.ts`

En el mapa `CANONICAL`, reemplazar:

```ts
  REFUNDED: 'REFUNDED',
  REEMBOLSO: 'REFUNDED',
```

por:

```ts
  REFUNDED: 'REFUNDED',
  REEMBOLSO: 'REFUNDED',
  REEMBOLSADO: 'REFUNDED',
  PURCHASE_REFUNDED: 'REFUNDED',
```

> Nota: si ya existen filas con `PURCHASE_REFUNDED` (en producción hay 10), correr
> `normalizeSaleStatus` sobre ellas requiere un backfill aparte; las MVs las excluyen
> igual (no están en la whitelist de aprobados), así que no es bloqueante para el conteo.

---

## Verificación final

1. Aplicar Fase 1 (SQL) y confirmar `ventas_totales = 226`.
2. Aplicar Fase 2 y 3 en el código.
3. `pnpm build` sin errores TypeScript.
4. `pnpm lint` sin advertencias críticas.
5. Probar un caso real: importar una venta (o reembolsar una existente) y confirmar
   que el dashboard refleja el cambio sin ejecutar el SQL manualmente.
