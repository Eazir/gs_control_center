/**
 * Normalización y clasificación de códigos SCK / afiliados.
 *
 * Regla de negocio:
 *  - SCK de texto libre SIEMPRE se compara en minúsculas y sin espacios,
 *    evitando que "Diego", "DIEGO" y "diego" se clasifiquen distinto.
 *  - El equipo comercial fijo (dh / diego / reynald) otorga atribución
 *    COMERCIAL a la venta, aunque no coincida el SCK con un closer específico.
 */

/** SCKs que siempre pertenecen al equipo comercial. */
export const FIXED_COMMERCIAL_SCK = new Set(['dh', 'diego', 'reynald']);

export function normalizeSck(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isFixedCommercialSck(value: string | null | undefined): boolean {
  return FIXED_COMMERCIAL_SCK.has(normalizeSck(value));
}

export function isCommercialAffiliate(
  affiliates: unknown[] | null | undefined
): boolean {
  if (!Array.isArray(affiliates)) return false;
  return affiliates.some((a) => {
    const af = a as { affiliate_code?: string; name?: string } | null;
    const code = normalizeSck(af?.affiliate_code);
    const name = normalizeSck(af?.name);
    if (code === 'b100311196f') return true;
    if (name && (name.includes('reynald') || name.includes('diego') || name.includes('dh'))) {
      return true;
    }
    return code !== '' && FIXED_COMMERCIAL_SCK.has(code);
  });
}

/**
 * Determina si el nombre de afiliado (usado en importación CSV) pertenece al equipo comercial.
 */
export function isCommercialAffiliateName(value: string | null | undefined): boolean {
  const n = normalizeSck(value);
  if (!n) return false;
  return n === 'b100311196f' || n.includes('reynald') || n.includes('diego') || n.includes('dh');
}

export type Attribution = 'COMERCIAL' | 'MARKETING';

export interface AttributionInput {
  /** Closer resuelto por el SCK (projectUser.sckCodes del equipo comercial), o null. */
  sckCloserId: string | null;
  /** true si el SCK es un código fijo referencial (dh/diego/reynald). */
  sckIsFixedCommercial: boolean;
  /** true si el afiliado es del equipo comercial (isCommercialAffiliate). */
  affiliateIsComercial: boolean;
}

export interface AttributionResult {
  closerId: string | null;
  attribution: Attribution;
}

/**
 * Regla de atribución (requisito 6): el closer lo determina SOLO el SCK cuando
 * resuelve a un closer válido; el equipo lo decide el afiliado (o un SCK fijo)
 * cuando no hay closer. Los SCK fijos son referenciales y nunca asignan closer.
 */
export function resolveAttribution(input: AttributionInput): AttributionResult {
  if (input.sckCloserId) {
    return { closerId: input.sckCloserId, attribution: 'COMERCIAL' };
  }
  if (input.sckIsFixedCommercial || input.affiliateIsComercial) {
    return { closerId: null, attribution: 'COMERCIAL' };
  }
  return { closerId: null, attribution: 'MARKETING' };
}

