# Utilidad Criptográfica de GrowthSell (`scripts/crypto-tool.mjs`)

Herramienta de línea de comandos (CLI) estándar para la administración criptográfica de **GrowthSell Centro de Mando**. Proporciona generación de claves para `.env`, cifrado/descifrado autenticado con AES-256-GCM y generación/verificación de hashes Argon2id para el Super Admin de la aplicación.

---

## 1. Estándares Criptográficos Implementados

Esta utilidad se rige por las directivas de seguridad de [`AGENTS.md`](../AGENTS.md) y las recomendaciones de OWASP:

| Mecanismo | Algoritmo | Parámetros / Estándar | Propósito en el Proyecto |
|---|---|---|---|
| **Cifrado Simétrico** | **AES-256-GCM** | Clave de 32 bytes (64 hex chars), IV aleatorio de 12 bytes (96 bits, NIST SP 800-38D), Auth Tag de 16 bytes (128 bits). | Credenciales de integración (`integrations.credentials`), tokens de pasarelas (Hotmart, GHL) y datos sensibles en reposo. |
| **Hash Unidireccional** | **Argon2id** | `memoryCost`: 65536 KB (64 MB), `timeCost`: 3 iteraciones, `parallelism`: 4 hilos. | Contraseñas de usuarios (`auth.users.password_hash`). Compatible 1:1 con `PasswordService` en `apps/api`. |
| **Generación de Claves** | `crypto.randomBytes(32)` | 256 bits de entropía criptográfica del SO. | `ENCRYPTION_MASTER_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. |

---

## 2. Diferencia de Superusuarios

> [!IMPORTANT]
> **No confundir el Superusuario de Base de Datos con el Super Admin de la Aplicación:**
> * **DBA de PostgreSQL (`gs_admin`):** Administrador del motor PostgreSQL. Se configura en `.env` (`POSTGRES_USER`) y se inicializa al crear el contenedor con `db_postgres/init/01_init_schemas_and_roles.sql`. **No se gestiona con este script.**
> * **Super Admin de la Aplicación (`auth.users`):** Usuario con rol `SUPER_ADMIN` en la tabla `auth.users` del schema `auth` en la base de datos `gs_control_center`. **Este script genera y siembra este usuario.**

---

## 3. Uso y Comandos

### A. Generar Claves Criptográficas (`generate-key`)
Genera una clave aleatoria de 32 bytes en formato hexadecimal (64 caracteres):

```bash
node scripts/crypto-tool.mjs generate-key
```

**Ejemplo de salida:**
```text
[Clave Criptográfica de 32 bytes (64 hex chars)]:
329255c736ce1dd2b844c6f92311c28a69c04874b14078a76cd048ef8ee178cf

Puedes asignarla en tu archivo .env según corresponda:
ENCRYPTION_MASTER_KEY=329255c736ce1dd2b844c6f92311c28a69c04874b14078a76cd048ef8ee178cf
JWT_ACCESS_SECRET=329255c736ce1dd2b844c6f92311c28a69c04874b14078a76cd048ef8ee178cf
JWT_REFRESH_SECRET=329255c736ce1dd2b844c6f92311c28a69c04874b14078a76cd048ef8ee178cf
```

---

### B. Sembrar el Super Admin en PostgreSQL (`seed-admin`)

Genera la sentencia SQL de inserción o actualización (`ON CONFLICT DO UPDATE`) para la tabla `auth.users`:

```bash
node scripts/crypto-tool.mjs seed-admin <email> <contraseña> [nombre_completo]
```

**Ejemplo:**
```bash
node scripts/crypto-tool.mjs seed-admin admin@growthsell.com "AdminPassword123!" "Super Administrador"
```

**Inyección directa a Docker PostgreSQL:**
Para ejecutar la creación directamente sobre la base de datos de desarrollo:

* **En PowerShell (Windows):**
  ```powershell
  node scripts/crypto-tool.mjs seed-admin admin@growthsell.com "AdminPassword123!" "Super Administrador" | docker exec -i gs_control_center-postgres-1 psql -U gs_admin -d gs_control_center
  ```
* **En Linux / macOS (Bash):**
  ```bash
  node scripts/crypto-tool.mjs seed-admin admin@growthsell.com "AdminPassword123!" "Super Administrador" | docker exec -i gs_control_center-postgres-1 psql -U gs_admin -d gs_control_center
  ```

---

### C. Hashear y Verificar Contraseñas (`hash-password` / `verify-password`)

Genera un hash Argon2id o verifica una contraseña contra un hash existente:

```bash
# Generar hash:
node scripts/crypto-tool.mjs hash-password "MiContraseñaSegura123!"

# Verificar hash:
# NOTA: En PowerShell usa comillas simples ('') para evitar interpolación de variables ($argon2id)
node scripts/crypto-tool.mjs verify-password "MiContraseñaSegura123!" '$argon2id$v=19$m=65536,t=3,p=4$...'
```

---

### D. Cifrado y Descifrado AES-256-GCM (`encrypt` / `decrypt`)

Cifra o descifra cualquier texto plano utilizando la clave `ENCRYPTION_MASTER_KEY` del entorno o `.env`:

```bash
# Cifrar usando la clave de .env:
node scripts/crypto-tool.mjs encrypt "sk_live_mi_token_secreto_hotmart"

# Cifrar pasando una clave específica como segundo parámetro:
node scripts/crypto-tool.mjs encrypt "token" 329255c736ce1dd2b844c6f92311c28a69c04874b14078a76cd048ef8ee178cf

# Descifrar (formato iv:tag:ciphertext):
node scripts/crypto-tool.mjs decrypt "6e41be3b523b65dc7d7d9bcf:cce99d9562da27a3c94b82e30d46ddcb:1d0fddc443315751554e66f0da6f6f3abe4a565176b8af"
```

---

## 4. Resolución de Dependencias

El script es un módulo ES nativo (`.mjs`) que no requiere librerías adicionales instaladas en la raíz del proyecto. Para la función Argon2id, el script resuelve dinámicamente la dependencia instalada en `apps/api` (`argon2`).
