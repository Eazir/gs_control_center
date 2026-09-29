# Módulo: `auth`

> Estado: estable (Fase 1 completada) · Versión: 1.0.0 · Schema: `auth`
> Última revisión: 2026-09-18 · Capítulo obligatorio según AGENTS.md

---

## 1. Responsabilidad

El módulo `auth` resuelve la identidad, autenticación, control de accesos basado en roles (RBAC), emisión y ciclo de vida de invitaciones, y gestión de usuarios dentro de la plataforma.

**Qué explícitamente NO resuelve:**
- No gestiona asignación de usuarios a proyectos específicos (eso pertenece al módulo `projects`).
- No maneja comisiones de closers ni cálculos financieros (pertenece a `sales`).
- No almacena credenciales de integraciones de terceros (pertenece a `integrations`).

---

## 2. Fronteras

- **Schema propio:** `auth` en PostgreSQL.
- **Módulos que consume:** Ninguno (es el módulo raíz de identidad).
- **Módulos que lo consumen:** `projects`, `pipeline`, `sales`, `integrations`, `automation`, `ai`.
- **Datos que referencia por UUID sin FK:**
  - `auth.users.id` es referenciado como UUID lógico en tablas de otros schemas (`projects.members`, `pipeline.rows`, `sales.transactions`, etc.). Cero foreign keys físicas entre schemas.

---

## 3. Modelo de datos

Tablas principales en el schema `auth`:

1. **`auth.users`**:
   - `id`: UUID (PK).
   - `email`: `citext` único.
   - `password_hash`: Hash Argon2id (`$argon2id$...`).
   - `full_name`: Nombre completo del usuario.
   - `phone`: Texto con formato normalizado que soporta una o múltiples líneas de teléfono separadas por coma.
   - `role`: Enum `auth_role` (`SUPER_ADMIN`, `ADMIN`, `DIRECTOR`, `CLOSER`, `CLIENTE`).
   - `status`: Enum `user_status` (`ACTIVE`, `INVITED`, `SUSPENDED`).
   - `created_at`, `updated_at`, `deleted_at`: Auditoría temporal y soporte de soft delete (`deleted_at IS NULL` = activo).

2. **`auth.invitations`**:
   - `id`: UUID (PK).
   - `email`: Correo destinatario.
   - `role`: Rol a otorgar al aceptar.
   - `token_hash`: Hash SHA-256 del token criptográfico de invitación (el token en texto plano jamás se persiste).
   - `invited_by_id`: UUID del usuario emisor (`auth.users.id`).
   - `expires_at`: Fecha límite de aceptación (vigencia predeterminada de 7 días).
   - `accepted_at`: Marca de tiempo cuando la invitación fue consumida (`NULL` = pendiente).
   - `created_at`: Fecha de emisión.

3. **`auth.sessions`**:
   - `id`: UUID (PK).
   - `user_id`: UUID referenciando `auth.users.id`.
   - `refresh_hash`: Hash SHA-256 del refresh token rotativo.
   - `user_agent`: Cadena de identificación del navegador/dispositivo cliente.
   - `ip`: Dirección IP del cliente.
   - `expires_at`: Fecha límite de vigencia de la sesión (`timestamptz` UTC, 7 días con renovación automática por ventana deslizante).
   - `revoked_at`: Marca de tiempo cuando la sesión fue cerrada manualmente (`NULL` = activa).
   - `created_at`: Fecha de creación de la sesión.

---

## 4. API pública

### Endpoints REST (`/auth`)

| Método | Ruta | Acceso / Guard | Descripción |
|---|---|---|---|
| `POST` | `/auth/login` | Público | Autenticación con email y contraseña (Argon2id). Retorna access token y cookie con refresh token. |
| `POST` | `/auth/refresh` | Cookie refresh | Rotación de refresh token y emisión de nuevo JWT. |
| `POST` | `/auth/logout` | `JwtAuthGuard` | Invalidación de sesión y revocación del token en Redis/DB. |
| `GET` | `/auth/me` | `JwtAuthGuard` | Obtiene el perfil y roles del usuario autenticado. |
| `GET` | `/auth/users` | `JwtAuthGuard` | Lista de usuarios del sistema con filtrado y cálculo de KPIs. Aplica jerarquía de roles. |
| `PATCH` | `/auth/users/:id` | `JwtAuthGuard` | Modifica datos básicos: `fullName`, `phone` (múltiples teléfonos), `email` y `role`. |
| `PATCH` | `/auth/users/:id/status` | `JwtAuthGuard` | Suspende o reactiva un usuario. Protegido contra auto-suspensión del Super Admin. |
| `POST` | `/auth/invite` | `JwtAuthGuard` | Emite una nueva invitación por token criptográfico y pre-registra usuario como `INVITED`. |
| `GET` | `/auth/invitations` | `JwtAuthGuard` | Lista el historial de invitaciones con estado en vivo (`PENDING`, `ACCEPTED`, `EXPIRED`) y emisor. |
| `POST` | `/auth/invitations/:id/resend` | `JwtAuthGuard` | Renueva el token de una invitación pendiente y genera la URL completa para copiar. |
| `DELETE` | `/auth/invitations/:id` | `JwtAuthGuard` | Revoca invitación. Si el usuario está `INVITED`, lo purga en cascada para evitar registros huérfanos. |
| `POST` | `/auth/accept-invite` | Público | Valida token criptográfico, hashea la contraseña y activa al usuario (`ACTIVE`). |

---

## 5. Eventos

| Tipo | Evento | Cuándo | Payload |
|---|---|---|---|
| Emite | `auth.user.created` | Cuando un usuario activa su cuenta | `{ userId, email, role, timestamp }` |
| Emite | `auth.user.suspended` | Cuando un administrador suspende a un usuario | `{ userId, suspendedBy, timestamp }` |
| Consume | — | No consume eventos de otros módulos | — |

---

## 6. Jobs programados

| Job | Frecuencia | Propósito / Qué pasa si falla |
|---|---|---|
| `auth.cleanup_expired_tokens` | Diario (03:00 UTC) | Purga refresh tokens expirados en `auth.refresh_tokens`. Si falla, se reintenta la siguiente noche sin riesgo de seguridad. |

---

## 7. Reglas de negocio

1. **Jerarquía estricta de Roles:**
   `SUPER_ADMIN > ADMIN > DIRECTOR > CLOSER > CLIENTE`
   - Un `SUPER_ADMIN` puede ver y modificar a cualquier usuario.
   - Un `ADMIN` solo puede listar, invitar y modificar usuarios con roles estrictamente inferiores (`DIRECTOR`, `CLOSER`, `CLIENTE`). No puede alterar otros `ADMIN` ni a ningún `SUPER_ADMIN`.
   - Ningún usuario puede degradar o suspender su propia cuenta.
2. **Inmutabilidad de Invitaciones Aceptadas:**
   - Una invitación con `acceptedAt !== null` no puede eliminarse (`BadRequestException`), protegiendo la trazabilidad y auditoría histórica.
3. **Limpieza en Cascada de Invitaciones Revocadas:**
   - Al eliminar una invitación pendiente, si el usuario correspondiente en `auth.users` permanece en estado `INVITED`, se elimina automáticamente de la base de datos para no dejar registros huérfanos.
4. **Múltiples Teléfonos de Contacto:**
   - Un usuario puede registrar múltiples números de teléfono/WhatsApp. Se normalizan en la base de datos y se exponen estructurados a la interfaz de usuario.
5. **Seguridad Criptográfica de Contraseñas e Invitaciones:**
   - Contraseñas procesadas exclusivamente con **Argon2id**. Requisitos obligatorios: mínimo 8 caracteres, al menos una mayúscula y al menos un número.
   - Los tokens de invitación nunca se almacenan en texto plano en la base de datos, únicamente su hash `SHA-256`.
6. **Sincronización Multi-Pestaña y Sesión Única de Navegador:**
   - El cliente web unifica el almacenamiento de sesión en `localStorage` y escucha eventos nativos `storage` en tiempo real.
   - Si se cierra sesión en una pestaña, todas las demás pestañas abiertas en el mismo navegador se cierran inmediatamente.
   - Si se inicia sesión con otra cuenta en una pestaña, las demás pestañas se revalidan instantáneamente, impidiendo la coexistencia de cuentas cruzadas en el mismo navegador.
7. **Protección de Ruta de Invitado (Guest Guard en `/login`):**
   - Si un usuario con sesión activa ingresa a la ruta `/login`, el sistema muestra un Skeleton de transición y lo redirige automáticamente a `/dashboard`, evitando accesos redundantes al formulario de inicio de sesión.

---

## 8. Permisos por rol

| Acción | SUPER_ADMIN | ADMIN | DIRECTOR | CLOSER | CLIENTE |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver todos los usuarios | ✅ | ❌ (Solo jerarquía inferior) | ❌ | ❌ | ❌ |
| Invitar usuarios | ✅ | ✅ (Solo DIRECTOR, CLOSER, CLIENTE) | ❌ | ❌ | ❌ |
| Modificar rol y datos de usuario | ✅ | ✅ (Solo inferiores) | ❌ | ❌ | ❌ |
| Suspender / Activar usuario | ✅ | ✅ (Solo inferiores) | ❌ | ❌ | ❌ |
| Eliminar invitación pendiente | ✅ | ✅ | ❌ | ❌ | ❌ |
| Copiar enlace renovado de invitación | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver audit logs de autenticación | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Configuración

Variables de entorno requeridas en `.env`:
- `JWT_ACCESS_SECRET`: Clave secreta para firmar tokens de acceso (vigencia ≤ 15 min).
- `JWT_REFRESH_SECRET`: Clave secreta para refresh tokens rotativos.
- `DATABASE_URL`: Cadena de conexión a PostgreSQL con schema `auth`.
- `REDIS_URL`: Conexión a Redis para blacklist de tokens y rate limiting.

---

## 10. Errores conocidos y trampas

1. **Tokens de invitación en DB:**
   - *Trampa:* Intentar leer el token directamente de `auth.invitations` para reenviarlo.
   - *Razón:* La base de datos solo almacena `token_hash`. Para obtener un enlace nuevo se debe usar el endpoint `POST /auth/invitations/:id/resend`.
2. **Requisitos de contraseña en aceptación:**
   - *Trampa:* El backend rechaza con `400 Bad Request` si la contraseña no contiene mayúsculas o números, incluso si supera los 8 caracteres. La UI incluye checklist interactivo en tiempo real para evitar discrepancias.
3. **Usuarios huérfanos:**
   - *Trampa:* Borrar solo la fila de `auth.invitations` dejaba al usuario en `auth.users` como `INVITED`.
   - *Solución:* El caso de uso `DeleteInvitationUseCase` elimina ambos en la misma operación si el usuario aún está en estado `INVITED`.

---

## 11. Cómo probarlo localmente

```bash
# 1. Ejecutar pruebas de tipo y lint
pnpm --filter api typecheck
pnpm --filter api lint

# 2. Iniciar servidor API en modo desarrollo
pnpm --filter api dev

# 3. Probar endpoints de Auth con el Super Admin
# Credenciales predeterminadas: admin@growthsell.com / AdminPassword123!
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@growthsell.com","password":"AdminPassword123!"}'
```
