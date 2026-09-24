import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ProjectsController } from './api/projects.controller';
import { PROJECT_REPOSITORY } from './domain/ports/project-repository.port';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository';
import { CreateProjectUseCase } from './application/use-cases/create-project.use-case';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { GetProjectUseCase } from './application/use-cases/get-project.use-case';
import { UpdateProjectUseCase } from './application/use-cases/update-project.use-case';
import {
  AddProductUseCase,
  ListProjectProductsUseCase,
  RemoveProductUseCase,
  UpdateProductUseCase,
} from './application/use-cases/manage-products.use-case';
import {
  AssignProjectMemberUseCase,
  ListProjectMembersUseCase,
  RemoveProjectMemberUseCase,
  UpdateProjectMemberUseCase,
} from './application/use-cases/manage-members.use-case';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [
    {
      provide: PROJECT_REPOSITORY,
      useClass: PrismaProjectRepository,
    },
    CreateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    UpdateProjectUseCase,
    AddProductUseCase,
    UpdateProductUseCase,
    RemoveProductUseCase,
    ListProjectProductsUseCase,
    ListProjectMembersUseCase,
    AssignProjectMemberUseCase,
    UpdateProjectMemberUseCase,
    RemoveProjectMemberUseCase,
  ],
  exports: [
    PROJECT_REPOSITORY,
    CreateProjectUseCase,
    GetProjectUseCase,
    ListProjectsUseCase,
    AddProductUseCase,
    UpdateProductUseCase,
    RemoveProductUseCase,
    ListProjectProductsUseCase,
    ListProjectMembersUseCase,
    AssignProjectMemberUseCase,
    UpdateProjectMemberUseCase,
    RemoveProjectMemberUseCase,
  ],
})
export class ProjectsModule {}
