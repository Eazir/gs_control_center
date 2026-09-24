# Gestión de Usuarios e Invitaciones — Manual del rol SUPER ADMIN y ADMIN

> Para quién: Super Administrador y Administradores · Tiempo estimado: 5 min · Requisitos previos: Cuenta activa con permisos administrativos.

---

## 1. Para qué sirve

Permite controlar a todo el personal y clientes que tienen acceso a la plataforma: consultar el equipo de trabajo, invitar nuevos miembros con su rol correspondiente, gestionar sus números de contacto telefónicos/WhatsApp, editar sus datos y revocar accesos o invitaciones pendientes de forma segura.

---

## 2. Paso a paso

### A. Acceder al Centro de Mando y a la Gestión de Usuarios
1. Inicia sesión en la plataforma e ingresa al **Panel de Control** en `/dashboard`.
2. En la pantalla principal verás la cuadrícula de módulos. En la primera tarjeta marcada como **"Gestión de Usuarios"** haz clic en **"Gestionar Usuarios"** (o accede desde el menú lateral).
3. Entrarás a la pantalla `/admin/users` donde dispones de dos pestañas:
   - **Usuarios Registrados:** Muestra el personal y clientes activos o suspendidos.
   - **Registro de Invitaciones:** Muestra las invitaciones emitidas y su estado.

---

### B. Invitar a un Nuevo Usuario
1. En la esquina superior derecha, haz clic en el botón dorado **`+ Invitar Usuario`**.
2. Completa los datos en la ventana emergente:
   - **Correo electrónico:** El correo corporativo o personal del destinatario.
   - **Nombre completo:** Nombre y apellido.
   - **Rol en la plataforma:** Selecciona entre Administrador, Director, Closer o Cliente.
3. Haz clic en **"Enviar Invitación"**.
4. El sistema generará automáticamente un enlace seguro de bienvenida y te mostrará el botón **"Copiar"**. Haz clic para copiarlo al portapapeles y enviarlo al usuario (por WhatsApp, Slack, correo o mensaje directo).

---

### C. Gestionar Múltiples Números de Teléfono y Editar Datos
1. En la pestaña **"Usuarios Registrados"**, localiza al usuario y haz clic en el botón **"Editar"** en su fila.
2. En la ventana podrás modificar:
   - Nombre completo.
   - Correo electrónico.
   - Rol asignado.
   - **Teléfonos de contacto:** Puedes ingresar el número principal y presionar **`+ Agregar número`** si el usuario tiene una segunda línea comercial o de WhatsApp. Cada número puede eliminarse o editarse individualmente.
3. Haz clic en **"Guardar Cambios"**. En la tabla verás cada número como una insignia identificadora.

---

### D. Suspender o Reactivar a un Usuario
1. En la columna de acciones de la tabla de usuarios, haz clic en el botón de estado:
   - Si el usuario está activo, el botón **"Suspender"** bloqueará su acceso inmediatamente sin borrar su historial de ventas o asignaciones.
   - Si el usuario está suspendido, el botón **"Activar"** restablecerá su acceso al instante.

---

### E. Administrar y Revocar Invitaciones
1. Haz clic en la pestaña **"Registro de Invitaciones"**.
2. Podrás visualizar:
   - Correo del invitado.
   - Rol que tendrá.
   - **Emitida por:** Quién generó la invitación.
   - **Estado:** `Pendiente de aceptación`, `Aceptada` o `Expirada`.
3. **Acciones disponibles:**
   - **Copiar Enlace:** Si el invitado perdió el enlace o expiró, presiona "Copiar Enlace" para renovar su vigencia por 7 días y compartirlo nuevamente.
   - **Eliminar:** Si te equivocaste de correo o la persona ya no ingresará, presiona "Eliminar". La invitación quedará cancelada inmediatamente y el usuario preliminar desaparecerá del sistema.
   - *Nota de seguridad:* Las invitaciones que ya fueron **Aceptadas** no se pueden eliminar para mantener el registro histórico de quién ingresó al equipo.

---

### F. Cómo Activa la Cuenta el Usuario Invitado
1. El usuario abre el enlace recibido (`/accept-invite?email=...&token=...`).
2. La pantalla le solicitará definir su contraseña cumpliendo con los requisitos de seguridad indicados en pantalla (mínimo 8 caracteres, al menos una mayúscula y un número).
3. Al hacer clic en **"ACEPTAR INVITACIÓN"**, su cuenta quedará activa y será redirigido a iniciar sesión.

---

## 3. Qué puede salir mal

| Lo que ve | Qué significa | Qué hacer |
|---|---|---|
| "No se puede eliminar una invitación que ya fue aceptada" | El usuario ya completó su registro con esa invitación. Por trazabilidad no se puede borrar. | Si deseas retirarle el acceso, dirígete a "Usuarios Registrados" y presiona **"Suspender"**. |
| "Este correo ya se encuentra registrado" | Ya existe una cuenta o invitación previa con ese mismo email. | Busca el correo en la tabla de usuarios o en el registro de invitaciones antes de invitarlo de nuevo. |
| El botón de "Aceptar Invitación" no se habilita en el registro | La contraseña elegida por el invitado no cumple las reglas de seguridad o no coinciden. | Indicarle al usuario que verifique que los 4 puntos del checklist verde estén marcados. |
| "Invitación inválida o expirada" | El token caducó (más de 7 días) o fue cancelado. | En la pestaña de invitaciones, haz clic en **"Copiar Enlace"** para renovarlo y facilitarle el nuevo enlace. |

---

## 4. Preguntas frecuentes

- **¿Le llega un correo automático al usuario cuando lo invito?**  
  Actualmente el enlace se genera de inmediato en pantalla y en la tabla de invitaciones para que el administrador pueda copiarlo y enviárselo directamente por el canal de comunicación que use el equipo (WhatsApp, Telegram, etc.). En fases posteriores se activará el envío por SMTP transaccional.
- **¿Un Administrador puede modificar a un Super Administrador?**  
  No. El sistema aplica una jerarquía estricta: un Administrador solo puede ver e interactuar con roles por debajo de él (Director, Closer y Cliente). Únicamente el Super Administrador tiene control total sobre todos los perfiles.
