# Módulo Sales (Ventas y Transacciones)

## Responsabilidad
El módulo de `Sales` es el motor financiero y transaccional de GrowthSell. Se encarga de procesar asíncronamente los eventos de integración (como webhooks de Hotmart), garantizar la idempotencia de las transacciones, y gestionar el catálogo de compradores (`Lead`) y sus transacciones (`Sale`).

## Fronteras y Dependencias
- **Integrations:** Recibe cargas útiles (webhooks) registradas por el módulo de integraciones a través de una cola en Redis (implementación en Worker).
- **Projects:** Consulta el catálogo de productos oficiales del proyecto (mediante `ListProjectProductsUseCase`) para validar y admitir ventas.
- **Auth:** Consulta `AuthPublicService` para enriquecer la respuesta visual y mapear `closerId` a los perfiles de los usuarios (nombre, correo).
- **Contratos:** Comparte la estructura de datos `RawSale` y `SaleListItem` a través de `@gs/contracts`.

## Arquitectura de Ingesta (El Worker)
El servicio `SalesService` actúa con el rol de `worker` (además de `api` para endpoints). 
Al iniciar, drena eventos estancados (`processPendingEvents`) y queda a la escucha de `queue:integration_events` en Redis.

### Política de Admisión (Filtro Estricto)
1. **Fecha de Corte:** Rechaza transacciones ocurridas antes del `validFrom` configurado en la integración.
2. **Productos Activos:** El webhook debe tener un `offerCode` que exista en el catálogo de productos del proyecto y **el producto debe estar activo**. Si no, se rechaza (`SKIPPED_UNKNOWN_PRODUCT`).
3. **SCK (Source Tracking):** Si el producto en la base de datos requiere un `sck` específico, la transacción se rechaza a menos que el webhook contenga exactamente dicho `sck` en su origen (soporta sck nativos, links de pago y tracking).
4. **Idempotencia:** Localiza la transacción en la BD usando la clave `(source, externalOrderId, externalTxnId)`. Si existe, la actualiza; si no, la crea. Nunca rompe por violaciones de clave única duplicada.

## Modelos Principales

### Lead (Comprador)
Representa a la persona o entidad que interactúa comercialmente.
- Búsqueda / Deduplicación por `(projectId, email)`.
- Solo se actualizan datos si la nueva interacción es más reciente o complementaria.

### Sale (Transacción)
Representa cada evento financiero histórico. Un Lead puede tener N Sales.
- **Ventas Efectivas:** Estado `APPROVED` o `COMPLETE`.
- **Trazabilidad:** Almacena también transacciones fallidas, reembolsos, carritos abandonados o pagos en cuotas atrasadas.
- **Mapeo Fidedigno:** El valor financiero, moneda y número de cuotas se escriben basándose en la configuración oficial del `ProductItem` del proyecto, **no** en la información variable del webhook, protegiendo las métricas del dashboard de alteraciones externas.

## Endpoints

- `GET /sales/project/:projectId`
  Retorna exclusivamente ventas en estado `APPROVED` o `COMPLETE`. 
  *RBAC:* Si el usuario es `CLOSER`, aplica filtro RLS estricto para retornar solo aquellas transacciones cuyo `closerId` coincida con su identidad.

- `GET /sales/project/:projectId/transactions`
  Retorna **todas** las transacciones (trazabilidad completa).
  *RBAC:* Restringido. **Denegado para CLOSERs**. Requiere rol gerencial.

- `POST /sales/project/:projectId/leads/import-csv`
  Importa lotes de leads desde CSV, en chunks, con mapeo de columnas por el usuario.
  *RBAC:* Ingesta masiva. **Denegado para CLOSERs**: solo pueden crear leads individualmente
  desde su propio tablero, y no pueden asignarlos a otro closer.

- `POST /sales/project/:projectId/import-csv`
  Importa lotes de transacciones/ventas desde CSV.
  *RBAC:* Ingesta masiva. **Denegado para CLOSERs**: no pueden cargar ventas manualmente ni
  atribuir una venta a otro closer.

## Vistas de Interfaz
En el Frontend (`apps/web`), este módulo se refleja en:
- **SalesView (Ventas):** Vista orientada a desempeño y liquidación, restringida a ventas cerradas.
- **TransactionsView (Transacciones):** Tabla global de trazabilidad técnica (reembolsos, rechazos, pendientes).
- **TransactionDetailModal:** Panel de lectura pasiva para auditar cualquier transacción (quién la hizo, qué código de oferta usó, SCK, y el log JSON completo del webhook original).

En las vistas de Pipeline y Base de Leads, el filtro por closer y el botón **Importar CSV**
se ocultan cuando el rol efectivo es `CLOSER`. Como el backend ya fuerza `closerId = user.id`,
el filtro sería un no-op que además puede inducir a error (filtrar por "Sin Asignar" y creer que
faltan datos). El CLOSER tampoco puede registrar una venta a nombre de otro closer: el modal de
**Venta Manual** se autoasigna y muestra el nombre del propio usuario en lugar del selector.

## Extensibilidad Futura (Pendiente)
- Integración nativa con pasarelas como Stripe o GoHighLevel.
- Tableros analíticos (`kpi-metrics`).
- Sistema de columnas canónicas (Pipeline Kanban).
