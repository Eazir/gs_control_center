# Work/tests.md — Plan de pruebas por fase

> **Autor:** Opencode · **Ejecutor de las pruebas:** Antigravity (Gemini)
> Debe quedar **todo en verde antes** de que David haga las pruebas operativas sobre la plataforma.
> Cada prueba mapea a un criterio verificable de `Work/plan.md`.

## Fase

- **Identificador:** _(p. ej. Fase 2)_
- **Comando obligatorio de cierre:** `make check` (`pnpm lint` + `pnpm typecheck` + `pnpm test`)

## Pruebas unitarias

| ID | Unidad | Escenario | Resultado esperado |
|---|---|---|---|
| U-01 | _(servicio/función)_ | _(caso)_ | _(assert)_ |

## Pruebas de funcionalidad / integración

| ID | Flujo | Pasos | Resultado esperado |
|---|---|---|---|
| F-01 | _(flujo end-to-end)_ | _(pasos)_ | _(assert)_ |

> Usa **Testcontainers** cuando la prueba toque RLS, RBAC/CASL o idempotencia.

## Pruebas de seguridad y aislamiento

| ID | Caso | Resultado esperado |
|---|---|---|
| S-01 | CLOSER intenta leer un lead ajeno | 403 / fila no visible |
| S-02 | CLIENTE intenta acceder a datos operativos o PII | 403 / sin datos |
| S-03 | Cross-project sin ser SUPER_ADMIN/ADMIN | 403 |
| S-04 | Módulo X intenta consultar schema de Y | build/boundaries falla |

## Pruebas de UI (si hay vista nueva)

| ID | Vista | Estados a verificar |
|---|---|---|
| UI-01 | _(pantalla)_ | loading (skeleton) / empty (CTA) / error (reintento) / data |

## Evidencia

- _(comando ejecutado + resumen de salida)_
- _(capturas o logs relevantes, sin PII ni secretos)_

## Estado

- [ ] Todas las pruebas creadas
- [ ] Todas en verde
- [ ] `make check` en verde
