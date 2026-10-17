import process from 'node:process';
import { normalizeSaleStatus } from '../src/core/sales/normalize-sale-status';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  console.info('🧪 Ejecutando pruebas unitarias de normalización de estado (T1)...');

  // Casos obligatorios (nuevos)
  const refundCases: Array<[string | null | undefined, string]> = [
    ['PURCHASE_REFUNDED', 'REFUNDED'],
    ['REEMBOLSADO', 'REFUNDED'],
    ['REEMBOLSO', 'REFUNDED'],
    ['REFUNDED', 'REFUNDED'],
    ['purchase_refunded', 'REFUNDED'],
    ['  purchase refunded  ', 'REFUNDED'],
  ];

  for (const [input, expected] of refundCases) {
    const got = normalizeSaleStatus(input);
    assert(got === expected, `Reembolso '${input}': esperado '${expected}', obtuvo '${got}'`);
  }

  // Casos de regresión (no deben cambiar)
  const regressionCases: Array<[string | null | undefined, string]> = [
    ['COMPLETE', 'COMPLETE'],
    ['COMPLETED', 'COMPLETE'],
    ['PURCHASE_COMPLETE', 'COMPLETE'],
    ['APPROVED', 'APPROVED'],
    ['PURCHASE_APPROVED', 'APPROVED'],
    ['APROBADO', 'APPROVED'],
    ['CANCELED', 'CANCELED'],
    ['CANCELLED', 'CANCELED'],
    ['PURCHASE_CANCELED', 'CANCELED'],
    ['EXPIRED', 'EXPIRED'],
    ['PURCHASE_EXPIRED', 'EXPIRED'],
    ['ABANDONED_CART', 'ABANDONED_CART'],
    ['PURCHASE_OUT_OF_SHOPPING_CART', 'ABANDONED_CART'],
    ['CHARGEBACK', 'CHARGEBACK'],
    ['DISPUTE', 'DISPUTE'],
    ['SOMETHING_NEW', 'SOMETHING_NEW'],
    [null, ''],
    [undefined, ''],
    ['', ''],
  ];

  for (const [input, expected] of regressionCases) {
    const got = normalizeSaleStatus(input);
    assert(got === expected, `Regresión '${input}': esperado '${expected}', obtuvo '${got}'`);
  }

  console.info('verify-sale-status: OK');
}

try {
  run();
} catch (error) {
  console.error('❌ Fallo en verify-sale-status:', error);
  process.exit(1);
}
