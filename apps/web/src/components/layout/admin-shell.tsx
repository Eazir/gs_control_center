'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Radio,
  BarChart3,
  Bot,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Kanban,
  DollarSign,
  TrendingUp,
  Calendar,
  Package,
  ShieldAlert,
  Crown,
} from 'lucide-react';
import { GrowthSellHexagon } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api-client';
import { ProjectProvider, useProjectContext } from '@/contexts/project-context';

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge?: string;
}

export function getNavItemsForRole(role?: string): NavItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { title: 'Centro de Mando', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Gestión de Usuarios', href: '/admin/users', icon: Users },
        { title: 'Administración de Proyectos', href: '/admin/projects', icon: FolderKanban },
        { title: 'Dashboard de Métricas', href: '/admin/analytics', icon: BarChart3 },
        { title: 'Centro de IA & Telegram', href: '/admin/ai-telegram', icon: Bot },
        { title: 'Auditoría & RLS', href: '/admin/audit', icon: ShieldCheck },
      ];
    case 'ADMIN':
      return [
        { title: 'Centro de Mando', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Gestión de Usuarios', href: '/admin/users', icon: Users },
        { title: 'Administración de Proyectos', href: '/admin/projects', icon: FolderKanban },
        { title: 'Dashboard de Métricas', href: '/admin/analytics', icon: BarChart3 },
        { title: 'Centro de IA & Telegram', href: '/admin/ai-telegram', icon: Bot },
      ];
    case 'DIRECTOR':
      return [
        { title: 'Centro de Mando', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Proyectos Asignados', href: '/admin/projects', icon: FolderKanban },
        { title: 'Métricas de Ventas', href: '/director/analytics', icon: BarChart3 },
      ];
    case 'CLOSER':
      return [
        { title: 'Centro de Mando', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Proyectos Asignados', href: '/closer/projects', icon: FolderKanban },
      ];
    case 'CLIENTE':
      return [
        { title: 'Centro de Mando', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Metricas de mis proyectos', href: '/cliente/metricas', icon: BarChart3 },
      ];
    default:
      return [
        { title: 'Centro de Mando', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Mi Pipeline', href: '/pipeline', icon: Kanban },
      ];
  }
}

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AdminShell({ children, title, subtitle: _subtitle }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProject } = useProjectContext();

  const [activeUser, setActiveUser] = useState<{
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null>(null);


  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);

  // Cargar preferencia del sidebar desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gs_sidebar_expanded');
      if (saved !== null) {
        setIsSidebarExpanded(saved === 'true');
      }
    } catch {
      // Ignorar fallo de lectura en SSR
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gs_sidebar_expanded', String(next));
      } catch {
        // Ignorar
      }
      return next;
    });
  };

  // Verificación estricta de sesión de usuario (Protección de ruta)
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await fetchWithAuth('/auth/me');

        if (!res.ok) {
          throw new Error('Sesión no válida');
        }

        const user = await res.json();
        setActiveUser({
          id: user.id || '',
          email: user.email,
          fullName: user.fullName || 'Super Administrador',
          role: user.role || 'SUPER_ADMIN',
        });
        setIsCheckingAuth(false);
      } catch {
        // Si no está autenticado o la API rechaza, redirigir a Login
        sessionStorage.clear();
        localStorage.removeItem('gs_access_token');
        localStorage.removeItem('gs_user_role');
        router.push('/login');
      }
    };

    verifyAuth();
  }, [router]);

  // Sincronización entre pestañas en tiempo real (Single-Session per Browser)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'gs_access_token') {
        if (!event.newValue) {
          // Otra pestaña cerró sesión: cerrar inmediatamente aquí
          sessionStorage.clear();
          localStorage.removeItem('gs_access_token');
          localStorage.removeItem('gs_user_role');
          router.push('/login');
        } else if (event.newValue !== event.oldValue) {
          // Otra pestaña inició sesión con otra cuenta: actualizar perfil o revalidar
          fetchWithAuth('/auth/me')
            .then(async (res) => {
              if (res.ok) {
                const user = await res.json();
                setActiveUser({
                  id: user.id || '',
                  email: user.email,
                  fullName: user.fullName || 'Usuario',
                  role: user.role || 'SUPER_ADMIN',
                });
              } else {
                throw new Error();
              }
            })
            .catch(() => {
              sessionStorage.clear();
              localStorage.removeItem('gs_access_token');
              localStorage.removeItem('gs_user_role');
              router.push('/login');
            });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignorar error de red al salir
    } finally {
      sessionStorage.clear();
      localStorage.removeItem('gs_access_token');
      localStorage.removeItem('gs_user_role');
      router.push('/login');
    }
  };

  // Cálculos memoizados de navegación y restricciones (siempre antes de cualquier return condicional)
  const navItems = useMemo(() => getNavItemsForRole(activeUser?.role), [activeUser?.role]);

  const isRestrictedForRole = useMemo(() => {
    if (!activeUser) return false;
    const role = activeUser.role;
    // Rutas de administración de usuarios
    if (pathname.startsWith('/admin/users') && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return true;
    }
    // Rutas de proyectos (listado principal sólo para Super Admin, Admin y Director)
    if (pathname === '/admin/projects' && role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'DIRECTOR') {
      return true;
    }
    // Auditoría sólo super admin
    if (pathname.startsWith('/admin/audit') && role !== 'SUPER_ADMIN') {
      return true;
    }
    // Integraciones y Centro de IA sólo Super Admin y Admin
    if (
      (pathname.startsWith('/admin/integrations') || pathname.startsWith('/admin/ai-telegram')) &&
      role !== 'SUPER_ADMIN' &&
      role !== 'ADMIN'
    ) {
      return true;
    }
    return false;
  }, [activeUser, pathname]);

  // Pantalla de carga mientras se verifica autenticación
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse">
            <GrowthSellHexagon size={48} />
          </div>
          <div className="flex items-center gap-2 text-xs text-primary font-medium tracking-wider uppercase">
            <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
            Verificando credenciales del Centro de Mando...
          </div>
        </div>
      </div>
    );
  }

  const renderRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-purple-500/30 text-purple-400 bg-purple-500/10">
            <Crown size={10} className="mr-1 text-purple-400" />
            SUPER ADMIN
          </Badge>
        );
      case 'ADMIN':
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-amber-500/30 text-amber-400 bg-amber-500/10">
            <ShieldCheck size={10} className="mr-1 text-amber-400" />
            ADMIN
          </Badge>
        );
      case 'DIRECTOR':
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-blue-500/30 text-blue-400 bg-blue-500/10">
            <FolderKanban size={10} className="mr-1 text-blue-400" />
            DIRECTOR
          </Badge>
        );
      case 'CLOSER':
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            <DollarSign size={10} className="mr-1 text-emerald-400" />
            CLOSER
          </Badge>
        );
      case 'CLIENTE':
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-rose-500/30 text-rose-400 bg-rose-500/10">
            <Package size={10} className="mr-1 text-rose-400" />
            CLIENTE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            {role || 'USUARIO'}
          </Badge>
        );
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR COLAPSABLE / EXPANDIBLE A GUSTO DEL USUARIO            */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={cn(
          'flex-shrink-0 flex flex-col justify-between border-r border-border bg-[#0B0D13] py-4 z-40 transition-all duration-300 ease-in-out',
          isSidebarExpanded ? 'w-64 px-3' : 'w-[68px] items-center px-2'
        )}
      >
        {/* Top: Logo y botón para expandir/contraer */}
        <div className="flex flex-col w-full gap-4">
          <div
            className={cn(
              'flex items-center w-full',
              isSidebarExpanded ? 'justify-between px-2' : 'justify-center'
            )}
          >
            <Link
              href="/dashboard"
              className="flex items-center gap-3 transition-transform hover:scale-105"
            >
              <GrowthSellHexagon size={32} />
              {isSidebarExpanded && (
                <div className="flex flex-col leading-none">
                  <span className="text-sm font-bold text-foreground tracking-tight">
                    Growth<span className="text-primary">Shell</span>
                  </span>
                  <span className="text-[9px] tracking-widest text-muted-foreground uppercase mt-0.5">
                    Centro de Mando
                  </span>
                </div>
              )}
            </Link>

            {isSidebarExpanded && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
                title="Contraer barra lateral"
              >
                <PanelLeftClose size={18} />
              </button>
            )}
          </div>

          {!isSidebarExpanded && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="group relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-card hover:text-primary transition-colors"
              title="Expandir barra lateral"
            >
              <PanelLeftOpen size={18} />
              <span className="absolute left-[62px] whitespace-nowrap rounded-md bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-2xl border border-border opacity-0 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-1 z-50">
                Expandir menú
              </span>
            </button>
          )}

          <div className="w-full h-[1px] bg-brand-border/60" />

          {/* Menú de Navegación Dinámico por Rol */}
          <nav className="flex flex-col gap-1.5 w-full">
            {navItems.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center rounded-xl transition-all duration-150',
                    isSidebarExpanded
                      ? 'gap-3 px-3 py-2.5 w-full text-xs font-medium'
                      : 'h-11 w-11 justify-center',
                    isActive
                      ? 'bg-primary text-brand-dark shadow-md font-bold'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  )}
                >
                  <Icon size={isSidebarExpanded ? 18 : 20} className="flex-shrink-0" />

                  {isSidebarExpanded ? (
                    <span className="truncate">{item.title}</span>
                  ) : (
                    /* Tooltip flotante hacia la derecha cuando está colapsado */
                    <span className="absolute left-[62px] whitespace-nowrap rounded-md bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-2xl border border-border opacity-0 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-1 z-50">
                      {item.title}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Botón Salir */}
        <div className="flex flex-col gap-3 w-full">
          <div className="w-full h-[1px] bg-brand-border/60" />
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'group relative flex items-center rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors',
              isSidebarExpanded
                ? 'gap-3 px-3 py-2.5 w-full text-xs font-medium'
                : 'h-11 w-11 justify-center'
            )}
          >
            <LogOut size={isSidebarExpanded ? 18 : 20} className="flex-shrink-0" />
            {isSidebarExpanded ? (
              <span className="truncate font-semibold text-red-400">Cerrar Sesión</span>
            ) : (
              <span className="absolute left-[62px] whitespace-nowrap rounded-md bg-card px-3 py-1.5 text-xs font-medium text-red-400 shadow-2xl border border-red-500/20 opacity-0 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-1 z-50">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* ÁREA PRINCIPAL CON TOPBAR Y CONTENIDO                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOPBAR */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between border-b border-border/80 bg-card/70 px-4 sm:px-6 backdrop-blur-md z-30">
          {/* Breadcrumb / Título dinámico */}
          <div className="flex items-center gap-2 overflow-hidden text-xs">
            <Link
              href="/dashboard"
              className="font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Centro de Mando
            </Link>
            {title && (
              <>
                <ChevronRight size={13} className="text-muted-foreground/60 flex-shrink-0" />
                <span className="font-bold text-foreground truncate">{title}</span>
              </>
            )}
          </div>

          {/* Estado del Sistema y Perfil de Usuario */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Chip de Usuario con Rol Dinámico */}
            <div className="flex items-center gap-3 pl-3 border-l border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 border border-primary/40 text-primary font-bold text-xs">
                {activeUser?.fullName ? activeUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col text-left hidden sm:flex">
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {activeUser?.fullName}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[150px]">
                  {activeUser?.email}
                </span>
              </div>
              {renderRoleBadge(activeUser?.role)}
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL CON SCROLL */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#090A0F] relative">
          {/* Glow de fondo dorado tenue */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

          <div className="max-w-7xl mx-auto space-y-6 relative z-10">
            {isRestrictedForRole ? (
              <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-card border border-red-500/30 text-center space-y-4 shadow-2xl">
                <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                  <ShieldAlert size={28} />
                </div>
                <h2 className="text-lg font-bold text-foreground">Acceso Restringido</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tu rol actual (<span className="font-mono text-primary font-bold">{activeUser?.role}</span>) no cuenta con privilegios para acceder a esta área de administración.
                </p>
                <div className="pt-2">
                  <Button asChild variant="gold" size="sm" className="font-bold text-xs h-9">
                    <Link href="/dashboard">
                      Ir a Mi Centro de Mando
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}


