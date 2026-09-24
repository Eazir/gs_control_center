'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function DirectorAnalyticsPage() {
  return (
    <UnderConstructionView
      title="Dashboard de Métricas de Ventas (Proyectos Asignados)"
      description="Visualización ejecutiva de facturación acumulada, ticket promedio, cumplimiento de metas mensuales y ranking de closers de todos los proyectos bajo tu dirección."
      category="Módulo de Dirección Comercial"
      expectedPhase="Fase 5 — Métricas & Dashboards"
      roleBadge="DIRECTOR COMERCIAL"
      features={[
        'Resumen consolidado de facturación de todos los proyectos a tu cargo',
        'Opción de consultar el dashboard individual y detallado de cada proyecto',
        'Monitoreo del ranking de rendimiento y efectividad de conversión por closer',
      ]}
    />
  );
}
