import process from 'node:process';
import { ListFiltersSchema, ListFilters } from '@gs/contracts';
import {
  encodeCursor,
  decodeCursor,
  buildDateRange,
  buildOriginClause,
  buildSaleWhereClause,
  buildLeadWhereClause,
} from '../src/core/sales';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  console.info('🧪 Ejecutando pruebas unitarias de filtros y paginación (T1-T3)...');

  // ── T1: Zod de filtros (ListFiltersSchema) ───────────────────────────────
  console.info('T1. Validando ListFiltersSchema...');

  // Defaults
  const defParsed = ListFiltersSchema.parse({});
  assert(defParsed.origin === 'todos', "Default origin debe ser 'todos'");
  assert(defParsed.limit === 25, 'Default limit debe ser 25');

  // Coerce limit
  const coerceParsed = ListFiltersSchema.parse({ limit: '10' });
  assert(coerceParsed.limit === 10, 'limit string debe convertirse a number 10');

  // Día válido e inválido
  assert(ListFiltersSchema.safeParse({ day: '2026-10-01' }).success, 'Día YYYY-MM-DD debe ser válido');
  assert(!ListFiltersSchema.safeParse({ day: '10/01/2026' }).success, 'Día DD/MM/YYYY debe fallar');

  // Origen válido e inválido
  assert(ListFiltersSchema.safeParse({ origin: 'comercial' }).success, "origin 'comercial' debe ser válido");
  assert(ListFiltersSchema.safeParse({ origin: 'marketing' }).success, "origin 'marketing' debe ser válido");
  assert(!ListFiltersSchema.safeParse({ origin: 'otro' }).success, "origin 'otro' debe fallar");

  // Closer UUID válido e inválido
  assert(
    ListFiltersSchema.safeParse({ closerId: 'c2e56614-2cbf-4e78-8123-1d01242c74d1' }).success,
    'UUID v4 válido debe pasar'
  );
  assert(!ListFiltersSchema.safeParse({ closerId: 'no-uuid' }).success, 'UUID inválido debe fallar');

  // Limit fuera de rango
  assert(!ListFiltersSchema.safeParse({ limit: '1000' }).success, 'limit > 100 debe fallar');
  assert(!ListFiltersSchema.safeParse({ limit: '0' }).success, 'limit < 1 debe fallar');
  console.info('  ✔ T1 ListFiltersSchema verificado.');

  // ── T2: Helpers de filtros ────────────────────────────────────────────────
  console.info('T2. Validando helpers de filtros...');

  // buildOriginClause
  assert(buildOriginClause('todos') === undefined, "origin 'todos' debe retornar undefined");
  const origCom = buildOriginClause('comercial');
  assert(origCom !== undefined && 'OR' in origCom, "origin 'comercial' debe tener predicado OR");
  const origMkt = buildOriginClause('marketing');
  assert(origMkt !== undefined && 'AND' in origMkt, "origin 'marketing' debe tener predicado AND");

  // buildDateRange
  const r1 = buildDateRange('2026-10-01', undefined, undefined);
  assert(r1 !== undefined, 'buildDateRange(day) debe retornar rango');
  assert(r1!.gte.toISOString() === '2026-10-01T00:00:00.000Z', 'gte inicio del día');
  assert(r1!.lt.toISOString() === '2026-10-01T23:59:59.999Z', 'lt fin del día');

  const r2 = buildDateRange(undefined, '2026-10-01', '2026-10-31');
  assert(r2 !== undefined, 'buildDateRange(from, to) debe retornar rango');
  assert(r2!.gte.toISOString() === '2026-10-01T00:00:00.000Z', 'gte from');
  assert(r2!.lt.toISOString() === '2026-10-31T23:59:59.999Z', 'lt to');

  assert(buildDateRange(undefined, undefined, undefined) === undefined, 'buildDateRange vacio es undefined');

  // buildSaleWhereClause
  const baseFilters: ListFilters = { origin: 'todos', limit: 25 };

  // 1. approvedOnly: true, sin status
  const wSaleApproved = buildSaleWhereClause('proj-1', baseFilters, { approvedOnly: true });
  const wSaleApprovedStr = JSON.stringify(wSaleApproved);
  assert(wSaleApprovedStr.includes('APPROVED') && wSaleApprovedStr.includes('COMPLETE'), 'Debe incluir whitelist APPROVED');

  // 2. approvedOnly: true, con status: 'REFUNDED'
  const wSaleRefunded = buildSaleWhereClause('proj-1', { ...baseFilters, status: 'REFUNDED' }, { approvedOnly: true });
  const wSaleRefundedStr = JSON.stringify(wSaleRefunded);
  assert(wSaleRefundedStr.includes('REFUNDED') && !wSaleRefundedStr.includes('"in":'), 'status explícito reemplaza whitelist');

  // 3. approvedOnly: false
  const wSaleAll = buildSaleWhereClause('proj-1', baseFilters, { approvedOnly: false });
  assert(!JSON.stringify(wSaleAll).includes('status'), 'approvedOnly: false sin status no debe incluir filtro de status');

  // 4. role: 'CLOSER', userId: 'closer-u'
  const wSaleCloser = buildSaleWhereClause('proj-1', baseFilters, { role: 'CLOSER', userId: 'closer-u' });
  assert(JSON.stringify(wSaleCloser).includes('closer-u'), 'Debe restringir por closerId del usuario');

  // 5. closerId, productId, origin comercial
  const wSaleCombo = buildSaleWhereClause('proj-1', {
    ...baseFilters,
    closerId: 'c2e56614-2cbf-4e78-8123-1d01242c74d1',
    productId: 'prod-99',
    origin: 'comercial',
  });
  const wSaleComboStr = JSON.stringify(wSaleCombo);
  assert(wSaleComboStr.includes('prod-99'), 'Debe incluir productId');
  assert(wSaleComboStr.includes('c2e56614-2cbf-4e78-8123-1d01242c74d1'), 'Debe incluir closerId');
  assert(wSaleComboStr.includes('COMERCIAL'), 'Debe incluir origen comercial');

  // buildLeadWhereClause
  // 1. role: 'CLOSER', userId: 'closer-u'
  const wLeadCloser = buildLeadWhereClause('proj-1', baseFilters, { role: 'CLOSER', userId: 'closer-u' });
  const wLeadCloserStr = JSON.stringify(wLeadCloser);
  assert(wLeadCloserStr.includes('closer-u'), 'Lead closer check presente');

  // 2. closerId y productId
  const wLeadCombo = buildLeadWhereClause('proj-1', {
    ...baseFilters,
    closerId: 'c2e56614-2cbf-4e78-8123-1d01242c74d1',
    productId: 'prod-99',
    origin: 'comercial',
    search: 'juan',
  });
  const wLeadComboStr = JSON.stringify(wLeadCombo);
  assert(wLeadComboStr.includes('prod-99'), 'Lead debe incluir filtro productId en sales.some');
  assert(wLeadComboStr.includes('c2e56614-2cbf-4e78-8123-1d01242c74d1'), 'Lead debe incluir closerId');
  assert(wLeadComboStr.includes('juan'), 'Lead debe incluir search en name/email/phone/externalTxnId');

  // 3. unassigned en ventas
  const wSaleUnassigned = buildSaleWhereClause('proj-1', { ...baseFilters, unassigned: true });
  assert(JSON.stringify(wSaleUnassigned).includes('"closerId":null'), 'Sale unassigned debe incluir closerId null');

  // 4. stage en ventas
  const wSaleStage = buildSaleWhereClause('proj-1', { ...baseFilters, stage: 'won' });
  assert(JSON.stringify(wSaleStage).includes('won'), 'Sale stage debe incluir pipelineStage won');

  // 5. unassigned en leads
  const wLeadUnassigned = buildLeadWhereClause('proj-1', { ...baseFilters, unassigned: true });
  const wLeadUnassignedStr = JSON.stringify(wLeadUnassigned);
  assert(wLeadUnassignedStr.includes('"closerId":null'), 'Lead unassigned debe incluir closerId null');
  assert(wLeadUnassignedStr.includes('"not":null'), 'Lead unassigned debe excluir sales con closer');

  // 6. stage en leads
  const wLeadStage = buildLeadWhereClause('proj-1', { ...baseFilters, stage: 'won' });
  assert(JSON.stringify(wLeadStage).includes('won'), 'Lead stage debe incluir pipelineStage won');

  console.info('  ✔ T2 helpers de filtros verificados.');

  // ── T3: Cursor keyset ────────────────────────────────────────────────────
  console.info('T3. Validando cursor keyset...');
  const now = new Date('2026-10-15T12:30:45.678Z');
  const testId = '4e12c140-5e58-45b0-bf5d-4f05697d8e20';
  const encoded = encodeCursor(now, testId);
  const decoded = decodeCursor(encoded);

  assert(decoded !== null, 'Cursor debe decodificarse');
  assert(decoded!.createdAt.getTime() === now.getTime(), 'Timestamp debe coincidir exactamente');
  assert(decoded!.id === testId, 'ID debe coincidir');

  // Cursors no válidos
  assert(decodeCursor('no-valido') === null, 'Cursor no-valido debe retornar null');
  assert(decodeCursor(Buffer.from('hola').toString('base64url')) === null, 'String sin separador debe retornar null');
  assert(decodeCursor(Buffer.from('invalid-date|some-id').toString('base64url')) === null, 'Fecha inválida debe retornar null');
  console.info('  ✔ T3 cursor keyset verificado.');

  console.info('verify-list-filters: OK');
}

try {
  run();
} catch (error) {
  console.error('❌ Fallo en verify-list-filters:', error);
  process.exit(1);
}
