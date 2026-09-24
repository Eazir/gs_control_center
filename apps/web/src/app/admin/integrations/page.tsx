'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function IntegrationsPage() {
  return (
    <UnderConstructionView
      title="Integraciones & Webhooks"
      description="Conexión en tiempo real con pasarelas de pago y CRMs de infoproductos: Hotmart, Centralize CRM y GoHighLevel."
      category="Fase 4 — Webhooks & Ingesta"
      expectedPhase="Fase 4"
      roleBadge="SUPER_ADMIN / ADMIN"
      features={[
        'Recepción asíncrona en <100ms con encolado directo en BullMQ',
        'Cifrado AES-256-GCM para tokens y credenciales de plataformas externas',
        'Idempotencia estricta por hash y reconciliación de carritos abandonados',
      ]}
    />
  );
}
