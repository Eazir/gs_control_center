# Gestión y Administración de Proyectos — Manual del rol SUPER ADMIN y ADMIN

> Para quién: Super Administrador y Administradores · Tiempo estimado: 6 min · Requisitos previos: Cuenta activa con permisos administrativos.

---

## 1. Para qué sirve

Permite crear, configurar y supervisar las unidades comerciales (proyectos de infoproductos) de GrowthSell: definir las metas de facturación mensual esperadas, asignar a los Directores Comerciales a cargo, estructurar el catálogo de infoproductos y tickets de venta, y afiliar al equipo de closers responsable de cerrar las llamadas.

---

## 2. Paso a paso

### A. Acceder a la Administración de Proyectos
1. Inicia sesión en la plataforma e ingresa al **Centro de Mando** en `/dashboard`.
2. En la tarjeta **"Administración de Proyectos"**, haz clic en el botón **"Gestionar Proyectos"** (o accede desde el menú lateral en "Proyectos").
3. Llegarás a `/admin/projects`, donde verás:
   - Indicadores de proyectos activos, en borrador o pausados.
   - La cuadrícula de proyectos con su meta mensual, director asignado y número de productos.

---

### B. Crear un Nuevo Proyecto Comercial
1. En la parte superior derecha, haz clic en el botón dorado **`+ Nuevo Proyecto`**.
2. Completa los campos básicos:
   - **Nombre del proyecto:** Por ejemplo, *"Mastery Closer High Ticket"*.
   - **Identificador (Slug):** Se autogenera en minúsculas para formar la URL.
   - **Descripción:** Breve resumen del infoproducto o nicho de mercado.
   - **Director Comercial asignado:** Selecciona del listado al director que liderará el proyecto.
   - **Meta de facturación mensual:** Monto esperado en USD u otra divisa (por ejemplo, `$50,000`).
   - **Estado:** Selecciona `Activo` para habilitarlo de inmediato o `Borrador` para terminar de configurarlo después.
3. Haz clic en **"Crear Proyecto"**. El proyecto aparecerá de inmediato en la lista.

---

### C. Configurar el Catálogo de Productos y Tickets
1. En la tarjeta del proyecto creado, haz clic en **"Ver Detalle y Configuración"** (o ingresa a `/admin/projects/[id]`).
2. Ve a la sección **"Catálogo de Productos / Tickets"**:
3. Haz clic en **`+ Agregar Producto`**:
   - **Nombre del producto:** Ej. *"Programa Élite 1 a 1"*.
   - **Precio de venta:** Ej. `$2,500 USD`.
   - **Comisión base de venta:** Porcentaje o monto fijo que recibe el closer al cerrar la transacción.
4. Guarda el producto. Cada ticket queda registrado con identificador único y listo para vincularse al pipeline y a los webhooks de pago.

---

### D. Asignar Closers y Miembros al Proyecto
1. Dentro del detalle del proyecto, dirígete a la pestaña o bloque **"Equipo Asignado"**.
2. Presiona **`+ Vincular Miembro`**.
3. Selecciona al Closer o Colaborador registrado y confirma el rol dentro del proyecto.
4. A partir de ese momento, el closer tendrá acceso al pipeline de prospectos y métricas exclusivas de este proyecto.

---

### E. Pausar, Reactivar o Archivar un Proyecto
1. Desde la vista general o el detalle del proyecto, haz clic en el selector de **Estado**:
   - **Activo:** El proyecto opera normalmente; se reciben ventas y el pipeline está abierto.
   - **Pausado:** Detiene temporalmente la ingesta y notificaciones sin borrar datos.
   - **Archivado:** Oculta el proyecto de la operación diaria conservando el historial financiero completo.

---

## 3. Qué puede salir mal y cómo resolverlo

| Qué ves | Por qué ocurre | Cómo resolverlo |
|---|---|---|
| *"El slug del proyecto ya está en uso"* | Ya existe otro proyecto registrado con un nombre idéntico o muy similar. | Cambia ligeramente el nombre o especifica un slug diferente (por ejemplo, agregando el año o versión). |
| *"No puedes asignar closers: el usuario no existe"* | El closer aún no ha aceptado su invitación en la plataforma. | Ve a **Gestión de Usuarios > Registro de Invitaciones** y asegúrate de que el usuario haya completado su registro. |
| *"Precio del producto no válido"* | Se ingresó un monto menor o igual a cero o con caracteres no numéricos. | Ingresa un valor numérico positivo sin signos de puntuación extraños. |
