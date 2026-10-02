import {
  buildGoalSteps,
  buildGoalsProgress,
  parseDashboardPeriod,
  resolveGoalTarget,
  splitProductRevenue,
} from '../src/modules/kpi/kpi-metrics.util';
import { CommissionGroup, CommissionPercentages } from '@gs/contracts';

const base: CommissionPercentages = {
  teamTotal: 20,
  company: 10,
  director: 2,
  closer: 8,
  external: 2,
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function almost(a: number, b: number) {
  assert(Math.abs(a - b) < 1e-6, `esperado ${b}, obtuvo ${a}`);
}

const periodCases: Array<[string | undefined, number | null]> = [
  [undefined, null],
  ['all', null],
  ['0', null],
  ['7', 7],
  ['7d', 7],
  ['30', 30],
  ['90d', 90],
  ['xyz', 30],
];
for (const [input, expected] of periodCases) {
  const got = parseDashboardPeriod(input);
  assert(got === expected, `period ${input}: esperado ${expected}, obtuvo ${got}`);
}

assert(resolveGoalTarget({ targetRevenue: 999, tiers: [{ id: '1', revenueThreshold: 5000, percentages: base }] }) === 5000, 'un escalón = ese umbral');
assert(
  resolveGoalTarget({
    targetRevenue: 0,
    tiers: [
      { id: '1', revenueThreshold: 5000, percentages: base },
      { id: '2', revenueThreshold: 3000, percentages: base },
    ],
  }) === 8000,
  'varios escalones = suma'
);
assert(resolveGoalTarget({ targetRevenue: 12000, tiers: [] }) === 12000, 'sin escalones usa targetRevenue');

const steps = buildGoalSteps(base, [
  { id: '1', revenueThreshold: 5000, percentages: { ...base, teamTotal: 25, closer: 12, director: 3, company: 10 } },
]);
assert(steps[0]?.isBase === true && steps[0]?.at === 0, 'nodo base en 0');
assert(steps[1]?.at === 5000, 'primer escalón acumula el umbral');
almost(steps[1]!.deltaTeam, 5);
almost(steps[1]!.deltaCloser, 4);
almost(steps[1]!.deltaDirector, 1);

const split = splitProductRevenue(1000, {
  id: 'g1',
  name: 'A',
  productIds: [],
  active: true,
  goals: [],
  basePercentages: { teamTotal: 20, company: 10, director: 2, closer: 8, external: 2 },
}, 0, 0);
almost(split.net, 980);
almost(split.team, 200);

const groups: CommissionGroup[] = [
  {
    id: 'g1',
    name: 'Grupo A',
    productIds: ['prod-a'],
    active: true,
    basePercentages: { teamTotal: 20, company: 10, director: 2, closer: 8, external: 2 },
    goals: [
      {
        id: 'goal-1',
        name: 'Meta A',
        targetRevenue: 0,
        currency: 'USD',
        active: true,
        tiers: [{ id: 't1', revenueThreshold: 1000, percentages: base }],
      },
    ],
  },
];
const progress = buildGoalsProgress(
  groups,
  [{ productName: 'Producto A', productId: 'prod-a', ventas: 1, facturacion: 1000 }],
  new Map([['prod-a', 'Producto A']])
);
assert(progress.length === 1, 'una meta');
almost(progress[0]!.contributedNet, 980);
almost(progress[0]!.target, 1000);

console.log('verify-kpi-metrics: OK');
