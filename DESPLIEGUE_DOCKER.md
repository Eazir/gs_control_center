# Despliegue con Docker — `gs_control_center`

Todo corre en contenedores, en los tres entornos. La diferencia entre desarrollo y producción son los
archivos de override, no procedimientos distintos.

---

## 1. Los tres archivos de compose

| Archivo | Cuándo se carga | Qué aporta |
|---|---|---|
| `docker-compose.yml` | Siempre | Servicios, healthchecks, volúmenes, dependencias |
| `docker-compose.override.yml` | Desarrollo, automáticamente | Puertos al host, montaje del código, hot reload, Postgres con menos memoria y `log_statement=all` |
| `docker-compose.prod.yml` | Solo con `-f` explícito | Traefik con TLS, imágenes de GHCR, límites de memoria, rate limit en webhooks, backups |

```bash
make up            # docker compose up -d           (carga el override solo)
make prod-deploy   # -f docker-compose.yml -f docker-compose.prod.yml
```

Que el override de desarrollo se cargue solo y el de producción no, es a propósito: es imposible
levantar producción por accidente escribiendo `docker compose up`.

## 2. Servicios

| Servicio | Imagen | Rol | Memoria en prod |
|---|---|---|---|
| `postgres` | postgres:16-alpine | Motor único, siete schemas | 4 GB |
| `redis` | redis:7-alpine | BullMQ, caché, sesiones, event bus | 1,2 GB |
| `api` | propia | GraphQL + REST autenticado + SSE | 1 GB |
| `ingest` | misma que `api` | Solo webhooks entrantes | 512 MB |
| `worker` | misma que `api` | BullMQ: normalización, notificaciones, MVs, reconciliación | 1 GB |
| `web` | propia | Next.js standalone | 1 GB |
| `traefik` | traefik:v3 | Reverse proxy, TLS automático | 256 MB |
| `n8n` | n8nio/n8n | Automatizaciones (perfil `automation`) | 1 GB |
| `docs` | nginx:alpine | Sitio de documentación (perfil `docs`) | 128 MB |
| `backup` | postgres:16-alpine | pg_dump + WAL → restic | 256 MB |
| `migrate` | misma que `api` | Job de un solo uso (perfil `tools`) | — |

Total asignado: unos 10,1 GB, dejando ~1,9 GB para el sistema operativo y picos. `api`, `ingest` y
`worker` comparten la **misma imagen** y difieren solo en el argumento `--role`: se construye una vez,
se despliega tres veces.

## 3. Por qué `ingest` va separado

Es la única separación de proceso que se justifica por sí sola. Durante un lanzamiento, Hotmart puede
disparar cientos de webhooks por minuto mientras el equipo tiene el dashboard abierto. Con un solo
proceso, una consulta pesada del dashboard aumenta la latencia del endpoint de webhooks y Hotmart
empieza a reintentar. Separados, cada uno falla y escala por su cuenta, y `ingest` puede pasar a dos
réplicas cambiando una línea.

## 4. Decisiones que evitan incidentes conocidos

- **`tini` como PID 1.** Sin él, Node no recibe `SIGTERM` y cada despliegue corta jobs de BullMQ a la
  mitad. Con él, el worker termina el job en curso antes de morir.
- **Redis con `noeviction`.** Bajo presión de memoria, desalojar un job de BullMQ equivale a perder una
  venta. Preferimos que falle ruidosamente.
- **Healthchecks en todo, con `depends_on: service_healthy`.** Sin eso, `api` arranca antes que
  Postgres y falla de forma intermitente solo a veces, que es la peor clase de fallo.
- **Migraciones fuera del arranque.** Están en el perfil `tools` y se ejecutan con `make prod-migrate`,
  que pide confirmación. Un contenedor que migra al arrancar convierte un reinicio automático en una
  migración no supervisada.
- **Rotación de logs en todos los servicios.** Logs sin rotar llenan los 200 GB del disco. Ya pasó en
  otros proyectos; no cuesta nada prevenirlo.
- **Límite de memoria en todos.** En 12 GB compartidos, un contenedor con fuga tumba a Postgres antes
  que a sí mismo.
- **Nada expuesto al host en producción salvo Traefik.** Postgres y Redis viven solo en la red interna.

## 5. Dominios

| Host | Servicio | Notas |
|---|---|---|
| `app.<dominio>` | `web` | Aplicación |
| `api.<dominio>` | `api` | GraphQL y REST autenticado |
| `hooks.<dominio>` | `ingest` | Webhooks. Host aparte para poder limitar y escalar por separado |
| `docs.<dominio>` | `docs` | Documentación, con autenticación básica |
| `flows.<dominio>` | `n8n` | Automatizaciones |

Certificados por Let's Encrypt vía `tlsChallenge`, renovación automática, redirección de HTTP a HTTPS.

## 6. Primer despliegue en el VPS

```bash
# 1. Preparar el servidor
ssh usuario@vps
git clone <repo> /opt/gs_control_center && cd /opt/gs_control_center

# 2. Secretos: descifrar el .env con la clave age del servidor
sops -d .env.enc > .env && chmod 600 .env

# 3. Infraestructura primero
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis traefik

# 4. Migraciones, como paso explícito
make prod-migrate

# 5. Aplicación
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Verificar
make ps
curl -sf https://api.<dominio>/health && echo OK
```

## 7. Despliegues siguientes

GitHub Actions construye y publica las imágenes en GHCR en cada merge a `main`. En el servidor:

```bash
make prod-deploy                      # pull + up -d
make prod-rollback TAG=<sha anterior> # si algo salió mal
```

Las imágenes se etiquetan con el SHA del commit, no solo con `latest`. Sin eso, el rollback no existe.

## 8. Respaldos

El contenedor `backup` ejecuta `pg_dump` diario más archivado de WAL, y empuja a Backblaze B2 o S3 con
restic. Retención: 30 días diarios, 12 meses mensuales.

```bash
make prod-backup                  # respaldo inmediato
make prod-restore F=<archivo>     # restauración en entorno limpio
```

**Ejecuta `make prod-restore` una vez al mes en un entorno de prueba.** Un respaldo que nunca se
restauró no es un respaldo; es una suposición. Este es el punto del documento que con más frecuencia se
posterga y el único cuyo fallo no tiene recuperación posible.

## 9. Agregar un servicio al stack

1. Defínelo en `docker-compose.yml` con healthcheck, `restart: unless-stopped` y rotación de logs.
2. Si es opcional, ponlo detrás de un `profiles:` en vez de comentarlo o sacarlo del archivo.
3. En `docker-compose.prod.yml`: imagen de GHCR, labels de Traefik si es público, límite de memoria.
4. **Recalcula el presupuesto de los 12 GB** y di de dónde sale la RAM. Si no sobra, algo tiene que
   ceder — normalmente la pila de observabilidad completa, que se puede reemplazar por Dozzle y
   Uptime Kuma con unos 100 MB.
5. Variables nuevas en `.env.example` y en el esquema Zod de entorno, que falla al arrancar si falta
   alguna.
6. Documenta en `docs/40-operacion/`.

## 10. Diagnóstico rápido

| Síntoma | Primero revisa |
|---|---|
| Funciona en local, falla en el VPS | Variables de entorno faltantes; el esquema Zod te dirá cuál |
| Un contenedor reinicia en bucle | `make prod-logs S=<servicio>`; casi siempre healthcheck o límite de memoria |
| Webhooks con timeout | Réplicas de `ingest` y `docker stats`; el endpoint debe responder en <100 ms |
| La cola de BullMQ crece y no baja | El worker está caído o hay un job fallando en bucle; revisa la dead letter queue |
| Dashboard lento | Frescura de las vistas materializadas antes que la CPU de Postgres |
| Disco lleno | Rotación de logs, WAL sin archivar, imágenes viejas (`docker system prune`) |
