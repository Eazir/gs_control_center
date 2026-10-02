# GrowthShell Control Center

Plataforma unificada para operar unidades comerciales de infoproductos. Permite centralizar ventas, leads, pipelines, integraciones (Stripe, Hotmart, N8N) y analíticas en una sola aplicación de alto rendimiento.

## 🚀 Despliegue a Producción (VPS)

Este proyecto está orquestado con Docker y utiliza Traefik como proxy inverso para gestionar automáticamente los dominios y los certificados SSL gratuitos (Let's Encrypt).

### 1. Requisitos Previos en el Servidor (VPS)
- **Ubuntu 22.04+ / Debian 12+**
- **Docker** y **Docker Compose** instalados (recomendado: 6 vCPU / 12 GB RAM).
- Puertos `80` y `443` abiertos en el firewall.

### 2. Configuración de Dominios (DNS)
En tu proveedor de dominios (GoDaddy, Hostinger, etc.), crea Registros tipo **A** que apunten a la IP pública de tu servidor para cada uno de estos subdominios:
- `app.growth-sell.xyz` (Frontend para usuarios)
- `api.growth-sell.xyz` (Backend GraphQL y REST)
- `hooks.growth-sell.xyz` (Receptor de Webhooks rápidos)
- `docs.growth-sell.xyz` (Documentación interna)
- `flows.growth-sell.xyz` (Instancia de N8N integrada)

### 3. Configuración del Entorno (`.env`)
1. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Reemplaza todos los secretos por contraseñas fuertes. Puedes generar las claves criptográficas para JWT y AES-256 (32 bytes) usando nuestra herramienta incluida:
   ```bash
   node scripts/crypto-tool.mjs generate-key
   ```
   *Cópialas y pégalas en `ENCRYPTION_MASTER_KEY`, `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`.*
3. En `ACME_EMAIL` pon tu correo real (Let's Encrypt lo usará para notificar expiración de certificados SSL).
4. Asegúrate de configurar la cuenta de **Resend** para los correos y configurar **Google Drive** con Rclone para los backups (ver `scripts/backup.sh`).

### 4. Lanzamiento
Inicia la construcción y despliegue ejecutando el Makefile:
```bash
make prod-deploy
```
Y una vez arriba, ejecuta las migraciones de la base de datos:
```bash
make prod-migrate
```

### 5. Crear el Primer Super Admin
Para poder acceder a la plataforma por primera vez, necesitas sembrar el primer superusuario (reemplaza los datos por los tuyos). Esto inyecta el hash Argon2id de forma segura a PostgreSQL:
```bash
node scripts/crypto-tool.mjs seed-admin admin@growth-sell.xyz "ContraseñaSegura123!" "Tu Nombre" | docker exec -i gs_control_center-postgres-1 psql -U gs_admin -d gs_control_center
```

¡Listo! Tu plataforma estará disponible en `https://app.growth-sell.xyz`.

---

## 📖 Manual de Usuario General

### Inicio de Sesión y Acceso
- Accede a `https://app.growth-sell.xyz`.
- Podrás iniciar sesión con el correo asignado.
- Si olvidaste tu contraseña o recibes una invitación como nuevo Closer/Administrador, el sistema te enviará un correo para asignar tu contraseña de forma segura.

### Panel Principal (Dashboard)
- Verás indicadores de KPI como Ventas Totales, Leads Recibidos, Ticket Promedio y Tasas de Conversión.
- Si eres un **Closer**, verás un tablero Kanban con tus leads asignados y su estado.
- Si eres **SuperAdmin**, tendrás vista de pájaro sobre el desempeño de todos los miembros del equipo.

### Gestión de Proyectos
- Puedes tener múltiples "Proyectos" (unidades de negocio). Cada proyecto tiene sus propios leads, integraciones (ej. sus propios webhooks de Hotmart) y equipo asignado.
- Los datos están estrictamente aislados: un usuario en el Proyecto A no puede ver los leads ni ventas del Proyecto B, a menos que sea SuperAdmin.

### Gestión del Pipeline (Ventas)
- Cada lead que entra desde N8N, Hotmart o tu CRM cae directamente al Pipeline de su proyecto.
- Mueve tarjetas (Leads) de columna en columna según la etapa de venta (Ej: "Contacto Inicial" ➡️ "Llamada Agendada" ➡️ "Cierre").

### Gestión de Integraciones
- Usa la URL `https://hooks.growth-sell.xyz/webhooks/...` para recibir eventos en tiempo real.
- Las plataformas externas pueden enviar información de ventas y prospectos a esta URL. El sistema almacena todo y luego procesa la información de forma asíncrona para no perder ni una sola solicitud, incluso si hay alta carga de tráfico.
