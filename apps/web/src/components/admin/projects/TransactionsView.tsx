'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, 
  RefreshCw, 
  Activity, 
  AlertCircle, 
  List, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TransactionDetailModal } from './TransactionDetailModal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CsvImporter } from '@/components/csv-importer';
import { getNaturalStatusName, getStatusBadgeClasses } from '@/lib/status-utils';

export interface TransactionsViewProps {
  projectId: string;
  products?: Array<{ id: string; name: string }>;
  members?: Array<{ userId: string; userName?: string | null; userEmail?: string | null; roleInProject?: string; userRole?: string | null }>;
  allUsers?: Array<{ id: string; fullName?: string | null; email?: string | null }>;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/**
 * Vista de trazabilidad global de transacciones del proyecto.
 * Muestra el historial completo de eventos (incluyendo compras aprobadas, pendientes,
 * reembolsos, carritos abandonados, chargebacks y cuotas).
 * Esta vista está restringida únicamente a roles gerenciales (Director, Admin, Super Admin).
 * Los Closers no tienen acceso a este listado.
 */
export function TransactionsView({ projectId, products = [], members = [], allUsers = [] }: TransactionsViewProps) {
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [originFilter, setOriginFilter] = useState<string>(() => searchParams?.get('origin') || 'todos');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams?.get('status') || 'ALL');
  const [productFilter, setProductFilter] = useState<string>(() => searchParams?.get('productId') || 'ALL');
  const [closerFilter, setCloserFilter] = useState<string>(() => searchParams?.get('closerId') || 'ALL');
  const [dayFilter, setDayFilter] = useState<string>(() => searchParams?.get('day') || '');
  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams?.get('search') || '');

  // Paginación keyset
  const [currentCursor, setCurrentCursor] = useState<string | null>(() => searchParams?.get('cursor') || null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Sincronizar selectedTxn si los datos de transactions cambian tras guardar en el modal
  useEffect(() => {
    if (selectedTxn) {
      const updatedTxn = transactions.find((t) => t.id === selectedTxn.id);
      if (updatedTxn && JSON.stringify(updatedTxn) !== JSON.stringify(selectedTxn)) {
        setSelectedTxn(updatedTxn);
      }
    }
  }, [transactions, selectedTxn]);

  // Lista de closers disponibles
  const availableClosers = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      if (m.userId) {
        map.set(m.userId, m.userName || m.userEmail || m.userId);
      }
    });
    allUsers.forEach((u) => {
      if (u.id && !map.has(u.id)) {
        map.set(u.id, u.fullName || u.email || u.id);
      }
    });
    transactions.forEach((t) => {
      if (t.closerId && !map.has(t.closerId)) {
        map.set(t.closerId, t.closerName || t.closerEmail || t.closerId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [members, allUsers, transactions]);

  // Lista de productos disponibles
  const availableProducts = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p.name);
    });
    transactions.forEach((t) => {
      if (t.productId && t.productName && !map.has(t.productId)) {
        map.set(t.productId, t.productName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products, transactions]);

  const loadTransactions = useCallback(async (targetCursor?: string | null) => {
    if (!projectId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (originFilter && originFilter !== 'todos') params.set('origin', originFilter);
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      if (productFilter && productFilter !== 'ALL') params.set('productId', productFilter);
      if (closerFilter && closerFilter !== 'ALL') params.set('closerId', closerFilter);
      if (dayFilter) params.set('day', dayFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const activeCursor = targetCursor !== undefined ? targetCursor : currentCursor;
      if (activeCursor) params.set('cursor', activeCursor);
      params.set('limit', '50');

      // Reflejar en URL sin recarga completa
      if (typeof window !== 'undefined') {
        const queryStr = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState(null, '', `${window.location.pathname}${queryStr}`);
      }

      const res = await fetchWithAuth(`/sales/project/${projectId}/transactions?${params.toString()}`);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `Error ${res.status}: No se pudieron cargar las transacciones`);
      }
      const data = await res.json();
      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        setTransactions(data.items);
        setTotal(data.total ?? 0);
        setPageInfo(data.pageInfo ?? { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null });
      } else if (Array.isArray(data)) {
        setTransactions(data);
        setTotal(data.length);
        setPageInfo({ hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null });
      } else {
        setTransactions([]);
        setTotal(0);
        setPageInfo({ hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar las transacciones';
      console.error('[TransactionsView] Error loading transactions:', err);
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, originFilter, statusFilter, productFilter, closerFilter, dayFilter, searchTerm, currentCursor]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Manejadores de paginación
  const handleNextPage = () => {
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) return;
    setCursorStack((prev) => [...prev, currentCursor || '']);
    setCurrentCursor(pageInfo.endCursor);
    setPageNumber((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (!pageInfo.hasPreviousPage || cursorStack.length === 0) return;
    const prevCursor = cursorStack[cursorStack.length - 1];
    setCursorStack((prev) => prev.slice(0, -1));
    const nextCursor = prevCursor === '' ? null : (prevCursor || null);
    setCurrentCursor(nextCursor);
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const resetFiltersAndPagination = () => {
    setOriginFilter('todos');
    setStatusFilter('ALL');
    setProductFilter('ALL');
    setCloserFilter('ALL');
    setDayFilter('');
    setSearchTerm('');
    setCurrentCursor(null);
    setCursorStack([]);
    setPageNumber(1);
  };

  const getStatusBadge = (status: string) => {
    const naturalName = getNaturalStatusName(status);
    const classes = getStatusBadgeClasses(status);
    return <Badge variant="outline" className={classes}>{naturalName}</Badge>;
  };

  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const hasActiveFilters = originFilter !== 'todos' || statusFilter !== 'ALL' || productFilter !== 'ALL' || closerFilter !== 'ALL' || !!dayFilter || !!searchTerm;

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <List className="w-6 h-6" />
            Historial de Transacciones
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registro crudo de todos los eventos financieros y sus estados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Upload size={14} />
            Importar Transacciones
          </button>
          <button
            onClick={() => loadTransactions(currentCursor)}
            disabled={isLoading}
            className="px-3 py-2 bg-card border border-border/60 hover:bg-muted text-foreground font-medium text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refrescar
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-500">Error al cargar transacciones</h3>
            <p className="text-xs text-red-400 mt-1">{loadError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadTransactions(currentCursor)} className="text-xs">
            Reintentar
          </Button>
        </div>
      )}

      <Card className="p-0 border-border bg-card overflow-hidden shadow-sm">
        {/* BARRA DE FILTROS */}
        <div className="p-4 border-b border-border bg-muted/30 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Búsqueda servidor */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email, lead, producto o ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentCursor(null);
                  setCursorStack([]);
                  setPageNumber(1);
                }}
                className="pl-9 pr-7 bg-background border-border focus:border-primary text-foreground text-xs h-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentCursor(null);
                    setCursorStack([]);
                    setPageNumber(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Selector de Origen */}
            <Select
              value={originFilter}
              onValueChange={(val) => {
                setOriginFilter(val);
                setCurrentCursor(null);
                setCursorStack([]);
                setPageNumber(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs bg-background border-border">
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los orígenes</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>

            {/* Selector de Estado */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setCurrentCursor(null);
                setCursorStack([]);
                setPageNumber(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9 text-xs bg-background border-border">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="APPROVED">Aprobada</SelectItem>
                <SelectItem value="COMPLETE">Completada</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="REFUNDED">Reembolsada</SelectItem>
                <SelectItem value="CHARGEBACK">Chargeback</SelectItem>
                <SelectItem value="CANCELED">Cancelada</SelectItem>
                <SelectItem value="ABANDONED_CART">Carrito Abandonado</SelectItem>
              </SelectContent>
            </Select>

            {/* Selector de Producto */}
            <Select
              value={productFilter}
              onValueChange={(val) => {
                setProductFilter(val);
                setCurrentCursor(null);
                setCursorStack([]);
                setPageNumber(1);
              }}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs bg-background border-border">
                <SelectValue placeholder="Producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los productos</SelectItem>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selector de Closer */}
            <Select
              value={closerFilter}
              onValueChange={(val) => {
                setCloserFilter(val);
                setCurrentCursor(null);
                setCursorStack([]);
                setPageNumber(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9 text-xs bg-background border-border">
                <SelectValue placeholder="Closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los closers</SelectItem>
                {availableClosers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selector de Día */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-muted-foreground" />
              <Input
                type="date"
                value={dayFilter}
                onChange={(e) => {
                  setDayFilter(e.target.value);
                  setCurrentCursor(null);
                  setCursorStack([]);
                  setPageNumber(1);
                }}
                className="w-36 h-9 text-xs bg-background border-border"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFiltersAndPagination}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* CONTADOR Y PAGINACIÓN AL INICIO DE LA TABLA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-muted/10 border-b border-border">
          <div className="text-xs text-muted-foreground font-medium">
            Total de transacciones: <span className="font-bold text-foreground font-mono">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">
              Página <span className="font-semibold text-foreground">{pageNumber}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={!pageInfo.hasPreviousPage || cursorStack.length === 0 || isLoading}
              className="h-7 px-2.5 text-xs flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!pageInfo.hasNextPage || !pageInfo.endCursor || isLoading}
              className="h-7 px-2.5 text-xs flex items-center gap-1"
            >
              Siguiente
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>

        {/* TABLA DE TRANSACCIONES */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Fecha</TableHead>
                <TableHead className="text-muted-foreground font-medium">Comprador</TableHead>
                <TableHead className="text-muted-foreground font-medium">Producto</TableHead>
                <TableHead className="text-muted-foreground font-medium">Cód. Transacción</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">Monto</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx} className="border-border">
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36 mb-1" /><Skeleton className="h-3 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                    {hasActiveFilters ? 'No hay transacciones con esos filtros.' : 'No hay transacciones registradas.'}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow 
                    key={t.id} 
                    className="border-border hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedTxn(t)}
                  >
                    <TableCell className="text-foreground text-xs whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">{t.lead?.name || 'Sin nombre'}</div>
                      <div className="text-xs text-muted-foreground">{t.lead?.email}</div>
                    </TableCell>
                    <TableCell className="text-foreground text-sm font-medium">
                      <div className="max-w-[150px] truncate" title={t.productName}>{t.productName || 'N/A'}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="max-w-[120px] truncate" title={t.externalTxnId || 'N/A'}>
                          {t.externalTxnId || 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-foreground font-semibold text-sm">
                      <div className="font-bold text-sm">{formatMoney(Number(t.amount), t.currency)}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {t.installments > 1 ? `${t.installments} cuotas` : 'Contado'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(t.status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      {/* MODAL: IMPORTAR CSV */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-4xl p-0 max-h-[90vh] overflow-y-auto">
          <CsvImporter 
            projectId={projectId}
            mode="sales" 
            onClose={() => {
              setIsImportModalOpen(false);
              loadTransactions(currentCursor);
            }} 
          />
        </DialogContent>
      </Dialog>

      <TransactionDetailModal 
        isOpen={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
        allTransactions={transactions}
        onSaveLead={() => loadTransactions(currentCursor)}
      />
    </div>
  );
}
