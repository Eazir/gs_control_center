'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCw, Activity, AlertCircle, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TransactionDetailModal } from './TransactionDetailModal';

export interface TransactionsViewProps {
  projectId: string;
}

/**
 * Vista de trazabilidad global de transacciones del proyecto.
 * Muestra el historial completo de eventos (incluyendo compras aprobadas, pendientes,
 * reembolsos, carritos abandonados, chargebacks y cuotas).
 * Esta vista está restringida únicamente a roles gerenciales (Director, Admin, Super Admin).
 * Los Closers no tienen acceso a este listado.
 */
export function TransactionsView({ projectId }: TransactionsViewProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);

  const loadTransactions = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchWithAuth(`/sales/project/${projectId}/transactions`);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `Error ${res.status}: No se pudieron cargar las transacciones`);
      }
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar las transacciones';
      console.error('[TransactionsView] Error loading transactions:', err);
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [projectId]);

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const leadName = (t.lead?.name || 'Sin nombre').toLowerCase();
      const leadEmail = (t.lead?.email || '').toLowerCase();
      const productName = (t.productName || '').toLowerCase();
      const txnId = (t.externalTxnId || '').toLowerCase();
      return (
        leadName.includes(q) ||
        leadEmail.includes(q) ||
        productName.includes(q) ||
        txnId.includes(q)
      );
    });
  }, [transactions, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PURCHASE_APPROVED':
        return <Badge variant="outline" className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30">COMPRA APROBADA</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30">APROBADA</Badge>;
      case 'COMPLETE':
        return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">COMPLETADA</Badge>;
      case 'PENDING':
      case 'WAITING_PAYMENT':
      case 'BILLET_PRINTED':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">{status}</Badge>;
      case 'REFUNDED':
      case 'CHARGEBACK':
      case 'CANCELED':
      case 'EXPIRED':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">{status}</Badge>;
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
            onClick={loadTransactions}
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
          <div>
            <h3 className="text-sm font-semibold text-red-500">Error al cargar transacciones</h3>
            <p className="text-xs text-red-400 mt-1">{loadError}</p>
          </div>
        </div>
      )}

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
            {transactions.length} transacciones registradas
          </div>
        </div>

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
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm">Cargando transacciones...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                    {searchTerm ? 'No se encontraron transacciones con esa búsqueda.' : 'No hay transacciones registradas.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((t) => (
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

      <TransactionDetailModal 
        isOpen={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
      />
    </div>
  );
}
