/**
 * Filtros globales del proyecto, compartidos entre las pestañas pipeline,
 * base de leads, ventas y transacciones (no métricas).
 *
 * Fuente única de verdad del estado de filtros en el frontend. Se serializa a
 * query params mediante `buildFilterQuery` para mantener enlaces compartibles.
 */

export interface ProjectFilters {
  search: string;
  origin: 'todos' | 'comercial' | 'marketing';
  /** Estado de transacción. `'ALL'` = sin filtro. */
  status: string;
  /** `'ALL'` = sin filtro. */
  productId: string;
  /** `'ALL'` | `'UNASSIGNED'` (sin closer) | uuid de un closer. */
  closer: string;
  /** `'ALL'` = sin filtro. */
  stage: string;
  /** Día concreto (YYYY-MM-DD) o `''`. */
  day: string;
  /** Inicio de rango (YYYY-MM-DD) o `''`. */
  from: string;
  /** Fin de rango (YYYY-MM-DD) o `''`. */
  to: string;
}

export const DEFAULT_FILTERS: ProjectFilters = {
  search: '',
  origin: 'todos',
  status: 'ALL',
  productId: 'ALL',
  closer: 'ALL',
  stage: 'ALL',
  day: '',
  from: '',
  to: '',
};

/**
 * Convierte los filtros de UI a los query params que entiende el backend
 * (`ListFiltersSchema`). `closer === 'UNASSIGNED'` se mapea a `unassigned=true`.
 */
export function buildFilterQuery(f: ProjectFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.origin !== 'todos') p.set('origin', f.origin);
  if (f.status !== 'ALL') p.set('status', f.status);
  if (f.productId !== 'ALL') p.set('productId', f.productId);
  if (f.closer === 'UNASSIGNED') p.set('unassigned', 'true');
  else if (f.closer !== 'ALL') p.set('closerId', f.closer);
  if (f.stage !== 'ALL') p.set('stage', f.stage);
  if (f.day) p.set('day', f.day);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.search.trim()) p.set('search', f.search.trim());
  return p;
}

/** Indica si hay algún filtro activo (distinto de los valores por defecto). */
export function hasActiveFilters(f: ProjectFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.origin !== 'todos' ||
    f.status !== 'ALL' ||
    f.productId !== 'ALL' ||
    f.closer !== 'ALL' ||
    f.stage !== 'ALL' ||
    !!f.day ||
    !!f.from ||
    !!f.to
  );
}
