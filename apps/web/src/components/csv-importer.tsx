'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, CheckCircle2, ArrowRight, Table as TableIcon } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface CsvImporterProps {
  projectId?: string;
  mode: 'leads' | 'sales';
  onClose: () => void;
  onImport?: (data: any[]) => Promise<void>; // Para retrocompatibilidad
}

const LEADS_FIELDS = [
  { key: 'phone', label: 'Teléfono (Requerido)', required: true },
  { key: 'name', label: 'Nombres', required: false },
  { key: 'email', label: 'Correo', required: false },
  { key: 'closerId', label: 'Closer (Opcional, nombre/email)', required: false },
];

const SALES_FIELDS = [
  { key: 'externalTxnId', label: 'Código de Transacción (Requerido)', required: true },
  { key: 'status', label: 'Estado de transacción (Requerido)', required: true },
  { key: 'productName', label: 'Nombre del Producto', required: false },
  { key: 'amount', label: 'Monto', required: false },
  { key: 'currency', label: 'Moneda (USD, COP...)', required: false },
  { key: 'date', label: 'Fecha (YYYY-MM-DD o ISO)', required: false },
  { key: 'leadName', label: 'Nombres del Comprador', required: false },
  { key: 'leadEmail', label: 'Correo del Comprador', required: false },
  { key: 'leadPhone', label: 'Teléfono del Comprador', required: false },
  { key: 'offerCode', label: 'Código de Oferta', required: false },
  { key: 'sck', label: 'Código SCK (Closer)', required: false },
  { key: 'paymentMethod', label: 'Tipo de pago', required: false },
  { key: 'installments', label: 'Cuotas', required: false },
];

export function CsvImporter({ projectId, mode, onClose, onImport }: CsvImporterProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [assignmentMode, setAssignmentMode] = useState<'none' | 'specific' | 'equitable'>('none');
  const [selectedClosers, setSelectedClosers] = useState<string[]>([]);
  const [projectClosers, setProjectClosers] = useState<{ id: string; userId: string; userName: string | null; userEmail: string | null; roleInProject: string }[]>([]);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ successful: number; failed: number } | null>(null);

  const fields = mode === 'leads' ? LEADS_FIELDS : SALES_FIELDS;

  useEffect(() => {
    if (projectId && mode === 'leads') {
      // Load closers
      fetchWithAuth(`/projects/${projectId}/members`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const closers = data.filter((m: any) => m.roleInProject === 'CLOSER');
            setProjectClosers(closers);
          }
        })
        .catch(console.error);
    }
  }, [projectId, mode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvHeaders(results.meta.fields || []);
        setCsvData(results.data);
        setMapping({});
        setStep(2);
      }
    });
  };

  const handleExecuteImport = async () => {
    setIsImporting(true);
    
    // Transform data
    const payload = csvData.map((row, index) => {
      const obj: any = {};
      fields.forEach(f => {
        const mappedCol = mapping[f.key];
        if (mappedCol && mappedCol !== 'none' && row[mappedCol]) {
          let val = row[mappedCol];
          if (f.key === 'installments') val = parseInt(val, 10) || 1;
          if (f.key === 'amount') val = parseFloat(val) || 0;
          obj[f.key] = val;
        }
      });

      // Assignment logic for leads
      // Closer assignment logic for leads
      if (mode === 'leads' && assignmentMode !== 'none') {
        if (assignmentMode === 'specific' && selectedClosers.length > 0) {
          obj.closerId = selectedClosers[0];
        } else if (assignmentMode === 'equitable' && selectedClosers.length > 0) {
          obj.closerId = selectedClosers[index % selectedClosers.length];
        }
      }

      return obj;
    });

    if (onImport) {
      try {
        await onImport(payload);
        setStep(3);
      } catch (err) {
        console.error(err);
      } finally {
        setIsImporting(false);
      }
      return;
    }

    if (!projectId) {
      alert("No projectId provided");
      setIsImporting(false);
      return;
    }

    const endpoint = mode === 'leads' 
      ? `/sales/project/${projectId}/leads/import-csv` 
      : `/sales/project/${projectId}/import-csv`;

    try {
      let successful = 0;
      let failed = 0;
      const CHUNK_SIZE = 50;
      
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        const res = await fetchWithAuth(endpoint, {
          method: 'POST',
          body: JSON.stringify(chunk)
        });
        
        if (res.ok) {
          const data = await res.json();
          successful += (data.successful || 0);
          failed += (data.failed || 0);
        } else {
          failed += chunk.length;
        }
        
        // Pequeña pausa para no saturar (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setImportResult({ successful, failed });
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Error al importar. Revisa la consola.');
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setCsvData([]);
    setCsvHeaders([]);
    setMapping({});
    setImportResult(null);
    setAssignmentMode('none');
    setSelectedClosers([]);
  };

  return (
    <div className="w-full p-6">
      {step === 1 && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/60 rounded-xl bg-muted/20">
          <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Sube tu archivo CSV</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Asegúrate de que tu archivo esté separado por comas y tenga encabezados en la primera fila.
          </p>
          <Button asChild>
            <label className="cursor-pointer">
              Seleccionar Archivo
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-muted/30 p-4 rounded-lg flex justify-between items-center border border-border">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <TableIcon size={18} className="text-primary" />
              <span><strong>{csvData.length}</strong> filas detectadas</span>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-background">
            <div className="grid grid-cols-[1fr_1fr] bg-muted/50 p-3 border-b border-border items-center">
              <h4 className="font-semibold text-sm text-foreground">Campo del Sistema</h4>
              <h4 className="font-semibold text-sm text-foreground">Tu Columna CSV</h4>
            </div>
            <div className="divide-y divide-border max-h-[45vh] overflow-y-auto">
              {fields.map(f => (
                <div key={f.key} className="grid grid-cols-[1fr_1fr] p-3 gap-4 items-center hover:bg-muted/10 transition-colors">
                  <div className="text-sm text-foreground">
                    {f.label} {f.required && <span className="text-red-500 font-bold">*</span>}
                  </div>
                  <div>
                    <Select 
                      {...(mapping[f.key] ? { value: mapping[f.key] } : {})} 
                      onValueChange={(val) => setMapping(prev => ({...prev, [f.key]: val}))}
                    >
                      <SelectTrigger className="w-full bg-background border-border">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Ignorar --</SelectItem>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mode === 'leads' && (
            <div className="pt-4 border-t border-border">
              <h4 className="font-semibold text-sm mb-3">Distribución de Closers</h4>
              <div className="flex flex-col gap-3">
                <Select value={assignmentMode} onValueChange={(v: any) => setAssignmentMode(v)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Opciones de asignación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Dejar sin asignar / Usar columna del CSV</SelectItem>
                    <SelectItem value="specific">Asignar todos a un Closer específico</SelectItem>
                    <SelectItem value="equitable">Repartir equitativamente</SelectItem>
                  </SelectContent>
                </Select>

                {(assignmentMode === 'specific' || assignmentMode === 'equitable') && (
                  <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-2">Selecciona los closers para la asignación:</p>
                    {projectClosers.map(c => (
                      <label key={c.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type={assignmentMode === 'specific' ? 'radio' : 'checkbox'} 
                          name="closer_select"
                          checked={selectedClosers.includes(c.userId)}
                          onChange={(e) => {
                            if (assignmentMode === 'specific') {
                              setSelectedClosers([c.userId]);
                            } else {
                              setSelectedClosers(prev => e.target.checked ? [...prev, c.userId] : prev.filter(id => id !== c.userId));
                            }
                          }}
                        />
                        {c.userName || c.userEmail || 'Sin nombre'}
                      </label>
                    ))}
                    {projectClosers.length === 0 && <span className="text-xs text-red-500">No hay closers en el proyecto.</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
            <Button 
              onClick={handleExecuteImport} 
              disabled={isImporting || fields.filter(f => f.required).some(f => !mapping[f.key] || mapping[f.key] === 'none')}
            >
              {isImporting ? 'Importando...' : 'Iniciar Importación'} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
          <h3 className="text-2xl font-bold text-foreground">Importación Finalizada</h3>
          {importResult && (
            <div className="flex gap-4">
              <div className="bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-lg font-medium">
                {importResult.successful} importados
              </div>
              <div className="bg-red-500/10 text-red-600 px-4 py-2 rounded-lg font-medium">
                {importResult.failed} fallidos
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Los registros fallidos usualmente se deben a duplicados exactos o datos mal formateados.
          </p>
          <Button className="mt-6" onClick={() => { reset(); onClose(); }}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}
