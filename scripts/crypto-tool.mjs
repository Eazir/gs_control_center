#!/usr/bin/env node

/**
 * ==============================================================================
 * GrowthSell Centro de Mando — Utilidad Estándar de Criptografía
 * ==============================================================================
 * 
 * Estándares implementados (alineados con AGENTS.md y OWASP):
 *  1. CIFRADO SIMÉTRICO BIDIRECCIONAL (Credenciales de integración / Datos en reposo):
 *     - Algoritmo: AES-256-GCM (Galois/Counter Mode con autenticación)
 *     - Vector de Inicialización (IV): 12 bytes (96-bit, estándar NIST SP 800-38D)
 *     - Auth Tag: 16 bytes (128-bit)
 *     - Formato serializado: "<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
 *     - Variable en .env: ENCRYPTION_MASTER_KEY (compatible con ENCRYPTION_KEY_AES256)
 * 
 *  2. HASH UNIDIRECCIONAL (Contraseñas de usuarios / Super Admin):
 *     - Algoritmo: Argon2id (Parámetros: memoryCost=64MB, timeCost=3, parallelism=4)
 *     - Totalmente compatible con PasswordService de apps/api
 * 
 *  3. SEED DE SUPER ADMIN:
 *     - Tabla destino: auth.users (schema auth en gs_control_center)
 *     - Tipos: auth."UserRole" y auth."UserStatus"
 * ==============================================================================
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Cargar la librería argon2 desde apps/api o la raíz del monorepo
function getArgon2() {
  try {
    const require = createRequire(import.meta.url);
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(scriptDir, '..');
    const argon2Path = require.resolve('argon2', {
      paths: [
        process.cwd(),
        projectRoot,
        path.resolve(projectRoot, 'apps/api'),
        path.resolve(process.cwd(), 'apps/api'),
      ],
    });
    return require(argon2Path);
  } catch (err) {
    throw new Error(
      'No se pudo cargar la librería "argon2". Asegúrate de haber instalado dependencias (pnpm install): ' +
        err.message
    );
  }
}

// Cargar clave de encriptación desde entorno o .env si existe
function getEncryptionKey() {
  if (process.env.ENCRYPTION_MASTER_KEY) {
    return process.env.ENCRYPTION_MASTER_KEY.trim();
  }
  if (process.env.ENCRYPTION_KEY_AES256) {
    return process.env.ENCRYPTION_KEY_AES256.trim();
  }

  // Intento de lectura desde .env en la raíz del proyecto
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(scriptDir, '../.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const masterMatch = envContent.match(/^ENCRYPTION_MASTER_KEY=(.*)$/m);
      if (masterMatch && masterMatch[1] && masterMatch[1].trim()) {
        return masterMatch[1].trim();
      }
      const legacyMatch = envContent.match(/^ENCRYPTION_KEY_AES256=(.*)$/m);
      if (legacyMatch && legacyMatch[1] && legacyMatch[1].trim()) {
        return legacyMatch[1].trim();
      }
    }
  }

  return null;
}

// ------------------------------------------------------------------------------
// 1. CIFRADO SIMÉTRICO (AES-256-GCM)
// ------------------------------------------------------------------------------

/**
 * Genera una clave aleatoria de 32 bytes en formato hexadecimal (64 chars)
 */
export function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Cifra un texto plano usando AES-256-GCM
 * @param {string} plainText Texto o JSON a cifrar
 * @param {string} [hexKey] Clave en hex de 64 caracteres (32 bytes)
 * @returns {string} iv:authTag:encryptedData (en hexadecimal)
 */
export function encrypt(plainText, hexKey = null) {
  const keyStr = hexKey || getEncryptionKey();
  if (!keyStr || keyStr.length !== 64) {
    throw new Error(
      'Se requiere una clave ENCRYPTION_MASTER_KEY válida de 32 bytes (64 caracteres hex).'
    );
  }

  const key = Buffer.from(keyStr, 'hex');
  const iv = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descifra una cadena con formato iv:authTag:encryptedData usando AES-256-GCM
 * @param {string} cipherTextString iv:authTag:encryptedData
 * @param {string} [hexKey] Clave en hex
 * @returns {string} Texto plano original
 */
export function decrypt(cipherTextString, hexKey = null) {
  const keyStr = hexKey || getEncryptionKey();
  if (!keyStr || keyStr.length !== 64) {
    throw new Error(
      'Se requiere una clave ENCRYPTION_MASTER_KEY válida de 32 bytes (64 caracteres hex).'
    );
  }

  const parts = cipherTextString.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato inválido. Se espera: <iv>:<authTag>:<ciphertext>');
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const key = Buffer.from(keyStr, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ------------------------------------------------------------------------------
// 2. HASH DE CONTRASEÑAS (Argon2id conforme a AGENTS.md y OWASP)
// ------------------------------------------------------------------------------

/**
 * Genera un hash seguro para contraseñas usando Argon2id
 * Compatible con apps/api/src/core/security/password.service.ts
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const argon2 = getArgon2();
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Comprueba si una contraseña coincide con el hash almacenado en Argon2id
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  const argon2 = getArgon2();
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------
// 3. GENERADOR DE SQL PARA SUPER ADMIN (Schema auth en gs_control_center)
// ------------------------------------------------------------------------------

export async function generateSuperAdminSQL(email, password, fullName = 'Super Administrador') {
  const passwordHash = await hashPassword(password);
  const cleanEmail = email.replace(/'/g, "''");
  const cleanName = fullName.replace(/'/g, "''");

  return `
-- ==============================================================================
-- Insertar o actualizar Super Admin en auth.users (Schema 'auth')
-- Base de datos: gs_control_center
-- Algoritmo: Argon2id (conforme con PasswordService y AGENTS.md)
-- ==============================================================================
INSERT INTO auth.users (
    email,
    password_hash,
    full_name,
    role,
    status,
    mfa_enabled,
    preferences,
    metadata,
    created_at,
    updated_at
) VALUES (
    '${cleanEmail}',
    '${passwordHash}',
    '${cleanName}',
    'SUPER_ADMIN'::auth."UserRole",
    'ACTIVE'::auth."UserStatus",
    false,
    '{}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    status = 'ACTIVE'::auth."UserStatus",
    role = 'SUPER_ADMIN'::auth."UserRole",
    updated_at = NOW();
`.trim();
}

// ------------------------------------------------------------------------------
// 4. MODO CLI / LÍNEA DE COMANDOS
// ------------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
Uso de crypto-tool (GrowthSell):
---------------------------------
  node scripts/crypto-tool.mjs generate-key
      Genera una clave aleatoria segura de 32 bytes (64 chars hex) para .env
      (Válido para ENCRYPTION_MASTER_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET).

  node scripts/crypto-tool.mjs encrypt <texto_plano> [clave_hex]
      Cifra un secreto usando AES-256-GCM.

  node scripts/crypto-tool.mjs decrypt <iv:tag:data> [clave_hex]
      Descifra un secreto cifrado con AES-256-GCM.

  node scripts/crypto-tool.mjs hash-password <contraseña>
      Genera un hash Argon2id (OWASP) compatible con el backend NestJS.

  node scripts/crypto-tool.mjs verify-password <contraseña> <hash>
      Verifica una contraseña plana contra un hash Argon2id.

  node scripts/crypto-tool.mjs seed-admin <email> <contraseña> [nombre_completo]
      Genera el script SQL para insertar/actualizar el Super Admin en auth.users.
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'generate-key': {
        const key = generateKey();
        console.log('\n[Clave Criptográfica de 32 bytes (64 hex chars)]:');
        console.log(key);
        console.log('\nPuedes asignarla en tu archivo .env según corresponda:');
        console.log(`ENCRYPTION_MASTER_KEY=${key}`);
        console.log(`JWT_ACCESS_SECRET=${key}`);
        console.log(`JWT_REFRESH_SECRET=${key}\n`);
        break;
      }

      case 'encrypt': {
        const text = args[1];
        const key = args[2];
        if (!text) {
          console.error('Error: Especifica el texto a cifrar.');
          process.exit(1);
        }
        const result = encrypt(text, key);
        console.log('\n[Resultado Cifrado AES-256-GCM]:');
        console.log(result);
        break;
      }

      case 'decrypt': {
        const cipherText = args[1];
        const key = args[2];
        if (!cipherText) {
          console.error('Error: Especifica el texto cifrado (iv:tag:data).');
          process.exit(1);
        }
        const result = decrypt(cipherText, key);
        console.log('\n[Resultado Descifrado]:');
        console.log(result);
        break;
      }

      case 'hash-password': {
        const pass = args[1];
        if (!pass) {
          console.error('Error: Especifica la contraseña a hashear.');
          process.exit(1);
        }
        const hash = await hashPassword(pass);
        console.log('\n[Password Hash (Argon2id)]:');
        console.log(hash);
        break;
      }

      case 'verify-password': {
        const pass = args[1];
        const hash = args[2];
        if (!pass || !hash) {
          console.error('Error: Especifica <contraseña> y <hash>.');
          process.exit(1);
        }
        const isValid = await verifyPassword(pass, hash);
        console.log(`\n[Verificación Argon2id]: ${isValid ? 'VÁLIDA (Coincide)' : 'INVÁLIDA'}`);
        break;
      }

      case 'seed-admin': {
        const email = args[1] || 'admin@growthsell.com';
        const pass = args[2] || 'Admin12345!';
        const name = args[3] || 'Super Administrador';

        const sql = await generateSuperAdminSQL(email, pass, name);
        console.log('\n-- ================ SQL PARA INSERTAR SUPER ADMIN ================');
        console.log(sql);
        console.log('-- =================================================================\n');
        break;
      }

      default:
        console.error(`Comando desconocido: ${command}. Ejecuta con --help.`);
        process.exit(1);
    }
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
}

// Ejecutar CLI solo si se llama directamente
if (process.argv[1] && process.argv[1].endsWith('crypto-tool.mjs')) {
  main();
}
