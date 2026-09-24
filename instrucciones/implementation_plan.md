# Plan de Implementación: Correcciones de Metas, Productos y Comisiones (Fase 3.2)

Se reestructurará la interfaz de acuerdo a las últimas indicaciones, eliminando las configuraciones globales que entran en conflicto con la arquitectura de Grupos de Comisiones y refinando la gestión del catálogo de productos y usuarios.

## Tareas a realizar por Antigravity (Orquestador)

### 1. Eliminación de Configuraciones Globales
- **`apps/web/src/app/admin/projects/[id]/page.tsx`**:
  - Eliminar por completo la sección "Meta de Facturación Mensual Principal".
  - Eliminar por completo la sección "Reparto Base de Comisiones por Venta".
  - Eliminar por completo la sección global "Escalones de Comisión por Cumplimiento de Meta" (ya que ahora se manejan exclusivamente por Grupo de Comisión).
- **`apps/web/src/app/admin/projects/page.tsx` (Tarjetas de Proyecto)**:
  - Eliminar la barra de progreso de la "Meta Mensual" en las tarjetas del listado de proyectos.
  - Reemplazar esa barra por un indicador de "Facturación Bruta" del proyecto.

### 2. Refactorización del Catálogo de Productos
- **`apps/web/src/app/admin/projects/page.tsx` y `apps/web/src/app/admin/projects/[id]/page.tsx`**:
  - Convertir el formulario de creación de productos (que actualmente se encuentra debajo de la tabla) en un **Modal flotante (Dialog)** que se abre mediante un botón "Agregar Nuevo Producto".
  - Uniformizar este modal para que se use tanto desde el Panel Principal (`[id]/page.tsx`) como desde las tarjetas de proyectos (`projects/page.tsx`).
  - Actualizar las columnas de la tabla del catálogo para que muestren: Nombre, Código de Oferta, Precio, Cuotas, Closer Asignado / Label Externo, Estado (Activo/Inactivo) y la Acción de Eliminar.
  - Implementar lógica en el frontend para validar que no se pueda agregar un producto con un `código de oferta` si ya existe otro activo con el mismo código, mostrando una notificación al usuario ("Debe desactivar el producto existente antes de crear uno nuevo").
  - (Opcional visual) Bloquear el botón de eliminar si el producto ya tiene ventas asociadas (se simulará o dependerá de una propiedad `hasSales` del backend).

---

## Tareas a realizar por Opencode (Ejecutor)

### 3. Filtros en Menús Desplegables de Usuarios (User Selects)
Opencode se encargará de actualizar todos los selectores de usuarios en la interfaz para que discriminen correctamente los listados.

- **`apps/web/src/app/admin/projects/page.tsx`**:
  - En la creación de proyectos (asignar Director): Filtrar la lista de usuarios para mostrar **solo cuentas activas** (ej. `isActive === true`) y que tengan rol de `DIRECTOR` o `ADMIN` (excluyendo a todos los demás roles y cuentas suspendidas).
  - En la pestaña de Equipo del Proyecto (Asignar miembro): Al desplegar la lista de usuarios para asignar como `CLOSER` o `DIRECTOR`, asegurarse de que solo aparezcan usuarios con la cuenta activa y que el rol corresponda a la selección (o que la lista se limpie de cuentas no válidas).

- **`apps/web/src/app/admin/projects/[id]/page.tsx`**:
  - En el catálogo de productos (al asignar Closer propietario): Garantizar que el dropdown liste exclusivamente usuarios activos con el rol `CLOSER`.

> [!NOTE]
> Opencode, al ejecutar tu parte, asegúrate de revisar la estructura actual del objeto `AppUser` retornado por `/auth/users` y filtrar de forma estricta por `isActive` (o la bandera que aplique en tu backend actual) y `role`.

---

## Preguntas Abiertas (Open Questions)

> [!WARNING]
> 1. **Facturación Bruta en la Tarjeta del Proyecto:** Actualmente en el frontend de `projects/page.tsx` (Summary del proyecto), ¿tenemos ya un campo en `ProjectSummary` que contenga la facturación bruta, o debemos poner un valor mockeado temporal (`$0.00`) hasta que se actualice la ruta del backend?
> 2. **Eliminación de Productos:** Si un producto tiene ventas, no se puede eliminar. ¿El backend ya devuelve una propiedad tipo `canDelete` o `salesCount` en el `ProductItem`, o deberíamos depender del mensaje de error del backend (Catch del Delete) para notificar al usuario que no se puede eliminar?

## Plan de Verificación

### Manual Verification
- Ingresar a la vista principal de proyectos (`/admin/projects`). Verificar que la barra de progreso mensual ya no esté y se muestre la "Facturación Bruta".
- Ingresar a un proyecto específico (`/admin/projects/[id]`). Verificar que solo existan los "Grupos de Comisión" sin configuraciones globales heredadas.
- En el catálogo de productos, probar agregar un producto y validar que se abre en un modal flotante en lugar de estar incrustado. Intentar duplicar un código de oferta activo y verificar la restricción.
- Opencode verificará los dropdowns de usuarios confirmando que las listas están restringidas por rol (ej. Solo Closers en asignación de Closer).
