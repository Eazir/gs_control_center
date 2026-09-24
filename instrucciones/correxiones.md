# Auditoría y Correcciones (Fase 3.1 → Fase 3.2)

Se han revisado los comentarios del usuario sobre la implementación anterior y se han integrado al nuevo **Plan de Implementación (Fase 3.2)**.

## Puntos Aceptados e Integrados al Plan:
1. **Meta Mensual Global:** Se eliminará de la interfaz. Los grupos de comisiones serán los únicos encargados de manejar metas y escalones.
2. **Reparto Base Global:** Se eliminará de la vista, ya que entra en conflicto con la lógica de los grupos.
3. **Escalones de Comisión Globales:** Se eliminarán.
4. **Catálogo de Productos:** 
   - Se ajustarán las columnas mostradas.
   - El formulario de creación pasará a ser un modal.
   - Se añadirá el control de estado Activo/Inactivo y la validación por `código de oferta` único activo.
5. **Menús de Usuarios (Opencode):** Opencode se encargará de limitar las listas de los `<Select>` para mostrar únicamente usuarios válidos según el rol requerido y estado activo.

> [!NOTE]
> El plan ha sido actualizado en `instrucciones/implementation_plan.md`. Queda pendiente la aprobación para iniciar la ejecución.
