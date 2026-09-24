# Módulo: `projects`

> Estado: estable (Fase 2 completada) · Versión: 1.0.0 · Schema: `projects`
> Última revisión: 2026-09-21 · Capítulo obligatorio según AGENTS.md

---

## 1. Responsabilidad

El módulo `projects` administra las unidades comerciales (proyectos de infoproductos), su catálogo de productos y tickets, las metas de facturación pactadas, la asignación de directores comerciales y la membresía del equipo de ventas (closers y clientes).

**Qué explícitamente NO resuelve:**
- No gestiona credenciales ni contraseñas de usuarios (pertenece a `auth`).
- No procesa transacciones de cobro ni transiciones de llamadas en vivo (pertenecen a `sales` y `pipeline`).
- No almacena webhooks de pasarelas de pago ni tokens de CRM externos (pertenece a `integrations`).

---

## 2. Fronteras

- **Schema propio:** `projects` en PostgreSQL.
- **Módulos que consume:** `auth` (únicamente validación de identidad e invitaciones vía tokens).
- **Módulos que lo consumen:** `pipeline`, `sales`, `integrations`, `automation`, `ai`.
- **Datos que referencia por UUID sin FK:**
  - `projects.projects.director_id` → referencia lógica a `auth.users.id` (sin foreign key física).
  - `projects.project_users.user_id` → referencia lógica a `auth.users.id`.
  - `projects.projects.created_by` → referencia lógica a `auth.users.id`.

---

## 3. Modelo de datos

Tablas principales en el schema `projects`:

1. **`projects.projects`**:
   - `id`: UUID (PK con `gen_random_uuid()`).
   - `name`: Nombre descriptivo del proyecto/infoproducto.
   - `slug`: Identificador único URL-friendly (`@unique`).
   - `description`: Descripción operativa o comercial.
   - `status`: Enum `ProjectStatus` (`DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`).
   - `director_id`: UUID del director comercial asignado a liderar el proyecto.
   - `products`: Arreglo `JSONB` validado con Zod conteniendo el catálogo de infoproductos (id, nombre, precio, cuotas `installments`, divisa, estado).
   - `goals_config`: Objeto `JSONB` con metas de facturación mensual y llamadas esperadas.
   - `commission_config`: Objeto `JSONB` con el reparto base de comisiones, escalones (`tiers`) y los grupos de comisión por producto (`groups`). Los porcentajes de cada grupo se validan con Zod: `empresa + director + closer === teamTotal` (las pasarelas `external` se procesan por separado).
   - `start_date`, `end_date`: Fechas límite del ciclo de ventas.
   - `created_at`, `updated_at`, `deleted_at`: Auditoría temporal y soft delete (`deleted_at IS NULL` = activo).

2. **`projects.project_users`**:
   - `id`: UUID (PK).
   - `project_id`: UUID (`projects.projects.id` con FK física intra-schema).
   - `user_id`: UUID referenciando lógicamente a `auth.users.id`.
   - `role_in_project`: Enum `ProjectRole` (`DIRECTOR`, `CLOSER`, `CLIENTE`).
   - `assigned_by`: UUID del usuario que realizó la vinculación.
   - `assigned_at`: Marca de tiempo de asignación.
   - Restricción de unicidad: `@@unique([project_id, user_id])`.

---

## 4. API pública

### Endpoints REST (`/projects`)

| Método | Ruta | Acceso / Guard | Descripción |
|---|---|---|---|
| `GET` | `/projects` | `JwtAuthGuard` | Lista los proyectos accesibles según el rol del usuario (Super Admin/Admin ven todos; Director/Closer ven sus asignados). |
| `POST` | `/projects` | `JwtAuthGuard` | Crea un nuevo proyecto. Requiere rol `SUPER_ADMIN` o `ADMIN`. Genera slug automático y valida contratos Zod. |
| `GET` | `/projects/:id` | `JwtAuthGuard` | Detalle completo de un proyecto incluyendo director, catálogo de productos y resumen de miembros. |
| `PATCH` | `/projects/:id` | `JwtAuthGuard` | Actualiza metadatos, director asignado, estado, metas de facturación y configuración comercial. |
| `DELETE` | `/projects/:id` | `JwtAuthGuard` | Soft-delete del proyecto (`deleted_at = NOW()`). Protegido contra borrado permanente. |
| `GET` | `/projects/:id/products` | `JwtAuthGuard` | Lista el catálogo de productos vinculados al proyecto. |
| `POST` | `/projects/:id/products` | `JwtAuthGuard` | Añade un producto/ticket comercial al catálogo JSONB del proyecto. |
| `PATCH` | `/projects/:id/products/:prodId` | `JwtAuthGuard` | Modifica precio, divisa, comisiones o nombre de un producto del catálogo. |
| `DELETE` | `/projects/:id/products/:prodId` | `JwtAuthGuard` | Desactiva o remueve un producto del catálogo. |
| `GET` | `/projects/:id/members` | `JwtAuthGuard` | Lista de miembros asignados (closers, directores, clientes) con datos enriquecidos. |
| `POST` | `/projects/:id/members` | `JwtAuthGuard` | Vincula a un usuario registrado al proyecto con un rol específico. |
| `DELETE` | `/projects/:id/members/:userId` | `JwtAuthGuard` | Desvincula a un miembro del proyecto. |

---

## 5. Eventos

| Tipo | Evento | Cuándo | Payload |
|---|---|---|---|
| Emite | `projects.project.created` | Al crearse un proyecto | `{ projectId, slug, directorId, timestamp }` |
| Emite | `projects.project.status_changed` | Cuando cambia el estado del proyecto | `{ projectId, oldStatus, newStatus, timestamp }` |
| Emite | `projects.member.assigned` | Cuando se vincula un closer o director | `{ projectId, userId, roleInProject, timestamp }` |
| Consume | `auth.user.suspended` | Si se suspende un usuario | Remueve o pausa la asignación operativa del miembro |

---

## 6. Jobs programados

| Job | Frecuencia | Propósito / Qué pasa si falla |
|---|---|---|
| `projects.sync_monthly_goals` | Primer día de cada mes (00:05 UTC) | Resetea el conteo de cumplimiento de metas y archiva estadísticas del mes anterior. |

---

## 7. Reglas de negocio

1. **Aislamiento por Proyecto (`project_id` obligatorio):**
   - Ningún `CLOSER` o `CLIENTE` puede ver u operar proyectos donde no figure explícitamente en `project_users`.
   - `SUPER_ADMIN` y `ADMIN` tienen visibilidad y control sobre todos los proyectos del sistema.
2. **Director Comercial Único Principal:**
   - Cada proyecto puede tener un `director_id` asignado como líder principal responsable de las metas y del equipo de closers.
3. **Catálogo de Productos Validado con Zod:**
   - La columna `products` almacena un arreglo JSONB con validación estricta de contrato Zod antes de persistir. Los precios y comisiones se congelan numéricamente sin permitir valores negativos. Cada producto declara `installments` (número de cuotas ≥ 1, máx. 360).
4. **Grupos de Comisión con Reparto Validado:**
   - `commission_config.groups` agrupa un subconjunto de productos del catálogo con un reparto base propio (`teamTotal`, `company`, `director`, `closer`, `external`). Zod exige `company + director + closer === teamTotal`; las pasarelas (`external`) no participan en esa suma. Un producto solo puede pertenecer a un único grupo (regla aplicada en la UI y el backend).
5. **Metas de Facturación Escalonadas por Grupo:**
   - Cada grupo puede declarar metas de facturación (`goals`) que, al cumplirse, reemplazan el reparto base por porcentajes propios del escalón.
6. **Soft Delete Mandatorio:**
   - Al eliminar un proyecto, se establece `deleted_at = NOW()`. Las consultas filtran por defecto `deleted_at IS NULL`.
7. **Slug Único y Normalizado:**
   - El slug es derivado del nombre del proyecto en minúsculas sin acentos ni caracteres especiales, garantizando URLs canónicas limpias.

---

## 8. Permisos por rol

| Acción | SUPER_ADMIN | ADMIN | DIRECTOR | CLOSER | CLIENTE |
|---|:---:|:---:|:---:|:---:|:---:|
| Listar todos los proyectos | ✅ | ✅ | ❌ (Solo asignados) | ❌ (Solo asignados) | ❌ (Solo asignado) |
| Crear nuevo proyecto | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modificar metas y directores | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar catálogo de productos | ✅ | ✅ | ✅ (En su proyecto) | ❌ | ❌ |
| Asignar closers al proyecto | ✅ | ✅ | ✅ (En su proyecto) | ❌ | ❌ |
| Eliminar proyecto (Soft-delete) | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Configuración

Variables de entorno requeridas en `.env`:
- `DATABASE_URL`: Conexión a PostgreSQL con permisos sobre el schema `projects`.
- `JWT_ACCESS_SECRET`: Verificación de tokens de sesión para autenticar controladores.

---

## 10. Errores conocidos y trampas

1. **Asignación duplicada de miembro:**
   - *Trampa:* Intentar insertar un usuario en `projects.project_users` que ya pertenece al proyecto.
   - *Solución:* La base de datos tiene `@@unique([projectId, userId])`. El caso de uso captura la colisión y retorna error `409 Conflict` informativo.
2. **Productos con precios cero o negativos:**
   - *Trampa:* Enviar productos sin precio o con montos inválidos en el payload JSONB.
   - *Solución:* El pipe de validación Zod rechaza la carga antes de tocar la base de datos.
