import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CommissionGroupSchema,
  CreateProductInputSchema,
  CreateProjectInputSchema,
  GoalsConfigSchema,
  ProductItem,
  ProjectRole,
} from '@gs/contracts';
import { ProjectEntity } from '../src/modules/projects/domain/entities/project.entity';
import {
  AddMemberData,
  CreateProjectData,
  FindProjectsFilter,
  IProjectRepository,
  ProjectMemberRecord,
  UpdateProjectData,
} from '../src/modules/projects/domain/ports/project-repository.port';
import { CreateProjectUseCase } from '../src/modules/projects/application/use-cases/create-project.use-case';
import { ListProjectsUseCase } from '../src/modules/projects/application/use-cases/list-projects.use-case';
import { GetProjectUseCase } from '../src/modules/projects/application/use-cases/get-project.use-case';
import { UpdateProjectUseCase } from '../src/modules/projects/application/use-cases/update-project.use-case';
import {
  AddProductUseCase,
  UpdateProductUseCase,
  RemoveProductUseCase,
  ListProjectProductsUseCase,
} from '../src/modules/projects/application/use-cases/manage-products.use-case';
import {
  AssignProjectMemberUseCase,
  ListProjectMembersUseCase,
  RemoveProjectMemberUseCase,
  UpdateProjectMemberUseCase,
} from '../src/modules/projects/application/use-cases/manage-members.use-case';
import { AuthPublicService, UserPublicProfile } from '../src/modules/auth';

/**
 * Mock in-memory repository para pruebas unitarias rápidas y puras de los casos de uso
 */
class InMemoryProjectRepository implements IProjectRepository {
  private projects: ProjectEntity[] = [];
  private members: ProjectMemberRecord[] = [];


  async create(data: CreateProjectData): Promise<ProjectEntity> {
    const entity = ProjectEntity.create({
      id: data.id ?? `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      status: data.status ?? 'DRAFT',
      directorId: data.directorId ?? null,
      products: data.products ?? [],
      goalsConfig: data.goalsConfig ?? { monthlyTargetRevenue: 0, currency: 'USD' },
      commissionConfig: data.commissionConfig ?? {},
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      createdBy: data.createdBy ?? null,
    });
    this.projects.push(entity);
    return entity;
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const found = this.projects.find((p) => p.id === id && !p.deletedAt);
    return found ?? null;
  }

  async findBySlug(slug: string): Promise<ProjectEntity | null> {
    const found = this.projects.find(
      (p) => p.slug.toLowerCase() === slug.toLowerCase() && !p.deletedAt
    );
    return found ?? null;
  }

  async findAll(filter?: FindProjectsFilter): Promise<ProjectEntity[]> {
    let result = this.projects.filter((p) => !p.deletedAt);
    if (filter?.status) {
      result = result.filter((p) => p.status === filter.status);
    }
    if (filter?.directorId) {
      result = result.filter((p) => p.directorId === filter.directorId);
    }
    return result;
  }

  async update(id: string, data: UpdateProjectData): Promise<ProjectEntity> {
    const entity = await this.findById(id);
    if (!entity) throw new Error('Not found');

    entity.updateDetails(data.name, data.description, data.slug);
    if (data.status) entity.updateStatus(data.status);
    if (data.goalsConfig) entity.updateGoals(data.goalsConfig);
    if (data.directorId !== undefined) entity.assignDirector(data.directorId);

    return entity;
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.findById(id);
    if (entity) {
      entity.updateStatus('ARCHIVED');
    }
  }

  async countActive(): Promise<number> {
    return this.projects.filter((p) => p.status === 'ACTIVE' && !p.deletedAt).length;
  }

  async countTotal(): Promise<number> {
    return this.projects.filter((p) => !p.deletedAt).length;
  }

  async addMember(data: AddMemberData): Promise<ProjectMemberRecord> {
    const existingIndex = this.members.findIndex(
      (m) => m.projectId === data.projectId && m.userId === data.userId
    );
    if (existingIndex >= 0) {
      this.members[existingIndex]!.roleInProject = data.roleInProject;
      if (data.permissions) this.members[existingIndex]!.permissions = data.permissions;
      return this.members[existingIndex]!;
    }
    const record: ProjectMemberRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectId: data.projectId,
      userId: data.userId,
      roleInProject: data.roleInProject,
      permissions: data.permissions ?? {},
      sckCodes: data.sckCodes ?? [],
      assignedBy: data.assignedBy ?? null,
      assignedAt: new Date(),
    };
    this.members.push(record);
    return record;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    this.members = this.members.filter(
      (m) => !(m.projectId === projectId && m.userId === userId)
    );
  }

  async updateMember(
    projectId: string,
    userId: string,
    roleInProject?: ProjectRole,
    permissions?: Record<string, unknown>,
    sckCodes?: string[]
  ): Promise<ProjectMemberRecord> {
    const member = this.members.find(
      (m) => m.projectId === projectId && m.userId === userId
    );
    if (!member) throw new Error('Member not found');
    if (roleInProject) member.roleInProject = roleInProject;
    if (permissions) member.permissions = permissions;
    if (sckCodes !== undefined) member.sckCodes = sckCodes;
    return member;
  }

  async findMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    return this.members.filter((m) => m.projectId === projectId);
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null> {
    return (
      this.members.find((m) => m.projectId === projectId && m.userId === userId) ?? null
    );
  }

  async countMembers(projectId: string): Promise<number> {
    return this.members.filter((m) => m.projectId === projectId).length;
  }

  async countMembersBatch(projectIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const pid of projectIds) {
      map.set(pid, this.members.filter((m) => m.projectId === pid).length);
    }
    return map;
  }
}


/**
 * Mock AuthPublicService para pruebas
 */
class MockAuthPublicService {
  private users: Map<string, UserPublicProfile> = new Map();

  setUser(user: UserPublicProfile) {
    this.users.set(user.id, user);
  }

  async getUserById(id: string): Promise<UserPublicProfile | null> {
    return this.users.get(id) ?? null;
  }

  async getUsersByIds(ids: string[]): Promise<UserPublicProfile[]> {
    return ids.map((id) => this.users.get(id)).filter((u): u is UserPublicProfile => !!u);
  }
}

async function runTests() {
  console.info('🚀 Iniciando suite de verificación de Fase 2.1 (Módulo Projects)...');

  // 1. Verificación de Entidad de Dominio
  console.info('\n1. Probando Entidad de Dominio ProjectEntity...');
  const project = ProjectEntity.create({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'GrowthSell Master',
    slug: 'growthsell-master',
    status: 'DRAFT',
  });

  if (project.status !== 'DRAFT') throw new Error('Status inicial incorrecto.');
  if (project.products.length !== 0) throw new Error('Products iniciales no vacíos.');
  if (Number(project.goalsConfig.monthlyTargetRevenue) !== 0) throw new Error('Meta inicial incorrecta.');

  project.updateStatus('ACTIVE');
  if (!project.isActive()) throw new Error('Fallo al activar proyecto.');

  project.updateGoals({ monthlyTargetRevenue: 75000, currency: 'USD' });
  if (Number(project.goalsConfig.monthlyTargetRevenue) !== 75000) throw new Error('Fallo al actualizar metas.');

  const newProd: ProductItem = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Ticket Platinum',
    price: 1500,
    installments: 3,
    currency: 'USD',
    isMarketing: false,
    active: true,
  };
  project.addProduct(newProd);
  const productsList: ProductItem[] = project.products;
  if (productsList.length !== 1 || productsList[0]?.price !== 1500) {
    throw new Error('Fallo al agregar producto a la entidad.');
  }
  console.info('  ✔ ProjectEntity validado con éxito.');

  // 2. Verificación de Contratos Zod
  console.info('\n2. Probando validaciones Zod de contratos de Projects...');
  const validCreation = CreateProjectInputSchema.safeParse({
    name: 'Escuela de Closers',
    description: 'Capacitación intensiva para vendedores de high ticket',
    goalsConfig: { monthlyTargetRevenue: 40000, currency: 'USD' },
  });
  if (!validCreation.success) throw new Error('Falló validación de input válido.');

  const invalidSlug = CreateProjectInputSchema.safeParse({
    name: 'Escuela de Closers',
    slug: 'Slug Invalido CON ESPACIOS!',
  });
  if (invalidSlug.success) throw new Error('Aceptó erróneamente un slug con formato inválido.');

  const invalidGoals = GoalsConfigSchema.safeParse({
    monthlyTargetRevenue: -500,
  });
  if (invalidGoals.success) throw new Error('Aceptó erróneamente una meta con número negativo.');

  // 2.1. Validación estricta de CommissionGroupSchema (Fase 3)
  const validGroup = CommissionGroupSchema.safeParse({
    id: 'group-1',
    name: 'Grupo Premium',
    productIds: ['p1', 'p2'],
    basePercentages: { teamTotal: 90, company: 70, director: 5, closer: 15, external: 5 },
  });
  if (!validGroup.success) throw new Error('Falló la validación de un grupo de comisión válido.');

  const invalidGroup = CommissionGroupSchema.safeParse({
    id: 'group-2',
    name: 'Grupo Roto',
    productIds: ['p3'],
    basePercentages: { teamTotal: 90, company: 70, director: 5, closer: 20, external: 5 },
  });
  if (invalidGroup.success)
    throw new Error('Aceptó erróneamente un grupo cuya suma company+director+closer (95) supera teamTotal (90).');

  const invalidInstallments = CreateProductInputSchema.safeParse({
    name: 'Curso Mal',
    price: 100,
    installments: 0,
  });
  if (invalidInstallments.success) throw new Error('Aceptó erróneamente un producto con 0 cuotas.');
  console.info('  ✔ Contratos Zod y validaciones probadas correctamente.');

  // 3. Verificación de Casos de Uso
  console.info('\n3. Probando Casos de Uso (Create, List, Get, Update)...');
  const repo = new InMemoryProjectRepository();
  const authMock = new MockAuthPublicService() as unknown as AuthPublicService;

  const directorId = 'd1111111-1111-1111-1111-111111111111';
  (authMock as unknown as MockAuthPublicService).setUser({
    id: directorId,
    email: 'director@growthsell.com',
    fullName: 'Carlos Director Comercial',
    role: 'DIRECTOR',
    isActive: true,
  });

  const createUseCase = new CreateProjectUseCase(repo);
  const listUseCase = new ListProjectsUseCase(repo, authMock);
  const getUseCase = new GetProjectUseCase(repo, authMock);
  const updateUseCase = new UpdateProjectUseCase(repo, authMock);

  // A. CreateProjectUseCase
  const createdProject = await createUseCase.execute(
    {
      name: 'High Ticket Sales Academy',
      description: 'Programa oficial de formación',
      directorId,
      goalsConfig: { monthlyTargetRevenue: 50000, currency: 'USD' },
    },
    'admin-123'
  );

  if (createdProject.slug !== 'high-ticket-sales-academy') {
    throw new Error(`Slug autogenerado incorrecto: ${createdProject.slug}`);
  }
  console.info(`  ✔ Proyecto creado con slug: ${createdProject.slug}`);

  // B. Validación de duplicados
  let duplicateCaught = false;
  try {
    await createUseCase.execute({
      name: 'High Ticket Sales Academy',
    });
  } catch (err) {
    if (err instanceof ConflictException) {
      duplicateCaught = true;
    }
  }
  if (!duplicateCaught) throw new Error('No previno creación de slug duplicado.');
  console.info('  ✔ Detección de slug duplicado prevenida con ConflictException.');

  // C. ListProjectsUseCase
  const listResult = await listUseCase.execute({
    id: 'admin-123',
    role: 'SUPER_ADMIN',
  });

  if (listResult.projects.length !== 1) throw new Error('Listado no contiene el proyecto creado.');
  if (listResult.projects[0]?.directorName !== 'Carlos Director Comercial') {
    throw new Error(`Director no resuelto correctamente: ${listResult.projects[0]?.directorName}`);
  }
  if (listResult.stats.total !== 1 || listResult.stats.draft !== 1) {
    throw new Error('Estadísticas globales de proyectos calculadas erróneamente.');
  }
  console.info('  ✔ ListProjectsUseCase validó permisos, resolución de directores y estadísticas.');

  // D. GetProjectUseCase
  const fetchedBySlug = await getUseCase.execute('high-ticket-sales-academy');
  if (fetchedBySlug.id !== createdProject.id) throw new Error('Fallo al buscar por slug.');

  let notFoundCaught = false;
  try {
    await getUseCase.execute('proyecto-inexistente');
  } catch (err) {
    if (err instanceof NotFoundException) notFoundCaught = true;
  }
  if (!notFoundCaught) throw new Error('No lanzó NotFoundException para proyecto desconocido.');
  console.info('  ✔ GetProjectUseCase probado por slug y error 404.');

  // E. UpdateProjectUseCase
  const updated = await updateUseCase.execute(createdProject.id, {
    status: 'ACTIVE',
    goalsConfig: { monthlyTargetRevenue: 80000, currency: 'USD' },
  });
  if (updated.status !== 'ACTIVE') throw new Error('Estado no actualizado a ACTIVE.');
  if (Number(updated.goalsConfig.monthlyTargetRevenue) !== 80000) throw new Error('Meta no actualizada a 80000.');
  console.info('  ✔ UpdateProjectUseCase actualizó estado y metas exitosamente.');

  // 4. Verificación de Casos de Uso de Catálogo de Productos (Fase 2.3)
  console.info('\n4. Probando Casos de Uso de Catálogo de Productos...');
  const addProductUseCase = new AddProductUseCase(repo);
  const updateProductUseCase = new UpdateProductUseCase(repo);
  const removeProductUseCase = new RemoveProductUseCase(repo);
  const listProductsUseCase = new ListProjectProductsUseCase(repo);

  // A. AddProductUseCase
  const prod1 = await addProductUseCase.execute(createdProject.id, {
    name: 'Ticket General',
    sku: 'TKT-GEN-01',
    price: 997,
    currency: 'USD',
  });
  if (prod1.name !== 'Ticket General' || prod1.price !== 997) {
    throw new Error('Fallo al agregar primer producto.');
  }

  const prod2 = await addProductUseCase.execute(createdProject.id, {
    name: 'Pase VIP',
    price: 2497,
    currency: 'USD',
  });
  if (prod2.price !== 2497) throw new Error('Fallo al agregar segundo producto.');
  console.info('  ✔ AddProductUseCase agregó 2 productos al catálogo con éxito.');

  // B. ListProjectProductsUseCase
  const catalog = await listProductsUseCase.execute(createdProject.id);
  if (catalog.length !== 2) throw new Error('Catálogo no contiene los 2 productos agregados.');
  console.info(`  ✔ ListProjectProductsUseCase retornó catálogo con ${catalog.length} productos.`);

  // C. UpdateProductUseCase
  const updatedProd1 = await updateProductUseCase.execute(createdProject.id, prod1.id, {
    price: 1197,
  });
  if (updatedProd1.price !== 1197) throw new Error('Fallo al actualizar precio del producto.');
  console.info('  ✔ UpdateProductUseCase actualizó precio del producto a $1,197 USD.');

  // D. RemoveProductUseCase
  await removeProductUseCase.execute(createdProject.id, prod2.id);
  const catalogAfterDelete = await listProductsUseCase.execute(createdProject.id);
  if (catalogAfterDelete.length !== 1 || catalogAfterDelete[0]?.id !== prod1.id) {
    throw new Error('Fallo al remover producto del catálogo.');
  }
  console.info('  ✔ RemoveProductUseCase eliminó producto del catálogo.');

  // 5. Probando Casos de Uso de Miembros de Equipo (Fase 2.4)
  console.info('\n5. Probando Casos de Uso de Asignación de Miembros (Fase 2.4)...');
  const closerUser: UserPublicProfile = {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    fullName: 'Carlos Closer',
    email: 'carlos@growthsell.com',
    role: 'CLOSER',
    isActive: true,
    phone: '+573001234567',
  };
  const clientUser: UserPublicProfile = {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    fullName: 'Diana Cliente',
    email: 'diana@growthsell.com',
    role: 'CLIENTE',
    isActive: true,
    phone: '+573109876543',
  };
  (authMock as unknown as MockAuthPublicService).setUser(closerUser);
  (authMock as unknown as MockAuthPublicService).setUser(clientUser);

  const assignMemberUseCase = new AssignProjectMemberUseCase(repo, authMock);
  const listMembersUseCase = new ListProjectMembersUseCase(repo, authMock);
  const updateMemberUseCase = new UpdateProjectMemberUseCase(repo, authMock);
  const removeMemberUseCase = new RemoveProjectMemberUseCase(repo);

  // A. AssignProjectMemberUseCase
  const mem1 = await assignMemberUseCase.execute(createdProject.id, {
    userId: closerUser.id,
    roleInProject: 'CLOSER',
  });
  if (mem1.roleInProject !== 'CLOSER' || mem1.userName !== 'Carlos Closer' || mem1.userPhone !== '+573001234567') {
    throw new Error('Fallo al asignar closer al proyecto.');
  }

  const mem2 = await assignMemberUseCase.execute(createdProject.id, {
    userId: clientUser.id,
    roleInProject: 'CLIENTE',
  });
  if (mem2.roleInProject !== 'CLIENTE' || mem2.userName !== 'Diana Cliente') {
    throw new Error('Fallo al asignar cliente al proyecto.');
  }
  console.info('  ✔ AssignProjectMemberUseCase asignó 2 miembros correctamente con perfiles enriquecidos.');

  // B. ListProjectMembersUseCase
  const members = await listMembersUseCase.execute(createdProject.id);
  if (members.length !== 2) throw new Error('ListProjectMembersUseCase no retornó los 2 miembros.');
  console.info(`  ✔ ListProjectMembersUseCase retornó ${members.length} miembros vinculados.`);

  // C. UpdateProjectMemberUseCase
  const updatedMem1 = await updateMemberUseCase.execute(createdProject.id, closerUser.id, {
    roleInProject: 'DIRECTOR',
  });
  if (updatedMem1.roleInProject !== 'DIRECTOR') throw new Error('Fallo al actualizar rol del miembro.');
  console.info('  ✔ UpdateProjectMemberUseCase actualizó rol de miembro a DIRECTOR.');

  // D. Batch members count en ListProjectsUseCase
  const projectsAfterMembers = await listUseCase.execute({
    id: 'admin-1',
    role: 'SUPER_ADMIN',
  });
  const projSummary = projectsAfterMembers.projects.find((p) => p.id === createdProject.id);
  if (projSummary?.membersCount !== 2) {
    throw new Error(`Conteo batch de miembros esperado 2, obtenido: ${projSummary?.membersCount}`);
  }
  console.info('  ✔ ListProjectsUseCase calculó membersCount en batch exactamente en 2.');

  // E. RemoveProjectMemberUseCase
  await removeMemberUseCase.execute(createdProject.id, clientUser.id);
  const membersAfterDelete = await listMembersUseCase.execute(createdProject.id);
  if (membersAfterDelete.length !== 1 || membersAfterDelete[0]?.userId !== closerUser.id) {
    throw new Error('Fallo al desvincular miembro del proyecto.');
  }
  console.info('  ✔ RemoveProjectMemberUseCase desvinculó miembro del proyecto.');

  console.info('\n✅ ¡TODAS LAS PRUEBAS DE LA FASE 2 (2.1, 2.3 y 2.4) PASARON AL 100% SIN ERRORES!');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS DE FASE 2:', err);
  process.exit(1);
});

