---
description: Estándares de código, pruebas y criterios de cierre. Siempre activa.
---

# Calidad

- TypeScript `strict: true`. `any` prohibido; usa `unknown` y estrecha el tipo.
- Resolvers y controladores sin lógica de negocio ni Prisma directo.
- Toda relación GraphQL con DataLoader.
- Errores mapeados a códigos estables, sin stack traces en producción.
- Logs Pino en JSON con `requestId`, `userId`, `projectId`.

## Antes de dar algo por terminado
1. `pnpm build` limpio en front y back.
2. `pnpm lint` sin advertencias críticas.
3. Pruebas para la lógica nueva. RLS, RBAC e idempotencia exigen prueba de integración con Testcontainers.
4. Migración incluida y aplicable desde una base vacía.
5. Los cuatro estados de UI si hay vista nueva.
6. Verificación manual de aislamiento por rol.

## Operaciones prohibidas sin confirmación explícita
`prisma migrate deploy` contra producción, `docker compose down -v`, borrados masivos,
rotación de claves, cualquier despliegue.
