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

`F0 → F3 → F1 → F2 → F4 → F5 → F6 → F7`

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

**Objetivo:** cambiar la regla de atribución del closer para que el **afiliado** tenga prioridad sobre el
**SCK**, con la excepción de "SCK de un closer + afiliado de marketing ⇒ gana el SCK".

**Ámbito:** `core/sales/affiliation.ts` + bloque de atribución en `sales.service.ts`.

**Tareas:**
- [ ] Aislar la regla en una función pura testeable (ej. `resolveAttribution({ sck, affiliates, sckOwner,
      isMarketingAffiliate })`).
- [ ] Implementar: afiliado (no marketing) ⇒ prioridad sobre SCK; excepción SCK-de-closer + afiliado-marketing.
- [ ] Reemplazar la lógica dispersa (hoy en `sales.service.ts` ~líneas 303–329) por la función única.
- [ ] Tests unitarios exhaustivos de la matriz de casos (afiliado comercial + sck ajeno; sck closer +
      afiliado marketing; sin afiliado; afiliado marketing solo; etc.).

**Terminado cuando:**
- La matriz de casos documentada pasa en tests unitarios.
- Una venta con afiliado comercial y SCK de otro closer se atribuye al afiliado; con SCK de closer +
  afiliado marketing se atribuye al closer.
- `make check` en verde.

**Riesgos / dependencias:**
- Regresión de atribución en ventas históricas: validar contra el dump de producción (no alterar ventas ya
  procesadas salvo que se defina explícitamente un backfill).

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

- **Fase:** F0 — Higiene de métricas (bug crítico, inmediato) → luego F1 (o F3 según se confirme).
- **Objetivo:** dejar el dashboard con métricas siempre actualizadas y, a continuación, abordar filtros/
  paginación/contadores (F1) y la atribución (F3).
- **Terminado cuando:** ver criterios de F0 y F1.

## Historial

- _(pendiente)_
