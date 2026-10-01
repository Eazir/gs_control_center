/**
 * Cliente HTTP unificado para apps/web.
 * - Adjunta automáticamente el token JWT en 'Authorization: Bearer <token>'.
 * - Envía 'credentials: include' para intercambio de cookies HttpOnly (refreshToken).
 * - En caso de 401, intenta refrescar el Access Token con /auth/refresh y reintentar la petición.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('gs_access_token') || sessionStorage.getItem('gs_access_token')
      : null;

  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url, {
    cache: 'no-store', // Prevenir cacheo agresivo en Next.js App Router
    ...options,
    headers,
    credentials: 'include',
  });

  // Si da 401 Unauthorized y no estamos ya intentando refrescar o loguearnos
  if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.accessToken) {
          localStorage.setItem('gs_access_token', refreshData.accessToken);
          sessionStorage.removeItem('gs_access_token'); // Limpieza preventiva
          headers.set('Authorization', `Bearer ${refreshData.accessToken}`);

          // Reintentar petición original con el nuevo token
          res = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
        }
      } else {
        // Refresh falló (sesión expirada o inexistente)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('gs_access_token');
          localStorage.removeItem('gs_user_role');
          sessionStorage.removeItem('gs_access_token');
          sessionStorage.removeItem('gs_user_role');

          // Evitar bucle infinito de recarga si ya estamos en /login o /accept-invite
          const currentPath = window.location.pathname;
          if (currentPath !== '/login' && !currentPath.startsWith('/accept-invite')) {
            window.location.href = '/login';
          }
        }
      }
    } catch {
      // Fallo de red
    }
  }

  return res;
}
