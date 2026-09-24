'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function ClienteProductsPage() {
  return (
    <UnderConstructionView
      title="Catálogo de Infoproductos en Operación"
      description="Consulta los cursos, membresías o mentorías configurados en tu proyecto, tickets de venta actuales y ofertas activas."
      category="Portal Ejecutivo del Cliente"
      expectedPhase="Fase 2 & 5"
      roleBadge="CLIENTE"
      features={[
        'Listado de infoproductos activos con precios vigentes y SKU',
        'Visualización de enlaces de checkout y páginas de venta',
        'Histórico de productos lanzados con la unidad comercial',
      ]}
    />
  );
}
