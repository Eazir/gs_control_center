# PROJECT CONTEXT — GrowthShell Centro de Mando (`gs_control_center`)

> **Documento de Contexto Maestro del Proyecto**  
> **Versión:** 1.0.0  
> **Última Actualización:** Septiembre 2026  
> **Audiencia:** Equipo de Ingeniería, Arquitectos de Software, Desarrolladores Full-Stack y Agentes de IA.

---

## 1. Visión y Objetivos del Proyecto

### 1.1 Contexto del Negocio
**GrowthShell** se dedica a estructurar, capacitar y operar **unidades comerciales (equipos de ventas de alto rendimiento / closers)** para creadores de infoproductos y empresas digitales que comercializan cursos, mentorías, membresías, productos digitales y servicios high-ticket.

### 1.2 El Problema
Históricamente, la operación comercial se gestionaba mediante hojas de cálculo en **Google Sheets** combinadas con **Google AppScripts**, generando:
- **Falta de integridad:** Fórmulas rotas por manipulación de closers, pérdida de trazabilidad, datos inconsistentes.
- **Sin auditoría ni permisos granulares:** No existía control de acceso por columnas ni historial estricto de modificaciones.
- **Procesamiento manual:** Ventas registradas a mano o con scripts frágiles propensos a duplicados y caídas.
- **Aislamiento deficiente:** Dificultad para entregar reportes en tiempo real y dashboards limpios a los clientes (dueños de los productos).

### 1.3 La Solución: Centro de Mando GrowthShell
Una plataforma web empresarial y centralizada que actúa como el **Centro de Mando** para todas las unidades comerciales:
1. **Centralización Multi-Proyecto:** Gestión unificada de múltiples lanzamientos y proyectos comerciales independientes con aislamiento de datos.
2. **Ingesta Automática e Idempotente:** Conexión directa vía API y Webhooks con plataformas de venta (**Hotmart**) y CRMs (**Centralize CRM**, **GoHighLevel**).
3. **Pipelines de Ventas Dinámicos:** Tablas y tableros kanban personalizables con la flexibilidad de una hoja de cálculo pero con validación estricta, tipos de datos, permisos por columna y auditoría completa.
4. **Módulo de Recuperación de Ventas:** Detección en tiempo real de carritos abandonados o pagos fallidos mapeados como "Recuperables", asignación automática a closers y alertas a Telegram.
5. **Métricas y Dashboards en Tiempo Casi Real:** Visualización de KPIs (facturación bruta/neta, ticket promedio, comisiones, ranking de closers) para directores y dashboards de solo lectura para clientes.
6. **Automatizaciones y Ecosistema IA:** Orquestación con **n8n (self-hosted)**, bots de alertas y consultas operativas con **Claude API** integrados a Telegram.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Justificación y Rol |
|---|---|---|
| **Frontend** | **Next.js 15+ (App Router)** + **TypeScript** | Server-Side Rendering (SSR), Server Components y Client Components para vistas analíticas reactivas de alta velocidad. |
| **Styling & UI** | **Tailwind CSS** + **shadcn/ui** + Lucide Icons | Sistema de diseño moderno, accesible, responsivo (desktop-first + móvil) y consistente. |
| **Cliente API / Estado** | **Apollo Client / GraphQL** | Consumo estructurado de datos, normalización de caché y prevención de sobrecarga de red. |
| **Backend** | **NestJS 11+** + **TypeScript** | Arquitectura modular basada en microservicios, inyección de dependencias, tipado estricto y mantenibilidad empresarial. |
| **Capa de API** | **GraphQL (Apollo Federation / Subgraphs)** + **REST** | GraphQL para operaciones de clientes/dashboards/pipelines; REST para ingesta de webhooks externos de alta concurrencia. |
| **ORM / Acceso a Datos** | **Prisma ORM** | Modelado tipado por servicio, migraciones reproducibles y soporte nativo para PostgreSQL. |
| **Base de Datos Principal** | **PostgreSQL 16** (`pg_cron`, `uuid-ossp`) | Motor relacional robusto con uso intensivo de **`JSONB` e índices GIN** para datos semiestructurados (sustituyendo a MongoDB) y vistas materializadas. |
| **Caché & Colas** | **Redis 7** + **BullMQ** | Sesiones, denylist de tokens JWT, caché distribuida de KPIs y procesamiento asíncrono resiliente de webhooks y notificaciones. |
| **Automatización** | **n8n (Self-Hosted)** | Motor de flujos de trabajo en Docker conectado mediante webhooks bidireccionales y API con la plataforma. |
| **Inteligencia Artificial** | **Claude API (Anthropic)** | Asistente de inteligencia comercial conectado a Telegram con contexto dinámico por proyecto y guardrails de seguridad. |
| **Infraestructura & Contenedores**| **Docker** + **Docker Compose** + **Nginx/Traefik** | Contenedorización total de servicios, orquestación local y producción, reverse proxy y SSL automático (Let's Encrypt). |

---

## 3. Infraestructura, VPS y Despliegue Docker

### 3.1 Especificaciones del Servidor de Producción (VPS)
- **Proveedor / Ubicación:** VPS Contabo / United States (Central)
100 ms latency.
- **Cómputo:** **6 vCPU**.
- **Memoria RAM:** **12 GB RAM**.
- **Almacenamiento:** **200 GB SSD**.
- **300 Mbit/s Port**.

---

## 4. Arquitectura de Microservicios y Base de Datos

### 4.1 Patrón: *Database per Service*
GrowthShell adopta una arquitectura de microservicios con aislamiento total de datos: **cada microservicio es dueño absoluto de su propia base de datos y su propio usuario/rol en PostgreSQL**.

```
                           Internet / Clientes
                                   │
                                   ▼
                           [ Nginx Reverse Proxy ]
                           (SSL / Let's Encrypt)
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
     [ gs_control_center_front ]            [ API Gateway (NestJS) ]
        (Next.js App Router)                  (GraphQL Federation / REST)
                                                       │
        ┌──────────────┬──────────────┬────────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼                ▼              ▼              ▼
   auth-service projects-service pipeline-service sales-service integrations-svc automation-svc
        │              │              │                │              │              │
        ▼              ▼              ▼                ▼              ▼              ▼
    (auth_db)   (projects_db)  (pipeline_db)      (sales_db)  (integrations_db)(automation_db)
        └──────────────┴──────────────┴────────────────┴──────────────┴──────────────┘
                                  PostgreSQL 16 Engine
                                  + Redis 7 (BullMQ)
```

### 4.2 Matriz de Bases de Datos y Roles

| Base de Datos | Microservicio | Rol Dueño | Propósito Principal |
|---|---|---|---|
| `auth_db` | `auth-service` | `svc_auth` | Usuarios, credenciales (Argon2id), sesiones activas, tokens revocados, MFA y log de auditoría. |
| `projects_db` | `projects-service` | `svc_projects` | Proyectos, asignación de usuarios, catálogo de productos válidos, metas comerciales y reglas de comisiones. |
| `pipeline_db` | `pipeline-service` | `svc_pipeline` | Definición de pipelines, filas dinámicas (`JSONB`), historial de celdas por auditoría y operaciones masivas. |
| `sales_db` | `sales-service` | `svc_sales` | Clientes normalizados, ventas/cuotas, transacciones, comisiones calculadas y vistas materializadas de KPIs. |
| `integrations_db` | `integrations-service` | `svc_integrations` | Registro de adaptadores, credenciales cifradas (AES-256), log particionado de eventos entrantes e idempotencia. |
| `automation_db` | `automation-service` | `svc_automation` | Reglas de automatización, vinculación de workflows en n8n, logs de notificaciones y bindings con Telegram. |
| `ai_db` | `ai-service` | `svc_ai` | Contextos de proyectos para LLM, memoria de conversaciones de Claude, guardrails y retroalimentación humana. |

### 4.3 Reglas de Oro de Persistencia e Integración
1. **Aislamiento Absoluto:** Ningún microservicio puede conectarse a la base de datos de otro.
2. **Cero Foreign Keys Físicas Cross-DB:** Las relaciones entre servicios se gestionan mediante referencias lógicas basadas en `UUID v4`. La resolución de entidades enriquecidas se realiza vía GraphQL Federation o suscripción a eventos de Redis.
3. **Identificadores y Tiempo:**
   - Llaves primarias: `UUID v4` generados con `uuid_generate_v4()`.
   - Marcas temporales: `timestamptz` (Timestamp con zona horaria, siempre almacenado en **UTC**). El frontend realiza la conversión local.
4. **Soft Delete Generalizado:** Ningún registro de negocio con historial se elimina físicamente (`DELETE`). Se utiliza la convención `deleted_at IS NULL` para identificar registros activos.
5. **Validación de Datos Semiestructurados:** Cualquier dato almacenado en campos `JSONB` debe ser estrictamente validado en el backend con esquemas **Zod** antes de su persistencia.
6. **Seguridad a Nivel de Fila (RLS):** En `pipeline_db` y `sales_db` se aplica PostgreSQL Row Level Security (RLS). El backend establece en cada conexión:
   ```sql
   SET LOCAL app.current_user_id = '<uuid>';
   SET LOCAL app.current_user_role = '<rol>';
   ```
7. **Refresco de Vistas Materializadas:** Las vistas (`mv_daily_kpis`, `mv_closer_daily_kpis`, `mv_funnel`, etc.) se actualizan de forma concurrente periódicamente mediante `pg_cron` o BullMQ, nunca bloqueando las transacciones de lectura/escritura.

---

## 5. Modelo de Roles y Control de Acceso (RBAC)

La plataforma cuenta con 5 roles jerárquicos y acumulativos hacia abajo:

```
[ SUPER_ADMIN ]
       │
       ▼
   [ ADMIN ]
       │
       ▼
  [ DIRECTOR ]
       │
       ▼
   [ CLOSER ]
       │
       ▼
  [ CLIENTE ]
```

### 5.1 Definición de Privilegios
- **`SUPER_ADMIN` (Usuario único raíz):**
  - Acceso total y sin restricciones.
  - Creación y administración de cualquier usuario, proyecto, pipeline, integración y configuración del sistema.
  - Gestión global de llaves API, costos de IA y auditoría integral.
- **`ADMIN`:**
  - Administración de Directores, Closers y Clientes.
  - Creación y parametrización de proyectos, asignación de equipos, configuración de integraciones, pipelines y metas.
  - Acceso irrestricto a métricas de todos los proyectos.
- **`DIRECTOR` (Director de Ventas del Proyecto):**
  - Gestión de Closers asignados a sus proyectos.
  - Personalización de pipelines, asignación/reasignación de leads y fijación de metas comerciales.
  - Acceso completo a dashboards, leads y métricas de sus proyectos asignados.
- **`CLOSER` (Comercial / Vendedor):**
  - Gestión operativa de leads: mover de stage en pipeline, registrar seguimientos, actualizar campos permitidos.
  - Acceso visual restringido: **únicamente puede consultar y manipular leads que le han sido asignados explícitamente** (aislamiento estricto a nivel de base de datos/query).
  - Visualización de su propio dashboard de desempeño y comisiones.
- **`CLIENTE` (Dueño del Infoproducto / Contratante de la Unidad Comercial):**
  - Rol de solo lectura para el proyecto asignado.
  - Acceso exclusivo al dashboard ejecutivo de métricas de ventas y avance de metas.
  - **Bloqueado:** No tiene acceso a datos de contacto de leads, detalles operativos de closers ni gestión de pipelines.
  - Soporte de acceso mediante token público seguro revocable (dashboard compartido sin necesidad de registro).

---

## 6. Módulos y Reglas de Negocio Clave

### 6.1 Gestión de Proyectos y Catálogo de Productos
- Cada proyecto representa una unidad comercial o lanzamiento.
- **Aislamiento por Proyecto:** Todas las entidades (ventas, leads, métricas, integraciones) pertenecen obligatoriamente a un `project_id`.
- **Catálogo de Productos Válidos:** Solo los productos configurados (Nombre, External ID, Código de Oferta) son tomados en cuenta para el cálculo de facturación, cumplimiento de metas y comisiones del proyecto.

### 6.2 Pipelines Dinámicos (Config-Driven & JSONB)
- **Estructura Híbrida:** 
  - Las columnas críticas y de búsqueda frecuente (`lead_name`, `lead_email`, `lead_phone`, `closer_id`, `current_stage`, `potential_value`) son **columnas fijas promovidas e indexadas**.
  - Los campos adicionales y dinámicos específicos de cada proyecto se almacenan en un payload **`data` tipo `JSONB`**.
- **Definición de Columnas en Código:** Las columnas admiten tipos específicos (`text`, `select`, `date`, `number`, `currency`, `user`) con reglas de visibilidad y edición por rol (`visible_roles`, `editable_roles`).
- **Control de Concurrencia y Auditoría:**
  - Control de bloqueo optimista mediante `row_version`.
  - Cada cambio en una celda registra una entrada en la tabla particionada `row_history` (usuario, fecha, valor previo, valor nuevo, origen y destino de stage).
- **Operaciones Masivas:** Capacidad transaccional para seleccionar múltiples leads (50+) y ejecutar cambios de estado o asignación en bloque sin timeouts.

### 6.3 Módulo de Recuperación de Ventas
- **Mapeo de Estados de Compra:** Configuración flexible por proyecto para catalogar estados de plataformas externas:
  - **Recuperables:** Carrito abandonado, pago en efectivo pendiente (efecty, oxxo, boleto), fondos insuficientes, tarjeta rechazada por límite.
  - **No Recuperables:** Contracargo (*chargeback*), fraude comprobado, reembolso ejecutado.
- **Flujo Automático de Recuperación:**
  1. Ingreso de evento de pago fallido o carrito abandonado vía Webhook.
  2. El sistema lo clasifica como "Recuperable".
  3. Se inserta o mueve automáticamente el registro a la columna "Recuperable" del pipeline.
  4. Se asigna al closer responsable (o en cola de recuperación).
  5. Se emite una **notificación inmediata vía Telegram** con el nombre del cliente, teléfono, producto, monto, razón del rechazo y botón de contacto.

### 6.4 Integración Hotmart (API Directa y Resiliente)
Diseñada bajo el principio de **"Cero Errores y Cero Pérdidas de Ventas"**:
1. **Recepción Inmediata (Producer):** Los webhooks entrantes son recibidos en un endpoint HTTP ultrarrápido, se valida la firma de seguridad, se almacena el payload en bruto en `integrations_db.events` con estado `RECEIVED` y se responde inmediatamente `HTTP 200 OK` a Hotmart en <100 ms.
2. **Procesamiento Asíncrono (Consumer / BullMQ):** Un worker en segundo plano toma el evento, extrae la información, normaliza el contrato de datos e interactúa con `sales-service`.
3. **Garantías de Consistencia:**
   - **Idempotencia:** Restricción `UNIQUE(source, external_order_id, external_txn_id)`. Si un webhook llega duplicado, se descarta sin duplicar ventas.
   - **Reintentos con Backoff Exponencial:** En caso de fallos transitorios en servicios dependientes.
   - **Reconciliación Diaria Programada:** Tarea cron diaria que consulta la API REST de Hotmart, compara contra la base de datos local y resuelve cualquier discrepancia.

### 6.5 Catálogo Extensible de Integraciones
- Arquitectura desacoplada basada en el patrón **Puertos y Adaptadores (Hexagonal)**:
  - Interfaz común: `IntegrationProvider` (`authenticate()`, `fetchLeads()`, `fetchSales()`, `handleWebhook()`, `healthCheck()`).
  - Adaptadores iniciales: **Hotmart**, **Centralize CRM**, **GoHighLevel**.
  - Extensibilidad: Nuevos proveedores se agregan creando un nuevo adaptador en código TypeScript, sin alterar la lógica de negocio central ni el frontend.

### 6.6 Motor de Dashboards y Métricas
Cálculo de métricas optimizado mediante vistas materializadas y consultas agregadas en base de datos:
- **KPIs Principales:** Facturación Bruta, Facturación Neta (descontando comisiones de pasarelas y afiliaciones), Total de Ventas, Ventas de Lanzamiento (productos vinculados), Ticket Promedio, Cobros del Mes en curso.
- **Gráficos de Tendencia:** Ventas diarias (`DATE(payment_date)`), semanales (`DATE_TRUNC('week', ...)`), mensuales.
- **Rankings y Desgloses:** Ranking de closers (ventas, ingresos y tasa de conversión), ventas por producto, ingresos por cuenta (propia vs. externa), y comparativa bruta vs. neta.

### 6.7 Metas y Esquemas de Comisiones
- Configuración de metas por proyecto, período (diario, semanal, mensual) y closer.
- Reglas dinámicas: vinculación exclusiva a productos específicos.
- Cálculo de comisiones escalonadas según cumplimiento porcentual de metas.

### 6.8 Asistente IA (Claude) y Telegram Bot
- **Telegram Bot Operativo:** Canal bidireccional para recepción de alertas (ventas aprobadas, recuperaciones urgentes) y consultas interactivas.
- **Integración con Claude API:**
  - El usuario debe vincular su cuenta de Telegram con su usuario de la plataforma (`telegram_links`).
  - Claude responde con el **contexto exacto del proyecto y respetando estrictamente los permisos del rol del usuario**.
  - Controles de costo (límites de tokens) y guardrails estrictos para no exponer datos cross-project.

---

## 7. Estándares de Desarrollo y Buenas Prácticas

### 7.1 Backend (NestJS & Node.js)
- **TypeScript Estricto:** Configuración con `strict: true`, sin uso permitido de `any`.
- **Arquitectura Limpia:** Separación clara entre Controladores/Resolvers, Servicios de Aplicación, Entidades de Dominio y Adaptadores de Infraestructura.
- **Validación en Fronteras:** Todos los inputs de GraphQL y REST deben validarse exhaustivamente mediante DTOs decorados con `class-validator` o esquemas `Zod`.
- **Prevención de Problemas N+1:** Uso indispensable de **`DataLoader`** en todos los resolvers de GraphQL para relaciones entre entidades.
- **Transaccionalidad:** Todas las operaciones de escritura que afecten a dos o más tablas en el mismo servicio deben envolverse en `prisma.$transaction`.
- **Manejo de Errores Estructurado:** Filtros globales de excepción que mapean errores a códigos de error estándar (ej. `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_SERVER_ERROR`) sin filtrar trazas internas sensibles en producción.

### 7.2 Frontend (Next.js & React)
- **Server Components Primero:** Por defecto, los componentes deben ser React Server Components (RSC) para reducir el bundle JS de cliente y mejorar el tiempo de carga (LCP p95 < 2 s).
- **Client Components Puntuales:** Utilizar `'use client'` únicamente cuando se requiera interactividad, hooks de estado (`useState`, `useReducer`), animaciones o acceso a APIs del navegador.
- **UI Consistente con shadcn/ui:** Prohibido inventar componentes básicos ad-hoc; se deben utilizar y componer los componentes oficiales de shadcn/ui con Tailwind CSS.
- **Estados de Interfaz Obligatorios:** Toda vista y componente debe contemplar explícitamente los cuatro estados fundamentales:
  1. *Loading* (utilizando Skeletons con dimensiones realistas, sin spinners invasivos).
  2. *Empty State* (mensajes claros con llamadas a la acción).
  3. *Error State* (mensajes accionables con posibilidad de reintentar).
  4. *Success / Data State*.
- **Diseño Responsive:** Estrategia *desktop-first* optimizada para pantallas operativas de 1080p+, garantizando simultáneamente navegación fluida y adaptable para clientes en tablets y teléfonos móviles.

### 7.3 Seguridad Integral
- **Protección de Credenciales:** Las llaves de API, webhooks secrets y tokens de plataformas externas deben almacenarse **cifradas en reposo con AES-256-GCM** en `integrations_db`.
- **Autenticación Robusta:** JWT access tokens de corta vida (máximo 15 minutos) combinados con refresh tokens rotativos almacenados en cookies seguras (`HttpOnly`, `SameSite=Strict`, `Secure`).
- **Mitigación de Abusos:** Rate limiting por IP y usuario mediante Redis en endpoints de login, endpoints públicos y webhooks.
- **Seguridad en Webhooks:** Validación estricta de encabezados de firma criptográfica en todos los webhooks entrantes (Hotmart token/signature verification).

---

## 8. Guía de Ejecución y Despliegue con Docker

### 8.1 Estructura del Repositorio
```
gs_control_center/
├── .agents/                      # Skills y configuraciones para agentes
├── Docs/                         # Documentación de requerimientos y propuestas
│   └── Requerimientos/
├── db_postgres/                  # Scripts SQL de inicialización y Diccionario
│   ├── 00_create_roles_and_databases.sql
│   ├── 01_extensions.sql
│   ├── ...
│   ├── DICCIONARIO.md            # Referencia canónica de campos y tablas
│   └── README.md
├── gs_control_center_back/       # Backend NestJS (Microservicios / Gateway)
├── gs_control_center_front/      # Frontend Next.js (App Router + shadcn)
├── docker-compose.yml            # Orquestación de contenedores
├── docker-compose.prod.yml       # Overrides para el entorno de producción VPS
└── PROJECT_CONTEXT.md            # Este documento maestro
```

### 8.2 Levantar la Base de Datos Inicial
Para inicializar el clúster de PostgreSQL con soporte de `pg_cron` y los roles correspondientes:
```bash
# 1. Levantar el contenedor de PostgreSQL y Redis
docker compose up -d postgres redis

# 2. Inicializar roles y bases de datos por servicio
psql -h localhost -U postgres -d postgres -f db_postgres/00_create_roles_and_databases.sql

# 3. Aplicar extensiones en cada base de datos
for db in auth_db projects_db pipeline_db sales_db integrations_db automation_db ai_db; do
  psql -h localhost -U postgres -d $db -f db_postgres/01_extensions.sql
done

# 4. Crear esquemas y tablas
psql -h localhost -U postgres -d auth_db -f db_postgres/02_auth_db.sql
psql -h localhost -U postgres -d projects_db -f db_postgres/03_projects_db.sql
psql -h localhost -U postgres -d pipeline_db -f db_postgres/04_pipeline_db.sql
psql -h localhost -U postgres -d sales_db -f db_postgres/05_sales_db.sql
psql -h localhost -U postgres -d integrations_db -f db_postgres/06_integrations_db.sql
psql -h localhost -U postgres -d automation_db -f db_postgres/07_automation_db.sql
psql -h localhost -U postgres -d ai_db -f db_postgres/08_ai_db.sql

# 5. Crear Vistas Materializadas
psql -h localhost -U postgres -d sales_db -f db_postgres/09_materialized_views.sql
psql -h localhost -U postgres -d pipeline_db -f db_postgres/09_materialized_views.sql
```

### 8.3 Comandos de Operación Diaria
```bash
# Levantar el entorno completo en desarrollo
docker compose up -d

# Inspeccionar logs de un servicio específico
docker compose logs -f --tail=100 backend

# Verificar consumo de memoria y CPU en el VPS
docker stats --no-stream
```

---

## 9. Criterios de Calidad y Verificación

Antes de considerar cualquier funcionalidad o PR como terminado, se debe validar:
1. **Compilación y Tipado:** `npm run build` sin errores de compilación de TypeScript en front y back.
2. **Linters y Formato:** Sin advertencias críticas en ESLint / Prettier.
3. **Idempotencia:** Los webhooks procesados no deben duplicar ventas ni leads bajo ninguna circunstancia.
4. **Permisos y RBAC:** Verificar que un `CLOSER` solo acceda a sus leads asignados y que un `CLIENTE` no pueda ver datos operativos ni modificar el proyecto.
5. **Aislamiento de DB:** Comprobar que ningún servicio intente consultar tablas de otra base de datos de forma directa.
