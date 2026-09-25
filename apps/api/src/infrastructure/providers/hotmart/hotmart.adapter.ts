import { RawSale } from '@gs/contracts';

export class HotmartAdapter {
  static parseWebhook(payload: Record<string, unknown>): RawSale {
    // Normalización desde el payload v2 de Hotmart
    const data = (payload['data'] as Record<string, unknown>) || {};
    const buyer = (data['buyer'] as Record<string, unknown>) || {};
    const product = (data['product'] as Record<string, unknown>) || {};
    const purchase = (data['purchase'] as Record<string, unknown>) || {};
    
    // Identificar el status
    let status = 'PENDING';
    if (payload['event'] === 'PURCHASE_APPROVED') status = 'APPROVED';
    else if (payload['event'] === 'PURCHASE_REFUNDED') status = 'REFUNDED';
    else if (payload['event'] === 'PURCHASE_CHARGEBACK') status = 'CHARGEBACK';
    else if (payload['event'] === 'PURCHASE_CANCELED') status = 'CANCELED';
    else if (payload['event'] === 'PURCHASE_BILLET_PRINTED') status = 'BILLET_PRINTED';
    else if (payload['event'] === 'PURCHASE_DELAYED') status = 'DELAYED';
    
    return {
      source: 'HOTMART',
      externalOrderId: (purchase['transaction'] as string) || 'UNKNOWN',
      externalTxnId: (payload['id'] as string) || (purchase['transaction'] as string) || 'UNKNOWN',
      
      leadName: (buyer['name'] as string) || null,
      leadEmail: (buyer['email'] as string) || 'unknown@example.com',
      leadPhone: (buyer['phone'] as string) || null,
      
      productName: (product['name'] as string) || 'Producto Desconocido',
      productId: product['id'] ? String(product['id']) : null,
      status,
      
      amount: Number((purchase['full_price'] as Record<string, unknown>)?.['value']) || Number((purchase['price'] as Record<string, unknown>)?.['value']) || 0,
      currency: String((purchase['full_price'] as Record<string, unknown>)?.['currency_value'] || (purchase['price'] as Record<string, unknown>)?.['currency_value'] || 'USD'),
      
      paymentMethod: String((purchase['payment'] as Record<string, unknown>)?.['type'] || ''),
      installments: Number((purchase['payment'] as Record<string, unknown>)?.['installments_number']) || 1
    };
  }
}
