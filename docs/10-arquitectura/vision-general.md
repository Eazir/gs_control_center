# Arquitectura General — GrowthShell Centro de Mando (`gs_control_center`)

> Estado: Fase 1 (Fundación e Identidad) Completada · VPS: Contabo 6 vCPU / 12 GB RAM · PostgreSQL 16 + Redis 7

---

## 1. Visión y Enfoque

GrowthShell Centro de Mando es una plataforma web modular diseñada para operar unidades comerciales (equipos de closers) de infoproductos de alto valor.

Toda decisión arquitectónica se rige por un principio de eficiencia de recursos: operar de manera robusta, escalable y con alta disponibilidad sobre un presupuesto de hardware definido (VPS Contabo de 6 vCPU y 12 GB RAM), garantizando aislamiento de dominios, auditoría inmutable y seguridad por diseño.

---

## 2. Pila Tecnológica

- **Monorepo:** Administrado con **pnpm workspaces** y **Turborepo** para orquestación de compilación, caché y ejecución.
- **Backend (`apps/api`):** **NestJS 11** como **monolito modular**.
  - Arquitectura limpia y hexagonal: Separación por Puertos y Adaptadores (Dominio, Casos de Uso de Aplicación, Infraestructura Prisma/Redis, Controladores/Resolvers).
  - Tres modalidades de despliegue sobre la misma base de código: `api` (GraphQL + REST), `ingest` (webhooks) y `worker` (BullMQ).
- **Frontend (`apps/web`):** **Next.js 15 (App Router)** con React Server Components (RSC) por defecto.
  - Diseño: Tailwind CSS, shadcn/ui, iconos de Lucide, paleta oscura premium con acentos dorados (`#F59E0B`).
- **Contratos compartidos (`packages/contracts`):** Esquemas **Zod** compartidos entre frontend y backend como única fuente de verdad de tipos y validación.
- **Base de Datos:** PostgreSQL 16 con aislamiento multi-schema y Prisma ORM.
- **Caché y Colas:** Redis 7 para rate limiting, sesiones y BullMQ.

---

## 3. Regla de Fronteras y Aislamiento de Schemas

Aunque la aplicación se ejecuta actualmente como un monolito modular para optimizar recursos de memoria, los módulos están estrictamente aislados como si fueran microservicios independientes:

```
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL (gs_control_center)              │
│                                                             │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐  │
│  │  auth   │   │ projects │   │ pipeline │   │   sales   │  │
│  └─────────┘   └──────────┘   └──────────┘   └───────────┘  │
│  ┌──────────────┐    ┌────────────┐    ┌─────────────┐      │
│  │ integrations │    │ automation │    │     ai      │      │
│  └──────────────┘    └────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

1. **Cero Foreign Keys físicas entre schemas:** Las relaciones entre distintos dominios se modelan únicamente como referencias lógicas por `UUID`.
2. **Consultas limitadas a schema propio:** Un módulo nunca consulta tablas de otro schema.
3. **Comunicación por Interfaz Pública o Eventos:** Si un módulo requiere información de otro, se comunica mediante el servicio exportado del módulo o a través de eventos en Redis Streams.

---

## 4. Jerarquía de Roles y Seguridad

El sistema implementa control de acceso basado en roles (RBAC) con una jerarquía estricta:

$$\text{SUPER\_ADMIN} > \text{ADMIN} > \text{DIRECTOR} > \text{CLOSER} > \text{CLIENTE}$$

- **`SUPER_ADMIN`:** Acceso total e irrestricto a todos los módulos, gestión global de usuarios, auditoría y configuraciones maestras.
- **`ADMIN`:** Gestión de proyectos, métricas consolidadas y administración de usuarios por debajo de su jerarquía (`DIRECTOR`, `CLOSER`, `CLIENTE`).
- **`DIRECTOR`:** Supervisión operativa de sus proyectos asignados y closers de su equipo.
- **`CLOSER`:** Vista operativa del pipeline; solo tiene visibilidad y acceso a los leads y negociaciones que le han sido asignados directamente.
- **`CLIENTE`:** Acceso en modo solo lectura al dashboard consolidado de su respectivo proyecto; **jamás** tiene visibilidad sobre datos de contacto de leads ni métricas internas de closers.

---

## 5. Módulos y Hoja de Ruta

| Fase | Módulo / Área | Estado | Descripción |
|---|---|:---:|---|
| **Fase 1** | **`auth` & Control Center** | ✅ **Completado** | Identidad, login, RBAC, gestión de usuarios, emisión y revocación de invitaciones, soporte multi-teléfono, dashboard de 6 tarjetas para Super Admin. |
| **Fase 2** | **`projects`** | En cola | Creación y administración de proyectos de infoproductos, asignación de equipos y configuración de metas. |
| **Fase 3** | **`pipeline`** | En cola | Tablero dinámico tipo hoja de cálculo y Kanban interactivo para gestión de leads y llamadas. |
| **Fase 4** | **`integrations`** | En cola | Ingesta de webhooks de pasarelas (Hotmart, Centralize CRM, GoHighLevel) con idempotencia y colas BullMQ. |
| **Fase 5** | **`sales` & KPIs** | En cola | Registro de transacciones, cálculo de comisiones escalonadas, recuperación de ventas y reportes en tiempo real. |
| **Fase 6** | **`ai` & Telegram** | En cola | Asistente de inteligencia artificial (Claude/OpenAI) conectado a Telegram para reportes y consultas ejecutivas. |
| **Fase 7** | **Auditoría & RLS** | En cola | Seguridad a nivel de fila (Row Level Security) en PostgreSQL y bitácora inmutable de auditoría forense. |
