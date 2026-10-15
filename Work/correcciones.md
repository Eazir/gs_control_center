# Work/correcciones.md — Auditoría de Opencode

> **Autor:** Opencode (auditor) · **Corrige:** Antigravity (Gemini)
> Este documento cierra cada fase. Sin visto bueno aquí, no se avanza.

## Fase auditada

- **Identificador:** _(p. ej. Fase 2)_
- **Fecha:** _(AAAA-MM-DD)_
- **Veredicto:** ⛔ Correcciones obligatorias · ✅ Aprobada para siguiente fase

## Verificación automática

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | _(0 errores / N)_ |
| `pnpm lint` | |
| `pnpm test` | |
| `pnpm build` | |
| `make docs-check` | |

## Hallazgos

| ID | Severidad | Archivo / zona | Problema | Corrección obligatoria |
|---|---|---|---|---|
| C-01 | bloqueante / mayor / menor | | | |

**Categorías a revisar siempre:** lógica incorrecta, tipos `any`, imports faltantes, violación de frontera
entre módulos (schema ajeno), N+1 sin DataLoader, escrituras sin `$transaction`, `SET LOCAL` fuera de
`withRls()`, fallos de aislamiento CLOSER/CLIENTE, cuatro estados de UI ausentes, secretos/PII en logs,
TSDoc o `COMMENT ON` faltantes, documentación de servicio sin actualizar.

## Correcciones aplicadas (por Antigravity)

- _(fecha)_ — C-01 — _(qué se hizo y cómo se verificó)_

## Criterio de aprobación

- [ ] 0 hallazgos bloqueantes abiertos
- [ ] `make check` en verde
- [ ] `Work/tests.md` completo y en verde
- [ ] Done de la fase en `Work/instructions.md` cumplido

**Visto bueno:** _(Opencode — fecha)_
