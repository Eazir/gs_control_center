export function getNaturalStatusName(status: string | null | undefined): string {
  if (!status) return 'Desconocido';
  
  const s = status.toUpperCase();
  
  switch (s) {
    case 'PURCHASE_CANCELED':
    case 'CANCELED':
      return 'Cancelada';
    case 'PURCHASE_COMPLETE':
    case 'COMPLETE':
    case 'COMPLETED':
      return 'Completa';
    case 'PURCHASE_BILLET_PRINTED':
    case 'BILLET_PRINTED':
      return 'Esperando pago';
    case 'PURCHASE_APPROVED':
    case 'APPROVED':
      return 'Aprobada';
    case 'PURCHASE_REFUNDED':
    case 'REFUNDED':
      return 'Reembolsada';
    case 'PURCHASE_CHARGEBACK':
    case 'CHARGEBACK':
      return 'Chargeback';
    case 'PURCHASE_PROTEST':
    case 'PROTEST':
    case 'DISPUTE':
      return 'Sol. Reembolso';
    case 'PURCHASE_DELAYED':
    case 'DELAYED':
      return 'Retrasada';
    case 'PURCHASE_OUT_OF_SHOPPING_CART':
    case 'ABANDONED_CART':
    case 'SHOPPING_CART':
      return 'Carrito Aband';
    case 'PENDING':
      return 'Pendiente';
    default:
      return status;
  }
}

export function getStatusBadgeClasses(status: string | null | undefined): string {
  if (!status) return "bg-secondary text-secondary-foreground";
  
  const s = status.toUpperCase();
  
  if (['PURCHASE_APPROVED', 'APPROVED', 'PURCHASE_COMPLETE', 'COMPLETE', 'COMPLETED'].includes(s)) {
    return "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30";
  }
  
  if (['PURCHASE_REFUNDED', 'REFUNDED', 'PURCHASE_CHARGEBACK', 'CHARGEBACK', 'PURCHASE_CANCELED', 'CANCELED'].includes(s)) {
    return 'bg-red-500/20 text-red-400 border-red-500/20';
  }
  if (['PURCHASE_PROTEST', 'PROTEST', 'DISPUTE'].includes(s)) {
    return 'bg-orange-500/20 text-orange-400 border-orange-500/20';
  }
  
  if (['PURCHASE_BILLET_PRINTED', 'BILLET_PRINTED', 'PURCHASE_DELAYED', 'DELAYED', 'PENDING'].includes(s)) {
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }
  
  return "bg-secondary text-secondary-foreground";
}
