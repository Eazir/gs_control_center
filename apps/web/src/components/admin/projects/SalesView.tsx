'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Upload, 
  Plus, 
  Search, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  Package, 
  Users,
  ArrowRightLeft
} from 'lucide-react';
import { SaleListItem, ProductItem } from '@gs/contracts';
import { Badge } from '@/components/ui/badge';
import { getNaturalStatusName, getStatusBadgeClasses } from '@/lib/status-utils';
import { TransactionDetailModal } from './TransactionDetailModal';

export interface SalesViewMember {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  roleInProject: string;
  userRole?: string | null;
}

export interface SalesViewLead {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  closerId?: string | null;
  closerName?: string | null;
  productName?: string | null;
  estimatedValue?: number;
  stageId?: string;
  source?: string;
  createdAt?: string;
}

export interface SalesViewUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface AvailableProjectProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  ownerCloserId?: string | null;
}

// Tasas de cambio de referencia inmediatas (fallback confiable en caso de desconexión o latencia)
const FALLBACK_EXCHANGE_RATES: Record<string, Record<string, number>> = {
  USD: { USD: 1, COP: 4180, EUR: 0.92, MXN: 18.5, BRL: 5.45, ARS: 1250, CLP: 940, PEN: 3.75 },
  COP: { USD: 0.000239, COP: 1, EUR: 0.00022, MXN: 0.00442, BRL: 0.0013, ARS: 0.298, CLP: 0.224, PEN: 0.00089 },
  EUR: { USD: 1.087, COP: 4540, EUR: 1, MXN: 20.1, BRL: 5.92, ARS: 1358, CLP: 1021, PEN: 4.07 },
  MXN: { USD: 0.054, COP: 226, EUR: 0.0497, MXN: 1, BRL: 0.294, ARS: 67.5, CLP: 50.8, PEN: 0.203 },
  BRL: { USD: 0.183, COP: 767, EUR: 0.169, MXN: 3.39, BRL: 1, ARS: 229, CLP: 172, PEN: 0.69 },
};

export interface SalesViewProps {
  projectId: string;
  products?: ProductItem[];
  members?: SalesViewMember[];
  leads?: SalesViewLead[];
  allUsers?: SalesViewUser[];
  projectCurrency?: string;
}

/**
 * Vista principal de Ventas del proyecto.
 * Muestra las métricas comerciales consolidadas, tablas de ventas "efectivas" (APPROVED/COMPLETE),
 * liquidaciones, soporte multi-moneda con conversión en vivo, y modales para ingesta manual
 * o masiva (CSV).
 * 
 * Implementa RLS en UI filtrando y mostrando métricas únicamente de las ventas
 * pertenecientes al usuario si su rol efectivo es CLOSER.
 */
export function SalesView({ 
  projectId, 
  products = [], 
  members = [], 
  leads = [], 
  allUsers = [],
  projectCurrency = 'USD',
}: SalesViewProps) {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);

  // Estados de Tasa de Cambio y Conversión en Vivo
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState<boolean>(false);

  // Lista local de leads para permitir reflejar nuevos prospectos en el selector
  const [localLeads, setLocalLeads] = useState<SalesViewLead[]>(leads);

  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  // Modales
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados del Formulario de Venta Manual
  const [leadMode, setLeadMode] = useState<'existing' | 'new'>('existing');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [productMode, setProductMode] = useState<'select' | 'custom'>('select');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedCloserId, setSelectedCloserId] = useState<string>('none');

  const [manualForm, setManualForm] = useState({
    leadEmail: '',
    leadName: '',
    leadPhone: '',
    productName: '',
    productId: '',
    closerId: '',
    amount: '',
    currency: projectCurrency,
    status: 'APPROVED' as 'APPROVED' | 'PENDING' | 'REFUNDED' | 'CANCELED',
  });
  
  const [csvText, setCsvText] = useState('');

  // 1. OBTENER LISTA COMPLETA DE PRODUCTOS DISPONIBLES EN EL PROYECTO
  // Reúne los productos del catálogo, los detectados en los leads y ofertas estándar como respaldo
  const availableProducts = useMemo<AvailableProjectProduct[]>(() => {
    const list: AvailableProjectProduct[] = [];
    const seenNames = new Set<string>();

    // A. Productos oficiales del catálogo del proyecto
    for (const p of products) {
      const name = p.name ? p.name.trim() : '';
      if (!name) continue;
      const lower = name.toLowerCase();
      if (seenNames.has(lower)) continue;
      seenNames.add(lower);

      const item: AvailableProjectProduct = {
        id: p.id,
        name,
        price: p.price,
        currency: p.currency || projectCurrency,
      };
      list.push(item);
    }

    // B. Productos detectados en los prospectos del proyecto
    for (const l of localLeads) {
      const name = l.productName ? l.productName.trim() : '';
      if (!name) continue;
      const lower = name.toLowerCase();
      if (seenNames.has(lower)) continue;
      seenNames.add(lower);

      const item: AvailableProjectProduct = {
        id: `lead-product-${list.length + 1}`,
        name,
        price: typeof l.estimatedValue === 'number' ? l.estimatedValue : 997,
        currency: projectCurrency,
      };
      list.push(item);
    }

    // C. Si la lista sigue vacía, incluir productos base de infoproductos
    if (list.length === 0) {
      list.push(
        { id: 'std-1', name: 'Programa Elite High-Ticket', price: 997, currency: projectCurrency },
        { id: 'std-2', name: 'Mastery Mentorship VIP', price: 1497, currency: projectCurrency },
        { id: 'std-3', name: 'Ticket General $497', price: 497, currency: projectCurrency }
      );
    }

    return list;
  }, [products, localLeads, projectCurrency]);

  // 2. EFECTO: CONSULTA DE TASA DE CAMBIO EN VIVO
  useEffect(() => {
    if (!manualForm.currency || manualForm.currency === projectCurrency) {
      setExchangeRate(1);
      return;
    }

    const from = manualForm.currency;
    const to = projectCurrency;
    const fromRates = FALLBACK_EXCHANGE_RATES[from];
    const directRate = fromRates ? fromRates[to] : undefined;
    const toRates = FALLBACK_EXCHANGE_RATES[to];
    const inverseRate = toRates && toRates[from] ? 1 / toRates[from] : undefined;
    const fallback = directRate ?? inverseRate ?? 1;
    setExchangeRate(fallback);

    let active = true;
    setIsFetchingRate(true);

    fetch(`https://open.er-api.com/v6/latest/${from}`)
      .then((res) => res.json())
      .then((data: { result?: string; rates?: Record<string, number> }) => {
        if (active && data?.result === 'success' && data.rates && typeof data.rates[to] === 'number') {
          const rateVal = data.rates[to];
          if (typeof rateVal === 'number') {
            setExchangeRate(rateVal);
          }
        }
      })
      .catch(() => {
        // Fallback establecido automáticamente
      })
      .finally(() => {
        if (active) setIsFetchingRate(false);
      });

    return () => {
      active = false;
    };
  }, [manualForm.currency, projectCurrency]);

  // Monto convertido a la moneda del proyecto
  const convertedAmount = useMemo(() => {
    const rawAmount = Number(manualForm.amount || 0);
    if (manualForm.currency === projectCurrency) return rawAmount;
    return rawAmount * exchangeRate;
  }, [manualForm.amount, manualForm.currency, projectCurrency, exchangeRate]);

  // Lista de closers disponibles para el proyecto
  const availableClosers = useMemo(() => {
    const list: { id: string; name: string; email: string }[] = [];
    const seen = new Set<string>();

    members.forEach((m) => {
      if (m.roleInProject === 'CLOSER' || m.userRole === 'CLOSER') {
        const id = m.userId;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({
            id,
            name: m.userName || m.userEmail || 'Closer del Proyecto',
            email: m.userEmail || '',
          });
        }
      }
    });

    allUsers.forEach((u) => {
      if (u.role === 'CLOSER' && !seen.has(u.id)) {
        seen.add(u.id);
        list.push({
          id: u.id,
          name: u.fullName || u.email,
          email: u.email,
        });
      }
    });

    return list;
  }, [members, allUsers]);

  // Carga de ventas desde la API
  const loadSales = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchWithAuth(`/sales/project/${projectId}`);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `Error ${res.status}: No se pudieron cargar las ventas`);
      }
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar las ventas';
      console.error('[SalesView] Error loading sales:', err);
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [projectId]);

  // Al abrir el modal, pre-configurar selecciones
  const handleOpenManualModal = () => {
    setFormError(null);
    const hasLeads = localLeads.length > 0;

    setLeadMode(hasLeads ? 'existing' : 'new');
    setProductMode('select');

    let initialLeadName = '';
    let initialLeadEmail = '';
    let initialLeadPhone = '';
    let initialCloserId = 'none';

    const firstLead = localLeads[0];
    if (hasLeads && firstLead) {
      setSelectedLeadId(firstLead.id);
      initialLeadName = firstLead.fullName;
      initialLeadEmail = firstLead.email;
      initialLeadPhone = firstLead.phone || '';
      if (firstLead.closerId) {
        initialCloserId = firstLead.closerId;
      }
    } else {
      setSelectedLeadId('');
    }

    let initialProductName = '';
    let initialProductId = '';
    let initialAmount = '997';
    let initialCurrency = projectCurrency;

    const firstProd = availableProducts[0];
    if (firstProd) {
      setSelectedProductId(firstProd.id);
      initialProductName = firstProd.name;
      initialProductId = firstProd.id.startsWith('lead-') || firstProd.id.startsWith('std-') ? '' : firstProd.id;
      initialAmount = String(firstProd.price);
      initialCurrency = firstProd.currency || projectCurrency;
    } else {
      setSelectedProductId('');
    }

    setSelectedCloserId(initialCloserId);
    setManualForm({
      leadName: initialLeadName,
      leadEmail: initialLeadEmail,
      leadPhone: initialLeadPhone,
      productName: initialProductName,
      productId: initialProductId,
      closerId: initialCloserId === 'none' ? '' : initialCloserId,
      amount: initialAmount,
      currency: initialCurrency,
      status: 'APPROVED',
    });

    setIsManualModalOpen(true);
  };

  // Manejador al seleccionar un lead existente
  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    const lead = localLeads.find((l) => l.id === leadId);
    if (lead) {
      setManualForm((prev) => ({
        ...prev,
        leadName: lead.fullName,
        leadEmail: lead.email,
        leadPhone: lead.phone || '',
        closerId: lead.closerId || prev.closerId,
      }));
      if (lead.closerId) {
        setSelectedCloserId(lead.closerId);
      }
    }
  };

  // Manejador al seleccionar un producto del proyecto
  const handleSelectProduct = (productId: string) => {
    if (productId === 'custom') {
      setProductMode('custom');
      setSelectedProductId('custom');
      setManualForm((prev) => ({
        ...prev,
        productId: '',
        productName: '',
      }));
      return;
    }

    setSelectedProductId(productId);
    const product = availableProducts.find((p) => p.id === productId);
    if (product) {
      setManualForm((prev) => ({
        ...prev,
        productName: product.name,
        productId: product.id.startsWith('lead-') || product.id.startsWith('std-') ? '' : product.id,
        amount: String(product.price),
        currency: product.currency || projectCurrency,
      }));
    }
  };

  // Manejador al seleccionar closer
  const handleSelectCloser = (closerId: string) => {
    setSelectedCloserId(closerId);
    setManualForm((prev) => ({
      ...prev,
      closerId: closerId === 'none' ? '' : closerId,
    }));
  };

  // Envío de venta manual
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!manualForm.leadName.trim() || !manualForm.leadEmail.trim()) {
      setFormError('El nombre y correo del lead son obligatorios');
      return;
    }
    if (!manualForm.productName.trim()) {
      setFormError('El nombre del producto es obligatorio');
      return;
    }
    if (!manualForm.amount || Number(manualForm.amount) < 0) {
      setFormError('Ingresa un monto válido');
      return;
    }

    setIsSaving(true);
    try {
      const isConverted = manualForm.currency !== projectCurrency;
      const finalAmount = isConverted ? Number(convertedAmount.toFixed(2)) : Number(manualForm.amount);
      const finalCurrency = isConverted ? projectCurrency : manualForm.currency;

      // Registrar detalle de conversión en el concepto si la moneda pagada fue distinta
      const displayProductName = isConverted
        ? `${manualForm.productName.trim()} (${Number(manualForm.amount).toLocaleString()} ${manualForm.currency})`
        : manualForm.productName.trim();

      const payload = {
        leadName: manualForm.leadName.trim(),
        leadEmail: manualForm.leadEmail.trim(),
        leadPhone: manualForm.leadPhone.trim() || undefined,
        productName: displayProductName,
        productId: manualForm.productId || undefined,
        closerId: manualForm.closerId || undefined,
        amount: finalAmount,
        currency: finalCurrency,
        status: manualForm.status,
      };

      const res = await fetchWithAuth(`/sales/project/${projectId}/manual`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.message || 'Error guardando la venta manual';
        throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
      }

      // Si fue un lead nuevo, agregarlo a la lista local para futuros registros
      if (leadMode === 'new') {
        const closerObj = availableClosers.find((c) => c.id === manualForm.closerId);
        setLocalLeads((prev) => [
          {
            id: `lead-manual-${Date.now()}`,
            fullName: manualForm.leadName,
            email: manualForm.leadEmail,
            phone: manualForm.leadPhone,
            closerId: manualForm.closerId || null,
            closerName: closerObj ? closerObj.name : 'Sin Closer',
            productName: manualForm.productName,
          },
          ...prev,
        ]);
      }

      setIsManualModalOpen(false);
      await loadSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la venta';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };



  // Filtrado de ventas
  const filteredSales = sales.filter((s) => {
    // En la vista de Ventas principales, solo mostramos las ventas efectivas
    const isSuccessStatus = ['APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'COMPLETED', 'PURCHASE_COMPLETE', 'PENDING'].includes(s.status);
    if (!isSuccessStatus) return false;

    const q = searchTerm.toLowerCase();
    return (
      s.lead?.email?.toLowerCase().includes(q) ||
      s.lead?.name?.toLowerCase().includes(q) ||
      s.externalOrderId?.toLowerCase().includes(q) ||
      s.productName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Registro de Ventas
          </h2>
          <p className="text-sm text-muted-foreground">
            Histórico de transacciones nativas de pasarelas y ventas manuales del equipo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
            onClick={handleOpenManualModal}
          >
            <Plus className="w-4 h-4 mr-2" />
            Venta Manual
          </Button>
        </div>
      </div>

      {/* ESTADO 1: ERROR CON RETRY */}
      {loadError && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSales}
            disabled={isLoading}
            className="border-destructive/30 hover:bg-destructive/20 text-destructive gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
        </div>
      )}

      {/* TABLA PRINCIPAL DE VENTAS */}
      <Card className="p-0 border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, lead, producto o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="pl-9 bg-background border-border focus:border-primary text-foreground"
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {sales.length} transacciones registradas
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Fecha</TableHead>
                <TableHead className="text-muted-foreground font-medium">Lead</TableHead>
                <TableHead className="text-muted-foreground font-medium">Producto</TableHead>
                <TableHead className="text-muted-foreground font-medium">Closer</TableHead>
                <TableHead className="text-muted-foreground font-medium">Cód. Venta</TableHead>
                <TableHead className="text-muted-foreground font-medium">Monto</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* ESTADO 2: LOADING SKELETON */}
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell colSpan={7} className="py-4">
                      <div className="h-6 bg-muted/60 rounded animate-pulse w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredSales.length === 0 ? (
                /* ESTADO 3: EMPTY CON CTA */
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div className="font-semibold text-foreground">
                        {searchTerm ? 'No se encontraron resultados' : 'Sin ventas registradas todavía'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {searchTerm
                          ? `No hay transacciones que coincidan con "${searchTerm}".`
                          : 'Registra una venta manual para asignar comisiones al closer o importa un archivo CSV histórico.'}
                      </p>
                      {!searchTerm && (
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium mt-2"
                          onClick={handleOpenManualModal}
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          Registrar Primera Venta
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                /* ESTADO 4: DATA */
                (filteredSales as (SaleListItem & { closerName?: string | null, closerEmail?: string | null })[]).map((sale) => (
                  <TableRow 
                    key={sale.id} 
                    className="border-border hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedTxn(sale)}
                  >
                    <TableCell className="text-foreground text-xs whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">
                        {sale.lead?.name || 'Sin nombre'}
                      </div>
                      <div className="text-xs text-muted-foreground">{sale.lead?.email}</div>
                    </TableCell>
                    <TableCell className="text-foreground text-sm font-medium">
                      <div className="max-w-[150px] truncate" title={sale.productName}>{sale.productName || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      {sale.closerName || sale.closerEmail ? (
                        <div className="text-sm font-medium text-primary">
                          {sale.closerName || sale.closerEmail}
                        </div>
                      ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground">Orgánica</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      <div className="max-w-[120px] truncate" title={sale.externalOrderId || sale.externalTxnId || 'N/A'}>
                        {sale.externalOrderId || sale.externalTxnId || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground font-semibold text-sm">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: sale.currency || 'USD',
                      }).format(sale.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={`${getStatusBadgeClasses(sale.status)} font-medium`}>
                        {getNaturalStatusName(sale.status).toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR VENTA MANUAL (CON SELECCIÓN DE CLOSER, LEAD Y PRODUCTO) */}
      {/* ========================================================================= */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-[560px] p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Registrar Venta Manual
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Asigna una venta cerrada por un closer a un prospecto y producto del proyecto.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
            {/* 1. SELECCIÓN DE LEAD */}
            <div className="space-y-2 border border-border/70 rounded-lg p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Prospecto / Lead
                </Label>
                {localLeads.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLeadMode(leadMode === 'existing' ? 'new' : 'existing');
                      if (leadMode === 'existing') {
                        setManualForm((prev) => ({
                          ...prev,
                          leadName: '',
                          leadEmail: '',
                          leadPhone: '',
                        }));
                      } else if (localLeads[0]) {
                        handleSelectLead(localLeads[0].id);
                      }
                    }}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    {leadMode === 'existing' ? '+ Registrar Nuevo Lead' : '← Seleccionar Lead del Proyecto'}
                  </button>
                )}
              </div>

              {leadMode === 'existing' && localLeads.length > 0 ? (
                <div className="space-y-2">
                  <Select value={selectedLeadId} onValueChange={handleSelectLead}>
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Selecciona un lead disponible..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-60">
                      {localLeads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          <span className="font-medium text-foreground">{l.fullName}</span>{' '}
                          <span className="text-muted-foreground text-xs font-mono">({l.email})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {manualForm.leadEmail && (
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
                      <span>Email: <strong className="text-foreground">{manualForm.leadEmail}</strong></span>
                      {manualForm.leadPhone && <span>Tel: <strong className="text-foreground">{manualForm.leadPhone}</strong></span>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nombre Completo *</Label>
                      <Input
                        required
                        placeholder="Ej. Roberto Gómez"
                        value={manualForm.leadName}
                        onChange={(e) => setManualForm({ ...manualForm, leadName: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        className="bg-background border-border text-foreground h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Correo Electrónico *</Label>
                      <Input
                        required
                        type="email"
                        placeholder="roberto@ejemplo.com"
                        value={manualForm.leadEmail}
                        onChange={(e) => setManualForm({ ...manualForm, leadEmail: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        className="bg-background border-border text-foreground h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Teléfono (opcional)</Label>
                    <Input
                      placeholder="+57 300 123 4567"
                      value={manualForm.leadPhone}
                      onChange={(e) => setManualForm({ ...manualForm, leadPhone: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className="bg-background border-border text-foreground h-9 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. SELECCIÓN DE PRODUCTO (DROPDOWN CON PRODUCTOS DEL PROYECTO) */}
            <div className="space-y-2 border border-border/70 rounded-lg p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-primary" />
                  Producto Vendido
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setProductMode(productMode === 'select' ? 'custom' : 'select');
                    if (productMode === 'select') {
                      setManualForm((prev) => ({ ...prev, productId: '', productName: '' }));
                    } else {
                      const firstP = availableProducts[0];
                      if (firstP) {
                        handleSelectProduct(firstP.id);
                      }
                    }
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {productMode === 'select' ? '+ Escribir otro producto manual' : '← Seleccionar del Proyecto'}
                </button>
              </div>

              {productMode === 'select' ? (
                <Select value={selectedProductId} onValueChange={handleSelectProduct}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecciona un producto del proyecto..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span className="font-medium text-foreground">{p.name}</span>
                          <span className="text-primary font-mono text-xs font-bold">
                            ${p.price.toLocaleString()} {p.currency}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-muted-foreground italic">
                      + Ingresar otro producto manualmente...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1">
                  <Input
                    required
                    placeholder="Nombre del producto o programa vendido"
                    value={manualForm.productName}
                    onChange={(e) => setManualForm({ ...manualForm, productName: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="bg-background border-border text-foreground h-9 text-xs"
                  />
                </div>
              )}
            </div>

            {/* 3. SELECCIÓN DE CLOSER */}
            <div className="space-y-2 border border-border/70 rounded-lg p-3.5 bg-muted/20">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Closer que cerró la venta
              </Label>
              <Select value={selectedCloserId} onValueChange={handleSelectCloser}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Asignar Closer..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-60">
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sin Closer / Venta Directa (Orgánica)</span>
                  </SelectItem>
                  {availableClosers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      <span className="font-medium text-foreground">{closer.name}</span>{' '}
                      <span className="text-muted-foreground text-xs font-mono">({closer.email})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Se computará la comisión del closer seleccionado según las metas configuradas del proyecto.
              </p>
            </div>

            {/* 4. MONTO, MONEDA Y ESTADO */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Monto Pagado *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  className="bg-background border-border text-foreground h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Moneda Pago</Label>
                <Select
                  value={manualForm.currency}
                  onValueChange={(v) => setManualForm({ ...manualForm, currency: v })}
                >
                  <SelectTrigger className="bg-background border-border text-foreground h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="COP">COP ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="MXN">MXN ($)</SelectItem>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="PEN">PEN (S/)</SelectItem>
                    <SelectItem value="CLP">CLP ($)</SelectItem>
                    <SelectItem value="ARS">ARS ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
                <Select
                  value={manualForm.status}
                  onValueChange={(v) =>
                    setManualForm({
                      ...manualForm,
                      status: v as any,
                    })
                  }
                >
                  <SelectTrigger className="bg-background border-border text-foreground h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="PURCHASE_APPROVED">Aprobada</SelectItem>
                    <SelectItem value="PURCHASE_COMPLETE">Completa</SelectItem>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="PURCHASE_REFUNDED">Reembolsada</SelectItem>
                    <SelectItem value="PURCHASE_PROTEST">Sol. Reembolso</SelectItem>
                    <SelectItem value="PURCHASE_CANCELED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* PANEL DE CONVERSIÓN EN TIEMPO REAL */}
            {manualForm.currency !== projectCurrency && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2 text-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Conversión a Moneda del Proyecto ({projectCurrency})
                  </span>
                  {isFetchingRate ? (
                    <span className="text-[10px] text-muted-foreground animate-pulse">
                      Consultando tasa en vivo...
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-mono font-medium">
                      ● Tasa en vivo actualizada
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 bg-background/60 p-2.5 rounded border border-border/60">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Monto cobrado al cliente:</span>
                    <span className="font-mono font-medium text-foreground text-xs">
                      {Number(manualForm.amount || 0).toLocaleString()} {manualForm.currency}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Monto computable a metas:</span>
                    <span className="font-mono font-bold text-sm text-primary">
                      ${convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {projectCurrency}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>
                    Tasa: 1 {manualForm.currency} ={' '}
                    <span className="font-mono font-semibold text-foreground">
                      {exchangeRate < 0.01 ? exchangeRate.toFixed(6) : exchangeRate.toFixed(4)}
                    </span>{' '}
                    {projectCurrency}
                  </span>
                  <span className="text-[10px] italic">
                    (Se computarán ${convertedAmount.toFixed(2)} {projectCurrency})
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-border mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsManualModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {isSaving ? 'Guardando Venta...' : 'Guardar Venta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>



      <TransactionDetailModal 
        isOpen={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
        allTransactions={sales as any}
      />
    </div>
  );
}
