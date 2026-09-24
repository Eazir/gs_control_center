---
description: Agregar un módulo de servicio nuevo de punta a punta, con su documentación.
---

1. **Confirma que es un módulo** y no un adaptador de integración ni un caso de uso dentro de un módulo
   existente. Si no tiene entidades propias que nadie más posee, no lo es. Dilo y propón la alternativa.
2. **Plan**: entidades, eventos que emite y consume, qué módulos lo consumirán, permisos por rol,
   impacto en memoria del VPS. Espera aprobación.
3. `make module N=<nombre>` y completa el manifiesto.
4. Contratos Zod, incluidos los esquemas de eventos.
5. Migración inicial con `COMMENT ON` en cada tabla y columna, índices y RLS si aplica.
6. Dominio, casos de uso, repositorio, resolver. En ese orden.
7. Interfaz pública mínima en `index.ts`.
8. `module.config.ts` del frontend y las vistas, con los cuatro estados.
9. Capítulo `docs/20-servicios/<nombre>.md` completo, sin TODO.
10. ADR si el módulo introduce una decisión de arquitectura.
11. Pruebas y `make check docs-check`.
12. Resumen: qué se agregó, qué eventos nuevos existen, qué no se tocó de lo existente.

Si en algún punto necesitas modificar otro módulo, **detente y explica por qué** antes de hacerlo.
