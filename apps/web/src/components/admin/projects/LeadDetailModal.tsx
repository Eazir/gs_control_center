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
  id: string; 
  leadId?: string; 
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
  interestedProducts?: string[]; // Nueva data de productos de interes
  history?: { orderId: string; transactions: any[] }[]; // Historial agrupado
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
  const [productOfInterest, setProductOfInterest] = useState('');

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
      setProductOfInterest('');
      
      setTxnStatus('');
      setTxnStage('');
      setTxnSubstatus('');
      setIsEditingContact(false);
      setEditingTxnId(null);
    }
  }, [lead]);

  if (!lead) return null;

  const handleSaveContact = async () => {
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
          productOfInterest: productOfInterest.trim() || undefined,
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

  const orders = lead.history && lead.history.length > 0 ? lead.history : [];
  const interestedProducts = lead.interestedProducts || [];

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
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Producto de Interés a agregar</Label>
                    <Input value={productOfInterest} onChange={e => setProductOfInterest(e.target.value)} placeholder="Nombre del producto" className="h-8 text-xs bg-card" />
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

          {/* PRODUCTOS DE INTERÉS */}
          {interestedProducts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag size={16} className="text-primary" />
                Productos de Interés
              </h3>
              <div className="flex flex-wrap gap-2">
                {interestedProducts.map((p, i) => (
                  <Badge key={i} variant="secondary" className="bg-primary/20 text-primary border border-primary/30">
                    <Package size={10} className="mr-1" /> {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* DATOS DE NEGOCIO / TRANSACCIONES */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag size={16} className="text-primary" />
                Historial de Compras ({orders.length})
              </h3>
            </div>

            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-muted/30 p-4 rounded-xl border border-border/60 text-sm text-center text-muted-foreground">
                  No hay transacciones registradas.
                </div>
              ) : orders.map((order, index) => {
                const totalAmount = order.transactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
                const mainProduct = order.transactions[0]?.productName || 'Desconocido';
                
                return (
                  <div key={order.orderId || index} className="bg-muted/20 rounded-xl border border-border/60 overflow-hidden">
                    <div className="bg-muted/40 px-4 py-3 flex justify-between items-center border-b border-border/60">
                      <div>
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <Package size={14} className="text-primary" />
                          <span className="truncate max-w-[200px]" title={mainProduct}>{mainProduct}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Orden: {order.orderId}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-primary font-bold text-sm">
                          ${totalAmount.toLocaleString()} USD
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {order.transactions.length} transacción(es)
                        </div>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-border/40">
                      {order.transactions.map((txn, tIndex) => {
                        const isEditing = editingTxnId === txn.id;
                        
                        return (
                          <div key={txn.id || tIndex} className="p-4 space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className="text-[10px] text-foreground border-primary/30">
                                {txn.pipelineSubstatus || 'SIN ESTADO LEAD'}
                              </Badge>
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
                                  <Pencil size={12} className="mr-1" /> Editar
                                </Button>
                              )}
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Transacción:</span>
                              <span className="font-medium truncate max-w-[150px]" title={txn.externalTxnId}>
                                {txn.externalTxnId}
                              </span>
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
                                      <SelectItem value="APPROVED">APPROVED</SelectItem>
                                      <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                                      <SelectItem value="PENDING">PENDING</SelectItem>
                                      <SelectItem value="CANCELED">CANCELED</SelectItem>
                                      <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                                      <SelectItem value="CHARGEBACK">CHARGEBACK</SelectItem>
                                      <SelectItem value="ABANDONED_CART">ABANDONED_CART</SelectItem>
                                      <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {pipelineStages && (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Nueva Etapa en Pipeline</Label>
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
                                  <Label className="text-xs text-muted-foreground">Nuevo Estado del Lead</Label>
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
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground">Estado Pasarela:</span>
                                  <span className={txn.status === 'APPROVED' || txn.status === 'COMPLETED' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                                    {txn.status || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-1">
                                  <span className="text-muted-foreground">Fecha:</span>
                                  <span className="font-medium flex items-center gap-1">
                                    <Calendar size={11} />
                                    {new Date(txn.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
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

