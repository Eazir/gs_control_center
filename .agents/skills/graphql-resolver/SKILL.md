---
name: graphql-resolver
description: Escribir resolvers GraphQL, DataLoaders, paginación por cursor y suscripciones/SSE en el backend de gs_control_center. Úsala siempre que se cree o modifique un query, mutation, tipo GraphQL, se reporte lentitud en la API, aparezca el problema N+1 o se necesiten actualizaciones en tiempo real.
---

# Resolvers GraphQL

## Reglas

- El resolver valida, autoriza y delega. Cero lógica de negocio, cero Prisma.
- Toda relación entre entidades se resuelve con un DataLoader por request. Un resolver que consulta por
  elemento es un bug de rendimiento, no una optimización pendiente.
- Los datos que vienen de otro módulo se piden a su interfaz pública a través de un loader, nunca con join.

## Paginación

Siempre cursor, nunca `OFFSET`:

```graphql
type PipelineRowConnection {
  edges: [PipelineRowEdge!]!
  pageInfo: PageInfo!
  totalCount: Int          # solo si es barato; si no, omítelo
}
```

Cursor = `base64("<created_at>|<id>")`. Filtro: `(created_at, id) < (cursorTs, cursorId)`.

## DataLoader

```ts
const closerLoader = new DataLoader<string, Closer | null>(async (ids) => {
  const rows = await authPublicApi.findUsersByIds([...ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id) ?? null);
});
```

Se crea uno por request en el contexto. Nunca a nivel de módulo (fugaría caché entre usuarios).

## Autorización

Cada resolver aplica CASL antes de delegar y el caso de uso recibe el `AuthCtx`. La consulta a base de
datos corre dentro de `withRls`. Tres capas: CASL, filtro explícito por `project_id`, RLS.

## Tiempo real

Para ventas aprobadas, recuperables y cambios de stage: **SSE desde el gateway respaldado por Redis
Pub/Sub**, no WebSockets. Menos configuración en Traefik, reconexión automática del navegador y
suficiente para notificaciones unidireccionales. Los WebSockets solo se justificarían con edición
colaborativa de celdas.

## Operaciones masivas

Cambios de stage o asignación sobre 50+ filas: una sola mutation transaccional, escritura por lotes en
`row_history`, y respuesta con el conteo de éxitos y conflictos de `row_version`. Nunca N mutations.
