import { PrismaClient } from '@prisma/client';
import { subject } from '@casl/ability';
import { CaslAbilityFactory } from '../src/core/casl/casl-ability.factory';
import { Lead, Project, Invitation } from '../src/core/casl/subjects';
import { withRls } from '../src/core/database/with-rls';

async function runCaslAndRlsVerification() {
  console.info('🛡️  Iniciando verificación exhaustiva de CASL (5 Roles) y RLS PostgreSQL con withRls()...\n');

  // ===========================================================================
  // PARTE 1: Verificación de Matriz de Autorización CASL (Capa de Aplicación)
  // ===========================================================================
  console.info('=== PARTE 1: Verificación de Autorización CASL (5 Roles) ===');
  const caslFactory = new CaslAbilityFactory();

  const superAdminUser = { id: '00000000-0000-0000-0000-000000000001', role: 'SUPER_ADMIN' as const };
  const adminUser = { id: '00000000-0000-0000-0000-000000000002', role: 'ADMIN' as const };
  const directorUser = { id: '00000000-0000-0000-0000-000000000003', role: 'DIRECTOR' as const };
  const closerUser = { id: '00000000-0000-0000-0000-000000000004', role: 'CLOSER' as const };
  const clienteUser = { id: '00000000-0000-0000-0000-000000000005', role: 'CLIENTE' as const };

  const superAdminAbility = caslFactory.createForUser(superAdminUser);
  const adminAbility = caslFactory.createForUser(adminUser);
  const directorAbility = caslFactory.createForUser(directorUser);
  const closerAbility = caslFactory.createForUser(closerUser);
  const clienteAbility = caslFactory.createForUser(clienteUser);

  // 1. SUPER_ADMIN & ADMIN: Acceso total ('manage', 'all')
  if (!superAdminAbility.can('manage', 'all') || !adminAbility.can('manage', 'all')) {
    throw new Error('SUPER_ADMIN o ADMIN no tienen permiso manage all en CASL');
  }
  console.info('  ✔ 1. SUPER_ADMIN y ADMIN tienen capacidad "manage all" completa.');

  // 2. DIRECTOR: Gestión de leads, closers, invitaciones, lectura/edición de proyectos
  if (!directorAbility.can('manage', Lead) || !directorAbility.can('manage', 'Closer')) {
    throw new Error('DIRECTOR debería poder gestionar Lead y Closer');
  }
  if (!directorAbility.can('read', Project) || !directorAbility.can('update', Project)) {
    throw new Error('DIRECTOR debería poder leer y actualizar Project');
  }
  if (!directorAbility.can('create', Invitation)) {
    throw new Error('DIRECTOR debería poder crear Invitation');
  }
  console.info('  ✔ 2. DIRECTOR tiene permisos correctos de dirección de equipo.');

  // 3. CLOSER: Aislamiento estricto de leads y sin acceso a otros closers
  const ownLead = Object.assign(new Lead(), { closerId: closerUser.id, projectId: 'proj-1' });
  const otherCloserLead = Object.assign(new Lead(), { closerId: 'different-closer-id', projectId: 'proj-1' });

  if (!closerAbility.can('read', ownLead)) {
    throw new Error('CLOSER debería poder leer sus leads asignados');
  }
  if (!closerAbility.can('update', ownLead)) {
    throw new Error('CLOSER debería poder actualizar sus leads asignados');
  }
  if (closerAbility.can('read', otherCloserLead)) {
    throw new Error('VIOLACIÓN: CLOSER NO debe poder leer leads asignados a otros closers!');
  }
  if (closerAbility.can('update', otherCloserLead)) {
    throw new Error('VIOLACIÓN: CLOSER NO debe poder editar leads asignados a otros closers!');
  }
  if (closerAbility.can('read', 'Closer')) {
    throw new Error('VIOLACIÓN: CLOSER NO debe poder leer información operativa de otros closers!');
  }
  if (closerAbility.can('manage', Project)) {
    throw new Error('VIOLACIÓN: CLOSER NO debe poder administrar Project!');
  }
  console.info('  ✔ 3. CLOSER aislado: solo ve/edita leads propios, bloqueado de otros closers y configuración de proyectos.');

  // 4. CLIENTE: Solo lectura de Dashboard y Project; estrictamente PROHIBIDO ver leads o closers
  if (!clienteAbility.can('read', 'Dashboard') || !clienteAbility.can('read', Project)) {
    throw new Error('CLIENTE debería poder leer Dashboard y Project de su proyecto');
  }
  if (clienteAbility.can('read', Lead) || clienteAbility.can('read', ownLead)) {
    throw new Error('VIOLACIÓN CRÍTICA: CLIENTE jamás debe ver leads ni datos de contacto (PII)!');
  }
  if (clienteAbility.can('read', 'Closer')) {
    throw new Error('VIOLACIÓN CRÍTICA: CLIENTE jamás debe ver métricas operativas de closers!');
  }
  if (clienteAbility.can('create', Invitation) || clienteAbility.can('manage', 'all')) {
    throw new Error('CLIENTE no debe poder administrar invitaciones ni el sistema');
  }
  console.info('  ✔ 4. CLIENTE estrictamente confinado: dashboard y proyecto de solo lectura, cero leads ni closers.');

  // ===========================================================================
  // PARTE 2: Verificación de Políticas RLS en PostgreSQL con withRls()
  // ===========================================================================
  console.info('\n=== PARTE 2: Verificación de RLS en PostgreSQL con withRls() ===');
  const prisma = new PrismaClient();

  const closer1Id = '11111111-1111-1111-1111-111111111111';
  const closer2Id = '22222222-2222-2222-2222-222222222222';
  const adminTestId = '33333333-3333-3333-3333-333333333333';

  const projectAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  try {
    // Limpieza preventiva previa
    await prisma.$executeRawUnsafe(`DELETE FROM projects.project_users WHERE project_id IN ('${projectAId}', '${projectBId}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM projects.projects WHERE id IN ('${projectAId}', '${projectBId}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM auth.users WHERE id IN ('${closer1Id}', '${closer2Id}', '${adminTestId}')`);

    // 1. Crear usuarios de prueba directamente
    console.info('  Creando usuarios de prueba en auth.users...');
    await prisma.user.createMany({
      data: [
        {
          id: closer1Id,
          email: 'closer1_rls@growthsell.com',
          passwordHash: 'dummy_hash',
          fullName: 'Closer RLS Uno',
          role: 'CLOSER',
          status: 'ACTIVE',
        },
        {
          id: closer2Id,
          email: 'closer2_rls@growthsell.com',
          passwordHash: 'dummy_hash',
          fullName: 'Closer RLS Dos',
          role: 'CLOSER',
          status: 'ACTIVE',
        },
        {
          id: adminTestId,
          email: 'admin_rls@growthsell.com',
          passwordHash: 'dummy_hash',
          fullName: 'Admin RLS Test',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      ],
    });

    // 2. Crear proyectos de prueba
    console.info('  Creando proyectos de prueba en projects.projects...');
    await prisma.project.createMany({
      data: [
        {
          id: projectAId,
          name: 'Proyecto Alpha RLS',
          slug: 'proyecto-alpha-rls',
          status: 'ACTIVE',
        },
        {
          id: projectBId,
          name: 'Proyecto Beta RLS',
          slug: 'proyecto-beta-rls',
          status: 'ACTIVE',
        },
      ],
    });

    // 3. Asignar Closer 1 al Proyecto Alpha, y Closer 2 al Proyecto Beta
    console.info('  Asignando membresías en projects.project_users...');
    await prisma.projectUser.createMany({
      data: [
        {
          projectId: projectAId,
          userId: closer1Id,
          roleInProject: 'CLOSER',
        },
        {
          projectId: projectBId,
          userId: closer2Id,
          roleInProject: 'CLOSER',
        },
      ],
    });

    // 0. Diagnóstico de rol de conexión
    const userRoleInfo = await prisma.$queryRawUnsafe<any[]>(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`
    );
    console.info('  [DB Connection Role Info]:', userRoleInfo);

    // 4. Test RLS en projects.projects: Closer 1 solo debe ver Proyecto Alpha
    console.info('  Consultando proyectos con withRls como Closer 1...');
    const projectsAsCloser1 = await withRls(
      prisma,
      { userId: closer1Id, role: 'CLOSER' },
      async (tx) => {
        const debugSettings = await tx.$queryRawUnsafe<any[]>(
          `SELECT current_setting('app.current_user_id', true) as uid, current_setting('app.current_user_role', true) as role`
        );
        console.info('  [DEBUG settings]:', debugSettings);
        return tx.project.findMany({
          where: { id: { in: [projectAId, projectBId] } },
        });
      }
    );

    if (projectsAsCloser1.length !== 1 || projectsAsCloser1[0]?.id !== projectAId) {
      throw new Error(`Fallo RLS projects: Closer 1 esperaba solo Proyecto Alpha, pero obtuvo: ${JSON.stringify(projectsAsCloser1)}`);
    }
    console.info('  ✔ RLS Projects: Closer 1 solo puede consultar el Proyecto Alpha asignado.');

    // 5. Test RLS en projects.projects: Closer 2 solo debe ver Proyecto Beta
    console.info('  Consultando proyectos con withRls como Closer 2...');
    const projectsAsCloser2 = await withRls(
      prisma,
      { userId: closer2Id, role: 'CLOSER' },
      async (tx) => {
        return tx.project.findMany({
          where: { id: { in: [projectAId, projectBId] } },
        });
      }
    );

    if (projectsAsCloser2.length !== 1 || projectsAsCloser2[0]?.id !== projectBId) {
      throw new Error(`Fallo RLS projects: Closer 2 esperaba solo Proyecto Beta, pero obtuvo: ${JSON.stringify(projectsAsCloser2)}`);
    }
    console.info('  ✔ RLS Projects: Closer 2 solo puede consultar el Proyecto Beta asignado.');

    // 6. Test RLS en projects.projects: SUPER_ADMIN debe ver ambos proyectos
    console.info('  Consultando proyectos con withRls como SUPER_ADMIN...');
    const projectsAsAdmin = await withRls(
      prisma,
      { userId: adminTestId, role: 'SUPER_ADMIN' },
      async (tx) => {
        return tx.project.findMany({
          where: { id: { in: [projectAId, projectBId] } },
        });
      }
    );

    if (projectsAsAdmin.length !== 2) {
      throw new Error(`Fallo RLS projects: SUPER_ADMIN esperaba ver ambos proyectos, pero obtuvo ${projectsAsAdmin.length}`);
    }
    console.info('  ✔ RLS Projects: SUPER_ADMIN tiene visibilidad transversal sobre todos los proyectos.');

    // 7. Test RLS en auth.users: Closer 1 solo debe poder verse a sí mismo
    console.info('  Consultando auth.users con withRls como Closer 1...');
    const usersAsCloser1 = await withRls(
      prisma,
      { userId: closer1Id, role: 'CLOSER' },
      async (tx) => {
        return tx.user.findMany({
          where: { id: { in: [closer1Id, closer2Id, adminTestId] } },
        });
      }
    );

    if (usersAsCloser1.length !== 1 || usersAsCloser1[0]?.id !== closer1Id) {
      throw new Error(`Fallo RLS auth.users: Closer 1 esperaba verse solo a sí mismo, pero obtuvo: ${JSON.stringify(usersAsCloser1)}`);
    }
    console.info('  ✔ RLS Users: Closer 1 solo puede verse a sí mismo. Otros usuarios quedan blindados por RLS en Postgres.');

    // 8. Test RLS en auth.users: SUPER_ADMIN puede ver a todos los usuarios
    console.info('  Consultando auth.users con withRls como SUPER_ADMIN...');
    const usersAsAdmin = await withRls(
      prisma,
      { userId: adminTestId, role: 'SUPER_ADMIN' },
      async (tx) => {
        return tx.user.findMany({
          where: { id: { in: [closer1Id, closer2Id, adminTestId] } },
        });
      }
    );

    if (usersAsAdmin.length !== 3) {
      throw new Error(`Fallo RLS auth.users: SUPER_ADMIN esperaba 3 usuarios, pero obtuvo: ${usersAsAdmin.length}`);
    }
    console.info('  ✔ RLS Users: SUPER_ADMIN puede consultar usuarios para administración.');

  } finally {
    // Limpieza garantizada
    console.info('\nLimpiando entidades de prueba...');
    await prisma.$executeRawUnsafe(`DELETE FROM projects.project_users WHERE project_id IN ('${projectAId}', '${projectBId}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM projects.projects WHERE id IN ('${projectAId}', '${projectBId}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM auth.users WHERE id IN ('${closer1Id}', '${closer2Id}', '${adminTestId}')`);
    await prisma.$disconnect();
    console.info('✔ Limpieza completada exitosamente.');
  }

  console.info('\n🎉 ¡VERIFICACIÓN DE CASL Y RLS POSTGRESQL EXITOSA AL 100%!');
}

runCaslAndRlsVerification().catch((err) => {
  console.error('❌ Error fatal en verificación CASL/RLS:', err);
  process.exit(1);
});
