# Plan de Integración: Hotmart, Ventas y Base de Leads

De acuerdo a las reglas de la plataforma (`AGENTS.md` y `integration-adapter`), el sistema no debe acoplar el webhook directamente a la lógica de negocio síncrona. Se utilizará un modelo Ingestor -> Worker para asegurar que no se pierdan datos y se filtren correctamente.

## Fase 1: Configuración de la Integración (Módulo `integrations` & UI)
**Objetivo:** Permitir conectar Hotmart y recibir eventos de forma segura y ultrarrápida.

*   **Frontend (`apps/web`):**
    *   Crear interfaz en la pestaña **Panel de Control > Integraciones** (vista de settings del proyecto).
    *   Diseñar la tarjeta "Hotmart" y su Modal de Configuración.
    *   El modal incluirá:
        *   Input para **Webhook Secret / Hottok** (Token de seguridad).
        *   Filtro por **Fecha**: "Solo procesar transacciones desde [Fecha]".
        *   Filtro de **Cuotas / Recurrencia**: Reglas para ignorar cobros de 2da/3ra cuota como nuevas ventas, ligándolas a la venta original.
        *   Lista informativa de **Productos Activos** en el proyecto (y sus códigos de oferta). Solo los eventos que coincidan con estos productos ingresarán.
*   **Backend (`apps/api`):**
    *   Esquema Prisma: Tablas para guardar credenciales de integración (cifradas en base de datos con AES-256-GCM) y reglas de filtrado del proyecto.
    *   Endpoint **Ingest Port** (`POST /integrations/hotmart/webhook/:projectId`):
        *   Verifica la firma (Hottok). Si falla → `401 Unauthorized`.
        *   Inserta el JSON crudo en `integrations.events` con estado `RECEIVED`.
        *   Encola el ID del evento en BullMQ.
        *   Retorna `200 OK` (todo esto en < 100ms).

## Fase 2: Procesamiento de Eventos (Worker y Módulo `sales`)
**Objetivo:** Consumir los webhooks, filtrarlos según la configuración y normalizarlos a Ventas.

*   **Backend (BullMQ Worker en `apps/api`):**
    *   Toma el evento `RECEIVED`.
    *   Evalúa reglas de filtrado:
        *   ¿Fecha de compra es anterior a la fecha de corte configurada? → Se marca `SKIPPED_BY_DATE`.
        *   ¿El código de oferta no está registrado en el proyecto? → Se marca `SKIPPED_UNKNOWN_PRODUCT`.
    *   **Manejo de Cuotas:**
        *   Al detectar que la transacción tiene un número de cuota mayor a 1 (o es una recurrencia subsecuente).
        *   Busca la venta padre (`external_order_id` o `subscription_id` previo).
        *   La registra como "pago de cuota" de esa suscripción, sin duplicar al cliente en la base de leads ni crear un lead nuevo.
    *   **Idempotencia:** Inserta en la tabla `sales` respetando la restricción única `UNIQUE (source, external_order_id, external_txn_id)`. Si ya existe, se marca como `DUPLICATE`.
    *   Emite un evento interno de dominio `SaleRegisteredEvent`.

## Fase 3: Base de Leads y Pipeline (Módulo `pipeline` / `projects`)
**Objetivo:** Alimentar a los leads con los datos de las ventas automáticas, manuales o importadas.

*   **Backend:**
    *   Listener del evento `SaleRegisteredEvent`:
        *   Verifica si el comprador (email) ya es un Lead del proyecto. Si no lo es, lo crea.
        *   Actualiza el estado del Lead en el Pipeline (Ej: Lo mueve a "Cierre Ganado" si se aprueba la venta, o lo envía a recuperación si Hotmart reporta tarjeta rechazada).
    *   Endpoints CRUD en Módulo `pipeline`:
        *   Endpoint para **Importación CSV** de Leads.
        *   Endpoint para **Creación/Edición Manual** de Leads.
        *   Endpoint para registrar **Ventas Manuales** (alimentando el módulo `sales`).
*   **Frontend:**
    *   Vistas completas de la tabla **Base de Leads**.
    *   Componentes de "Crear Lead Manual" e "Importar CSV" (validando esquema con Zod).
    *   Vista "Registrar Venta Manual" para el Closer.

---

### ¿Qué necesito para poder empezar (Fase 1)?

Para comenzar a codificar la integración, por favor confírmame o provee lo siguiente:

1.  **Esquema Prisma (Productos):** Actualmente, ¿tienes definida la estructura de productos (y sus códigos de oferta) a nivel de Prisma en `schema.prisma`, o necesitamos crear/actualizar la tabla `Product` para enlazarla al `ProjectId`? (Actualmente vi que se manejan a nivel de UI pero quiero confirmar su estado en DB).
2.  **Infraestructura BullMQ:** ¿Ya tienes configurado un contenedor de **Redis** en el `docker-compose` de desarrollo para orquestar la cola de los webhooks?
3.  **Claves Criptográficas:** ¿Tienes la variable de entorno `INTEGRATION_ENCRYPTION_KEY` definida (y cifrada en age/sops si corresponde) para proteger los tokens de Hotmart?
4.  **Estado de Eventos a Soportar:** Inicialmente, procesaremos: Compra Aprobada, Compra Reembolsada y Compra Rechazada (para carritos abandonados/recuperación). ¿Requieres algún evento adicional como "Boleto/Ticket generado"?
