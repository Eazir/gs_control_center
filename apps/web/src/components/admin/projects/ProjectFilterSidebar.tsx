"use client";

import * as React from "react";
import { CalendarDays, Filter, Search, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ProjectFilters, hasActiveFilters, DEFAULT_FILTERS } from "@/lib/project-filters";

interface StageOption {
  id: string;
  name: string;
}
interface IdNameOption {
  id: string;
  name: string;
}

interface ProjectFilterSidebarProps {
  filters: ProjectFilters;
  onChange: (f: ProjectFilters) => void;
  stages: StageOption[];
  closers: IdNameOption[];
  products: IdNameOption[];
  isCloser: boolean;
}

/**
 * Barra lateral izquierda con los filtros globales del proyecto. Compartida
 * entre pipeline, base de leads, ventas y transacciones (no métricas).
 */
export function ProjectFilterSidebar({
  filters,
  onChange,
  stages,
  closers,
  products,
  isCloser,
}: ProjectFilterSidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [dateMode, setDateMode] = React.useState<"day" | "range">("day");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("gs_filters_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // Ignorar fallo de lectura en SSR
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gs_filters_sidebar_collapsed", String(next));
      } catch {
        // Ignorar
      }
      return next;
    });
  };

  const set = (patch: Partial<ProjectFilters>) => onChange({ ...filters, ...patch });

  const dayDate = filters.day ? new Date(`${filters.day}T00:00:00`) : undefined;
  const rangeSelected =
    filters.from || filters.to
      ? {
          from: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
          to: filters.to ? new Date(`${filters.to}T00:00:00`) : undefined,
        }
      : undefined;

  const dateLabel =
    dateMode === "day"
      ? filters.day
        ? `Día: ${format(dayDate!, "dd/MM/yyyy")}`
        : "Seleccionar día"
      : filters.from || filters.to
        ? `Rango: ${filters.from ? format(new Date(`${filters.from}T00:00:00`), "dd/MM") : "…"} – ${filters.to ? format(new Date(`${filters.to}T00:00:00`), "dd/MM") : "…"}`
        : "Seleccionar rango";

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 flex flex-col items-center gap-4 border-r border-border/60 py-1 transition-all duration-200">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          title="Expandir filtros"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <PanelLeftOpen size={16} />
        </Button>
        <div className="flex flex-col items-center gap-2">
          <Filter size={14} className="text-primary" />
          {hasActiveFilters(filters) && (
            <span className="h-2 w-2 rounded-full bg-primary" title="Filtros activos" />
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4 border-r border-border/60 pr-4 transition-all duration-200">
      <div className="flex items-center justify-between text-xs font-bold text-foreground">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-primary" />
          <span>Filtros</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          title="Colapsar filtros"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <PanelLeftClose size={14} />
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Búsqueda</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Nombre, email, teléfono…"
            className="pl-8 h-9 text-xs bg-[#0B0D13]"
          />
        </div>
      </div>

      {/* Closer (oculto para CLOSER) */}
      {!isCloser && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Closer</Label>
          <Select value={filters.closer} onValueChange={(v) => set({ closer: v })}>
            <SelectTrigger className="h-9 text-xs bg-[#0B0D13]">
              <SelectValue placeholder="Todos los closers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los closers</SelectItem>
              <SelectItem value="UNASSIGNED">Por asignar</SelectItem>
              {closers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Etapa */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Etapa</Label>
        <Select value={filters.stage} onValueChange={(v) => set({ stage: v })}>
          <SelectTrigger className="h-9 text-xs bg-[#0B0D13]">
            <SelectValue placeholder="Todas las etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las etapas</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Origen */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Origen</Label>
        <Select value={filters.origin} onValueChange={(v) => set({ origin: v as ProjectFilters["origin"] })}>
          <SelectTrigger className="h-9 text-xs bg-[#0B0D13]">
            <SelectValue placeholder="Origen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los orígenes</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estado */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Estado</Label>
        <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger className="h-9 text-xs bg-[#0B0D13]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="APPROVED">Aprobada</SelectItem>
            <SelectItem value="COMPLETE">Completada</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="REFUNDED">Reembolsada</SelectItem>
            <SelectItem value="CANCELED">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Producto */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Producto</Label>
        <Select value={filters.productId} onValueChange={(v) => set({ productId: v })}>
          <SelectTrigger className="h-9 text-xs bg-[#0B0D13]">
            <SelectValue placeholder="Todos los productos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los productos</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fecha: día ↔ rango mutuamente excluyentes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Fecha</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={dateMode === "day" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onClick={() => {
              setDateMode("day");
              set({ from: "", to: "" });
            }}
          >
            Día
          </Button>
          <Button
            type="button"
            size="sm"
            variant={dateMode === "range" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onClick={() => {
              setDateMode("range");
              set({ day: "" });
            }}
          >
            Rango
          </Button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left h-9 text-xs font-normal bg-[#0B0D13]"
            >
              <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className={filters.day || filters.from || filters.to ? "" : "text-muted-foreground"}>
                {dateLabel}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {dateMode === "day" ? (
              <Calendar
                mode="single"
                selected={dayDate}
                onSelect={(d) =>
                  set({ day: d ? format(d, "yyyy-MM-dd") : "", from: "", to: "" })
                }
              />
            ) : (
              <Calendar
                mode="range"
                selected={rangeSelected}
                onSelect={(r) =>
                  set({
                    from: r?.from ? format(r.from, "yyyy-MM-dd") : "",
                    to: r?.to ? format(r.to, "yyyy-MM-dd") : "",
                    day: "",
                  })
                }
              />
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Limpiar */}
      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground justify-start"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
        >
          <X size={13} className="mr-1" />
          Limpiar filtros
        </Button>
      )}
    </aside>
  );
}
