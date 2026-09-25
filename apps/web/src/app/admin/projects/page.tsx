'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  Plus,
  Search,
  AlertCircle,
  RotateCw,
  Pencil,
  Trash2,
  Package,
  Target,
  UserCheck,
  Check,
  Ban,
  DollarSign,
  Tag,
  Sparkles,
  Users,
  UserPlus,
  Phone,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchWithAuth } from '@/lib/api-client';

interface ProductItem {
  id: string;
  name: string;
  sku?: string | null;
  offerCode?: string | null;
  price: number;
  installments?: number;
  currency: string;
  active: boolean;
  ownerCloserId?: string | null;
  externalLabel?: string | null;
}

interface ProjectSummary {
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

interface ProjectStats {
  total: number;
  active: number;
  draft: number;
  paused: number;
  archived: number;
}

interface DirectorUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  /** Estado de la cuenta según el backend (`ACTIVE`, `SUSPENDED`, `INVITED`, `DELETED`). */
  status?: string | null;
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleInProject: 'DIRECTOR' | 'CLOSER' | 'CLIENTE';
  permissions: Record<string, unknown>;
  assignedBy?: string | null;
  assignedAt: string;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  userPhone?: string | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function AdminProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0,
    active: 0,
    draft: 0,
    paused: 0,
    archived: 0,
  });
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [directors, setDirectors] = useState<DirectorUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal Crear / Editar Proyecto
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Formulario Proyecto
  const [formName, setFormName] = useState<string>('');
  const [formSlug, setFormSlug] = useState<string>('');
  const [formSlugManual, setFormSlugManual] = useState<boolean>(false);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDirectorId, setFormDirectorId] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'>('ACTIVE');
  const [formTargetRevenue, setFormTargetRevenue] = useState<number>(50000);
  const [formCurrency, setFormCurrency] = useState<string>('USD');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Catálogo de Productos (Fase 2.3)
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogProject, setCatalogProject] = useState<ProjectSummary | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<ProductItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdSku, setNewProdSku] = useState<string>('');
  const [newProdOfferCode, setNewProdOfferCode] = useState<string>('');
  const [newProdPrice, setNewProdPrice] = useState<number>(997);
  const [newProdInstallments, setNewProdInstallments] = useState<number>(1);
  const [newProdCurrency, setNewProdCurrency] = useState<string>('USD');
  const [newProdOwnerCloserId, setNewProdOwnerCloserId] = useState<string>('');
  const [newProdExternalLabel, setNewProdExternalLabel] = useState<string>('');
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Modal Equipo Comercial (Fase 2.4)
  const [isTeamOpen, setIsTeamOpen] = useState<boolean>(false);
  const [teamProject, setTeamProject] = useState<ProjectSummary | null>(null);
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState<boolean>(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Formulario Asignar Miembro
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState<string>('');
  const [selectedRoleInProject, setSelectedRoleInProject] = useState<'DIRECTOR' | 'CLOSER' | 'CLIENTE'>('CLOSER');
  const [isAssigningMember, setIsAssigningMember] = useState<boolean>(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // Carga de proyectos desde el backend
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [res, meRes] = await Promise.all([
        fetchWithAuth('/projects'),
        fetchWithAuth('/auth/me').catch(() => null),
      ]);

      if (meRes && meRes.ok) {
        const me = await meRes.json();
        setCurrentUser({ id: me.id, role: me.role });
      }

      if (!res.ok) {
        throw new Error('Error al consultar el catálogo de proyectos');
      }
      const data = await res.json();
      setProjects(data.projects || []);
      setStats(
        data.stats || {
          total: data.projects?.length || 0,
          active: 0,
          draft: 0,
          paused: 0,
          archived: 0,
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar usuarios de la plataforma
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/auth/users');
      if (res.ok) {
        const data = await res.json();
        const usersList: AppUser[] = data.users || [];
        setAllUsers(usersList);
        // El Super Admin no debe aparecer como opción de director ya que es cuenta raíz de soporte.
        // Solo usuarios con cuenta activa son asignables como director comercial.
        const eligible = usersList.filter(
          (u) => u.status === 'ACTIVE' && (u.role === 'DIRECTOR' || u.role === 'ADMIN')
        );
        setDirectors(eligible);
      }
    } catch {
      // Ignorar fallo de carga de usuarios auxiliar
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadUsers();
  }, [loadProjects, loadUsers]);


  // Manejador de cambio en nombre para autogenerar slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormName(val);
    if (!formSlugManual && modalMode === 'create') {
      setFormSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormSlugManual(true);
    setFormSlug(slugify(e.target.value));
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedProjectId(null);
    setFormName('');
    setFormSlug('');
    setFormSlugManual(false);
    setFormDescription('');
    setFormDirectorId('');
    setFormStatus('ACTIVE');
    setFormTargetRevenue(50000);
    setFormCurrency('USD');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project: ProjectSummary) => {
    setModalMode('edit');
    setSelectedProjectId(project.id);
    setFormName(project.name);
    setFormSlug(project.slug);
    setFormSlugManual(true);
    setFormDescription(project.description || '');
    setFormDirectorId(project.directorId || '');
    setFormStatus(project.status);
    setFormTargetRevenue(project.goalsConfig?.monthlyTargetRevenue ?? 0);
    setFormCurrency(project.goalsConfig?.currency ?? 'USD');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('El nombre del proyecto es obligatorio');
      return;
    }
    if (!formSlug.trim()) {
      setFormError('El slug del proyecto es obligatorio');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (modalMode === 'create') {
        const payload = {
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          status: formStatus,
          goalsConfig: {
            monthlyTargetRevenue: Number(formTargetRevenue) || 0,
            currency: formCurrency,
          },
        };

        const res = await fetchWithAuth('/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'No se pudo crear el proyecto');
        }

        const newProject = await res.json();
        setIsModalOpen(false);
        // Redirigir inmediatamente al panel de administración del proyecto para terminar de configurarlo
        router.push(`/admin/projects/${newProject.id}`);
        return;
      } else if (modalMode === 'edit' && selectedProjectId) {
        const payload = {
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          status: formStatus,
          goalsConfig: {
            monthlyTargetRevenue: Number(formTargetRevenue) || 0,
            currency: formCurrency,
          },
        };

        const res = await fetchWithAuth(`/projects/${selectedProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'No se pudo actualizar el proyecto');
        }
      }

      setIsModalOpen(false);
      await loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la solicitud';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // GESTIÓN DEL CATÁLOGO DE PRODUCTOS (Fase 2.3)
  // -------------------------------------------------------------
  const openCatalogModal = async (project: ProjectSummary) => {
    setCatalogProject(project);
    setNewProdName('');
    setNewProdSku('');
    setNewProdOfferCode('');
    setNewProdPrice(997);
    setNewProdInstallments(1);
    setNewProdCurrency(project.goalsConfig?.currency || 'USD');
    setNewProdOwnerCloserId('');
    setNewProdExternalLabel('');
    setProductFormError(null);
    setCatalogError(null);
    setIsCatalogOpen(true);
    setIsLoadingCatalog(true);

    // Cargar miembros del equipo para el dropdown de propietarios de producto
    loadTeamMembers(project.id);

    try {
      const res = await fetchWithAuth(`/projects/${project.id}/products`);
      if (res.ok) {
        const data = await res.json();
        setCatalogProducts(data || []);
      } else {
        throw new Error('No se pudo cargar el catálogo de productos');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar catálogo';
      setCatalogError(msg);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogProject) return;

    if (!newProdName.trim()) {
      setProductFormError('El nombre del producto es obligatorio');
      return;
    }
    if (newProdPrice < 0) {
      setProductFormError('El precio no puede ser negativo');
      return;
    }

    // Validación: Código de oferta único
    if (newProdOfferCode.trim()) {
      const existingActive = catalogProducts.find(
        (p) => p.active && p.offerCode === newProdOfferCode.trim()
      );
      if (existingActive) {
        setProductFormError(
          `Debe desactivar el producto existente (${existingActive.name}) antes de crear uno nuevo con el mismo código de oferta.`
        );
        return;
      }
    }

    setIsAddingProduct(true);
    setProductFormError(null);

    try {
      const payload = {
        name: newProdName.trim(),
        sku: newProdSku.trim() || null,
        offerCode: newProdOfferCode.trim() || null,
        price: Number(newProdPrice),
        installments: newProdInstallments,
        currency: newProdCurrency,
        active: true,
        ownerCloserId: newProdOwnerCloserId || null,
        externalLabel: newProdExternalLabel.trim() || null,
      };

      const res = await fetchWithAuth(`/projects/${catalogProject.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'No se pudo agregar el producto');
      }

      const createdProduct = await res.json();
      setCatalogProducts((prev) => [...prev, createdProduct]);

      // Resetear campos del formulario
      setNewProdName('');
      setNewProdSku('');
      setNewProdOfferCode('');
      setNewProdPrice(997);
      setNewProdInstallments(1);
      setNewProdOwnerCloserId('');
      setNewProdExternalLabel('');

      // Refrescar lista de proyectos en segundo plano para actualizar productosCount
      loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al agregar producto';
      setProductFormError(msg);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!catalogProject) return;

    try {
      const res = await fetchWithAuth(
        `/projects/${catalogProject.id}/products/${productId}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        throw new Error('No se pudo eliminar el producto');
      }

      setCatalogProducts((prev) => prev.filter((p) => p.id !== productId));
      loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar producto';
      setCatalogError(msg);
    }
  };

  const handleToggleProductActive = async (product: ProductItem) => {
    if (!catalogProject) return;

    try {
      const res = await fetchWithAuth(
        `/projects/${catalogProject.id}/products/${product.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !product.active }),
        }
      );

      if (!res.ok) {
        throw new Error('No se pudo actualizar el estado del producto');
      }

      const updated = await res.json();
      setCatalogProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updated : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar estado';
      setCatalogError(msg);
    }
  };

  // -------------------------------------------------------------
  // GESTIÓN DE EQUIPO COMERCIAL (Fase 2.4)
  // -------------------------------------------------------------

  const openTeamModal = (project: ProjectSummary) => {
    setTeamProject(project);
    setIsTeamOpen(true);
    setTeamError(null);
    setMemberFormError(null);
    setSelectedUserIdToAssign('');
    setSelectedRoleInProject('CLOSER');
    loadTeamMembers(project.id);
  };

  const loadTeamMembers = async (projectId: string) => {
    setIsLoadingTeam(true);
    setTeamError(null);
    try {
      const res = await fetchWithAuth(`/projects/${projectId}/members`);
      if (!res.ok) {
        throw new Error('No se pudo cargar el equipo comercial asignado al proyecto');
      }
      const data: ProjectMember[] = await res.json();
      setTeamMembers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setTeamError(msg);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamProject || !selectedUserIdToAssign) {
      setMemberFormError('Debes seleccionar un usuario para vincularlo al proyecto.');
      return;
    }

    setIsAssigningMember(true);
    setMemberFormError(null);

    if (selectedRoleInProject === 'DIRECTOR') {
      const existingDirector = teamMembers.find((m) => m.roleInProject === 'DIRECTOR');
      if (existingDirector) {
        setMemberFormError(`Ya existe un Director en este proyecto (${existingDirector.userName || existingDirector.userEmail || existingDirector.userId}). Solo puede haber un director por proyecto.`);
        setIsAssigningMember(false);
        return;
      }
    }

    try {
      const res = await fetchWithAuth(`/projects/${teamProject.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserIdToAssign,
          roleInProject: selectedRoleInProject,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al asignar miembro al proyecto');
      }

      const newMember: ProjectMember = await res.json();
      setTeamMembers((prev) => [...prev, newMember]);
      setSelectedUserIdToAssign('');
      setSelectedRoleInProject('CLOSER');

      // Actualizar conteo de miembros en la lista de proyectos en vivo
      setProjects((prev) =>
        prev.map((p) =>
          p.id === teamProject.id ? { ...p, membersCount: p.membersCount + 1 } : p
        )
      );
      setTeamProject((prev) =>
        prev ? { ...prev, membersCount: prev.membersCount + 1 } : null
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setMemberFormError(msg);
    } finally {
      setIsAssigningMember(false);
    }
  };

  const handleUpdateMemberRole = async (
    userId: string,
    newRole: 'DIRECTOR' | 'CLOSER' | 'CLIENTE'
  ) => {
    if (!teamProject) return;
    try {
      const res = await fetchWithAuth(`/projects/${teamProject.id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleInProject: newRole }),
      });

      if (!res.ok) {
        throw new Error('Error al actualizar el rol del miembro');
      }

      const updated: ProjectMember = await res.json();
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, roleInProject: updated.roleInProject } : m
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setTeamError(msg);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!teamProject) return;
    if (
      !confirm(
        `¿Confirmas la desvinculación de ${memberName || 'este usuario'} del proyecto ${teamProject.name}?`
      )
    ) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/projects/${teamProject.id}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('No se pudo desvincular al miembro del proyecto');
      }

      setTeamMembers((prev) => prev.filter((m) => m.userId !== userId));

      setProjects((prev) =>
        prev.map((p) =>
          p.id === teamProject.id
            ? { ...p, membersCount: Math.max(0, p.membersCount - 1) }
            : p
        )
      );
      setTeamProject((prev) =>
        prev ? { ...prev, membersCount: Math.max(0, prev.membersCount - 1) } : null
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setTeamError(msg);
    }
  };

  // Usuarios disponibles para vincular (excluyendo ya asignados, excluyendo SUPER_ADMIN
  // y mostrando únicamente cuentas activas)
  const availableUsersToAssign = useMemo(() => {
    const assignedUserIds = new Set(teamMembers.map((m) => m.userId));
    return allUsers.filter(
      (u) => u.status === 'ACTIVE' && !assignedUserIds.has(u.id) && u.role !== 'SUPER_ADMIN'
    );
  }, [allUsers, teamMembers]);

  // Closers del equipo con cuenta activa (asignables como propietario de producto).
  // Se cruza con allUsers porque el status de la cuenta no viaja en ProjectMember.
  const activeTeamClosers = useMemo(() => {
    const statusByUserId = new Map(allUsers.map((u) => [u.id, u.status]));
    return teamMembers.filter(
      (m) => m.roleInProject === 'CLOSER' && statusByUserId.get(m.userId) === 'ACTIVE'
    );
  }, [allUsers, teamMembers]);

  // Filtrado de proyectos en memoria

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.directorName && p.directorName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const isDirector = currentUser?.role === 'DIRECTOR';

  return (
    <AdminShell title={isDirector ? "Mis Proyectos Asignados" : "Administración de Proyectos"}>
      <div className="space-y-6">
        {/* CABECERA PRINCIPAL */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <FolderKanban className="text-primary" size={26} />
              {isDirector ? 'Mis Proyectos Asignados' : 'Proyectos Comerciales'}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isDirector
                ? 'Unidades de infoproductos bajo tu dirección, gestión de equipo comercial y pipeline de ventas.'
                : 'Catálogo de infoproductos, tickets de venta, asignación de directores y metas comerciales.'}
            </p>
          </div>

          {!isDirector && (
            <Button
              onClick={openCreateModal}
              className="bg-primary text-brand-dark hover:bg-primary/90 font-bold px-4 py-2 h-10 shadow-md flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Nuevo Proyecto</span>
            </Button>
          )}
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Card className="p-4 bg-card/70 border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Proyectos
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {isLoading ? '...' : stats.total}
              </span>
              <span className="text-xs text-primary font-medium">Registrados</span>
            </div>
          </Card>

          <Card className="p-4 bg-card/70 border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Activos
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">
                {isLoading ? '...' : stats.active}
              </span>
              <span className="text-xs text-emerald-500/80 font-medium">En operación</span>
            </div>
          </Card>

          <Card className="p-4 bg-card/70 border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              En Borrador
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-400">
                {isLoading ? '...' : stats.draft}
              </span>
              <span className="text-xs text-blue-500/80 font-medium">Configuración</span>
            </div>
          </Card>

          <Card className="p-4 bg-card/70 border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              En Pausa
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400">
                {isLoading ? '...' : stats.paused}
              </span>
              <span className="text-xs text-amber-500/80 font-medium">Suspendidos</span>
            </div>
          </Card>
        </div>

        {/* TOOLBAR: BUSCADOR Y FILTRO DE ESTADO */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card/40 p-3 rounded-xl border border-border/60">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Buscar por nombre, slug o director..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0B0D13] border-border text-xs h-9 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'ACTIVE', label: 'Activos' },
              { id: 'DRAFT', label: 'Borradores' },
              { id: 'PAUSED', label: 'En Pausa' },
              { id: 'ARCHIVED', label: 'Archivados' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === tab.id
                    ? 'bg-primary text-brand-dark font-bold shadow-md'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ESTADOS DE VISTA: LOADING, ERROR, EMPTY, DATA                  */}
        {/* ------------------------------------------------------------- */}

        {/* 1. LOADING STATE */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="p-5 bg-card/60 border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-10 rounded-xl bg-card" />
                  <Skeleton className="h-5 w-20 rounded-full bg-card" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4 bg-card" />
                  <Skeleton className="h-3 w-1/2 bg-card" />
                </div>
                <Skeleton className="h-12 w-full bg-card rounded-lg" />
                <div className="pt-2 flex justify-between">
                  <Skeleton className="h-8 w-24 bg-card" />
                  <Skeleton className="h-8 w-24 bg-card" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 2. ERROR STATE */}
        {!isLoading && error && (
          <Alert variant="destructive" className="bg-red-950/20 border-red-500/40 text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-300 font-bold">Error al cargar proyectos</AlertTitle>
            <AlertDescription className="text-xs mt-1 flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjects}
                className="border-red-500/30 text-red-300 hover:bg-red-950/40 text-xs h-7 ml-4"
              >
                <RotateCw size={12} className="mr-1" /> Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 3. EMPTY STATE */}
        {!isLoading && !error && filteredProjects.length === 0 && (
          <Card className="p-12 text-center bg-card/30 border-border/60 flex flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 text-primary mb-4">
              <FolderKanban size={32} />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No se encontraron proyectos con esos criterios'
                : 'No hay proyectos configurados aún'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-6">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Prueba ajustando el término de búsqueda o seleccionando otro filtro de estado.'
                : 'Crea tu primera unidad de infoproducto para comenzar a registrar tickets y fijar metas de facturación.'}
            </p>
            {searchQuery || statusFilter !== 'ALL' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="text-xs border-border"
              >
                Limpiar Filtros
              </Button>
            ) : (
              <Button
                onClick={openCreateModal}
                className="bg-primary text-brand-dark hover:bg-primary/90 font-bold text-xs h-9 px-4"
              >
                <Plus size={16} className="mr-1.5" />
                Crear Primer Proyecto
              </Button>
            )}
          </Card>
        )}

        {/* 4. DATA STATE: GRID DE TARJETAS */}
        {!isLoading && !error && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const targetRevenue = project.goalsConfig?.monthlyTargetRevenue || 0;
              const currency = project.goalsConfig?.currency || 'USD';

              return (
                <Card
                  key={project.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-[#0B0D13]/80 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                >
                  {/* Glow sutil en hover */}
                  <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none" />

                  <div className="space-y-3.5">
                    {/* Fila Superior: Monograma + Badge de Estado */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold text-sm tracking-wider shadow-inner">
                          {project.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-sm tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                            {project.name}
                          </h3>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            /{project.slug}
                          </span>
                        </div>
                      </div>

                      {project.status === 'ACTIVE' && (
                        <Badge variant="success" className="text-[10px] px-2 py-0.5">
                          Activo
                        </Badge>
                      )}
                      {project.status === 'PAUSED' && (
                        <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                          En Pausa
                        </Badge>
                      )}
                      {project.status === 'DRAFT' && (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                          Borrador
                        </Badge>
                      )}
                      {project.status === 'ARCHIVED' && (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                          Archivado
                        </Badge>
                      )}
                    </div>

                    {/* Descripción Operativa */}
                    <p className="text-xs text-muted-foreground/90 line-clamp-2 min-h-[32px]">
                      {project.description || 'Sin descripción operativa registrada para esta unidad.'}
                    </p>

                    {/* Director Comercial Asignado */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card/40 border border-border/40">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                        {project.directorName ? project.directorName.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] text-muted-foreground leading-none">
                          Director a cargo
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate leading-tight mt-0.5">
                          {project.directorName || 'Sin director asignado'}
                        </span>
                      </div>
                    </div>

                    {/* Meta Comercial Mensual / Facturación */}
                    <div className="space-y-1.5 p-3 rounded-xl bg-[#0F131C] border border-border/50">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <DollarSign size={12} className="text-primary" />
                          Facturación Bruta
                        </span>
                        <span className="font-bold text-primary font-mono">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency,
                            maximumFractionDigits: 0,
                          }).format(0.00)}
                        </span>
                      </div>
                    </div>

                    {/* Chips de Métricas Operativas */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/70 border border-border/60 font-mono">
                        <Package size={12} className="text-primary" />
                        <span className="font-bold">{project.productsCount}</span>
                        <span>{project.productsCount === 1 ? 'Producto' : 'Productos'}</span>
                      </div>

                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/70 border border-border/60 font-mono">
                        <Users size={12} className="text-blue-400" />
                        <span className="font-bold">{project.membersCount}</span>
                        <span>{project.membersCount === 1 ? 'Miembro' : 'Miembros'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => router.push(`/admin/projects/${project.id}`)}
                        className="text-xs h-8 font-bold flex-1 flex items-center justify-center gap-1.5 shadow-sm"
                        title="Ingresar al proyecto"
                      >
                        <ArrowRight size={13} />
                        <span>Ingresar</span>
                      </Button>

                      {(() => {
                        const effectiveRole = 
                          currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' 
                            ? currentUser.role 
                            : ((project as any).currentUserRoleInProject || currentUser?.role);
                        return effectiveRole !== 'CLOSER';
                      })() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/projects/${project.id}?view=settings`)}
                          className="text-xs h-8 border-border/70 hover:bg-card hover:text-primary hover:border-primary/40 flex-1 flex items-center justify-center gap-1.5"
                          title="Abrir panel de control y configuración completa"
                        >
                          <Sliders size={13} />
                          <span>Panel</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL CREAR / EDITAR PROYECTO                                  */}
        {/* ------------------------------------------------------------- */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[520px] bg-[#0E1118] border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <FolderKanban className="text-primary" size={20} />
                {modalMode === 'create' ? 'Crear Nuevo Proyecto' : 'Editar Proyecto'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configura los datos del infoproducto, director responsable y objetivos comerciales.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <Alert variant="destructive" className="py-2 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200">
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSaveProject} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-name" className="text-xs text-muted-foreground font-medium">
                    Nombre del Proyecto <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="proj-name"
                    value={formName}
                    onChange={handleNameChange}
                    placeholder="Ej. Master Closer Academy"
                    className="bg-[#0B0D13] border-border text-xs h-9"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="proj-slug" className="text-xs text-muted-foreground font-medium">
                    Slug Identificador <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="proj-slug"
                    value={formSlug}
                    onChange={handleSlugChange}
                    placeholder="master-closer-academy"
                    className="bg-[#0B0D13] border-border text-xs h-9 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-desc" className="text-xs text-muted-foreground font-medium">
                  Descripción Operativa
                </Label>
                <Input
                  id="proj-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalles sobre el infoproducto, público objetivo o formato de venta"
                  className="bg-[#0B0D13] border-border text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-status" className="text-xs text-muted-foreground font-medium">
                    Estado Operativo
                  </Label>
                  <Select
                    value={formStatus}
                    onValueChange={(val: any) => setFormStatus(val)}
                  >
                    <SelectTrigger id="proj-status" className="bg-[#0B0D13] border-border text-xs h-9 w-full">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Activo (En operación)</SelectItem>
                      <SelectItem value="DRAFT">Borrador (Configuración)</SelectItem>
                      <SelectItem value="PAUSED">En Pausa (Suspendido)</SelectItem>
                      <SelectItem value="ARCHIVED">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-currency" className="text-xs text-muted-foreground font-medium">
                  Moneda Principal del Proyecto
                </Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger id="proj-currency" className="bg-[#0B0D13] border-border text-xs h-9 w-full">
                    <SelectValue placeholder="Seleccionar moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($ - Dólares)</SelectItem>
                    <SelectItem value="EUR">EUR (€ - Euros)</SelectItem>
                    <SelectItem value="MXN">MXN ($ - Pesos Mexicanos)</SelectItem>
                    <SelectItem value="COP">COP ($ - Pesos Colombianos)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Las metas comerciales y porcentajes de comisiones se configuran detalladamente en el panel de control del proyecto.
                </p>
              </div>

              <DialogFooter className="pt-3 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs h-9 border-border hover:bg-card"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="bg-primary text-brand-dark hover:bg-primary/90 font-bold text-xs h-9 px-4"
                >
                  {isSaving ? 'Guardando...' : modalMode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ------------------------------------------------------------- */}
        {/* MODAL GESTOR DE CATÁLOGO DE PRODUCTOS (Fase 2.3)              */}
        {/* ------------------------------------------------------------- */}
        <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
          <DialogContent className="sm:max-w-[650px] flex flex-col bg-[#0E1118] border-border text-foreground overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Package className="text-primary" size={20} />
                <span>Catálogo de Productos</span>
                {catalogProject && (
                  <span className="text-xs font-normal text-muted-foreground font-mono">
                    ({catalogProject.name})
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configura los tickets, cursos o membresías válidos que comercializan los closers para este infoproducto.
              </DialogDescription>
            </DialogHeader>

            {catalogError && (
              <Alert variant="destructive" className="py-2 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200 flex-shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                <AlertDescription>{catalogError}</AlertDescription>
              </Alert>
            )}

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
              {/* TABLA DE PRODUCTOS ACTUALES */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground tracking-wide uppercase">
                    Productos Registrados ({catalogProducts.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Moneda base: {catalogProject?.goalsConfig?.currency || 'USD'}
                  </span>
                </div>

                {isLoadingCatalog ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full bg-card" />
                    <Skeleton className="h-10 w-full bg-card" />
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border/60 rounded-xl bg-card/20">
                    <Package size={24} className="mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Este proyecto no tiene productos registrados en su catálogo todavía.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 overflow-hidden bg-[#0B0D13]">
                    <Table>
                      <TableHeader className="bg-card/60">
                        <TableRow className="border-border/60">
                          <TableHead className="text-[11px] text-muted-foreground font-bold">Producto</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold">Cód. Oferta</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold text-right">Precio</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold text-center">Cuotas</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold text-center">Propietario / Label</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold text-center">Estado</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catalogProducts.map((prod) => (
                          <TableRow key={prod.id} className="border-border/40 hover:bg-card/30">
                            <TableCell className="font-semibold text-[11px] text-foreground py-2">
                              {prod.name}
                            </TableCell>
                            <TableCell className="text-[10px] font-mono text-muted-foreground py-2">
                              {prod.offerCode ? (
                                <span className="px-1 py-0.5 rounded bg-card border border-border/40">
                                  {prod.offerCode}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-[11px] font-mono font-bold text-right py-2 text-primary">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: prod.currency || 'USD',
                              }).format(prod.price)}
                            </TableCell>
                            <TableCell className="text-[11px] font-mono text-center py-2 text-muted-foreground">
                              {prod.installments || 1}
                            </TableCell>
                            <TableCell className="text-[10px] text-center py-2 text-muted-foreground">
                              {prod.ownerCloserId ? (
                                <span className="flex items-center justify-center gap-1">
                                  <UserCheck size={10} className="text-blue-400" />
                                  {teamMembers.find((m) => m.userId === prod.ownerCloserId)?.userName || `Closer (${prod.ownerCloserId.substring(0,4)})`}
                                </span>
                              ) : prod.externalLabel ? (
                                <span className="flex items-center justify-center gap-1">
                                  <Tag size={10} className="text-purple-400" />
                                  {prod.externalLabel}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <button
                                type="button"
                                onClick={() => handleToggleProductActive(prod)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                  prod.active
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                                }`}
                                title="Clic para alternar estado"
                              >
                                {prod.active ? 'Activo' : 'Inactivo'}
                              </button>
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-950/30 rounded-lg"
                                title="Eliminar producto"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* FORMULARIO: AÑADIR NUEVO PRODUCTO */}
              <div className="p-4 rounded-xl border border-border/80 bg-[#0B0D13] space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Añadir Producto al Catálogo
                  </span>
                </div>

                {productFormError && (
                  <Alert variant="destructive" className="py-1.5 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <AlertDescription>{productFormError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleAddProduct} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-name" className="text-[11px] text-muted-foreground font-medium">
                        Nombre del Ticket / Producto <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="prod-name"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        placeholder="Ej. Entrada General VIP"
                        className="bg-[#0E1118] border-border text-xs h-8"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="prod-offerCode" className="text-[11px] text-muted-foreground font-medium">
                        Código de Oferta
                      </Label>
                      <Input
                        id="prod-offerCode"
                        value={newProdOfferCode}
                        onChange={(e) => setNewProdOfferCode(e.target.value)}
                        placeholder="Ej. OFF-123"
                        className="bg-[#0E1118] border-border text-xs h-8 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <Label htmlFor="prod-price" className="text-[11px] text-muted-foreground font-medium">
                        Precio <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="prod-price"
                        type="number"
                        min="0"
                        step="1"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(Number(e.target.value))}
                        className="bg-[#0E1118] border-border text-xs h-8 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-installments" className="text-[11px] text-muted-foreground font-medium">
                        Cuotas <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="prod-installments"
                        type="number"
                        min="1"
                        max="360"
                        step="1"
                        value={newProdInstallments}
                        onChange={(e) => setNewProdInstallments(Math.max(1, Number(e.target.value)))}
                        className="bg-[#0E1118] border-border text-xs h-8 font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="prod-sku" className="text-[11px] text-muted-foreground font-medium">
                        SKU / Código (Opcional)
                      </Label>
                      <Input
                        id="prod-sku"
                        value={newProdSku}
                        onChange={(e) => setNewProdSku(e.target.value)}
                        placeholder="TKT-VIP-2026"
                        className="bg-[#0E1118] border-border text-xs h-8 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-medium">Closer Propietario (Opcional)</Label>
                      <Select value={newProdOwnerCloserId || 'none'} onValueChange={(val) => setNewProdOwnerCloserId(val === 'none' ? '' : val)}>
                        <SelectTrigger className="bg-[#0E1118] border-border text-xs h-8">
                          <SelectValue placeholder="-- Sin asignar --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Sin asignar --</SelectItem>
                          {activeTeamClosers.map((m) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.userName || m.userId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-medium">Label Externo (Opcional)</Label>
                      <Input
                        placeholder="Ej. Productor Secundario"
                        value={newProdExternalLabel}
                        onChange={(e) => setNewProdExternalLabel(e.target.value)}
                        className="bg-[#0E1118] border-border text-xs h-8"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isAddingProduct}
                      className="bg-primary text-brand-dark hover:bg-primary/90 font-bold text-xs h-8 w-full flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>{isAddingProduct ? 'Agregando...' : 'Agregar Producto'}</span>
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <DialogFooter className="pt-2 flex-shrink-0 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCatalogOpen(false)}
                className="text-xs h-8 border-border hover:bg-card"
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ------------------------------------------------------------- */}
        {/* MODAL EQUIPO COMERCIAL (Fase 2.4)                             */}
        {/* ------------------------------------------------------------- */}
        <Dialog open={isTeamOpen} onOpenChange={setIsTeamOpen}>
          <DialogContent className="sm:max-w-[720px] flex flex-col bg-[#0E1118] border-border text-foreground">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Users size={16} />
                </div>
                <span>Equipo Comercial Asignado</span>
                {teamProject && (
                  <span className="text-xs font-mono font-normal text-muted-foreground ml-1">
                    ({teamProject.name})
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Asigna closers, directores y clientes a este proyecto para habilitar su operación en pipeline y métricas.
              </DialogDescription>
            </DialogHeader>

            {teamError && (
              <Alert variant="destructive" className="py-2 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200 flex-shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{teamError}</span>
                  {teamProject && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadTeamMembers(teamProject.id)}
                      className="h-6 text-[11px] hover:bg-red-900/30 text-red-300"
                    >
                      <RotateCw size={11} className="mr-1" /> Reintentar
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
              {/* TABLA DE MIEMBROS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground tracking-wide uppercase">
                    Miembros Vinculados ({teamMembers.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Aislamiento RLS activo por rol
                  </span>
                </div>

                {isLoadingTeam ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full bg-card" />
                    <Skeleton className="h-10 w-full bg-card" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border/60 rounded-xl bg-card/20">
                    <UserCheck size={24} className="mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No hay miembros asignados a este proyecto todavía.
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Usa el formulario inferior para incorporar closers o directores.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 overflow-hidden bg-[#0B0D13]">
                    <Table>
                      <TableHeader className="bg-card/60">
                        <TableRow className="border-border/60">
                          <TableHead className="text-[11px] text-muted-foreground font-bold">Miembro</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold">Contacto</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold">Rol en Proyecto</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold">Fecha Asignación</TableHead>
                          <TableHead className="text-[11px] text-muted-foreground font-bold text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((mem) => (
                          <TableRow key={mem.id} className="border-border/40 hover:bg-card/30">
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border text-[11px] font-bold text-primary">
                                  {mem.userName ? mem.userName.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-xs font-semibold text-foreground truncate">
                                    {mem.userName || 'Usuario sin nombre'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {mem.userEmail || mem.userId}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-[11px] font-mono text-muted-foreground">
                              {mem.userPhone ? (
                                <div className="flex items-center gap-1 text-emerald-400">
                                  <Phone size={11} />
                                  <span>{mem.userPhone}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Select 
                                value={mem.roleInProject} 
                                onValueChange={(val: any) => handleUpdateMemberRole(mem.userId, val)}
                              >
                                <SelectTrigger className="h-7 text-[11px] font-semibold bg-[#0E1118] border-border/60 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CLOSER">Closer (Ventas)</SelectItem>
                                  <SelectItem value="DIRECTOR">Director Comercial</SelectItem>
                                  <SelectItem value="CLIENTE">Cliente (Dashboard)</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-2.5 text-[11px] font-mono text-muted-foreground">
                              {new Date(mem.assignedAt).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(mem.userId, mem.userName || '')}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-950/30 rounded-lg"
                                title="Desvincular miembro del proyecto"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* FORMULARIO: VINCULAR NUEVO MIEMBRO */}
              <div className="p-4 rounded-xl border border-border/80 bg-[#0B0D13] space-y-3">
                <div className="flex items-center gap-1.5">
                  <UserPlus size={14} className="text-blue-400" />
                  <span className="text-xs font-bold text-foreground">
                    Vincular Usuario al Equipo del Proyecto
                  </span>
                </div>

                {memberFormError && (
                  <Alert variant="destructive" className="py-1.5 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <AlertDescription>{memberFormError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleAssignMember} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="assign-user" className="text-[11px] text-muted-foreground font-medium">
                        Seleccionar Usuario Registrado <span className="text-primary">*</span>
                      </Label>
                      <Select
                        value={selectedUserIdToAssign}
                        onValueChange={setSelectedUserIdToAssign}
                      >
                        <SelectTrigger id="assign-user" className="bg-[#0E1118] border-border text-xs h-8 w-full">
                          <SelectValue placeholder="-- Seleccionar usuario disponible --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- Seleccionar usuario disponible --</SelectItem>
                          {availableUsersToAssign.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName} ({user.email}) [{user.role}]
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {availableUsersToAssign.length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">
                          Todos los usuarios registrados ya forman parte del equipo.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="assign-role" className="text-[11px] text-muted-foreground font-medium">
                        Rol Dentro del Proyecto <span className="text-primary">*</span>
                      </Label>
                      <Select
                        value={selectedRoleInProject}
                        onValueChange={(val: any) => setSelectedRoleInProject(val)}
                      >
                        <SelectTrigger id="assign-role" className="bg-[#0E1118] border-border text-xs h-8 w-full">
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLOSER">Closer (Cierre y Llamadas)</SelectItem>
                          <SelectItem value="DIRECTOR">Director (Supervisión de Unidad)</SelectItem>
                          <SelectItem value="CLIENTE">Cliente (Solo Dashboard)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isAssigningMember || !selectedUserIdToAssign}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 w-full flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <UserPlus size={14} />
                    <span>{isAssigningMember ? 'Vinculando...' : 'Vincular al Proyecto'}</span>
                  </Button>
                </form>
              </div>
            </div>

            <DialogFooter className="pt-2 flex-shrink-0 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTeamOpen(false)}
                className="text-xs h-8 border-border hover:bg-card"
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}

