'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function AuditPage() {
  return (
    <UnderConstructionView
      title="Auditoría & Seguridad RLS"
      description="Registro inmutable de trazabilidad de cambios, historial de modificaciones en celdas de pipeline y monitoreo de sesiones de usuario."
      category="Fase 7 — Auditoría & Producción"
      expectedPhase="Fase 7"
      roleBadge="EXCLUSIVO SUPER_ADMIN"
      features={[
        'Línea de tiempo detallada de accesos, inicios de sesión y modificaciones de registros',
        'Validación de políticas PostgreSQL Row Level Security (RLS) activas',
        'Exportación de reportes de cumplimiento y seguridad para operaciones comerciales',
      ]}
    />
  );
}
