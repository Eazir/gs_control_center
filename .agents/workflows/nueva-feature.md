---
description: Implementar una funcionalidad de punta a punta (DB → backend → GraphQL → UI).
---

Implementa la funcionalidad solicitada siguiendo este orden. No saltes pasos.

1. **Contexto.** Lee `db_postgres/DICCIONARIO.md` y los requerimientos en `Docs/Requerimientos/`
   relacionados. Identifica el módulo dueño. Si toca más de uno, di cuál es el dueño del dato.
2. **Plan.** Entrega un plan corto antes de escribir código: archivos a tocar, migración necesaria,
   impacto en permisos, riesgos. Espera aprobación.
3. **Contrato.** Esquemas Zod en `packages/contracts`.
4. **Datos.** Migración Prisma con índices, políticas RLS si aplica, y actualización del diccionario.
5. **Backend.** Caso de uso, repositorio, resolver con CASL y DataLoader.
6. **Frontend.** Vista con los cuatro estados, componentes shadcn/ui, permisos por rol.
7. **Pruebas.** Unitarias del caso de uso; integración con Testcontainers si toca RLS, RBAC,
   idempotencia o transacciones.
8. **Verificación.** Ejecuta build, lint y pruebas. Reporta el resultado real, no lo asumas.
9. **Resumen.** Qué cambió, qué falta, qué habría que vigilar en producción.
