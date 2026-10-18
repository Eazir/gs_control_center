'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { AlertCircle, RefreshCw } from 'lucide-react';
import styles from './DashboardView.module.css';

interface DashboardViewProps {
  projectId: string;
  effectiveRole: string;
}

type PeriodValue = '7' | '30' | '90' | 'all';

interface CloserRankRow {
  rank: number;
  id: string;
  closer: string;
  ventas: number;
  facturacion: number;
  sharePct: number;
}

interface GoalStepMarker {
  at: number;
  revenueThreshold: number;
  percentages: {
    teamTotal: number;
    director: number;
    closer: number;
    external: number;
  };
  deltaTeam: number;
  deltaCloser: number;
  deltaDirector: number;
  isBase: boolean;
}

interface GoalProgressItem {
  groupId: string;
  groupName: string;
  goalId: string;
  goalName: string;
  target: number;
  contributedNet: number;
  steps: GoalStepMarker[];
}

interface OriginSplit {
  ventas: number;
  facturacionBruta: number;
  facturacionNeta: number;
}

interface DashboardPayload {
  calculatedAt: string;
  kpis: {
    facturacionBruta: number;
    facturacionNeta: number;
    facturacionProxima: number;
    facturacionEquipo?: number;
    ventasTotales: number;
  };
  origins?: {
    comercial: OriginSplit;
    marketing: OriginSplit;
  };
  salesVolumeChart: Array<{ date: string; ventas: number; facturacion: number }>;
  closersRanking: CloserRankRow[];
  goalsProgress: GoalProgressItem[];
  launchMetrics: {
    productos: Array<{ producto: string; ventas: number; facturacion: number }>;
  };
  comparatives: {
    sources: Array<{ name: string; ventas: number; facturacion: number }>;
    teams: Array<{ name: string; ventas: number; facturacion: number }>;
  };
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

const signedPct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10} pp`;

const PIE_COLORS = ['#f5b921', '#9c9482'];

export function DashboardView({ projectId, effectiveRole }: DashboardViewProps) {
  const isCliente = effectiveRole === 'CLIENTE';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodValue>('30');
  const [day, setDay] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [metricMode, setMetricMode] = useState<'ventas' | 'fact'>('ventas');
  const [breakdownType, setBreakdownType] = useState<'closer' | 'prod' | 'acc'>(
    isCliente ? 'prod' : 'closer'
  );

  async function loadData(nextPeriod: PeriodValue, nextDay?: string, nextFrom?: string, nextTo?: string) {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (nextDay) {
        params.set('day', nextDay);
      } else if (nextFrom || nextTo) {
        if (nextFrom) params.set('from', nextFrom);
        if (nextTo) params.set('to', nextTo);
      } else {
        params.set('period', nextPeriod);
      }
      const res = await fetchWithAuth(`/kpi/project/${projectId}/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('No se pudieron cargar las métricas. Reintenta en unos segundos.');
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(period, day, fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, period, day, fromDate, toDate]);

  if (loading && !data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No se cargaron las métricas</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void loadData(period)}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { kpis, salesVolumeChart, closersRanking, launchMetrics, comparatives, goalsProgress, calculatedAt } =
    data;

  const BRUTA = kpis.facturacionBruta || 0;
  const NETA = kpis.facturacionNeta || 0;
  const TOTAL = kpis.ventasTotales || 0;
  const POR_INGRESAR = kpis.facturacionProxima || 0;
  const EQUIPO = kpis.facturacionEquipo;

  const comOrigin = data.origins?.comercial;
  const mkOrigin = data.origins?.marketing;

  const mk = comparatives.teams.find((t) => t.name === 'Marketing');
  const com = comparatives.teams.find((t) => t.name === 'Comercial');
  const MK_V = mkOrigin ? mkOrigin.ventas : (mk?.ventas || 0);
  const COM_V = comOrigin ? comOrigin.ventas : (com?.ventas || 0);
  const MK_F = mkOrigin ? mkOrigin.facturacionBruta : (mk?.facturacion || 0);
  const COM_F = comOrigin ? comOrigin.facturacionBruta : (com?.facturacion || 0);
  const MK_NETA = mkOrigin ? mkOrigin.facturacionNeta : 0;
  const COM_NETA = comOrigin ? comOrigin.facturacionNeta : 0;

  type BreakdownRow = { name: string; ventas: number; facturacion: number; sharePct?: number; barPct?: number; rank?: number };

  let breakdownData: BreakdownRow[] = [];
  if (breakdownType === 'closer') {
    breakdownData = closersRanking.map((c) => ({
      name: c.closer || 'Sin asignar',
      ventas: c.ventas,
      facturacion: c.facturacion,
    }));
  } else if (breakdownType === 'prod') {
    const prodMap = new Map<string, { ventas: number; facturacion: number }>();
    [...launchMetrics.productos].forEach((p) => {
      const name = p.producto || 'Desconocido';
      const existing = prodMap.get(name) || { ventas: 0, facturacion: 0 };
      prodMap.set(name, {
        ventas: existing.ventas + p.ventas,
        facturacion: existing.facturacion + p.facturacion,
      });
    });
    breakdownData = Array.from(prodMap.entries()).map(([name, data]) => ({
      name,
      ventas: data.ventas,
      facturacion: data.facturacion,
    }));
  } else {
    breakdownData = comparatives.sources.map((s) => ({
      name: s.name,
      ventas: s.ventas,
      facturacion: s.facturacion,
    }));
  }

  // Ordenar de más a menos por volumen de dinero facturado
  breakdownData.sort((a, b) => b.facturacion - a.facturacion);

  // Calcular el total de facturación para el porcentaje y asignar posición (rank)
  const totalFacturacion = breakdownData.reduce((sum, item) => sum + item.facturacion, 0);
  const maxFacturacion = breakdownData.length > 0 ? (breakdownData[0]?.facturacion ?? 0) : 0;
  breakdownData.forEach((item, index) => {
    item.rank = index + 1;
    item.sharePct = totalFacturacion > 0 ? (item.facturacion / totalFacturacion) * 100 : 0;
    item.barPct = maxFacturacion > 0 ? (item.facturacion / maxFacturacion) * 100 : 0;
  });

  const chartPoints = salesVolumeChart.map((point) => ({
    l: point.date.split('-').slice(1).join('/'),
    v: metricMode === 'ventas' ? point.ventas : point.facturacion,
  }));

  const dVals = chartPoints.map((p) => p.v);
  const maxVal = dVals.length > 0 ? Math.max(...dVals) : 0;
  const mxChart = maxVal * 1.15 || 1;
  const W = 620,
    H = 250,
    L = 48,
    B = 28,
    T = 14,
    n = dVals.length,
    bw = n > 0 ? (W - L - 10) / n : 0;
  const fmtChart = (v: number) =>
    metricMode === 'ventas' ? Math.round(v) : v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v);

  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const y = T + (H - T - B) * (1 - i / 4);
    gridLines.push(
      <g key={i}>
        <line x1={L} x2={W - 6} y1={y} y2={y} stroke="var(--track)" />
        <text x={L - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--mut)">
          {fmtChart((mxChart * i) / 4)}
        </text>
      </g>
    );
  }

  const bars = dVals.map((v, i) => {
    const h = (H - T - B) * v / mxChart;
    const x = L + i * bw + bw * 0.15;
    const w = bw * 0.7;
    return (
      <g key={i}>
        <rect x={x} y={H - B - h} width={w} height={h} rx="3" fill="url(#chartGrad)">
          <title>
            {chartPoints[i]?.l}: {metricMode === 'ventas' ? Math.round(v) + ' ventas' : money(v)}
          </title>
        </rect>
        {(i % Math.ceil(n / 10) === 0 || i === n - 1) && (
          <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--mut)">
            {chartPoints[i]?.l}
          </text>
        )}
      </g>
    );
  });

  const chartTotal = dVals.reduce((a, b) => a + b, 0);
  const donutTotV = COM_V + MK_V;
  const donutTotF = COM_F + MK_F;
  const pieData = [
    { name: 'Comercial', facturacion: COM_F, ventas: COM_V },
    { name: 'Marketing', facturacion: MK_F, ventas: MK_V },
  ];

  const calculatedLabel = new Date(calculatedAt).toLocaleString();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard Comercial</h1>
          <div className={styles.sub}>Actualizado {calculatedLabel}</div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="day-input" className="text-xs text-muted-foreground">
              Día específico
            </Label>
            <Input
              id="day-input"
              type="date"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                if (e.target.value) {
                  setFromDate('');
                  setToDate('');
                }
              }}
              className="w-36 text-xs h-9 bg-background border-border"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from-input" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input
              id="from-input"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (e.target.value) setDay('');
              }}
              className="w-36 text-xs h-9 bg-background border-border"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to-input" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="to-input"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                if (e.target.value) setDay('');
              }}
              className="w-36 text-xs h-9 bg-background border-border"
            />
          </div>

          {!day && !fromDate && !toDate && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period-select" className="text-xs text-muted-foreground">
                Periodo
              </Label>
              <Select
                value={period}
                onValueChange={(value) => {
                  setPeriod(value as PeriodValue);
                }}
              >
                <SelectTrigger id="period-select" className="min-w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(day || fromDate || toDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDay('');
                setFromDate('');
                setToDate('');
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar fechas
            </Button>
          )}
        </div>
      </header>

      <section className={styles.kpis}>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Facturación bruta</CardDescription>
            <CardTitle className="text-2xl">{money(BRUTA)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Facturación neta</CardDescription>
            <CardTitle className="text-2xl">{money(NETA)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Ventas generales</CardDescription>
            <CardTitle className="text-2xl">{TOTAL}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Dinero por ingresar</CardDescription>
            <CardTitle className="text-2xl">{money(POR_INGRESAR)}</CardTitle>
          </CardHeader>
        </Card>
        {!isCliente && EQUIPO !== undefined && (
          <Card className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardDescription>Fact. equipo comercial</CardDescription>
              <CardTitle className="text-2xl">{money(EQUIPO)}</CardTitle>
            </CardHeader>
          </Card>
        )}
      </section>

      {goalsProgress.length > 0 ? (
        goalsProgress.map((g) => {
          const currentPct = g.target > 0 ? Math.min(g.contributedNet / g.target, 1) * 100 : 0;
          const nextStep = g.steps.find((s) => !s.isBase && g.contributedNet < s.at);
          return (
            <section key={`${g.groupId}-${g.goalId}`} className={`${styles.card} ${styles.goal}`}>
              <div className={styles.goalTop}>
                <h2>
                  {g.goalName}{' '}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({g.groupName})</span>
                </h2>
                <div className={styles.goalNote}>
                  {money(g.contributedNet)} de {money(g.target)} neta ·{' '}
                  {nextStep ? (
                    <>
                      faltan <b>{money(nextStep.at - g.contributedNet)}</b> para el siguiente escalón
                    </>
                  ) : (
                    <b>Meta cumplida</b>
                  )}
                </div>
              </div>
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: `${currentPct}%` }} />
                <div className={styles.cursor} style={{ left: `${currentPct}%` }}>
                  {Math.round(currentPct)}%
                </div>
                <TooltipProvider>
                  {g.steps.map((s, i) => {
                    const left = g.target > 0 ? (s.at / g.target) * 100 : 0;
                    const reached = g.contributedNet >= s.at;
                    return (
                      <Tooltip key={`${g.goalId}-${i}`}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={`${styles.step} ${reached ? styles.on : ''}`}
                            style={{ left: `${left}%` }}
                            aria-label={s.isBase ? 'Comisión base' : `Escalón ${i}`}
                          >
                            {s.isBase ? '0' : reached ? '✓' : i}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            <p className="font-medium">{s.isBase ? 'Inicio (comisión base)' : `Escalón ${i} · ${money(s.at)}`}</p>
                            <p>Equipo {pct(s.percentages.teamTotal)}</p>
                            <p>Closer {pct(s.percentages.closer)}</p>
                            <p>Director {pct(s.percentages.director)}</p>
                            {!s.isBase && (
                              <p className="opacity-80">
                                Δ equipo {signedPct(s.deltaTeam)} · closer {signedPct(s.deltaCloser)} · director{' '}
                                {signedPct(s.deltaDirector)}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </section>
          );
        })
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin metas configuradas</CardTitle>
            <CardDescription>
              Crea un grupo de comisión con una meta de facturación para ver el progreso aquí. Un solo escalón es la
              meta total; varios escalones se suman.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.head}>
            <h2>Evolución de ventas</h2>
            <div className={styles.seg}>
              <button type="button" aria-pressed={metricMode === 'ventas'} onClick={() => setMetricMode('ventas')}>
                Ventas
              </button>
              <button type="button" aria-pressed={metricMode === 'fact'} onClick={() => setMetricMode('fact')}>
                Facturación
              </button>
            </div>
          </div>
          <div className={styles.tot}>
            Total: {metricMode === 'ventas' ? `${Math.round(chartTotal)} ventas` : money(chartTotal)}
          </div>
          {chartPoints.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No hay ventas en este periodo.</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de evolución de ventas" className="block h-auto w-full">
              <defs>
                <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--gold)" />
                  <stop offset="1" stopColor="var(--gold2)" />
                </linearGradient>
              </defs>
              {gridLines}
              {bars}
            </svg>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.head}>
            <h2>{breakdownType === 'closer' ? 'Ranking de closers' : 'Desglose'}</h2>
            <div className={styles.seg}>
              {!isCliente && (
                <button
                  type="button"
                  aria-pressed={breakdownType === 'closer'}
                  onClick={() => setBreakdownType('closer')}
                >
                  Closer
                </button>
              )}
              <button type="button" aria-pressed={breakdownType === 'prod'} onClick={() => setBreakdownType('prod')}>
                Producto
              </button>
              <button type="button" aria-pressed={breakdownType === 'acc'} onClick={() => setBreakdownType('acc')}>
                Cuenta
              </button>
            </div>
          </div>
          {breakdownData.length === 0 ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">No hay datos en este periodo.</p>
          ) : (
            <div className={styles.rankList}>
              {breakdownData.map((item) => (
                <div key={`${item.rank}-${item.name}`} className={styles.rankRow}>
                  <Badge variant="outline" className={styles.rankBadge}>
                    #{item.rank}
                  </Badge>
                  <span className={styles.rowName} title={item.name}>
                    {item.name}
                  </span>
                  <span className={styles.rowBar}>
                    <i
                      className={styles.rowBarFill}
                      style={{ width: `${item.barPct ?? 0}%` }}
                    />
                  </span>
                  <span className={styles.rankPct}>{pct(item.sharePct ?? 0)}</span>
                  <span className={styles.rankMeta}>{item.ventas} ventas</span>
                  <span className={styles.rankMoney}>{money(item.facturacion)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '12px' }}>
        <h2>Comercial vs Marketing</h2>
        {donutTotF <= 0 && donutTotV <= 0 ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">No hay facturación para comparar.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="h-[220px] w-[220px] shrink-0 self-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="facturacion"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length] || '#000'} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => money(Number(value ?? 0))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-card/60 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm inline-block" style={{ background: 'var(--gold)' }} />
                    <span className="font-semibold text-sm">Equipo Comercial</span>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {donutTotF > 0 ? Math.round((COM_F / donutTotF) * 100) : 0}%
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Volumen</span>
                    <span className="text-sm font-bold">{COM_V}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Fact. Bruta</span>
                    <span className="text-sm font-bold font-mono">{money(COM_F)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Fact. Neta</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">{money(COM_NETA)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-card/60 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm inline-block" style={{ background: 'var(--mut)' }} />
                    <span className="font-semibold text-sm">Marketing</span>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {donutTotF > 0 ? Math.round((MK_F / donutTotF) * 100) : 0}%
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Volumen</span>
                    <span className="text-sm font-bold">{MK_V}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Fact. Bruta</span>
                    <span className="text-sm font-bold font-mono">{money(MK_F)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Fact. Neta</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">{money(MK_NETA)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
