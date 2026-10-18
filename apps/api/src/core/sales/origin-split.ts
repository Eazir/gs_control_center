/**
 * Desglose de métricas por origen (comercial vs marketing).
 *
 * Invariante: comercial + marketing == total (salvo redondeo a 2 decimales).
 * El valor de marketing se deriva como residuo sobre el total para garantizar
 * que la suma de ambas partes sea exactamente igual al total.
 *
 * @param total Total del KPI (volumen, facturación bruta o facturación neta).
 * @param comercial Valor atribuido al equipo comercial.
 * @returns Desglose con comercial y marketing.
 */
export function splitByOrigin(
  total: number,
  comercial: number
): { comercial: number; marketing: number } {
  const marketing = Math.round((total - comercial) * 100) / 100;
  return { comercial, marketing };
}
