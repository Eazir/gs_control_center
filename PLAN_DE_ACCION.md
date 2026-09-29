# Plan de acción — `gs_control_center`

Ocho fases. Cada una termina en algo que se puede ejecutar y demostrar de punta a punta, no en un entregable interno.
Las duraciones son para un equipo pequeño (1–2 personas) trabajando con agentes; ajústalas a tu ritmo real.

**Regla de desarrollo paralelo Funcionalidad-Interfaz:**
Por cada servicio o módulo de dominio, se implementa en paralelo la **Funcionalidad (Backend / DB / Contratos)** y su correspondiente **Interfaz de Usuario (UI / UX)**. La UI se construye exclusivamente sobre **Next.js App Router (RSC por defecto) + shadcn/ui + Tailwind CSS + Lucide Icons**, bajo un **tema oscuro premium** (Dark theme `#090A0F` / `#12151C`) con acento dorado corporativo (**GrowthSell Gold** `#F59E0B`), respetando la disposición visual del Centro de Mando y garantizando siempre los **cuatro estados de vista**: *loading* (skeleton proporcional), *empty* (con CTA), *error* (accionable con reintento) y *data*.

**Regla que ordena todo el plan:** la primera venta real ingresada automáticamente desde Hotmart debe
llegar en la fase 4. Todo lo anterior existe para soportar ese momento. Si una fase se alarga, recorta
alcance antes que posponer esa fecha.

---

## Fase 0 — Fundación del repositorio (Completada ✔)

- [x] Monorepo pnpm + Turborepo (`apps/` + `packages/`).
- [x] `packages/config`: tsconfig estricto, ESLint con `eslint-plugin-boundaries` configurado para bloquear importaciones entre módulos, Prettier.
- [x] `packages/contracts` conectado a ambos lados con Zod.
- [x] `docker-compose.yml` local: Postgres 16, Redis 7, Traefik.
- [x] `.agents/` con reglas, skills y workflows. `AGENTS.md` en la raíz.
- [x] GitHub Actions: lint + typecheck + build en cada push.

---

## Fase 1 — Base de datos, autenticación y pantallas de acceso

- **Funcionalidad (Backend / DB / Seguridad) [Completado ✔]:**
  - [x] Migrar scripts de `db_postgres/` a 7 schemas en 1 base de datos con roles de servicio.
  - [x] Migraciones Prisma iniciales de `auth` y `projects`. Extensiones: `pgcrypto`.
  - [x] Módulo `auth`: registro por invitación, login con Argon2id, JWT de 15 min, refresh rotativo en cookie `HttpOnly; SameSite=Strict`, denylist en Redis, log de auditoría.
  - [x] CASL con los cinco roles (`SUPER_ADMIN > ADMIN > DIRECTOR > CLOSER > CLIENTE`).
  - [x] Helper `withRls()` y políticas RLS en PostgreSQL con suite de integración aprobada al 100%.
  - [x] Actualizar `DICCIONARIO.md` con schemas `auth` y `projects`.
- **Interfaz (UI / UX en `apps/web`) [Completado ✔]:**
  - [x] **Design System Base:** Configuración de Tailwind, tokens de color (Dark theme + GrowthSell Gold `#F59E0B`), tipografía moderna y catálogo inicial de componentes shadcn/ui (Button, Input, Card, Badge, Label, Alert, Skeleton).
  - [x] **Pantalla `Auth - Login`:** Tarjeta centrada con logo hexagonal dorado de GrowthSell, inputs de correo y contraseña con toggles, botón dorado "Iniciar sesión", enlace "¿Olvidaste tu contraseña?" y manejo de estados loading/error/success.
  - [x] **Pantalla `Auth - Crear Contraseña / Aceptar Invitación`:** Tarjeta centrada de bienvenida, pill con email de la invitación, inputs de nueva contraseña y confirmación, botón dorado "ACEPTAR", validación Zod en tiempo real.

**Terminado cuando:** un usuario inicia sesión desde la interfaz web o mediante API, recibe su cookie segura, y las pruebas de aislamiento RLS y CASL confirman que no puede leer filas ajenas. (✔ Verificado en Backend y Frontend)

---

## Fase 2 — Proyectos, catálogo y shell administrativo

- **Funcionalidad (Backend / Contratos):**
  - [ ] Módulo `projects`: CRUD de proyectos, asignación de usuarios con roles de proyecto (`DIRECTOR`, `CLOSER`, `CLIENTE`), catálogo de productos válidos.
  - [ ] GraphQL con codegen de tipos de punta a punta entre backend y frontend.
- **Interfaz (UI / UX en `apps/web`):**
  - [ ] **Shell Administrativo (Sidebar & Layout):**
    - Barra lateral oscura con logo hexagonal "GrowthSell CENTRO DE MANDO".
    - Menú de navegación activo: `Dashboard Global`, `Todos los Proyectos`, `Usuarios y Roles`, `Integraciones`, `Ajustes`.
    - Cabecera con breadcrumbs, fecha actual y selector de proyectos activos.
    - Footer del sidebar con tarjeta/pill de usuario autenticado (avatar con iniciales, nombre, rol y acción de logout).
  - [ ] **Pantalla `Admin - Todos los Proyectos`:**
    - Cabecera "Proyectos Activos" (con botón para nuevo proyecto).
    - Grid de tarjetas de proyecto: Director asignado con avatar, badge de estado (*Activo*, *En riesgo*, *En pausa*, *Archivado*), métricas de Leads Totales y Facturación Bruta, y barra de progreso dorada de alcance de meta mensual.
    - Diálogo/Modal para crear y editar proyecto y su catálogo de productos.
  - [ ] **Pantalla `Usuarios y Roles`:**
    - Listado/tabla de usuarios con badges de rol y estado (*Activo*, *Invitado*, *Suspendido*).
    - Modal para invitar usuario vía email (conectado a `POST /auth/invite`).
  - [ ] **Componentes base de los 4 estados:** Skeleton proporcional para tarjetas y tablas, componente Empty State con CTA, y Error State con reintento.

**Terminado cuando:** un ADMIN inicia sesión en la web, navega por el shell, crea un proyecto con su director y catálogo de productos desde la interfaz, y envía una invitación a un closer que la recibe y activa su cuenta.

---

## Fase 3 — Pipelines dinámicos (Leads, Columnas y Kanban)

- **Funcionalidad (Backend / DB):**
  - [ ] Schema `pipeline`: definición de pipelines y columnas dinámicas, filas con columnas fijas + `data` JSONB.
  - [ ] Historial `row_history` particionada mensual y `row_version` para bloqueo optimista.
  - [ ] Índices GIN sobre filtros JSONB.
  - [ ] API con paginación keyset por cursor y mutaciones masivas transaccionales.
- **Interfaz (UI / UX en `apps/web`):**
  - [ ] **Pantalla `Pipeline de Ventas`:**
    - Selector dual de vista: **Tabla Virtualizada** (TanStack Table) y **Tablero Kanban** con columnas por etapa (*Nuevo Lead*, *Contactado*, *Llamada Agendada*, *Negociación*, *Cerrado Ganado*, *Perdido*).
    - Edición optimista de celdas con reversión visual inmediata en caso de conflicto de concurrencia.
    - Aislamiento visual por rol: el `CLOSER` solo ve sus leads en la tabla/kanban; el `CLIENTE` no tiene acceso a leads ni PII.
    - Barra de herramientas: filtros por closer, stage, rango de fechas, buscador instantáneo y barra flotante de acciones masivas sobre leads seleccionados.

**Terminado cuando:** un director configura etapas y columnas, un closer arrastra leads y edita notas en el kanban viendo únicamente sus asignados, y una actualización masiva sobre 500 filas responde fluidamente sin recargar la página.

---

## Fase 4 — Ingesta Hotmart y Gestión de Ventas ← El Hito

- **Funcionalidad (Backend / Integración):**
  - [ ] Schema `integrations`: adaptadores, credenciales cifradas con AES-256-GCM, tabla `events` particionada mensual con restricción única de idempotencia.
  - [ ] Servicio `ingest`: endpoint HTTP ultraligero (<100ms) que valida firma, persiste en crudo y encola en BullMQ.
  - [ ] Worker BullMQ: normalización de clientes, ventas, cuotas y transacciones en schema `sales`.
  - [ ] Reconciliación diaria automática contra la API REST de Hotmart.
- **Interfaz (UI / UX en `apps/web`):**
  - [ ] **Pantalla `Integraciones`:**
    - Panel de conexión de Hotmart: estado de webhook, endpoint URL de escucha, token/secreto de firma verificado.
    - Monitor de eventos en tiempo real: tabla de eventos recibidos con badges de estado (`RECEIVED`, `PROCESSED`, `FAILED`, `DEAD_LETTER`), detalles del payload crudo e historial de reintentos.
    - Botón de conciliación manual bajo demanda con barra de progreso.
  - [ ] **Pantalla `Ventas y Transacciones`:**
    - Listado de ventas procesadas con desglose de cliente, producto, moneda, monto bruto, comisiones e impuestos.

**Terminado cuando:** una compra simulada o real en Hotmart impacta el endpoint, el worker la procesa en segundo plano y la venta aparece automáticamente en la pantalla de ventas y en el pipeline correspondiente sin intervención manual.

---

## Fase 5 — Recuperación de ventas y Alertas en Telegram

- **Funcionalidad (Backend / Automatización):**
  - [ ] Mapeo configurable de estados de compra por proyecto (recuperables vs no recuperables).
  - [ ] Flujo automático: evento fallido de Hotmart → inserción automática en stage "Recuperable" → asignación a closer → notificación instantánea.
  - [ ] Schema `automation`: reglas, vinculaciones de Telegram (`telegram_links`), log de envíos.
  - [ ] Bot de Telegram con comandos de vinculación y alertas enriquecidas con botón directo de contacto.
- **Interfaz (UI / UX en `apps/web`):**
  - [ ] Actualización en tiempo real vía **SSE (Server-Sent Events)** para que los carritos abandonados y ventas recuperables aparezcan en el pipeline al instante sin refrescar la página.
  - [ ] Modal de configuración de reglas de recuperación por proyecto.
  - [ ] Modal de vinculación de cuenta de Telegram para el closer (código QR / Deep Link).

**Terminado cuando:** un abandono de carrito genera una alerta en Telegram en menos de 30 segundos, el lead ingresa al pipeline con SSE y el closer puede atenderlo de inmediato.

---

## Fase 6 — Dashboards, KPIs, Metas y Comisiones

- **Funcionalidad (Backend / Analítica):**
  - [ ] Vistas materializadas `mv_daily_kpis`, `mv_closer_daily_kpis`, `mv_funnel` con índice único y refresco concurrente desde BullMQ.
  - [ ] Motor de cálculo de comisiones escalonadas y metas por closer/período.
- **Interfaz (UI / UX en `apps/web` - Según maqueta de referencia):**
  - [ ] **Pantalla `Admin - Dashboard Global`:**
    - **Tarjetas de Métricas Generales (KPI Cards):** Facturación Bruta, Ingresos Netos, Ventas Totales, Ticket Promedio, con indicadores de variación porcentual vs mes anterior.
    - **Gráfico Comparativo "Facturación vs Ingresos":** Gráfico de barras interactivo diario/semanal con la paleta oscura y barras en tono GrowthSell Gold y neutral.
    - **Tarjeta "Origen de Ventas":** Desglose de ingresos por producto con montos y porcentajes de contribución.
    - **Tabla "Rendimiento por Proyecto":** Tabla con columnas de Proyecto, Fact. Bruta, Comisiones, Estado y barra de progreso dorada de Cumplimiento de Meta.
  - [ ] **Dashboard Ejecutivo del rol `CLIENTE`:**
    - Vista ejecutiva optimizada y de solo lectura de su proyecto.
    - Estricto blindaje de datos: muestra únicamente facturación agregada, tickets y rendimiento general, ocultando completamente datos de contacto de clientes (PII) y operaciones de closers.
  - [ ] **Pantalla de Rendimiento de Closers:** Ranking de ventas, tasa de conversión individual y liquidación de comisiones.

**Terminado cuando:** un director visualiza el dashboard general con gráficos y métricas consolidadas, y un cliente externo accede a su enlace protegido viendo su rentabilidad sin acceder a ningún dato de contacto ni operativa interna.

---

## Fase 7 — Endurecimiento y producción

- [ ] Traefik con Let's Encrypt, `docker-compose.prod.yml`, límites de memoria por contenedor según el presupuesto de 12 GB.
- [ ] Rate limiting con Redis en login, endpoints públicos y webhooks.
- [ ] Backups: `pg_dump` + WAL → restic → B2/S3 con restauración de prueba ejecutada.
- [ ] Observabilidad: Pino en JSON, Sentry, alertas sobre cola BullMQ.
- [ ] Suite E2E con Playwright cubriendo los flujos críticos de cada uno de los 5 roles.
- [ ] Pipeline de despliegue automatizado por GitHub Actions con confirmación manual de migraciones.
- [ ] Prueba de carga sobre `ingest` simulando pico de lanzamiento.

**Terminado cuando:** el sistema corre en el VPS con SSL, backups verificados, y tumbar el contenedor `api` no pierde un solo webhook entrante.

---

## Fase 8 — Integraciones adicionales e IA

- [ ] Adaptadores Centralize CRM y GoHighLevel sobre el puerto desacoplado `IntegrationProvider`.
- [ ] n8n conectado mediante webhooks bidireccionales.
- [ ] Schema `ai`: contexto por proyecto, memoria de conversación, presupuesto de tokens.
- [ ] Asistente de Claude en Telegram para consultas comerciales en lenguaje natural, respetando estrictamente los roles CASL/RLS del usuario.

**Terminado cuando:** un director y un closer consultan métricas en lenguaje natural por Telegram y cada uno recibe exclusivamente la información que su rol tiene autorizada.

---

## Ruta crítica

Fase 1 (Auth + Pantallas de Acceso) → Fase 2 (Shell + Proyectos) → Fase 3 (Pipeline) → Fase 4 (Ingesta Hotmart) es la columna vertebral. Sin interfaz no hay operación humana; sin backend robusto no hay integridad de datos.

## Riesgos a vigilar

| Riesgo | Señal temprana | Mitigación |
|---|---|---|
| RLS que no se aplica por `SET LOCAL` fuera de transacción | Una prueba de aislamiento que pasa "demasiado fácil" | Helper `withRls()` y suite de integración automática bajo rol real (Completado en Fase 1) |
| La fase 3 se come el cronograma | Semana 2 del pipeline sin operaciones masivas funcionando | Priorizar la tabla virtualizada; vista Kanban como iteración continua |
| Inconsistencia visual o componentes ad-hoc | Vistas con estilos dispares o sin los 4 estados | Catálogo obligatorio de componentes con shadcn/ui + Tailwind + Lucide desde el inicio de Fase 2 |
| Volumen de webhooks en lanzamiento | Cola de BullMQ creciendo sin bajar | `ingest` desacoplado de `api`; escalar réplicas de worker |
| RAM del VPS (12 GB límite) | `docker stats` por encima del 80% sostenido | Monitoreo riguroso de límites de memoria en `docker-compose` |
| Costo de la API de Claude | Gasto diario sin techo | Presupuesto de tokens por proyecto y caché de respuestas en Redis |

