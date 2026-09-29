'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UploadCloud, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MappingField {
  key: string;
  label: string;
  required: boolean;
}

interface CsvImporterProps {
  mode: 'leads' | 'sales';
  onImport: (mappedData: any[]) => Promise<void>;
  onClose: () => void;
}

export function CsvImporter({ mode, onImport, onClose }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leadFields: MappingField[] = [
    { key: 'email', label: 'Email', required: true },
    { key: 'name', label: 'Nombre', required: false },
    { key: 'phone', label: 'Teléfono', required: false },
    { key: 'productOfInterest', label: 'Producto de Interés', required: false },
  ];

  const saleFields: MappingField[] = [
    { key: 'externalTxnId', label: 'Código Transacción', required: true },
    { key: 'leadEmail', label: 'Email Comprador', required: true },
    { key: 'leadName', label: 'Nombre Comprador', required: false },
    { key: 'productName', label: 'Producto', required: true },
    { key: 'amount', label: 'Monto', required: true },
    { key: 'currency', label: 'Moneda (USD/MXN...)', required: false },
    { key: 'date', label: 'Fecha', required: false },
  ];

  const targetFields = mode === 'leads' ? leadFields : saleFields;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Por favor selecciona un archivo .csv');
      return;
    }

    setFile(selectedFile);
    setError(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
          setCsvData(results.data);
          
          // Auto-mapping intuitivo
          const initialMapping: Record<string, string> = {};
          targetFields.forEach((field) => {
            const match = results.meta.fields?.find(
              (h) => h.toLowerCase().includes(field.key.toLowerCase()) || 
                     h.toLowerCase().includes(field.label.toLowerCase())
            );
            if (match) {
              initialMapping[field.key] = match;
            }
          });
          setMapping(initialMapping);
          setStep(2);
        } else {
          setError('No se encontraron cabeceras en el archivo CSV.');
        }
      },
      error: (err) => {
        setError(`Error parseando CSV: ${err.message}`);
      }
    });
  };

  const handleMappingChange = (targetKey: string, sourceHeader: string) => {
    setMapping((prev) => ({
      ...prev,
      [targetKey]: sourceHeader
    }));
  };

  const proceedToReview = () => {
    // Validar requeridos
    const missing = targetFields.filter(f => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      setError(`Faltan mapear campos obligatorios: ${missing.map(m => m.label).join(', ')}`);
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      setError(null);
      
      const mappedData = csvData.map(row => {
        const obj: any = {};
        for (const [targetKey, sourceHeader] of Object.entries(mapping)) {
          if (sourceHeader && row[sourceHeader] !== undefined) {
            // Conversión de tipos básica si es número
            if (targetKey === 'amount') {
              obj[targetKey] = parseFloat(row[sourceHeader]) || 0;
            } else {
              obj[targetKey] = row[sourceHeader];
            }
          }
        }
        return obj;
      });

      await onImport(mappedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Importar {mode === 'leads' ? 'Leads' : 'Ventas'}</CardTitle>
        <CardDescription>
          Sube tu archivo .csv y mapea las columnas.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-card/50">
            <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-4">Selecciona o arrastra tu archivo .csv</p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="block w-full max-w-sm text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-primary/10 file:text-primary
                hover:file:bg-primary/20
                cursor-pointer"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-muted/30 rounded-xl p-4 border border-border">
              <h3 className="text-sm font-semibold mb-4">Mapeo de Columnas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {targetFields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    >
                      <option value="">-- Ignorar --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
              <Button onClick={proceedToReview} variant="gold">
                Continuar a Revisión <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Alert className="bg-success/10 border-success/30 text-success">
              <CheckCircle2 className="h-4 w-4 !text-success" />
              <AlertTitle>Todo listo para importar</AlertTitle>
              <AlertDescription>
                Se han detectado {csvData.length} registros listos para ser procesados.
              </AlertDescription>
            </Alert>

            <div className="border rounded-md overflow-x-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {targetFields.filter(f => mapping[f.key]).map(f => (
                      <TableHead key={f.key}>{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {targetFields.filter(f => mapping[f.key]).map(f => (
                        <TableCell key={f.key} className="text-xs">
                          {row[mapping[f.key] as string]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {csvData.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={targetFields.filter(f => mapping[f.key]).length} className="text-center text-xs text-muted-foreground italic">
                        ... y {csvData.length - 5} registros más
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(2)} disabled={isImporting}>Atrás</Button>
              <Button onClick={handleImport} disabled={isImporting} variant="gold">
                {isImporting ? 'Importando...' : 'Iniciar Importación Masiva'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
