'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderKanban,
  Radio,
  BarChart3,
  Bot,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Database,
  ExternalLink,
  Kanban,
  DollarSign,
  Calendar,
  Package,
  Sparkles,
  Target,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/admin-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api-client';
import { useProjectContext } from '@/contexts/project-context';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  href: string;
  active: boolean;
  badgeText: string;
  badgeVariant?: 'default' | 'success' | 'destructive' | 'warning' | 'gold' | 'outline';
  statLabel: string;
  statValue: React.ReactNode;
  actionLabel: string;
}

interface DashboardStats {
  userCount: number;
  activeCount: number;
  invitedCount: number;
  projectCount: number;
}

export default function DashboardPage() {
  const { activeProject } = useProjectContext();
  const [stats, setStats] = useState<DashboardStats>({
    userCount: 0,
    activeCount: 0,
    invitedCount: 0,
    projectCount: 0,
  });
  const [activeUser, setActiveUser] = useState<{
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [meRes, usersRes, projectsRes] = await Promise.all([
          fetchWithAuth('/auth/me').catch(() => null),
          fetchWithAuth('/auth/users').catch(() => null),
          fetchWithAuth('/projects').catch(() => null),
        ]);

        if (meRes && meRes.ok) {
          const meData = await meRes.json();
          setActiveUser(meData);
        }

        let userCount = 0;
        let activeCount = 0;
        let invitedCount = 0;
        let projectCount = 0;

        if (usersRes && usersRes.ok) {
          const userData = await usersRes.json();
          userCount = userData.metrics?.total || userData.users?.length || 0;
          activeCount = userData.metrics?.active || 0;
          invitedCount = userData.metrics?.invited || 0;
        }

        if (projectsRes && projectsRes.ok) {
          const projectData = await projectsRes.json();
          projectCount = projectData.stats?.total ?? projectData.projects?.length ?? 0;
        }

        setStats({
          userCount,
          activeCount,
          invitedCount,
          projectCount,
        });
      } catch {
        // Conservar defaults en caso de fallo de red
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const role = activeUser?.role || 'SUPER_ADMIN';

  // -------------------------------------------------------------
  // TARJETAS PARA SUPER ADMIN Y ADMIN
  // -------------------------------------------------------------
  const superAdminCards: FeatureCard[] = [
    {
      id: 'users',
      title: 'Gestión de Usuarios',
      description:
        'Control y administración de todos los usuarios de la plataforma, asignación de roles jerárquicos y emisión de invitaciones seguras con tokens criptográficos.',
      icon: Users,
      href: '/admin/users',
      active: true,
      badgeText: 'Operativo',
      badgeVariant: 'success' as const,
      statLabel: 'Usuarios registrados',
      statValue: isLoading ? <Skeleton className="h-4 w-12 bg-muted/60 inline-block" /> : `${stats.userCount}`,
      actionLabel: 'Gestionar Usuarios',
    },
    {
      id: 'projects',
      title: 'Administración de Proyectos',
      description:
        'Administración y control total de los proyectos de la plataforma: infoproductos, asignación de directores y closers, pipelines dinámicos y catálogo comercial.',
      icon: FolderKanban,
      href: '/admin/projects',
      active: true,
      badgeText: 'Operativo',
      badgeVariant: 'success' as const,
      statLabel: 'Proyectos configurados',
      statValue: isLoading ? (
        <Skeleton className="h-4 w-20 bg-muted/60 inline-block" />
      ) : (
        `${stats.projectCount} ${stats.projectCount === 1 ? 'Proyecto' : 'Proyectos'}`
      ),
      actionLabel: 'Gestionar Proyectos',
    },
    {
      id: 'integraciones',
      title: 'Integraciones y Webhooks',
      description:
        'Conexión en tiempo real con pasarelas de pago y CRMs: Hotmart, Centralize CRM y GoHighLevel. Registro de eventos de venta e idempotencia estricta.',
      icon: Radio,
      href: '/admin/integrations',
      active: true,
      badgeText: 'Fase 4',
      badgeVariant: 'default' as const,
      statLabel: 'Conectores externos',
      statValue: '3 Plataformas',
      actionLabel: 'Configurar Webhooks',
    },
    {
      id: 'analytics',
      title: 'Dashboard de Métricas de Ventas',
      description:
        'Métricas globales de facturación bruta y neta, ticket promedio y ranking de closers de todos los proyectos con opción de ver el dashboard individual de cada uno.',
      icon: BarChart3,
      href: '/admin/analytics',
      active: true,
      badgeText: 'Fase 5',
      badgeVariant: 'default' as const,
      statLabel: 'Facturación monitoreada',
      statValue: 'En vivo',
      actionLabel: 'Ver Métricas de Ventas',
    },
    {
      id: 'ai-telegram',
      title: 'Centro de IA y Telegram',
      description:
        'Gestión centralizada de API keys de distintas IAs (Claude API, OpenAI) y configuración de códigos/tokens para bots de alertas comerciales en Telegram.',
      icon: Bot,
      href: '/admin/ai-telegram',
      active: true,
      badgeText: 'Fase 6',
      badgeVariant: 'default' as const,
      statLabel: 'Asistentes IA vinculados',
      statValue: 'Claude 3.7',
      actionLabel: 'Administrar IA & Bots',
    },
    {
      id: 'audit',
      title: 'Auditoría & Seguridad RLS',
      description:
        'Trazabilidad total e inmutable de operaciones, registro histórico de celdas de pipeline, políticas PostgreSQL Row Level Security y sesiones activas.',
      icon: ShieldCheck,
      href: '/admin/audit',
      active: true,
      badgeText: 'Fase 7',
      badgeVariant: 'default' as const,
      statLabel: 'Políticas RLS activas',
      statValue: '100% Blindado',
      actionLabel: 'Ver Registro de Auditoría',
    },
  ];

  // -------------------------------------------------------------
  // TARJETAS PARA DIRECTOR COMERCIAL
  // -------------------------------------------------------------
  const directorCards: FeatureCard[] = [
    {
      id: 'projects',
      title: 'Mis Proyectos Asignados',
      description:
        'Configuración de unidades de infoproductos bajo tu dirección, gestión de catálogo de tickets y metas de facturación mensual.',
      icon: FolderKanban,
      href: '/admin/projects',
      active: true,
      badgeText: 'Operativo',
      statLabel: 'Proyectos a cargo',
      statValue: isLoading ? <Skeleton className="h-4 w-16 bg-muted/60 inline-block" /> : `${stats.projectCount} Activos`,
      actionLabel: 'Administrar Proyectos',
    },
    {
      id: 'commissions',
      title: 'Metas & Comisiones del Proyecto',
      description:
        'Supervisión de metas de facturación mensual pactadas, escalones (tiers) de comisión alcanzados y liquidación del equipo.',
      icon: TrendingUp,
      href: '/director/commissions',
      active: true,
      badgeText: 'Fase 5',
      statLabel: 'Esquema de comisiones',
      statValue: 'Multivariable',
      actionLabel: 'Revisar Comisiones',
    },
    {
      id: 'ai',
      title: 'Asistente Comercial con IA',
      description:
        'Herramientas inteligentes para análisis de objeciones en llamadas, sugerencias de scripts tácticos y alertas tempranas.',
      icon: Bot,
      href: '/director/ai',
      active: true,
      badgeText: 'Fase 6',
      statLabel: 'Soporte inteligente',
      statValue: 'Telegram & Claude',
      actionLabel: 'Consultar Asistente',
    },
  ];

  // -------------------------------------------------------------
  // TARJETAS PARA CLOSER COMERCIAL
  // -------------------------------------------------------------
  const closerCards: FeatureCard[] = [
    {
      id: 'projects',
      title: 'Proyectos Asignados',
      description:
        'Accede a los proyectos a los que estás asignado, visualiza tu pipeline, prospectos y opciones operativas.',
      icon: FolderKanban,
      href: '/closer/projects',
      active: true,
      badgeText: 'Operativo',
      statLabel: 'Proyectos vinculados',
      statValue: isLoading ? <Skeleton className="h-4 w-16 bg-muted/60 inline-block" /> : 'Activos',
      actionLabel: 'Ver mis Proyectos',
    },
    {
      id: 'commissions',
      title: 'Mis Comisiones Ganadas',
      description:
        'Visualiza tus comisiones en tiempo real, tu porcentaje asignado según el escalón de meta cumplido y fechas de cobro.',
      icon: TrendingUp,
      href: '/closer/commissions',
      active: true,
      badgeText: 'Fase 5',
      statLabel: 'Comisiones acumuladas',
      statValue: 'Liquidaciones',
      actionLabel: 'Ver mis Comisiones',
    },
    {
      id: 'schedule',
      title: 'Mi Agenda / Llamadas del Día',
      description:
        'Consulta tus sesiones de venta agendadas, notas de cualificación previas a la llamada y enlaces directos de reunión.',
      icon: Calendar,
      href: '/closer/schedule',
      active: true,
      badgeText: 'Fase 3',
      statLabel: 'Llamadas programadas',
      statValue: 'Agenda en vivo',
      actionLabel: 'Abrir Agenda',
    },
  ];

  // -------------------------------------------------------------
  // TARJETAS PARA CLIENTE (DUEÑO DEL INFOPRODUCTO)
  // -------------------------------------------------------------
  const clienteCards: FeatureCard[] = [
    {
      id: 'revenue',
      title: 'Facturación & Rendimiento',
      description:
        'Visualización consolidada de solo lectura de la facturación bruta y neta, ventas concretadas y ticket promedio de tu infoproducto.',
      icon: DollarSign,
      href: '/cliente/revenue',
      active: true,
      badgeText: 'Fase 5',
      statLabel: 'Facturación generada',
      statValue: 'Solo Lectura',
      actionLabel: 'Ver Facturación',
    },
    {
      id: 'reports',
      title: 'Reportes Ejecutivos',
      description:
        'Informes periódicos sobre la efectividad de la unidad comercial de closers, metas alcanzadas y rendimiento global del embudo.',
      icon: BarChart3,
      href: '/cliente/reports',
      active: true,
      badgeText: 'Fase 5',
      statLabel: 'Informes mensuales',
      statValue: 'Descarga PDF / Excel',
      actionLabel: 'Consultar Reportes',
    },
    {
      id: 'products',
      title: 'Catálogo de Infoproductos',
      description:
        'Consulta las ofertas activas, cursos o mentorías operados actualmente por el equipo comercial de GrowthShell.',
      icon: Package,
      href: '/cliente/products',
      active: true,
      badgeText: 'Operativo',
      statLabel: 'Productos en venta',
      statValue: 'Catálogo Activo',
      actionLabel: 'Ver Catálogo',
    },
  ];

  // Determinar tarjetas y textos según el rol activo
  let currentCards: FeatureCard[] = superAdminCards;
  let headerBadge = 'Panel de Control';
  let headerTitle = 'Centro de Mando GrowthShell';
  let headerDesc = 'Gestión integral de unidades comerciales, proyectos, pipelines y trazabilidad de ventas en alta concurrencia.';

  if (role === 'DIRECTOR') {
    currentCards = directorCards;
    headerBadge = 'Dirección Comercial';
    headerTitle = 'Panel de Control del Director';
    headerDesc = 'Supervisión de proyectos asignados, metas comerciales de facturación y coordinación de tu equipo de closers.';
  } else if (role === 'CLOSER') {
    currentCards = closerCards;
    headerBadge = 'Fuerza de Ventas';
    headerTitle = 'Espacio Comercial del Closer';
    headerDesc = 'Tu centro de operaciones para llamadas agendadas, seguimiento en pipeline y registro de comisiones ganadas.';
  } else if (role === 'CLIENTE') {
    currentCards = clienteCards;
    headerBadge = 'Portal del Cliente';
    headerTitle = 'Portal Ejecutivo de Resultados';
    headerDesc = 'Visualización consolidada de solo lectura de la facturación y ventas logradas por la unidad comercial de tu proyecto.';
  }

  // ADMIN no debe ver la tarjeta de Auditoría (solo SUPER_ADMIN la administra)
  if (role === 'ADMIN') {
    currentCards = currentCards.filter((c) => c.id !== 'audit');
  }

  return (
    <AdminShell title="Centro de Mando">
      {/* ------------------------------------------------------------- */}
      {/* CABECERA PRINCIPAL ADAPTADA AL ROL                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-2">
            <Activity size={12} className="animate-pulse" />
            {headerBadge}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {headerTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {headerDesc}
          </p>
        </div>

        <div className="flex items-center gap-3">

          {role === 'DIRECTOR' && (
            <Button asChild variant="gold" className="font-semibold text-xs h-10 shadow-lg">
              <Link href="/admin/projects">
                <FolderKanban size={16} className="mr-2" />
                Mis Proyectos
              </Link>
            </Button>
          )}

          {role === 'CLOSER' && (
            <Button asChild variant="gold" className="font-semibold text-xs h-10 shadow-lg">
              <Link href="/pipeline">
                <Kanban size={16} className="mr-2" />
                Abrir Mi Pipeline
              </Link>
            </Button>
          )}

          {role === 'CLIENTE' && (
            <Button asChild variant="gold" className="font-semibold text-xs h-10 shadow-lg">
              <Link href="/cliente/revenue">
                <DollarSign size={16} className="mr-2" />
                Ver Facturación
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MINI BANNER DE MÉTRICAS RÁPIDAS (SEGÚN ROL)                    */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
          <>
            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Usuarios Activos</span>
                <Users size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                {isLoading ? '...' : stats.activeCount}
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                <TrendingUp size={12} /> {stats.invitedCount} invitaciones pendientes
              </p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Proyectos Registrados</span>
                <FolderKanban size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{stats.projectCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">proyectos registrados en base</p>
            </Card>
          </>
        )}

        {role === 'DIRECTOR' && (
          <>
            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Proyectos a Cargo</span>
                <FolderKanban size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{stats.projectCount}</div>
              <p className="text-[11px] text-emerald-400 mt-1">unidades activas bajo supervisión</p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Estado del Pipeline</span>
                <Kanban size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">Activo</div>
              <p className="text-[11px] text-muted-foreground mt-1">concurrencia optimista habilitada</p>
            </Card>
          </>
        )}

        {role === 'CLOSER' && (
          <>
            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Mi Estado Comercial</span>
                <Sparkles size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">Habilitado</div>
              <p className="text-[11px] text-emerald-400 mt-1">Listo para recibir y cerrar leads</p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Mi Pipeline</span>
                <Kanban size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">Personal</div>
              <p className="text-[11px] text-muted-foreground mt-1">Aislamiento por closer activo</p>
            </Card>
          </>
        )}

        {role === 'CLIENTE' && (
          <>
            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tipo de Acceso</span>
                <CheckCircle2 size={16} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">Ejecutivo</div>
              <p className="text-[11px] text-cyan-400/90 mt-1">Dashboard consolidado seguro</p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Protección de Datos</span>
                <ShieldCheck size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">100% RLS</div>
              <p className="text-[11px] text-muted-foreground mt-1">Sin exposición de datos de leads</p>
            </Card>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* GRID DINÁMICO DE TARJETAS DE MÓDULOS                          */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Módulos y Espacios de Trabajo
          </h2>
          <p className="text-xs text-muted-foreground">
            Accesos directos configurados para tu rol ({role}).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.id}
                className={cn(
                  'relative flex flex-col justify-between border-border transition-all duration-200 overflow-hidden',
                  card.active
                    ? 'bg-card hover:border-primary/60 hover:shadow-md'
                    : 'bg-card/50 opacity-90 hover:opacity-100 hover:border-border'
                )}
              >
                {/* Glow decorativo en tarjeta activa */}
                {card.active && (
                  <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl border',
                        card.active
                          ? 'bg-primary border-transparent text-white shadow-sm'
                          : 'bg-card border-border text-muted-foreground'
                      )}
                    >
                      <Icon size={22} />
                    </div>

                    <Badge
                      variant="gold"
                      className="text-[10px] px-2.5 py-0.5"
                    >
                      {card.badgeText}
                    </Badge>
                  </div>

                  <CardTitle className="text-base font-bold text-foreground">
                    {card.title}
                  </CardTitle>

                  <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3">
                    {card.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-2 border-t border-border/50 mt-auto">
                  <div className="flex items-center justify-between text-xs py-2">
                    <span className="text-muted-foreground">{card.statLabel}</span>
                    <span className="font-semibold text-foreground">{card.statValue}</span>
                  </div>

                  <div className="pt-2">
                    <Button
                      asChild
                      variant="gold"
                      className="w-full text-xs font-bold h-9 justify-between"
                    >
                      <Link href={card.href}>
                        <span>{card.actionLabel}</span>
                        <ArrowRight size={14} />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
