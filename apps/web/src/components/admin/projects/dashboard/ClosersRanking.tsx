import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronRight } from 'lucide-react';

interface CloserData {
  id: string;
  closer: string;
  ventas: number;
  facturacion: number;
  conversion: number;
}

interface ClosersRankingProps {
  data: CloserData[];
}

export function ClosersRanking({ data }: ClosersRankingProps) {
  return (
    <Card className="col-span-full md:col-span-2 xl:col-span-1 h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking de Closers
            </CardTitle>
            <CardDescription>Top 5 de facturación</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                    Aún no hay ventas asignadas a closers
                  </TableCell>
                </TableRow>
              ) : (
                data.slice(0, 5).map((closer, index) => (
                  <TableRow key={closer.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <TableCell className="text-center font-medium">
                      {index === 0 ? (
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 mx-auto text-xs">1</span>
                      ) : index === 1 ? (
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-700 mx-auto text-xs">2</span>
                      ) : index === 2 ? (
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-800 mx-auto text-xs">3</span>
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[100px]" title={closer.closer}>
                      {closer.closer}
                    </TableCell>
                    <TableCell className="text-right">{closer.ventas}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${closer.facturacion.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="pt-4 mt-auto border-t border-border/40">
          <Button variant="ghost" className="w-full text-sm text-primary group">
            Ver ranking completo
            <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
