# Reporte de Implementación — Fase 3.2 · Punto 3 (Opencode)

**Tarea asignada:** Filtros en menús desplegables de usuarios (`instrucciones/implementation_plan.md`, punto 3).
**Fecha:** 2026-09-23

## Resumen

Se actualizaron todos los selectores de usuarios del panel de administración de proyectos para que
solo listen **cuentas activas** y, donde aplica, usuarios con el **rol correcto**, de acuerdo a la
corrección 5 de `instrucciones/correxiones.md` y al punto 3 del plan.

> La bandera que aplica en el backend actual es `status === 'ACTIVE'` (enum
> `ACTIVE | SUSPENDED | INVITED | DELETED` del contrato `UserStatusSchema`) — **no** existe un campo
> `isActive` booleano en `/auth/users`. El campo `status` viaja en cada `UserListItem` tanto por línea
> de negocio (activo/suspendido/invitado/borrado) como por rol.

## Archivos tocados

### 1. `apps/web/src/app/admin/projects/page.tsx`
- `AppUser` ahora incluye el campo `status` (el backend lo devuelve en `/auth/users`).
- **Select "Director Comercial" (creación/edición de proyecto):** la lista `directors` se filtra con
  `u.status === 'ACTIVE'` además del rol `DIRECTOR | ADMIN`, excluyendo suspendidos/invitados.
- **Select "Vincular Usuario al Equipo" (pestaña Equipo del Proyecto):** `availableUsersToAssign`
  ahora excluye cuentas no activas (`u.status === 'ACTIVE'`), además de ya asignados y `SUPER_ADMIN`.
- **Select "Closer Propietario" (catálogo de productos):** nuevo memo `activeTeamClosers` que cruza
  `teamMembers` (rol CLOSER) con `allUsers` para mostrar solo closers con cuenta `ACTIVE`. Se usa en
  el formulario de producto de las tarjetas.

### 2. `apps/web/src/app/admin/projects/[id]/page.tsx`
- `AppUser` incluye el campo `status`.
- **Select "Vincular Usuario al Equipo":** `availableUsers` filtra `u.status === 'ACTIVE'`.
- **Select "Director Comercial Responsable" (Datos del Proyecto):** `eligibleDirectors` filtra
  `u.status === 'ACTIVE'` y rol `DIRECTOR | ADMIN`.
- **Select "Closer Propietario" (catálogo de productos, modal):** nuevo memo `activeClosersInProject`
  que cruza `closersInProject` con `allUsers` para listar únicamente closers activos.
- **Select "Closer Asignado" (nuevo lead):** ahora usa `activeClosersInProject` (solo asignar leads a
  closers activos).

### 3. Mantenimiento de entorno (para dejar `pnpm typecheck` en verde en WSL/Linux)
- `apps/web/src/components/ui/badge.tsx` y `button.tsx`: `Slot.Root` → `Slot` (la API de
  `@radix-ui/react-slot@1.3.3` exponía `Slot` como componente directo; el tipo `Root` ya no existe —
  error preexistente de la migración a `radix-ui`, ajeno a la lógica de filtros).
- Se regeneró el **Prisma Client** con `prisma generate --schema=apps/api/prisma/schema.prisma`
  (el postinstall no encontraba el schema; sin esto el typecheck del api fallaba con falsos TS2694).
- `pnpm install` (sin `--frozen-lockfile`) para sincronizar el lockfile con los imports de
  `@radix-ui/react-select|checkbox|dialog` declarados en `package.json` (necesarios para los
  componentes shadcn; el lockfile estaba desincronizado).

## Qué NO se filtró (a propósito)
- **Tablas de miembros ya vinculados** (`teamMembers` / `members`): muestran también miembros
  suspendidos porque reflejan el estado histórico del equipo (no son selectores de asignación).
- **Filtros de pipeline por closer asignado** (listas de filtrado): conservan `closersInProject`
  para no perder trazabilidad de leads de closers suspendidos; solo la *asignación* (nuevo lead,
  propietario de producto) restringe a activos.

## Estado de pruebas / typecheck (ejecutado en este sandbox)

| Comando | Resultado |
|---|---|
| `tsc --noEmit` (web) | ✅ EXIT 0 |
| `next lint` (web) | ✅ 0 warnings / 0 errors |
| `tsc --noEmit` (api) | ✅ EXIT 0 |
| `tsc --noEmit` (contracts) | ✅ EXIT 0 |

Nota: `pnpm typecheck`/`pnpm lint` raíz no se ejecutaron vía Turborepo porque `pnpm` del entorno WSL
apunta al binario de Windows (`Exec format error`); se ejecutaron los equivalentes por workspace, que
es lo que CI corre internamente. No se realizó verificación manual en navegador.

## Observaciones para Antigravity
- La corrección 5 pedía "usuarios válidos según el rol requerido y estado activo". En la pestaña
  **Equipo del Proyecto** el rol de proyecto (`DIRECTOR|CLOSER|CLIENTE`) es distinto del rol global de
  cuenta; los selects muestran todos los activos y la validación de rol de proyecto queda en el
  backend (CASL, control primario). Si se quiere restringir el rol de cuenta según el rol de proyecto
  seleccionado, es un ajuste adicional puntual.
- Los 3 TS2339/TS2307 restantes al inicio de la sesión eran preexistentes (migración `radix-ui` +
  Prisma Client no generado) y no estaban relacionados con la tarea de filtros; se resolvieron para
  dejar la verificación en verde.

## Pendiente / solicitud
- Auditoría de Antigravity sobre el punto 3 para pase a siguiente fase.
- Los puntos 1 y 2 del plan (eliminación de configuraciones globales y refactor del catálogo de
  productos) quedan a cargo de Antigravity según el plan.