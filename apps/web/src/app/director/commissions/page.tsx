'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function DirectorCommissionsPage() {
  return (
    <UnderConstructionView
      title="Metas & Comisiones del Proyecto"
      description="Supervisión de cumplimiento de facturación mensual, escalones de comisión alcanzados y aprobación de liquidaciones."
      category="Módulo de Dirección Comercial"
      expectedPhase="Fase 5 — Métricas & Comisiones"
      roleBadge="DIRECTOR COMERCIAL"
      features={[
        'Cálculo automático de comisiones según escalones (tiers) del proyecto',
        'Validación de facturación neta vs. metas comerciales pactadas',
        'Generación de reportes de liquidación para pagos a closers',
      ]}
    />
  );
}
