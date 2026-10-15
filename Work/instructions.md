# Work/instructions.md — Instrucciones para Antigravity

> **Autor:** Opencode · **Ejecutor:** Antigravity (Gemini)
> Una fase por entrega. Antigravity no implementa nada fuera de este documento; si falta algo, lo reporta.

## Fase

- **Identificador:** _(p. ej. Fase 2)_
- **Objetivo:** _(qué debe quedar funcionando)_

## Alcance

- **Sí entra:** _(lista)_
- **No entra:** _(lista explícita para evitar deriva)_

## Archivos objetivo

| Archivo | Acción | Notas |
|---|---|---|
| `apps/api/src/modules/...` | crear / editar | |
| `apps/api/prisma/schema.prisma` | editar | migración incluida |
| `packages/contracts/src/...` | crear / editar | Zod |
| `apps/web/src/...` | crear / editar | RSC por defecto |

## Contratos y firmas

_(Esquemas Zod, tipos GraphQL, firmas de servicio, endpoints REST. La firma exacta que debe respetarse.)_

## Reglas a respetar (recordatorio)

- Un módulo solo toca su propio schema; cero FKs entre schemas; sin imports de Prisma ajenos.
- TypeScript `strict`; `any` prohibido (usa `unknown` o tipos `Prisma.*`).
- DataLoader obligatorio en relaciones GraphQL; escrituras multi-tabla en `$transaction`; `withRls()`.
- Webhooks: HTTP solo valida firma → `integrations.events` `RECEIVED` → BullMQ → `200 OK` < 100 ms.
- UI: shadcn/ui + Tailwind + Lucide; cuatro estados (loading / empty / error / data).
- TSDoc en lo exportado; `COMMENT ON` en columnas nuevas; actualizar `docs/20-servicios/<modulo>.md`.

## Definition of Done de esta fase

- [ ] `pnpm build` sin errores
- [ ] `pnpm lint` sin advertencias críticas
- [ ] Pruebas de `Work/tests.md` en verde
- [ ] Migración Prisma incluida (si toca DB)
- [ ] `make docs-check` en verde

## Notas / aclaraciones

_(Casos borde, decisiones acordadas, referencias a skills o rules concretas.)_
