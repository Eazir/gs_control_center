'use client';

import React, { useEffect, useState } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2, Eraser, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export default function SuperAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Selecciones
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Modales
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'clean-project' | 'delete-project' | 'delete-user' | null;
  }>({ isOpen: false, type: null });

  const [loadingAction, setLoadingAction] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [projRes, usersRes, meRes] = await Promise.all([
          fetchWithAuth('/projects'),
          fetchWithAuth('/auth/users'),
          fetchWithAuth('/auth/me')
        ]);
        
        if (meRes.ok) {
          const meData = await meRes.json();
          setUserRole(meData.role);
        }

        if (projRes.ok) {
          const pData = await projRes.json();
          setProjects(pData.projects || []);
        }
        
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsers(uData.users || []);
        }
      } catch (error) {
        console.error('Error cargando datos', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);
  const selectedUserObj = users.find(u => u.id === selectedUserId);

  const executeAction = async () => {
    setLoadingAction(true);
    setMessage(null);
    try {
      if (confirmModal.type === 'clean-project') {
        const res = await fetchWithAuth(`/super-admin/projects/${selectedProjectId}/clean`, { method: 'POST' });
        if (res.ok) {
          setMessage({ text: `Proyecto "${selectedProjectObj?.name}" limpiado exitosamente.`, type: 'success' });
          setSelectedProjectId('');
        } else throw new Error('Error al limpiar');
      } 
      else if (confirmModal.type === 'delete-project') {
        const res = await fetchWithAuth(`/super-admin/projects/${selectedProjectId}`, { method: 'DELETE' });
        if (res.ok) {
          setMessage({ text: `Proyecto "${selectedProjectObj?.name}" eliminado en cascada.`, type: 'success' });
          setProjects(projects.filter(p => p.id !== selectedProjectId));
          setSelectedProjectId('');
        } else throw new Error('Error al eliminar');
      } 
      else if (confirmModal.type === 'delete-user') {
        const res = await fetchWithAuth(`/super-admin/users/${selectedUserId}`, { method: 'DELETE' });
        if (res.ok) {
          setMessage({ text: `Usuario "${selectedUserObj?.fullName}" eliminado.`, type: 'success' });
          setUsers(users.filter(u => u.id !== selectedUserId));
          setSelectedUserId('');
        } else {
          const d = await res.json().catch(()=>({}));
          throw new Error(d.message || 'Error al eliminar');
        }
      }
    } catch (e: any) {
      setMessage({ text: e.message || 'Ocurrió un error inesperado.', type: 'error' });
    } finally {
      setLoadingAction(false);
      setConfirmModal({ isOpen: false, type: null });
    }
  };

  const getModalContent = () => {
    switch (confirmModal.type) {
      case 'clean-project':
        return {
          title: '¿Confirmas la limpieza del proyecto?',
          desc: `Estás a punto de borrar TODAS las ventas, leads y webhooks del proyecto "${selectedProjectObj?.name}". Esta acción es un soft-reset y afectará la contabilidad general de forma permanente.`,
          btnLabel: 'Sí, limpiar proyecto',
          btnClass: 'bg-orange-600 hover:bg-orange-700 text-white'
        };
      case 'delete-project':
        return {
          title: '¿Confirmas la eliminación del proyecto?',
          desc: `Peligro: Eliminarás completamente el proyecto "${selectedProjectObj?.name}" y todo su historial de datos (ventas, leads, webhooks, configuraciones y accesos de miembros). Esta acción es destructiva e irreversible.`,
          btnLabel: 'Sí, eliminar en cascada',
          btnClass: 'bg-red-600 hover:bg-red-700 text-white'
        };
      case 'delete-user':
        return {
          title: '¿Confirmas la eliminación del usuario?',
          desc: `Estás a punto de eliminar al usuario "${selectedUserObj?.fullName} (${selectedUserObj?.email})". Se eliminarán sus accesos y se mantendrán sus ventas con el identificador de closer nulo para no afectar las finanzas.`,
          btnLabel: 'Sí, eliminar usuario',
          btnClass: 'bg-red-600 hover:bg-red-700 text-white'
        };
      default:
        return { title: '', desc: '', btnLabel: '', btnClass: '' };
    }
  };

  const modalInfo = getModalContent();

  if (userRole && userRole !== 'SUPER_ADMIN') {
    return (
      <AdminShell title="Zona de Peligro">
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95">
          <AlertTriangle size={64} className="text-destructive mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Acceso Denegado</h2>
          <p className="text-muted-foreground mt-3 text-center max-w-md text-base">
            Esta área es estrictamente para administradores de sistema (SUPER_ADMIN).
            Tus credenciales no tienen autorización para ejecutar acciones de nivel raíz.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Zona de Peligro">
      <div className="max-w-4xl mx-auto space-y-6 pt-4">
        
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-red-500 flex items-center gap-2">
            <AlertTriangle size={24} />
            Mantenimiento y Zona de Peligro
          </h1>
          <p className="text-muted-foreground mt-2">
            Ejecuta acciones destructivas exclusivas para el <b>SUPER_ADMIN</b>. Las acciones realizadas aquí saltan los controles de seguridad convencionales y alteran la base de datos de manera definitiva.
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-md text-sm font-medium border ${message.type === 'success' ? 'bg-green-950/30 text-green-400 border-green-900' : 'bg-red-950/30 text-red-400 border-red-900'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* MANTENIMIENTO DE PROYECTOS */}
          <Card className="border-red-900/40 bg-red-950/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eraser size={18} className="text-orange-500" />
                Proyectos
              </CardTitle>
              <CardDescription>
                Limpieza profunda o eliminación estructural de proyectos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecciona un Proyecto</Label>
                <Select disabled={isLoading} value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full border-red-900/30">
                    <SelectValue placeholder={isLoading ? 'Cargando proyectos...' : 'Elegir proyecto...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} <span className="text-muted-foreground text-xs ml-1">({p.slug})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="w-full text-orange-500 border-orange-900/50 hover:bg-orange-950/30 hover:text-orange-400"
                  disabled={!selectedProjectId || loadingAction}
                  onClick={() => setConfirmModal({ isOpen: true, type: 'clean-project' })}
                >
                  <Eraser size={16} className="mr-2" />
                  Limpiar Proyecto
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={!selectedProjectId || loadingAction}
                  onClick={() => setConfirmModal({ isOpen: true, type: 'delete-project' })}
                >
                  <Trash2 size={16} className="mr-2" />
                  Eliminar Proyecto
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ELIMINACIÓN DE USUARIOS */}
          <Card className="border-red-900/40 bg-red-950/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trash2 size={18} className="text-red-500" />
                Usuarios
              </CardTitle>
              <CardDescription>
                Baja definitiva en cascada de miembros del equipo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecciona un Usuario</Label>
                <Select disabled={isLoading} value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full border-red-900/30">
                    <SelectValue placeholder={isLoading ? 'Cargando usuarios...' : 'Elegir usuario...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} <span className="text-muted-foreground text-xs ml-1">- {u.role}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={!selectedUserId || loadingAction}
                  onClick={() => setConfirmModal({ isOpen: true, type: 'delete-user' })}
                >
                  <Trash2 size={16} className="mr-2" />
                  Eliminar Cascada
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      <Dialog open={confirmModal.isOpen} onOpenChange={(val) => !loadingAction && setConfirmModal(prev => ({ ...prev, isOpen: val }))}>
        <DialogContent className="border-red-900/50 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <AlertTriangle size={20} />
              {modalInfo.title}
            </DialogTitle>
            <DialogDescription className="pt-3 text-sm leading-relaxed text-foreground/80">
              {modalInfo.desc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setConfirmModal({ isOpen: false, type: null })}
              disabled={loadingAction}
            >
              Cancelar
            </Button>
            <Button 
              className={modalInfo.btnClass}
              onClick={executeAction}
              disabled={loadingAction}
            >
              {loadingAction && <Loader2 size={16} className="animate-spin mr-2" />}
              {modalInfo.btnLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
