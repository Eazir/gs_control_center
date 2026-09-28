
const PORT = 3001; // El puerto del API (3001) o de ingest (3002)
const PROJECT_ID = process.argv[2];

if (!PROJECT_ID) {
  console.error("❌ Error: Debes proporcionar un PROJECT_ID válido como argumento.");
  console.log("👉 Uso: node test-webhooks.mjs <uuid-del-proyecto>");
  process.exit(1);
}

const WEBHOOK_URL = `http://localhost:${PORT}/integrations/hotmart/webhook/${PROJECT_ID}`;

// Función para enviar payloads
async function sendWebhook(testName, payload) {
  console.log(`\n===========================================`);
  console.log(`🚀 Enviando Test: ${testName}`);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.text();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Response:`, data);
  } catch (error) {
    console.error(`❌ Fetch Error:`, error.message);
  }
}

// Genera un payload base de Hotmart versión 3
const basePayload = (status, email, transaction, productName, offerCode, sck, price, installments) => ({
  id: `event-${Date.now()}-${Math.floor(Math.random()*10000)}`,
  creation_date: new Date().getTime(),
  event: status === 'APPROVED' ? 'PURCHASE_APPROVED' 
       : status === 'CANCELED' ? 'PURCHASE_CANCELED'
       : status === 'REFUNDED' ? 'PURCHASE_REFUNDED'
       : status === 'CHARGEBACK' ? 'PURCHASE_CHARGEBACK'
       : status === 'DELAYED' ? 'PURCHASE_DELAYED'
       : 'PURCHASE_OUT_OF_SHOPPING_CART',
  version: "3.0.0",
  data: {
    product: {
      id: 123456,
      name: productName,
      has_co_production: false
    },
    buyer: {
      name: email.includes('Debe') ? email.split('@')[0].replace(/_/g, ' ') : "Lead de Prueba",
      email: email,
      phone: "+1234567890"
    },
    purchase: {
      original_offer_price: { value: price, currency_value: "USD" },
      price: { value: price, currency_value: "USD" },
      payment_method: "CREDIT_CARD",
      installments_number: installments,
      status: status,
      transaction: transaction,
      sckPaymentLink: sck,
      offer: { code: offerCode }
    }
  }
});

async function runTests() {
  console.log(`Iniciando batería de pruebas Webhook Fase 6 hacia: ${WEBHOOK_URL}\n`);

  // =========================================================================
  // --- TESTS DEBE PASAR ---
  // =========================================================================

  // 1. Debe Pasar (Asignación a Closer 1)
  // Producto 1 | Oferta: test1 | SCK: closer-1 | 1 cuota | $500
  await sendWebhook(
    "Debe Pasar 1: Carrito Abandonado - Producto 1 -> Debe asignarse a Closer 1 en 'Para Recuperación'", 
    basePayload("ABANDONED_CART", "Debe_Pasar_1@ejemplo.com", "TX_PASS_1", "Producto de prueba 1", "test1", "closer-1", 500, 1)
  );

  // 2. Debe Pasar (Asignación a Closer 2)
  // Producto 2 | Oferta: test2 | SCK: closer-2 | 2 cuotas | $300
  await sendWebhook(
    "Debe Pasar 2: Compra Aprobada - Producto 2 -> Debe asignarse a Closer 2 en 'Ganado'", 
    basePayload("APPROVED", "Debe_Pasar_2@ejemplo.com", "TX_PASS_2", "Producto de prueba 2", "test2", "closer-2", 300, 2)
  );

  // 3. Debe Pasar (Cancelado - Closer 1)
  // Producto 4 | Oferta: test4 | SCK: closer-1 | 2 cuotas | $600
  await sendWebhook(
    "Debe Pasar 3: Compra Cancelada - Producto 4 -> Debe asignarse a Closer 1 en 'Para Recuperación'", 
    basePayload("CANCELED", "Debe_Pasar_3@ejemplo.com", "TX_PASS_3", "producto de prueba 4", "test4", "closer-1", 600, 2)
  );

  // 4. Debe Pasar (Marketing - Sin Closer dueño)
  // Producto 6 | Oferta: test6 | SCK: marketing | 1 cuota | $500
  await sendWebhook(
    "Debe Pasar 4: Compra Aprobada - Producto 6 -> Sin closer, en 'Ganado'", 
    basePayload("APPROVED", "Debe_Pasar_4@ejemplo.com", "TX_PASS_4", "Producto de prueba 6", "test6", "marketing", 500, 1)
  );

  // 5. Debe Pasar (Trazabilidad Mismo Lead)
  // Paso A: Abandono
  await sendWebhook(
    "Debe Pasar 5A: Trazabilidad (Abandono) - Producto 1", 
    basePayload("ABANDONED_CART", "Debe_Pasar_5@ejemplo.com", "TX_PASS_5", "Producto de prueba 1", "test1", "closer-1", 500, 1)
  );
  // Paso B: Compra aprobada para el MISMO email, distinta transacción final
  await sendWebhook(
    "Debe Pasar 5B: Trazabilidad (Compra) - Producto 1 -> El lead debe pasar de recuperación a 'Ganado'", 
    basePayload("APPROVED", "Debe_Pasar_5@ejemplo.com", "TX_PASS_5_BUY", "Producto de prueba 1", "test1", "closer-1", 500, 1)
  );


  // =========================================================================
  // --- TESTS NO DEBE PASAR ---
  // =========================================================================

  // 6. No Debe Pasar (Código de oferta inválido)
  // Oferta "fake-offer" no existe en el catálogo. Debería ignorarse.
  await sendWebhook(
    "No Debe Pasar 6: Oferta inválida -> Debe ser ignorado por no estar en el catálogo activo", 
    basePayload("APPROVED", "No_Debe_Pasar_6@ejemplo.com", "TX_FAIL_1", "Producto Fake", "fake-offer", "closer-1", 500, 1)
  );

  // 7. No Debe Pasar (Transacción duplicada - Idempotencia)
  await sendWebhook(
    "No Debe Pasar 7A: Enviar transacción original (Válida)", 
    basePayload("APPROVED", "No_Debe_Pasar_7@ejemplo.com", "TX_FAIL_2", "Producto de prueba 2", "test2", "closer-2", 300, 2)
  );
  await sendWebhook(
    "No Debe Pasar 7B: Re-enviar la misma transacción -> Debe ser Skipped (Ignorada por Idempotencia)", 
    basePayload("APPROVED", "No_Debe_Pasar_7@ejemplo.com", "TX_FAIL_2", "Producto de prueba 2", "test2", "closer-2", 300, 2)
  );

  // 8. No Debe Pasar (Falta de datos críticos)
  const missingEmailPayload = basePayload("APPROVED", "", "TX_FAIL_3", "Producto de prueba 1", "test1", "closer-1", 500, 1);
  delete missingEmailPayload.data.buyer.email; // Borramos el email intencionalmente
  await sendWebhook(
    "No Debe Pasar 8: Sin Email en el Payload -> Debe devolver HTTP 400 Bad Request o ser ignorada", 
    missingEmailPayload
  );

  console.log(`\n🎉 Pruebas finalizadas. Verifica los logs del API (make logs S=api) y la UI del Kanban.`);
}

runTests();
