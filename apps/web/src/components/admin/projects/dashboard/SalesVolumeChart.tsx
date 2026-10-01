import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SalesVolumeChartProps {
  data: { date: string; ventas: number }[];
  period: string;
  onPeriodChange: (period: string) => void;
}

export function SalesVolumeChart({ data, period, onPeriodChange }: SalesVolumeChartProps) {
  return (
    <Card className="col-span-full xl:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle>Volumen de Ventas</CardTitle>
          <CardDescription>
            Evolución de las ventas confirmadas en el tiempo
          </CardDescription>
        </div>
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="15d">Últimos 15 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="all">Total del proyecto</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(val) => {
                  if (!val) return '';
                  const d = new Date(val);
                  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                }}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                tick={{ fill: '#6b7280', fontSize: 12 }} 
              />
              <Tooltip 
                cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '5 5' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelFormatter={(val) => {
                  const d = new Date(val as string);
                  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                }}
              />
              <Line 
                type="monotone" 
                dataKey="ventas" 
                name="Ventas"
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                activeDot={{ r: 6, strokeWidth: 0 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
