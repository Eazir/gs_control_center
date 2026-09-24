'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function ClienteReportsPage() {
  return (
    <UnderConstructionView
      title="Reportes Ejecutivos de Rendimiento"
      description="Informes periódicos consolidados sobre efectividad de la unidad comercial de closers, metas alcanzadas y análisis de conversión."
      category="Portal Ejecutivo del Cliente"
      expectedPhase="Fase 5 — Reportes Ejecutivos"
      roleBadge="CLIENTE"
      features={[
        'Exportación periódica en formato PDF y Excel con resúmenes ejecutivos',
        'Comparativas de facturación respecto a metas mensuales configuradas',
        'Visión macro del embudo sin exponer datos sensibles de contacto',
      ]}
    />
  );
}
