import process from 'node:process';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.info('🔌 Conectando a PostgreSQL a través de PrismaClient...');
  await prisma.$connect();

  console.info('1. Probando inserción y lectura en schema "auth.users"...');
  const testEmail = `test_${Date.now()}@growthsell.com`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: 'Administrador de Prueba',
      passwordHash: 'dummy_hash_for_verification',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.info(`  ✔ Usuario creado: id=${user.id}, email=${user.email}, role=${user.role}`);

  console.info('2. Probando inserción y lectura en schema "projects.projects"...');
  const projectSlug = `test-project-${Date.now()}`;
  const project = await prisma.project.create({
    data: {
      name: 'Proyecto de Prueba',
      slug: projectSlug,
      directorId: user.id, // Referencia lógica UUID sin FK física
      status: 'ACTIVE',
    },
  });
  console.info(`  ✔ Proyecto creado: id=${project.id}, slug=${project.slug}, directorId=${project.directorId}`);

  console.info('3. Probando vinculación en "projects.project_users"...');
  const member = await prisma.projectUser.create({
    data: {
      projectId: project.id,
      userId: user.id, // Referencia lógica
      roleInProject: 'DIRECTOR',
    },
  });
  console.info(`  ✔ Miembro vinculado: id=${member.id}, role=${member.roleInProject}`);

  console.info('4. Limpiando datos de prueba...');
  await prisma.projectUser.delete({ where: { id: member.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.info('  ✔ Limpieza completada con éxito.');

  await prisma.$disconnect();
  console.info('🎉 Verificación de Prisma Multi-Schema (auth + projects) COMPLETADA CON ÉXITO.');
}

main().catch((err) => {
  console.error('❌ Error durante la verificación de Prisma:', err);
  process.exit(1);
});
