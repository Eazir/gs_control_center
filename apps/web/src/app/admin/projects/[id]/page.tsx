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
  Pencil,
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
  Tag,
  Layers,
  Activity,
  User,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/admin-shell';
import { SalesView } from '@/components/admin/projects/SalesView';
import { TransactionsView } from '@/components/admin/projects/TransactionsView';
import { LeadDetailModal, LeadData } from '@/components/admin/projects/LeadDetailModal';
import { CsvImporter } from '@/components/csv-importer';
import { TransactionDetailModal, TransactionData } from '@/components/admin/projects/TransactionDetailModal';
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
export type ProjectProduct = ProductItem;

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
  sckCodes?: string[];
}

interface PipelineStageConfig {
  id: string;
  name: string;
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
  installments?: number;
  offerCode?: string;
  pipelineSubstatus?: string;
  situacion?: string;
  latestTransaction?: TransactionData | null;
}

const DEFAULT_STAGES: PipelineStageConfig[] = [
  { id: 'uncontacted', name: 'Sin Contactar', color: '#6B7280' },
  { id: 'followup', name: 'En Seguimiento', color: '#3B82F6' },
  { id: 'won', name: 'Ganado', color: '#10B981' },
  { id: 'discarded', name: 'Descartados', color: '#64748B' },
  { id: 'lost', name: 'Perdidos', color: '#EF4444' },
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

  // 4 VISTAS PRINCIPALES CANÓNICAS -> 5 VISTAS
  const searchParams = useSearchParams();
  const initialView = (searchParams?.get('view') as 'pipeline' | 'leads' | 'metrics' | 'settings' | 'sales' | 'transactions') || 'pipeline';
  const [mainView, setMainView] = useState<'pipeline' | 'leads' | 'metrics' | 'settings' | 'sales' | 'transactions'>(initialView);

  // SUB-PESTAÑAS DEL PANEL DE CONTROL (5 CONFIGURACIONES)
  const [settingsTab, setSettingsTab] = useState<'team' | 'pipeline_settings' | 'integrations' | 'general' | 'goals'>('team');

  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);

  // CSV Import
  const [isLeadImportModalOpen, setIsLeadImportModalOpen] = useState(false);

  // Modal SCK para Closers
  const [editingSckUser, setEditingSckUser] = useState<{ userId: string; name: string; codes: string } | null>(null);
  const [isSavingSck, setIsSavingSck] = useState(false);

  // Modal Profile
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionData | null>(null);
  const [allProjectTransactions, setAllProjectTransactions] = useState<TransactionData[]>([]);

  // Pagination for Leads Base
  const [leadsPage, setLeadsPage] = useState(1);

  // Funciones de Drag & Drop para Kanban
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necesario para permitir onDrop
  };

  const handleDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) {
      handleMoveLeadStage(leadId, targetStageId);
    }
  };

  // Funciones de Drag & Drop para ordenar Pipeline Stages
  const handleStageDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('stageIndex', index.toString());
  };

  const handleStageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData('stageIndex');
    if (dragIndexStr) {
      const dragIndex = parseInt(dragIndexStr, 10);
      if (dragIndex === dropIndex) return;
      const newStages = [...pipelineStages];
      const draggedItem = newStages[dragIndex];
      if (!draggedItem) return;
      newStages.splice(dragIndex, 1);
      newStages.splice(dropIndex, 0, draggedItem);
      setPipelineStages(newStages);
    }
  };

  // Estado para Catálogo de Productos
  const [products, setProducts] = useState<ProjectProduct[]>([]);
  const [newProdName, setNewProdName] = useState('');
  const [newProdOfferCode, setNewProdOfferCode] = useState('');
  const [newProdOwnerCloserId, setNewProdOwnerCloserId] = useState('');
  const [newProdIsMarketing, setNewProdIsMarketing] = useState(false);
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdInstallments, setNewProdInstallments] = useState(1);
  const [newProdCurrency, setNewProdCurrency] = useState('USD');
  const [isAddingProd, setIsAddingProd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProjectProduct | null>(null);
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
  const [newStageColor, setNewStageColor] = useState('#F59E0B');

  // Estado para Integraciones / Webhook
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);
  const [isHotmartModalOpen, setIsHotmartModalOpen] = useState(false);
  const [hotmartSecret, setHotmartSecret] = useState('');
  const [hotmartDateFilter, setHotmartDateFilter] = useState('');
  const [hotmartIgnoreSubsequent, setHotmartIgnoreSubsequent] = useState(true);
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [isSavingHotmart, setIsSavingHotmart] = useState(false);
  const [hotmartSavedSuccess, setHotmartSavedSuccess] = useState(false);
  const [copiedHotmartUrl, setCopiedHotmartUrl] = useState(false);

  // Feedback de guardado
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // ESTADO DE LEADS (MOCK / DEMO DEL PIPELINE Y BASE DE LEADS)
  const [leads, setLeads] = useState<ProjectLead[]>([]); // Para el Kanban (Transacciones separadas)
  const [baseLeads, setBaseLeads] = useState<ProjectLead[]>([]); // Para la Tabla (Agrupado por persona)
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  
  const [leadSearch, setLeadSearch] = useState('');
  const [closerFilter, setCloserFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // Modal para crear lead rápido
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCloser, setNewLeadCloser] = useState('');
  const [newLeadProduct, setNewLeadProduct] = useState('');
  const [newLeadValue, setNewLeadValue] = useState(997);
  const [newLeadStage, setNewLeadStage] = useState('uncontacted');

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
      setProducts((data.products || []) as ProjectProduct[]);

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

      // Los prospectos (leads) se cargan ahora mediante la API real en `loadLeads`
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

  const loadLeads = useCallback(async () => {
    setIsLoadingLeads(true);
    if (!projectId) return;
    try {
      const [salesRes, leadsRes, txRes] = await Promise.all([
        fetchWithAuth(`/sales/project/${projectId}`),
        fetchWithAuth(`/sales/project/${projectId}/leads`),
        fetchWithAuth(`/sales/project/${projectId}/transactions`)
      ]);

      if (txRes.ok) {
        const txData = await txRes.json();
        setAllProjectTransactions(Array.isArray(txData) ? txData : []);
      }

      let leadsList: any[] = [];
      if (leadsRes.ok) {
        const lData = await leadsRes.json();
        leadsList = Array.isArray(lData) ? lData : [];
        setBaseLeads(leadsList);
      }

      if (salesRes.ok) {
        const data = await salesRes.json();
        const sales = Array.isArray(data) ? data : [];
        const mappedOpportunities = sales.map((sale: any) => {
          const leadMatch = leadsList.find((l: any) => l.id === sale.lead?.id);
          const history = leadMatch?.latestTransaction?.history || undefined;

          return {
            id: sale.lead?.id || sale.id, // Kanban drag-and-drop requires lead.id to update correctly
            leadId: sale.lead?.id,
            fullName: sale.lead?.name || 'Sin Nombre',
            email: sale.lead?.email || 'Sin Correo',
            phone: sale.lead?.phone || '',
            stageId: sale.lead?.pipelineStage || sale.pipelineStage || 'uncontacted',
            situacion: sale.lead?.situacion || undefined,
            interestedProducts: sale.lead?.interestedProducts || undefined,
            pipelineSubstatus: sale.pipelineSubstatus || undefined,
            closerName: sale.closerName || 'Sin Asignar',
            closerId: sale.closerId || undefined,
            productName: sale.productName,
            estimatedValue: sale.amount,
            source: sale.source,
            createdAt: sale.createdAt,
            installments: sale.installments,
            offerCode: sale.offerCode,
            latestTransaction: sale, // Guardamos la venta completa
            history: history, // ¡Ahora pasamos la historia procesada desde listLeads!
          };
        });
        setLeads(mappedOpportunities);
      }

      if (leadsRes.ok) {
        // Reuse the leadsList we already parsed
        const apiLeads = leadsList;
        // Map backend lead response to ProjectLead type
        const mappedLeads = apiLeads.map((l: any) => ({
          id: l.id,
          leadId: l.id, // For Base de Leads, id is the Lead ID
          fullName: l.fullName,
          email: l.email,
          phone: l.phone,
          stageId: l.stageId,
          situacion: l.situacion,
          closerName: 'Sin Asignar', // Se resolverá al renderizar si no lo trae
          closerId: l.closerId,
          productName: l.productName,
          estimatedValue: l.estimatedValue,
          source: l.source,
          createdAt: l.lastContact,
          installments: l.installments,
          offerCode: l.offerCode,
          latestTransaction: l.latestTransaction,
          history: l.latestTransaction?.history, // Pasamos el historial!
        }));
        setBaseLeads(mappedLeads);
      }
    } catch {
      setLeads([]);
      setBaseLeads([]);
    } finally {
      setIsLoadingLeads(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    loadMembersAndUsers();
    loadLeads();
  }, [loadProject, loadMembersAndUsers, loadLeads]);

  // Recargar leads en lugar de guardarlos en local
  const saveLeadsState = (updatedLeads: ProjectLead[]) => {
    setLeads(updatedLeads);
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
  const handleMoveLeadStage = async (leadId: string, targetStageId: string) => {
    // Actualización optimista
    setLeads(prev => prev.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId } : l)));
    setBaseLeads(prev => prev.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId } : l)));
    
    // Impactar en backend
    try {
      const res = await fetchWithAuth(`/sales/project/${projectId}/leads/${leadId}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stageId: targetStageId }),
      });
      if (!res.ok) {
        // Revertir en caso de error
        loadLeads();
      }
    } catch {
      loadLeads();
    }
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

  // Cargar configuración de Hotmart y túnel guardado
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gs_tunnel_url');
      if (stored) setTunnelUrl(stored);
    }
  }, []);

  useEffect(() => {
    if (isHotmartModalOpen && projectId) {
      fetchWithAuth(`/integrations/config/${projectId}?provider=HOTMART`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            if (data.credentialsEnc) setHotmartSecret(data.credentialsEnc);
            if (data.validFrom) {
              try {
                setHotmartDateFilter(new Date(data.validFrom).toISOString().split('T')[0] || '');
              } catch {
                // ignore
              }
            }
            if (typeof data.ignoreSubsequent === 'boolean') {
              setHotmartIgnoreSubsequent(data.ignoreSubsequent);
            }
          }
        })
        .catch(() => null);
    }
  }, [isHotmartModalOpen, projectId]);

  const handleSaveHotmartConfig = async () => {
    if (!projectId) return;
    setIsSavingHotmart(true);
    try {
      if (typeof window !== 'undefined' && tunnelUrl) {
        localStorage.setItem('gs_tunnel_url', tunnelUrl.trim());
      }
      const res = await fetchWithAuth(`/integrations/config/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'HOTMART',
          credentialsEnc: hotmartSecret.trim(),
          validFrom: hotmartDateFilter ? hotmartDateFilter : null,
          ignoreSubsequent: hotmartIgnoreSubsequent,
          isActive: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al persistir la configuración de Hotmart.');
      }

      setHotmartSavedSuccess(true);
      setTimeout(() => {
        setHotmartSavedSuccess(false);
        setIsHotmartModalOpen(false);
      }, 1000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error inesperado al guardar');
    } finally {
      setIsSavingHotmart(false);
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
        teamTotal: 25,
        company: 12,
        director: 3,
        closer: 10,
        external: 2,
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
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setNewProdName('');
    setNewProdOfferCode('');
    setNewProdIsMarketing(false);
    setNewProdOwnerCloserId('');
    setNewProdPrice(0);
    setNewProdInstallments(1);
    setNewProdCurrency('USD');
    setProductFormError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (product: ProjectProduct) => {
    setEditingProduct(product);
    setNewProdName(product.name);
    setNewProdOfferCode(product.offerCode || '');
    setNewProdIsMarketing(product.isMarketing || false);
    setNewProdOwnerCloserId(product.ownerCloserId || '');
    setNewProdPrice(product.price);
    setNewProdInstallments(product.installments || 1);
    setNewProdCurrency(product.currency || 'USD');
    setProductFormError(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !projectId) return;
    if (!isAdminOrSuper) {
      alert('Solo los Administradores de la plataforma pueden gestionar productos del catálogo.');
      return;
    }
    
    // Validación: Código de oferta único entre productos activos
    if (newProdOfferCode.trim()) {
      const existingActive = products.find(
        p => p.active && p.offerCode === newProdOfferCode.trim() && (!editingProduct || p.id !== editingProduct.id)
      );
      if (existingActive) {
        setProductFormError(`Debe desactivar el producto existente (${existingActive.name}) antes de usar el mismo código de oferta.`);
        return;
      }
    }
    setProductFormError(null);
    setIsAddingProd(true);

    try {
      const url = editingProduct 
        ? `/projects/${projectId}/products/${editingProduct.id}`
        : `/projects/${projectId}/products`;
      const method = editingProduct ? 'PATCH' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProdName.trim(),
          offerCode: newProdOfferCode.trim() ? newProdOfferCode.trim() : null,
          isMarketing: newProdIsMarketing,
          price: Number(newProdPrice),
          installments: Number(newProdInstallments) || 1,
          currency: newProdCurrency.toUpperCase(),
          ownerCloserId: newProdOwnerCloserId.trim() ? newProdOwnerCloserId.trim() : null,
          active: editingProduct ? editingProduct.active : true,
        }),
      });

      if (!res.ok) {
        throw new Error(editingProduct ? 'Error al actualizar el producto' : 'Error al agregar el producto al catálogo');
      }

      const saved = await res.json();
      if (editingProduct) {
        setProducts((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
      } else {
        setProducts((prev) => [...prev, saved]);
      }
      setEditingProduct(null);
      setNewProdName('');
      setNewProdOfferCode('');
      setNewProdIsMarketing(false);
      setNewProdOwnerCloserId('');
      setNewProdInstallments(1);
      setIsProductModalOpen(false);
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
    const product = products.find((p) => p.id === productId);
    const prodName = product?.name || 'este producto';
    if (!confirm(`¿Deseas eliminar '${prodName}' del catálogo?`)) return;
    try {
      const res = await fetchWithAuth(`/projects/${projectId}/products/${productId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.message || 'Error al eliminar el producto';
        throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar el producto');
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

  const handleSaveSckCodes = async () => {
    if (!editingSckUser || !projectId) return;
    setIsSavingSck(true);
    try {
      const newCodes = editingSckUser.codes.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetchWithAuth(`/projects/${projectId}/members/${editingSckUser.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sckCodes: newCodes })
      });
      
      if (!res.ok) throw new Error('Error al guardar SCK');
      
      setMembers((prev) => prev.map(m => m.userId === editingSckUser.userId ? { ...m, sckCodes: newCodes } : m));
      setEditingSckUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSavingSck(false);
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
    const baseHost = tunnelUrl.trim().replace(/\/$/, '') || 'https://api.growthsell.com';
    const url = `${baseHost}/integrations/hotmart/webhook/${projectId}`;
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
  // ENRICHMENT: Resolver closerName para cada lead usando los miembros del proyecto
  // -------------------------------------------------------------
  const enrichedLeads = useMemo(() => {
    // Construir mapa: userId -> nombre para resolución rápida
    const userMap = new Map<string, string>(
      allUsers.map((u) => [u.id, u.fullName || u.email || u.id])
    );
    const memberMap = new Map<string, string>(
      members.map((m) => [m.userId, m.userName || m.userEmail || m.userId])
    );
    return leads.map((lead) => {
      const closerId = lead.closerId || lead.latestTransaction?.closerId;
      const resolvedName = closerId
        ? (memberMap.get(closerId) || userMap.get(closerId) || null)
        : null;
      return {
        ...lead,
        closerName: resolvedName || lead.closerName || 'Sin closer',
        closerId: closerId || undefined,
      };
    });
  }, [leads, members, allUsers]);

  // -------------------------------------------------------------
  // FILTRADO DE LEADS (PARA PIPELINE KANBAN)
  // -------------------------------------------------------------
  const filteredLeads = useMemo(() => {
    return enrichedLeads.filter((l) => {
      const matchSearch =
        leadSearch === '' ||
        l.fullName.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.phone.includes(leadSearch) ||
        (l.productName && l.productName.toLowerCase().includes(leadSearch.toLowerCase()));

      const matchCloser = closerFilter === 'ALL' || l.closerName === closerFilter;
      const matchStage = stageFilter === 'ALL' || l.stageId === stageFilter;

      return matchSearch && matchCloser && matchStage;
    });
  }, [enrichedLeads, leadSearch, closerFilter, stageFilter]);

  // -------------------------------------------------------------
  // ENRICHMENT Y FILTRADO DE LEADS (PARA BASE DE LEADS)
  // -------------------------------------------------------------
  const enrichedBaseLeads = useMemo(() => {
    const userMap = new Map<string, string>(
      allUsers.map((u) => [u.id, u.fullName || u.email || u.id])
    );
    const memberMap = new Map<string, string>(
      members.map((m) => [m.userId, m.userName || m.userEmail || m.userId])
    );
    return baseLeads.map((lead) => {
      const closerId = lead.closerId || lead.latestTransaction?.closerId;
      const resolvedName = closerId
        ? (memberMap.get(closerId) || userMap.get(closerId) || null)
        : null;
      return {
        ...lead,
        closerName: resolvedName || lead.closerName || 'Sin closer',
        closerId: closerId || undefined,
      };
    });
  }, [baseLeads, members, allUsers]);

  const filteredBaseLeads = useMemo(() => {
    return enrichedBaseLeads.filter((l) => {
      const matchSearch =
        leadSearch === '' ||
        l.fullName.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.phone.includes(leadSearch) ||
        (l.productName && l.productName.toLowerCase().includes(leadSearch.toLowerCase()));

      const matchCloser = closerFilter === 'ALL' || l.closerName === closerFilter;
      const matchStage = stageFilter === 'ALL' || l.stageId === stageFilter;

      return matchSearch && matchCloser && matchStage;
    });
  }, [enrichedBaseLeads, leadSearch, closerFilter, stageFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setLeadsPage(1);
  }, [leadSearch, closerFilter, stageFilter]);

  const paginatedLeads = useMemo(() => {
    return filteredBaseLeads.slice((leadsPage - 1) * 50, leadsPage * 50);
  }, [filteredBaseLeads, leadsPage]);
  const totalPages = Math.ceil(filteredBaseLeads.length / 50);

  // Cálculos de métricas del proyecto
  const metricsCalc = useMemo(() => {
    const totalWon = enrichedLeads
      .filter((l) => l.stageId === 'won')
      .reduce((sum, l) => sum + l.estimatedValue, 0);

    const targetRevenue = goalsConfigState.monthlyTargetRevenue || 50000;
    const progressPercent = targetRevenue > 0 ? Math.min(100, Math.round((totalWon / targetRevenue) * 100)) : 0;
    const wonCount = enrichedLeads.filter((l) => l.stageId === 'won').length;
    const closedCount = enrichedLeads.filter((l) => l.stageId === 'won' || l.stageId === 'lost').length;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : wonCount > 0 ? 100 : 0;
    const averageTicket = wonCount > 0 ? Math.round(totalWon / wonCount) : 997;

    // Desglose por Closer (usando enrichedLeads que ya tiene closerName resuelto)
    const closersStatsMap = new Map<string, { calls: number; won: number; revenue: number }>();
    enrichedLeads.forEach((l) => {
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
  }, [enrichedLeads, goalsConfigState.monthlyTargetRevenue, commissionConfigState.defaultCloserPercentage]);

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
              {baseLeads.length}
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
            <Badge variant="gold" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {baseLeads.length}
            </Badge>
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

          <button
            type="button"
            onClick={() => setMainView('sales')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              mainView === 'sales'
                ? 'border-primary text-primary shadow-[0_4px_12px_rgba(245,158,11,0.15)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign size={15} />
            <span>Ventas</span>
          </button>

          {effectiveRole !== 'CLOSER' && (
            <button
              type="button"
              onClick={() => setMainView('transactions')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                mainView === 'transactions'
                  ? 'border-primary text-primary shadow-[0_4px_12px_rgba(245,158,11,0.15)]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity size={15} />
              <span>Transacciones</span>
            </button>
          )}

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
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground">Closer:</span>
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

                <Button variant="outline" size="sm" onClick={() => loadLeads()} className="h-8 text-xs border-border/80 ml-2" disabled={isLoadingLeads}>
                  <RefreshCw size={14} className={`mr-2 ${isLoadingLeads ? 'animate-spin' : ''}`} />
                  Refrescar
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Total Leads: <strong className="text-foreground">{filteredBaseLeads.length}</strong></span>
                <span>•</span>
                <span>Facturación Ganada: <strong className="text-emerald-400 font-mono">${metricsCalc.totalWon.toLocaleString()} USD</strong></span>
              </div>
            </div>

            {/* TABLERO KANBAN DE ETAPAS */}
            <div className="flex flex-nowrap items-start gap-4 overflow-x-auto pb-6 pt-2 custom-scrollbar">
              {pipelineStages.map((stage) => {
                let stageLeads = filteredBaseLeads.filter((l) => l.stageId === stage.id);
                
                // Aplicar el filtro de cuotas SOLO en la etapa "Ganado"
                if (stage.id === 'won' && paymentMethodFilter !== 'ALL') {
                  stageLeads = stageLeads.filter(l => (l.installments || 1).toString() === paymentMethodFilter);
                }

                const stageTotalVal = stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0);

                return (
                  <div
                    key={stage.id}
                    className="flex-none flex flex-col rounded-xl border border-border/80 bg-[#0B0D13] shadow-md w-[300px] shrink-0 transition-colors"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Cabecera de la etapa */}
                    <div
                      className="p-3 border-b border-border/60"
                      style={{ borderTop: `3px solid ${stage.color}` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground truncate">{stage.name}</span>
                        <div className="flex items-center gap-2">
                          {stage.id === 'won' && (
                            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                              <SelectTrigger className="bg-[#0E1118] text-[10px] h-6 px-2 w-auto min-w-[70px] border-border/60">
                                <SelectValue placeholder="Cuotas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL" className="text-[10px]">Todas</SelectItem>
                                <SelectItem value="1" className="text-[10px]">1 Cuota</SelectItem>
                                <SelectItem value="2" className="text-[10px]">2 Cuotas</SelectItem>
                                <SelectItem value="3" className="text-[10px]">3 Cuotas</SelectItem>
                                <SelectItem value="4" className="text-[10px]">4 Cuotas</SelectItem>
                                <SelectItem value="5" className="text-[10px]">5 Cuotas</SelectItem>
                                <SelectItem value="6" className="text-[10px]">6 Cuotas</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {stageLeads.length}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-end text-[10px] text-muted-foreground mt-1 font-mono">
                        <span className="text-primary font-bold">${stageTotalVal.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Lista de tarjetas en la etapa */}
                    <div className="p-2 space-y-3 min-h-[350px] max-h-[600px] overflow-y-auto custom-scrollbar">
                      {stageLeads.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-[12px] text-muted-foreground/60 border border-dashed border-border/40 rounded-lg mx-1 mt-1">
                          Sin prospectos
                        </div>
                      ) : (
                        <>
                          {stageLeads.slice(0, 20).map((lead) => {
                          const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
                          return (
                            <div
                              key={lead.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, lead.id)}
                              onClick={() => {
                                if (lead.latestTransaction) {
                                  setSelectedTransaction({
                                    ...lead.latestTransaction,
                                    closerName: lead.closerName
                                  });
                                } else {
                                  setSelectedLead(lead as LeadData);
                                }
                              }}
                              className="p-3.5 rounded-xl border border-border/70 bg-card/40 hover:border-primary/50 hover:bg-card transition-all space-y-3 shadow-sm cursor-grab active:cursor-grabbing group relative"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-[13px] text-foreground leading-tight line-clamp-1">
                                  {lead.fullName}
                                </span>
                                <span className="font-mono text-xs text-primary font-bold whitespace-nowrap bg-primary/10 px-1.5 py-0.5 rounded">
                                  ${lead.estimatedValue}
                                </span>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                {lead.phone ? (
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-fit flex items-center gap-1.5 text-[11px] text-emerald-400/90 hover:text-emerald-400 hover:bg-emerald-900/30 px-1.5 py-0.5 rounded transition-colors"
                                  >
                                    <Phone size={10} />
                                    {lead.phone}
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground/70 px-1.5">Sin teléfono</span>
                                )}

                                <div className="flex items-center justify-between text-[11px] px-1.5">
                                  <div className="flex items-center gap-1.5 text-muted-foreground truncate" title={lead.productName}>
                                    <Package size={10} />
                                    <span>{lead.productName || 'Sin producto'}</span>
                                  </div>
                                  {lead.offerCode && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/30">
                                      {lead.offerCode}
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] px-1.5">
                                  <User size={10} className="text-muted-foreground" />
                                  <span className="text-muted-foreground font-medium truncate">{lead.closerName || 'Sin closer'}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                <div className="flex items-center gap-1">
                                  {lead.pipelineSubstatus && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">
                                      {lead.pipelineSubstatus}
                                    </Badge>
                                  )}
                                </div>
                                <Select 
                                  value={lead.stageId} 
                                  onValueChange={(val: string) => handleMoveLeadStage(lead.id, val)}
                                >
                                  <SelectTrigger 
                                    className="h-6 text-[10px] bg-[#0E1118]/80 border-border/60 hover:border-primary/30 px-2 py-0 w-auto min-w-[120px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
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
                          );
                        })}
                        {stageLeads.length > 20 && (
                          <div className="text-center py-2 text-[11px] font-bold text-muted-foreground bg-muted/20 rounded-xl border border-border/50">
                            + {stageLeads.length - 20} prospectos ocultos
                          </div>
                        )}
                      </>
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
                  onFocus={(e) => e.target.select()}
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
                  variant="outline"
                  size="sm"
                  onClick={() => loadLeads()}
                  disabled={isLoadingLeads}
                  className="text-xs h-9 border-border text-foreground hover:bg-muted"
                >
                  <RefreshCw size={13} className={`mr-1 ${isLoadingLeads ? 'animate-spin' : ''}`} />
                  Refrescar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLeadImportModalOpen(true)}
                  className="text-xs h-9 border-border text-foreground hover:bg-muted"
                >
                  <UploadCloud size={13} className="mr-1" />
                  Importar CSV
                </Button>
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
                  {paginatedLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                        No se encontraron prospectos con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLeads.map((lead) => {
                      const stageObj = pipelineStages.find((s) => s.id === lead.stageId);
                      const cleanPhone = lead.phone.replace(/[^0-9]/g, '');

                      return (
                        <TableRow 
                          key={lead.id} 
                          className="border-border/40 hover:bg-card/40 cursor-pointer"
                          onClick={() => setSelectedLead(lead as LeadData)}
                        >
                          <TableCell className="py-2.5">
                            <div>
                              <span className="font-bold text-xs text-foreground block group-hover:text-primary transition-colors">{lead.fullName}</span>
                              <span className="text-[10px] text-muted-foreground block">{lead.email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
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
                          <TableCell className="text-right py-2.5" onClick={(e) => e.stopPropagation()}>
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
            
            {/* Controles de Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-[#0B0D13] p-3 rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">
                  Mostrando {((leadsPage - 1) * 50) + 1} a {Math.min(leadsPage * 50, filteredBaseLeads.length)} de {filteredBaseLeads.length} leads
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                    disabled={leadsPage === 1}
                    className="h-8 text-xs"
                  >
                    Anterior
                  </Button>
                  <span className="text-xs font-bold px-2">
                    Página {leadsPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeadsPage(p => Math.min(totalPages, p + 1))}
                    disabled={leadsPage === totalPages}
                    className="h-8 text-xs"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* MODAL: IMPORTACIÓN CSV DE LEADS                               */}
        {/* ============================================================= */}
        <Dialog open={isLeadImportModalOpen} onOpenChange={setIsLeadImportModalOpen}>
          <DialogContent className="bg-background border-border text-foreground max-w-4xl p-0 overflow-y-auto max-h-[90vh]">
            <CsvImporter 
              projectId={projectId}
              mode="leads" 
              onClose={() => {
                setIsLeadImportModalOpen(false);
                loadLeads();
              }} 
            />
          </DialogContent>
        </Dialog>

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
        {/* VISTA 5: VENTAS (IMPORTACIÓN Y REGISTRO)                      */}
        {/* ============================================================= */}
        {mainView === 'sales' && project && (
          <div className="animate-in fade-in-50">
            <SalesView
              projectId={project.id}
              products={products}
              members={members}
              leads={leads}
              allUsers={allUsers}
              projectCurrency={project.goalsConfig?.currency || goalsConfigState.currency || 'USD'}
            />
          </div>
        )}

        {/* ============================================================= */}
        {/* VISTA 6: TRANSACCIONES                                        */}
        {/* ============================================================= */}
        {mainView === 'transactions' && (
          <TransactionsView projectId={projectId} />
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
                    <span>5. Productos, Metas & Comisiones</span>
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
                            <TableCell className="text-right py-2.5 space-x-2">
                              {m.roleInProject === 'CLOSER' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingSckUser({ userId: m.userId, name: m.userName || 'Closer', codes: m.sckCodes?.join(', ') || '' })}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  title="Editar SCK"
                                >
                                  <Tag size={13} />
                                </Button>
                              )}
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
                        <TableHead className="text-[11px] font-bold text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineStages.map((stage, index) => (
                        <TableRow 
                          key={stage.id} 
                          className="border-border/40 cursor-grab active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => handleStageDragStart(e, index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleStageDrop(e, index)}
                        >
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
                              onFocus={(e) => e.target.select()}
                              className="bg-[#0E1118] text-xs h-7 max-w-sm font-semibold cursor-text"
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
                        onFocus={(e) => e.target.select()}
                        className="bg-[#0B0D13] text-xs h-8"
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
                        value={`${(tunnelUrl.trim().replace(/\/$/, '') || 'https://api.growthsell.com')}/integrations/hotmart/webhook/${projectId}`}
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
                        onFocus={(e) => e.target.select()}
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
                        onFocus={(e) => e.target.select()}
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
                      onFocus={(e) => e.target.select()}
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
                        onClick={handleOpenNewProduct}
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
                                {p.isMarketing && <span className="block text-[10px] text-purple-400">Marketing</span>}
                              </TableCell>
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
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEditProduct(p)}
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                      title="Editar producto"
                                    >
                                      <Pencil size={13} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteProduct(p.id)}
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                      title="Eliminar producto"
                                    >
                                      <Trash2 size={13} />
                                    </Button>
                                  </div>
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
                            {editingProduct ? 'Editar Producto del Catálogo' : 'Añadir Producto al Catálogo'}
                          </DialogTitle>
                        </DialogHeader>

                        {productFormError && (
                          <Alert variant="destructive" className="py-2 px-3 text-xs bg-red-950/30 border-red-500/30 text-red-200">
                            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                            <AlertDescription>{productFormError}</AlertDescription>
                          </Alert>
                        )}

                        <form onSubmit={handleSaveProduct} className="space-y-4 pt-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Nombre del Producto <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="Ej: Mentoria Master VIP $900"
                              value={newProdName}
                              onChange={(e) => setNewProdName(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="bg-[#0B0D13] text-xs h-9"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Código de Oferta (Hotmart)</Label>
                              <Input
                                placeholder="Ej: 9d1uc0dq"
                                value={newProdOfferCode}
                                onChange={(e) => setNewProdOfferCode(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="bg-[#0B0D13] text-xs h-9 font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Marketing</Label>
                              <div className="flex items-center h-9 space-x-2 bg-[#0B0D13] px-3 rounded-md border border-input">
                                <Checkbox 
                                  id="isMarketing" 
                                  checked={newProdIsMarketing} 
                                  onCheckedChange={(c) => setNewProdIsMarketing(!!c)}
                                />
                                <Label htmlFor="isMarketing" className="text-[11px] text-foreground">
                                  Es de Marketing
                                </Label>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Precio <span className="text-primary">*</span></Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={newProdPrice}
                                onChange={(e) => setNewProdPrice(Number(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                className="bg-[#0B0D13] text-xs h-9 font-mono"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Cuotas <span className="text-primary">*</span></Label>
                              <Input
                                type="number"
                                min="1"
                                max="12"
                                step="1"
                                value={newProdInstallments}
                                onChange={(e) => setNewProdInstallments(Math.max(1, Number(e.target.value)))}
                                onFocus={(e) => e.target.select()}
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
                              {isAddingProd ? (
                                <RotateCw size={13} className="animate-spin mr-1" />
                              ) : editingProduct ? (
                                <Save size={13} className="mr-1" />
                              ) : (
                                <Plus size={13} className="mr-1" />
                              )}
                              {editingProduct ? 'Guardar Cambios' : 'Agregar Producto'}
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
                                  onFocus={(e) => e.target.select()}
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
                                    onFocus={(e) => e.target.select()}
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
                                    onFocus={(e) => e.target.select()}
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
                                    onFocus={(e) => e.target.select()}
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
                                    onFocus={(e) => e.target.select()}
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
                                    onFocus={(e) => e.target.select()}
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
                                                onFocus={(e) => e.target.select()}
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
                                                        onFocus={(e) => e.target.select()}
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
                                                      onFocus={(e) => e.target.select()}
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
                                                      onFocus={(e) => e.target.select()}
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
                                                      onFocus={(e) => e.target.select()}
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
                                                      onFocus={(e) => e.target.select()}
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
                                                      onFocus={(e) => e.target.select()}
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
                    onFocus={(e) => e.target.select()}
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
                      onFocus={(e) => e.target.select()}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono / WhatsApp</Label>
                    <Input
                      placeholder="+57 312 000 0000"
                      value={newLeadPhone}
                      onChange={(e) => setNewLeadPhone(e.target.value)}
                      onFocus={(e) => e.target.select()}
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
                      onFocus={(e) => e.target.select()}
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
          <DialogContent className="max-w-lg bg-[#0B0D13] border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                Configuración de Hotmart
                <Badge variant="success" className="text-[10px] uppercase">Webhook v2.0</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ajusta los parámetros para recibir transacciones de Hotmart en este proyecto.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Box de Modo Desarrollo / Túnel */}
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Radio size={13} className="text-primary animate-pulse" />
                    Túnel de Desarrollo (Sin Dominio Propio)
                  </span>
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono">
                    Localhost :3001
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Hotmart está en la nube y requiere una <strong>URL pública con HTTPS</strong>. En tu terminal ejecuta:{' '}
                  <code className="text-foreground bg-black/60 px-1 py-0.5 rounded font-mono">npx localtunnel --port 3001</code> o{' '}
                  <code className="text-foreground bg-black/60 px-1 py-0.5 rounded font-mono">ngrok http 3001</code>.
                </p>
                <div className="space-y-1 pt-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">URL base de tu túnel HTTPS:</Label>
                  <Input
                    placeholder="Ej. https://mi-tunel.loca.lt o https://xxxx.ngrok-free.app"
                    value={tunnelUrl}
                    onChange={(e) => setTunnelUrl(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="h-8 text-xs font-mono bg-black/50 border-border"
                  />
                </div>
              </div>

              {/* URL que se pega en Hotmart */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>URL del Webhook (Pega exactamente esto en Hotmart Tools)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">POST / 200 OK</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${(tunnelUrl.trim().replace(/\/$/, '') || 'https://api.growthsell.com')}/integrations/hotmart/webhook/${projectId}`}
                    className="h-9 text-xs font-mono bg-black/50 border-border text-foreground font-semibold select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `${(tunnelUrl.trim().replace(/\/$/, '') || 'https://api.growthsell.com')}/integrations/hotmart/webhook/${projectId}`;
                      navigator.clipboard.writeText(url);
                      setCopiedHotmartUrl(true);
                      setTimeout(() => setCopiedHotmartUrl(false), 2000);
                    }}
                    className="h-9 px-3 flex-shrink-0 text-primary border-primary/30 hover:bg-primary/10"
                  >
                    {copiedHotmartUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </Button>
                </div>
              </div>

              {/* Hottok */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Hottok (Código de Autenticación de Hotmart)</Label>
                  <span className="text-[10px] text-muted-foreground italic">En Hotmart: Herramientas &gt; Webhook</span>
                </div>
                <Input
                  type="text"
                  value={hotmartSecret}
                  onChange={(e) => setHotmartSecret(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Ej: d8a9s8d9a8s9d8a9s8d9... o déjalo vacío si es prueba"
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Filtro de fecha */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ignorar transacciones anteriores a (Opcional)</Label>
                <Input
                  type="date"
                  value={hotmartDateFilter}
                  onChange={(e) => setHotmartDateFilter(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="h-9 text-xs"
                />
              </div>

              {/* Checkbox ignorar cuotas subsecuentes */}
              <div className="flex items-center gap-3 pt-2">
                <Checkbox
                  id="ignore-subs"
                  checked={hotmartIgnoreSubsequent}
                  onCheckedChange={(c) => setHotmartIgnoreSubsequent(!!c)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="ignore-subs" className="text-xs font-medium cursor-pointer">Ignorar cuotas subsecuentes</Label>
                  <p className="text-[10px] text-muted-foreground">Solo creará la venta de la cuota inicial (recurrencias y suscripciones).</p>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHotmartModalOpen(false)}
                disabled={isSavingHotmart}
              >
                Cerrar
              </Button>
              <Button
                variant="gold"
                size="sm"
                onClick={handleSaveHotmartConfig}
                disabled={isSavingHotmart}
                className="font-bold text-xs flex items-center gap-1.5"
              >
                {isSavingHotmart ? (
                  <RotateCw size={13} className="animate-spin" />
                ) : hotmartSavedSuccess ? (
                  <CheckCircle2 size={13} className="text-emerald-300" />
                ) : (
                  <Save size={13} />
                )}
                <span>{hotmartSavedSuccess ? '¡Guardado!' : 'Guardar Configuración'}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingSckUser} onOpenChange={(o) => !o && setEditingSckUser(null)}>
          <DialogContent className="bg-card border-border sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-sm">Códigos SCK - {editingSckUser?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                Asigna códigos SCK (separados por coma) para atribuir ventas a este Closer.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="text-xs text-muted-foreground">Códigos SCK</Label>
              <Input 
                value={editingSckUser?.codes || ''} 
                onChange={(e) => setEditingSckUser(prev => prev ? { ...prev, codes: e.target.value } : null)}
                placeholder="Ej: sck1, sck2, promo_pedro"
                className="bg-[#0B0D13] border-border text-xs mt-1"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEditingSckUser(null)}>Cancelar</Button>
              <Button variant="gold" size="sm" onClick={handleSaveSckCodes} disabled={isSavingSck}>
                {isSavingSck ? <RotateCw size={13} className="animate-spin" /> : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <LeadDetailModal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
          stageName={selectedLead ? (pipelineStages.find(s => s.id === selectedLead.stageId)?.name || '') : ''}
          projectId={projectId as string}
          activeClosers={activeClosersInProject.map(c => {
            const u = allUsers.find(x => x.id === c.userId);
            return { id: c.userId, name: u?.fullName || 'Desconocido' };
          })}
          pipelineStages={pipelineStages}
          products={products}
          allTransactions={allProjectTransactions}
          onSave={() => {
            loadLeads();
            setSelectedLead(null);
          }}
        />

        <TransactionDetailModal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          transaction={selectedTransaction}
          allTransactions={allProjectTransactions}
        />
      </div>
    </AdminShell>
  );
}
