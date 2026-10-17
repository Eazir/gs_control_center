import process from 'node:process';
import {
  resolveAttribution,
  isFixedCommercialSck,
  isCommercialAffiliate,
  isCommercialAffiliateName,
  AttributionInput,
  AttributionResult,
} from '../src/core/sales';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  console.info('🧪 Ejecutando pruebas unitarias de atribución de ventas (T1)...');

  // Matriz de casos de resolveAttribution (obligatoria)
  const matrixCases: Array<{
    desc: string;
    input: AttributionInput;
    expected: AttributionResult;
  }> = [
    {
      desc: '1. Regla 1: afiliado comercial + SCK closer',
      input: { sckCloserId: 'C', sckIsFixedCommercial: false, affiliateIsComercial: true },
      expected: { closerId: 'C', attribution: 'COMERCIAL' },
    },
    {
      desc: '2. Regla 3: afiliado marketing + SCK closer',
      input: { sckCloserId: 'C', sckIsFixedCommercial: false, affiliateIsComercial: false },
      expected: { closerId: 'C', attribution: 'COMERCIAL' },
    },
    {
      desc: '3. Regla 2: afiliado comercial sin closer',
      input: { sckCloserId: null, sckIsFixedCommercial: false, affiliateIsComercial: true },
      expected: { closerId: null, attribution: 'COMERCIAL' },
    },
    {
      desc: '4. Regla 4: afiliado marketing sin closer',
      input: { sckCloserId: null, sckIsFixedCommercial: false, affiliateIsComercial: false },
      expected: { closerId: null, attribution: 'MARKETING' },
    },
    {
      desc: '5. SCK fijo referencial (sin closer)',
      input: { sckCloserId: null, sckIsFixedCommercial: true, affiliateIsComercial: false },
      expected: { closerId: null, attribution: 'COMERCIAL' },
    },
    {
      desc: '6. SCK fijo + afiliado comercial',
      input: { sckCloserId: null, sckIsFixedCommercial: true, affiliateIsComercial: true },
      expected: { closerId: null, attribution: 'COMERCIAL' },
    },
    {
      desc: '7. Prioridad: SCK closer gana a SCK fijo',
      input: { sckCloserId: 'C', sckIsFixedCommercial: true, affiliateIsComercial: false },
      expected: { closerId: 'C', attribution: 'COMERCIAL' },
    },
  ];

  for (const { desc, input, expected } of matrixCases) {
    const result = resolveAttribution(input);
    assert(
      result.closerId === expected.closerId,
      `${desc} -> closerId esperado '${expected.closerId}', obtuvo '${result.closerId}'`
    );
    assert(
      result.attribution === expected.attribution,
      `${desc} -> attribution esperada '${expected.attribution}', obtuvo '${result.attribution}'`
    );
  }

  // Casos de regresión de flags (sin DB)
  // isFixedCommercialSck
  assert(isFixedCommercialSck('dh') === true, "isFixedCommercialSck('dh') debe ser true");
  assert(isFixedCommercialSck('diego') === true, "isFixedCommercialSck('diego') debe ser true");
  assert(isFixedCommercialSck('reynald') === true, "isFixedCommercialSck('reynald') debe ser true");
  assert(isFixedCommercialSck('agustin') === false, "isFixedCommercialSck('agustin') debe ser false");
  assert(isFixedCommercialSck(null) === false, "isFixedCommercialSck(null) debe ser false");
  assert(isFixedCommercialSck('') === false, "isFixedCommercialSck('') debe ser false");

  // isCommercialAffiliate
  assert(
    isCommercialAffiliate([{ affiliate_code: 'b100311196f' }]) === true,
    "isCommercialAffiliate([{ affiliate_code: 'b100311196f' }]) debe ser true"
  );
  assert(
    isCommercialAffiliate([{ name: 'Reynald' }]) === true,
    "isCommercialAffiliate([{ name: 'Reynald' }]) debe ser true"
  );
  assert(
    isCommercialAffiliate([{ name: 'Marketing Partner' }]) === false,
    "isCommercialAffiliate([{ name: 'Marketing Partner' }]) debe ser false"
  );
  assert(
    isCommercialAffiliate(null) === false,
    'isCommercialAffiliate(null) debe ser false'
  );
  assert(
    isCommercialAffiliate([]) === false,
    'isCommercialAffiliate([]) debe ser false'
  );
  assert(
    isCommercialAffiliate(undefined) === false,
    'isCommercialAffiliate(undefined) debe ser false'
  );

  // isCommercialAffiliateName
  assert(isCommercialAffiliateName('Reynald') === true, "isCommercialAffiliateName('Reynald') debe ser true");
  assert(isCommercialAffiliateName('Diego') === true, "isCommercialAffiliateName('Diego') debe ser true");
  assert(isCommercialAffiliateName('dh') === true, "isCommercialAffiliateName('dh') debe ser true");
  assert(isCommercialAffiliateName('b100311196f') === true, "isCommercialAffiliateName('b100311196f') debe ser true");
  assert(isCommercialAffiliateName('Marketing Partner') === false, "isCommercialAffiliateName('Marketing Partner') debe ser false");
  assert(isCommercialAffiliateName(null) === false, "isCommercialAffiliateName(null) debe ser false");
  assert(isCommercialAffiliateName('') === false, "isCommercialAffiliateName('') debe ser false");
  assert(isCommercialAffiliateName(undefined) === false, "isCommercialAffiliateName(undefined) debe ser false");

  console.info('verify-attribution: OK');
}

try {
  run();
} catch (error) {
  console.error('❌ Fallo en verify-attribution:', error);
  process.exit(1);
}
