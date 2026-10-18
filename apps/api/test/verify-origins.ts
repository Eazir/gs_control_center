import assert from 'node:assert/strict';
import { splitByOrigin } from '../src/core/sales/origin-split';

const testCases = [
  { total: 1000, comercial: 600, expectedCom: 600, expectedMkt: 400 },
  { total: 1000, comercial: 0, expectedCom: 0, expectedMkt: 1000 },
  { total: 1000, comercial: 1000, expectedCom: 1000, expectedMkt: 0 },
  { total: 999.99, comercial: 333.33, expectedCom: 333.33, expectedMkt: 666.66 },
];

for (const [index, tc] of testCases.entries()) {
  const result = splitByOrigin(tc.total, tc.comercial);
  assert.equal(
    result.comercial,
    tc.expectedCom,
    `Caso ${index + 1} comercial incorrecto: esperado ${tc.expectedCom}, obtenido ${result.comercial}`
  );
  assert.equal(
    result.marketing,
    tc.expectedMkt,
    `Caso ${index + 1} marketing incorrecto: esperado ${tc.expectedMkt}, obtenido ${result.marketing}`
  );
  assert.equal(
    Math.round((result.comercial + result.marketing) * 100) / 100,
    tc.total,
    `Caso ${index + 1} suma no coincide con total: ${result.comercial} + ${result.marketing} !== ${tc.total}`
  );
}

console.log('verify-origins: OK');
