'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Hammer,
  Sparkles,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';
import { AdminShell } from './admin-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface UnderConstructionViewProps {
  title: string;
  description: string;
  category?: string;
  expectedPhase?: string;
  roleBadge?: string;
  features?: string[];
}

export function UnderConstructionView({
  title,
  description,
  category = 'Módulo en Desarrollo',
  expectedPhase = 'Próxima Fase',
  roleBadge,
  features = [
    'Conexión en tiempo real con API y base de datos',
    'Seguridad y control de acceso estricto por rol',
    'Automatizaciones y sincronización en segundo plano',
  ],
}: UnderConstructionViewProps) {
  return (
    <AdminShell title={title}>
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        {/* Cabecera de Módulo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="gold" className="text-[10px] font-bold">
                <Hammer size={11} className="mr-1 animate-pulse" />
                {category}
              </Badge>
              {roleBadge && (
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground font-mono">
                  {roleBadge}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/90 font-mono">
                <Clock size={10} className="mr-1" />
                {expectedPhase}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {description}
            </p>
          </div>

          <div>
            <Button asChild variant="outline" size="sm" className="h-9 text-xs border-border">
              <Link href="/dashboard">
                <ArrowLeft size={14} className="mr-2" />
                Volver al Centro de Mando
              </Link>
            </Button>
          </div>
        </div>

        {/* Panel Principal con Imagen & Gráficos HUD */}
        <div className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-2xl">
          <div className="relative aspect-[16/9] w-full max-h-[420px] overflow-hidden bg-[#0A0D14]">
            {/* Imagen de Construcción */}
            <Image
              src="/assets/under-construction.jpg"
              alt="Módulo en construcción GrowthSell"
              fill
              className="object-cover object-center opacity-70 hover:opacity-85 transition-opacity duration-700"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1118] via-[#0E1118]/60 to-transparent" />

            {/* HUD flotante superpuesto */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold backdrop-blur-md">
                  <Sparkles size={12} />
                  <span>Arquitectura de Alta Concurrencia en Preparación</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">
                  {title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 max-w-xl line-clamp-2">
                  Estamos integrando las especificaciones canónicas de este módulo con validación Zod y aislamiento por rol.
                </p>
              </div>

              <div className="flex-shrink-0 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-right">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Estado del Módulo</span>
                <span className="text-xs font-mono font-bold text-primary flex items-center justify-end gap-1.5 mt-0.5">
                  <Cpu size={13} className="text-primary animate-spin" />
                  EN DESARROLLO ACTIVO
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de características planificadas */}
          <div className="p-6 bg-card border-t border-border/60">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Layers size={16} className="text-primary" />
              Capacidades planificadas para este módulo:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {features.map((feat, idx) => (
                <Card key={idx} className="p-3.5 bg-background/60 border-border/80 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-foreground/90 leading-snug">{feat}</span>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
