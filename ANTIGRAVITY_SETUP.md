# Configuración de Antigravity para `gs_control_center`

## 1. Cómo se organiza la configuración

Antigravity lee la configuración en cuatro capas, de más general a más específica:

| Capa | Global | Workspace | Qué poner |
|---|---|---|---|
| **Rules** | `~/.gemini/GEMINI.md` | `AGENTS.md` en la raíz + `.agents/rules/*.md` | Instrucciones siempre activas |
| **Skills** | `~/.gemini/antigravity/skills/` | `.agents/skills/<nombre>/SKILL.md` | Procedimientos que se cargan bajo demanda |
| **Workflows** | `~/.gemini/config/global_workflows/` | `.agents/workflows/*.md` | Prompts invocables con `/` |
| **Agents** | `~/.gemini/config/agents/` | `.agents/agents/*.md` | Agentes especializados |
| **MCP** | `~/.gemini/config/mcp_config.json` | — | Servidores MCP |

Dos advertencias que ahorran tiempo:

- Las rutas globales varían entre Antigravity IDE, AGY y AGY CLI, y la documentación no siempre coincide.
  Si dudas, usa el comando `/skills` dentro de la herramienta: te dice exactamente dónde está buscando.
- Antigravity IDE y Gemini CLI comparten `~/.gemini/GEMINI.md`. Si usas ambos, las instrucciones se
  mezclan. Por eso este proyecto pone todo a nivel de workspace y deja el archivo global vacío.

**Todo lo de este proyecto va versionado en el repositorio.** No pongas `.agents/` en `.gitignore`:
Antigravity no indexaría nada y cada persona del equipo tendría un agente distinto.

## 2. Instalación

1. Coloca el bundle en la raíz del repositorio:

```
gs_control_center/
├── AGENTS.md
├── .agents/
│   ├── rules/
│   ├── skills/
│   ├── workflows/
│   ├── agents/
│   └── mcp_config.json
```

2. Abre la carpeta del proyecto en Antigravity y reinicia la ventana para que reindexe.
3. Verifica con `/skills` que aparecen las seis skills del workspace.
4. En **Manage MCP servers → View raw config**, fusiona el contenido de `.agents/mcp_config.json` con tu
   configuración global. Antigravity usa un esquema algo más estricto que otros clientes: los servidores
   remotos por HTTP se declaran con `serverUrl`, no con `url`.

## 3. Sobre el límite de 12.000 caracteres

Cada archivo de reglas tiene un tope de unos 12.000 caracteres. `AGENTS.md` de este bundle está por
debajo con margen, y las reglas están repartidas en cuatro archivos temáticos para no acercarse al límite
y para que sean fáciles de editar sin romper el resto.

Si necesitas añadir reglas, crea un archivo nuevo en `.agents/rules/` en vez de engordar `AGENTS.md`.
Lo que va en `AGENTS.md` es lo que debe estar en contexto en cada conversación; lo que se necesita solo
a veces va en una skill.

## 4. Rules, Skills, Workflows y Agents: cuál usar

Es la decisión que más se equivoca al empezar.

- **Rule** — siempre activa, en cada conversación. Reservada para invariantes: "nunca uses `any`",
  "un módulo solo toca su schema". Cada regla que agregas ocupa contexto en todas las tareas, así que
  si algo aplica solo a veces, no es una regla.
- **Skill** — el agente la carga solo cuando el `description` del frontmatter coincide con la tarea.
  Aquí va el procedimiento largo: cómo escribir una migración con RLS, cómo estructurar un adaptador de
  integración. Es el lugar donde el detalle sale barato.
- **Workflow** — lo invocas tú con `/`. Es una secuencia que quieres repetir idéntica:
  `/nueva-feature`, `/revision-seguridad`, `/preparar-despliegue`.
- **Agent** — una persona distinta con otro criterio. Este bundle incluye `planner` (descompone antes de
  codificar) y `reviewer` (audita sin reescribir). Separarlos importa: el mismo agente que escribió el
  código es mal revisor de ese código.

## 5. Las skills incluidas

| Skill | Se activa cuando |
|---|---|
| `nestjs-module` | Se crea o extiende un módulo, caso de uso, resolver o endpoint del backend |
| `prisma-postgres-rls` | Se toca el esquema, se crea una tabla o columna, o aparece RLS, JSONB, GIN o particiones |
| `integration-adapter` | Webhooks, ingesta de ventas, recuperables, idempotencia, proveedor nuevo |
| `graphql-resolver` | Query, mutation, N+1, paginación, tiempo real |
| `kpi-metrics` | KPIs, vistas materializadas, metas, comisiones, dashboards lentos |
| `shadcn-data-view` | Cualquier pantalla, tabla, kanban o componente del frontend |

El `description` del frontmatter es lo único que decide si la skill se carga. Si notas que una no se
activa cuando debería, el arreglo es hacer su descripción más explícita sobre los términos que tú usas
al pedir las cosas ("hazme la pantalla de…", "agrégale una columna a…"), no reescribir el cuerpo.

## 6. Cómo trabajar con el agente en este proyecto

Antigravity funciona en ciclo planificación → ejecución → verificación, con un plan que apruebas antes
de que escriba código. Aprovéchalo:

1. **Empieza por el plan.** Para cualquier cosa que toque más de un archivo, usa `/nueva-feature` o pide
   explícitamente el plan primero. Revisar un plan de veinte líneas cuesta dos minutos; revisar
   ochocientas líneas de código equivocado cuesta una tarde.
2. **Una unidad por conversación.** Un módulo con su migración y sus pruebas. Conversaciones largas
   arrastran contexto obsoleto y el agente empieza a contradecir decisiones que ya tomaste.
3. **Revisa con otro agente.** Al terminar, `/revision-seguridad` o el agente `reviewer`. En este
   producto, una fuga entre proyectos o entre roles es el fallo más caro que puede ocurrir.
4. **Nunca dejes que despliegue o migre producción solo.** Está escrito en `AGENTS.md` y en el workflow
   de despliegue, pero conviene tenerlo presente: prepara, muestra, y ejecutas tú.
5. **Cuando corrijas al agente dos veces sobre lo mismo, escríbelo.** Si es un invariante, va a
   `.agents/rules/`; si es un procedimiento, va a la skill correspondiente. Eso es lo que hace que el
   setup mejore en vez de degradarse.

## 7. MCP útiles para este proyecto

- **Postgres en solo lectura** apuntando a la base de desarrollo: el agente puede inspeccionar el
  esquema real en vez de adivinar columnas. Usa un rol de solo lectura, nunca el de escritura.
- **Filesystem** acotado a `db_postgres/` y `Docs/` para que el diccionario y los requerimientos estén
  siempre a mano.

Evita conectar MCP con acceso de escritura a producción. El agente no necesita esa capacidad para
ninguna tarea de desarrollo, y la superficie de error no compensa la comodidad.
