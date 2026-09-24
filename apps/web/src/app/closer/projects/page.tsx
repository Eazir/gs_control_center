'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
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

export default function CloserProjectsPage() {
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
    <AdminShell title="Proyectos de los que Hago Parte">
      <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-2">
              <Sparkles size={12} />
              Fuerza de Ventas
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Proyectos de los que Haces Parte
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Selecciona uno de tus proyectos asignados para acceder a tu Pipeline personal de leads y registro de cierres.
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

        {/* Grid de Proyectos del Closer */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-card/40 animate-pulse border border-border/40" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="bg-card/40 border-border p-8 text-center max-w-md mx-auto my-12">
            <FolderKanban size={36} className="mx-auto text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-base font-bold text-foreground">Sin Proyectos Asignados</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Aún no has sido incorporado a un proyecto activo. Tu Director Comercial o Administrador te asignará en breve.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => (
              <Card
                key={proj.id}
                className="bg-card border-border hover:border-primary/50 transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="gold" className="text-[10px] font-bold">
                      {proj.status}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">/{proj.slug}</span>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground">
                    {proj.name}
                  </CardTitle>
                  {proj.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {proj.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-2 border-t border-border/50">
                  <div className="pt-2 flex items-center gap-2">
                    <Button asChild variant="gold" className="w-full text-xs font-bold h-9 justify-between">
                      <Link href={`/admin/projects/${proj.id}`}>
                        <span className="flex items-center gap-1.5">
                          <Kanban size={13} /> Ver Proyecto & Pipeline
                        </span>
                        <ArrowRight size={14} />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
