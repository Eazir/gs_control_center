'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function AiTelegramPage() {
  return (
    <UnderConstructionView
      title="Centro de IA & Telegram"
      description="Configuración de LLMs (Claude API / Anthropic, OpenAI) y orquestación de bots de Telegram para alertas de cierre y reportes ejecutivos."
      category="Fase 6 — Inteligencia Artificial & Bot"
      expectedPhase="Fase 6"
      roleBadge="SUPER_ADMIN / ADMIN"
      features={[
        'Notificaciones en tiempo real al equipo ante pagos procesados y abandonos',
        'Consultas en lenguaje natural sobre KPIs de facturación y ranking de closers',
        'Gestión segura de API keys y webhooks del bot de Telegram',
      ]}
    />
  );
}
