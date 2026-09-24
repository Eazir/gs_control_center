# ADR-0001: Monolito modular en lugar de microservicios

- **Fecha:** 2026-09-16
- **Estado:** aceptado
- **Afecta a:** todo el backend

## Contexto
El diseño inicial planteaba siete microservicios NestJS con Apollo Federation. Todos correrían en el
mismo VPS de 6 vCPU / 12 GB y contra la misma instancia de PostgreSQL, con un equipo de una o dos
personas.

## Opciones consideradas
1. **Siete microservicios con Federation** — aislamiento nominal; a favor: la separación es física.
   En contra: 1,5–2,5 GB de overhead solo en procesos, siete despliegues, composición de subgrafos,
   tracing distribuido para bugs triviales, y ninguno de los beneficios reales porque comparten host y
   motor de base de datos.
2. **Monolito modular con fronteras aplicadas por lint y GRANT** — un despliegue lógico en tres
   procesos (`api`, `ingest`, `worker`). En contra: la disciplina de fronteras depende de herramientas
   y revisión, no de la imposibilidad física.

## Decisión
Opción 2. Las fronteras se aplican con `eslint-plugin-boundaries`, `GRANT` por schema y manifiestos de
módulo. El proceso `ingest` se separa porque su perfil de carga (picos de webhooks) sí justifica
aislamiento real.

## Consecuencias
- Positivas: cabe holgado en el VPS, un despliegue, transacciones simples, onboarding rápido.
- Negativas: nada impide físicamente romper una frontera; hay que sostener la disciplina en CI.
- Para revisar: si `ingest` necesita escalar horizontalmente o un módulo pide otro ciclo de despliegue,
  se extrae siguiendo el camino descrito en `10-arquitectura/extensibilidad.md`.
