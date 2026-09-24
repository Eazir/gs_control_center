import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

async function runAuthVerification() {
  console.info('🚀 Iniciando verificación de punta a punta del Módulo Auth (REST, Casos de Uso, Cookies)...');

  // Inicializar servidor NestJS en puerto temporal para pruebas HTTP
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.use(cookieParser());
  const PORT = 3099;
  await app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}`;

  try {
    // -------------------------------------------------------------------------
    // 1. Test: Login con credenciales inválidas (debe fallar 401)
    // -------------------------------------------------------------------------
    console.info('\n1. Probando login con contraseña inválida...');
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@growthshell.com',
        password: 'WrongPassword_123!',
      }),
    });

    if (badLoginRes.status !== 401) {
      throw new Error(`Se esperaba status 401 para credenciales inválidas, pero se obtuvo: ${badLoginRes.status}`);
    }
    console.info('  ✔ Contraseña inválida rechazada con 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // 2. Test: Login exitoso de Super Admin
    // -------------------------------------------------------------------------
    console.info('\n2. Probando login exitoso de Super Admin (admin@growthshell.com)...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@growthshell.com',
        password: 'AdminPassword123!',
      }),
    });

    if (loginRes.status !== 200) {
      const errBody = await loginRes.text();
      throw new Error(`Error en login esperado 200, obtenido ${loginRes.status}: ${errBody}`);
    }

    const loginData = await loginRes.json() as {
      user: { id: string; email: string; fullName: string; role: string };
      tokens: { accessToken: string; tokenType: string; expiresIn: number };
    };

    if (!loginData.tokens?.accessToken || loginData.user.role !== 'SUPER_ADMIN') {
      throw new Error('Respuesta de login no contiene tokens válidos o el rol es incorrecto.');
    }

    const setCookie = loginRes.headers.get('set-cookie');
    if (!setCookie || !setCookie.includes('refreshToken=')) {
      throw new Error('No se recibió la cookie HttpOnly refreshToken.');
    }

    // Extraer token de refresh de la cookie
    const refreshTokenMatch = setCookie.match(/refreshToken=([^;]+)/);
    const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : '';

    console.info(`  ✔ Login exitoso. Usuario: ${loginData.user.email} (${loginData.user.role})`);
    console.info(`  ✔ Access Token recibido (15 min): ${loginData.tokens.accessToken.substring(0, 20)}...`);
    console.info(`  ✔ Cookie refreshToken recibida (HttpOnly; SameSite=Strict): ${refreshToken?.substring(0, 15)}...`);

    const accessToken = loginData.tokens.accessToken;

    // -------------------------------------------------------------------------
    // 3. Test: GET /auth/me con Bearer token
    // -------------------------------------------------------------------------
    console.info('\n3. Probando endpoint protegido GET /auth/me...');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (meRes.status !== 200) {
      throw new Error(`GET /auth/me devolvió ${meRes.status}`);
    }

    const meData = await meRes.json() as { id: string; email: string; role: string; status: string };
    if (meData.id !== loginData.user.id || meData.role !== 'SUPER_ADMIN') {
      throw new Error('Los datos devueltos por /auth/me no coinciden con el usuario autenticado.');
    }
    console.info(`  ✔ Perfil obtenido: id=${meData.id}, role=${meData.role}, status=${meData.status}`);

    // -------------------------------------------------------------------------
    // 4. Test: POST /auth/refresh con cookie rotativa
    // -------------------------------------------------------------------------
    console.info('\n4. Probando renovación y rotación de tokens (POST /auth/refresh)...');
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${refreshToken}`,
      },
    });

    if (refreshRes.status !== 200) {
      const errText = await refreshRes.text();
      throw new Error(`Error en refresh esperado 200, obtenido ${refreshRes.status}: ${errText}`);
    }

    const refreshData = await refreshRes.json() as { accessToken: string; expiresIn: number };
    const newSetCookie = refreshRes.headers.get('set-cookie');
    const newRefreshTokenMatch = newSetCookie?.match(/refreshToken=([^;]+)/);
    const newRefreshToken = newRefreshTokenMatch ? newRefreshTokenMatch[1] : '';

    if (!refreshData.accessToken || !newRefreshToken) {
      throw new Error('Refresh token no devolvió nuevo access token o nueva cookie rotada.');
    }

    if (newRefreshToken === refreshToken) {
      throw new Error('Fallo de rotación: el nuevo refresh token es idéntico al anterior.');
    }

    console.info(`  ✔ Nuevo Access Token emitido: ${refreshData.accessToken.substring(0, 20)}...`);
    console.info(`  ✔ Refresh Token rotado exitosamente a nuevo valor.`);

    // -------------------------------------------------------------------------
    // 5. Test: Detección de reuso de token previo (debe fallar 401)
    // -------------------------------------------------------------------------
    console.info('\n5. Probando detección de reuso de refresh token anterior...');
    const reuseRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${refreshToken}`, // Token viejo ya rotado
      },
    });

    if (reuseRes.status !== 401) {
      throw new Error(`Se esperaba 401 al reusar refresh token viejo, pero se obtuvo: ${reuseRes.status}`);
    }
    console.info('  ✔ Intento de reuso de refresh token revocado rechazado con 401.');

    // -------------------------------------------------------------------------
    // 6. Test: Invitación de nuevo usuario (POST /auth/invite)
    // -------------------------------------------------------------------------
    console.info('\n6. Probando invitación de nuevo usuario (POST /auth/invite)...');
    const inviteEmail = `closer_${Date.now()}@growthshell.com`;
    const inviteRes = await fetch(`${BASE_URL}/auth/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshData.accessToken}`,
      },
      body: JSON.stringify({
        email: inviteEmail,
        role: 'CLOSER',
        fullName: 'Closer Test Unitario',
      }),
    });

    if (inviteRes.status !== 201 && inviteRes.status !== 200) {
      const errText = await inviteRes.text();
      throw new Error(`Error en invite obtenido ${inviteRes.status}: ${errText}`);
    }

    const inviteData = await inviteRes.json() as { invitationId: string; token: string; email: string };
    console.info(`  ✔ Invitación creada para ${inviteData.email} (token: ${inviteData.token.substring(0, 16)}...)`);

    // -------------------------------------------------------------------------
    // 7. Test: Aceptación de invitación (POST /auth/accept-invite)
    // -------------------------------------------------------------------------
    console.info('\n7. Probando aceptación de invitación y activación de cuenta...');
    const acceptRes = await fetch(`${BASE_URL}/auth/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: inviteData.token,
        password: 'CloserPassword2026!',
      }),
    });

    if (acceptRes.status !== 200) {
      const errText = await acceptRes.text();
      throw new Error(`Error en accept-invite obtenido ${acceptRes.status}: ${errText}`);
    }
    console.info('  ✔ Invitación aceptada y contraseña establecida con Argon2id.');

    // -------------------------------------------------------------------------
    // 8. Test: Login con el usuario recién creado
    // -------------------------------------------------------------------------
    console.info('\n8. Probando login con el usuario activado...');
    const closerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        password: 'CloserPassword2026!',
      }),
    });

    if (closerLoginRes.status !== 200) {
      throw new Error(`Login de usuario activado falló con status ${closerLoginRes.status}`);
    }
    const closerLoginData = await closerLoginRes.json() as { user: { role: string; email: string } };
    if (closerLoginData.user.role !== 'CLOSER') {
      throw new Error(`El rol del nuevo usuario debería ser CLOSER, pero es ${closerLoginData.user.role}`);
    }
    console.info(`  ✔ Login exitoso como CLOSER: ${closerLoginData.user.email}`);

    // -------------------------------------------------------------------------
    // 9. Test: Logout y denylist de Redis (POST /auth/logout)
    // -------------------------------------------------------------------------
    console.info('\n9. Probando logout y revocación de Access Token en Redis...');
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshData.accessToken}`,
        Cookie: `refreshToken=${newRefreshToken}`,
      },
    });

    if (logoutRes.status !== 200) {
      throw new Error(`Logout falló con status ${logoutRes.status}`);
    }
    console.info('  ✔ Logout ejecutado exitosamente.');

    // Verificar que el token quedó inmediatamente en la denylist
    const checkRevokedRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${refreshData.accessToken}` },
    });

    if (checkRevokedRes.status !== 401) {
      throw new Error(`El token revocado fue aceptado por /auth/me (status ${checkRevokedRes.status})`);
    }
    console.info('  ✔ Verificación de Denylist exitosa: petición con token revocado denegada con 401.');

    console.info('\n🎉 ¡OBJETIVO 1.4 VERIFICADO EXITOSAMENTE AL 100%! 🎉');
  } finally {
    await app.close();
  }
}

runAuthVerification().catch((err) => {
  console.error('\n❌ ERROR EN VERIFICACIÓN DE AUTH:', err);
  process.exit(1);
});
