'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  ChevronDown,
  Check,
  Globe,
  Plus,
  Search,
} from 'lucide-react';
import { useProjectContext } from '@/contexts/project-context';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function GlobalProjectSelector() {
  const {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    isLoadingProjects,
  } = useProjectContext();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Trigger del Selector */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 text-xs font-medium',
          isOpen
            ? 'bg-card border-primary/60 shadow-md'
            : 'bg-[#0B0D13]/90 border-border hover:border-primary/40 hover:bg-card/60'
        )}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary">
          <FolderKanban size={12} />
        </div>

        <div className="flex items-center gap-1.5 text-left">
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            Proyecto:
          </span>
          <span className="font-bold text-foreground max-w-[140px] sm:max-w-[180px] truncate">
            {isLoadingProjects
              ? 'Cargando...'
              : activeProject
              ? activeProject.name
              : 'Todos los Proyectos'}
          </span>
        </div>

        {activeProject?.status === 'ACTIVE' && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}

        <ChevronDown
          size={14}
          className={cn(
            'text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180 text-primary'
          )}
        />
      </button>

      {/* Menú Desplegable */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl border border-border bg-[#0E1118]/95 backdrop-blur-xl p-2 shadow-[0_15px_50px_rgba(0,0,0,0.7)] z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Cabecera del menú */}
          <div className="px-3 py-2 border-b border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                Seleccionar Proyecto Activo
              </span>
              <span className="text-[10px] font-mono text-primary">
                {projects.length} {projects.length === 1 ? 'unidad' : 'unidades'}
              </span>
            </div>

            {projects.length > 4 && (
              <div className="mt-2 relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proyecto..."
                  className="w-full pl-7 pr-2 py-1 text-xs bg-[#090A0F] border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                />
              </div>
            )}
          </div>

          <div className="py-1.5 max-h-60 overflow-y-auto space-y-1">
            {/* Opción: Todos los Proyectos */}
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors',
                activeProjectId === null
                  ? 'bg-primary/15 text-primary font-bold border border-primary/30'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-card border border-border text-foreground">
                  <Globe size={13} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold leading-none">Todos los Proyectos</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Vista consolidada global</span>
                </div>
              </div>
              {activeProjectId === null && <Check size={14} className="text-primary" />}
            </button>

            <div className="h-[1px] bg-brand-border/40 my-1" />

            {/* Listado de proyectos */}
            {filteredProjects.map((proj) => {
              const isSelected = activeProjectId === proj.id;

              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left',
                    isSelected
                      ? 'bg-primary/15 text-primary font-bold border border-primary/30'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/25 font-bold text-[11px] text-primary">
                      {proj.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-foreground truncate leading-tight">
                        {proj.name}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate">
                        /{proj.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {proj.status === 'ACTIVE' && (
                      <Badge variant="success" className="text-[9px] px-1.5 py-0">
                        Activo
                      </Badge>
                    )}
                    {proj.status === 'DRAFT' && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        Borrador
                      </Badge>
                    )}
                    {proj.status === 'PAUSED' && (
                      <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                        Pausa
                      </Badge>
                    )}
                    {isSelected && <Check size={14} className="text-primary ml-1" />}
                  </div>
                </button>
              );
            })}

            {filteredProjects.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No se encontraron proyectos.
              </div>
            )}
          </div>

          {/* Footer: Administrar Proyectos */}
          <div className="pt-1.5 mt-1 border-t border-border/60">
            {(() => {
              const role = typeof window !== 'undefined' ? localStorage.getItem('gs_user_role') : null;
              const isCloser = role === 'CLOSER';
              return (
                <Link
                  href={isCloser ? "/closer/projects" : "/admin/projects"}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus size={13} />
                  <span>{isCloser ? "Mis Proyectos" : "Administrar Proyectos"}</span>
                </Link>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
