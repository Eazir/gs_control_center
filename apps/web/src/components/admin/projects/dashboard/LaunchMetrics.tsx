import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Rocket } from 'lucide-react';

interface ProductStats {
  producto: string;
  ventas: number;
  facturacion: number;
}

interface LaunchMetricsProps {
  totalFacturado: number;
  totalVentas: number;
  productos: ProductStats[];
}

export function LaunchMetrics({ totalFacturado, totalVentas, productos }: LaunchMetricsProps) {
  return (
    <Card className="col-span-full md:col-span-2 xl:col-span-1 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Rocket className="h-5 w-5 text-indigo-500" />
          Facturación del Proyecto
        </CardTitle>
        <CardDescription>Resumen general por producto</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-1 bg-muted/30 p-3 rounded-lg border border-border/50">
            <p className="text-sm font-medium text-muted-foreground">Facturación</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              ${totalFacturado.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1 bg-muted/30 p-3 rounded-lg border border-border/50">
            <p className="text-sm font-medium text-muted-foreground">Ventas</p>
            <p className="text-2xl font-bold">{totalVentas}</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-12">
                    Sin ventas registradas
                  </TableCell>
                </TableRow>
              ) : (
                productos.map((prod, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium truncate max-w-[120px]" title={prod.producto}>
                      {prod.producto}
                    </TableCell>
                    <TableCell className="text-right">{prod.ventas}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${prod.facturacion.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
