'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function AnalyticsPage() {
  return (
    <UnderConstructionView
      title="Métricas & Dashboards de Ventas"
      description="Visualización ejecutiva de facturación bruta y neta, ranking de closers, tasas de conversión y cumplimiento de metas por proyecto."
      category="Fase 5 — Métricas & KPIs"
      expectedPhase="Fase 5"
      roleBadge="SUPER_ADMIN / ADMIN"
      features={[
        'Vistas materializadas en PostgreSQL refrescadas periódicamente por BullMQ',
        'Cálculo automatizado de comisiones escalonadas por metas cumplidas',
        'Filtros por unidad comercial, fechas y canales de prospección',
      ]}
    />
  );
}
