'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function CloserSchedulePage() {
  return (
    <UnderConstructionView
      title="Mi Agenda & Llamadas del Día"
      description="Calendario de sesiones de venta agendadas, reprogramaciones, notas de preparación previa y enlaces de videollamada."
      category="Espacio Operativo del Closer"
      expectedPhase="Fase 3 & 4"
      roleBadge="CLOSER"
      features={[
        'Sincronización con calendarios externos (Google Calendar / Cal.com)',
        'Checklist previo de cualificación antes de cada llamada',
        'Registro ágil de resultado inmediatamente al colgar la llamada',
      ]}
    />
  );
}
