'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Kanban,
  RotateCw,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/admin-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchWithAuth } from '@/lib/api-client';

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  productsCount?: number;
  membersCount?: number;
}

export default function ClienteProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMyProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth('/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // Ignorar error de carga
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyProjects();
  }, []);

  return (
    <AdminShell title="Métricas de Mis Proyectos">
      <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-2">
              <Sparkles size={12} />
              Portal Ejecutivo
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Métricas de Mis Proyectos
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Selecciona uno de tus proyectos para ver los indicadores comerciales, facturación y conversiones.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadMyProjects}
            disabled={isLoading}
            className="h-9 text-xs border-border"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin mr-1.5' : 'mr-1.5'} />
            Refrescar
          </Button>
        </div>

        {/* Grid de Proyectos del Cliente */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-card/40 animate-pulse border border-border/40" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="bg-card/40 border-border p-8 text-center max-w-md mx-auto my-12">
            <BarChart3 size={36} className="mx-auto text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-base font-bold text-foreground">Sin Proyectos Asignados</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Aún no tienes proyectos asignados. El Administrador te dará acceso pronto.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => (
              <Card key={proj.id} className="bg-card/50 border-border/60 hover:bg-card/80 hover:border-primary/50 transition-all duration-300 group overflow-hidden relative shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-all duration-500 group-hover:bg-primary/20" />
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                      ACTIVO
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                    {proj.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 line-clamp-2 min-h-[32px]">
                    {proj.description || 'Proyecto de lanzamiento activo'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  <Button asChild variant="gold" className="w-full h-9 text-xs font-bold group-hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all">
                    <Link href={`/admin/projects/${proj.id}`}>
                      Ver Métricas <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
