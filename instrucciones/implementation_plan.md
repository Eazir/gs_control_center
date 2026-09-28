# Plan Integral de Implementación: GrowthSell Centro de Mando

**Fecha de actualización:** 26/09/2026  
**Reglas del Sistema:** Arquitectura modular (`AGENTS.md`, `integration-adapter`, `sales`, `projects`, `pipeline`), TypeScript estricto (`strict: true`), cero `any`, RLS/RBAC defensivo, ingestor de eventos asíncrono con BullMQ/Redis e idempotencia absoluta.

---

## Estado Global del Proyecto

| Fase | Descripción | Estado |
| :--- | :--- | :--- |
| **Fase 1** | Catálogo de Productos y Edición de Existentes | **COMPLETADO (Hecho)** |
| **Fase 2** | Ingesta y Admisión de Webhooks con Productos Activos y SCK | **COMPLETADO (Hecho en Backend)** |
| **Fase 3** | Idempotencia de Comprador (Lead) y Transacción (Sale) | **COMPLETADO (Hecho en Backend)** |
| **Fase 4** | Separación de Vistas "Ventas" vs "Transacciones" y RBAC | **COMPLETADO (Hecho)** |
| **Fase 5** | Modal de Detalle de Transacción y Trazabilidad | **COMPLETADO (Hecho)** |
| **Fase 6** | Pipeline Basado en Estados de Compra (5 Columnas Canónicas) | **COMPLETADO (Hecho)** |
| **Fase 7** | Importación de Leads y Ventas vía CSV con Mapeador Dinámico | **PENDIENTE** |
| **Fase 8** | Modelo Multi-Transacción y Multi-Producto por Lead | **PENDIENTE** |
| **Fase 9** | Matriz Defensiva de Roles, Permisos y Filtros Avanzados | **PENDIENTE** |
| **Fase 10** | Paneles de Métricas Comerciales y Liquidación de Comisiones | **PENDIENTE** |
| **Fase 11** | Rebranding de Marca: "GrowthShell" a "GrowthSell" | **PENDIENTE** |

---

## Fase 1: Catálogo de Productos y Edición de Productos Existentes
**Objetivo:** Permitir gestionar integralmente los productos del proyecto, incluyendo modificar productos ya existentes.

- [x] **Contratos (`packages/contracts`):**
  - Añadido `sck: z.string().optional().nullable()` en `ProductItemSchema`, `CreateProductInputSchema` y `UpdateProductInputSchema`.
  - Sincronizados tipos en `packages/contracts/dist/` (tipos de entrada y salida) para que `apps/api` y `apps/web` compilen sin errores de tipo.
- [x] **Backend (`apps/api/src/modules/projects`):**
  - Endpoint `PATCH /projects/:id/products/:productId` con guardias de seguridad (`SUPER_ADMIN`, `ADMIN` o Director del proyecto).
  - Casos de uso `AddProductUseCase` y `UpdateProductUseCase` actualizados para persistir `sck` en la entidad y base de datos.
- [x] **Frontend (`apps/web`):**
  - Tipado de productos en frontend asegurando disponibilidad de `sck` (`ProjectProduct`).
  - Botón de **Edición** (`Pencil`) en cada fila de la tabla del catálogo de productos.
  - Modal dinámico de producto: precarga de campos existentes al editar, ajuste dinámico de títulos y botones ("Editar Producto del Catálogo" / "Guardar Cambios" vs "Añadir Producto" / "Agregar Producto").
  - Validación de código de oferta único **únicamente entre productos activos** (permitiendo reutilizar ofertas si el anterior está inactivo).
  - Botón de activación/desactivación rápida del producto (`active: boolean`).
  - **Validación Preventiva de Eliminación:** Bloqueo de eliminación física (`DELETE`) en Backend (`RemoveProductUseCase`) y Frontend si el producto tiene transacciones históricas registradas (`salesCount > 0`), sugiriendo su desactivación para proteger la integridad contable y de auditoría.

---

## Fase 2: Ingesta y Admisión Estricta de Webhooks en Worker (`integrations` & `sales`)
**Objetivo:** Recibir webhooks en <100ms y filtrar las ventas admitiendo **únicamente productos activos**, respetando fecha de corte y SCK.

- [x] **Adaptador Hotmart (`HotmartAdapter`):**
  - Extracción de SCK en todas las variantes de Hotmart:
    1. `data.purchase.origin.sck` (compras reales).
    2. `data.purchase.sckPaymentLink` (entorno de pruebas / sandbox).
    3. `data.purchase.tracking.source_sck` / `sck` (parámetros UTM y tracking de URL).
  - Soporte de eventos de carritos abandonados (`PURCHASE_OUT_OF_SHOPPING_CART` con `data.offer.code`).
- [x] **Worker de Admisión (`SalesService.processEvent`):**
  - **Filtro de Fecha de Corte:** Si la transacción es anterior a `validFrom` de la integración, se descarta como `SKIPPED_BY_DATE`.
  - **Filtro Exclusivo de Productos ACTIVOS:** Se consultan los productos del proyecto mediante `ListProjectProductsUseCase` y se filtran únicamente aquellos con `p.active === true`. Si el `offerCode` no coincide con ningún producto activo, se descarta como `SKIPPED_UNKNOWN_PRODUCT`.
  - **Validación de SCK:** Si el producto activo tiene configurado un `sck`, se valida estrictamente contra el SCK entrante del webhook. Si el producto activo no tiene `sck`, se admite si coincide el `offerCode`.
  - **Valores Oficiales del Proyecto:** El `productName`, `amount` (`price`), `currency` e `installments` de la venta se extraen del producto oficial del proyecto (`ProductItem`), ignorando montos o descripciones variables de Hotmart.
  - **Atribución Comercial:** Asignación del `closerId` a partir del propietario configurado en el producto (`ownerCloserId`) o por coincidencia de email/ID en el SCK.

---

## Fase 3: Idempotencia de Leads y Transacciones (`sales`)
**Objetivo:** Garantizar que los compradores y transacciones se creen o actualicen de forma determinista y sin duplicados.

- [x] **Comprador (`Lead`):**
  - Búsqueda por `(projectId, email)`. Si no existe, se crea con sus datos (`name`, `email`, `phone`, `closerId`, `pipelineStage`). Si ya existe, se actualizan sus datos y fecha de interacción sin duplicar registros.
- [x] **Transacción (`Sale`):**
  - Búsqueda por clave única `(source, externalOrderId, externalTxnId)`.
  - Si es nueva: se inserta la transacción con datos oficiales, `offerCode`, `sck`, `closerId`, cuotas y metadata.
  - Si ya existía: se actualiza su estado (por ejemplo, de `PENDING` a `APPROVED`, o `REFUNDED` / `CHARGEBACK`), cuotas y metadata con marca de tiempo `updatedAt`, evitando excepciones `DUPLICATE`.

---

## Fase 4: Separación de Vistas "Ventas" vs "Transacciones" y RBAC
**Objetivo:** Separar las ventas cerradas de la trazabilidad global de transacciones, con control de acceso por rol.

- [x] **Backend (`SalesController` & `SalesService`):**
  - Endpoint `GET /sales/project/:id`: Retorna exclusivamente ventas en estado `APPROVED` o `COMPLETE`. Si el usuario solicitante es `CLOSER`, retorna únicamente sus ventas asignadas (`closerId === user.sub`).
  - Endpoint `GET /sales/project/:id/transactions`: Retorna todas las transacciones admitidas (aprobadas, pendientes, reembolsos, carritos abandonados, cuotas). Protegido con guardia RBAC: **prohibido para `CLOSER` (`403 Forbidden`)**, accesible únicamente para `DIRECTOR`, `ADMIN` y `SUPER_ADMIN`.
- [x] **Frontend (`apps/web`):**
  - Pestaña **Ventas**: Vista centrada en ingresos aprobados, métricas financieras y comisiones.
  - Nueva pestaña **Transacciones**:
    - Visible en la barra superior únicamente si `effectiveRole !== 'CLOSER'`.
    - Tabla con todas las transacciones admitidas: Fecha, Lead/Comprador, Producto Oficial, Código de Transacción (`externalTxnId`), Estado con badge semántico (verde para `APPROVED`, amarillo para `PENDING`, rojo para `REFUNDED`, etc.), Cuotas y Monto oficial.
    - Buscador integrado por nombre/email de comprador o código de transacción.

---

## Fase 5: Modal de Detalle de Transacción y Trazabilidad
**Objetivo:** Inspeccionar en profundidad cualquier transacción al hacer clic en una fila de la tabla de transacciones o ventas.

- [x] **Componente `TransactionDetailModal`:**
  - **Datos del Comprador:** Nombre, email, teléfono y botón para ir a su perfil en el pipeline.
  - **Datos de la Transacción:** Código de transacción de Hotmart (`externalTxnId`), orden externa (`externalOrderId`), fecha/hora exacta, estado actual con badge y método de pago.
  - **Producto Oficial del Proyecto:** Nombre en catálogo, precio oficial, moneda, cuotas oficiales configuradas, código de oferta asociado y SCK configurado en el producto.
  - **Atribución Comercial:** Closer asignado (nombre/email) o indicación de venta orgánica / sin asignar.
  - **Trazabilidad y Metadata Técnica:** Visualizador de metadatos del webhook recibido para auditoría técnica.

---

## Fase 6: Modificación del Pipeline Comercial (5 Columnas Canónicas por Estado)
**Objetivo:** Rediseñar el pipeline Kanban eliminando porcentajes de probabilidad y estructurándolo estrictamente por el estado del proceso de compra del lead.

- [x] **Estructura Canónica de 5 Columnas (Sin Porcentajes):**
  1. **Ganado:**
     - Leads marcados manualmente como "Ganado" (persiste en la BD inmediatamente).
     - O leads con transacciones atribuidas en estado `APPROVED` o `COMPLETE` ("Compra completa" o "Compra aprobada").
     - **Filtro por Forma de Pago:**
       - De contado (1 cuota Hotmart).
       - En cuotas (>1 cuota Hotmart: 2, 3, etc.).
       - *Regla crítica:* Se consideran las cuotas registradas en Hotmart (`purchase.installments_number`), no las cuotas bancarias que el cliente haya pactado internamente con su tarjeta de crédito.
  2. **Perdido:**
     - Leads marcados manualmente como "Perdido".
     - O leads con transacciones atribuidas en estado `REFUNDED` o `DISPUTE` ("Pedido de reembolso" o "Compra reembolsada").
  3. **Para recuperación:**
     - Leads con transacciones atribuidas en estado `ABANDONED_CART`, `CANCELED`, `CHARGEBACK` o `EXPIRED` ("Compra con plazo vencido").
  4. **Sin contactar:**
     - Leads sin transacciones asociadas. Estado predeterminado inicial de todo nuevo lead ingresado manualmente o por importación.
  5. **En seguimiento:**
     - Leads marcados manualmente en este estado.
     - O leads con transacciones en estado `WAITING_PAYMENT`, `DELAYED` o `BILLET_PRINTED` ("A la espera de pago" o "Compra atrasada").
- [x] **Lógica de Persistencia y Transición:**
  - Arrastrar un lead a una columna (o cambiar su selector de estado) actualiza `leads.pipeline_stage` en Postgres vía API.
  - Cuando entra un webhook de venta o actualización de transacción, el lead transiciona automáticamente a la columna correspondiente (por ejemplo, pasa a "Ganado" al aprobarse la compra).

---

## Fase 7: Importación de Leads y Ventas vía CSV con Mapeador Dinámico de Columnas
**Objetivo:** Permitir cargar leads y ventas masivas adjuntando un archivo `.csv` y mapeando interactivamente las columnas.

- [ ] **Componente de Carga y Mapeo en Frontend:**
  - Input para subir archivo `.csv` con parsing local inmediato de encabezados y primeras 3 filas de vista previa.
  - Interfaz de emparejamiento (Mapping Selector):
    - **Importación de Leads:** Selector para mapear qué columna del CSV corresponde a `Nombre`, `Email`, `Teléfono`, `Closer Asignado` (opcional) y `Producto de Interés` (opcional).
    - **Importación de Ventas:** Selector para mapear `Email del Comprador`, `Nombre del Comprador`, `Producto`, `Monto`, `Moneda`, `Fecha`, `Código de Transacción` y `Closer`.
  - Validación con esquema Zod antes del envío por lotes al backend.
- [ ] **Endpoints de Ingesta Masiva en Backend:**
  - `POST /pipeline/projects/:id/leads/import-csv`: Ingesta por lotes con deduplicación por email, asignación por defecto a columna "Sin contactar" y validación de límites.
  - `POST /sales/projects/:id/import-csv`: Ingesta por lotes de transacciones históricas con verificación de unicidad por transacción.

---

## Fase 8: Modelo Multi-Transacción y Multi-Producto por Lead
**Objetivo:** Permitir que un mismo lead pueda tener múltiples compras independientes de diferentes (o iguales) productos a lo largo del tiempo.

- [ ] **Persistencia y Separación de Transacciones:**
  - Relación `Lead (1) -> Sale (N)` en el esquema `sales`.
  - Cada compra posee su propio registro con su propio `productId`, `productName`, `amount`, `installments`, fecha y estado.
- [ ] **Visualización en UI:**
  - En la ficha del lead, mostrar el historial cronológico completo de todas sus compras y carritos.
  - En el pipeline mostrar una tarjeta por cada transaccion/producto que esta inetendo adquirir el lead si por ejemplo ya compro un producto pero quiere comprar otro se debe mostrar una tarjeta por cada producto para no generar conflictos de estado.
  - En las tablas de Ventas y Transacciones, cada transacción figura de forma individual y auditable.

---

## Fase 9: Matriz Defensiva de Roles, Permisos y Filtros Avanzados
**Objetivo:** Aislar los datos entre closers y permitir control global a los administradores y directores.

- [ ] **Permisos del Rol CLOSER:**
  - Vistas permitidas dentro de un proyecto: únicamente `pipeline`, `leads` (Base de Leads) y `sales` (Ventas).
  - **Aislamiento estricto:** Solo ve sus propios leads asignados (`closerId === user.sub`) y sus propias ventas asignadas. Jamás ve datos de otros closers ni leads huérfanos.
  - **Filtros disponibles para Closers:** Filtrado por producto, por cantidad de cuotas (contado vs cuotas) y por estado del lead.
- [ ] **Permisos de SUPER_ADMIN, ADMIN y DIRECTOR:**
  - Acceso total a todas las vistas (incluyendo Ajustes, Integraciones, Catálogo de Productos y Transacciones).
  - Directores: Acceso a todos los leads y ventas de los proyectos donde figuren como directores o miembros con rol `DIRECTOR`.
  - Super Admin y Admin: Acceso cross-project a todo el sistema.
  - **Filtros avanzados:** Además de filtrar por producto, cuotas y estados, pueden filtrar por **Closer asignado** y aplicar el filtro específico **"Leads sin closer"**.

---

## Fase 10: Paneles de Métricas Comerciales y Liquidación de Comisiones
**Objetivo:** Proveer visualización analítica de KPIs de facturación, tasas de conversión y liquidación de comisiones escalonadas.

- [ ] **10.1 Panel de Métricas de Proyecto:**
  - Facturación bruta y neta del proyecto.
  - Tasa de conversión de leads por etapa del pipeline.
  - Ranking de closers por volumen facturado y efectividad de cierre.
- [ ] **10.2 Panel de Métricas Globales:**
  - Vista agregada para `SUPER_ADMIN` y `ADMIN` consolidando todos los proyectos de la plataforma.
  - Vista agregada para `DIRECTOR` consolidando únicamente los proyectos que tiene asignados.
- [ ] **10.3 Panel de Métricas Interno de Proyectos:**
  - Tiempos promedio de permanencia de leads por estado antes de la compra o descarte.
  - Distribución de ventas por producto oficial y forma de pago (contado vs cuotas).
- [ ] **10.4 Paneles de Ganancias y Comisiones:**
  - Cálculo de comisiones en base a la configuración comercial (`commissionConfig`) y tiers alcanzados.
  - Desglose de comisiones para la Empresa, el Director, los Closers individuales y porcentaje de costos externos.
  - Vista de comisiones global y desglosada por proyecto para cada usuario.

---

## Fase 11: Rebranding de Marca: "GrowthShell" a "GrowthSell"
**Objetivo:** Corregir y unificar todos los textos y títulos de la plataforma para reflejar el nombre de marca oficial "GrowthSell".

- [ ] Auditoría y reemplazo sistemático en `apps/web`: Títulos de páginas, barra de navegación, menús laterales, diálogos, alertas y copys.
- [ ] Auditoría y reemplazo en `apps/api`: Mensajes de error amigables, encabezados de logs y correos transaccionales.
- [ ] Auditoría en documentación pública y manuales de usuario.

---

## Criterios de Aceptación (Definition of Done)
1. Modificación de productos funcionales en la UI y sincronizados en base de datos.
2. Los webhooks con `offerCode` de productos inactivos son rechazados y no crean transacciones ni alteran métricas.
3. El `sck` entrante en cualquiera de sus 3 formas se valida fielmente contra el producto activo.
4. Las transacciones usan el nombre y precio oficial del catálogo del proyecto.
5. Los leads y transacciones existentes se actualizan adecuadamente sin generar duplicados.
6. El pipeline opera con las 5 columnas canónicas por estado y con filtro de cuotas Hotmart.
7. Importador CSV con interfaz para mapear columnas antes de procesar.
8. Un lead puede tener múltiples transacciones de distintos productos manejadas independientemente.
9. El rol `CLOSER` únicamente ve sus propios leads y ventas; `ADMIN`/`DIRECTOR` pueden filtrar por closer y ver leads sin asignar.
10. Paneles de métricas de proyecto, globales y comisiones calculadas con exactitud matemática.
11. Ningún texto de la interfaz muestra "GrowthShell", todos reflejan "GrowthSell".
12. `pnpm typecheck` pasa sin ningún error TypeScript en todo el monorepo.
