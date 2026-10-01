'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, CheckCircle2, ArrowRight, Table as TableIcon, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface CsvImporterProps {
  projectId?: string;
  mode: 'leads' | 'sales';
  onClose: () => void;
  onImport?: (data: unknown[]) => Promise<void>;
}

const LEADS_FIELDS = [
  { key: 'phone', label: 'Teléfono (Requerido)', required: true },
  { key: 'name', label: 'Nombre (Opcional)', required: false },
  { key: 'email', label: 'Correo (Opcional)', required: false },
  { key: 'situacion', label: 'Situación (NO_RESPONDE, YA_HABIA_ENTRADO, etc)', required: false },
  { key: 'pipelineStage', label: 'Etapa manual (uncontacted, followup, won, lost)', required: false },
  { key: 'sck', label: 'Código SCK (Usar si la asignación es por SCK)', required: false },
];

const SALES_FIELDS = [
  { key: 'externalTxnId', label: 'Código de Transacción (el HP) (Requerido)', required: true },
  { key: 'offerCode', label: 'Código de Oferta (Requerido)', required: true },
  { key: 'sck', label: 'Código SCK (Requerido)', required: true },
  { key: 'affiliateName', label: 'Afiliado (nombre no código) (Requerido)', required: true },
  { key: 'status', label: 'Estado de la transacción (Requerido)', required: true },
  { key: 'date', label: 'Fecha de transacción (Requerido)', required: true },
  { key: 'leadName', label: 'Nombre del lead (Requerido)', required: true },
  { key: 'leadEmail', label: 'Email del lead (Requerido)', required: true },
  { key: 'leadPhone', label: 'Teléfono del lead (Requerido)', required: true },
];

interface ImportProgress {
  currentChunk: number;
  totalChunks: number;
  successful: number;
  failed: number;
}

export function CsvImporter({ projectId, mode, onClose, onImport }: CsvImporterProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [assignmentMode, setAssignmentMode] = useState<'none' | 'single' | 'equitable' | 'sck_mapping'>('none');
  const [selectedClosers, setSelectedClosers] = useState<string[]>([]);
  const [projectClosers, setProjectClosers] = useState<{ id: string; userId: string; userName: string | null; userEmail: string | null; roleInProject: string }[]>([]);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<{ successful: number; failed: number; errors?: any[] } | null>(null);
  const cancelledRef = useRef(false);

  const fields = mode === 'leads' ? LEADS_FIELDS : SALES_FIELDS;

  useEffect(() => {
    if (projectId && mode === 'leads') {
      fetchWithAuth(`/projects/${projectId}/members`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const closers = data.filter((m: Record<string, unknown>) => m.roleInProject === 'CLOSER');
            setProjectClosers(closers as typeof projectClosers);
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
        setCsvData(results.data as Record<string, string>[]);
        setMapping({});
        setStep(2);
      }
    });
  };

  const handleExecuteImport = useCallback(async () => {
    setIsImporting(true);
    cancelledRef.current = false;
    
    // Transform data
    const payload = csvData.map((row, index) => {
      const obj: Record<string, unknown> = {};
      fields.forEach(f => {
        const mappedCol = mapping[f.key];
        if (mappedCol && mappedCol !== 'none' && row[mappedCol]) {
          let val: unknown = row[mappedCol];
          if (f.key === 'installments') val = parseInt(val as string, 10) || 1;
          if (f.key === 'amount') val = parseFloat(val as string) || 0;
          obj[f.key] = val;
        }
      });

      // Closer assignment logic for leads (UUID directo desde la selección)
      if (mode === 'leads' && assignmentMode !== 'none') {
        if (assignmentMode === 'single' && selectedClosers.length > 0) {
          obj.closerId = selectedClosers[0];
        } else if (assignmentMode === 'equitable' && selectedClosers.length > 0) {
          obj.closerId = selectedClosers[index % selectedClosers.length];
        }
        // Para sck_mapping el closerId no se sobreescribe. Se usa 'sck' mapeado en la capa anterior y el backend lo resuelve.
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

    const CHUNK_SIZE = 50;
    const totalChunks = Math.ceil(payload.length / CHUNK_SIZE);

    try {
      let successful = 0;
      let failed = 0;
      let allErrors: any[] = [];
      
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        if (cancelledRef.current) break;

        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const chunk = payload.slice(i, i + CHUNK_SIZE);

        setImportProgress({ currentChunk: chunkIndex, totalChunks, successful, failed });

        const res = await fetchWithAuth(endpoint, {
          method: 'POST',
          body: JSON.stringify(chunk)
        });
        
        if (res.ok) {
          const data = await res.json();
          successful += (data.successful || 0);
          failed += (data.failed || 0);
          if (data.errors) {
            allErrors = [...allErrors, ...data.errors];
          }
        } else {
          failed += chunk.length;
          allErrors.push({ error: `HTTP ${res.status} al importar chunk` });
        }
        
        // Pequeña pausa para no saturar (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setImportResult({ successful, failed, errors: allErrors });
      setImportProgress(null);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Error al importar. Revisa la consola.');
    } finally {
      setIsImporting(false);
    }
  }, [csvData, fields, mapping, mode, assignmentMode, selectedClosers, onImport, projectId]);

  const handleCloseWhileImporting = () => {
    if (isImporting) {
      if (confirm('La importación está en progreso. ¿Deseas cancelarla y cerrar?')) {
        cancelledRef.current = true;
        setIsImporting(false);
        setImportProgress(null);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const reset = () => {
    setStep(1);
    setCsvData([]);
    setCsvHeaders([]);
    setMapping({});
    setImportResult(null);
    setImportProgress(null);
    setAssignmentMode('none');
    setSelectedClosers([]);
  };

  const progressPercent = importProgress
    ? Math.round((importProgress.currentChunk / importProgress.totalChunks) * 100)
    : 0;

  return (
    <div className="w-full p-6 max-h-[85vh] overflow-y-auto">
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
              <h4 className="font-semibold text-sm mb-3">Asignación de Closers</h4>
              <div className="flex flex-col gap-3">
                <Select value={assignmentMode} onValueChange={(v: 'none' | 'single' | 'equitable' | 'sck_mapping') => setAssignmentMode(v)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Opciones de asignación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No asignar (Solo se importan los leads)</SelectItem>
                    <SelectItem value="equitable">Repartir equitativamente entre los marcados</SelectItem>
                    <SelectItem value="single">Asignar todo a un solo closer</SelectItem>
                    <SelectItem value="sck_mapping">Asignar dinámicamente según código SCK del CSV</SelectItem>
                  </SelectContent>
                </Select>

                {assignmentMode === 'sck_mapping' && (
                  <div className="p-3 bg-muted/20 border border-primary/20 rounded-lg text-xs text-primary font-medium">
                    Importante: Asegúrate de mapear la columna &quot;Código SCK&quot; en la tabla superior con la columna correspondiente de tu archivo CSV.
                  </div>
                )}

                {(assignmentMode === 'single' || assignmentMode === 'equitable') && (
                  <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-2">Selecciona {assignmentMode === 'single' ? 'el closer' : 'los closers'} para la asignación:</p>
                    {projectClosers.map(c => (
                      <label key={c.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type={assignmentMode === 'single' ? 'radio' : 'checkbox'} 
                          name="closer_select"
                          checked={selectedClosers.includes(c.userId)}
                          onChange={(e) => {
                            if (assignmentMode === 'single') {
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

          {/* Barra de progreso durante importación */}
          {isImporting && importProgress && (
            <div className="space-y-3 p-4 bg-muted/20 border border-primary/30 rounded-xl animate-in fade-in-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">
                  Importando lote {importProgress.currentChunk} de {importProgress.totalChunks}
                </span>
                <span className="font-mono text-primary font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="text-emerald-400">✓ {importProgress.successful} exitosos</span>
                {importProgress.failed > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} /> {importProgress.failed} fallidos
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => isImporting ? handleCloseWhileImporting() : setStep(1)}>
              {isImporting ? 'Cancelar' : 'Atrás'}
            </Button>
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
          {importResult?.errors && importResult.errors.length > 0 && (
            <div className="w-full bg-red-500/10 text-red-500 text-xs p-4 rounded-lg overflow-y-auto max-h-64 mt-4 border border-red-500/20 text-left">
              <p className="font-semibold mb-2">Detalle de errores:</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(importResult.errors.slice(0, 50), null, 2)}</pre>
              {importResult.errors.length > 50 && <p className="mt-2 font-semibold">... (mostrando primeros 50 errores)</p>}
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
