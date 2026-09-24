'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/api-client';

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  directorId: string | null;
  directorName?: string | null;
  directorEmail?: string | null;
  productsCount: number;
  membersCount: number;
  goalsConfig: {
    monthlyTargetRevenue: number;
    currency: string;
    targetCallsPerCloser?: number;
  };
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectContextType {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeProject: ProjectSummary | null;
  setActiveProjectId: (id: string | null) => void;
  isLoadingProjects: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);

  const refreshProjects = useCallback(async () => {
    // Evitar consultar endpoints protegidos si estamos en páginas públicas de autenticación o no hay token
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hasToken = !!localStorage.getItem('gs_access_token') || !!sessionStorage.getItem('gs_access_token');
      if (path === '/login' || path.startsWith('/accept-invite') || !hasToken) {
        setIsLoadingProjects(false);
        return;
      }
    }

    try {
      const res = await fetchWithAuth('/projects');
      if (res.ok) {
        const data = await res.json();
        const list: ProjectSummary[] = data.projects || [];
        setProjects(list);

        // Sincronizar proyecto activo desde localStorage
        const savedId = typeof window !== 'undefined' ? localStorage.getItem('gs_active_project_id') : null;
        if (savedId && list.some((p) => p.id === savedId)) {
          setActiveProjectIdState(savedId);
        } else if (list.length > 0 && !savedId) {
          const firstActive = list.find((p) => p.status === 'ACTIVE') || list[0];
          if (firstActive) {
            setActiveProjectIdState(firstActive.id);
            if (typeof window !== 'undefined') {
              localStorage.setItem('gs_active_project_id', firstActive.id);
            }
          }
        }
      }
    } catch {
      // Ignorar fallo de red silencioso
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const setActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('gs_active_project_id', id);
      } else {
        localStorage.removeItem('gs_active_project_id');
      }
    }
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjectId,
        activeProject,
        setActiveProjectId,
        isLoadingProjects,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

const defaultContextValue: ProjectContextType = {
  projects: [],
  activeProjectId: null,
  activeProject: null,
  setActiveProjectId: () => {},
  isLoadingProjects: false,
  refreshProjects: async () => {},
};

export function useProjectContext() {
  const context = useContext(ProjectContext);
  return context ?? defaultContextValue;
}

