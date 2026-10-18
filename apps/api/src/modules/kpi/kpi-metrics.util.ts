import type { CommissionGroup, CommissionGroupGoal, CommissionPercentages } from '@gs/contracts';

export type ProductKpiRow = {
  productName: string;
  productId: string | null;
  ventas: number;
  facturacion: number;
};

export type GoalStepMarker = {
  /** Posición acumulada sobre la barra (el umbral visible). */
  at: number;
  /** Valor configurado en el escalón (puede ser incremento, no el acumulado). */
  revenueThreshold: number;
  percentages: CommissionPercentages;
  /** Diferencia vs el tramo anterior (base o escalón previo). Cero en el nodo inicial. */
  deltaTeam: number;
  deltaCloser: number;
  deltaDirector: number;
  isBase: boolean;
};

export type GoalProgressItem = {
  groupId: string;
  groupName: string;
  goalId: string;
  goalName: string;
  /** Meta total: un escalón = ese umbral; varios = suma de umbrales. */
  target: number;
  /** Contribución con facturación neta (bruta − % externo del grupo). */
  contributedNet: number;
  basePercentages: CommissionPercentages;
  steps: GoalStepMarker[];
};

/**
 * Interpreta el query `period` del dashboard.
 * `all` / `0` = sin recorte de fechas. Números sueltos (7, 30, 90) y sufijo `d` son equivalentes.
 */
export function parseDashboardPeriod(period?: string): number | null {
  if (period === undefined || period === '' || period === 'all' || period === '0') {
    return null;
  }
  const normalized = period.endsWith('d') ? period.slice(0, -1) : period;
  const n = Number(normalized);
  if (Number.isFinite(n) && n > 0) {
    return Math.floor(n);
  }
  return 30;
}

/**
 * Total de una meta de grupo: un solo escalón es la meta completa;
 * varios escalones se suman. Sin escalones se usa `targetRevenue` (0 si tampoco existe).
 */
export function resolveGoalTarget(goal: Pick<CommissionGroupGoal, 'targetRevenue' | 'tiers'>): number {
  const thresholds = (goal.tiers ?? [])
    .map((t) => t.revenueThreshold)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (thresholds.length === 0) {
    return goal.targetRevenue > 0 ? goal.targetRevenue : 0;
  }
  if (thresholds.length === 1) {
    return thresholds[0]!;
  }
  return thresholds.reduce((acc, n) => acc + n, 0);
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Nodo 0 (comisión base) + un nodo por escalón ordenado.
 * La posición `at` es la suma acumulada de umbrales para alinear la barra con el total.
 */
export function buildGoalSteps(
  base: CommissionPercentages,
  tiers: CommissionGroupGoal['tiers']
): GoalStepMarker[] {
  const ordered = [...(tiers ?? [])].sort((a, b) => a.revenueThreshold - b.revenueThreshold);
  const steps: GoalStepMarker[] = [
    {
      at: 0,
      revenueThreshold: 0,
      percentages: base,
      deltaTeam: 0,
      deltaCloser: 0,
      deltaDirector: 0,
      isBase: true,
    },
  ];

  let cumulative = 0;
  let prev = base;
  for (const tier of ordered) {
    cumulative += tier.revenueThreshold;
    const p = tier.percentages;
    steps.push({
      at: cumulative,
      revenueThreshold: tier.revenueThreshold,
      percentages: p,
      deltaTeam: roundPct(p.teamTotal - prev.teamTotal),
      deltaCloser: roundPct(p.closer - prev.closer),
      deltaDirector: roundPct(p.director - prev.director),
      isBase: false,
    });
    prev = p;
  }
  return steps;
}

function productMatchesGroup(
  row: ProductKpiRow,
  group: CommissionGroup,
  idToName: Map<string, string>
): boolean {
  return group.productIds.some((pid) => {
    if (row.productId && pid === row.productId) return true;
    if (pid === row.productName) return true;
    return idToName.get(pid) === row.productName;
  });
}

/**
 * Aplica el % externo / % equipo del grupo (o defaults) sobre la bruta del producto.
 */
export function splitProductRevenue(
  gross: number,
  group: CommissionGroup | undefined,
  defaultExternal: number,
  defaultTeam: number
): { net: number; team: number } {
  const externalPct = group?.basePercentages.external ?? defaultExternal;
  const teamPct = group?.basePercentages.teamTotal ?? defaultTeam;
  return {
    net: gross * ((100 - externalPct) / 100),
    team: gross * (teamPct / 100),
  };
}

/**
 * Progreso de metas por grupo usando facturación neta de los productos de ese grupo.
 */
export function buildGoalsProgress(
  groups: CommissionGroup[],
  productRows: ProductKpiRow[],
  idToName: Map<string, string>
): GoalProgressItem[] {
  const items: GoalProgressItem[] = [];

  for (const group of groups) {
    if (group.active === false) continue;

    let groupGross = 0;
    for (const row of productRows) {
      if (productMatchesGroup(row, group, idToName)) {
        groupGross += row.facturacion;
      }
    }
    const { net: groupNet } = splitProductRevenue(groupGross, group, 0, 0);

    for (const goal of group.goals ?? []) {
      if (goal.active === false) continue;
      items.push({
        groupId: group.id,
        groupName: group.name,
        goalId: goal.id,
        goalName: goal.name,
        target: resolveGoalTarget(goal),
        contributedNet: groupNet,
        basePercentages: group.basePercentages,
        steps: buildGoalSteps(group.basePercentages, goal.tiers),
      });
    }
  }

  return items;
}

export function findGroupForProduct(
  groups: CommissionGroup[],
  row: ProductKpiRow,
  idToName: Map<string, string>
): CommissionGroup | undefined {
  return groups.find((g) => g.active !== false && productMatchesGroup(row, g, idToName));
}

export { splitByOrigin } from '../../core/sales/origin-split';
