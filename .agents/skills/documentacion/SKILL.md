---
name: documentacion
description: Escribir y mantener la documentación de gs_control_center — TSDoc, COMMENT ON en SQL, capítulos de servicio, ADRs, manual de usuario y los generadores de referencia. Úsala siempre que se implemente cualquier cosa, y también cuando se pida documentar, actualizar el diccionario, escribir un manual, registrar una decisión o cuando la documentación esté desactualizada.
---

# Documentación

## Qué documentar y dónde

| Lo que hiciste | Dónde se documenta |
|---|---|
| Función, clase o componente exportado | TSDoc encima, en el mismo archivo |
| Tabla o columna | `COMMENT ON` dentro de la migración |
| Tipo o campo GraphQL | `"""descripción"""` en el SDL |
| Comportamiento de un módulo | `docs/20-servicios/<modulo>.md` |
| Decisión de arquitectura | ADR nuevo en `docs/adr/` |
| Funcionalidad visible para el usuario | `docs/50-manual-usuario/<rol>/` |
| Comando nuevo | Target del `Makefile` con comentario `##:` |

Nunca escribas en `docs/30-referencia/`. Es generado.

## TSDoc

Documenta la restricción, no el tipo. El tipo ya está en TypeScript.

```ts
/**
 * Asigna un lead recuperable a un closer.
 *
 * @remarks
 * Respeta la cola de recuperación del proyecto: si hay closers en cola, gana el
 * siguiente en turno aunque el lead ya tuviera closer previo. Esta regla existe
 * porque el closer original suele ser quien perdió la venta.
 *
 * @param leadId - Fila de `pipeline.rows`, no el id externo del CRM.
 * @throws {ForbiddenError} Si quien ejecuta es CLOSER y no es el asignatario.
 */
```

## COMMENT ON

Obligatorio en cada tabla y columna nueva, en la misma migración:

```sql
COMMENT ON COLUMN sales.transactions.net_amount IS
  'Bruto menos comisión de pasarela y afiliación. Congelado al momento del pago: no se recalcula.';
```

Escribe lo que un dato no dice de sí mismo: unidades, zona horaria, si se congela, qué lo invalida.

## Capítulo de servicio

Copia `docs/_plantillas/capitulo-servicio.md` y complétalo. Las secciones que de verdad importan son
**Responsabilidad** (incluido lo que el módulo *no* hace), **Reglas de negocio** y **Errores conocidos**.
El resto se puede deducir del código; eso no.

Si modificas un módulo, actualiza su capítulo en el mismo cambio. No abras un TODO.

## ADR

Copia `docs/_plantillas/adr.md`, numera secuencialmente. Un ADR nunca se edita: si la decisión cambia,
escribe uno nuevo y marca el anterior como superseded. El valor del ADR está en el contexto, no en la
decisión: explica qué presión existía, o dentro de un año parecerá arbitraria.

## Manual de usuario

Lenguaje de negocio. Prohibido: endpoint, payload, JSONB, resolver, migración. Un director de ventas
debe poder seguirlo. Cada paso indica qué ve y qué resultado esperar, y la sección "Qué puede salir mal"
traduce los errores del sistema a lenguaje humano.

## Antes de cerrar

- [ ] TSDoc en todo lo exportado nuevo.
- [ ] `COMMENT ON` en toda tabla y columna nueva.
- [ ] Descripciones en el SDL de GraphQL.
- [ ] Capítulo del módulo actualizado.
- [ ] ADR si tomaste una decisión de arquitectura.
- [ ] Manual de usuario si la funcionalidad es visible.
- [ ] `make docs-check` en verde.
