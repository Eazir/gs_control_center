# Módulo Integrations

## Responsabilidad
El módulo de `Integrations` maneja el puente entre los eventos generados por sistemas externos (ej. pasarelas de pago, CRMs) y la persistencia interna del sistema. Es la puerta de entrada pública (sin JWT, validada por firma o token propio) al monolito.

## Arquitectura de Webhooks (Pipeline de Ingesta)

Para cumplir con la regla innegociable de responder en `<100ms`, se emplea un diseño de dos fases (Ingestor + Worker):

1. **Ingestor (HTTP REST - `integrations.controller`)**
   - Expone endpoints públicos (`POST /integrations/:id/webhook`).
   - Verifica que el proyecto y la configuración de integración existan.
   - **No realiza lógica de negocio.**
   - Graba el payload crudo en la tabla `IntegrationEvent` con estado `RECEIVED`.
   - Encola un job en Redis (`queue:integration_events`) con el ID del evento.
   - Retorna `200 OK` inmediatamente.

2. **Worker Asíncrono (Consumidores)**
   - El servicio consumidor (`SalesService` en el caso de ventas) escucha la cola Redis.
   - Extrae el ID del evento, lo recupera de la tabla `IntegrationEvent`.
   - Llama al adaptador específico (ej. `HotmartAdapter`) para transformar el payload externo en un contrato común interno (`RawSale`).
   - Pasa el evento por los filtros de admisión (fecha de corte, validación de producto activo, validación SCK).
   - Actualiza el estado del evento a `PROCESSED`, o un estado de rechazo como `SKIPPED_BY_DATE` o `SKIPPED_UNKNOWN_PRODUCT`, garantizando auditoría del porqué un evento fue o no admitido.

## Adaptadores
Los adaptadores (ej. `HotmartAdapter`) actúan como traductores. No inyectan repositorios ni acceden a la base de datos.
Reciben JSON crudo (opcionalmente con variantes de versión, como Webhook v1 y v2.0 de Hotmart) y retornan un objeto estándar (ej. extrayendo `sck`, `offerCode`, correo del comprador, valor pagado).

## Resiliencia
Si el Worker de procesamiento se cae, el Ingestor sigue guardando eventos en `IntegrationEvent` como `RECEIVED`.
Al reiniciar, el Worker drena esta tabla usando `processPendingEvents()` antes de suscribirse a Redis, asegurando pérdida cero de notificaciones de compra.
