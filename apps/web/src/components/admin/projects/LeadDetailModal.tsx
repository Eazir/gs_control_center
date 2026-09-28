import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Tag, 
  DollarSign,
  Package
} from 'lucide-react';

export interface LeadData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  stageId: string;
  closerName: string;
  productName: string;
  estimatedValue: number;
  source: string;
  createdAt: string;
}

export interface LeadDetailProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadData | null;
  stageName?: string;
}

export function LeadDetailModal({ isOpen, onClose, lead, stageName }: LeadDetailProps) {
  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-[#0E1118] border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User size={18} className="text-primary" />
            Perfil del Prospecto
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Detalles y datos de contacto de {lead.fullName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* DATOS DE CONTACTO */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail size={16} className="text-primary" />
              Datos de Contacto
            </h3>
            <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-3 text-sm">
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
            </div>
          </div>

          {/* DATOS DE NEGOCIO */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Tag size={16} className="text-primary" />
              Información Comercial
            </h3>
            <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Producto:</span>
                <span className="font-medium text-right truncate max-w-[200px]" title={lead.productName}>
                  {lead.productName || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valor Estimado:</span>
                <span className="font-mono text-primary font-bold">
                  ${lead.estimatedValue.toLocaleString()} USD
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Etapa Actual:</span>
                <Badge variant="outline" className="text-xs">
                  {stageName || lead.stageId}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Closer Asignado:</span>
                <span className="font-medium text-right">{lead.closerName || 'Sin asignar'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Origen:</span>
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                  {lead.source}
                </Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted-foreground">Creado el:</span>
                <span className="font-medium text-right flex items-center gap-1">
                  <Calendar size={13} />
                  {new Date(lead.createdAt).toLocaleDateString()}
                </span>
              </div>
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
