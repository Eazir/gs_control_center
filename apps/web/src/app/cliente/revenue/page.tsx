'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function ClienteRevenuePage() {
  return (
    <UnderConstructionView
      title="Facturación & Rendimiento de Ventas"
      description="Dashboard de solo lectura con las métricas consolidadas de facturación bruta, neta, ticket promedio y devoluciones de tu proyecto."
      category="Portal Ejecutivo del Cliente"
      expectedPhase="Fase 5 — Dashboards de Clientes"
      roleBadge="CLIENTE"
      features={[
        'Gráficas de evolución de ventas diarias, semanales y mensuales',
        'Detalle de ingresos por tipo de infoproducto y moneda de cobro',
        'Aislamiento estricto: sin acceso a datos personales de leads de closers',
      ]}
    />
  );
}
