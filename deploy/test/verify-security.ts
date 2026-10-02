import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../src/core/security/password.service';
import { TokenService } from '../src/core/security/token.service';
import { RedisService } from '../src/core/redis/redis.service';

async function main() {
  console.info('🔒 Iniciando verificación de seguridad (Argon2id, JWT, Redis Denylist)...');

  // 1. Verificación de Argon2id
  console.info('\n1. Probando hashing de contraseñas con Argon2id...');
  const passwordService = new PasswordService();
  const rawPassword = 'SecurePassword_2026!';
  const hash = await passwordService.hash(rawPassword);
  console.info(`  ✔ Hash generado: ${hash.substring(0, 30)}...`);

  if (!hash.startsWith('$argon2id$')) {
    throw new Error('El algoritmo de hashing no es Argon2id.');
  }

  const isValid = await passwordService.verify(hash, rawPassword);
  if (!isValid) {
    throw new Error('Falló la verificación de contraseña válida.');
  }
  console.info('  ✔ Contraseña correcta validada con éxito.');

  const isInvalidValid = await passwordService.verify(hash, 'WrongPassword_123');
  if (isInvalidValid) {
    throw new Error('Una contraseña incorrecta fue erróneamente validada como correcta.');
  }
  console.info('  ✔ Contraseña incorrecta rechazada correctamente.');

  // 2. Verificación de JWT (Access Token 15m)
  console.info('\n2. Probando emisión y validación de Access Token (JWT)...');
  const jwtService = new JwtService();
  const tokenService = new TokenService(jwtService);
  const sampleUserId = 'c1a5b8f2-89b4-4b52-b8ec-f8b1e4a2d123';
  const sampleSessionId = 'e2b6c9f3-90c5-5c63-c9fd-09c2f5b3e234';

  const accessToken = await tokenService.signAccessToken({
    sub: sampleUserId,
    email: 'closer@growthsell.com',
    role: 'CLOSER',
    sessionId: sampleSessionId,
  });
  console.info(`  ✔ Access Token emitido: ${accessToken.substring(0, 25)}...`);

  const decoded = await tokenService.verifyAccessToken(accessToken);
  if (decoded.sub !== sampleUserId || decoded.role !== 'CLOSER') {
    throw new Error('Los claims del token verificado no coinciden.');
  }
  console.info(`  ✔ Claims verificados: user=${decoded.sub}, role=${decoded.role}`);

  // 3. Verificación de Refresh Token
  console.info('\n3. Probando generación y hash de Refresh Token...');
  const rawRefreshToken = tokenService.generateRefreshToken();
  if (rawRefreshToken.length !== 80) {
    throw new Error('La longitud del refresh token no coincide con 40 bytes en hex (80 caracteres).');
  }
  const refreshHash = tokenService.hashRefreshToken(rawRefreshToken);
  console.info(`  ✔ Refresh token generado: ${rawRefreshToken.substring(0, 16)}...`);
  console.info(`  ✔ SHA-256 hash para DB: ${refreshHash.substring(0, 16)}...`);

  // 4. Verificación de Redis Denylist
  console.info('\n4. Probando conexión y denylist en Redis 7...');
  const redisService = new RedisService();
  redisService.onModuleInit();

  const isInitiallyDenied = await redisService.isDenylisted(accessToken);
  if (isInitiallyDenied) {
    throw new Error('El token recién emitido ya estaba en la denylist.');
  }
  console.info('  ✔ Token nuevo no está en la denylist.');

  console.info('  Agregando Access Token a denylist (revocación inmediata)...');
  await redisService.addToDenylist(accessToken, 60); // 60 segundos TTL

  const isDeniedAfterRevoke = await redisService.isDenylisted(accessToken);
  if (!isDeniedAfterRevoke) {
    throw new Error('El token revocado no fue detectado en la denylist de Redis.');
  }
  console.info('  ✔ Token revocado detectado inmediatamente en denylist.');

  console.info('  Probando revocación de sesión completa...');
  await redisService.revokeSession(sampleSessionId, 60);
  const isSessionRevoked = await redisService.isSessionRevoked(sampleSessionId);
  if (!isSessionRevoked) {
    throw new Error('La sesión revocada no fue detectada en Redis.');
  }
  console.info('  ✔ Sesión revocada detectada correctamente.');

  await redisService.onModuleDestroy();
  console.info('\n🎉 Verificación de Criptografía y Sesiones COMPLETADA CON ÉXITO.');
}

main().catch((err) => {
  console.error('❌ Error en prueba de seguridad:', err);
  process.exit(1);
});
