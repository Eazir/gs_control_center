'use client';

import React from 'react';
import { UnderConstructionView } from '@/components/layout/under-construction';

export default function DirectorAiPage() {
  return (
    <UnderConstructionView
      title="Asistente Comercial con IA"
      description="Herramientas cognitivas para análisis de llamadas, objeciones comunes y recomendaciones tácticas de cierre para tu equipo."
      category="Módulo de Inteligencia Artificial"
      expectedPhase="Fase 6 — IA & Telegram"
      roleBadge="DIRECTOR COMERCIAL"
      features={[
        'Detección automática de patrones de objeción en transcripciones',
        'Sugerencias de scripts de respuesta personalizada para el equipo',
        'Alertas inteligentes sobre oportunidades con alto riesgo de enfriamiento',
      ]}
    />
  );
}
