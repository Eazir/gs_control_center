'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function CloserCommissionsPage() {
  return (
    <UnderConstructionView
      title="Mis Comisiones Ganadas"
      description="Balance financiero en tiempo real, desglose de porcentajes según cumplimiento de meta y fechas estimadas de liquidación."
      category="Espacio Operativo del Closer"
      expectedPhase="Fase 5 — Comisiones"
      roleBadge="CLOSER"
      features={[
        'Simulador interactivo de comisiones según volumen de facturación proyectado',
        'Visualización del escalón (tier) de comisión alcanzado en el mes',
        'Registro de liquidaciones pagadas y saldos acumulados pendientes',
      ]}
    />
  );
}
