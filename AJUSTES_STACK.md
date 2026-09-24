# Ajustes al stack — `gs_control_center`

Revisión del stack declarado en `PROJECT_CONTEXT.md` v1.0.0 contra la restricción real del proyecto:
**un VPS de 6 vCPU / 12 GB RAM** y un equipo pequeño que necesita entregar valor comercial pronto.

Las reglas de negocio, el modelo RBAC y las reglas de oro de persistencia me parecen sólidas y no las toco.
Lo que cambio es la forma de empaquetar y operar el sistema.

---

## 1. Cambios estructurales (los importantes)

### 1.1 Microservicios → monolito modular con fronteras estrictas

**Qué dice el documento:** siete microservicios NestJS independientes tras un gateway con Apollo Federation.

**Problema:** los siete servicios corren en el mismo host y golpean la misma instancia de PostgreSQL.
Eso paga el costo completo de los microservicios sin obtener ninguno de sus beneficios reales
(aislamiento de fallos, escalado independiente, despliegue independiente). El costo incluye: siete
procesos Node de 200–350 MB cada uno, siete pools de conexiones, composición de subgrafos, versionado de
schema federado, tracing distribuido para depurar un bug trivial, y siete pipelines de despliegue.

**Propuesta:** un monolito modular NestJS con un módulo por dominio y fronteras aplicadas por lint
(`eslint-plugin-boundaries`). Del mismo código salen tres despliegues:

| Proceso | Rol | Por qué separado |
|---|---|---|
| `api` | GraphQL + REST autenticado | Carga interactiva, latencia importa |
| `ingest` | Solo webhooks entrantes | Picos de concurrencia en lanzamientos; no puede caerse porque el dashboard esté saturado |
| `worker` | BullMQ: normalización, notificaciones, MVs, reconciliación | CPU intensivo, aislado del request path |

Esto conserva el aislamiento operativo donde de verdad importa y elimina seis despliegues.

**Cuándo extraer un servicio real:** cuando `ingest` necesite escalar horizontalmente por volumen de
webhooks, o cuando el módulo de IA justifique su propio ciclo de despliegue. Si se respetan las
fronteras, extraer un módulo es mover una carpeta y cambiar una llamada por HTTP.

### 1.2 Database-per-service → schema-per-module

**Qué dice el documento:** siete bases de datos con siete roles en el mismo motor.

**Problema:** el aislamiento que se busca es lógico, no físico — están en el mismo motor, el mismo disco
y el mismo proceso. Siete bases separadas no aportan resiliencia adicional, pero sí impiden
transacciones entre módulos cuando hiciera falta, multiplican los pools de conexión y complican
backups y migraciones.

**Propuesta:** una base de datos `gs_control_center` con siete schemas (`auth`, `projects`, `pipeline`,
`sales`, `integrations`, `automation`, `ai`) y un rol por schema con `GRANT` restringido a su propio
schema. Las reglas de oro se mantienen idénticas: cero FK entre schemas, referencias lógicas por UUID,
un módulo solo toca su schema, y el `GRANT` lo hace cumplir a nivel de motor.

Beneficios: un solo `pg_dump`, migraciones coordinadas, un pool, y la puerta abierta a separar la base
de un módulo si algún día se extrae de verdad.

### 1.3 Monorepo con contratos compartidos

**Qué falta:** el repo tiene `gs_control_center_front` y `gs_control_center_back` como proyectos
independientes. Eso garantiza que los tipos se dupliquen y se desincronicen.

**Propuesta:** pnpm workspaces + Turborepo.

```
gs_control_center/
├── apps/
│   ├── api/          # NestJS (api | ingest | worker según comando)
│   └── web/          # Next.js
├── packages/
│   ├── contracts/    # esquemas Zod: única fuente de verdad de tipos
│   ├── config/       # tsconfig, eslint, prettier compartidos
│   └── ui/           # componentes shadcn compartidos
└── db_postgres/
```

`packages/contracts` es la pieza clave: el mismo esquema Zod valida el `JSONB` en el backend y la
edición de celda en el frontend. Una sola definición, dos usos.

---

## 2. Correcciones técnicas puntuales

| Punto | Documento v1.0.0 | Ajuste | Motivo |
|---|---|---|---|
| Programación de tareas | `pg_cron` | **BullMQ repeatable jobs** | `pg_cron` exige `shared_preload_libraries` e imagen custom de Postgres, y solo corre en una base. Redis y BullMQ ya están. Una pieza menos. |
| Identificadores | `uuid-ossp` / UUIDv4 | `gen_random_uuid()` por defecto; **UUIDv7 en aplicación** para `events`, `row_history`, `transactions` | `uuid-ossp` es innecesario desde PG13. UUIDv4 aleatorio fragmenta el índice B-tree en tablas de millones de filas; v7 es ordenado en el tiempo. |
| Reverse proxy | "Nginx/Traefik" | **Traefik**, definitivo | Certificados automáticos y descubrimiento por labels de Docker. Elegir uno evita mantener dos configuraciones. |
| Cliente GraphQL | Apollo Client en todo el front | Codegen + fetch tipado en RSC; **Apollo solo en el módulo de pipeline** | Apollo Client tiene fricción con React Server Components y pesa en el bundle. La caché normalizada solo aporta en el kanban. |
| Tiempo real | No especificado | **SSE desde `api` sobre Redis Pub/Sub** | El documento promete "tiempo casi real" sin mecanismo. SSE es unidireccional, reconecta solo y no requiere configuración especial en Traefik. WebSockets solo si aparece edición colaborativa de celdas. |
| Paginación | No especificada | **Keyset/cursor obligatorio** | `OFFSET` degrada linealmente. Con 50.000 leads por proyecto se nota rápido. |
| RLS + Prisma | RLS asumido como automático | Helper `withRls()` obligatorio + **CASL como control primario** | `SET LOCAL` solo vive dentro de una transacción y Prisma agrupa conexiones. Sin el helper, la política RLS simplemente no se aplica y da una falsa sensación de seguridad. Este es el fallo silencioso más probable de todo el diseño. |
| Tablas de eventos | Tabla única particionada mencionada | Partición `RANGE` mensual explícita + job que crea la partición siguiente | Sin el job, la ingesta falla el día que no existe la partición. |

---

## 3. Lo que falta por completo en el documento

Estas ausencias son más riesgosas que cualquier elección de framework.

### 3.1 Respaldos
No hay una sola línea sobre backups en un sistema que guarda la facturación de clientes.

- `pg_dump` diario + WAL archiving, empujado con `restic` a Backblaze B2 o S3.
- Retención 30 días diarios, 12 meses mensuales.
- **Restauración probada mensualmente en un entorno limpio.** Un backup no verificado no es un backup.

### 3.2 Observabilidad
Con procesamiento asíncrono y webhooks de terceros, sin observabilidad se depura a ciegas.

- **Pino** con logs JSON y `requestId` / `userId` / `projectId` en cada línea.
- **Sentry** (o GlitchTip self-hosted) para excepciones.
- **OpenTelemetry** en el request path, aunque al inicio solo exporte a logs.
- Dashboard operativo mínimo: **Grafana + Loki + Promtail**. Si la RAM aprieta, empezar con
  **Dozzle + Uptime Kuma** (unos 100 MB en total) y crecer después.
- Métrica crítica de negocio: profundidad de la cola de BullMQ y edad del evento más antiguo sin
  procesar. Si eso crece, hay ventas sin registrar.

### 3.3 Pruebas
El documento define criterios de calidad pero ninguna estrategia para verificarlos.

- **Vitest** unitario sobre casos de uso.
- **Testcontainers** con Postgres real para lo que no se puede simular: políticas RLS, idempotencia de
  webhooks, cálculo de comisiones escalonadas, operaciones masivas.
- **Playwright** con un caso por rol, verificando que CLOSER no ve leads ajenos y CLIENTE no ve datos
  operativos. Este es el requisito comercial más sensible del producto; merece una prueba automática.

### 3.4 CI/CD
GitHub Actions: lint → typecheck → test → build de imágenes → push a GHCR → despliegue por SSH con
`docker compose pull && up -d`. Las migraciones se ejecutan como paso explícito y confirmado, nunca en
el arranque del contenedor.

### 3.5 Gestión de secretos
El cifrado AES-256-GCM de credenciales está bien, pero el documento no dice dónde vive la clave maestra.

- **SOPS + age** para cifrar los `.env` en el repositorio; la clave privada solo en el servidor.
- Alternativa si prefieren interfaz gráfica: **Infisical self-hosted** (cuesta ~300 MB de RAM).
- Rotación de la clave maestra documentada, con recifrado por lotes de `integrations`.

---

## 4. Presupuesto de memoria del VPS (12 GB)

| Componente | Asignación |
|---|---|
| PostgreSQL 16 | 4 GB (`shared_buffers` 2 GB, `effective_cache_size` 6 GB) |
| Redis 7 | 1 GB con `maxmemory-policy noeviction` |
| `api` | 1 GB |
| `ingest` | 512 MB |
| `worker` | 1 GB |
| Next.js | 1 GB |
| n8n | 1 GB |
| Traefik + observabilidad | 512 MB |
| Sistema operativo y margen | 2 GB |

Redis con `noeviction` es deliberado: si Redis desaloja un job de BullMQ bajo presión de memoria, se
pierde una venta. Prefiere fallar ruidosamente.

Con el diseño original de siete microservicios, solo el backend consumiría entre 1,5 y 2,5 GB adicionales
en overhead de procesos, sin procesar un webhook más.

---

## 5. Stack final

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js App Router + TypeScript, RSC por defecto |
| UI | Tailwind + shadcn/ui + Lucide + TanStack Table |
| Cliente de datos | GraphQL codegen en RSC; Apollo Client solo en pipeline |
| Backend | NestJS + TypeScript estricto, monolito modular, 3 procesos |
| API | GraphQL (schema modular, sin Federation) + REST para webhooks + SSE |
| Autorización | CASL (primaria) + RLS de PostgreSQL (defensa en profundidad) |
| ORM | Prisma con multi-schema |
| Base de datos | PostgreSQL 16, una DB, schema por módulo, JSONB + GIN, particiones mensuales |
| Colas y caché | Redis 7 + BullMQ (incluye jobs programados) |
| Validación | Zod compartido en `packages/contracts` |
| Automatización | n8n self-hosted |
| IA | Claude API con presupuesto de tokens por proyecto y caché de respuestas |
| Observabilidad | Pino + OpenTelemetry + Sentry + Grafana/Loki |
| Pruebas | Vitest + Testcontainers + Playwright |
| Infraestructura | Docker Compose + Traefik + GitHub Actions + GHCR |
| Respaldos | pg_dump + WAL → restic → B2/S3, restore verificado |
| Secretos | SOPS + age |

Las versiones exactas conviene fijarlas el día que se inicialice el repositorio, verificando la última
estable de cada paquete en ese momento, y dejarlas congeladas con `pnpm` lockfile.
