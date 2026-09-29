# Plan: Backups del proyecto en Google Drive

**Fecha:** 28/09/2026
**Estado:** PENDIENTE DE EJECUCIÓN
**Reglas aplicables:** `AGENTS.md` (fronteras de módulo, secretos solo en env/SOPS, confirmación explícita antes de tocar producción, documentación en el mismo cambio).

---

## 1. Contexto y hallazgos

Revisión previa del repo antes de diseñar esto:

1. **El sistema de backups está diseñado pero no existe.** `docker-compose.prod.yml` define el servicio `backup` con `entrypoint: ["/bin/sh", "/backup.sh"]` y el `Makefile` invoca `./scripts/backup.sh` y `./scripts/restore.sh`, pero **ninguno de los dos archivos existe** (en `scripts/` solo hay `crypto-tool.mjs` y `test-webhooks.mjs`). `make prod-backup` y `make prod-restore` fallan hoy.
2. **La imagen no puede hacer lo que documenta.** El servicio usa `postgres:16-alpine`, que trae `pg_dump` pero **ni restic ni rclone**.
3. **La documentación apunta a restic → Backblaze B2/S3** (`DESPLIEGUE_DOCKER.md` §8, `AJUSTES_STACK.md` 3.1, `PLAN_DE_ACCION.md` Fase 7). Este plan cambia **el destino a Google Drive** manteniendo restic como motor.
4. **`pgwal` crece sin límite.** El `archive_command` de Postgres copia WAL al volumen `pgwal` y nadie lo rota: con `archive_mode=on` activo, ese volumen llena el disco del VPS con el tiempo.
5. **`docs/40-operacion/`** solo contiene `criptografia-y-claves.md`: falta el capítulo de backups.

## 2. Decisiones del usuario

| Decisión | Valor |
| :--- | :--- |
| Alcance | **Todo:** Postgres + configuración + Redis (BullMQ) + n8n |
| Destino | **Solo Google Drive** (sin segunda copia remota) |
| Entorno | **VPS de producción ya levantado** |
| Espacio | Google One ~8 TB |
| Retención | 30 días diarios / 12 meses mensuales (la ya documentada) |

## 3. Diseño objetivo

### 3.1 Destino y cifrado

- Repositorio **restic** sobre el backend `rclone:` → `rclone:GD:<BACKUP_RCLONE_PATH>`.
- **Cifrado de extremo a extremo:** restic cifra contenido y metadatos con `RESTIC_PASSWORD`. Google Drive solo ve ciphertext (la BD contiene facturación y PII).
- La configuración de rclone va **por variables de entorno** (`RCLONE_CONFIG_GD_TYPE=drive`, `RCLONE_CONFIG_GD_TOKEN=...`), sin escribir archivos de config en la imagen. restic invoca `rclone serve restic --stdio` e inhera `RCLONE_*`.
- **`RCLONE_DRIVE_USE_TRASH=true`** (es el valor por defecto de rclone): todo lo que `prune` elimine cae en la papelera de Drive y sobrevive 30 días o 100 revisiones. Es la única red de seguridad al ser Drive destino único. Verificarlo en la primera ejecución real, no darlo por supuesto.

### 3.2 Contenido del backup

| Qué | Método | Notas |
| :--- | :--- | :--- |
| Postgres (schemas `auth`, `projects`, `sales`, …) | `pg_dump -Fc` por red a `postgres:5432` | **No** montar `pgdata`. Formato custom → restauración selectiva por tabla |
| Configuración | `./.env`, `docker-compose.yml`, `docker-compose.prod.yml`, `Makefile`, `db_postgres/init/` | Todo montado `:ro` en el contenedor |
| Certificados TLS | Volumen `letsencrypt` (`acme.json`) montado `:ro` | Sin él se agotan los rate limits de Let's Encrypt al reconstruir |
| Redis / BullMQ | `redis-cli -h redis -a $REDIS_PASSWORD --rdb /tmp/dump.rdb` | Colas en vuelo: perder un job es perder una venta. Si `--rdb` falla, saltar con warning, no abortar |
| n8n | Volumen `n8ndata` montado `:ro` + `sqlite3 … ".backup"` sobre `database.sqlite` | Si el contenedor no está activo (perfil `automation`), **omitir y loguear**. Si n8n usa Postgres, los workflows ya están en el `pg_dump` |
| WAL (`pgwal`) | **Rotación**: borrar archivos con más de `BACKUP_WAL_KEEP_DAYS` | Solo rota lo ya no útil; no es PITR (ver §7) |
| Repositorio git | `git bundle` **solo si** existe `.git` en el VPS | En producción el deploy usa imágenes GHCR: puede no estar |

### 3.3 Ciclo de ejecución

1. **Prefecth:** conectividad (`rclone lsd GD:`), espacio en disco, `restic cat config` → si no existe el repo, `restic init`.
2. **Volcados** de la tabla §3.2 a un directorio temporal.
3. **`restic backup --tag gs`** de los volcados.
4. **`restic forget --keep-daily 30 --keep-monthly 12 --prune`**.
5. **`restic check --read-data-subset=5%`** (verificación real, no solo subir y cruzar los dedos).
6. **Rotación local:** conservar los últimos `BACKUP_LOCAL_KEEP` (3) dumps en el volumen `backups`.
7. **Rotación de WAL** y marca de éxito en `/backups/.last_ok`.
8. **Telegram** en fallo (y opcionalmente en éxito): `TELEGRAM_BOT_TOKEN` ya existe en `.env`, falta `BACKUP_TELEGRAM_CHAT_ID`. Nunca incluir tokens, PII ni rutas con secretos en el mensaje.

**Programación:** daemon con loop hasta la próxima hora `BACKUP_TIME` (03:00 UTC por defecto) + modo `once` para `make prod-backup`. `trap SIGTERM` para cerrar limpio entre ejecuciones (regla de `tini` del skill `docker-despliegue`).

## 4. Fases de implementación

### Fase 1 — Imagen y scripts

- [ ] **`docker/Dockerfile.backup`** — multi-stage, alpine fijado, `apk add`: `restic`, `rclone`, `postgresql16-client`, `redis` (redis-cli), `sqlite`, `ca-certificates`, `tzdata`, `curl`, `tini`, `bash`. Usuario no root. Si los paquetes de Alpine quedan muy viejos, descargar binarios oficiales y verificar checksum.
- [ ] **`scripts/backup.sh`** — `set -euo pipefail`, modos `once` y daemon según §3.3, log a stdout (el servicio lleva rotación de logs), `trap SIGTERM`.
- [ ] **`scripts/restore.sh`** — lista snapshots, restaura el indicado en un entorno limpio con confirmación explícita (`read -p`, exigir `si`, igual que `prod-migrate`).

### Fase 2 — Compose y variables de entorno

- [ ] **`docker-compose.prod.yml` → servicio `backup`:**
  - `build: docker/Dockerfile.backup` (hoy no hay workflows de GHCR, así que se construye en el VPS; si después aparece CI, publicar la imagen y pasar a `image:`).
  - Volumes: `./:/config:ro` queda demasiado amplio → montar ficheros concretos (`.env`, los dos compose, `Makefile`, `db_postgres/init`), `letsencrypt:/letsencrypt:ro`, `n8ndata:/n8n:ro`, `backups:/backups`. **Eliminar el montaje `pgdata`**.
  - `depends_on`: `postgres` y `redis` healthy.
  - `logging` con rotación (hoy el servicio no la tiene: sin ella los logs llenan el disco).
  - `healthcheck`: `/backups/.last_ok` con menos de 26 h.
  - Mantener límite de 256 MB; subir a 512 MB solo si `pg_dump` + `restic check` lo piden (justificar de dónde sale la RAM).
- [ ] **`.env.example`** — bloque `# ---- Respaldos ----` nuevo:
  `BACKUP_RCLONE_REMOTE=GD`, `BACKUP_RCLONE_PATH=`, `RCLONE_CONFIG_GD_TYPE=drive`, `RCLONE_CONFIG_GD_TOKEN=`, `RCLONE_CONFIG_GD_CLIENT_ID=`, `RCLONE_CONFIG_GD_CLIENT_SECRET=`, `RCLONE_DRIVE_USE_TRASH=true`, `RESTIC_PASSWORD=`, `BACKUP_TIME=03:00`, `BACKUP_KEEP_DAILY=30`, `BACKUP_KEEP_MONTHLY=12`, `BACKUP_LOCAL_KEEP=3`, `BACKUP_WAL_KEEP_DAYS=7`, `BACKUP_TELEGRAM_CHAT_ID=`.
  **Borrar** `BACKUP_S3_BUCKET` y `BACKUP_S3_ENDPOINT`: ya no hay destino S3.
- [ ] **`.gitignore`**: verificar que no se cuelen dumps ni config de rclone.

### Fase 3 — Autenticación OAuth de Google (manual, la hace el usuario)

1. Google Cloud Console → proyecto → **OAuth consent screen** → External → scope `.../auth/drive` (sensitive) → añadir el Gmail como test user → **Publicar app (Production)**. En modo *Testing* el refresh token caduca a los 7 días: el backup dejaría de subir una semana después en silencio.
2. **Credentials → OAuth client ID → tipo Desktop app.** Descargar `client_id` y `client_secret`.
   - El `client_id` compartido de rclone se retira durante **2026**: usar client propio ya no es recomendación, es obligación.
3. En el PC local: `rclone authorize "drive" --client-id <ID> --client-secret <SECRET>` → autorizar en el navegador → copiar el JSON del token. **Mismo client id/secret que en el servidor**, si no, rclone rechaza el token.
4. En el VPS: pegar el token en `.env` (`RCLONE_CONFIG_GD_TOKEN=`), cifrar con SOPS si `.env` está versionado, y verificar:
   - `rclone lsd GD:` → ve la raíz.
   - `restic -r rclone:GD:<path> snapshots` → `init` correcto.
5. `make prod-backup` → comprobar snapshot en `restic snapshots` **y** archivo en Drive.

### Fase 4 — Verificación y documentación

- [ ] Restauración real en entorno limpio: `make prod-restore F=<snapshot>`.
- [ ] **`docs/40-operacion/backups.md`** (nuevo): qué cubre, cadencia, retención, cómo restaurar, cómo rotar el token de Google, runbook *"se perdió el VPS"* paso a paso.
- [ ] `docs/40-operacion/criptografia-y-claves.md`: añadir el token OAuth de rclone a la tabla de claves.
- [ ] `DESPLIEGUE_DOCKER.md` §8: B2/S3 → Google Drive; fila de la tabla de servicios ya no aplica a `postgres:16-alpine`.
- [ ] `PLAN_DE_ACCION.md` Fase 7: marcar el checkbox de backups.
- [ ] Targets nuevos en `Makefile` con su comentario `##:` y `pnpm docs:generate`.

## 5. Archivos objetivo

| Archivo | Acción |
| :--- | :--- |
| `docker/Dockerfile.backup` | Nuevo |
| `scripts/backup.sh` | Nuevo (referenciado hoy, no existe) |
| `scripts/restore.sh` | Nuevo (referenciado hoy, no existe) |
| `docker-compose.prod.yml` | Modificar servicio `backup` |
| `.env.example` | Reemplazar bloque de respaldos |
| `.gitignore` | Revisar/añadir entradas |
| `docs/40-operacion/backups.md` | Nuevo |
| `docs/40-operacion/criptografia-y-claves.md` | Añadir clave OAuth |
| `DESPLIEGUE_DOCKER.md` | Actualizar §8 |
| `PLAN_DE_ACCION.md` | Marcar Fase 7 |
| `Makefile` | Targets de verificación si procede |

## 6. Criterios de aceptación

1. `make prod-backup` sube un snapshot a Google Drive y `restic check` pasa sin errores.
2. `restic forget` respeta 30 diarios / 12 mensuales y los borrados aparecen en la papelera de Drive (30 días), no eliminados definitivamente.
3. El snapshot contiene: `pg_dump`, config, `acme.json`, RDB de Redis y, si n8n está activo, su base.
4. `make prod-restore` reconstruye la BD en un contenedor limpio y la aplicación arranca contra ella.
5. El contenedor `backup` pasa su healthcheck y se recupera solo tras un `docker restart`.
6. Ningún secreto (token OAuth, `RESTIC_PASSWORD`) aparece en git, en logs ni en mensajes de Telegram.
7. `make check` y `make docs-check` en verde.
8. Restauración mensual ejecutada y anotada en `docs/40-operacion/backups.md`.

## 7. Riesgos y fuera de alcance

- **Drive destino único (decisión consciente del usuario):** una suspensión de cuenta o un `prune` mal ejecutado sería pérdida total. Mitigación incluida: papelera de Drive (30 días) + 3 dumps locales. Si más adelante se quiere 3-2-1 real, añadir B2/S3 como segundo repositorio restic no toca este diseño.
- **PITR con WAL archivado:** fuera de alcance. `pgwal` solo se **rota** para que no llene el disco; un PITR de verdad necesita `pg_basebackup` + WAL en S3/B2.
- **`packages/contracts/env.ts` no existe** aunque `.env.example` lo afirma. Las variables nuevas las consume un script shell, no Node, así que no requieren schema Zod; dejar la discrepancia anotada en el reporte.
- **`shellcheck` en CI:** recomendado para los dos scripts, no incluido en este plan.
- **Prohibido sin confirmación explícita:** migraciones, `docker compose down -v` y despliegues (`AGENTS.md` §Cómo trabajar).
