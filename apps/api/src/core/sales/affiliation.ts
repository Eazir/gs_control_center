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
