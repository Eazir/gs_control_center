# Gestión de Claves Criptográficas y Super Admin

Este runbook describe los procedimientos operativos para la generación de claves maestras, cifrado de secretos de integración y aprovisionamiento del Super Administrador en **GrowthSell Centro de Mando**.

---

## 1. Claves y Secretos del Sistema

Todas las claves maestras se configuran en variables de entorno y se cargan a través del archivo `.env` o el gestor de secretos del servidor (SOPS+age en producción).

| Variable | Longitud / Formato | Algoritmo | Descripción |
|---|---|---|---|
| `ENCRYPTION_MASTER_KEY` | 32 bytes (64 hex chars) | AES-256-GCM | Clave maestra para credenciales de terceros (`integrations.credentials`). **Nunca en la base de datos.** |
| `JWT_ACCESS_SECRET` | 32 bytes (64 hex chars) | HMAC SHA-256 | Firma de Access Tokens de corta duración (≤ 15 min). |
| `JWT_REFRESH_SECRET` | 32 bytes (64 hex chars) | HMAC SHA-256 | Firma de Refresh Tokens rotativos (≤ 7 días). |
| `RESTIC_PASSWORD` | 32 bytes base64 / hex | AES-256 | Clave de cifrado del repositorio de backups Restic en S3. |

---

## 2. Herramienta CLI (`scripts/crypto-tool.mjs`)

El proyecto incluye la utilidad [crypto-tool.mjs](../../scripts/crypto-tool.mjs) para ejecutar operaciones criptográficas locales sin requerir herramientas externas.

### Generar nuevas claves para `.env`
```bash
node scripts/crypto-tool.mjs generate-key
```

### Probar cifrado y descifrado de credenciales
```bash
# Cifrar un valor sensible
node scripts/crypto-tool.mjs encrypt "api_token_ejemplo"

# Descifrar usando el formato iv:tag:data
node scripts/crypto-tool.mjs decrypt "<iv>:<auth_tag>:<ciphertext>"
```

---

## 3. Sembrado y Recuperación del Super Admin

El acceso inicial al Centro de Mando requiere un usuario con rol `SUPER_ADMIN` en `auth.users`.

### Procedimiento de aprovisionamiento inicial:

1. **Generar el SQL con contraseña segura:**
   ```bash
   node scripts/crypto-tool.mjs seed-admin admin@growthsell.com "PasswordRobusto2026!" "Super Administrador"
   ```

2. **Aplicar en la base de datos PostgreSQL:**
   * **En entorno local / desarrollo (Docker):**
     ```powershell
     node scripts/crypto-tool.mjs seed-admin admin@growthsell.com "PasswordRobusto2026!" "Super Administrador" | docker exec -i gs_control_center-postgres-1 psql -U gs_admin -d gs_control_center
     ```
   * **En servidor VPS (Producción):**
     ```bash
     node scripts/crypto-tool.mjs seed-admin admin@growthsell.com "PasswordRobusto2026!" "Super Administrador" | docker compose exec -T postgres psql -U $POSTGRES_USER -d gs_control_center
     ```

3. **Verificación:**
   ```sql
   SELECT id, email, role, status, full_name, created_at 
   FROM auth.users 
   WHERE email = 'admin@growthsell.com';
   ```

> [!NOTE]
> El comando utiliza `ON CONFLICT (email) DO UPDATE`, por lo que ejecutarlo nuevamente con una contraseña diferente actualizará el hash de forma idempotente y restaurará el estado a `ACTIVE` en caso de bloqueo.

---

## 4. Estándar de Contraseñas (Argon2id)

El hashing de contraseñas cumple con las especificaciones de OWASP Password Storage Cheat Sheet y [AGENTS.md](../../AGENTS.md):
* **Algoritmo:** Argon2id v19
* **Coste de memoria (`m`):** 65,536 KiB (64 MB)
* **Coste de tiempo (`t`):** 3 iteraciones
* **Paralelismo (`p`):** 4 hilos
* **Salt:** 16 bytes generados criptográficamente de manera única por usuario.
