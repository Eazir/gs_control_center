import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  CreditCard, 
  Calendar, 
  Hash, 
  Tag, 
  Package, 
  Users,
  Megaphone,
  ExternalLink,
  Clock,
  ArrowRight
} from 'lucide-react';
import { LeadDetailModal, LeadData } from './LeadDetailModal';

export interface TransactionHistoryEntry {
  id: string;
  status: string;
  externalTxnId?: string | null;
  productName?: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
  source?: string | null;
  sck?: string | null;
}

export interface TransactionData {
  id?: string;
  status: string;
  externalTxnId?: string;
  externalOrderId?: string;
  createdAt: string | Date;
  paymentMethod?: string;
  productName?: string;
  amount?: number | string;
  currency?: string;
  installments?: number;
  offerCode?: string;
  sck?: string;
  closerId?: string | null;
  closerName?: string | null;
  closerEmail?: string | null;
  attribution?: 'COMERCIAL' | 'MARKETING';
  metadata?: unknown;
  source?: string | null;
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  history?: TransactionHistoryEntry[];
}

export interface TransactionDetailProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
}

/**
 * Componente modal para inspeccionar a detalle una transacción o venta específica.
 * Muestra información del comprador (Lead), datos técnicos de la transacción (orden, ID de proveedor, SCK, offer code),
 * producto oficial del proyecto, método de pago, atribución de closer, estado y el historial de eventos (trazabilidad real).
 */
export function TransactionDetailModal({ isOpen, onClose, transaction }: TransactionDetailProps) {
  const [isLeadModalOpen, setIsLeadModalOpen] = React.useState(false);

  if (!transaction) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PURCHASE_APPROVED':
        return <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 font-medium hover:bg-teal-500/20">COMPRA APROBADA</Badge>;
      case 'APPROVED':
        return <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 font-medium hover:bg-teal-500/20">APROBADA</Badge>;
      case 'COMPLETE':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium hover:bg-emerald-500/20">COMPLETADA</Badge>;
      case 'PENDING':
      case 'WAITING_PAYMENT':
      case 'BILLET_PRINTED':
        return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 font-medium hover:bg-amber-500/20">PENDIENTE</Badge>;
      case 'REFUNDED':
        return <Badge className="bg-red-500/15 text-red-500 border-red-500/30 font-medium">REEMBOLSADA</Badge>;
      case 'CHARGEBACK':
        return <Badge className="bg-red-500/15 text-red-500 border-red-500/30 font-medium">CHARGEBACK</Badge>;
      case 'CANCELED':
        return <Badge className="bg-red-500/15 text-red-500 border-red-500/30 font-medium">CANCELADA</Badge>;
      case 'ABANDONED_CART':
        return <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 font-medium">CARRITO ABANDONADO</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/30 font-medium">EXPIRADA</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | Date) => new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedDate = formatDate(transaction.createdAt);

  // Determinar atribución: usa el campo del backend si existe, si no infiere por closerName/closerId
  const isComercial = transaction.attribution === 'COMERCIAL' || !!(transaction.closerName || transaction.closerId);
  const attributionLabel = isComercial ? 'Atribución Comercial' : 'Atribución Marketing';
  const attributionSub = isComercial
    ? `Venta asignada a: ${transaction.closerName || transaction.closerEmail || 'Closer asignado'}`
    : 'Venta orgánica / sin closer asignado.';
  const saleTypeLabel = isComercial ? 'Cerrado' : 'Orgánica';

  // Historial de trazabilidad: ordenar por fecha ascendente para mostrar la línea de tiempo
  const sortedHistory = [...(transaction.history ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] bg-card border-border/60 max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Detalle de Transacción
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1 text-sm">
                Inspección profunda y trazabilidad técnica
              </DialogDescription>
            </div>
            {getStatusBadge(transaction.status)}
          </div>
        </DialogHeader>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* DATOS DEL COMPRADOR */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User size={16} className="text-primary" />
                Datos del Comprador
              </h3>
              <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nombre:</span>
                  <span className="font-medium text-right">{transaction.lead?.name || 'No provisto'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                  <span className="font-medium text-right flex items-center gap-1 break-all">
                    {transaction.lead?.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-medium text-right">{transaction.lead?.phone || 'No provisto'}</span>
                </div>
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full text-xs h-8 border-primary/20 text-primary hover:bg-primary/10"
                    onClick={() => setIsLeadModalOpen(true)}
                  >
                    <ExternalLink size={14} className="mr-2" />
                    Ver perfil del Lead
                  </Button>
                </div>
              </div>
            </div>

            {/* DATOS DE LA TRANSACCIÓN */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Hash size={16} className="text-primary" />
                Datos de la Transacción
              </h3>
              <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Cód. Transacción (Provider):</span>
                  <span className="font-mono bg-background px-2 py-1 rounded text-xs break-all">
                    {transaction.externalTxnId || 'N/A'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Orden Externa:</span>
                  <span className="font-mono bg-background px-2 py-1 rounded text-xs break-all">
                    {transaction.externalOrderId || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground flex items-center gap-1"><Calendar size={14} /> Fecha:</span>
                  <span className="font-medium text-right">
                    {formattedDate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1"><CreditCard size={14} /> Método:</span>
                  <span className="font-medium text-right capitalize">{transaction.paymentMethod || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* PRODUCTO Y OFERTA */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Package size={16} className="text-primary" />
                Producto y Aspectos Financieros
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                  <div className="text-xs text-muted-foreground mb-1">Producto</div>
                  <div className="font-medium text-sm truncate" title={transaction.productName}>
                    {transaction.productName || 'N/A'}
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                  <div className="text-xs text-muted-foreground mb-1">Total Pagado</div>
                  <div className="font-bold text-sm text-emerald-500">
                    {formatMoney(Number(transaction.amount || 0), transaction.currency || 'USD')}
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                  <div className="text-xs text-muted-foreground mb-1">Cuotas Registradas</div>
                  <div className="font-medium text-sm">
                    {transaction.installments || 1} cuota{(transaction.installments || 1) > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Tag size={12} /> Cód. Oferta
                  </div>
                  <div className="font-mono text-sm bg-background/50 px-1 rounded inline-block">
                    {transaction.offerCode || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* ATRIBUCIÓN COMERCIAL / MARKETING */}
            <div className="space-y-4 md:col-span-2">
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isComercial 
                  ? 'bg-primary/5 border-primary/20' 
                  : 'bg-purple-500/5 border-purple-500/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isComercial ? 'bg-primary/20' : 'bg-purple-500/20'}`}>
                    {isComercial 
                      ? <Users size={18} className="text-primary" />
                      : <Megaphone size={18} className="text-purple-400" />
                    }
                  </div>
                  <div>
                    <h4 className={`font-semibold text-sm ${isComercial ? 'text-foreground' : 'text-purple-300'}`}>
                      {attributionLabel}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{attributionSub}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                  <Badge variant="outline" className={isComercial 
                    ? 'border-primary/30 text-primary' 
                    : 'border-purple-500/30 text-purple-400'
                  }>
                    {saleTypeLabel}
                  </Badge>
                  {transaction.sck && (
                    <div className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-border/50 mt-1">
                      SCK: {transaction.sck}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* HISTORIAL DE TRAZABILIDAD */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Historial de Eventos (Trazabilidad)
              </h3>
              {sortedHistory.length > 0 ? (
                <div className="relative space-y-0">
                  {sortedHistory.map((entry, idx) => (
                    <div key={entry.id} className="flex gap-3">
                      {/* Línea de tiempo vertical */}
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0 ring-2 ring-background" />
                        {idx < sortedHistory.length - 1 && (
                          <div className="w-px flex-1 bg-border/60 my-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(entry.status)}
                          <span className="text-[11px] text-muted-foreground">{formatDate(entry.createdAt)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-mono truncate max-w-[200px]" title={entry.externalTxnId ?? undefined}>{entry.externalTxnId || 'N/A'}</span>
                          {entry.source && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{entry.source}</Badge>
                          )}
                          <span className="font-semibold text-foreground">${entry.amount.toLocaleString()}</span>
                        </div>
                      </div>
                      {idx < sortedHistory.length - 1 && (
                        <ArrowRight size={12} className="text-muted-foreground/40 mt-1.5 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Si no hay historial (ej. desde lista de ventas), mostrar la transacción actual como único evento
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0 ring-2 ring-background" />
                  </div>
                  <div className="pb-2 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(transaction.status)}
                      <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                      {transaction.externalTxnId || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </DialogContent>

      <LeadDetailModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        lead={transaction.lead ? {
          id: transaction.lead.email || 'unknown',
          fullName: transaction.lead.name || 'No provisto',
          email: transaction.lead.email || '',
          phone: transaction.lead.phone || '',
          stageId: 'unknown',
          closerName: transaction.closerName || 'Sin asignar',
          productName: transaction.productName || 'N/A',
          estimatedValue: Number(transaction.amount) || 0,
          source: 'N/A',
          createdAt: String(transaction.createdAt),
        } : null}
        stageName=""
      />
    </Dialog>
  );
}
