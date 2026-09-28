import { RawSale } from '@gs/contracts';

/**
 * Adaptador para normalizar webhooks provenientes de Hotmart.
 * Implementa la interfaz de ingesta transformando el payload de Hotmart (v1 y v2.0)
 * al contrato estándar `RawSale` utilizado por el pipeline de ventas.
 */
export class HotmartAdapter {
  /**
   * Transforma el payload crudo de Hotmart en un objeto RawSale.
   * Maneja discrepancias en versiones de webhooks, mapeo de estados,
   * y extracción de identificadores únicos (SCK, Offer Code).
   * 
   * @param payload Payload JSON crudo del webhook de Hotmart.
   * @returns Datos normalizados listos para ingestión o ignorados por el worker.
   */
  static parseWebhook(payload: Record<string, unknown>): RawSale {
    // 1. Extraer objetos anidados de Webhook v2.0
    const data = (payload['data'] as Record<string, unknown>) || {};
    const buyer = (data['buyer'] as Record<string, unknown>) || {};
    const product = (data['product'] as Record<string, unknown>) || {};
    const purchase = (data['purchase'] as Record<string, unknown>) || {};
    const payment = (purchase['payment'] as Record<string, unknown>) || {};
    const price = (purchase['price'] as Record<string, unknown>) || (purchase['full_price'] as Record<string, unknown>) || {};
    const offer = (purchase['offer'] as Record<string, unknown>) || (data['offer'] as Record<string, unknown>) || {};
    const tracking = (purchase['tracking'] as Record<string, unknown>) || {};
    const origin = (purchase['origin'] as Record<string, unknown>) || (data['origin'] as Record<string, unknown>) || {};

    // 2. Evento y estado
    const rawEvent = String(payload['event'] || purchase['status'] || '').toUpperCase();
    let status = 'PENDING';
    if (rawEvent === 'COMPLETE' || rawEvent === 'COMPLETED') {
      status = 'COMPLETE';
    } else if (rawEvent === 'PURCHASE_APPROVED') {
      status = 'PURCHASE_APPROVED';
    } else if (rawEvent.includes('APPROVED')) {
      status = 'APPROVED';
    } else if (rawEvent.includes('REFUND')) {
      status = 'REFUNDED';
    } else if (rawEvent.includes('CHARGEBACK')) {
      status = 'CHARGEBACK';
    } else if (rawEvent.includes('CANCEL')) {
      status = 'CANCELED';
    } else if (rawEvent.includes('BILLET') || rawEvent.includes('PRINTED')) {
      status = 'BILLET_PRINTED';
    } else if (rawEvent.includes('DELAYED')) {
      status = 'DELAYED';
    } else if (rawEvent.includes('SHOPPING_CART') || rawEvent.includes('ABANDON')) {
      status = 'ABANDONED_CART';
    }

    // 3. Identificación de transacción (Orden global vs transacción de cuota/pago)
    const transaction = String(
      purchase['transaction'] || 
      payload['transaction'] || 
      (rawEvent.includes('SHOPPING_CART') ? `CART_${payload['id'] || Date.now()}` : 'UNKNOWN')
    );
    const eventId = String(payload['id'] || transaction);

    // 4. Datos del comprador / Lead (Soporte checkout_phone y formato v1)
    const leadName = 
      (buyer['name'] as string) || 
      (payload['name'] as string) || 
      `${(payload['first_name'] as string) || ''} ${(payload['last_name'] as string) || ''}`.trim() || 
      null;

    const leadEmail = 
      (buyer['email'] as string) || 
      (payload['email'] as string) || 
      'unknown@example.com';

    const leadPhone = 
      (buyer['checkout_phone'] as string) || 
      (buyer['phone'] as string) || 
      (payload['phone_checkout_number'] as string) || 
      (payload['phone_number'] as string) || 
      null;

    // 5. Producto y Oferta
    const productName = 
      (product['name'] as string) || 
      (payload['prod_name'] as string) || 
      'Producto Desconocido';

    const productId = product['id'] ? String(product['id']) : (payload['prod'] ? String(payload['prod']) : null);
    
    // Código de oferta del producto (offer.code en purchase o data.offer.code en abandonos)
    const offerCode = 
      (offer['code'] as string) || 
      (payload['prod_off_code'] as string) || 
      (payload['off'] as string) || 
      null;

    // 6. SCK (Source Checkout Key) y Tracking
    // Soporta: purchase.origin.sck, purchase.sckPaymentLink, purchase.tracking.source_sck, y payload raíz
    const sck = 
      (origin['sck'] as string) || 
      (purchase['sckPaymentLink'] as string) || 
      (tracking['source_sck'] as string) || 
      (tracking['sck'] as string) || 
      (payload['sck'] as string) || 
      (payload['source_sck'] as string) || 
      null;

    // 7. Primer Pago vs Recurrencia / Cuota
    // recurrency_number === 1 -> primer pago; > 1 -> cuota/recurrencia recurrente
    const recurrencyNumber = 
      typeof purchase['recurrency_number'] === 'number' 
        ? purchase['recurrency_number'] 
        : (payload['recurrency_period'] ? Number(payload['recurrency_period']) : 1);

    const isSubscription = 
      typeof purchase['is_subscription'] === 'boolean' 
        ? purchase['is_subscription'] 
        : Boolean(payload['subscription_id']);

    // 8. Fecha del pago (approved_date > order_date > creation_date)
    const rawDate = 
      purchase['approved_date'] || 
      purchase['order_date'] || 
      payload['creation_date'] || 
      payload['confirmation_purchase_date'];

    let date: Date | null = null;
    if (rawDate) {
      const parsedDate = typeof rawDate === 'number' ? new Date(rawDate) : new Date(String(rawDate));
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
      }
    }

    // 9. Montos financieros y cuotas de tarjeta
    const amount = 
      Number(price['value']) || 
      Number((purchase['full_price'] as Record<string, unknown>)?.['value']) || 
      Number(payload['price']) || 
      0;

    const currency = 
      String(price['currency_value'] || (purchase['full_price'] as Record<string, unknown>)?.['currency_value'] || payload['currency'] || 'USD');

    const paymentMethod = String(payment['type'] || payload['payment_type'] || '');
    const installments = Number(payment['installments_number']) || Number(payload['installments_number']) || 1;

    return {
      source: 'HOTMART',
      externalOrderId: transaction,
      externalTxnId: eventId,
      
      leadName,
      leadEmail,
      leadPhone,
      
      productName,
      productId,
      status,
      
      amount,
      currency,
      
      paymentMethod,
      installments,

      offerCode,
      sck,
      recurrencyNumber,
      isSubscription,
      date,
      metadata: (payload as Record<string, unknown>) ?? null,
    };
  }
}

