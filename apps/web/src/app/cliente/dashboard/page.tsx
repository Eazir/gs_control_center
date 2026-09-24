'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function ClienteDashboardPage() {
  return (
    <UnderConstructionView
      title="Dashboard de Mi Proyecto"
      description="Portal ejecutivo de solo lectura con las métricas comerciales consolidadas de facturación, tasa de conversión y ventas cerradas de tu infoproducto."
      category="Portal Ejecutivo del Cliente"
      expectedPhase="Fase 5 — Dashboards de Clientes"
      roleBadge="CLIENTE (DUEÑO DEL PROYECTO)"
      features={[
        'Acceso exclusivo y directo al dashboard consolidado de tu proyecto',
        'Visualización de facturación acumulada bruta y neta con ticket promedio',
        'Blindaje de privacidad: cero exposición de datos personales de leads operativos',
      ]}
    />
  );
}
