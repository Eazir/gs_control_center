import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Tag, 
  Pencil,
  Save,
  X,
  Package
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

export interface LeadData {
  id: string; // This is the transaction ID OR lead ID depending on the view
  leadId?: string; // This is the Lead ID if id is transaction ID
  fullName: string;
  email: string;
  phone: string;
  stageId: string;
  closerId?: string;
  closerName: string;
  productName: string;
  estimatedValue: number;
  source: string;
  createdAt: string;
  pipelineSubstatus?: string;
  history?: any[]; // History of transactions
}

export interface LeadDetailProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadData | null;
  stageName?: string;
  projectId?: string;
  activeClosers?: { id: string; name: string }[];
  pipelineStages?: { id: string; name: string }[];
  onSave?: () => void;
}

export function LeadDetailModal({ isOpen, onClose, lead, stageName, projectId, activeClosers, pipelineStages, onSave }: LeadDetailProps) {
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State - Contact
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [closerId, setCloserId] = useState<string | undefined>(undefined);

  // Form State - Transaction
  const [txnStatus, setTxnStatus] = useState('');
  const [txnStage, setTxnStage] = useState('');
  const [txnSubstatus, setTxnSubstatus] = useState('');

  useEffect(() => {
    if (lead) {
      setName(lead.fullName || '');
      setEmail(lead.email || '');
      setPhone(lead.phone || '');
      setCloserId(lead.closerId || 'unassigned');
      
      setTxnStatus('');
      setTxnStage('');
      setTxnSubstatus('');
      setIsEditingContact(false);
      setEditingTxnId(null);
    }
  }, [lead]);

  if (!lead) return null;

  const handleSaveContact = async () => {
    // If we have lead.leadId, use that (we are in Kanban where lead.id is Txn ID)
    // If we don't have lead.leadId, it means lead.id IS the Lead ID (we are in Table)
    const targetLeadId = lead.leadId || lead.id;
    if (!projectId || !targetLeadId) return;
    
    setIsSaving(true);
    try {
      const res = await fetchWithAuth(`/sales/project/${projectId}/leads/${targetLeadId}`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          closerId: closerId === 'unassigned' ? null : closerId,
        }),
      });
      if (res.ok) {
        setIsEditingContact(false);
        onSave?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTxn = async (txnId: string) => {
    if (!projectId || !txnId) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth(`/sales/project/${projectId}/transactions/${txnId}`, {
        method: 'POST',
        body: JSON.stringify({
          status: txnStatus || undefined,
          pipelineStage: txnStage === 'NO_CHANGE' || !txnStage ? undefined : txnStage,
          pipelineSubstatus: txnSubstatus === 'NO_CHANGE' || !txnSubstatus ? undefined : txnSubstatus,
        }),
      });
      if (res.ok) {
        setEditingTxnId(null);
        onSave?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Build the list of transactions to display
  const transactions = lead.history && lead.history.length > 0 ? lead.history : [{
    id: lead.id, // For Kanban, lead.id is the transaction id
    productName: lead.productName,
    amount: lead.estimatedValue,
    source: lead.source,
    createdAt: lead.createdAt,
    status: '', // Not strictly available at the top level of Kanban lead mapping right now without digging, but ok for fallback
    pipelineSubstatus: lead.pipelineSubstatus,
  }];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-[#0E1118] border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User size={18} className="text-primary" />
            Perfil del Lead
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Detalles y datos de contacto de {lead.fullName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* DATOS DE CONTACTO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                Datos de Contacto
              </h3>
              {!isEditingContact && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingContact(true)} className="h-6 text-xs text-muted-foreground hover:text-primary">
                  <Pencil size={12} className="mr-1" /> Editar
                </Button>
              )}
            </div>
            
            <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-3 text-sm">
              {isEditingContact ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Teléfono</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  {activeClosers && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Closer Asignado</Label>
                      <Select value={closerId || ''} onValueChange={setCloserId}>
                        <SelectTrigger className="h-8 text-xs bg-card">
                          <SelectValue placeholder="Seleccionar closer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Sin asignar</SelectItem>
                          {activeClosers.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsEditingContact(false)} disabled={isSaving}>
                      <X size={12} className="mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveContact} disabled={isSaving}>
                      <Save size={12} className="mr-1" /> Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Nombre:</span>
                    <span className="font-medium text-right">{lead.fullName || 'No provisto'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                    <span className="font-medium text-right flex items-center gap-1 break-all">
                      {lead.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Teléfono:</span>
                    {lead.phone ? (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Phone size={12} />
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="font-medium text-right">No provisto</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Closer Asignado:</span>
                    <span className="font-medium text-right">{lead.closerName || 'Sin asignar'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* DATOS DE NEGOCIO / TRANSACCIONES */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag size={16} className="text-primary" />
                Historial de Transacciones ({transactions.length})
              </h3>
            </div>

            <div className="space-y-3">
              {transactions.map((txn, index) => {
                const isEditing = editingTxnId === txn.id;
                
                return (
                  <div key={txn.id || index} className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Package size={14} className="text-primary" />
                        <span className="truncate max-w-[180px]" title={txn.productName}>
                          {txn.productName || 'N/A'}
                        </span>
                      </div>
                      {!isEditing && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setTxnStatus(txn.status || '');
                            setTxnSubstatus(txn.pipelineSubstatus || '');
                            setEditingTxnId(txn.id);
                          }} 
                          className="h-6 text-xs text-muted-foreground hover:text-primary px-2"
                        >
                          <Pencil size={12} className="mr-1" /> Editar Estado
                        </Button>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <span className="text-muted-foreground">Valor Estimado:</span>
                      <span className="font-mono text-primary font-bold">
                        ${Number(txn.amount || 0).toLocaleString()} USD
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Estado del Lead:</span>
                      <Badge variant="outline" className="text-[10px] text-foreground">
                        {txn.pipelineSubstatus || 'SIN ESTADO'}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Origen:</span>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                        {txn.source || lead.source}
                      </Badge>
                    </div>

                    {isEditing ? (
                      <div className="pt-3 mt-3 border-t border-border/40 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nuevo Estado de Pasarela</Label>
                          <Select value={txnStatus} onValueChange={setTxnStatus}>
                            <SelectTrigger className="h-8 text-xs bg-card">
                              <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="APPROVED">APPROVED (Aprobado)</SelectItem>
                              <SelectItem value="COMPLETED">COMPLETED (Completado)</SelectItem>
                              <SelectItem value="PENDING">PENDING (Pendiente)</SelectItem>
                              <SelectItem value="CANCELED">CANCELED (Cancelado)</SelectItem>
                              <SelectItem value="REFUNDED">REFUNDED (Reembolsado)</SelectItem>
                              <SelectItem value="CHARGEBACK">CHARGEBACK (Contracargo)</SelectItem>
                              <SelectItem value="ABANDONED_CART">ABANDONED_CART (Carrito Abandonado)</SelectItem>
                              <SelectItem value="EXPIRED">EXPIRED (Expirado)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {pipelineStages && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Nueva Etapa en Pipeline (opcional)</Label>
                            <Select value={txnStage} onValueChange={setTxnStage}>
                              <SelectTrigger className="h-8 text-xs bg-card">
                                <SelectValue placeholder="No cambiar etapa" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NO_CHANGE">No cambiar etapa</SelectItem>
                                {pipelineStages.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nuevo Estado del Lead (opcional)</Label>
                          <Select value={txnSubstatus} onValueChange={setTxnSubstatus}>
                            <SelectTrigger className="h-8 text-xs bg-card">
                              <SelectValue placeholder="No cambiar estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NO_CHANGE">No cambiar estado</SelectItem>
                              <SelectItem value="POR PAGAR">POR PAGAR</SelectItem>
                              <SelectItem value="SEGUIMIENTO">SEGUIMIENTO</SelectItem>
                              <SelectItem value="NO RESPONDE">NO RESPONDE</SelectItem>
                              <SelectItem value="NO CALIFICA">NO CALIFICA</SelectItem>
                              <SelectItem value="YA HABIA ENTRADO">YA HABIA ENTRADO</SelectItem>
                              <SelectItem value="PAGO COMPLETO">PAGO COMPLETO</SelectItem>
                              <SelectItem value="PAGO A CUOTAS">PAGO A CUOTAS</SelectItem>
                              <SelectItem value="RESERVA">RESERVA</SelectItem>
                              <SelectItem value="SIN WSP">SIN WSP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingTxnId(null)} disabled={isSaving}>
                            <X size={12} className="mr-1" /> Cancelar
                          </Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveTxn(txn.id)} disabled={isSaving}>
                            <Save size={12} className="mr-1" /> Guardar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {txn.status && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Estado Pasarela:</span>
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                              {txn.status}
                            </Badge>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                          <span className="text-muted-foreground">Fecha:</span>
                          <span className="font-medium text-right flex items-center gap-1">
                            <Calendar size={13} />
                            {new Date(txn.createdAt || lead.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

