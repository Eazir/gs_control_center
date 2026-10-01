import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip, Legend as PieLegend, BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, Legend as BarLegend, CartesianGrid } from 'recharts';
import { PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

interface ComparativesProps {
  sources: { name: string; value: number }[];
  teams: { name: string; ventas: number }[];
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#6366f1'];
const TEAM_COLORS = ['#ec4899', '#8b5cf6'];

export function Comparatives({ sources, teams }: ComparativesProps) {
  const totalSources = sources.reduce((acc, curr) => acc + curr.value, 0);

  // Pre-calcular porcentajes para el gráfico de barras
  const totalTeams = teams.reduce((acc, curr) => acc + curr.ventas, 0);
  const teamsData = teams.map(t => ({
    name: t.name,
    Ventas: t.ventas,
    Porcentaje: totalTeams > 0 ? Math.round((t.ventas / totalTeams) * 100) : 0
  }));

  return (
    <Card className="col-span-full xl:col-span-2 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          Desgloses y Comparativas
        </CardTitle>
        <CardDescription>Origen de las ventas</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col md:flex-row gap-6">
        
        {/* Dona: Ventas vs Cuentas Externas */}
        <div className="flex-1 flex flex-col items-center">
          <h4 className="text-sm font-medium text-muted-foreground mb-2 text-center w-full">Ventas por Plataforma</h4>
          <div className="relative h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sources}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {sources.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] || '#000'} />
                  ))}
                </Pie>
                <PieTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${value} Ventas`, '']}
                />
                <PieLegend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-3xl font-bold">{totalSources}</span>
              <span className="text-xs text-muted-foreground">Ventas</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block w-px bg-border/50 self-stretch my-2"></div>

        {/* Barras: Marketing vs Comercial */}
        <div className="flex-1 flex flex-col items-center">
          <h4 className="text-sm font-medium text-muted-foreground mb-2 text-center w-full">Marketing vs Comercial</h4>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <BarTooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => {
                    if (name === 'Porcentaje') return [`${value}%`, name];
                    return [value, name];
                  }}
                />
                <BarLegend verticalAlign="bottom" height={36} iconType="circle" />
                <Bar dataKey="Ventas" fill={TEAM_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Porcentaje" fill={TEAM_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
