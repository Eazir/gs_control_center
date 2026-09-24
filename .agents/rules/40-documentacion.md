---
description: Documentación obligatoria en código y en archivos. Siempre activa.
---

# Documentación

La documentación se escribe **mientras** se implementa, nunca al final.

## En el código
- TSDoc en todo lo exportado: función, clase, tipo, componente. Lo verifica ESLint.
- Documenta el *porqué* y las reglas de negocio no evidentes, no el *qué*.
  `@param userId - El id del usuario` no aporta nada; borra esa línea y escribe la restricción real.
- Toda tabla y columna nueva lleva `COMMENT ON` dentro de la misma migración. CI rechaza columnas sin
  comentario. El diccionario de base de datos se genera desde ahí: no se escribe a mano.
- Todo tipo, campo, query y mutation de GraphQL lleva su descripción en el SDL.

## En archivos
- `docs/20-servicios/<modulo>.md` se actualiza en el mismo cambio que modifica el módulo.
- `docs/30-referencia/` es **generado**. Nunca lo edites: corrige el comentario o el script.
- Una decisión de arquitectura se registra como ADR nuevo en `docs/adr/`. Los ADR no se modifican.
- Al terminar una funcionalidad de cara al usuario, escribe o actualiza su procedimiento en
  `docs/50-manual-usuario/<rol>/`, en lenguaje de negocio y sin jerga técnica.

Un cambio de comportamiento cuya documentación no lo refleja no está terminado.
