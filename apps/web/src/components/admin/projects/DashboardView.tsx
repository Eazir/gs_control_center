import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import styles from './DashboardView.module.css';

interface DashboardViewProps {
  projectId: string;
  effectiveRole: string;
  goalsConfig?: any;
  commissionConfig?: any;
  members?: any[];
  products?: any[];
}

const money = (n: number) => '$ ' + Math.round(n).toLocaleString('en-US');

export function DashboardView({ projectId, effectiveRole, goalsConfig, commissionConfig, members, products }: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30); // 30 dias por defecto
  
  const [data, setData] = useState<any>(null);

  // Filtros internos de UI
  const [metricMode, setMetricMode] = useState<'ventas' | 'fact'>('ventas');
  const [breakdownType, setBreakdownType] = useState<'closer' | 'prod' | 'acc'>('closer');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const query = period ? `?period=${period}` : '';
        const res = await fetchWithAuth(`/kpi/project/${projectId}/dashboard${query}`);
        if (!res.ok) throw new Error('Error al cargar métricas del dashboard');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId, period]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Cargando métricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 border border-red-500 rounded-md">Error: {error}</div>
    );
  }

  if (!data) return null;

  const { kpis, salesVolumeChart, closersRanking, launchMetrics, comparatives } = data;
  
  const BRUTA = kpis.facturacionBruta || 0;
  
  // Usar la facturación neta ya calculada por el backend en base a las comisiones de closers
  const NETA = kpis.facturacionNeta || 0;
  
  const TOTAL = kpis.ventasTotales || 0;
  const POR_INGRESAR = kpis.facturacionProxima || 0;
  const MK = comparatives.teams.find((t: any) => t.name === 'Marketing')?.ventas || 0;
  const COMERCIAL = comparatives.teams.find((t: any) => t.name === 'Comercial')?.ventas || 0;
  
  const TICK = TOTAL > 0 ? BRUTA / TOTAL : 0;
  const EQUIPO = kpis.facturacionEquipo || 0;
  
  // Extraer todas las metas de los grupos de comisión
  const allGoals: Array<{ name: string; target: number; tiers: any[]; groupName: string; facturacionBrutaGrupo: number }> = [];
  
  if (commissionConfig?.groups && Array.isArray(commissionConfig.groups)) {
    commissionConfig.groups.forEach((g: any) => {
      // Calcular la facturación bruta específica de los productos de este grupo
      let facturacionGrupo = 0;
      if (g.productIds && Array.isArray(g.productIds)) {
        // Encontrar los nombres de estos productos en props.products
        const gProductNames = (products || [])
          .filter((p: any) => g.productIds.includes(p.id))
          .map((p: any) => p.name);
          
        // Sumar la facturación de esos nombres usando launchMetrics.productos
        launchMetrics.productos.forEach((lp: any) => {
          if (gProductNames.includes(lp.producto)) {
            facturacionGrupo += lp.facturacion;
          }
        });
      } else {
        // Si no hay productos marcados, asumimos toda la facturación (o 0, dependiendo de la regla. En este caso 0 si es exclusivo)
        facturacionGrupo = 0; 
      }

      if (g.goals && Array.isArray(g.goals)) {
        g.goals.forEach((goal: any) => {
          if (goal.active !== false) {
            allGoals.push({
              name: goal.name,
              target: goal.targetRevenue || 0,
              tiers: goal.tiers || [],
              groupName: g.name,
              facturacionBrutaGrupo: facturacionGrupo
            });
          }
        });
      }
    });
  }

  // Si no hay ninguna meta configurada en grupos, usamos la global legacy
  const fallbackTarget = goalsConfig?.monthlyTargetRevenue || 50000;
  
  // Preparar Breakdown
  let breakdownData: [string, number, number][] = []; // name, ventas, facturacion
  if (breakdownType === 'closer') {
    breakdownData = closersRanking.map((c: any) => {
      // Buscar el nombre real del closer usando el `members` prop
      const member = members?.find(m => m.userId === c.id || m.id === c.id);
      const name = member?.userName || member?.userEmail || c.closer || 'Sin asignar';
      return [name, c.ventas, c.facturacion];
    });
  } else if (breakdownType === 'prod') {
    const prodMap = new Map<string, { ventas: number, facturacion: number }>();
    
    // Inicializar con todos los productos del proyecto en 0
    if (products && products.length > 0) {
      products.forEach(p => prodMap.set(p.name, { ventas: 0, facturacion: 0 }));
    }
    
    // Rellenar con los datos reales del backend
    launchMetrics.productos.forEach((p: any) => {
      prodMap.set(p.producto, { ventas: p.ventas, facturacion: p.facturacion });
    });
    
    breakdownData = Array.from(prodMap.entries()).map(([name, d]) => [name, d.ventas, d.facturacion]);
    breakdownData.sort((a, b) => (b[2] as number) - (a[2] as number));
  } else if (breakdownType === 'acc') {
    breakdownData = comparatives.sources.map((s: any) => [s.name, s.value, s.value * TICK]); // Aproximado
  }
  
  const breakdownMax = breakdownData.length ? Math.max(...breakdownData.map(x => x[1] as number)) : 1;

  // Preparar Chart
  const chartPoints = salesVolumeChart.map((point: any) => ({
    l: point.date.split('-').slice(1).join('/'),
    v: metricMode === 'ventas' ? point.ventas : point.facturacion
  }));
  
  const dVals = chartPoints.map((p: any) => p.v);
  const maxVal = dVals.length > 0 ? Math.max(...dVals) : 0;
  const mxChart = maxVal * 1.15 || 1;
  const W = 620, H = 250, L = 48, B = 28, T = 14, n = dVals.length, bw = n > 0 ? (W - L - 10) / n : 0;
  const fmtChart = (v: number) => metricMode === 'ventas' ? Math.round(v) : (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v));
  
  // Grid Lines
  const gridLines = [];
  for(let i=0; i<=4; i++) {
    const y = T + (H - T - B) * (1 - i / 4);
    gridLines.push(
      <g key={i}>
        <line x1={L} x2={W-6} y1={y} y2={y} stroke="var(--track)" />
        <text x={L-8} y={y+4} textAnchor="end" fontSize="11" fill="var(--mut)">{fmtChart(mxChart * i / 4)}</text>
      </g>
    );
  }

  // Bars
  const bars = dVals.map((v: number, i: number) => {
    const h = (H - T - B) * v / mxChart;
    const x = L + i * bw + bw * 0.15;
    const w = bw * 0.7;
    return (
      <g key={i}>
        <rect x={x} y={H - B - h} width={w} height={h} rx="3" fill="url(#chartGrad)">
          <title>{chartPoints[i].l}: {metricMode === 'ventas' ? Math.round(v) + ' ventas' : money(v)}</title>
        </rect>
        {(i % Math.ceil(n/10) === 0 || i === n-1) && (
           <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--mut)">{chartPoints[i].l}</text>
        )}
      </g>
    );
  });
  
  const chartTotal = dVals.reduce((a: number, b: number) => a + b, 0);

  // Donut
  const donutTot = COMERCIAL + MK;
  const donutR = 70;
  const donutC = 2 * Math.PI * donutR;
  const donutA = donutTot > 0 ? (donutC * COMERCIAL / donutTot) : 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard Comercial</h1>
          <div className={styles.sub}>Datos en tiempo real para decisiones más grandes</div>
        </div>
        <div className={styles.filters}>
          <label className={styles.label}>
            Periodo
            <select className={styles.input} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={0}>Todo el tiempo</option>
            </select>
          </label>
        </div>
      </header>

      <section className={styles.kpis}>
        <div className={`${styles.card} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>Facturación bruta</div>
          <div className={styles.kpiValue}>{money(BRUTA)}</div>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>Facturación neta</div>
          <div className={styles.kpiValue}>{money(NETA)}</div>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>Ventas generales</div>
          <div className={styles.kpiValue}>{TOTAL}</div>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>Dinero por ingresar</div>
          <div className={styles.kpiValue}>{money(POR_INGRESAR)}</div>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>Fact. Equipo Comercial</div>
          <div className={styles.kpiValue}>{money(EQUIPO)}</div>
        </div>
      </section>

      {allGoals.length > 0 ? (
        allGoals.map((g, idx) => {
          let steps = [g.target * 0.25, g.target * 0.5, g.target * 0.75, g.target];
          if (g.tiers.length > 0) {
            const tiersSteps = g.tiers.map(t => t.revenueThreshold).filter(s => s > 0);
            if (tiersSteps.length > 0) {
              steps = (Array.from(new Set(tiersSteps)) as number[]).sort((a, b) => a - b);
            }
          }
          const currentPct = g.target > 0 ? Math.min(g.facturacionBrutaGrupo / g.target, 1) * 100 : 0;
          const nextStep = steps.find(s => g.facturacionBrutaGrupo < s);

          return (
            <section key={idx} className={`${styles.card} ${styles.goal}`} style={{ marginTop: '12px' }}>
              <div className={styles.goalTop}>
                <h2>{g.name} <span style={{ fontSize: '12px', color: 'var(--mut)', fontWeight: 'normal', marginLeft: '8px' }}>({g.groupName})</span></h2>
                <div className={styles.goalNote}>
                  {money(g.facturacionBrutaGrupo)} de {money(g.target)} · {nextStep ? <>faltan <b>{money(nextStep - g.facturacionBrutaGrupo)}</b> para el escalón {steps.indexOf(nextStep)+1}</> : <b>Meta cumplida</b>}
                </div>
              </div>
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: `${currentPct}%` }}></div>
                <div className={styles.cursor} style={{ left: `${currentPct}%` }}>{Math.round(currentPct)}%</div>
                {steps.map((s, i) => (
                  <div key={i} className={`${styles.step} ${g.facturacionBrutaGrupo >= s ? styles.on : ''}`} style={{ left: `${g.target > 0 ? (s/g.target)*100 : 0}%` }}>
                    {g.facturacionBrutaGrupo >= s ? '✓' : i + 1}
                    <span>{money(s)}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <section className={`${styles.card} ${styles.goal}`} style={{ marginTop: '12px' }}>
          <div className={styles.goalTop}>
            <h2>Progreso de meta global</h2>
            <div className={styles.goalNote}>
              {money(BRUTA)} de {money(fallbackTarget)} · <b>Sin metas en grupos</b>
            </div>
          </div>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${fallbackTarget > 0 ? Math.min(BRUTA / fallbackTarget, 1) * 100 : 0}%` }}></div>
            <div className={styles.cursor} style={{ left: `${fallbackTarget > 0 ? Math.min(BRUTA / fallbackTarget, 1) * 100 : 0}%` }}>{Math.round(fallbackTarget > 0 ? Math.min(BRUTA / fallbackTarget, 1) * 100 : 0)}%</div>
          </div>
        </section>
      )}

      <section className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.head}>
            <h2>Evolución de ventas</h2>
            <div className={styles.tools}>
              <div className={styles.seg}>
                <button aria-pressed={metricMode === 'ventas'} onClick={() => setMetricMode('ventas')}>Ventas</button>
                <button aria-pressed={metricMode === 'fact'} onClick={() => setMetricMode('fact')}>Facturación</button>
              </div>
            </div>
          </div>
          <div className={styles.tot}>Total: {metricMode === 'ventas' ? `${Math.round(chartTotal)} ventas` : money(chartTotal)}</div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de evolución de ventas" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--gold)" />
                <stop offset="1" stopColor="var(--gold2)" />
              </linearGradient>
            </defs>
            {gridLines}
            {bars}
          </svg>
        </div>

        <div className={styles.card}>
          <div className={styles.head}>
            <h2>Desglose</h2>
            <div className={styles.seg}>
              <button aria-pressed={breakdownType === 'closer'} onClick={() => setBreakdownType('closer')}>Closer</button>
              <button aria-pressed={breakdownType === 'prod'} onClick={() => setBreakdownType('prod')}>Producto</button>
              <button aria-pressed={breakdownType === 'acc'} onClick={() => setBreakdownType('acc')}>Cuenta</button>
            </div>
          </div>
          <div>
            {breakdownData.map((item, idx) => (
              <div key={idx} className={styles.row}>
                <span className={styles.rowName} title={item[0]}>{item[0]}</span>
                <span className={styles.rowBar}>
                  <i className={styles.rowBarFill} style={{ width: `${breakdownMax > 0 ? (item[1] / breakdownMax) * 100 : 0}%` }}></i>
                </span>
                <span className={styles.rowValue}>{Math.round(item[1])} · {money(item[2] || (item[1] * TICK))}</span>
              </div>
            ))}
            {breakdownData.length === 0 && <div className="text-sm text-muted-foreground mt-4 text-center">No hay datos</div>}
          </div>
        </div>
      </section>

      <section className={styles.card} style={{ marginTop: '12px' }}>
        <h2>Marketing vs Comercial</h2>
        <div className={styles.tot}>Origen de las ventas en la plataforma</div>
        <div className={styles.donut}>
          <svg viewBox="0 0 200 200" role="img" aria-label="Ventas de marketing frente a comercial">
            <circle cx="100" cy="100" r={donutR} fill="none" stroke="var(--mut)" strokeWidth="28" opacity=".55" />
            <circle cx="100" cy="100" r={donutR} fill="none" stroke="var(--gold)" strokeWidth="28" strokeDasharray={`${donutA} ${donutC - donutA}`} transform="rotate(-90 100 100)" />
            <text x="100" y="98" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--tx)">{donutTot}</text>
            <text x="100" y="118" textAnchor="middle" fontSize="12" fill="var(--mut)">ventas totales</text>
          </svg>
          <div className={styles.donutLegend}>
            <div className={styles.lg}>
               <i style={{ background: 'var(--gold)' }}></i>
               <span>Comercial</span>
               <b>{COMERCIAL} ventas</b>
               <em>{donutTot > 0 ? Math.round((COMERCIAL / donutTot) * 100) : 0}%</em>
            </div>
            <div className={styles.lg}>
               <i style={{ background: 'var(--mut)' }}></i>
               <span>Marketing</span>
               <b>{MK} ventas</b>
               <em>{donutTot > 0 ? Math.round((MK / donutTot) * 100) : 0}%</em>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
