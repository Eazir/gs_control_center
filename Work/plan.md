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
| Fix | Filtro "Por Asignar" no filtra | **F8** |
| Fix | Filtro de etapas del pipeline no filtra | **F8** |
| Fix | Selector de calendario + día vs rango mutuamente excluyentes | **F8** |
| Fix | Pipeline: 20 tarjetas por etapa + total en el encabezado | **F8** |
| Fix | Sidebar global de filtros (pipeline/leads/ventas/transacciones) | **F8** |
| Fix | Velocidad de carga + recarga dinámica por pestaña | **F8** |

> Estas fases caen dentro de las fases macro 4 (Ingesta de ventas) y 5 (KPIs/metas/comisiones) de
> `PLAN_DE_ACCION.md`, más retoques de UX (F7) y data-entry (F5/F6). El detalle del fix de métricas está
> documentado en `fix-metricas-mv.md` (referencia para `instructions.md`).

### Orden de ejecución recomendado

`F0 → F3 → F3.1 → F1 → F2 → F8 → F4 → F5 → F6 → F7`

- **F8** corrige defectos de UX/rendimiento de F1/F2 que David está viendo en la plataforma (filtros que no
  funcionan, pipeline incompleto, falta de sidebar global y lentitud). Va **antes de F4–F7** por prioridad.

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

## Fase 8 — Correcciones de UX: filtros globales, pipeline y rendimiento

**Motivación:** seis defectos reportados por David sobre el panel del proyecto, detectados en el código.
Se documentan las **causas raíz** para que Antigravity no tenga que re-descubrirlas.

### Causas raíz (diagnóstico)

| # | Ítem reportado | Causa raíz en el código |
|---|---|---|
| 1 | "Por Asignar" no filtra | El backend no expresa "sin closer": `ListFiltersSchema.closerId` es `uuid` puro. El frontend además usa centinelas inconsistentes: pipeline usa `"none"`, base de leads usa `"Por Asignar"`, y `loadLeads` (línea 475) **descarta** explícitamente `"Por Asignar"`. El match client-side (`filteredLeads`/`filteredBaseLeads`, líneas 1537/1571) solo compara contra `"none"`. |
| 2 | Filtro de etapas no filtra | `stageFilter` solo existe en cliente (líneas 1538/1572); **nunca** se envía al backend en `loadLeads`. No hay filtro `stage` en el contrato ni en `buildLeadWhereClause`. |
| 3 | Fecha con calendario + día vs rango | Backend ya soporta `from`/`to` (`buildDateRange`), pero el frontend solo manda `day` y con `<input type="date">`. No hay exclusividad día ↔ rango. |
| 4 | Pipeline no muestra 20 por etapa + total en encabezado | El kanban lee `filteredBaseLeads` (línea 1908), que es la **página paginada** de `baseLeads` (`limit = 20×etapas` en total, repartido entre etapas), no una consulta por etapa. El badge del encabezado muestra `stageLeads.length` (lo cargado), no el total filtrado real. |
| 5 | Filtros en sidebar global | El estado de filtros está **triplicado**: `page.tsx` (`leadOriginFilter`/`leadStatusFilter`/`leadProductFilter`/`closerFilter`/`stageFilter`/`leadDayFilter`/`leadSearch`) + `SalesView` (`originFilter`/`statusFilter`/`productFilter`/`closerFilter`/`dayFilter`/`searchTerm`) + `TransactionsView` (ídem). Cada uno con su `fetchWithAuth` y su `window.history.replaceState`. |
| 6 | Velocidad + recarga dinámica | `loadLeads` dispara **3** endpoints (`/sales`, `/leads`, `/transactions`) en el arranque y en cada cambio de filtro (deps, línea 577). No hay caché ni invalidación: cada mutación (mover lead, crear venta, cambiar estado, importar) exige "Refrescar" manual. `SalesView`/`TransactionsView` también fetchean al montar. |

### Mapa ítem → entrega

| Ítem | Entrega |
|---|---|
| 1 (Por Asignar) + 2 (etapas) | **F8.1** (backend) |
| 4 (pipeline 20/etapa + total) | **F8.2** (usa endpoint de F8.1) |
| 3 (calendario) + 5 (sidebar) | **F8.3** (frontend) |
| 6 (rendimiento) | **F8.4** (frontend) |

---

### F8.1 — Backend: filtros "sin asignar" y "etapa" + endpoint de pipeline

**Objetivo:** dar soporte en servidor a los filtros que hoy no existen y a un endpoint de pipeline que
devuelva, por etapa, el total filtrado y las primeras 20 tarjetas.

**Ámbito:** `packages/contracts/src/sales/sales.ts` (`ListFiltersSchema`), `apps/api/src/core/sales/list-filters.ts`
(`buildLeadWhereClause`, `buildSaleWhereClause`), `apps/api/src/modules/sales/sales.service.ts` +
`sales.controller.ts` (`listLeads` + nuevo `listPipeline`).

**Tareas:**
- [ ] Contratos: añadir a `ListFiltersSchema` `stage: z.string().optional()` y
      `unassigned: z.coerce.boolean().optional()`. Se mantiene `closerId` (uuid) para closer concreto.
- [ ] `buildSaleWhereClause`: `unassigned` → `closerId: null`; `stage` → `pipelineStage: filters.stage`.
- [ ] `buildLeadWhereClause`: `unassigned` → `AND: [{ closerId: null }, { NOT: { sales: { some: { closerId: { not: null } } } } }]`;
      `stage` → `pipelineStage: filters.stage`. (Ambos modelos tienen `pipelineStage`, ver schema.)
- [ ] Nuevo endpoint `GET /sales/project/:projectId/pipeline` → `{ stages: [{ stageId, name, total, items: primeros 20 }], totalLeads }`,
      reusando `buildLeadWhereClause` (misma fuente de verdad de where). Respeta RLS/rol CLOSER. `total` por
      etapa = conteo completo filtrado; `items` = primeras 20 por etapa (orden `createdAt DESC, id DESC`).
- [ ] Ampliar `test/verify-list-filters.ts` con casos `unassigned` y `stage`.

**Terminado cuando:**
- `GET .../leads?unassigned=true` devuelve solo leads sin closer (y sin ventas con closer).
- `GET .../leads?stage=won` devuelve solo leads en esa etapa.
- `GET .../pipeline` devuelve por etapa el `total` completo y las primeras 20 tarjetas.
- `make check` en verde.

**Riesgos:**
- Definir "sin asignar" (sin closer en el lead **y** sin ventas con closer) y documentarlo en TSDoc.
- El endpoint de pipeline debe reusar `buildLeadWhereClause` para no desincronizar total vs tarjetas.

---

### F8.2 — Pipeline: 20 tarjetas por etapa + total en el encabezado

**Objetivo:** que el kanban consuma el endpoint por etapa de F8.1 (no la página paginada) y muestre el total
real de cada etapa en su encabezado, que solo cambia al aplicar un filtro.

**Ámbito:** `apps/web/src/app/admin/projects/[id]/page.tsx` (render kanban ~1907–2076 y estado asociado).

**Tareas:**
- [ ] Reemplazar el origen de datos del kanban: de `filteredBaseLeads` a un nuevo estado `pipelineData`
      (resultado de `/pipeline`).
- [ ] Encabezado de etapa muestra `stage.total` (no `stageLeads.length`).
- [ ] Tarjetas: render de `stage.items` (ya limitadas a 20 en backend). Eliminar `slice(0, 20)` local y el
      "+N ocultos" basado en el conteo local; mostrar "+N prospectos ocultos" con `N = total - 20` si `total > 20`.
- [ ] El "Total Leads" del toolbar usa `totalLeads` del endpoint (filtrado), no `filteredBaseLeads.length`.
- [ ] El badge de la pestaña Pipeline usa el total filtrado coherente.

**Terminado cuando:**
- Cada etapa muestra hasta 20 tarjetas y su total real en el encabezado.
- El total por etapa solo cambia al aplicar un filtro (no al paginar/scroll).
- Al mover un lead de etapa, origen y destino actualizan sus totales vía invalidación (F8.4).

---

### F8.3 — Sidebar global de filtros + selector de calendario

**Objetivo:** un único sidebar a la izquierda con todos los filtros, compartido entre pipeline, base de
leads, ventas y transacciones (no en métricas), y un selector de fecha por calendario con día ↔ rango
mutuamente excluyentes.

**Ámbito:** `page.tsx`, `SalesView.tsx`, `TransactionsView.tsx`; nuevo componente `ProjectFilterSidebar`
(+ contexto `ProjectFiltersContext` o estado liftado a `page.tsx`).

**Tareas:**
- [ ] Extraer el estado de filtros a una sola fuente. Campos: `search`, `origin`, `status`, `productId`,
      `closer` (`ALL | UNASSIGNED | uuid`), `stage`, `day`, `from`, `to`.
- [ ] Crear `<ProjectFilterSidebar>` a la izquierda (fuera de las pestañas), visible en
      pipeline/leads/sales/transactions; oculto en metrics/settings.
- [ ] Eliminar las barras de filtros de: pipeline (toolbar ~1844–1903), base de leads (~2086–2283),
      `SalesView` y `TransactionsView` (quitar su estado local y su `window.history.replaceState`).
- [ ] `SalesView`/`TransactionsView` pasan a recibir los filtros por props/contexto (controlados).
- [ ] Selector de calendario (popover) en vez de `<input type="date">`; dos modos excluyentes:
      "día específico" (`day`) y "rango" (`from`/`to`). Elegir día desactiva from/to y viceversa.
- [ ] Sincronizar filtros a la URL (query params) en **un solo punto**, preservando compartir/enlazar.

**Terminado cuando:**
- Una sola barra lateral izquierda con todos los filtros, compartida entre las 4 pestañas.
- Métricas NO muestra el sidebar (usa sus propios filtros).
- El selector de fecha usa calendario; "día" desactiva desde/hasta y viceversa; los filtros persisten al
  cambiar de pestaña y se reflejan en todas.

---

### F8.4 — Rendimiento: carga diferida y recarga dinámica

**Objetivo:** caché por filtros, carga diferida por pestaña e invalidación tras mutaciones, para que solo
se cargue el contenido necesario y las vistas se actualicen solas al generarse cambios.

**Ámbito:** `page.tsx`, `SalesView.tsx`, `TransactionsView.tsx`, `DashboardView.tsx` (solo lo que toca).

**Tareas:**
- [ ] Sustituir los `fetchWithAuth` ad-hoc por hooks con caché (`useSWR`), keyed por `${endpoint}?${filters}`,
      en las vistas de listado y el pipeline.
- [ ] Carga diferida por pestaña: cada vista consulta solo al montarse (pestaña activa). Evitar que
      `loadLeads` dispare `sales`+`leads`+`transactions` en el arranque si la pestaña activa es métricas/settings.
- [ ] Invalidación en mutaciones: mover lead de etapa, crear lead, crear/editar venta, cambiar estado,
      importar CSV → `mutate` de las keys afectadas (prefijo `/sales/project/:id/...`).
- [ ] Confirmar que el cambio de pestaña y la recarga no hacen reload completo (eliminar `router.push`/
      `window.location` para cambiar de vista si existe; ya se usa `setMainView`).
- [ ] Tipar las estructuras intermedias del refactor (eliminar los `any` de `leadsList`, `sale`, etc.).

**Terminado cuando:**
- Cambiar de pestaña no refetchea datos ya cacheados (cache por filtros) y es perceptiblemente más rápido.
- Tras mover un lead o crear una venta, las vistas afectadas se recargan solas (sin "Refrescar" manual).
- El arranque del proyecto no dispara las 3 consultas si la pestaña activa es métricas.
- `make check` en verde y sin `any` nuevo.

**Riesgos:**
- Elegir SWR (liviano, de baja fricción) frente a React Query; el proyecto ya usa REST con `fetchWithAuth`.
- Invalidar por prefijo de key para no dejar vistas stale tras mutaciones.

---

## Fase en curso

- **Fase:** F8 — Correcciones de UX: filtros globales, pipeline y rendimiento.
- **Objetivo:** corregir los 6 defectos de UX/rendimiento (filtros, pipeline, sidebar y velocidad).
- **Terminado cuando:** ver criterios de F8.1–F8.4.

## Historial

- **F0 — Higiene de métricas:** ✅ APROBADO (`correcciones.md`). Refresco de MVs tras escritura +
  `normalize-sale-status` (`PURCHASE_REFUNDED`/`REEMBOLSADO` → `REFUNDED`) + loop de 1 min.
- **F3 — Atribución afiliado vs SCK:** ✅ APROBADO (webhook + CSV). `resolveAttribution` + eliminación del
  fallback a `lead.closerId` en `processEvent` e `importSaleCsv`.
- **F1 — Filtros, paginación y contadores:** ✅ APROBADO (commit `d06ca89`).
- **F3.1 — Backfill de atribución:** ✅ APLICADO (21 cambios: 10 `closer_id` + 11 `attribution`; idempotente, `dh` corregido).
- **F2 — KPIs por origen:** ✅ APROBADO (commit `74b5595`). `origins.comercial/marketing` con volumen/bruta/neta.
- **F8 — Correcciones de UX (filtros/pipeline/sidebar/rendimiento):** 🔄 en curso.
