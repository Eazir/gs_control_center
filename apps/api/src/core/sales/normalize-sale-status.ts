/**
 * Normaliza el estado de una venta a su código canónico (mayúsculas).
 *
 * @remarks
 * Sin esta normalización, Hotmart, GHL, el import CSV y la venta manual
 * persistían `status` en formatos distintos (`approved`, `PURCHASE_APPROVED`,
 * `completed`, `waiting_payment`...) y las consultas de ventas/KPIs (que
 * comparan contra el código canónico) devolvían 0 falsos.
 */
const CANONICAL: Record<string, string> = {
  APPROVED: 'APPROVED',
  PURCHASE_APPROVED: 'APPROVED',
  APROBADO: 'APPROVED',

  COMPLETE: 'COMPLETE',
  COMPLETED: 'COMPLETE',
  PURCHASE_COMPLETE: 'COMPLETE',
  COMPLETA: 'COMPLETE',
  COMPLETO: 'COMPLETE',

  WAITING_PAYMENT: 'WAITING_PAYMENT',
  PURCHASE_BILLET_PRINTED: 'WAITING_PAYMENT',
  BILLET_PRINTED: 'WAITING_PAYMENT',
  ESPERA_DE_PAGO: 'WAITING_PAYMENT',

  PENDING: 'PENDING',
  DELAYED: 'DELAYED',
  PURCHASE_DELAYED: 'DELAYED',
  ATRASADO: 'DELAYED',

  CANCELED: 'CANCELED',
  CANCELLED: 'CANCELED',
  PURCHASE_CANCELED: 'CANCELED',
  CANCELADA: 'CANCELED',
  CANCELADO: 'CANCELED',

  EXPIRED: 'EXPIRED',
  PURCHASE_EXPIRED: 'EXPIRED',
  EXPIRADO: 'EXPIRED',

  CHARGEBACK: 'CHARGEBACK',
  PURCHASE_CHARGEBACK: 'CHARGEBACK',
  DISPUTE: 'DISPUTE',
  PURCHASE_PROTEST: 'DISPUTE',
  DISPUTA: 'DISPUTE',

  REFUNDED: 'REFUNDED',
  REEMBOLSO: 'REFUNDED',

  ABANDONED_CART: 'ABANDONED_CART',
  PURCHASE_OUT_OF_SHOPPING_CART: 'ABANDONED_CART',
};

export function normalizeSaleStatus(raw: string | null | undefined): string {
  if (!raw) return '';
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  return CANONICAL[key] ?? key;
}
