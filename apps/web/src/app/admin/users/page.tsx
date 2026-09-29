'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  UserCheck,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Send,
  ExternalLink,
  ShieldCheck,
  Plus,
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

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DIRECTOR' | 'CLOSER' | 'CLIENTE';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserMetrics {
  total: number;
  active: number;
  invited: number;
  suspended: number;
}

interface InvitationItem {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DIRECTOR' | 'CLOSER' | 'CLIENTE';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  token?: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export default function UsersManagementPage() {
  // Pestaña activa: 'users' | 'invitations'
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');

  // Estado de Usuarios
  const [users, setUsers] = useState<UserItem[]>([]);
  const [metrics, setMetrics] = useState<UserMetrics>({
    total: 0,
    active: 0,
    invited: 0,
    suspended: 0,
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Estado de Invitaciones
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  // Filtros de búsqueda de usuarios
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Usuario actualmente autenticado
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

  // Filtro de invitaciones
  const [invitationSearch, setInvitationSearch] = useState('');
  const [invitationStatusFilter, setInvitationStatusFilter] = useState('ALL');

  // Modal de Invitación
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'DIRECTOR' | 'CLOSER' | 'CLIENTE' | 'SUPER_ADMIN'>('CLOSER');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal de Edición de Usuario (soporte para múltiples teléfonos)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhones, setEditPhones] = useState<string[]>(['']);
  const [editRole, setEditRole] = useState<UserItem['role']>('CLOSER');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const handleAddPhone = () => {
    setEditPhones((prev) => [...prev, '']);
  };

  const handleRemovePhone = (index: number) => {
    setEditPhones((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  };

  const handlePhoneChange = (index: number, value: string) => {
    setEditPhones((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // Copiado y renovación segura de enlaces de invitación
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [refreshingInviteId, setRefreshingInviteId] = useState<string | null>(null);

  // Cargar usuarios desde la API
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUsersError(null);

    try {
      const res = await fetchWithAuth('/auth/users');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al obtener la lista de usuarios.');
      }

      const data = await res.json();
      setUsers(data.users || []);
      setMetrics(
        data.metrics || {
          total: data.users?.length || 0,
          active: (data.users || []).filter((u: UserItem) => u.status === 'ACTIVE').length,
          invited: (data.users || []).filter((u: UserItem) => u.status === 'INVITED').length,
          suspended: (data.users || []).filter((u: UserItem) => u.status === 'SUSPENDED').length,
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor.';
      setUsersError(msg);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Cargar invitaciones desde la API
  const fetchInvitations = useCallback(async () => {
    setIsLoadingInvitations(true);
    setInvitationsError(null);

    try {
      const res = await fetchWithAuth('/auth/invitations');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al obtener las invitaciones.');
      }

      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor.';
      setInvitationsError(msg);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchInvitations();

    // Obtener sesión activa para aplicar reglas de privacidad de visualización
    fetchWithAuth('/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCurrentUser({ id: data.id, role: data.role });
        }
      })
      .catch(() => {});
  }, [fetchUsers, fetchInvitations]);

  // Manejar apertura de modal de edición
  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditFullName(user.fullName || '');
    setEditEmail(user.email || '');
    const initialPhones = user.phone
      ? user.phone.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)
      : [''];
    setEditPhones(initialPhones.length > 0 ? initialPhones : ['']);
    setEditRole(user.role);
    setEditError(null);
    setEditSuccess(false);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditError(null);
    setEditSuccess(false);
  };

  // Guardar edición de usuario
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const validPhones = editPhones.map((p) => p.trim()).filter(Boolean);
      const joinedPhones = validPhones.length > 0 ? validPhones.join(', ') : null;

      const payload: {
        fullName?: string;
        phone?: string | null;
        email?: string;
      } = {
        fullName: editFullName.trim(),
        phone: joinedPhones,
        email: editEmail.trim().toLowerCase(),
      };

      const res = await fetchWithAuth(`/auth/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al actualizar usuario.');
      }

      // Actualizar lista local de usuarios
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...data.user } : u))
      );

      setEditSuccess(true);
      setTimeout(() => {
        closeEditModal();
      }, 1000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar los cambios.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Manejar cambio de estado de usuario (Activar / Suspender)
  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionLabel = newStatus === 'SUSPENDED' ? 'suspender' : 'reactivar';

    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} a ${user.fullName} (${user.email})?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/auth/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `No se pudo cambiar el estado del usuario.`);
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      );
      setMetrics((prev) => ({
        ...prev,
        active: newStatus === 'ACTIVE' ? prev.active + 1 : prev.active - 1,
        suspended: newStatus === 'SUSPENDED' ? prev.suspended + 1 : prev.suspended - 1,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar usuario');
    }
  };

  // Eliminar / Revocar invitación
  const handleDeleteInvitation = async (inv: InvitationItem) => {
    if (!confirm(`¿Deseas revocar y eliminar la invitación enviada a ${inv.email}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingInviteId(inv.id);
    try {
      const res = await fetchWithAuth(`/auth/invitations/${inv.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'No se pudo eliminar la invitación.');
      }

      // Remover de la lista local
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      fetchUsers(); // Actualizar métricas de usuarios
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar la invitación');
    } finally {
      setDeletingInviteId(null);
    }
  };

  // Enviar Invitación de Nuevo Usuario
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setIsSubmittingInvite(true);

    try {
      const res = await fetchWithAuth('/auth/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          fullName: inviteName.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al emitir la invitación.');
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const inviteUrl = `${origin}/accept-invite?email=${encodeURIComponent(data.email)}&token=${data.token}`;
      setGeneratedInviteUrl(inviteUrl);

      // Recargar listas en segundo plano
      fetchUsers();
      fetchInvitations();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error inesperado al emitir la invitación');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyInvitationRowLink = async (inv: InvitationItem) => {
    setRefreshingInviteId(inv.id);
    try {
      const res = await fetchWithAuth(`/auth/invitations/${inv.id}/resend`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al generar el enlace de invitación.');
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const inviteUrl = `${origin}/accept-invite?email=${encodeURIComponent(data.email)}&token=${data.token}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopiedTokenId(inv.id);
      setTimeout(() => setCopiedTokenId(null), 2500);

      // Refrescar invitaciones en segundo plano para actualizar expiración
      fetchInvitations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo generar el enlace de invitación.');
    } finally {
      setRefreshingInviteId(null);
    }
  };

  const closeInviteDialog = () => {
    setIsInviteOpen(false);
    setGeneratedInviteUrl(null);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('CLOSER');
    setInviteError(null);
    setCopiedLink(false);
  };

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Regla de privacidad y seguridad:
      // Solo el Super Admin puede verse a sí mismo en la gestión de usuarios (nadie más puede verlo)
      if (u.role === 'SUPER_ADMIN') {
        if (!currentUser || currentUser.role !== 'SUPER_ADMIN' || currentUser.id !== u.id) {
          return false;
        }
      }

      const matchesSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phone && u.phone.includes(searchQuery));
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, currentUser, searchQuery, roleFilter, statusFilter]);

  // Filtrado de invitaciones
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch = inv.email.toLowerCase().includes(invitationSearch.toLowerCase());
      const matchesStatus =
        invitationStatusFilter === 'ALL' || inv.status === invitationStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invitations, invitationSearch, invitationStatusFilter]);

  // Badges de Roles
  const renderRoleBadge = (role: UserItem['role']) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]">
            <Sparkles size={10} className="mr-1" /> SUPER ADMIN
          </Badge>
        );
      case 'ADMIN':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
            ADMIN
          </Badge>
        );
      case 'DIRECTOR':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
            DIRECTOR
          </Badge>
        );
      case 'CLOSER':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
            CLOSER
          </Badge>
        );
      case 'CLIENTE':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
            CLIENTE
          </Badge>
        );
    }
  };

  // Badges de Estado de Usuario
  const renderStatusBadge = (status: UserItem['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge variant="success" className="text-[10px] gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Activo
          </Badge>
        );
      case 'INVITED':
        return (
          <Badge variant="warning" className="text-[10px] gap-1 font-medium">
            <Clock size={10} />
            Invitado
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge variant="destructive" className="text-[10px] gap-1 font-medium">
            <Ban size={10} />
            Suspendido
          </Badge>
        );
      case 'DELETED':
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Eliminado
          </Badge>
        );
    }
  };

  // Badges de Estado de Invitación
  const renderInvitationStatusBadge = (status: InvitationItem['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="text-[10px] gap-1 font-medium">
            <Clock size={10} />
            Pendiente
          </Badge>
        );
      case 'ACCEPTED':
        return (
          <Badge variant="success" className="text-[10px] gap-1 font-medium">
            <CheckCircle2 size={10} />
            Aceptada
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="destructive" className="text-[10px] gap-1 font-medium">
            <AlertCircle size={10} />
            Expirada
          </Badge>
        );
    }
  };

  return (
    <AdminShell title="Gestión de Usuarios">
      {/* ------------------------------------------------------------- */}
      {/* HEADER PRINCIPAL                                              */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="text-primary" size={24} />
            Gestión de Usuarios e Invitaciones
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Administra usuarios activos, actualiza sus datos de contacto y roles, y gestiona las invitaciones emitidas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'users') fetchUsers();
              else fetchInvitations();
            }}
            disabled={isLoadingUsers || isLoadingInvitations}
            className="h-10 text-xs border-border"
            title="Refrescar lista"
          >
            <RotateCw size={14} className={isLoadingUsers || isLoadingInvitations ? 'animate-spin' : ''} />
          </Button>

          <Button
            variant="gold"
            onClick={() => setIsInviteOpen(true)}
            className="font-bold text-xs h-10 shadow-lg"
          >
            <UserPlus size={16} className="mr-2" />
            Invitar Usuario
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* NAVEGACIÓN POR PESTAÑAS (TABS)                                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'users'
              ? 'border-primary text-primary bg-card/40 rounded-t-lg'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users size={15} />
          <span>Usuarios Registrados</span>
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-card border border-border text-foreground font-mono">
            {metrics.total}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'invitations'
              ? 'border-primary text-primary bg-card/40 rounded-t-lg'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mail size={15} />
          <span>Registro de Invitaciones</span>
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-card border border-border text-foreground font-mono">
            {invitations.length}
          </span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* PESTAÑA 1: USUARIOS REGISTRADOS                              */}
      {/* ============================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* TARJETAS DE KPIS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Usuarios</span>
                <Users size={16} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                {isLoadingUsers ? <Skeleton className="h-7 w-12" /> : metrics.total}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Registrados en la plataforma</p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Activos</span>
                <UserCheck size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">
                {isLoadingUsers ? <Skeleton className="h-7 w-12" /> : metrics.active}
              </div>
              <p className="text-[11px] text-emerald-500/80 mt-1">Cuentas con acceso habilitado</p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Invitaciones Pendientes</span>
                <Clock size={16} className="text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-2">
                {isLoadingUsers ? <Skeleton className="h-7 w-12" /> : metrics.invited}
              </div>
              <p className="text-[11px] text-amber-500/80 mt-1">Pendientes de crear contraseña</p>
            </Card>

            <Card className="bg-card/70 border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Suspendidos</span>
                <Ban size={16} className="text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400 mt-2">
                {isLoadingUsers ? <Skeleton className="h-7 w-12" /> : metrics.suspended}
              </div>
              <p className="text-[11px] text-red-400/80 mt-1">Acceso temporalmente revocado</p>
            </Card>
          </div>

          {/* BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/50 p-3 rounded-xl border border-border">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nombre, correo o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs bg-card border-border"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-44">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-10 text-xs w-full">
                    <SelectValue placeholder="Todos los roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los roles</SelectItem>
                    {currentUser?.role === 'SUPER_ADMIN' && (
                      <SelectItem value="SUPER_ADMIN">Super Admin (Propio)</SelectItem>
                    )}
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="DIRECTOR">Director Comercial</SelectItem>
                    <SelectItem value="CLOSER">Closer</SelectItem>
                    <SelectItem value="CLIENTE">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-40">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 text-xs w-full">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="ACTIVE">Activo</SelectItem>
                    <SelectItem value="INVITED">Invitado</SelectItem>
                    <SelectItem value="SUSPENDED">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* TABLA DE USUARIOS */}
          <Card className="border-border bg-card/70 overflow-hidden shadow-xl">
            {/* ESTADO 1: ERROR */}
            {usersError && (
              <div className="p-6">
                <Alert variant="destructive" className="border-red-500/30 bg-red-950/40 text-red-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No se pudieron cargar los usuarios</AlertTitle>
                  <AlertDescription className="text-xs mt-1 flex items-center justify-between">
                    <span>{usersError}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={fetchUsers}
                      className="ml-4 h-7 text-xs border-red-500/40 text-red-200"
                    >
                      Reintentar
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* ESTADO 2: SKELETON */}
            {isLoadingUsers && !usersError && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            )}

            {/* ESTADO 3: EMPTY */}
            {!isLoadingUsers && !usersError && filteredUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground mb-4">
                  <Users size={28} />
                </div>
                <h3 className="text-base font-bold text-foreground">No se encontraron usuarios</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'No hay usuarios que coincidan con los filtros aplicados.'
                    : 'Aún no hay usuarios registrados en el sistema.'}
                </p>
                {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setRoleFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="mt-4 text-xs"
                  >
                    Limpiar filtros
                  </Button>
                ) : (
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => setIsInviteOpen(true)}
                    className="mt-4 text-xs font-bold"
                  >
                    <UserPlus size={14} className="mr-1.5" /> Invitar Primer Usuario
                  </Button>
                )}
              </div>
            )}

            {/* ESTADO 4: TABLA */}
            {!isLoadingUsers && !usersError && filteredUsers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[320px]">Usuario</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado el</TableHead>
                    <TableHead>Último Acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const initials = u.fullName
                      ? u.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : u.email.charAt(0).toUpperCase();

                    return (
                      <TableRow key={u.id} className="hover:bg-card/80">
                        {/* Usuario (Avatar + Nombre + Email) */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-card border border-border text-primary font-bold text-xs">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {u.fullName}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                <Mail size={11} className="text-muted-foreground/70" />
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Contacto / Teléfonos Múltiples */}
                        <TableCell>
                          {u.phone && u.phone.trim() ? (
                            <div className="flex items-center gap-1.5 max-w-[220px]">
                              {(() => {
                                const phones = u.phone
                                  .split(/[,;\n]+/)
                                  .map((p) => p.trim())
                                  .filter(Boolean);
                                
                                return (
                                  <>
                                    <span
                                      className="inline-flex items-center gap-1.5 text-[11px] text-foreground/90 font-mono bg-card px-1.5 py-0.5 rounded border border-border/60 truncate"
                                      title={phones.join(', ')}
                                    >
                                      <Phone size={10} className="text-primary flex-shrink-0" />
                                      <span className="truncate">{phones[0]}</span>
                                    </span>
                                    {phones.length > 1 && (
                                      <span 
                                        className="inline-flex items-center text-[10px] text-muted-foreground font-medium whitespace-nowrap bg-muted/50 px-1 py-0.5 rounded"
                                        title={phones.slice(1).join(', ')}
                                      >
                                        +{phones.length - 1} más
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">Sin teléfono</span>
                          )}
                        </TableCell>

                        {/* Rol */}
                        <TableCell>{renderRoleBadge(u.role)}</TableCell>

                        {/* Estado */}
                        <TableCell>{renderStatusBadge(u.status)}</TableCell>

                        {/* Creado el */}
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>

                        {/* Último Acceso */}
                        <TableCell className="text-xs text-muted-foreground">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botón Editar Información Básica */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              className="h-7 px-2.5 text-[11px] text-amber-300 hover:text-amber-200 hover:bg-amber-950/30 border-amber-500/30"
                              title="Editar nombre, teléfono, correo o rol"
                            >
                              <Pencil size={12} className="mr-1" /> Editar
                            </Button>

                            {/* Botón Suspender / Reactivar */}
                            {u.role !== 'SUPER_ADMIN' ? (
                              <>
                                {u.status === 'ACTIVE' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleStatus(u)}
                                    className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 border-red-500/20"
                                    title="Suspender acceso"
                                  >
                                    <Ban size={12} className="mr-1" /> Suspender
                                  </Button>
                                )}
                                {u.status === 'SUSPENDED' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleStatus(u)}
                                    className="h-7 px-2 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border-emerald-500/20"
                                    title="Reactivar cuenta"
                                  >
                                    <UserCheck size={12} className="mr-1" /> Activar
                                  </Button>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-primary font-medium uppercase px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                                Global
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* PESTAÑA 2: REGISTRO DE INVITACIONES                           */}
      {/* ============================================================= */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          {/* BARRA DE FILTRO DE INVITACIONES */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/50 p-3 rounded-xl border border-border">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por correo invitado..."
                value={invitationSearch}
                onChange={(e) => setInvitationSearch(e.target.value)}
                className="pl-9 h-10 text-xs bg-card border-border"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-48">
                <Select value={invitationStatusFilter} onValueChange={setInvitationStatusFilter}>
                  <SelectTrigger className="h-10 text-xs w-full">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="PENDING">Pendiente de aceptación</SelectItem>
                    <SelectItem value="ACCEPTED">Aceptada (Completada)</SelectItem>
                    <SelectItem value="EXPIRED">Expirada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="gold"
                size="sm"
                onClick={() => setIsInviteOpen(true)}
                className="h-10 text-xs font-bold whitespace-nowrap"
              >
                <Send size={14} className="mr-1.5" /> Nueva Invitación
              </Button>
            </div>
          </div>

          {/* TABLA DE INVITACIONES */}
          <Card className="border-border bg-card/70 overflow-hidden shadow-xl">
            {/* ERROR */}
            {invitationsError && (
              <div className="p-6">
                <Alert variant="destructive" className="border-red-500/30 bg-red-950/40 text-red-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error al cargar invitaciones</AlertTitle>
                  <AlertDescription className="text-xs mt-1 flex items-center justify-between">
                    <span>{invitationsError}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={fetchInvitations}
                      className="ml-4 h-7 text-xs border-red-500/40 text-red-200"
                    >
                      Reintentar
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* LOADING */}
            {isLoadingInvitations && !invitationsError && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-border/40">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY */}
            {!isLoadingInvitations && !invitationsError && filteredInvitations.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground mb-4">
                  <Mail size={28} />
                </div>
                <h3 className="text-base font-bold text-foreground">No hay invitaciones registradas</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {invitationSearch || invitationStatusFilter !== 'ALL'
                    ? 'No se encontraron invitaciones que coincidan con la búsqueda.'
                    : 'Aún no se ha emitido ninguna invitación a la plataforma.'}
                </p>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => setIsInviteOpen(true)}
                  className="mt-4 text-xs font-bold"
                >
                  <UserPlus size={14} className="mr-1.5" /> Emitir Invitación
                </Button>
              </div>
            )}

            {/* LISTA */}
            {!isLoadingInvitations && !invitationsError && filteredInvitations.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Correo Electrónico</TableHead>
                    <TableHead>Rol Asignado</TableHead>
                    <TableHead className="w-[220px]">Emitida por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Emitida el</TableHead>
                    <TableHead>Expira el</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.map((inv) => {
                    const isCopied = copiedTokenId === inv.id;
                    const isDeleting = deletingInviteId === inv.id;
                    const isRefreshing = refreshingInviteId === inv.id;

                    return (
                      <TableRow key={inv.id} className="hover:bg-card/80">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border text-muted-foreground">
                              <Mail size={14} className="text-primary" />
                            </div>
                            <span className="font-semibold text-xs text-foreground font-mono">
                              {inv.email}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>{renderRoleBadge(inv.role)}</TableCell>

                        {/* Usuario que emitió la invitación */}
                        <TableCell>
                          {inv.invitedBy ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-foreground truncate">
                                {inv.invitedBy.fullName}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {inv.invitedBy.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">Sistema</span>
                          )}
                        </TableCell>

                        <TableCell>{renderInvitationStatusBadge(inv.status)}</TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleString()}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Copiar enlace directo (solo si está pendiente) */}
                            {inv.status === 'PENDING' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyInvitationRowLink(inv)}
                                disabled={isRefreshing}
                                className={`h-7 px-2 text-[11px] border-border ${
                                  isCopied
                                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                                    : 'text-primary hover:bg-primary/10'
                                }`}
                                title="Generar y copiar enlace directo de invitación"
                              >
                                {isRefreshing ? (
                                  <>
                                    <RotateCw size={12} className="mr-1 animate-spin" /> Generando...
                                  </>
                                ) : isCopied ? (
                                  <>
                                    <Check size={12} className="mr-1" /> ¡Copiado!
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} className="mr-1" /> Copiar Enlace
                                  </>
                                )}
                              </Button>
                            )}

                            {/* Eliminar / Revocar invitación (Solo si NO está aceptada) */}
                            {inv.status !== 'ACCEPTED' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteInvitation(inv)}
                                disabled={isDeleting}
                                className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 border-red-500/20"
                                title="Revocar y eliminar invitación"
                              >
                                <Trash2 size={12} className="mr-1" />
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                              </Button>
                            ) : (
                              <span
                                className="text-[10px] text-emerald-400/80 font-medium px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-500/20"
                                title="Invitación completada: no se puede eliminar por auditoría histórica"
                              >
                                Registrada
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDITAR USUARIO (NOMBRE, TELÉFONO, CORREO, ROL)          */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="max-w-md">
          {editingUser && (
            <form onSubmit={handleSaveUserEdit}>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                    <Pencil size={18} />
                  </div>
                  <DialogTitle>Modificar Información de Usuario</DialogTitle>
                </div>
                <DialogDescription>
                  Actualiza los datos personales, de contacto y el nivel de acceso en la plataforma.
                </DialogDescription>
              </DialogHeader>

              {editError && (
                <Alert variant="destructive" className="mb-4 text-xs py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              {editSuccess && (
                <Alert variant="default" className="mb-4 text-xs py-2 border-emerald-500/30 bg-emerald-950/30 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <AlertTitle>Éxito</AlertTitle>
                  <AlertDescription>Los datos han sido guardados correctamente.</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4 py-2">
                {/* Nombre completo */}
                <div className="space-y-1.5">
                  <Label htmlFor="editFullName" className="text-xs">
                    Nombre Completo
                  </Label>
                  <Input
                    id="editFullName"
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    disabled={isSubmittingEdit}
                    className="h-10 text-xs"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                {/* Correo electrónico */}
                <div className="space-y-1.5">
                  <Label htmlFor="editEmail" className="text-xs">
                    Correo Electrónico
                  </Label>
                  <Input
                    id="editEmail"
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    disabled={isSubmittingEdit}
                    className="h-10 text-xs font-mono"
                    placeholder="usuario@growthsell.com"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Modificar el correo cambiará la credencial con la que el usuario inicia sesión.
                  </p>
                </div>

                {/* Teléfonos Múltiples */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      Teléfonos / WhatsApp
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPhone}
                      disabled={isSubmittingEdit}
                      className="h-6 px-2 text-[10px] text-primary border-primary/30 hover:bg-primary/10"
                    >
                      <Plus size={11} className="mr-1" /> Agregar número
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {editPhones.map((phone, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            value={phone}
                            onChange={(e) => handlePhoneChange(idx, e.target.value)}
                            disabled={isSubmittingEdit}
                            className="pl-8 h-9 text-xs font-mono"
                            placeholder={idx === 0 ? "Ej. +57 300 123 4567 (Principal)" : "Ej. +57 311 987 6543 (Secundario)"}
                          />
                        </div>
                        {editPhones.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemovePhone(idx)}
                            disabled={isSubmittingEdit}
                            className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/30 border-red-500/20 flex-shrink-0"
                            title="Eliminar este número"
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Puedes asociar múltiples números de teléfono o WhatsApp al usuario.
                  </p>
                </div>

                {/* Rol inmutable para preservar integridad de permisos y asignaciones */}
                <div className="space-y-1.5 p-3 rounded-xl bg-card border border-border/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Rol en la Plataforma
                    </Label>
                    <div>{renderRoleBadge(editingUser.role)}</div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-1.5 leading-tight">
                    <ShieldCheck size={13} className="text-primary flex-shrink-0" />
                    El rol no puede modificarse una vez creada la cuenta para evitar conflictos en permisos y asignaciones activas de proyectos.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEditModal}
                  disabled={isSubmittingEdit}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  disabled={isSubmittingEdit}
                  className="text-xs font-bold h-9"
                >
                  {isSubmittingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: INVITAR NUEVO USUARIO                                  */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isInviteOpen} onOpenChange={closeInviteDialog}>
        <DialogContent className="max-w-md">
          {!generatedInviteUrl ? (
            <form onSubmit={handleSendInvite}>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <UserPlus size={18} />
                  </div>
                  <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
                </div>
                <DialogDescription>
                  Emite una invitación segura para incorporar directores, closers o clientes.
                </DialogDescription>
              </DialogHeader>

              {inviteError && (
                <Alert variant="destructive" className="mb-4 text-xs py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inviteEmail" className="text-xs">
                    Correo Electrónico
                  </Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="usuario@growthsell.com"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isSubmittingInvite}
                    className="h-10 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inviteName" className="text-xs">
                    Nombre Completo
                  </Label>
                  <Input
                    id="inviteName"
                    type="text"
                    placeholder="Ej. Roberto Gómez"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    disabled={isSubmittingInvite}
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inviteRole" className="text-xs">
                    Rol Asignado
                  </Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(val: any) => setInviteRole(val)}
                    disabled={isSubmittingInvite}
                  >
                    <SelectTrigger className="h-10 text-xs w-full bg-[#0E1118]">
                      <SelectValue placeholder="Selecciona el rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLOSER">Closer (Vendedor de Alto Rendimiento)</SelectItem>
                      <SelectItem value="DIRECTOR">Director Comercial</SelectItem>
                      <SelectItem value="CLIENTE">Cliente (Dueño del Infoproducto)</SelectItem>
                      {currentUser?.role !== 'ADMIN' && (
                        <>
                          <SelectItem value="ADMIN">Administrador del Sistema</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Super Administrador (Global)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    {currentUser?.role === 'ADMIN'
                      ? 'Como Administrador, puedes incorporar Directores, Closers y Clientes a la plataforma.'
                      : 'Define las vistas y permisos del usuario según la jerarquía de GrowthSell.'}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeInviteDialog}
                  disabled={isSubmittingInvite}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  disabled={isSubmittingInvite}
                  className="text-xs font-bold h-9"
                >
                  {isSubmittingInvite ? 'Generando invitación...' : 'Enviar Invitación'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 size={22} />
                  </div>
                  <DialogTitle>¡Invitación Creada Exitosamente!</DialogTitle>
                </div>
                <DialogDescription>
                  Se ha registrado a <strong>{inviteEmail}</strong> con rol {inviteRole}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3">
                <p className="text-xs text-muted-foreground">
                  El enlace directo para que el usuario acepte la invitación y establezca su contraseña es:
                </p>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-border/80">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="flex-1 bg-transparent text-xs text-primary font-mono outline-none select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={copiedLink ? 'success' : 'gold'}
                    onClick={() => copyToClipboard(generatedInviteUrl)}
                    className="h-8 px-3 text-xs font-bold flex-shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check size={14} className="mr-1" /> ¡Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="mr-1" /> Copiar
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-[11px] text-amber-200/90 leading-relaxed">
                  💡 <strong>Modo de prueba:</strong> Puedes abrir este enlace en una ventana privada o de incógnito para verificar el registro de contraseña con Argon2id y la activación automática de la cuenta.
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="gold"
                  onClick={closeInviteDialog}
                  className="w-full text-xs font-bold h-9"
                >
                  Finalizar y Volver a la Lista
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
