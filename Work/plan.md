# Work/plan.md — Plan de acción general

> **Autor:** Opencode (orquestador / arquitecto / dev principal)
> **Ejecutor:** Antigravity (Gemini)
> **Fuente macro:** `PLAN_DE_ACCION.md`. Este archivo aterriza el sprint actual de mejoras en fases verificables.

## Reglas de este documento

- Cada fase debe ser **testeable y verificable**: nada de "terminado" sin un criterio comprobable.
- Cada fase tiene un **criterio "terminado cuando"** explícito.
- Antes de iniciar una feature se actualiza este plan; `instructions.md`, `tests.md` y `correcciones.md`
  se reescriben para esa fase.
- No se avanza de fase sin visto bueno en `correcciones.md` y `make check` en verde.
- Tras el visto bueno de `correcciones.md`, **Opencode reconstruye los contenedores `api` y `web`** para que
  David revise los cambios sobre la plataforma antes de cerrar la fase.
- **Fronteras innegociables (AGENTS.md):** un módulo solo consulta su propio schema; cero FKs físicas entre
  schemas; `any` prohibido; `withRls` para RLS; DataLoader en toda relación; `prisma.$transaction` en
  escrituras multi-tabla; **paginación keyset/cursor (OFFSET prohibido en listados grandes)**.

## Sprint actual: Filtros, KPIs, atribución y trazabilidad

### Mapa de requisitos → fase

| # | Requisito | Fase |
|---|---|---|
| Fix | Dashboard desactualizado: refresco de vistas materializadas + normalizar `PURCHASE_REFUNDED` | **F0** |
| 1 | Filtro por día (dashboard de métricas + ventas) | **F1** |
| 3 | Filtro marketing / comercial (ventas + transacciones) | **F1** |
| 7 | Filtrar por producto, closer y estado de transacción (transacciones, ventas, base de leads) | **F1** |
| 11 | Paginación en la página de transacciones y ventas | **F1** |
| 12 | Contador "Total de N" según filtros + paginación/navegación al **inicio** de la tabla | **F1** |
| 2 | KPIs solo-marketing vs solo-comercial (volumen + facturación bruta + neta) | **F2** |
| 6 | Prioridad del afiliado sobre el SCK (con excepción) | **F3** |
| 4 | Corregir no-continuidad en canceladas / expiradas / carrito abandonado | **F4** |
| 5 | Importación de ventas manuales (externas) | **F5** |
| 9 | Modificar datos de transacciones (incluida la fecha) | **F6** |
| 10 | Encadenar la trazabilidad de transacciones manualmente | **F6** |
| 8 | Botones de copiado instantáneos | **F7** |

> Estas fases caen dentro de las fases macro 4 (Ingesta de ventas) y 5 (KPIs/metas/comisiones) de
> `PLAN_DE_ACCION.md`, más retoques de UX (F7) y data-entry (F5/F6). El detalle del fix de métricas está
> documentado en `fix-metricas-mv.md` (referencia para `instructions.md`).

### Orden de ejecución recomendado

`F0 → F3 → F3.1 → F1 → F2 → F4 → F5 → F6 → F7`

- **F0** es un bug crítico (dashboard muestra números incorrectos) y es prerrequisito de **F2** (que lee las MVs).
- La clasificación **comercial/marketing** (F3) alimenta el filtro de origen (F1, req 3) y los KPIs por
  origen (F2). Hacer F3 antes de F1/F2 evita re-trabajo. F4–F7 son en su mayoría independientes.

---

## Fase 0 — Higiene de métricas: refresco de vistas materializadas (fix-metricas-mv.md)

**Objetivo:** corregir que el dashboard de métricas lee vistas materializadas (`sales.mv_project_daily_metrics`,
`mv_closer_daily_kpis`, `mv_product_daily_kpis`) que quedan desactualizadas porque no se refrescan tras
ingresar/editar ventas (en producción: muestra 45 vs 226 aprobadas/completadas). Instrumenta el refresco tras
cada escritura y normaliza el estado de reembolso.

**Ámbito:** `apps/api/src/modules/sales/commission.service.ts`, `sales.service.ts`, `sales.controller.ts`,
`apps/api/src/core/sales/normalize-sale-status.ts`.

**Tareas:**
- [ ] **Remedio inmediato (SQL one-shot, producción):** `REFRESH MATERIALIZED VIEW` de las 3 MVs y verificar
      `SUM(ventas_totales)` == aprobadas+completadas de la tabla fuente. *(En dev no aplica: el dump ya refrescó
      las MVs al final — hoy la fuente tiene 221 y la MV también 221.)*
- [ ] **Refresco tras escritura:** extraer `refreshMetricsViews()` en `CommissionService` y llamarlo desde
      `processEvent` (webhook), `updateTransactionStatus` (aprobación/reembolso, incluida la rama sin closer) y
      `importSalesCsv` (una vez por lote, no por fila).
- [ ] **Respaldo periódico:** `startMetricsRefreshLoop()` en `onModuleInit` (worker y dev), refresco cada 1 min.
- [ ] **Normalizar reembolso:** en `normalize-sale-status.ts`, mapear `PURCHASE_REFUNDED` y `REEMBOLSADO` → `REFUNDED`.
- [ ] (Opcional) `REFRESH MATERIALIZED VIEW CONCURRENTLY` si el refresco por minuto bloquea lecturas (las MVs ya
      tienen índice único; `CONCURRENTLY` no puede ir dentro de una transacción).

**Terminado cuando:**
- Tras importar (webhook/CSV/manual) o cambiar estado (aprobación/reembolso), el dashboard refleja el cambio sin
  refresco manual.
- `PURCHASE_REFUNDED`/`REEMBOLSADO` se normalizan a `REFUNDED` (las 10 filas existentes en dev ya quedan excluidas
  del conteo por la whitelist de la MV aunque no se backfilleen).
- `make check` en verde + prueba de caso real (importar/reembolsar → dashboard actualizado).

**Riesgos / dependencias:**
- Prerrequisito de **F2** (los KPIs leen las MVs). El backfill de `PURCHASE_REFUNDED` no es bloqueante para el
  conteo, pero sí para la consistencia de "facturación neta" (F2).
- No refrescar por fila en importaciones masivas (226 refrescos = lentísimo); refrescar una vez al final del lote.

---

## Fase 1 — Filtros, paginación y contadores de listados (req 1, 3, 7, 11, 12)

**Objetivo:** filtrar por día, origen (marketing/comercial) y producto/closer/estado; paginar los listados de
transacciones y ventas; y mostrar el total de registros según los filtros activos, con la paginación y la
navegación **al inicio de la tabla** en las tres interfaces (base de leads, transacciones y ventas).

**Ámbito:** backend `sales` + `kpi` + frontend (`dashboard`, `closer/sales`, listados de leads/transacciones).
Contratos en `packages/contracts`.

**Tareas:**
- [ ] Definir/validar en `packages/contracts` los query params (`day`, `from`/`to`, `origin`, `productId`,
      `closerId`, `status`, `cursor`, `limit`) con Zod.
- [ ] Backend: extender los endpoints de listado de ventas/transacciones/leads para aceptar y aplicar los
      filtros (donde corresponda), respetando RLS y la regla "CLOSER solo ve lo suyo".
- [ ] Backend: agregar filtro por día (fecha concreta / rango) al dashboard de métricas (`kpi.controller` +
      `kpi.service`, hoy solo soporta `period` en días).
- [ ] Backend: agregar filtro de origen `marketing | comercial | todos` a ventas y transacciones.
- [ ] Backend: **paginación keyset/cursor** en transacciones y ventas (sin OFFSET), devolviendo `total` de
      registros con los filtros aplicados (para el contador) + `nextCursor`.
- [ ] Frontend: barras de filtros en las vistas objetivo (con skeleton/empty/error/data).
- [ ] Frontend: contador "Total de transacciones: N" / "Total de leads: N" / "Total de ventas: N" según los
      filtros activos, en base de leads, transacciones y ventas.
- [ ] Frontend: paginación y navegación entre páginas ubicadas **al inicio** de la tabla (no al final).
- [ ] Frontend: los filtros + página/cursor se reflejan en la URL (query string) para compartir/enlazar.

**Terminado cuando:**
- Un listado de ventas filtrado por `closerId=X` solo devuelve ventas de X (y CLOSER no puede filtrar por un
  closer ajeno).
- El dashboard acepta `day`/`from`/`to` y devuelve métricas restringidas a ese día/rango.
- Las ventanas de transacciones, ventas y leads filtran por producto, closer y estado; el filtro de origen
  (marketing/comercial) usa la clasificación de F3.
- Las listas de transacciones y ventas paginan (keyset) y navegan entre páginas.
- Cada vista muestra el total de registros con los filtros activos ("Total de transacciones/leads/ventas: N").
- La paginación y la navegación aparecen **al inicio** de la tabla.
- `make check` en verde + tests unitarios de validación Zod, de los query params aplicados y del contador
  (`total` consistente con los filtros).

**Riesgos / dependencias:**
- El filtro de origen depende de la clasificación **F3** (atribución). Sin F3, se puede entregar con la
  clasificación actual (`closerId` presente ⇒ comercial) y ajustarla después.
- El contador `total` debe calcularse con los mismos filtros que la consulta paginada (una sola fuente de
  verdad de `whereClause` para no desincronizar).

---

## Fase 2 — KPIs por origen: comercial vs marketing (req 2)

**Objetivo:** en el dashboard, desglosar por origen los KPIs de volumen y facturación (bruta y neta).

**Ámbito:** `kpi.service`, `kpi-metrics.util.ts`, vistas materializadas (`sales.mv_project_daily_metrics`,
`mv_closer_daily_kpis`, `mv_product_daily_kpis`), frontend de métricas.

**Tareas:**
- [ ] Definir "facturación neta" (bruta − reembolsos/cancelaciones/chargebacks) y documentarlo (TSDoc + ADR
      o comentario en `DICCIONARIO.md`).
- [ ] Extender el agregado del dashboard para devolver, por cada KPI, el split `{ comercial, marketing }`
      además del total.
- [ ] Garantizar consistencia: `comercial + marketing == total` (salvo redondeo explícito).
- [ ] Frontend: render del desglose (gráfico/tarjetas) con los cuatro estados de UI.

**Terminado cuando:**
- `GET /kpi/project/:projectId/dashboard` devuelve `facturacionBruta`, `facturacionNeta` y `volumen` cada
  uno desglosado en `comercial` y `marketing`.
- Test de consistencia `comercial + marketing == total` con un fixture de ventas aprobadas + reembolsadas.

**Riesgos / dependencias:**
- Depende de **F0** (MVs correctas) y de la clasificación **F3**. Si las MVs no guardan origen, la segmentación
  se calcula en el servicio (no romper la frontera de schema: leer solo desde `sales`).

---

## Fase 3 — Atribución de ventas: afiliado vs SCK (req 6)

**Objetivo:** definir, al entrar una transacción (manual/CSV/Hotmart), el **equipo** (`COMERCIAL`/`MARKETING`) y
el **closer** (si aplica), con esta matriz:

| # | Afiliado | SCK | Equipo | Closer |
|---|---|---|---|---|
| 1 | Comercial | closer válido | `COMERCIAL` | el closer del SCK |
| 2 | Comercial | no válido / fijo | `COMERCIAL` | `null` |
| 3 | Marketing | closer válido | `COMERCIAL` | el closer del SCK |
| 4 | Marketing | no válido / fijo | `MARKETING` | `null` |

- **El closer lo determina SOLO el SCK** (cuando resuelve a un `projectUser.sckCodes` del equipo comercial).
- **Los SCK fijos (`dh`/`diego`/`reynald`) son referenciales (de afiliados), NO de closers**: marcan equipo
  comercial pero **nunca** asignan closer; la comisión del closer queda en la empresa.
- El afiliado decide el equipo solo cuando el SCK no resuelve a un closer válido.

**Ámbito:** `core/sales/affiliation.ts` + `sales.service.ts` (`processEvent` webhook **y** `importSaleCsv`).

**Tareas:**
- [ ] Aislar la regla en una función pura `resolveAttribution({ sckCloserId, sckIsFixedCommercial, affiliateIsComercial })`.
- [ ] Reemplazar el bloque de atribución en `processEvent` (~líneas 331–357) por la llamada a la función.
- [ ] **Eliminar el fallback a `lead.closerId`** en webhook (~línea 567) y en CSV (~1685/1707).
- [ ] Aplicar la misma regla en `importSaleCsv` (quitar resolución por nombre de afiliado + usar `resolveAttribution`).
- [ ] Tests unitarios exhaustivos de la matriz.

**Terminado cuando:**
- La matriz de casos pasa en tests unitarios.
- Una venta con SCK fijo (`dh`) **no** recibe closer aunque el lead tenga uno (hoy 3 de 10 con `dh` lo heredan mal).
- `make check` en verde.

**Riesgos / dependencias:**
- Cambia `closer_id` en ventas ya procesadas con SCK fijo; evaluar backfill (no bloqueante para el conteo de MVs).

---

## Fase 3.1 — Backfill de atribución del histórico (re-aplicar F3 a ventas existentes)

**Objetivo:** re-analizar las ventas ya existentes para que reflejen la regla F3 (atribución por SCK, **sin**
fallback a `lead.closerId`). Corrige en particular:
- ventas "comercial sin closer" que heredaron mal el closer del lead (SCK fijo `dh`/`diego`/`reynald` o
  afiliado comercial sin SCK de closer); y
- ventas importadas por CSV cuyo closer salió del **nombre de afiliado** (fallback viejo del CSV).

**Ámbito:** `apps/api` (script de backfill idempotente), `core/sales/affiliation.ts` (reusa
`resolveAttribution`), `sales.service.ts`, `commission.service.ts` (`refreshMetricsViews`).

**Decisiones de alcance (confirmadas con David):**
- Corregir `closer_id` **y** `metadata.attribution` (re-aplicar `resolveAttribution` completo a cada venta).
- **Ventas MANUALES** quedan fuera (hoy fuera de alcance en F3).
- Recalcular comisiones de los closers afectados: **sí**.

**Tareas:**
- [ ] Script `backfill-attribution.ts` (`tsx`) que, por venta: resuelve `sckCloserId` desde `sck` +
      `project_users.sck_codes` (con gate `isMarketing` vía `offer_code` → `projects.projects.products`),
      llama a `resolveAttribution`, y **reporta** (dry-run) las ventas cuyo `closer_id` difiere.
- [ ] Modo `--apply`: actualiza `closer_id` **y** `metadata.attribution` en las ventas afectadas, idempotente,
      `prisma.$transaction` por lote, con resumen final (X cambiadas / Y intactas).
- [ ] Reporte dry-run desglosado por motivo: SCK fijo, afiliado comercial sin closer, CSV-por-nombre, SCK
      resuelve a otro closer.
- [ ] Tras aplicar: `refreshMetricsViews()` (F0) + `reconcileCloserCommissions` de los closers afectados.
- [ ] Scripts npm: `pnpm --filter api backfill:attribution -- --dry-run` y `--apply`.

**Terminado cuando:**
- El dry-run lista el universo exacto de ventas que cambiarían (coincide con el diagnóstico: 10 con `dh`,
  3 heredadas).
- `--apply` corrige `closer_id` y `metadata.attribution` en esas ventas y el split
  `closer_id IS NULL`/`IS NOT NULL` queda consistente con la regla F3.
- Re-correr el dry-run devuelve **0 cambios** (idempotente).
- MVs refrescadas y comisiones recalculadas.
- `make check` en verde.

**Riesgos / dependencias:**
- Requiere **confirmación explícita de David** para ejecutar `--apply` (regla AGENTS.md: nada de escrituras
  masivas sin confirmar).
- La MV sigue contando "COMERCIAL sin closer" como *marketing* (`closer_id IS NULL`); corregir esa fórmula es
  de **F2**, no del backfill.
- El afiliado **no está guardado por venta**. Para re-etiquetar `metadata.attribution` en ventas **sin closer**
  se necesita el afiliado; los casos por **SCK fijo** (`dh`/`diego`/`reynald`) se derivan del propio `sck`, y
  el resto se recupera de `integrations.integration_events.payload` (match por
  `external_order_id`/`external_txn_id`). Si no hay evento (CSV/manual), se conserva la etiqueta actual.
- El gate `isMarketing` se recupera por `offer_code` contra `projects.projects.products`; si un producto fue
  borrado del catálogo, replicar el fallback "legacy-history" (`isMarketing: false`).

---

## Fase 4 — Continuidad del ciclo de transacciones (req 4)

**Objetivo:** corregir la no-continuidad cuando una transacción pasa a cancelada / expirada / carrito
abandonado, y que una recuperación posterior quede correctamente enlazada.

**Ámbito:** `sales.service.ts` (lógica de adopción/recuperación, hoy líneas ~360–400), `determineSituacion` /
`determineStage`, y actualización del lead.

**Tareas:**
- [ ] Inventariar los estados involucrados (`CANCELED`, `CANCELLED`, `PURCHASE_CANCELED`,
      `PURCHASE_OUT_OF_SHOPPING_CART`, `ABANDONED_CART`, `BILLET`, `WAITING_PAYMENT`, `PENDING`, `DELAYED`)
      y normalizar a un conjunto canónico.
- [ ] Definir el estado "terminal" correcto y la transición del lead (situación/pipeline) para cada caso.
- [ ] Garantizar que una recompra recupera/enlaza la transacción previa sin duplicar ni romper la secuencia.
- [ ] Tests de integración de la secuencia aprobada → cancelada → recompra.

**Terminado cuando:**
- Una transacción cancelada/expirada/abandonada deja el lead en el estado esperado y no queda "colgada".
- Una recompra posterior se enlaza a la transacción previa (trazabilidad) y la secuencia es consistente.
- `make check` en verde.

**Riesgos / dependencias:**
- Alta sensibilidad (afecta facturación). Requiere fixture de producción y aprobación de David antes de
  marcar la fase.

---

## Fase 5 — Importación de ventas externas / manuales (req 5)

**Objetivo:** permitir importar ventas externas (fuera de Hotmart/Centralize) como ventas manuales.

**Ámbito:** `sales` (import CSV), `packages/contracts` (schema del CSV), frontend de importación.

**Tareas:**
- [ ] Definir el formato CSV (columnas: producto, monto, moneda, fecha, closer/afiliado, estado, etc.)
      validado con Zod.
- [ ] Endpoint de importación con `source=MANUAL` (o `EXTERNAL`), respetando idempotencia
      (`@@unique([source, externalOrderId, externalTxnId])`).
- [ ] Frontend: subida + previsualización + errores por fila (no import parcial silencioso).
- [ ] Tests: CSV de ejemplo importa N filas; duplicados se rechazan sin efectos laterales.

**Terminado cuando:**
- Se importa un CSV de ventas externas y las ventas quedan con `source=MANUAL/EXTERNAL` y atribución correcta.
- Duplicados (mismo `source+order+txn`) no generan ventas repetidas.
- `make check` en verde.

**Riesgos / dependencias:**
- Depende de **F3** para atribuir correctamente las ventas externas (afiliado/closer).

---

## Fase 6 — Edición de transacciones y trazabilidad encadenada (req 9, 10)

**Objetivo:** editar datos de una transacción (incluida la fecha) y encadenar manualmente su trazabilidad.

**Ámbito:** `sales` (migración + servicio), `packages/contracts`, frontend de detalle de transacción.

**Tareas:**
- [ ] Migración: añadir columna editable de fecha de transacción (ej. `transaction_date` `timestamptz`)
      con `COMMENT ON`; y columna de enlace de trazabilidad (ej. `parent_sale_id` UUID lógico) con índice.
- [ ] Endpoint `PATCH` de edición (producto, monto, closer, estado, fecha) con validación Zod y guard RBAC.
- [ ] Endpoint/acción para encadenar una transacción a otra (relación padre/hija) y exponerla en la vista.
- [ ] Frontend: formulario de edición + selector "encadenar a transacción" con los cuatro estados de UI.
- [ ] Tests: editar fecha persiste; encadenar se refleja en la lectura de trazabilidad.

**Terminado cuando:**
- Se edita una transacción (incluida su fecha) y el cambio persiste y es visible.
- Se encadena manualmente una transacción a otra y la relación aparece en la vista de trazabilidad.
- Migración aplicada + `COMMENT ON` presente + `make check` en verde.

**Riesgos / dependencias:**
- Migración de schema (requiere confirmación explícita para aplicar). La fecha editable no debe pisar
  `createdAt` (auditoría) ni romper los cálculos de KPI (decidir qué fecha usa el agregado).

---

## Fase 7 — Botones de copiado instantáneos (req 8)

**Objetivo:** que todos los botones de copiado copien al primer click sin retardo perceptible.

**Ámbito:** frontend (`admin/projects/[id]`, `admin/users`, `director/team` y cualquier otro botón de copia).

**Tareas:**
- [ ] Inventariar todos los botones de copia y su implementación actual.
- [ ] Unificar en un hook/componente (`useCopy`) que use `navigator.clipboard.writeText` con feedback
      inmediato (check) y fallback síncrono.
- [ ] Eliminar cualquier `setTimeout`/retardo innecesario en el disparo.

**Terminado cuando:**
- Todo botón de copia copia en el primer click con feedback visual inmediato (verificación manual de David).

**Riesgos / dependencias:**
- Solo frontend; verificar en navegadores objetivo (Chrome) y permiso de portapapeles.

---

## Fase en curso

- **Fase:** F1 — Filtros, paginación y contadores de listados (req 1, 3, 7, 11, 12).
- **Objetivo:** filtros por día/origen/producto/closer/estado, paginación keyset y contador "Total de N"
  en leads, transacciones y ventas; filtro por día en el dashboard.
- **Terminado cuando:** ver criterios de F1. (F3.1 queda pendiente y se retoma después de F1.)

## Historial

- **F0 — Higiene de métricas:** ✅ APROBADO (`correcciones.md`). Refresco de MVs tras escritura +
  `normalize-sale-status` (`PURCHASE_REFUNDED`/`REEMBOLSADO` → `REFUNDED`) + loop de 1 min.
- **F3 — Atribución afiliado vs SCK:** ✅ APROBADO (webhook + CSV). `resolveAttribution` + eliminación del
  fallback a `lead.closerId` en `processEvent` e `importSaleCsv`.
- **F3.1 — Backfill de atribución:** pendiente (se retoma tras F1).
