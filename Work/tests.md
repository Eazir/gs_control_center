# Work/tests.md — Fase F2 (+ mini-fix pipeline)

> **Fase:** F2 — KPIs por origen (comercial vs marketing) + mini-fix pipeline.
> **Estilo:** scripts `tsx test/verify-*.ts` para lo puro; operativo para lo de BD/UI.
> **Referencia:** `Work/plan.md` (F2) y `Work/instructions.md`.

## Cómo se ejecutan

```bash
pnpm --filter api test:origins      # unit (consistencia del split)
make check                          # lint + typecheck + tests
```

---

## T1 — Unit: consistencia del split por origen

**Archivo nuevo:** `apps/api/test/verify-origins.ts`
**Script nuevo:** `"test:origins": "tsx test/verify-origins.ts"` en `apps/api/package.json`

**Qué verifica:** la invariante `comercial + marketing == total`. Para hacerla testeable sin BD, extraer en
`apps/api/src/core/sales/origin-split.ts` (o en `kpi-metrics.util.ts`) una función pura:

```ts
export function splitByOrigin(total: number, comercial: number): { comercial: number; marketing: number } {
  const marketing = Math.round((total - comercial) * 100) / 100;
  return { comercial, marketing };
}
```

| Caso | `total` | `comercial` | → `comercial` | → `marketing` |
|---|---|---|---|---|
| 1 | 1000 | 600 | 600 | 400 |
| 2 | 1000 | 0 | 0 | 1000 |
| 3 | 1000 | 1000 | 1000 | 0 |
| 4 | 999.99 | 333.33 | 333.33 | 666.66 |

**Criterio de aceptación:** `verify-origins: OK` (exit 0).

---

## T2 — Verificación operativa (David, tras `correcciones.md`)

1. **Dashboard por origen:** en el dashboard se ven "Comercial" y "Marketing" desglosados con **volumen**,
   **facturación bruta** y **facturación neta**.
2. **Consistencia:** para cada KPI, `comercial + marketing == total` (revisar con un día/rango conocido).
3. **F3 alineado:** una venta con SCK fijo (`dh`) aparece en **comercial** (no marketing), aunque tenga
   `closer_id = null` (tras F3.1).
4. **Pipeline:** cada etapa del kanban muestra hasta 20 tarjetas (y "+N prospectos ocultos" si hay más).

---

## Trazabilidad con el plan F2 ("Terminado cuando")

| Criterio del plan | Cubierto por |
|---|---|
| Dashboard devuelve volumen/bruta/neta desglosados | T2 #1 |
| Consistencia comercial + marketing == total | T1 + T2 #2 |
| Clasificación alineada a F3 | T2 #3 |
| Pipeline 20 por etapa | T2 #4 |
| `make check` en verde | `pnpm lint` + `pnpm typecheck` + T1 |

## Definition of Done (fragmento aplicable a F2)

- [ ] `pnpm lint` y `pnpm typecheck` sin errores.
- [ ] T1 en verde.
- [ ] Sin `any`, TSDoc en lo exportado, sin tocar F0/F3/F1.
- [ ] Frontend con los 4 estados de UI en la vista modificada.
