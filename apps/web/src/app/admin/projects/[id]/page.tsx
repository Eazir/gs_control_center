'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Target,
  Percent,
  Package,
  Users,
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Save,
  TrendingUp,
  Phone,
  UserPlus,
  Kanban,
  Database,
  BarChart3,
  Sliders,
  Radio,
  Search,
  Filter,
  ExternalLink,
  ShieldAlert,
  Copy,
  Check,
  Calendar,
  DollarSign,
  Clock,
  Sparkles,
  Lock,
  ChevronRight,
  UserCheck,
  Layers,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  ProjectSummary,
  ProductItem,
  CommissionTier,
  CommissionConfig,
  CommissionGroup,
  GoalsConfig,
} from '@gs/contracts';

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

interface PipelineStageConfig {
  id: string;
  name: string;
  probability: number;
  color: string;
}

interface ProjectLead {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  stageId: string;
  closerName: string;
  closerId?: string;
  productName: string;
  estimatedValue: number;
  source: string;
  createdAt: string;
}

const DEFAULT_STAGES: PipelineStageConfig[] = [
  { id: 'qual', name: 'Prospecto Cualificado', probability: 10, color: '#3B82F6' },
  { id: 'sched', name: 'Llamada Agendada', probability: 35, color: '#F59E0B' },
  { id: 'offer', name: 'Oferta Realizada', probability: 65, color: '#8B5CF6' },
  { id: 'follow', name: 'En Seguimiento', probability: 80, color: '#06B6D4' },
  { id: 'won', name: 'Cierre Ganado', probability: 100, color: '#10B981' },
  { id: 'lost', name: 'No Concretado', probability: 0, color: '#EF4444' },
];

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id;

  // Sesión del usuario activo
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; fullName: string } | null>(null);

  // Estado del Proyecto
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 4 VISTAS PRINCIPALES CANÓNICAS
  const searchParams = useSearchParams();
  const initialView = (searchParams?.get('view') as 'pipeline' | 'leads' | 'metrics' | 'settings') || 'pipeline';
  const [mainView, setMainView] = useState<'pipeline' | 'leads' | 'metrics' | 'settings'>(initialView);

  // SUB-PESTAÑAS DEL PANEL DE CONTROL (5 CONFIGURACIONES)
  const [settingsTab, setSettingsTab] = useState<'team' | 'pipeline_settings' | 'integrations' | 'general' | 'goals'>('team');

  // Usuarios del sistema para asignaciones y equipo
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);

  // Estado para Catálogo de Productos
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdOfferCode, setNewProdOfferCode] = useState('');
  const [newProdOwnerCloserId, setNewProdOwnerCloserId] = useState('');
  const [newProdExternalLabel, setNewProdExternalLabel] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(997);
  const [newProdInstallments, setNewProdInstallments] = useState(1);
  const [newProdCurrency, setNewProdCurrency] = useState('USD');
  const [isAddingProd, setIsAddingProd] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Estado para Equipo
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState('');
  const [isAssigningMember, setIsAssigningMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Estado para Metas y Comisiones
  const [goalsConfigState, setGoalsConfigState] = useState<GoalsConfig>({
    monthlyTargetRevenue: 50000,
    currency: 'USD',
    goals: [],
  });
  const [commissionConfigState, setCommissionConfigState] = useState<CommissionConfig>({
    defaultCloserPercentage: 10,
    defaultDirectorPercentage: 3,
    defaultCompanyPercentage: 82,
    defaultExternalPercentage: 5,
    tiers: [
      { id: 'tier-1', minPercent: 0, closerPercentage: 10, directorPercentage: 3, companyPercentage: 82, externalPercentage: 5 },
      { id: 'tier-2', minPercent: 100, closerPercentage: 12, directorPercentage: 4, companyPercentage: 79, externalPercentage: 5 },
      { id: 'tier-3', minPercent: 120, closerPercentage: 15, directorPercentage: 5, companyPercentage: 75, externalPercentage: 5 },
    ],
    groups: [],
  });

  // Estado para Datos Generales
  const [genName, setGenName] = useState('');
  const [genSlug, setGenSlug] = useState('');
  const [genDesc, setGenDesc] = useState('');
  const [genDirectorId, setGenDirectorId] = useState('');
  const [genStatus, setGenStatus] = useState<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'>('ACTIVE');

  // Estado para Ajustes del Pipeline (Etapas)
  const [pipelineStages, setPipelineStages] = useState<PipelineStageConfig[]>(DEFAULT_STAGES);
  const [newStageName, setNewStageName] = useState('');
  const [newStageProb, setNewStageProb] = useState(50);
  const [newStageColor, setNewStageColor] = useState('#F59E0B');

  // Estado para Integraciones / Webhook
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);
  const [isHotmartModalOpen, setIsHotmartModalOpen] = useState(false);
  const [hotmartSecret, setHotmartSecret] = useState('');
  const [hotmartDateFilter, setHotmartDateFilter] = useState('');
  const [hotmartIgnoreSubsequent, setHotmartIgnoreSubsequent] = useState(true);

  // Feedback de guardado
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // ESTADO DE LEADS (MOCK / DEMO DEL PIPELINE Y BASE DE LEADS)
  const [leads, setLeads] = useState<ProjectLead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [closerFilter, setCloserFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');

  // Modal para crear lead rápido
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCloser, setNewLeadCloser] = useState('');
  const [newLeadProduct, setNewLeadProduct] = useState('');
  const [newLeadValue, setNewLeadValue] = useState(997);
  const [newLeadStage, setNewLeadStage] = useState('qual');

  // Roles y permisos
  const currentUserProjectMember = useMemo(() => {
    if (!currentUser || !members.length) return null;
    return members.find((m) => m.userId === currentUser.id) || null;
  }, [members, currentUser]);

  const effectiveRole = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') {
      return currentUser.role;
    }
    // Si no es admin, la jerarquía en el proyecto la da su rol asignado.
    if (currentUserProjectMember) {
      return currentUserProjectMember.roleInProject;
    }
    return currentUser.role;
  }, [currentUser, currentUserProjectMember]);

  const isDirector = effectiveRole === 'DIRECTOR';
  const isAdminOrSuper = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN';

  useEffect(() => {
    if (effectiveRole === 'CLOSER' && mainView === 'settings') {
      setMainView('pipeline');
    }
  }, [effectiveRole, mainView]);

  // -------------------------------------------------------------
  // CARGA INICIAL
  // -------------------------------------------------------------
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [projRes, meRes] = await Promise.all([
        fetchWithAuth(`/projects/${projectId}`),
        fetchWithAuth('/auth/me').catch(() => null),
      ]);

      if (meRes && meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser({ id: meData.id, role: meData.role, fullName: meData.fullName });
      }

      if (!projRes.ok) {
        throw new Error('No se pudo encontrar el proyecto solicitado.');
      }
      const data: ProjectSummary = await projRes.json();
      setProject(data);
      setProducts(data.products || []);

      // Inicializar metas
      const existingGoals = data.goalsConfig || { monthlyTargetRevenue: 0, currency: 'USD', goals: [] };
      setGoalsConfigState({
        monthlyTargetRevenue: existingGoals.monthlyTargetRevenue || 50000,
        currency: existingGoals.currency || 'USD',
        goals: (existingGoals as GoalsConfig).goals || [],
      });

      // Inicializar comisiones
      const existingComm = (data as unknown as { commissionConfig?: CommissionConfig }).commissionConfig;
      if (existingComm && typeof existingComm === 'object' && 'defaultCloserPercentage' in existingComm) {
        setCommissionConfigState({
          defaultCloserPercentage: existingComm.defaultCloserPercentage ?? 10,
          defaultDirectorPercentage: existingComm.defaultDirectorPercentage ?? 3,
          defaultCompanyPercentage: existingComm.defaultCompanyPercentage ?? 82,
          defaultExternalPercentage: existingComm.defaultExternalPercentage ?? 5,
          tiers: existingComm.tiers || [],
          groups: existingComm.groups || [],
        });
      }

      // Inicializar campos generales
      setGenName(data.name);
      setGenSlug(data.slug);
      setGenDesc(data.description || '');
      setGenDirectorId(data.directorId || '');
      setGenStatus(data.status);
      setNewProdCurrency(data.goalsConfig?.currency || 'USD');

      // Inicializar etapas del pipeline desde settings si existen
      const projectSettings = (data as unknown as { settings?: { pipelineStages?: PipelineStageConfig[] } }).settings;
      if (projectSettings?.pipelineStages && Array.isArray(projectSettings.pipelineStages)) {
        setPipelineStages(projectSettings.pipelineStages);
      }

      // Generar o cargar leads de ejemplo interactivos para este proyecto
      const savedLeadsKey = `gs_leads_${projectId}`;
      const savedLeads = localStorage.getItem(savedLeadsKey);
      if (savedLeads) {
        try {
          setLeads(JSON.parse(savedLeads));
        } catch {
          // Ignorar
        }
      } else {
        const demoLeads: ProjectLead[] = [
          {
            id: 'lead-1',
            fullName: 'Alejandro Morales',
            email: 'alejandro.m@gmail.com',
            phone: '+57 310 445 8892',
            stageId: 'won',
            closerName: 'Carlos Méndez',
            productName: data.products?.[0]?.name || 'Programa Elite High-Ticket',
            estimatedValue: 997,
            source: 'Hotmart Checkout Abandonado',
            createdAt: '2026-09-17T14:30:00Z',
          },
          {
            id: 'lead-2',
            fullName: 'Camila Restrepo',
            email: 'camila.restrepo@hotmail.com',
            phone: '+57 320 671 2341',
            stageId: 'sched',
            closerName: 'Ana Lucía Gómez',
            productName: data.products?.[0]?.name || 'Mastery Mentorship VIP',
            estimatedValue: 1497,
            source: 'Centralize CRM - Formulario Web',
            createdAt: '2026-09-18T10:15:00Z',
          },
          {
            id: 'lead-3',
            fullName: 'Daniel Sandoval',
            email: 'daniel.san@empresa.co',
            phone: '+52 55 4912 3091',
            stageId: 'offer',
            closerName: 'Carlos Méndez',
            productName: data.products?.[0]?.name || 'Programa Elite High-Ticket',
            estimatedValue: 997,
            source: 'GoHighLevel - Lead Magnet',
            createdAt: '2026-09-18T16:45:00Z',
          },
          {
            id: 'lead-4',
            fullName: 'Valentina Pineda',
            email: 'valen.pineda@yahoo.com',
            phone: '+57 301 889 1104',
            stageId: 'qual',
            closerName: 'Por Asignar',
            productName: data.products?.[0]?.name || 'Ticket General $497',
            estimatedValue: 497,
            source: 'Hotmart Webhook',
            createdAt: '2026-09-18T20:00:00Z',
          },
        ];
        setLeads(demoLeads);
        try {
          localStorage.setItem(savedLeadsKey, JSON.stringify(demoLeads));
        } catch {
          // Ignorar
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el proyecto');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Cargar equipo y usuarios registrados
  const loadMembersAndUsers = useCallback(async () => {
    if (!projectId) return;
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetchWithAuth(`/projects/${projectId}/members`),
        fetchWithAuth('/auth/users'),
      ]);

      if (membersRes.ok) {
        const memData = await membersRes.json();
        setMembers(Array.isArray(memData) ? memData : memData.members || []);
      }

      if (usersRes.ok) {
        const uData = await usersRes.json();
        const rawUsers: AppUser[] = uData.users || [];
        // Filtrar SUPER_ADMIN para que no aparezca en opciones de selección
        setAllUsers(rawUsers.filter((u) => u.role !== 'SUPER_ADMIN'));
      }
    } catch {
      // Manejo silencioso
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    loadMembersAndUsers();
  }, [loadProject, loadMembersAndUsers]);

  // Guardar leads en localStorage al modificarlos
  const saveLeadsState = (updatedLeads: ProjectLead[]) => {
    setLeads(updatedLeads);
    if (projectId) {
      try {
        localStorage.setItem(`gs_leads_${projectId}`, JSON.stringify(updatedLeads));
      } catch {
        // Ignorar
      }
    }
  };

  // Usuarios disponibles para vincular al equipo (activos, sin SUPER_ADMIN y no ya miembros)
  const availableUsers = useMemo(() => {
    const memberUserIds = new Set(members.map((m) => m.userId));
    return allUsers.filter(
      (u) => u.status === 'ACTIVE' && !memberUserIds.has(u.id) && u.role !== 'SUPER_ADMIN'
    );
  }, [allUsers, members]);

  // Directores elegibles (solo cuentas activas con rol DIRECTOR o ADMIN)
  const eligibleDirectors = useMemo(() => {
    return allUsers.filter(
      (u) => u.status === 'ACTIVE' && (u.role === 'DIRECTOR' || u.role === 'ADMIN')
    );
  }, [allUsers]);

  // Closers del proyecto para filtros y asignaciones
  const closersInProject = useMemo(() => {
    return members.filter((m) => m.roleInProject === 'CLOSER');
  }, [members]);

  // Closers del proyecto con cuenta activa (asignables como propietario de producto).
  // Se cruza con allUsers porque el status de la cuenta no viaja en ProjectMember.
  const activeClosersInProject = useMemo(() => {
    const statusByUserId = new Map(allUsers.map((u) => [u.id, u.status]));
    return closersInProject.filter((m) => statusByUserId.get(m.userId) === 'ACTIVE');
  }, [allUsers, closersInProject]);

  // -------------------------------------------------------------
  // ACCIONES DEL PIPELINE
  // -------------------------------------------------------------
  const handleMoveLeadStage = (leadId: string, targetStageId: string) => {
    const updated = leads.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId } : l));
    saveLeadsState(updated);
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;

    const newLead: ProjectLead = {
      id: `lead-${Date.now()}`,
      fullName: newLeadName.trim(),
      email: newLeadEmail.trim() || 'cliente@prospecto.com',
      phone: newLeadPhone.trim() || '+57 300 000 0000',
      stageId: newLeadStage,
      closerName: newLeadCloser || 'Por Asignar',
      productName: newLeadProduct || products[0]?.name || 'Ticket General',
      estimatedValue: Number(newLeadValue) || 997,
      source: 'Ingreso Manual / Pipeline',
      createdAt: new Date().toISOString(),
    };

    saveLeadsState([newLead, ...leads]);
    setIsNewLeadOpen(false);
    setNewLeadName('');
    setNewLeadEmail('');
    setNewLeadPhone('');
  };

  // -------------------------------------------------------------
  // AJUSTES DEL PIPELINE (GUARDAR ETAPAS)
  // -------------------------------------------------------------
  const handleAddPipelineStage = () => {
    if (!newStageName.trim()) return;
    const stageId = `stage-${Date.now()}`;
    const newStage: PipelineStageConfig = {
      id: stageId,
      name: newStageName.trim(),
      probability: Math.min(100, Math.max(0, Number(newStageProb))),
      color: newStageColor,
    };
    setPipelineStages((prev) => [...prev, newStage]);
    setNewStageName('');
  };

  const handleRemovePipelineStage = (stageId: string) => {
    if (pipelineStages.length <= 2) {
      alert('Debes mantener al menos 2 etapas en el pipeline comercial.');
      return;
    }
    setPipelineStages((prev) => prev.filter((s) => s.id !== stageId));
  };

  const handleSavePipelineSettings = async () => {
    if (!projectId) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await fetchWithAuth(`/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            pipelineStages,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al guardar los ajustes del pipeline.');
      }

      setSaveSuccessMsg('¡Ajustes de etapas del pipeline actualizados correctamente!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // GUARDAR METAS Y COMISIONES (SOLO ADMIN / SUPER_ADMIN)
  // -------------------------------------------------------------
  const handleSaveGoalsAndCommissions = async () => {
    if (!projectId) return;
    if (!isAdminOrSuper) {
      alert('Solo los Administradores de la plataforma pueden modificar las metas financieras.');
      return;
    }

    // Validación estricta de Grupos de Comisión (Fase 3): suma de empresa+director+closer === teamTotal
    for (const group of commissionConfigState.groups) {
      const baseError = getGroupSplitError(group.basePercentages);
      if (baseError) {
        setSaveErrorMsg(`Grupo "${group.name}": ${baseError}`);
        return;
      }
      for (const goal of group.goals) {
        if (goal.tiers && goal.tiers.length > 0) {
          for (const tier of goal.tiers) {
            const tierError = getGroupSplitError(tier.percentages);
            if (tierError) {
              setSaveErrorMsg(`Grupo "${group.name}" → Meta "${goal.name}" (Escalón $${tier.revenueThreshold}): ${tierError}`);
              return;
            }
          }
        }
      }
    }

    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await fetchWithAuth(`/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalsConfig: goalsConfigState,
          commissionConfig: commissionConfigState,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'No se pudo guardar la configuración de metas');
      }

      setSaveSuccessMsg('¡Metas comerciales y comisiones actualizadas con éxito!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      loadProject();
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTier = () => {
    const lastTier = commissionConfigState.tiers[commissionConfigState.tiers.length - 1];
    const nextPercent = lastTier ? lastTier.minPercent + 20 : 100;

    const newTier: CommissionTier = {
      id: `tier-${Date.now()}`,
      minPercent: nextPercent,
      closerPercentage: lastTier ? Math.min(100, lastTier.closerPercentage + 2) : 12,
      directorPercentage: lastTier ? lastTier.directorPercentage : 3,
      companyPercentage: lastTier ? Math.max(0, lastTier.companyPercentage - 2) : 80,
      externalPercentage: 5,
    };

    setCommissionConfigState((prev) => ({
      ...prev,
      tiers: [...prev.tiers, newTier],
    }));
  };

  const handleRemoveTier = (id: string) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((t) => t.id !== id),
    }));
  };

  const handleUpdateTier = (id: string, field: keyof CommissionTier, value: number) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    }));
  };

  // -------------------------------------------------------------
  // GRUPOS DE COMISIÓN (Fase 3)
  // -------------------------------------------------------------
  const handleAddCommissionGroup = () => {
    const newGroup: CommissionGroup = {
      id: `cg-${Date.now()}`,
      name: 'Nuevo Grupo de Comisión',
      productIds: [],
      basePercentages: {
        teamTotal: 90,
        company: 70,
        director: 5,
        closer: 15,
        external: 5,
      },
      goals: [],
      active: true,
    };
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
    }));
  };

  const handleUpdateCommissionGroup = (
    groupId: string,
    field: keyof CommissionGroup,
    value: unknown
  ) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, [field]: value } : g)),
    }));
  };

  const handleRemoveCommissionGroup = (groupId: string) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
    }));
  };

  const handleToggleGroupProduct = (groupId: string, productId: string, checked: boolean) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              productIds: checked
                ? [...new Set([...g.productIds, productId])]
                : g.productIds.filter((pid) => pid !== productId),
            }
          : g
      ),
    }));
  };

  const handleUpdateGroupPercentages = (
    groupId: string,
    field: keyof CommissionGroup['basePercentages'],
    value: number
  ) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, basePercentages: { ...g.basePercentages, [field]: value } }
          : g
      ),
    }));
  };

  const handleAddGroupGoal = (groupId: string) => {
    const group = commissionConfigState.groups.find((g) => g.id === groupId);
    const base = group?.basePercentages ?? {
      teamTotal: 90,
      company: 70,
      director: 5,
      closer: 15,
      external: 5,
    };
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              goals: [
                ...g.goals,
                {
                  id: `goal-${Date.now()}`,
                  name: 'Nueva meta de facturación',
                  targetRevenue: 5000,
                  currency: 'USD',
                  tiers: [
                    {
                      id: `tier-${Date.now()}`,
                      revenueThreshold: 5000,
                      percentages: { ...base },
                    },
                  ],
                  active: true,
                },
              ],
            }
          : g
      ),
    }));
  };

  const handleRemoveGroupGoal = (groupId: string, goalId: string) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, goals: g.goals.filter((gl) => gl.id !== goalId) } : g
      ),
    }));
  };

  const handleUpdateGroupGoal = (
    groupId: string,
    goalId: string,
    field: string,
    value: unknown
  ) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              goals: g.goals.map((gl) =>
                gl.id === goalId ? { ...gl, [field]: value } : gl
              ),
            }
          : g
      ),
    }));
  };

  const handleAddGroupGoalTier = (groupId: string, goalId: string) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          goals: g.goals.map((gl) => {
            if (gl.id !== goalId) return gl;
            const base = gl.tiers.length > 0 ? gl.tiers[gl.tiers.length - 1]!.percentages : g.basePercentages;
            return {
              ...gl,
              tiers: [
                ...gl.tiers,
                {
                  id: `tier-${Date.now()}`,
                  revenueThreshold: gl.targetRevenue + 1000,
                  percentages: { ...base },
                },
              ],
            };
          }),
        };
      }),
    }));
  };

  const handleRemoveGroupGoalTier = (groupId: string, goalId: string, tierId: string) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          goals: g.goals.map((gl) => {
            if (gl.id !== goalId) return gl;
            return { ...gl, tiers: gl.tiers.filter((t) => t.id !== tierId) };
          }),
        };
      }),
    }));
  };

  const handleUpdateGroupGoalTier = (
    groupId: string,
    goalId: string,
    tierId: string,
    field: string,
    value: number
  ) => {
    setCommissionConfigState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          goals: g.goals.map((gl) => {
            if (gl.id !== goalId) return gl;
            return {
              ...gl,
              tiers: gl.tiers.map((t) => {
                if (t.id !== tierId) return t;
                if (field === 'revenueThreshold') {
                  return { ...t, revenueThreshold: value };
                }
                return { ...t, percentages: { ...t.percentages, [field as keyof CommissionGroup['basePercentages']]: value } };
              }),
            };
          }),
        };
      }),
    }));
  };

  /** Validador en vivo: retorna error si la suma del grupo excede/suma mal con teamTotal */
  const getGroupSplitError = (percentages: {
    teamTotal: number;
    company: number;
    director: number;
    closer: number;
  }): string | null => {
    const sum = percentages.company + percentages.director + percentages.closer;
    if (Math.abs(sum - percentages.teamTotal) > 0.0001) {
      return `La suma de empresa (${percentages.company}) + director (${percentages.director}) + closer (${percentages.closer}) = ${sum}% debe ser igual al total del equipo (${percentages.teamTotal}%).`;
    }
    return null;
  };

  /** Productos ya asignados a OTRO grupo (a deshabilitar en los checkboxes) */
  const productsAssignedToOtherGroups = (currentGroupId: string): Set<string> => {
    const assigned = new Set<string>();
    commissionConfigState.groups.forEach((g) => {
      if (g.id === currentGroupId) return;
      g.productIds.forEach((pid) => assigned.add(pid));
    });
    return assigned;
  };

  // -------------------------------------------------------------
  // GESTIÓN DE PRODUCTOS (SOLO ADMIN / SUPER_ADMIN)
  // -------------------------------------------------------------
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !projectId) return;
    if (!isAdminOrSuper) {
      alert('Solo los Administradores de la plataforma pueden agregar productos al catálogo.');
      return;
    }
    
    // Validación: Código de oferta único entre productos activos
    if (newProdOfferCode.trim()) {
      const existingActive = products.find(p => p.active && p.offerCode === newProdOfferCode.trim());
      if (existingActive) {
        setProductFormError(`Debe desactivar el producto existente (${existingActive.name}) antes de crear uno nuevo con el mismo código de oferta.`);
        return;
      }
    }
    setProductFormError(null);
    setIsAddingProd(true);

    try {
      const res = await fetchWithAuth(`/projects/${projectId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProdName.trim(),
          offerCode: newProdOfferCode.trim() || undefined,
          sku: newProdSku.trim() || undefined,
          price: Number(newProdPrice),
          installments: Number(newProdInstallments) || 1,
          currency: newProdCurrency.toUpperCase(),
          ownerCloserId: newProdOwnerCloserId || undefined,
          externalLabel: newProdExternalLabel.trim() || undefined,
          active: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al agregar el producto al catálogo');
      }

      const added = await res.json();
      setProducts((prev) => [...prev, added]);
      setNewProdName('');
      setNewProdSku('');
      setNewProdOfferCode('');
      setNewProdOwnerCloserId('');
      setNewProdExternalLabel('');
      setNewProdInstallments(1);
      setIsProductModalOpen(false); // Cerrar modal al guardar exitosamente
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsAddingProd(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!isAdminOrSuper) {
      alert('Solo los Administradores de la plataforma pueden eliminar productos.');
      return;
    }
    if (!confirm('¿Deseas eliminar este producto del catálogo?')) return;
    try {
      const res = await fetchWithAuth(`/projects/${projectId}/products/${productId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    } catch {
      alert('No se pudo eliminar el producto');
    }
  };

  const handleToggleProductActive = async (product: ProductItem) => {
    if (!isAdminOrSuper) return;
    try {
      const res = await fetchWithAuth(`/projects/${projectId}/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, active: !product.active } : p))
        );
      }
    } catch {
      alert('Error al cambiar el estado del producto');
    }
  };

  // -------------------------------------------------------------
  // GESTIÓN DE EQUIPO (SUPER ADMIN, ADMIN Y DIRECTOR)
  // -------------------------------------------------------------
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserIdToAssign || !projectId) return;
    setIsAssigningMember(true);
    setMemberError(null);

    try {
      const res = await fetchWithAuth(`/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserIdToAssign,
          // roleInProject es inferido automáticamente por el backend a partir del rol de cuenta
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al vincular el miembro');
      }

      const newMember = await res.json();
      setMembers((prev) => [...prev, newMember]);
      setSelectedUserIdToAssign('');
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Error al asignar miembro');
    } finally {
      setIsAssigningMember(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`¿Confirmas la desvinculación de ${name}?`)) return;
    try {
      const res = await fetchWithAuth(`/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    } catch {
      alert('Error al desvincular al miembro');
    }
  };

  // -------------------------------------------------------------
  // GUARDAR DATOS GENERALES (SOLO ADMIN / SUPER_ADMIN)
  // -------------------------------------------------------------
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (!isAdminOrSuper) {
      alert('Solo los Administradores pueden modificar los datos estructurales del proyecto.');
      return;
    }
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await fetchWithAuth(`/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: genName.trim(),
          slug: genSlug.trim(),
          description: genDesc.trim() || null,
          status: genStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al actualizar el proyecto');
      }

      setSaveSuccessMsg('Datos generales del proyecto actualizados.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      loadProject();
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSaving(false);
    }
  };

  // Copiar URL de webhook e id
  const copyWebhookUrl = () => {
    const url = `https://api.growthshell.com/webhooks/v1/inbound/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2500);
  };

  const copyWebhookSecret = () => {
    const secret = `gs_sec_${projectId?.substring(0, 12)}_live`;
    navigator.clipboard.writeText(secret);
    setCopiedWebhookSecret(true);
    setTimeout(() => setCopiedWebhookSecret(false), 2500);
  };

  // -------------------------------------------------------------
  // FILTRADO DE LEADS (PARA BASE DE LEADS Y PIPELINE)
  // -------------------------------------------------------------
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        leadSearch === '' ||
        l.fullName.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.phone.includes(leadSearch) ||
        l.productName.toLowerCase().includes(leadSearch.toLowerCase());

      const matchCloser = closerFilter === 'ALL' || l.closerName === closerFilter;
      const matchStage = stageFilter === 'ALL' || l.stageId === stageFilter;

      return matchSearch && matchCloser && matchStage;
    });
  }, [leads, leadSearch, closerFilter, stageFilter]);

  // Cálculos de métricas del proyecto
  const metricsCalc = useMemo(() => {
    const totalWon = leads
      .filter((l) => l.stageId === 'won')
      .reduce((sum, l) => sum + l.estimatedValue, 0);

    const targetRevenue = goalsConfigState.monthlyTargetRevenue || 50000;
    const progressPercent = targetRevenue > 0 ? Math.min(100, Math.round((totalWon / targetRevenue) * 100)) : 0;
    const wonCount = leads.filter((l) => l.stageId === 'won').length;
    const closedCount = leads.filter((l) => l.stageId === 'won' || l.stageId === 'lost').length;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : wonCount > 0 ? 100 : 0;
    const averageTicket = wonCount > 0 ? Math.round(totalWon / wonCount) : 997;

    // Desglose por Closer
    const closersStatsMap = new Map<string, { calls: number; won: number; revenue: number }>();
    leads.forEach((l) => {
      const cName = l.closerName || 'Por Asignar';
      const current = closersStatsMap.get(cName) || { calls: 0, won: 0, revenue: 0 };
      current.calls += 1;
      if (l.stageId === 'won') {
        current.won += 1;
        current.revenue += l.estimatedValue;
      }
      closersStatsMap.set(cName, current);
    });

    const closersRanking = Array.from(closersStatsMap.entries()).map(([closerName, data]) => ({
      closerName,
      calls: data.calls,
      won: data.won,
      revenue: data.revenue,
      conversionRate: data.calls > 0 ? Math.round((data.won / data.calls) * 100) : 0,
      commission: Math.round(data.revenue * ((commissionConfigState.defaultCloserPercentage || 10) / 100)),
    }));

    return {
      totalWon,
      targetRevenue,
      progressPercent,
      wonCount,
      conversionRate,
      averageTicket,
      closersRanking,
    };
  }, [leads, goalsConfigState.monthlyTargetRevenue, commissionConfigState.defaultCloserPercentage]);

  // RENDER: CARGA Y ERROR
  if (isLoading) {
    return (
      <AdminShell title="Cargando Proyecto...">
        <div className="space-y-6 max-w-6xl mx-auto py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AdminShell>
    );
  }

  if (error || !project) {
    return (
      <AdminShell title="Error">
        <div className="max-w-2xl mx-auto py-12 space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>No se pudo abrir el proyecto</AlertTitle>
            <AlertDescription>{error || 'El proyecto no existe o fue eliminado.'}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => router.push(effectiveRole === 'CLOSER' ? '/closer/projects' : '/admin/projects')}>
            <ArrowLeft size={14} className="mr-2" />
            Volver a la lista de proyectos
          </Button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`Proyecto: ${project.name}`}>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* CABECERA CON NAVEGACIÓN Y MONOGRAMA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3.5">
            <Link
              href={effectiveRole === 'CLOSER' ? '/closer/projects' : '/admin/projects'}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              title="Volver a Proyectos"
            >
              <ArrowLeft size={16} />
            </Link>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 border border-primary/40 text-primary font-bold text-sm tracking-wider">
              {project.name.substring(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {project.name}
                </h1>
                <Badge
                  variant={
                    project.status === 'ACTIVE'
                      ? 'success'
                      : project.status === 'PAUSED'
                      ? 'warning'
                      : 'secondary'
                  }
                  className="text-[10px] px-2 py-0.5"
                >
                  {project.status}
                </Badge>
                {isDirector && (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <UserCheck size={10} className="mr-1" />
                    Director Asignado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                /{project.slug}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(effectiveRole === 'CLOSER' ? '/closer/projects' : '/admin/projects')}
              className="text-xs h-9 border-border"
            >
              Lista de Proyectos
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={() => setIsNewLeadOpen(true)}
              className="text-xs h-9 font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              <span>Nuevo Lead</span>
            </Button>
          </div>
        </div>

        {/* MENSAJES DE ALERTA DE GUARDADO */}
        {saveSuccessMsg && (
          <Alert variant="success" className="animate-in fade-in-50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Operación Exitosa</AlertTitle>
            <AlertDescription>{saveSuccessMsg}</AlertDescription>
          </Alert>
        )}
        {saveErrorMsg && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acción Restringida o Error</AlertTitle>
            <AlertDescription>{saveErrorMsg}</AlertDescription>
          </Alert>
        )}

        {/* ------------------------------------------------------------- */}
        {/* NAVEGACIÓN PRINCIPAL: LAS 4 VISTAS CANÓNICAS DEL PROYECTO     */}
        {/* (SUPER ADMIN, ADMIN Y DIRECTOR TIENEN ACCESO A LAS MISMAS 4)  */}
        {/* ------------------------------------------------------------- */}
        <div className="flex border-b border-border/80 gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setMainView('pipeline')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              mainView === 'pipeline'
                ? 'border-primary text-primary shadow-[0_4px_12px_rgba(245,158,11,0.15)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Kanban size={15} />
            <span>Pipeline</span>
            <Badge variant="gold" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {leads.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setMainView('leads')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              mainView === 'leads'
                ? 'border-primary text-primary shadow-[0_4px_12px_rgba(245,158,11,0.15)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database size={15} />
            <span>Base de Leads</span>
          </button>

          <button
            type="button"
            onClick={() => setMainView('metrics')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              mainView === 'metrics'
                ? 'border-primary text-primary shadow-[0_4px_12px_rgba(245,158,11,0.15)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 size={15} />
            <span>Métricas</span>
          </button>

          {effectiveRole !== 'CLOSER' && (
            <button
              type="button"
              onClick={() => setMainView('settings')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                mainView === 'settings'
                  ? 'border-primary text-primary shadow-[0_4px_12px_rgba(245,158,11,0.15)]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sliders size={15} />
              <span>Panel de Control</span>
            </button>
          )}
        </div>

        {/* ============================================================= */}
        {/* VISTA 1: PIPELINE (KANBAN DE ETAPAS Y PROSPECTOS)             */}
        {/* ============================================================= */}
        {mainView === 'pipeline' && (
          <div className="space-y-4 animate-in fade-in-50">
            {/* Filtro rápido por closer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-xl border border-border/60">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Filtrar por Closer Asignado:</span>
                <Select value={closerFilter} onValueChange={setCloserFilter}>
                  <SelectTrigger className="bg-[#0B0D13] text-xs h-8 w-44">
                    <SelectValue placeholder="Todos los Closers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los Closers</SelectItem>
                    <SelectItem value="Por Asignar">Sin Asignar</SelectItem>
                    {closersInProject.map((c) => (
                      <SelectItem key={c.id} value={c.userName || c.userEmail || c.userId}>
                        {c.userName || c.userEmail}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Total Leads: <strong className="text-foreground">{filteredLeads.length}</strong></span>
                <span>•</span>
                <span>Facturación Ganada: <strong className="text-emerald-400 font-mono">${metricsCalc.totalWon.toLocaleString()} USD</strong></span>
              </div>
            </div>

            {/* TABLERO KANBAN DE ETAPAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start overflow-x-auto pb-4">
              {pipelineStages.map((stage) => {
                const stageLeads = filteredLeads.filter((l) => l.stageId === stage.id);
                const stageTotalVal = stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0);

                return (
                  <div
                    key={stage.id}
                    className="flex flex-col rounded-xl border border-border/80 bg-[#0B0D13] overflow-hidden min-w-[220px]"
                  >
                    {/* Cabecera de la etapa */}
                    <div
                      className="p-3 border-b border-border/60"
                      style={{ borderTop: `3px solid ${stage.color}` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground truncate">{stage.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          {stageLeads.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                        <span>{stage.probability}% prob.</span>
                        <span className="text-primary font-bold">${stageTotalVal.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Lista de tarjetas en la etapa */}
                    <div className="p-2 space-y-2.5 min-h-[300px] max-h-[550px] overflow-y-auto">
                      {stageLeads.length === 0 ? (
                        <div className="text-center py-8 text-[11px] text-muted-foreground/60">
                          Sin prospectos
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="p-3 rounded-lg border border-border/70 bg-card/40 hover:border-primary/40 transition-all space-y-2 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-xs text-foreground leading-tight">
                                {lead.fullName}
                              </span>
                              <span className="font-mono text-[11px] text-primary font-bold">
                                ${lead.estimatedValue}
                              </span>
                            </div>

                            <p className="text-[10px] text-muted-foreground truncate">
                              {lead.productName}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                              <span className="text-muted-foreground truncate max-w-[100px]">
                                {lead.closerName}
                              </span>
                              <Select value={lead.stageId} onValueChange={(val: string) => handleMoveLeadStage(lead.id, val)}>
                                <SelectTrigger className="h-6 text-[10px] bg-[#0E1118] border-border/60 px-1 py-0 w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {pipelineStages.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* VISTA 2: BASE DE LEADS (TABLA / HOJA DE CÁLCULO)              */}
        {/* ============================================================= */}
        {mainView === 'leads' && (
          <div className="space-y-4 animate-in fade-in-50">
            {/* Toolbar de búsqueda y filtros */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card/40 p-3 rounded-xl border border-border/60">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="pl-9 bg-[#0B0D13] border-border text-xs h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="bg-[#0B0D13] text-xs h-9 w-40">
                    <SelectValue placeholder="Todas las Etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las Etapas</SelectItem>
                    {pipelineStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={closerFilter} onValueChange={setCloserFilter}>
                  <SelectTrigger className="bg-[#0B0D13] text-xs h-9 w-40">
                    <SelectValue placeholder="Todos los Closers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los Closers</SelectItem>
                    <SelectItem value="Por Asignar">Por Asignar</SelectItem>
                    {closersInProject.map((c) => (
                      <SelectItem key={c.id} value={c.userName || c.userEmail || c.userId}>
                        {c.userName || c.userEmail}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => setIsNewLeadOpen(true)}
                  className="text-xs h-9 font-bold"
                >
                  <Plus size={13} className="mr-1" />
                  Agregar Lead
                </Button>
              </div>
            </div>

            {/* TABLA DE LEADS */}
            <div className="rounded-xl border border-border overflow-hidden bg-[#0B0D13]">
              <Table>
                <TableHeader className="bg-card/60">
                  <TableRow className="border-border/60">
                    <TableHead className="text-[11px] font-bold">Prospecto</TableHead>
                    <TableHead className="text-[11px] font-bold">WhatsApp / Teléfono</TableHead>
                    <TableHead className="text-[11px] font-bold">Etapa</TableHead>
                    <TableHead className="text-[11px] font-bold">Closer Asignado</TableHead>
                    <TableHead className="text-[11px] font-bold">Ticket de Interés</TableHead>
                    <TableHead className="text-[11px] font-bold text-right">Valor Estimado</TableHead>
                    <TableHead className="text-[11px] font-bold text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                        No se encontraron prospectos con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => {
                      const stageObj = pipelineStages.find((s) => s.id === lead.stageId);
                      const cleanPhone = lead.phone.replace(/[^0-9]/g, '');

                      return (
                        <TableRow key={lead.id} className="border-border/40">
                          <TableCell className="py-2.5">
                            <div>
                              <span className="font-bold text-xs text-foreground block">{lead.fullName}</span>
                              <span className="text-[10px] text-muted-foreground block">{lead.email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 hover:underline bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20"
                            >
                              <Phone size={10} />
                              {lead.phone}
                            </a>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold"
                              style={{
                                borderColor: stageObj?.color || '#F59E0B',
                                color: stageObj?.color || '#F59E0B',
                              }}
                            >
                              {stageObj?.name || lead.stageId}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-foreground py-2.5">
                            {lead.closerName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2.5">
                            {lead.productName}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-primary py-2.5">
                            ${lead.estimatedValue} USD
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <Select value={lead.stageId} onValueChange={(val: string) => handleMoveLeadStage(lead.id, val)}>
                              <SelectTrigger className="h-7 text-[10px] bg-[#0E1118] border-border/60">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {pipelineStages.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* VISTA 3: MÉTRICAS (DASHBOARD DE VENTAS Y KPIS)                */}
        {/* ============================================================= */}
        {mainView === 'metrics' && (
          <div className="space-y-6 animate-in fade-in-50">
            {/* Ribbon de métricas clave */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <Card className="p-4 bg-[#0B0D13] border-border space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <DollarSign size={13} className="text-emerald-400" />
                  Facturación Ganada
                </span>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  ${metricsCalc.totalWon.toLocaleString()} USD
                </div>
                <span className="text-[10px] text-muted-foreground">Ventas cerradas en pipeline</span>
              </Card>

              <Card className="p-4 bg-[#0B0D13] border-border space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Target size={13} className="text-primary" />
                  Meta Mensual ({metricsCalc.progressPercent}%)
                </span>
                <div className="text-xl font-bold font-mono text-foreground">
                  ${metricsCalc.targetRevenue.toLocaleString()} USD
                </div>
                <div className="w-full bg-card rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${metricsCalc.progressPercent}%` }}
                  />
                </div>
              </Card>

              <Card className="p-4 bg-[#0B0D13] border-border space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp size={13} className="text-blue-400" />
                  Tasa de Cierre
                </span>
                <div className="text-xl font-bold font-mono text-blue-400">
                  {metricsCalc.conversionRate}%
                </div>
                <span className="text-[10px] text-muted-foreground">{metricsCalc.wonCount} cierres confirmados</span>
              </Card>

              <Card className="p-4 bg-[#0B0D13] border-border space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Package size={13} className="text-purple-400" />
                  Ticket Promedio
                </span>
                <div className="text-xl font-bold font-mono text-purple-400">
                  ${metricsCalc.averageTicket.toLocaleString()} USD
                </div>
                <span className="text-[10px] text-muted-foreground">Por venta cerrada</span>
              </Card>
            </div>

            {/* TABLA: RANKING DE RENDIMIENTO DE CLOSERS */}
            <Card className="bg-[#0B0D13] border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    Ranking de Rendimiento de Closers del Proyecto
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rendimiento individual, facturación generada y comisión devengada.
                  </p>
                </div>
                <Badge variant="gold" className="text-xs">
                  Comisión Base: {commissionConfigState.defaultCloserPercentage}%
                </Badge>
              </div>

              <div className="rounded-xl border border-border overflow-hidden bg-card/20">
                <Table>
                  <TableHeader className="bg-card/60">
                    <TableRow className="border-border/60">
                      <TableHead className="text-[11px] font-bold">Closer</TableHead>
                      <TableHead className="text-[11px] font-bold text-center">Leads Asignados</TableHead>
                      <TableHead className="text-[11px] font-bold text-center">Ventas Cerradas</TableHead>
                      <TableHead className="text-[11px] font-bold text-center">Tasa Conversión</TableHead>
                      <TableHead className="text-[11px] font-bold text-right">Facturación Generada</TableHead>
                      <TableHead className="text-[11px] font-bold text-right">Comisión Estimada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricsCalc.closersRanking.map((closer, idx) => (
                      <TableRow key={idx} className="border-border/40">
                        <TableCell className="font-bold text-xs text-foreground py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px]">
                              {idx + 1}
                            </span>
                            {closer.closerName}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-3">{closer.calls}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-emerald-400 text-xs py-3">
                          {closer.won}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-3">
                          {closer.conversionRate}%
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-foreground py-3">
                          ${closer.revenue.toLocaleString()} USD
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-primary py-3">
                          ${closer.commission.toLocaleString()} USD
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {/* ============================================================= */}
        {/* VISTA 4: PANEL DE CONTROL (5 CONFIGURACIONES DEL PROYECTO)    */}
        {/* ============================================================= */}
        {mainView === 'settings' && effectiveRole !== 'CLOSER' && (
          <div className="space-y-6 animate-in fade-in-50">
            {/* SUB-PESTAÑAS DE CONFIGURACIÓN */}
            <div className="flex border-b border-border/80 gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSettingsTab('team')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                  settingsTab === 'team'
                    ? 'bg-primary text-brand-dark shadow-sm'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                <Users size={14} />
                <span>1. Equipo del Proyecto ({members.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('pipeline_settings')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                  settingsTab === 'pipeline_settings'
                    ? 'bg-primary text-brand-dark shadow-sm'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                <Kanban size={14} />
                <span>2. Ajustes del Pipeline</span>
              </button>

              {!isDirector && (
                <>
                  <button
                    type="button"
                    onClick={() => setSettingsTab('integrations')}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                      settingsTab === 'integrations'
                        ? 'bg-primary text-brand-dark shadow-sm'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    <Radio size={14} />
                    <span>3. Integraciones & Webhooks</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsTab('general')}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                      settingsTab === 'general'
                        ? 'bg-primary text-brand-dark shadow-sm'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    <Settings size={14} />
                    <span>4. Datos del Proyecto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsTab('goals')}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                      settingsTab === 'goals'
                        ? 'bg-primary text-brand-dark shadow-sm'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    <Target size={14} />
                    <span>5. Metas & Comisiones</span>
                  </button>
                </>
              )}
            </div>

            {/* --------------------------------------------------------- */}
            {/* SUB-PANEL 1: EQUIPO DEL PROYECTO (EDITABLE POR TODOS)     */}
            {/* --------------------------------------------------------- */}
            {settingsTab === 'team' && (
              <Card className="bg-[#0B0D13] border-border p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users size={16} className="text-blue-400" />
                    Equipo Comercial Asignado al Proyecto
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tanto Administradores como Directores pueden asignar y desvincular miembros comerciales.
                  </p>
                </div>

                {memberError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{memberError}</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-xl border border-border overflow-hidden bg-card/20">
                  <Table>
                    <TableHeader className="bg-card/60">
                      <TableRow className="border-border/60">
                        <TableHead className="text-[11px] font-bold">Usuario</TableHead>
                        <TableHead className="text-[11px] font-bold">Contacto</TableHead>
                        <TableHead className="text-[11px] font-bold text-center">Rol en Proyecto</TableHead>
                        <TableHead className="text-[11px] font-bold text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                            No hay miembros vinculados al proyecto todavía.
                          </TableCell>
                        </TableRow>
                      ) : (
                        members.map((m) => (
                          <TableRow key={m.id} className="border-border/40">
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-xs">
                                  {m.userName ? m.userName.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div>
                                  <span className="font-semibold text-xs text-foreground block">
                                    {m.userName || 'Usuario'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    {m.userEmail}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                              {m.userPhone ? (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                  <Phone size={10} />
                                  {m.userPhone}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <Badge
                                variant={
                                  m.roleInProject === 'DIRECTOR'
                                    ? 'gold'
                                    : m.roleInProject === 'CLOSER'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-[10px]"
                              >
                                {m.roleInProject}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(m.userId, m.userName || 'miembro')}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                title="Desvincular"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* VINCULAR NUEVO MIEMBRO AL PROYECTO */}
                <div className="p-4 rounded-xl border border-border bg-[#0E1118] space-y-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <UserPlus size={14} className="text-blue-400" />
                    Vincular Usuario al Equipo Comercial
                  </span>

                  <form onSubmit={handleAssignMember} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Seleccionar Usuario Disponible</Label>
                      <Select value={selectedUserIdToAssign} onValueChange={setSelectedUserIdToAssign}>
                        <SelectTrigger className="bg-[#0B0D13] text-xs h-8">
                          <SelectValue placeholder="-- Seleccionar usuario --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- Seleccionar usuario --</SelectItem>
                          {availableUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName} ({u.email}) [{u.role}]
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={isAssigningMember || !selectedUserIdToAssign}
                      className="text-xs h-8 border-border text-blue-400 hover:bg-blue-500/10"
                    >
                      {isAssigningMember ? <RotateCw size={13} className="animate-spin" /> : <UserPlus size={13} className="mr-1" />}
                      Vincular al Proyecto
                    </Button>
                  </form>
                </div>
              </Card>
            )}

            {/* --------------------------------------------------------- */}
            {/* SUB-PANEL 2: AJUSTES DEL PIPELINE (EDITABLE POR TODOS)    */}
            {/* --------------------------------------------------------- */}
            {settingsTab === 'pipeline_settings' && (
              <Card className="bg-[#0B0D13] border-border p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Kanban size={16} className="text-primary" />
                      Configuración de Etapas del Pipeline Comercial
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Define las etapas por las que transicionan los prospectos y su probabilidad estimada de cierre.
                    </p>
                  </div>
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={handleSavePipelineSettings}
                    disabled={isSaving}
                    className="text-xs h-8 font-bold flex items-center gap-1.5"
                  >
                    {isSaving ? <RotateCw size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar Etapas
                  </Button>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-card/20">
                  <Table>
                    <TableHeader className="bg-card/60">
                      <TableRow className="border-border/60">
                        <TableHead className="text-[11px] font-bold">Color</TableHead>
                        <TableHead className="text-[11px] font-bold">Nombre de la Etapa</TableHead>
                        <TableHead className="text-[11px] font-bold text-center">Probabilidad %</TableHead>
                        <TableHead className="text-[11px] font-bold text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineStages.map((stage) => (
                        <TableRow key={stage.id} className="border-border/40">
                          <TableCell className="w-12 py-2">
                            <input
                              type="color"
                              value={stage.color}
                              onChange={(e) => {
                                const newColor = e.target.value;
                                setPipelineStages((prev) =>
                                  prev.map((s) => (s.id === stage.id ? { ...s, color: newColor } : s))
                                );
                              }}
                              className="h-6 w-8 rounded cursor-pointer bg-transparent border-0"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              value={stage.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setPipelineStages((prev) =>
                                  prev.map((s) => (s.id === stage.id ? { ...s, name: newName } : s))
                                );
                              }}
                              className="bg-[#0E1118] text-xs h-7 max-w-sm font-semibold"
                            />
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={stage.probability}
                              onChange={(e) => {
                                const newProb = Number(e.target.value);
                                setPipelineStages((prev) =>
                                  prev.map((s) => (s.id === stage.id ? { ...s, probability: newProb } : s))
                                );
                              }}
                              className="bg-[#0E1118] text-xs h-7 w-20 mx-auto font-mono text-center"
                            />
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePipelineStage(stage.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                              title="Eliminar etapa"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* FORMULARIO AGREGAR NUEVA ETAPA */}
                <div className="p-4 rounded-xl border border-border bg-[#0E1118] space-y-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Plus size={14} className="text-primary" />
                    Agregar Nueva Etapa al Pipeline
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] text-muted-foreground">Nombre de la Etapa</Label>
                      <Input
                        placeholder="Ej. Negociación / Envío de Contrato"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        className="bg-[#0B0D13] text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Probabilidad %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newStageProb}
                        onChange={(e) => setNewStageProb(Number(e.target.value))}
                        className="bg-[#0B0D13] text-xs h-8 font-mono"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="gold"
                      size="sm"
                      onClick={handleAddPipelineStage}
                      disabled={!newStageName.trim()}
                      className="text-xs h-8 font-bold"
                    >
                      <Plus size={13} className="mr-1" />
                      Agregar Etapa
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* --------------------------------------------------------- */}
            {/* SUB-PANEL 3: INTEGRACIONES (SOLO LECTURA PARA DIRECTOR)   */}
            {/* --------------------------------------------------------- */}
            {settingsTab === 'integrations' && (
              <Card className="bg-[#0B0D13] border-border p-5 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Radio size={16} className="text-purple-400" />
                    Integraciones & Webhooks del Proyecto
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conecta pasarelas de pago y CRMs externos para registrar ventas e ingresos de leads automáticamente.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Webhook Endpoint */}
                  <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Radio size={13} className="text-emerald-400" />
                      URL de Webhook Inbound (Hotmart / GHL / Stripe)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Pega esta URL en tu cuenta de Hotmart o CRM para procesar eventos con idempotencia estricta.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`https://api.growthshell.com/webhooks/v1/inbound/${projectId}`}
                        className="bg-[#0B0D13] font-mono text-[11px] h-8 text-muted-foreground select-all"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyWebhookUrl}
                        className="h-8 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/10 flex-shrink-0"
                      >
                        {copiedWebhookUrl ? <Check size={13} /> : <Copy size={13} />}
                      </Button>
                    </div>
                  </div>

                  {/* Secret Token */}
                  <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Lock size={13} className="text-amber-400" />
                      Token Secreto de Firma del Proyecto
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Firma criptográfica HMAC para autenticar webhooks entrantes de terceros.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`gs_sec_${projectId?.substring(0, 14)}_live`}
                        className="bg-[#0B0D13] font-mono text-[11px] h-8 text-muted-foreground select-all"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyWebhookSecret}
                        className="h-8 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/10 flex-shrink-0"
                      >
                        {copiedWebhookSecret ? <Check size={13} /> : <Copy size={13} />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Plataformas Soportadas */}
                <div className="p-4 rounded-xl border border-border bg-[#0E1118] space-y-2">
                  <span className="text-xs font-bold text-foreground">Plataformas con Conector Nativo Activo</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-lg border border-border/60 bg-card/30 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold flex items-center gap-2">
                          Hotmart Webhook
                        </span>
                        <Badge variant="success" className="text-[10px]">Activo</Badge>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] w-full" onClick={() => setIsHotmartModalOpen(true)}>
                        <Settings size={12} className="mr-1" />
                        Configurar
                      </Button>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/60 bg-card/30 flex items-center justify-between">
                      <span className="text-xs font-semibold">Centralize CRM</span>
                      <Badge variant="success" className="text-[10px]">Activo</Badge>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/60 bg-card/30 flex items-center justify-between">
                      <span className="text-xs font-semibold">GoHighLevel (GHL)</span>
                      <Badge variant="success" className="text-[10px]">Activo</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* --------------------------------------------------------- */}
            {/* SUB-PANEL 4: DATOS DEL PROYECTO (SOLO LECTURA PARA DIRECTOR) */}
            {/* --------------------------------------------------------- */}
            {settingsTab === 'general' && (
              <Card className="bg-[#0B0D13] border-border p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Settings size={16} className="text-primary" />
                    Datos Básicos e Identificación del Proyecto
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Información operativa, slug identificador, estado y asignación de director.
                  </p>
                </div>

                <form onSubmit={handleSaveGeneral} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nombre del Proyecto</Label>
                      <Input
                        value={genName}
                        onChange={(e) => setGenName(e.target.value)}
                        disabled={isDirector || isSaving}
                        className="bg-card text-xs h-9"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Slug Identificador</Label>
                      <Input
                        value={genSlug}
                        onChange={(e) => setGenSlug(e.target.value)}
                        disabled={isDirector || isSaving}
                        className="bg-card text-xs h-9 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Descripción Operativa</Label>
                    <Input
                      value={genDesc}
                      onChange={(e) => setGenDesc(e.target.value)}
                      disabled={isDirector || isSaving}
                      className="bg-card text-xs h-9"
                      placeholder="Detalles sobre el producto, nicho o campaña"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Estado Operativo</Label>
                      <Select value={genStatus} onValueChange={(val: string) => setGenStatus(val as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED')} disabled={isDirector || isSaving}>
                        <SelectTrigger className="bg-card text-xs h-9">
                          <SelectValue placeholder="Activo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Activo</SelectItem>
                          <SelectItem value="DRAFT">Borrador</SelectItem>
                          <SelectItem value="PAUSED">En Pausa</SelectItem>
                          <SelectItem value="ARCHIVED">Archivado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isAdminOrSuper && (
                    <div className="flex justify-end pt-3">
                      <Button
                        type="submit"
                        variant="gold"
                        size="sm"
                        disabled={isSaving}
                        className="font-bold text-xs h-9 px-5 flex items-center gap-1.5"
                      >
                        {isSaving ? <RotateCw size={13} className="animate-spin" /> : <Save size={13} />}
                        Guardar Cambios Generales
                      </Button>
                    </div>
                  )}
                </form>
              </Card>
            )}

            {/* --------------------------------------------------------- */}
            {/* SUB-PANEL 5: METAS Y COMISIONES (SOLO LECTURA DIRECTOR)   */}
            {/* --------------------------------------------------------- */}
            {settingsTab === 'goals' && (
              <div className="space-y-6">
                {/* 5.1 Catálogo de Productos */}
                <Card className="bg-[#0B0D13] border-border p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Package size={16} className="text-primary" />
                        Catálogo de Productos y Tickets del Proyecto ({products.length})
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ofertas que computan para metas y comisiones comerciales.
                      </p>
                    </div>
                    {isAdminOrSuper && (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => {
                          setProductFormError(null);
                          setIsProductModalOpen(true);
                        }}
                        className="text-xs h-8 font-bold"
                      >
                        <Plus size={13} className="mr-1" />
                        Agregar Producto
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden bg-card/20">
                    <Table>
                      <TableHeader className="bg-card/60">
                        <TableRow className="border-border/60">
                          <TableHead className="text-[11px] font-bold">Nombre del Producto</TableHead>
                          <TableHead className="text-[11px] font-bold">SKU</TableHead>
                          <TableHead className="text-[11px] font-bold">Oferta</TableHead>
                          <TableHead className="text-[11px] font-bold text-right">Precio</TableHead>
                          <TableHead className="text-[11px] font-bold text-center">Cuotas</TableHead>
                          <TableHead className="text-[11px] font-bold text-center">Estado</TableHead>
                          {isAdminOrSuper && <TableHead className="text-[11px] font-bold text-right">Acción</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdminOrSuper ? 6 : 5} className="text-center py-6 text-xs text-muted-foreground">
                              No hay productos en el catálogo aún.
                            </TableCell>
                          </TableRow>
                        ) : (
                          products.map((p) => (
                            <TableRow key={p.id} className="border-border/40">
                              <TableCell className="font-semibold text-xs py-2 text-foreground">
                                {p.name}
                                {p.ownerCloserId && <span className="block text-[10px] text-blue-400">Propietario: {allUsers.find(u => u.id === p.ownerCloserId)?.fullName || p.ownerCloserId}</span>}
                                {p.externalLabel && <span className="block text-[10px] text-purple-400">Label: {p.externalLabel}</span>}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground py-2">{p.sku || '—'}</TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground py-2">{p.offerCode || '—'}</TableCell>
                              <TableCell className="text-xs font-mono font-bold text-right py-2 text-primary">
                                ${p.price} {p.currency}
                              </TableCell>
                              <TableCell className="text-center py-2">
                                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-muted-foreground">
                                  <Calendar size={12} className="text-muted-foreground" />
                                  {p.installments ?? 1} cuota{p.installments === 1 ? '' : 's'}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProductActive(p)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                    p.active
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                                  }`}
                                >
                                  {p.active ? 'Activo' : 'Inactivo'}
                                </button>
                              </TableCell>
                              {isAdminOrSuper && (
                                <TableCell className="text-right py-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteProduct(p.id)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {isAdminOrSuper && (
                    <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
                      <DialogContent className="sm:max-w-[650px] bg-[#0E1118] border-border text-foreground">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Sparkles size={18} className="text-primary" />
                            Añadir Producto al Catálogo
                          </DialogTitle>
                        </DialogHeader>

                        {productFormError && (
                          <Alert variant="destructive" className="py-2 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200">
                            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                            <AlertDescription>{productFormError}</AlertDescription>
                          </Alert>
                        )}

                        <form onSubmit={handleAddProduct} className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Nuevo Ticket / Producto <span className="text-primary">*</span></Label>
                              <Input
                                placeholder="Ej. Programa Master VIP $997"
                                value={newProdName}
                                onChange={(e) => setNewProdName(e.target.value)}
                                className="bg-[#0B0D13] text-xs h-9"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Código de Oferta</Label>
                              <Input
                                placeholder="Ej. OFF-123"
                                value={newProdOfferCode}
                                onChange={(e) => setNewProdOfferCode(e.target.value)}
                                className="bg-[#0B0D13] text-xs h-9 font-mono"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">SKU / Código</Label>
                              <Input
                                placeholder="Ej. MVP-997"
                                value={newProdSku}
                                onChange={(e) => setNewProdSku(e.target.value)}
                                className="bg-[#0B0D13] text-xs h-9 font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Precio <span className="text-primary">*</span></Label>
                              <Input
                                type="number"
                                min="0"
                                value={newProdPrice}
                                onChange={(e) => setNewProdPrice(Number(e.target.value))}
                                className="bg-[#0B0D13] text-xs h-9 font-mono"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Cuotas <span className="text-primary">*</span></Label>
                              <Input
                                type="number"
                                min="1"
                                max="360"
                                step="1"
                                value={newProdInstallments}
                                onChange={(e) => setNewProdInstallments(Math.max(1, Number(e.target.value)))}
                                className="bg-[#0B0D13] text-xs h-9 font-mono"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Moneda <span className="text-primary">*</span></Label>
                              <Select value={newProdCurrency} onValueChange={setNewProdCurrency}>
                                <SelectTrigger className="bg-[#0B0D13] text-xs h-9">
                                  <SelectValue placeholder="USD ($)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USD">USD ($)</SelectItem>
                                  <SelectItem value="EUR">EUR (€)</SelectItem>
                                  <SelectItem value="MXN">MXN ($)</SelectItem>
                                  <SelectItem value="COP">COP ($)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Closer Propietario (Opcional)</Label>
                              <Select value={newProdOwnerCloserId || 'none'} onValueChange={(val) => setNewProdOwnerCloserId(val === 'none' ? '' : val)}>
                                <SelectTrigger className="bg-[#0B0D13] text-xs h-9">
                                  <SelectValue placeholder="-- Sin asignar --" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">-- Sin asignar --</SelectItem>
                                  {activeClosersInProject.map((m) => (
                                    <SelectItem key={m.userId} value={m.userId}>
                                      {m.userName || m.userId}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Label Externo (Opcional)</Label>
                              <Input
                                placeholder="Ej. Productor Secundario"
                                value={newProdExternalLabel}
                                onChange={(e) => setNewProdExternalLabel(e.target.value)}
                                className="bg-[#0B0D13] text-xs h-9"
                              />
                            </div>
                          </div>

                          <DialogFooter className="pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsProductModalOpen(false)}
                              className="text-xs h-9 border-border"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="submit"
                              variant="gold"
                              disabled={isAddingProd || !newProdName.trim()}
                              className="text-xs h-9 font-bold"
                            >
                              {isAddingProd ? <RotateCw size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
                              Agregar Producto
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </Card>

                {/* 5.4 Grupos de Comisión (Fase 3) */}
                <Card className="bg-[#0B0D13] border-border p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        Grupos de Comisión por Producto
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Agrupa productos con un reparto de comisiones propio y metas de facturación escalonadas.
                        Un producto solo puede pertenecer a un único grupo.
                      </p>
                    </div>
                    {isAdminOrSuper && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddCommissionGroup}
                        className="text-xs h-8 border-border text-primary hover:bg-primary/10"
                      >
                        <Plus size={13} className="mr-1" />
                        Agregar Grupo de Comisión
                      </Button>
                    )}
                  </div>

                  {commissionConfigState.groups.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <p className="text-xs text-muted-foreground">
                        Aún no hay grupos de comisión. Crea uno para asignar un reparto específico a un subconjunto de productos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {commissionConfigState.groups.map((group) => {
                        const assignedElses = productsAssignedToOtherGroups(group.id);
                        const splitError = getGroupSplitError(group.basePercentages);
                        return (
                          <div key={group.id} className="rounded-xl border border-border bg-card/30 p-4 space-y-4">
                            {/* Encabezado del grupo */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-1 w-full sm:max-w-xs">
                                <Label className="text-[11px] text-muted-foreground">Nombre del Grupo</Label>
                                <Input
                                  value={group.name}
                                  onChange={(e) => handleUpdateCommissionGroup(group.id, 'name', e.target.value)}
                                  disabled={isDirector || isSaving}
                                  className="bg-[#0B0D13] text-xs h-8 font-semibold"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="gold" className="text-[10px]">
                                  {group.productIds.length} producto{group.productIds.length === 1 ? '' : 's'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveCommissionGroup(group.id)}
                                  disabled={isDirector || isSaving}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </div>

                            {/* Productos con checkboxes (deshabilitar los ya asignados a otro grupo) */}
                            <div>
                              <Label className="text-[11px] text-muted-foreground mb-2 block">
                                Productos del grupo (activos)
                              </Label>
                              {products.filter(p => p.active).length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No hay productos activos en el catálogo. Agrega o activa productos para poder asignarlos a este grupo.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {products.filter(p => p.active).map((p) => {
                                    const taken = assignedElses.has(p.id);
                                    const checked = group.productIds.includes(p.id);
                                    return (
                                      <label
                                        key={p.id}
                                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                                          checked
                                            ? 'border-primary/50 bg-primary/10'
                                            : taken
                                              ? 'border-border/40 bg-card/20 opacity-45 cursor-not-allowed'
                                              : 'border-border/40 bg-card/20 hover:border-border'
                                        }`}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          disabled={isDirector || isSaving || taken}
                                          onCheckedChange={(val) =>
                                            handleToggleGroupProduct(group.id, p.id, val === true)
                                          }
                                        />
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                                          <p className="text-[10px] font-mono text-muted-foreground">
                                            {p.offerCode || p.sku || 'Sin código'} • ${p.price}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Reparto base del grupo con validación en vivo */}
                            <div className="rounded-lg border border-border/60 bg-[#0E1118] p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-bold text-foreground">Reparto base del grupo</Label>
                                {splitError ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
                                    <AlertCircle size={11} /> Suma no coincide con el total
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                                    <CheckCircle2 size={11} /> Reparto válido
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Total Equipo %</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={group.basePercentages.teamTotal}
                                    onChange={(e) =>
                                      handleUpdateGroupPercentages(group.id, 'teamTotal', Number(e.target.value))
                                    }
                                    disabled={isDirector || isSaving}
                                    className={`h-7 text-xs font-mono bg-[#0B0D13] ${
                                      splitError ? 'border-red-500/50 text-red-400' : 'text-primary'
                                    }`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Empresa %</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={group.basePercentages.company}
                                    onChange={(e) =>
                                      handleUpdateGroupPercentages(group.id, 'company', Number(e.target.value))
                                    }
                                    disabled={isDirector || isSaving}
                                    className="h-7 text-xs font-mono text-emerald-400 bg-[#0B0D13]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Director %</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={group.basePercentages.director}
                                    onChange={(e) =>
                                      handleUpdateGroupPercentages(group.id, 'director', Number(e.target.value))
                                    }
                                    disabled={isDirector || isSaving}
                                    className="h-7 text-xs font-mono text-blue-400 bg-[#0B0D13]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Closer %</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={group.basePercentages.closer}
                                    onChange={(e) =>
                                      handleUpdateGroupPercentages(group.id, 'closer', Number(e.target.value))
                                    }
                                    disabled={isDirector || isSaving}
                                    className="h-7 text-xs font-mono text-violet-400 bg-[#0B0D13]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Externas %</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={group.basePercentages.external}
                                    onChange={(e) =>
                                      handleUpdateGroupPercentages(group.id, 'external', Number(e.target.value))
                                    }
                                    disabled={isDirector || isSaving}
                                    className="h-7 text-xs font-mono text-purple-400 bg-[#0B0D13]"
                                  />
                                </div>
                              </div>
                              {splitError && (
                                <p className="text-[11px] text-red-400/90 flex items-start gap-1.5">
                                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                  {splitError}
                                </p>
                              )}
                            </div>

                            {/* Metas de facturación del grupo */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-bold text-foreground">
                                  Metas de facturación ({group.goals.length})
                                </Label>
                                {isAdminOrSuper && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddGroupGoal(group.id)}
                                    className="text-[11px] h-7 border-border text-muted-foreground hover:text-primary"
                                  >
                                    <Plus size={11} className="mr-1" />
                                    Agregar Meta
                                  </Button>
                                )}
                              </div>

                              {group.goals.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Sin metas escalonadas. Al cumplir una meta de facturación, el reparto del grupo cambia.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {group.goals.map((goal) => {
                                    return (
                                      <div key={goal.id} className="rounded-lg border border-border/60 bg-[#0E1118] p-4 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="space-y-1 w-full max-w-[200px]">
                                              <Label className="text-[10px] text-muted-foreground">Nombre de la Meta</Label>
                                              <Input
                                                value={goal.name}
                                                onChange={(e) =>
                                                  handleUpdateGroupGoal(group.id, goal.id, 'name', e.target.value)
                                                }
                                                disabled={isDirector || isSaving}
                                                className="bg-[#0B0D13] text-xs h-7"
                                              />
                                            </div>
                                            <div className="space-y-1 w-24">
                                              <Label className="text-[10px] text-muted-foreground">Moneda</Label>
                                              <Select
                                                value={goal.currency}
                                                onValueChange={(val: string) =>
                                                  handleUpdateGroupGoal(group.id, goal.id, 'currency', val)
                                                }
                                                disabled={isDirector || isSaving}
                                              >
                                                <SelectTrigger className="bg-[#0B0D13] text-xs h-7">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="USD">USD</SelectItem>
                                                  <SelectItem value="EUR">EUR</SelectItem>
                                                  <SelectItem value="MXN">MXN</SelectItem>
                                                  <SelectItem value="COP">COP</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {isAdminOrSuper && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleAddGroupGoalTier(group.id, goal.id)}
                                                disabled={isSaving}
                                                className="h-7 text-[10px] bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                              >
                                                <Plus size={11} className="mr-1" />
                                                Escalón
                                              </Button>
                                            )}
                                            {isAdminOrSuper && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveGroupGoal(group.id, goal.id)}
                                                disabled={isSaving}
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                              >
                                                <Trash2 size={12} />
                                              </Button>
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-2 pl-2 border-l-2 border-border/40">
                                          {(goal.tiers || []).map((tier, tIdx) => {
                                            const tierError = getGroupSplitError(tier.percentages);
                                            return (
                                              <div key={tier.id} className="p-3 bg-[#0B0D13]/60 rounded border border-border/40 space-y-3">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-muted-foreground bg-card px-1.5 py-0.5 rounded">
                                                      Escalón {tIdx + 1}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                      <Label className="text-[10px] text-muted-foreground">Facturación desde:</Label>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        step="100"
                                                        value={tier.revenueThreshold}
                                                        onChange={(e) =>
                                                          handleUpdateGroupGoalTier(group.id, goal.id, tier.id, 'revenueThreshold', Number(e.target.value))
                                                        }
                                                        disabled={isDirector || isSaving}
                                                        className="h-6 w-24 text-xs font-mono bg-[#0E1118]"
                                                      />
                                                    </div>
                                                  </div>
                                                  {isAdminOrSuper && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleRemoveGroupGoalTier(group.id, goal.id, tier.id)}
                                                      disabled={isSaving}
                                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                                                    >
                                                      <Trash2 size={11} />
                                                    </Button>
                                                  )}
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                  <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Total Equipo %</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="0.5"
                                                      value={tier.percentages.teamTotal}
                                                      onChange={(e) => handleUpdateGroupGoalTier(group.id, goal.id, tier.id, 'teamTotal', Number(e.target.value))}
                                                      disabled={isDirector || isSaving}
                                                      className={`h-6 text-xs font-mono bg-[#0E1118] ${tierError ? 'border-red-500/50 text-red-400' : 'text-primary'}`}
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Empresa %</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="0.5"
                                                      value={tier.percentages.company}
                                                      onChange={(e) => handleUpdateGroupGoalTier(group.id, goal.id, tier.id, 'company', Number(e.target.value))}
                                                      disabled={isDirector || isSaving}
                                                      className="h-6 text-xs font-mono text-emerald-400 bg-[#0E1118]"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Director %</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="0.5"
                                                      value={tier.percentages.director}
                                                      onChange={(e) => handleUpdateGroupGoalTier(group.id, goal.id, tier.id, 'director', Number(e.target.value))}
                                                      disabled={isDirector || isSaving}
                                                      className="h-6 text-xs font-mono text-blue-400 bg-[#0E1118]"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Closer %</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="0.5"
                                                      value={tier.percentages.closer}
                                                      onChange={(e) => handleUpdateGroupGoalTier(group.id, goal.id, tier.id, 'closer', Number(e.target.value))}
                                                      disabled={isDirector || isSaving}
                                                      className="h-6 text-xs font-mono text-violet-400 bg-[#0E1118]"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Externas %</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="0.5"
                                                      value={tier.percentages.external}
                                                      onChange={(e) => handleUpdateGroupGoalTier(group.id, goal.id, tier.id, 'external', Number(e.target.value))}
                                                      disabled={isDirector || isSaving}
                                                      className="h-6 text-xs font-mono text-purple-400 bg-[#0E1118]"
                                                    />
                                                  </div>
                                                </div>
                                                {tierError && (
                                                  <p className="text-[11px] text-red-400/90 flex items-start gap-1.5">
                                                    <AlertCircle size={11} className="shrink-0 mt-0.5" />
                                                    {tierError}
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {isAdminOrSuper && (
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={handleSaveGoalsAndCommissions}
                      disabled={isSaving}
                      className="font-bold text-xs h-10 px-6 flex items-center gap-2 shadow-sm"
                    >
                      {isSaving ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
                      <span>Guardar Configuración de Metas y Comisiones</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL: AGREGAR NUEVO LEAD AL PIPELINE                         */}
        {/* ------------------------------------------------------------- */}
        <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
          <DialogContent className="max-w-md">
            <form onSubmit={handleCreateLead} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                  <UserPlus size={16} className="text-primary" />
                  Agregar Nuevo Prospecto / Lead
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Registra un prospecto directamente en el pipeline de este proyecto.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre Completo del Prospecto</Label>
                  <Input
                    required
                    placeholder="Ej. Santiago Benítez"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Correo Electrónico</Label>
                    <Input
                      type="email"
                      placeholder="santiago@empresa.com"
                      value={newLeadEmail}
                      onChange={(e) => setNewLeadEmail(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono / WhatsApp</Label>
                    <Input
                      placeholder="+57 312 000 0000"
                      value={newLeadPhone}
                      onChange={(e) => setNewLeadPhone(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Closer Asignado</Label>
                    <Select value={newLeadCloser} onValueChange={setNewLeadCloser}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Por Asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Por Asignar">Por Asignar</SelectItem>
                        {activeClosersInProject.map((c) => (
                          <SelectItem key={c.id} value={c.userName || c.userEmail || c.userId}>
                            {c.userName || c.userEmail}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Etapa Inicial</Label>
                    <Select value={newLeadStage} onValueChange={setNewLeadStage}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Seleccionar etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelineStages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ticket / Producto</Label>
                    <Select
                      value={newLeadProduct}
                      onValueChange={(val: string) => {
                        setNewLeadProduct(val);
                        const found = products.find((p) => p.name === val);
                        if (found) setNewLeadValue(found.price);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="-- Seleccionar producto --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Seleccionar producto --</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name} (${p.price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Estimado ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newLeadValue}
                      onChange={(e) => setNewLeadValue(Number(e.target.value))}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewLeadOpen(false)}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="gold" size="sm" className="text-xs font-bold h-9">
                  Guardar en Pipeline
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Configuración Hotmart */}
        <Dialog open={isHotmartModalOpen} onOpenChange={setIsHotmartModalOpen}>
          <DialogContent className="max-w-md bg-[#0B0D13] border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                Configuración de Hotmart
                <Badge variant="success" className="text-[10px] uppercase">Webhook</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ajusta los parámetros para recibir transacciones de Hotmart en este proyecto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">URL del Webhook (Pega esto en Hotmart)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`https://api.growthshell.com/webhooks/hotmart/${projectId}`} className="h-9 text-xs font-mono bg-black/40" />
                  <Button variant="outline" size="sm" className="h-9 px-3">
                    <Copy size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Hottok (Webhook Secret)</Label>
                <Input
                  type="password"
                  value={hotmartSecret}
                  onChange={(e) => setHotmartSecret(e.target.value)}
                  placeholder="Ej: d8a9s8d9a8s9d8a9s8d9..."
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ignorar transacciones anteriores a (Opcional)</Label>
                <Input
                  type="date"
                  value={hotmartDateFilter}
                  onChange={(e) => setHotmartDateFilter(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Checkbox
                  id="ignore-subs"
                  checked={hotmartIgnoreSubsequent}
                  onCheckedChange={(c) => setHotmartIgnoreSubsequent(!!c)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="ignore-subs" className="text-xs font-medium cursor-pointer">Ignorar cuotas subsecuentes</Label>
                  <p className="text-[10px] text-muted-foreground">Solo creará la venta de la cuota inicial (recurrencia).</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsHotmartModalOpen(false)}>Cancelar</Button>
              <Button variant="gold" size="sm" onClick={() => setIsHotmartModalOpen(false)}>Guardar Cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
