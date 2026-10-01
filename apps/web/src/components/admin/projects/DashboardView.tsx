import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api-client';
import { DollarSign, Percent, TrendingUp, Package, Loader2 } from 'lucide-react';
import { KpiCard } from './dashboard/KpiCard';
import { SalesVolumeChart } from './dashboard/SalesVolumeChart';
import { ClosersRanking } from './dashboard/ClosersRanking';
import { LaunchMetrics } from './dashboard/LaunchMetrics';
import { Comparatives } from './dashboard/Comparatives';
import { GoalProgressBar } from './dashboard/GoalProgressBar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DashboardViewProps {
  projectId: string;
  effectiveRole: string;
}

export function DashboardView({ projectId, effectiveRole }: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const query = period !== 'all' ? `?period=${period}` : '';
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
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { kpis, salesVolumeChart, closersRanking, launchMetrics, comparatives } = data;
  const comercialVentas = comparatives.teams.find((t: any) => t.name === 'Comercial')?.ventas || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Meta Comercial (Hardcodeada por ahora, debería venir del config del proyecto) */}
      <GoalProgressBar currentVentas={comercialVentas} goalVentas={0} />

      {/* Fila Superior: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Facturación Bruta" 
          value={`$${kpis.facturacionBruta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          className="bg-gradient-to-br from-background to-background"
        />
        <KpiCard 
          title="Facturación Próxima" 
          value={`$${kpis.facturacionProxima.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          description="Cuotas pendientes por cobrar"
        />
        {effectiveRole !== 'CLIENTE' && (
          <KpiCard 
            title="Facturación Neta" 
            value={`$${kpis.facturacionNeta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={Percent}
            description="Después de costos"
          />
        )}
        <KpiCard 
          title="Ventas del Proyecto" 
          value={kpis.ventasTotales}
          icon={Package}
        />
      </div>

      {/* Fila Intermedia: Gráfico de Líneas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SalesVolumeChart 
          data={salesVolumeChart} 
          period={period} 
          onPeriodChange={setPeriod} 
        />
      </div>

      {/* Filas Inferiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <ClosersRanking data={closersRanking} />
        <LaunchMetrics 
          totalFacturado={launchMetrics.totalFacturado} 
          totalVentas={launchMetrics.totalVentas} 
          productos={launchMetrics.productos} 
        />
        <Comparatives sources={comparatives.sources} teams={comparatives.teams} />
      </div>

    </div>
  );
}
