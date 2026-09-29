import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';

// Cargar variables de entorno desde apps/api/.env o raíz
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function listUsers() {
  console.log('\n📊 Consultando usuarios en la base de datos (schema: auth, tabla: users)...\n');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    console.log('⚠ No hay usuarios registrados en la base de datos.');
  } else {
    console.table(
      users.map((u) => ({
        ID: u.id.substring(0, 8) + '...',
        Email: u.email,
        Nombre: u.fullName,
        Rol: u.role,
        Estado: u.status,
        'Último Login': u.lastLoginAt ? u.lastLoginAt.toLocaleString() : 'Nunca',
        'Creado el': u.createdAt.toLocaleString(),
      }))
    );
  }
}

async function createInvite(email: string, role = 'CLOSER', fullName = 'Closer Demo') {
  console.log(`\n📨 Generando invitación para: ${email} (Rol: ${role})...`);

  // Buscar un usuario SUPER_ADMIN o ADMIN para asignarlo como invitedBy
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  });

  if (!admin) {
    throw new Error('No existe ningún usuario administrador para generar la invitación.');
  }

  // Generar token criptográfico crudo de 32 bytes (64 caracteres hex)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Asegurar o crear usuario en estado INVITED
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role: role as any,
      status: 'INVITED',
    },
    create: {
      email,
      fullName,
      role: role as any,
      status: 'INVITED',
      passwordHash: 'INVITATION_PENDING',
    },
  });

  // Crear registro de invitación (expira en 48 horas)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await prisma.invitation.create({
    data: {
      email,
      role: role as any,
      tokenHash,
      invitedById: admin.id,
      expiresAt,
    },
  });

  const testUrl = `http://localhost:3000/accept-invite?email=${encodeURIComponent(email)}&token=${rawToken}`;
  console.log('✅ Invitación generada exitosamente en la base de datos!');
  console.log(`\n🔗 Enlace de prueba listo para usar en tu navegador:\n`);
  console.log(`   ${testUrl}\n`);
}

async function main() {
  const action = process.argv[2] || 'list';

  try {
    if (action === 'list') {
      await listUsers();
    } else if (action === 'invite') {
      const email = process.argv[3] || 'closer.demo@growthsell.com';
      const role = process.argv[4] || 'CLOSER';
      const name = process.argv[5] || 'Closer Demo GrowthSell';
      await createInvite(email, role, name);
    } else {
      console.log('Uso:');
      console.log('  pnpm --filter api users:list');
      console.log('  pnpm --filter api users:invite [email] [rol] [nombre]');
    }
  } catch (err) {
    console.error('❌ Error al ejecutar operación:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
