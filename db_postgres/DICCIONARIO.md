# DICCIONARIO DE DATOS — GrowthShell Centro de Mando (`gs_control_center`)

Contrato canónico de base de datos para PostgreSQL 16.
Cualquier cambio o adición a tablas y columnas debe documentarse en este archivo y en las migraciones de Prisma correspondientes.

---

## 1. Convenciones Globales de Arquitectura

1. **Base de Datos Única y Multi-Schema:**
   * Una sola instancia de PostgreSQL 16 (`gs_control_center`).
   * Un esquema por módulo de dominio: `auth`, `projects`, `pipeline`, `sales`, `integrations`, `automation`, `ai`.
   * Un rol de servicio por esquema (`svc_auth`, `svc_projects`, etc.) con permisos exclusivos sobre su propio esquema.
2. **Cero Foreign Keys Físicas Inter-Schema:**
   * Las relaciones entre módulos son exclusivamente **referencias lógicas por UUID**.
   * Integridad y resolución cross-module se gestiona en la aplicación con **DataLoaders** sobre interfaces públicas o eventos en Redis.
3. **Claves Primarias (PK):**
   * Tipo `UUID`. Se usa `gen_random_uuid()` por defecto; en tablas de alto volumen se usa **UUIDv7 en la aplicación** para preservar localidad de índices B-tree.
4. **Marcas de Tiempo:**
   * Todas las marcas de tiempo son `TIMESTAMPTZ` en **UTC**.
5. **Soft Delete:**
   * Toda entidad de negocio con historial implementa `deleted_at IS NULL` para registros activos. Prohibido `DELETE` físico en entidades operativas.
6. **Políticas de Row Level Security (RLS):**
   * RLS habilitado y forzado (`FORCE ROW LEVEL SECURITY`) como red de seguridad complementaria a CASL.
   * Ejecución obligatoria en la aplicación mediante el helper transaccional `withRls(prisma, ctx, fn)`.

---

## 2. Esquema `auth`

Gestiona identidades, autenticación, credenciales y control de acceso.

### 2.1. Tipos Enumerados (Enums)

#### `auth."UserRole"`
* `SUPER_ADMIN`: Administrador global del sistema con permisos ilimitados.
* `ADMIN`: Administrador de la plataforma y configuraciones.
* `DIRECTOR`: Director comercial a cargo de proyectos, closers y asignaciones.
* `CLOSER`: Vendedor que opera pipelines y atiende leads asignados.
* `CLIENTE`: Cliente o dueño del infoproducto (solo lectura de dashboards y analíticas).

#### `auth."UserStatus"`
* `ACTIVE`: Cuenta habilitada con credenciales verificadas.
* `SUSPENDED`: Cuenta deshabilitada temporal o permanentemente por administración.
* `INVITED`: Cuenta pre-creada pendiente de aceptación de invitación.
* `DELETED`: Cuenta archivada por soft delete.

---

### 2.2. Tablas

#### Tabla: `auth.users`
Almacena las cuentas de usuario de la plataforma.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único universal del usuario (PK). |
| `email` | `TEXT` | NO | — | Correo electrónico único normalizado en minúsculas. |
| `password_hash` | `TEXT` | NO | — | Hash de contraseña con **Argon2id** (64MB, t=3, p=4). |
| `full_name` | `TEXT` | NO | — | Nombre completo del usuario. |
| `phone` | `TEXT` | SÍ | `NULL` | Teléfono de contacto con código de país E.164. |
| `role` | `auth."UserRole"` | NO | — | Rol global del usuario. |
| `status` | `auth."UserStatus"` | NO | `'INVITED'` | Estado de la cuenta. |
| `mfa_secret_enc` | `TEXT` | SÍ | `NULL` | Secreto TOTP cifrado con AES-256-GCM. |
| `mfa_enabled` | `BOOLEAN` | NO | `false` | Indica si MFA está activo para el usuario. |
| `last_login_at` | `TIMESTAMPTZ` | SÍ | `NULL` | Fecha y hora del último login exitoso. |
| `failed_attempts` | `SMALLINT` | NO | `0` | Contador de intentos fallidos consecutivos de login. |
| `locked_until` | `TIMESTAMPTZ` | SÍ | `NULL` | Marca de tiempo hasta la cual la cuenta está bloqueada tras 5 intentos fallidos. |
| `preferences` | `JSONB` | NO | `'{}'::jsonb` | Preferencias de UI/tema validadas con Zod. |
| `metadata` | `JSONB` | NO | `'{}'::jsonb` | Metadatos extensibles validados con Zod. |
| `created_by` | `UUID` | SÍ | `NULL` | ID del usuario que envió la invitación o creó la cuenta. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Fecha de creación del registro en UTC. |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Fecha de última actualización en UTC. |
| `deleted_at` | `TIMESTAMPTZ` | SÍ | `NULL` | Marca de soft delete. |

* **Índices:**
  * `UNIQUE INDEX users_email_key ON auth.users (email)`
  * `INDEX users_idx_users_role ON auth.users (role)`
* **Políticas RLS:**
  * `SUPER_ADMIN` y `ADMIN` acceso irrestricto.
  * Usuarios autenticados solo ven y editan su propio registro (`id = current_setting('app.current_user_id')`).

---

#### Tabla: `auth.sessions`
Control de sesiones activas, rotación de tokens y revocación.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la sesión (PK). |
| `user_id` | `UUID` | NO | — | FK interna a `auth.users(id)` con `ON DELETE CASCADE`. |
| `refresh_hash` | `TEXT` | NO | — | Hash SHA-256 del Single-Use Refresh Token rotativo. |
| `ip` | `TEXT` | SÍ | `NULL` | Dirección IP de origen de la sesión. |
| `user_agent` | `TEXT` | SÍ | `NULL` | Navegador o cliente HTTP de origen. |
| `expiresAt` | `TIMESTAMPTZ` | NO | — | Fecha límite de validez de la sesión (7 días). |
| `revokedAt` | `TIMESTAMPTZ` | SÍ | `NULL` | Marca de tiempo si la sesión fue revocada explícitamente. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Creación de la sesión. |

* **Índices:**
  * `INDEX sessions_idx_sessions_user ON auth.sessions (user_id)`
  * `INDEX sessions_idx_sessions_expires ON auth.sessions (expires_at)`

---

#### Tabla: `auth.invitations`
Gestión de invitaciones a nuevos miembros.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador de la invitación (PK). |
| `email` | `TEXT` | NO | — | Email invitado en minúsculas. |
| `role` | `auth."UserRole"` | NO | — | Rol que se asignará al usuario invitado. |
| `token_hash` | `TEXT` | NO | — | Hash SHA-256 del token seguro de invitación. |
| `invited_by_id` | `UUID` | NO | — | FK interna a `auth.users(id)`. |
| `expires_at` | `TIMESTAMPTZ` | NO | — | Expiración de la invitación (7 días). |
| `accepted_at` | `TIMESTAMPTZ` | SÍ | `NULL` | Fecha de aceptación y activación de la cuenta. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Creación de la invitación. |

---

## 3. Esquema `projects`

Catálogo y configuración comercial de las unidades operativas (cuentas de clientes / infoproductos).

### 3.1. Tipos Enumerados (Enums)

#### `projects."ProjectStatus"`
* `DRAFT`: En configuración inicial.
* `ACTIVE`: Proyecto en operación comercial activa.
* `PAUSED`: Operaciones suspendidas temporalmente.
* `ARCHIVED`: Proyecto cerrado y archivado.

#### `projects."ProjectUserRole"`
* `DIRECTOR`: Director comercial responsable de este proyecto.
* `CLOSER`: Closer asignado a la cola de ventas de este proyecto.
* `CLIENTE`: Cliente / dueño del producto que monitorea este proyecto.

---

### 3.2. Tablas

#### Tabla: `projects.projects`
Catálogo maestro de proyectos comerciales.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador único del proyecto (PK). |
| `name` | `TEXT` | NO | — | Nombre comercial del infoproducto o proyecto. |
| `slug` | `TEXT` | NO | — | Identificador alfanumérico único para URLs. |
| `status` | `projects."ProjectStatus"` | NO | `'DRAFT'` | Estado de operación del proyecto. |
| `director_id` | `UUID` | SÍ | `NULL` | **Referencia lógica** a `auth.users(id)` del director asignado. |
| `settings` | `JSONB` | NO | `'{}'::jsonb` | Configuración operativa (zonas horarias, etapas). |
| `goals` | `JSONB` | NO | `'{}'::jsonb` | Metas comerciales mensuales y comisiones. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Fecha de alta en UTC. |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Fecha de modificación en UTC. |
| `deleted_at` | `TIMESTAMPTZ` | SÍ | `NULL` | Soft delete. |

* **Índices:**
  * `UNIQUE INDEX projects_slug_key ON projects.projects (slug)`
  * `INDEX projects_idx_projects_status ON projects.projects (status)`

---

#### Tabla: `projects.project_users`
Mapeo de asignaciones de usuarios a proyectos específicos.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Identificador del registro (PK). |
| `project_id` | `UUID` | NO | — | FK interna a `projects.projects(id)` con `ON DELETE CASCADE`. |
| `user_id` | `UUID` | NO | — | **Referencia lógica** a `auth.users(id)`. |
| `role_in_project` | `projects."ProjectUserRole"` | NO | — | Rol asignado en este proyecto específico. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Fecha de asignación en UTC. |
| `deleted_at` | `TIMESTAMPTZ` | SÍ | `NULL` | Soft delete para desvincular sin perder histórico. |

* **Índices:**
  * `UNIQUE INDEX project_users_project_id_user_id_role_in_project_key ON projects.project_users (project_id, user_id, role_in_project)`
  * `INDEX project_users_idx_project_users_user ON projects.project_users (user_id)`
