# ADR-0002: Sesión única por navegador y sincronización multi-pestaña

- **Fecha:** 2026-09-21
- **Estado:** aceptado
- **Afecta a:** `apps/web` (cliente HTTP, layout shell y flujo de autenticación)

## Contexto
El frontend almacenaba el token de acceso JWT tanto en `sessionStorage` como en `localStorage`, pero el cliente HTTP (`api-client.ts`) priorizaba la lectura de `sessionStorage`. Al estar `sessionStorage` estrictamente aislado por pestaña en los navegadores, un usuario podía iniciar sesión con una cuenta en la Pestaña 1 y con una cuenta distinta en la Pestaña 2 del mismo navegador.

Sin embargo, las cookies HttpOnly con el Refresh Token (`refreshToken`) se comparten obligatoriamente entre todas las pestañas de un mismo origen. Esto provocaba que, al vencer el token de acceso de 15 minutos, la Pestaña 1 enviara la cookie de la Pestaña 2, causando colisiones de identidad y estados inconsistentes. Adicionalmente, un usuario ya autenticado podía ingresar directamente a `/login` sin ser redirigido.

## Opciones consideradas
1. **Permitir múltiples sesiones independientes por pestaña (Multi-Account Tab Isolation):**
   Requiere eliminar el uso de cookies para el refresh token y almacenar tanto el access token como el refresh token en `sessionStorage`.
   *En contra:* Expone el refresh token a vectores de ataque XSS en JavaScript, viola el requerimiento de seguridad de cookie `HttpOnly; SameSite=Strict` establecido en `AGENTS.md` y no sincroniza estados al cerrar sesión.
2. **Sesión única compartida a nivel de navegador con sincronización en tiempo real:**
   Utilizar `localStorage` como única fuente de verdad para el access token en el cliente y escuchar el evento nativo del navegador `window.addEventListener('storage', ...)`.
   Implementar Guest Guard en `/login` con esqueleto de carga y redirección inmediata a `/dashboard`.
   *A favor:* Cumple estrictamente con la seguridad de cookies HttpOnly para refresh tokens, garantiza consistencia total entre todas las pestañas abiertas, y cierra automáticamente cualquier pestaña desfasada si otra pestaña cierra sesión o cambia de usuario.

## Decisión
Se adopta la **Opción 2**.

1. `api-client.ts` utiliza `localStorage` como almacén principal del token de acceso.
2. `AdminShell` implementa un listener de eventos `storage`:
   - Si se detecta borrado del token (logout en otra pestaña), la pestaña actual destruye su estado y redirige a `/login`.
   - Si se detecta un nuevo token (login con otra cuenta), la pestaña actual revalida el perfil con `/auth/me` para evitar sesiones cruzadas.
3. Al hacer logout en cualquier parte de la aplicación, se limpia explícitamente tanto `localStorage` como `sessionStorage`.
4. La página `/login` incluye un Guest Guard que comprueba la sesión existente y redirige automáticamente al `/dashboard` mostrando un Skeleton de carga.

## Consecuencias
- **Positivas:** Seguridad consistente con cookies HttpOnly, experiencia de usuario fluida sin parpadeos, y eliminación de inconsistencias de sesión multi-pestaña.
- **Negativas:** Si un desarrollador o usuario desea usar dos cuentas simultáneamente en la misma máquina, debe recurrir a una ventana de incógnito o a un perfil de navegador diferente.
