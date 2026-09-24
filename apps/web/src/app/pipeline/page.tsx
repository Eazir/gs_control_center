'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function PipelinePage() {
  return (
    <UnderConstructionView
      title="Pipeline Comercial (Kanban & Tabla)"
      description="Espacio dinámico de gestión de leads, columnas de arrastre estilo hoja de cálculo, concurrencia optimista y filtros masivos."
      category="Fase 3 — En Construcción Inmediata"
      expectedPhase="Objetivo 3.1 a 3.5"
      features={[
        'Tablero Kanban con drag-and-drop y concurrencia optimista (row_version)',
        'Vista de hoja de cálculo virtualizada con edición rápida por celda',
        'Aislamiento estricto: cada Closer solo visualiza sus leads asignados',
      ]}
    />
  );
}
