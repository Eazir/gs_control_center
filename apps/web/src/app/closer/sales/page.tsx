'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function CloserSalesPage() {
  return (
    <UnderConstructionView
      title="Mis Ventas & Cierres"
      description="Historial detallado de contratos cerrados, links de pago emitidos y comprobantes de transacción validados."
      category="Espacio Operativo del Closer"
      expectedPhase="Fase 4 & 5"
      roleBadge="CLOSER"
      features={[
        'Registro de ventas en vivo con conciliación automática de pasarelas',
        'Detalle de tickets, montos netos y comprador asociado',
        'Historial inmutable de comisiones generadas por venta',
      ]}
    />
  );
}
