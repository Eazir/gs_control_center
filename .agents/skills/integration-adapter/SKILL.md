---
name: integration-adapter
description: Implementar o modificar un adaptador de integración externa (Hotmart, Centralize CRM, GoHighLevel u otro proveedor) y su pipeline de webhooks en gs_control_center. Úsala siempre que se hable de webhooks, ingesta de ventas, carritos abandonados, recuperables, idempotencia, reconciliación o de conectar una plataforma de pagos o CRM nuevo.
---

# Adaptador de integración

## Puerto común

Todo proveedor implementa `IntegrationProvider`:

```ts
interface IntegrationProvider {
  authenticate(): Promise<void>;
  fetchLeads(params: FetchParams): Promise<RawLead[]>;
  fetchSales(params: FetchParams): Promise<RawSale[]>;
  handleWebhook(req: RawWebhook): Promise<NormalizedEvent>;
  healthCheck(): Promise<HealthStatus>;
}
```

Agregar un proveedor = crear un adaptador en `infrastructure/providers/<nombre>/`. No se toca la lógica
de negocio ni el frontend. Si te ves modificando `sales/` para soportar un proveedor, el diseño falló.

## Flujo de webhook (no negociable)

**Endpoint HTTP (`ingest`), menos de 100 ms:**
1. Verifica la firma criptográfica del proveedor. Falla → `401`, sin procesar.
2. Inserta el payload crudo en `integrations.events` con estado `RECEIVED`.
3. Encola el `event_id` en BullMQ.
4. Responde `200 OK`.

Nada más. Sin consultas a `sales`, sin normalización, sin notificaciones.

**Worker:**
1. Toma el evento, marca `PROCESSING`.
2. Normaliza con el adaptador al contrato Zod de `packages/contracts`.
3. Escribe en `sales` respetando `UNIQUE (source, external_order_id, external_txn_id)`.
   Conflicto → descarta como duplicado y marca `DUPLICATE`. Nunca crea una segunda venta.
4. Clasifica el estado de compra según el mapeo del proyecto (recuperable / no recuperable).
5. Si es recuperable: mueve la fila al stage correspondiente, asigna closer, emite notificación Telegram.
6. Marca `PROCESSED` o `FAILED` con el error.

Reintentos con backoff exponencial y dead letter queue. Un evento nunca se pierde ni se procesa dos veces.

## Reconciliación

Job diario que consulta la API REST del proveedor por rango de fechas, compara contra `sales` y crea
los registros faltantes usando el mismo camino del worker. Reporta discrepancias, no las silencia.

## Credenciales

Cifradas con AES-256-GCM en `integrations`. Se descifran en memoria para usarlas y nunca se registran
en logs ni se devuelven por la API, ni siquiera enmascaradas parcialmente a roles no `SUPER_ADMIN`.

## Pruebas obligatorias

- Firma inválida → rechazo.
- Mismo webhook dos veces → una sola venta.
- Webhook fuera de orden (reembolso antes que compra) → estado final correcto.
- Producto fuera del catálogo del proyecto → no computa en facturación ni comisiones.
