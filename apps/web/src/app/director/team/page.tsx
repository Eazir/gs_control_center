'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Phone,
  Mail,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/admin-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchWithAuth } from '@/lib/api-client';

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
}

interface CloserUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleInProject: string;
  userName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  assignedAt: string;
}

export default function DirectorTeamManagementPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [registeredClosers, setRegisteredClosers] = useState<CloserUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vincular Closer Registrado
  const [selectedCloserIdToAssign, setSelectedCloserIdToAssign] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Invitar Nuevo Closer
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Cargar proyectos y closers registrados
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projRes, usersRes] = await Promise.all([
        fetchWithAuth('/projects'),
        fetchWithAuth('/auth/users/active-closers'),
      ]);

      if (projRes.ok) {
        const projData = await projRes.json();
        const list: ProjectItem[] = projData.projects || [];
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId((prev) => prev || list[0]?.id || '');
        }
      }

      if (usersRes.ok) {
        const userData = await usersRes.json();
        const usersList: CloserUser[] = userData.users || userData || [];
        // El endpoint ya retorna solo closers ACTIVE, no se necesita filtro adicional
        setRegisteredClosers(Array.isArray(usersList) ? usersList : []);
      }
    } catch {
      setError('Error al cargar proyectos y usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar miembros del proyecto seleccionado
  const loadProjectMembers = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetchWithAuth(`/projects/${projId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.members || []);
      }
    } catch {
      // Ignorar fallo puntual
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectMembers(selectedProjectId);
    }
  }, [selectedProjectId, loadProjectMembers]);

  // Closers en el proyecto actual
  const closersInProject = useMemo(() => {
    return members.filter((m) => m.roleInProject === 'CLOSER');
  }, [members]);

  // Closers registrados que aún no están en este proyecto
  const availableClosersToAssign = useMemo(() => {
    const assignedIds = new Set(closersInProject.map((m) => m.userId));
    return registeredClosers.filter((u) => !assignedIds.has(u.id));
  }, [registeredClosers, closersInProject]);

  // Acción: Vincular Closer Registrado
  const handleAssignCloser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedCloserIdToAssign) return;

    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(false);

    try {
      const res = await fetchWithAuth(`/projects/${selectedProjectId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedCloserIdToAssign,
          roleInProject: 'CLOSER',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al asignar closer al proyecto.');
      }

      await loadProjectMembers(selectedProjectId);
      setSelectedCloserIdToAssign('');
      setAssignSuccess(true);
      setTimeout(() => setAssignSuccess(false), 3000);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Acción: Remover Closer del Proyecto
  const handleRemoveCloser = async (member: ProjectMember) => {
    if (!confirm(`¿Deseas desvincular a ${member.userName || 'este closer'} del proyecto?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/projects/${selectedProjectId}/members/${member.userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('No se pudo desvincular al closer.');
      }

      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desvincular.');
    }
  };

  // Acción: Invitar Nuevo Closer
  const handleInviteCloser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInvite(true);
    setInviteError(null);

    try {
      const res = await fetchWithAuth('/auth/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          fullName: inviteName.trim(),
          role: 'CLOSER', // Siempre closer
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al emitir invitación.');
      }

      setGeneratedInviteUrl(data.inviteUrl || data.url);
      loadInitialData(); // Refrescar lista de usuarios registrados
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error al enviar invitación.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const copyToClipboard = (text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const closeInviteModal = () => {
    setIsInviteOpen(false);
    setGeneratedInviteUrl(null);
    setInviteEmail('');
    setInviteName('');
    setInviteError(null);
    setCopiedLink(false);
  };

  return (
    <AdminShell title="Gestión de Equipo Comercial">
      <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-2">
              <Users size={12} />
              Dirección Comercial
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gestión de Equipo de Closers
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Administra los vendedores asignados a tus proyectos, vincula closers registrados e invita nuevos miembros a la fuerza de ventas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="gold"
              onClick={() => setIsInviteOpen(true)}
              className="font-bold text-xs h-9 shadow-lg"
            >
              <UserPlus size={15} className="mr-1.5" />
              Invitar Nuevo Closer
            </Button>
          </div>
        </div>

        {/* Selector de Proyecto Activo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card/60 border border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FolderKanban size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Proyecto Activo a Gestionar
              </span>
              <span className="text-xs text-muted-foreground">
                Selecciona la unidad comercial donde deseas supervisar los closers asignados.
              </span>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-10 text-xs w-full">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Panel de Dos Columnas: Lista de Closers vs Asignar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Lista de Closers del Proyecto (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  Closers en este Proyecto ({closersInProject.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Vendedores activos que reciben leads y agendan llamadas en este pipeline.
                </p>
              </div>
            </div>

            {closersInProject.length === 0 ? (
              <Card className="bg-card/40 border-border p-8 text-center">
                <Users size={32} className="mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-xs font-semibold text-foreground">No hay closers asignados en este proyecto</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Usa el panel lateral derecho para asignar un closer registrado o invitar uno nuevo.
                </p>
              </Card>
            ) : (
              <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="text-xs">Closer</TableHead>
                      <TableHead className="text-xs">Contacto</TableHead>
                      <TableHead className="text-xs">Asignado el</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closersInProject.map((member) => (
                      <TableRow key={member.userId} className="border-border/40">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-xs">
                              {member.userName ? member.userName.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-foreground block">
                                {member.userName || 'Closer Comercial'}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {member.userEmail}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                            <Phone size={12} className="text-primary" />
                            {member.userPhone || 'Sin teléfono registrado'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(member.assignedAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveCloser(member)}
                            className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 border-red-500/20"
                            title="Desvincular closer del proyecto"
                          >
                            <Trash2 size={12} className="mr-1" />
                            Desvincular
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Columna Derecha: Vincular Closer Registrado (1 col) */}
          <div className="space-y-4">
            <Card className="bg-card border-border p-5">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Plus size={16} className="text-primary" />
                  Vincular Closer Registrado
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Selecciona a un closer existente en la base de datos de GrowthSell para sumarlo a este proyecto.
                </CardDescription>
              </CardHeader>

              {assignError && (
                <Alert variant="destructive" className="mb-3 py-2 text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{assignError}</AlertDescription>
                </Alert>
              )}

              {assignSuccess && (
                <Alert variant="success" className="mb-3 py-2 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>¡Closer asignado al proyecto exitosamente!</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleAssignCloser} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Closer Disponible</Label>
                  {availableClosersToAssign.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-2 rounded-lg bg-card/40 border border-border">
                      No hay más closers registrados pendientes de vincular. Puedes invitar closers nuevos arriba.
                    </p>
                  ) : (
                    <Select value={selectedCloserIdToAssign} onValueChange={setSelectedCloserIdToAssign}>
                      <SelectTrigger className="h-10 text-xs w-full">
                        <SelectValue placeholder="Seleccionar closer registrado..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Seleccionar closer registrado...</SelectItem>
                        {availableClosersToAssign.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.fullName} ({c.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="gold"
                  disabled={isAssigning || !selectedCloserIdToAssign}
                  className="w-full text-xs font-bold h-9"
                >
                  {isAssigning ? 'Asignando...' : 'Sumar al Proyecto'}
                </Button>
              </form>
            </Card>

            {/* Tarjeta de Resumen */}
            <Card className="bg-card/40 border-border p-4 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Privilegios del Director
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Como Director Comercial, tienes facultades para incorporar vendedores a tus unidades y regular la carga de leads del pipeline.
              </p>
            </Card>
          </div>
        </div>

        {/* Modal: Invitar Nuevo Closer */}
        <Dialog open={isInviteOpen} onOpenChange={closeInviteModal}>
          <DialogContent className="max-w-md">
            {!generatedInviteUrl ? (
              <form onSubmit={handleInviteCloser}>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <UserPlus size={18} />
                    </div>
                    <DialogTitle>Invitar Nuevo Closer</DialogTitle>
                  </div>
                  <DialogDescription>
                    Envía una invitación formal para incorporar un nuevo vendedor a la fuerza de ventas.
                  </DialogDescription>
                </DialogHeader>

                {inviteError && (
                  <Alert variant="destructive" className="mb-4 text-xs py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{inviteError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="inviteEmail" className="text-xs">Correo Electrónico</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      required
                      placeholder="closer@growthsell.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={isSubmittingInvite}
                      className="h-10 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inviteName" className="text-xs">Nombre Completo</Label>
                    <Input
                      id="inviteName"
                      type="text"
                      required
                      placeholder="Ej. Andrés Ramírez"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      disabled={isSubmittingInvite}
                      className="h-10 text-xs"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/60">
                    <span className="text-[11px] font-semibold text-muted-foreground block">Rol Asignado</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="gold" className="text-[10px]">CLOSER</Badge>
                      <span className="text-[11px] text-muted-foreground">Vendedor de Alto Rendimiento</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeInviteModal}
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
                    {isSubmittingInvite ? 'Generando...' : 'Generar Invitación'}
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
                    Se ha generado el enlace de invitación para <strong>{inviteEmail}</strong> como Closer.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Comparte este enlace directo con el vendedor para que active su cuenta:
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
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="gold"
                    onClick={closeInviteModal}
                    className="w-full text-xs font-bold h-9"
                  >
                    Listo
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
