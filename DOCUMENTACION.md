# Estrategia de documentación — `gs_control_center`

El objetivo es llegar al final del desarrollo con un manual completo **sin haber escrito un manual al
final**. Eso solo funciona si la documentación se produce como subproducto obligatorio de cada cambio,
y si la parte más volátil (nombres de columnas, firmas de funciones, rutas, comandos) se **genera**
en vez de escribirse a mano.

Documentación escrita a mano sobre detalles que cambian = documentación mentirosa en tres meses.

---

## 1. Tres capas

| Capa | Dónde vive | Quién la escribe | Se actualiza |
|---|---|---|---|
| **A. En el código** | TSDoc sobre funciones, clases y tipos; `COMMENT ON` en SQL | El desarrollador o el agente, en el mismo commit | Junto al código, obligatorio |
| **B. Generada** | `docs/30-referencia/` | Scripts en CI | Automático en cada build |
| **C. Manuscrita** | `docs/` (capítulos, guías, manual de usuario, ADRs) | Persona o agente, en el mismo PR | Cuando cambia el comportamiento |

La capa B nunca se edita a mano. Si algo está mal ahí, se arregla el comentario en el código o el script.

---

## 2. Capa A — documentación dentro del código

### 2.1 TypeScript

Regla: **TSDoc obligatorio en todo lo exportado.** Lo privado se documenta solo si el *por qué* no es
evidente. ESLint lo verifica con `eslint-plugin-jsdoc` en modo `publicOnly`.

```ts
/**
 * Clasifica un evento de pago externo como recuperable o no recuperable
 * según el mapeo configurado para el proyecto.
 *
 * @remarks
 * El mapeo es por proyecto: el mismo código de rechazo de Hotmart puede ser
 * recuperable en un lanzamiento y no en otro. Nunca asumas el mapeo por defecto.
 *
 * @param event - Evento ya normalizado al contrato `NormalizedEvent`.
 * @param mapping - Mapeo vigente del proyecto, leído de `projects.purchase_status_map`.
 * @returns La clasificación y la razón legible que se muestra al closer en Telegram.
 * @throws {UnknownStatusError} Si el estado externo no está en el mapeo. Se encola para
 *         revisión manual en vez de descartarse.
 *
 * @example
 * ```ts
 * const r = classifyPurchaseStatus(event, mapping);
 * if (r.recoverable) await pipeline.moveToRecoverable(event.leadId);
 * ```
 */
export function classifyPurchaseStatus(...) {}
```

Qué documentar de verdad: **el porqué y las reglas de negocio no evidentes**, no el qué.
`@param userId - El id del usuario` no aporta nada y ensucia. `@param userId - Debe ser el closer
asignado, no quien ejecuta la acción; un DIRECTOR puede mover leads de otros` sí.

En el frontend, todo componente exportado lleva TSDoc con su propósito, los roles que lo ven y qué
estados implementa.

### 2.2 Base de datos — la regla que evita el diccionario desactualizado

**`DICCIONARIO.md` deja de escribirse a mano y pasa a generarse desde la propia base de datos.**

Toda migración que crea o modifica una tabla o columna incluye su `COMMENT ON`:

```sql
COMMENT ON TABLE  pipeline.rows IS
  'Filas del pipeline. Columnas críticas promovidas + payload dinámico en data.';
COMMENT ON COLUMN pipeline.rows.row_version IS
  'Bloqueo optimista. El cliente envía la versión que leyó; si no coincide, la edición se rechaza con CONFLICT.';
COMMENT ON COLUMN pipeline.rows.data IS
  'Campos dinámicos definidos por proyecto. Validado con PipelineRowDataSchema antes de persistir.';
```

El script `scripts/gen-dictionary.ts` consulta `information_schema` y `pg_description` y escribe
`docs/30-referencia/diccionario-db.md` con tablas, columnas, tipos, nulabilidad, defaults, índices,
políticas RLS y el comentario. **CI falla si una columna nueva no tiene comentario.** Esa única regla
mantiene el diccionario vivo sin esfuerzo.

### 2.3 GraphQL

Cada tipo, campo, query y mutation lleva `"""descripción"""` en el SDL. El schema se exporta en build y
`graphql-markdown` genera `docs/30-referencia/api-graphql.md`. Deprecaciones con `@deprecated(reason:)`,
que aparecen automáticamente en el documento.

---

## 3. Capa B — lo que se genera solo

| Artefacto | Fuente | Herramienta | Salida |
|---|---|---|---|
| Referencia de código | TSDoc | TypeDoc | `docs/30-referencia/api-codigo/` |
| Diccionario de base de datos | `COMMENT ON` + `information_schema` | `scripts/gen-dictionary.ts` | `docs/30-referencia/diccionario-db.md` |
| Diagrama entidad-relación | Prisma schema | `prisma-erd-generator` | `docs/30-referencia/erd.svg` |
| API GraphQL | SDL | `graphql-markdown` | `docs/30-referencia/api-graphql.md` |
| API REST (webhooks) | Decoradores Swagger de Nest | `@nestjs/swagger` | `docs/30-referencia/api-rest.md` + OpenAPI JSON |
| Rutas del frontend | Árbol de `apps/web/app/` | `scripts/gen-routes.ts` | `docs/30-referencia/rutas.md` |
| Catálogo de comandos | Targets comentados del `Makefile` | `scripts/gen-commands.ts` | `docs/30-referencia/comandos.md` |
| Variables de entorno | `packages/contracts/env.ts` (Zod) | `scripts/gen-env-docs.ts` | `docs/30-referencia/variables-entorno.md` |
| Catálogo de jobs y eventos | Manifiestos de módulo | `scripts/gen-catalog.ts` | `docs/30-referencia/eventos-y-jobs.md` |
| Matriz de permisos | Reglas CASL | `scripts/gen-permissions.ts` | `docs/30-referencia/matriz-permisos.md` |

Los tres últimos son los que más valor dan y casi nadie hace: el catálogo de eventos evita que dos
módulos se pisen, y la matriz de permisos convierte el RBAC en algo revisable de un vistazo por alguien
que no lee código.

Todo esto corre con `make docs` y en CI. `docs/30-referencia/` va en `.gitignore`: se construye, no se
versiona.

---

## 4. Capa C — los capítulos escritos

```
docs/
├── 00-introduccion/        Qué es, glosario de negocio, roles, primeros pasos
├── 10-arquitectura/        Visión general, fronteras, decisiones, modelo de datos, seguridad
├── 20-servicios/           Un capítulo por módulo (auth, projects, pipeline, sales, ...)
├── 30-referencia/          GENERADO — no editar
├── 40-operacion/           Despliegue, entornos, backups, monitoreo, runbooks, troubleshooting
├── 50-manual-usuario/      Por rol: super-admin, admin, director, closer, cliente
├── adr/                    Decisiones arquitectónicas con fecha y contexto
└── _plantillas/            Plantillas que se copian al crear capítulo o ADR
```

### Capítulo por servicio
Cada módulo tiene un capítulo con estructura fija (ver `docs/_plantillas/capitulo-servicio.md`):
responsabilidad, fronteras, modelo de datos, API pública, eventos que emite y consume, jobs, reglas de
negocio, permisos por rol, configuración, errores conocidos y cómo probarlo localmente.

**El capítulo se crea el mismo día que el módulo, no después.** El generador de módulos lo crea vacío
con la plantilla y CI falla si queda con los marcadores `TODO` sin reemplazar al cerrar la fase.

### Manual de usuario
Escrito por rol y en lenguaje de negocio, sin jerga técnica. Cada procedimiento con capturas y el
resultado esperado. Se escribe a medida que la funcionalidad se termina: al cerrar la fase 3 debe
existir "Manual del closer: gestionar mis leads", no al final del proyecto.

### ADRs
Una decisión por archivo, numerada, con: contexto, opciones consideradas, decisión, consecuencias.
Nunca se editan; si una decisión cambia, se escribe un ADR nuevo que supersede al anterior.
Los primeros están listos para escribir: monolito modular, schema por módulo, BullMQ en lugar de
`pg_cron`, CASL como autorización primaria, SSE en lugar de WebSockets.

---

## 5. Sitio de documentación

**Docusaurus** en `apps/docs`, que compone las capas B y C en un sitio con búsqueda.
Se construye en CI y se sirve en `docs.<dominio>` detrás de Traefik, protegido con autenticación básica
(el manual de usuario incluye detalles operativos que no deben ser públicos).

Contenedor de solo estáticos (nginx alpine, ~20 MB). El manual de usuario también se exporta a PDF por
rol para entregar a clientes.

---

## 6. Cómo se mantiene viva

Estas cuatro reglas son las que hacen que funcione. Sin ellas, esto se degrada en seis semanas.

1. **Una funcionalidad no está terminada si su capítulo no refleja lo que hace.** Está en el Definition
   of Done de `AGENTS.md` y en el workflow `/nueva-feature`.
2. **CI verifica lo verificable:** TSDoc en exportados, `COMMENT ON` en columnas nuevas, descripciones en
   el SDL de GraphQL, enlaces rotos en `docs/`, marcadores `TODO` en capítulos de módulos ya cerrados.
3. **CI avisa de lo que no puede verificar:** si un PR toca `src/modules/sales/**` y no toca
   `docs/20-servicios/sales.md`, deja un comentario preguntando si corresponde. Es un aviso, no un
   bloqueo — a veces un refactor no cambia el comportamiento.
4. **El agente documenta mientras implementa, no al final.** La skill `documentacion` y la regla
   `40-documentacion.md` lo hacen parte del procedimiento normal, no un paso extra que se olvida.

---

## 7. Orden de construcción

No hace falta montar todo en la fase 0. Lo mínimo primero, el resto cuando haya contenido que mostrar.

| Fase | Qué se monta |
|---|---|
| **0** | Esqueleto `docs/`, plantillas, ADR-0001 a 0005, regla de TSDoc en lint |
| **1** | `gen-dictionary.ts` + verificación de `COMMENT ON` en CI, capítulo de `auth` |
| **2** | TypeDoc, `graphql-markdown`, Docusaurus corriendo en local |
| **3** | Manual del closer y del director, `gen-routes.ts`, `gen-permissions.ts` |
| **4** | Capítulos de `integrations` y `sales`, `gen-catalog.ts`, runbook de webhooks |
| **6** | Manual del cliente, glosario de KPIs con las fórmulas exactas |
| **7** | Runbooks de operación, guía de despliegue, troubleshooting, sitio publicado |
| **8** | Guía "cómo agregar un módulo nuevo", exportación a PDF del manual |

El glosario de KPIs de la fase 6 merece atención: es el documento que te va a evitar discusiones con
clientes sobre por qué su facturación neta no coincide con su cálculo. Escribe la fórmula exacta, qué
se descuenta y qué no.
