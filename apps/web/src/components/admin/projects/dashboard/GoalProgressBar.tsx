import React from 'react';
import { Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface GoalProgressBarProps {
  currentVentas: number;
  goalVentas: number;
}

export function GoalProgressBar({ currentVentas, goalVentas }: GoalProgressBarProps) {
  const percentage = goalVentas > 0 ? Math.min(Math.round((currentVentas / goalVentas) * 100), 100) : 0;
  
  if (goalVentas === 0) return null; // No mostrar si no hay meta

  return (
    <div className="col-span-full mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Progreso de Meta del Equipo Comercial</h3>
        </div>
        <div className="text-sm font-medium">
          {currentVentas} / {goalVentas} Ventas ({percentage}%)
        </div>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
