# Backups y Configuración de Rclone

Este documento describe cómo configurar y operar el sistema de respaldos automáticos de la base de datos de producción de **GS Control Center**, el cual utiliza `pg_dump` y `rclone` para exportar, comprimir y subir los datos a Google Drive.

## Arquitectura de Backups

El servicio de backups se ejecuta en un contenedor Docker dedicado (`backup`) definido en `docker-compose.prod.yml`. Este contenedor:
1. Utiliza la imagen de Alpine Linux con el cliente de PostgreSQL.
2. Ejecuta un script infinito (`scripts/backup.sh`) que realiza un volcado de la base de datos cada 24 horas.
3. Comprime el volcado al vuelo usando `gzip`.
4. Utiliza `rclone` para subir el archivo `.sql.gz` a una carpeta de Google Drive llamada `GrowthShell_Backups`.
5. Limpia localmente los backups con más de 7 días de antigüedad para evitar la saturación del disco del VPS.

## Requisitos de Configuración

Para que el script pueda autenticarse con Google Drive sin interacción humana, es obligatorio proveer un archivo de configuración de `rclone` previamente autorizado.

**Reglas innegociables del proyecto:**
- El remoto configurado dentro de rclone **debe llamarse exactamente `gdrive`**.
- El archivo generado (`rclone.conf`) debe estar ubicado en el host en la ruta `./rclone/rclone.conf` (relativo a la raíz del proyecto y al archivo `docker-compose.prod.yml`).

## Guía de Configuración Paso a Paso

Como el servidor VPS normalmente no tiene navegador web para el flujo de autenticación OAuth2 de Google, la configuración se debe realizar primero en una máquina local (Windows/Mac/Linux con GUI) y luego transferirse al servidor.

### 1. Generar la configuración en tu PC Local

1. Instala rclone en tu máquina local (ej. en Windows: `winget install Rclone.Rclone`).
2. Abre tu terminal y ejecuta la configuración interactiva:
   ```bash
   rclone config
   ```
3. Sigue exactamente este flujo:
   - `n` (New remote)
   - `name>` **`gdrive`** *(Obligatorio)*
   - `Storage>` **`drive`** (Google Drive)
   - `client_id>` *(Dejar vacío / Presionar Enter)*
   - `client_secret>` *(Dejar vacío / Presionar Enter)*
   - `scope>` **`1`** (Full access all files, excluding Application Data Folder)
   - `service_account_file>` *(Dejar vacío / Presionar Enter)*
   - `Edit advanced config?` **`n`**
   - `Use web browser to automatically authenticate rclone with remote?` **`y`**
   *(Esto abrirá tu navegador para que inicies sesión en Google y autorices a Rclone)*
   - `Configure this as a Shared Drive (Team Drive)?` **`n`**
   - `Keep this "gdrive" remote?` **`y`**
   - `q` (Quit config)

### 2. Transferir la configuración al Proyecto

1. Averigua dónde guardó rclone el archivo ejecutando:
   ```bash
   rclone config file
   ```
   *(En Windows suele ser `C:\Users\TU_USUARIO\AppData\Roaming\rclone\rclone.conf`)*

2. Ve a la raíz de tu proyecto (donde está el código fuente y `docker-compose.prod.yml`).
3. Crea un directorio llamado `rclone` y copia allí el archivo generado:
   ```bash
   mkdir rclone
   cp /ruta/hacia/tu/rclone.conf ./rclone/
   ```

### 3. Despliegue en Producción

Asegúrate de que la carpeta `./rclone` que acabas de crear esté en el servidor VPS de producción en la misma ruta relativa.
Cuando levantes el entorno (`make prod-deploy` o `docker compose -f docker-compose.prod.yml up -d backup`), el contenedor leerá tus credenciales automáticamente y la subida programada a Google Drive funcionará de forma transparente.
