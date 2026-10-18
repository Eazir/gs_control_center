import assert from 'node:assert/strict';
import { computeBackfillAttribution } from '../src/core/sales/affiliation';

console.info('🧪 Ejecutando pruebas unitarias de backfill de atribución (T1)...');

// Caso 1: closer presente, no fixed, affiliate false
const c1 = computeBackfillAttribution({
  sckCloserId: 'C',
  sckIsFixedCommercial: false,
  affiliateIsComercial: false,
  currentAttribution: undefined,
});
assert.equal(c1.closerId, 'C');
assert.equal(c1.attribution, 'COMERCIAL');

// Caso 2: closer presente, no fixed, affiliate true
const c2 = computeBackfillAttribution({
  sckCloserId: 'C',
  sckIsFixedCommercial: false,
  affiliateIsComercial: true,
  currentAttribution: undefined,
});
assert.equal(c2.closerId, 'C');
assert.equal(c2.attribution, 'COMERCIAL');

// Caso 3: sin closer, SCK comercial fijo, affiliate false
const c3 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: true,
  affiliateIsComercial: false,
  currentAttribution: undefined,
});
assert.equal(c3.closerId, null);
assert.equal(c3.attribution, 'COMERCIAL');

// Caso 4: sin closer, SCK comercial fijo, affiliate true
const c4 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: true,
  affiliateIsComercial: true,
  currentAttribution: undefined,
});
assert.equal(c4.closerId, null);
assert.equal(c4.attribution, 'COMERCIAL');

// Caso 5: sin closer, no fixed, affiliate true
const c5 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: false,
  affiliateIsComercial: true,
  currentAttribution: undefined,
});
assert.equal(c5.closerId, null);
assert.equal(c5.attribution, 'COMERCIAL');

// Caso 6: sin closer, no fixed, affiliate false
const c6 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: false,
  affiliateIsComercial: false,
  currentAttribution: undefined,
});
assert.equal(c6.closerId, null);
assert.equal(c6.attribution, 'MARKETING');

// Caso 7: sin closer, no fixed, affiliate undefined, current COMERCIAL -> preserva COMERCIAL
const c7 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: false,
  affiliateIsComercial: undefined,
  currentAttribution: 'COMERCIAL',
});
assert.equal(c7.closerId, null);
assert.equal(c7.attribution, 'COMERCIAL');

// Caso 8: sin closer, no fixed, affiliate undefined, current MARKETING -> preserva MARKETING
const c8 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: false,
  affiliateIsComercial: undefined,
  currentAttribution: 'MARKETING',
});
assert.equal(c8.closerId, null);
assert.equal(c8.attribution, 'MARKETING');

// Caso 9: sin closer, no fixed, affiliate undefined, current undefined -> MARKETING
const c9 = computeBackfillAttribution({
  sckCloserId: null,
  sckIsFixedCommercial: false,
  affiliateIsComercial: undefined,
  currentAttribution: undefined,
});
assert.equal(c9.closerId, null);
assert.equal(c9.attribution, 'MARKETING');

console.info('verify-backfill: OK');
