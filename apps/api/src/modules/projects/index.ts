/**
 * Interfaz pública del módulo Projects.
 * Único punto de importación permitido para otros módulos según AGENTS.md.
 */

export { ProjectsModule } from './projects.module';
export { ProjectEntity } from './domain/entities/project.entity';
export {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from './domain/ports/project-repository.port';
export { CreateProjectUseCase } from './application/use-cases/create-project.use-case';
export { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
export { GetProjectUseCase } from './application/use-cases/get-project.use-case';
export { UpdateProjectUseCase } from './application/use-cases/update-project.use-case';
export {
  AddProductUseCase,
  UpdateProductUseCase,
  RemoveProductUseCase,
  ListProjectProductsUseCase,
} from './application/use-cases/manage-products.use-case';
export {
  ListProjectMembersUseCase,
  AssignProjectMemberUseCase,
  UpdateProjectMemberUseCase,
  RemoveProjectMemberUseCase,
} from './application/use-cases/manage-members.use-case';

