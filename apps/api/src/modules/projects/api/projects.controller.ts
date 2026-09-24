import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AssignProjectMemberInput,
  CreateProductInput,
  CreateProjectInput,
  JwtPayload,
  ProjectMember,
  UpdateProductInput,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from '@gs/contracts';
import { JwtAuthGuard, CurrentUser } from '../../auth';
import { CreateProjectUseCase } from '../application/use-cases/create-project.use-case';
import { ListProjectsUseCase } from '../application/use-cases/list-projects.use-case';
import { GetProjectUseCase } from '../application/use-cases/get-project.use-case';
import { UpdateProjectUseCase } from '../application/use-cases/update-project.use-case';
import {
  AddProductUseCase,
  ListProjectProductsUseCase,
  RemoveProductUseCase,
  UpdateProductUseCase,
} from '../application/use-cases/manage-products.use-case';
import {
  AssignProjectMemberUseCase,
  ListProjectMembersUseCase,
  RemoveProjectMemberUseCase,
  UpdateProjectMemberUseCase,
} from '../application/use-cases/manage-members.use-case';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../domain/ports/project-repository.port';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    @Inject(CreateProjectUseCase)
    private readonly createProjectUseCase: CreateProjectUseCase,
    @Inject(ListProjectsUseCase)
    private readonly listProjectsUseCase: ListProjectsUseCase,
    @Inject(GetProjectUseCase)
    private readonly getProjectUseCase: GetProjectUseCase,
    @Inject(UpdateProjectUseCase)
    private readonly updateProjectUseCase: UpdateProjectUseCase,
    @Inject(AddProductUseCase)
    private readonly addProductUseCase: AddProductUseCase,
    @Inject(UpdateProductUseCase)
    private readonly updateProductUseCase: UpdateProductUseCase,
    @Inject(RemoveProductUseCase)
    private readonly removeProductUseCase: RemoveProductUseCase,
    @Inject(ListProjectProductsUseCase)
    private readonly listProjectProductsUseCase: ListProjectProductsUseCase,
    @Inject(ListProjectMembersUseCase)
    private readonly listProjectMembersUseCase: ListProjectMembersUseCase,
    @Inject(AssignProjectMemberUseCase)
    private readonly assignProjectMemberUseCase: AssignProjectMemberUseCase,
    @Inject(UpdateProjectMemberUseCase)
    private readonly updateProjectMemberUseCase: UpdateProjectMemberUseCase,
    @Inject(RemoveProjectMemberUseCase)
    private readonly removeProjectMemberUseCase: RemoveProjectMemberUseCase,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository
  ) {}


  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() input: CreateProjectInput,
    @CurrentUser() user: JwtPayload
  ) {
    // Solo SUPER_ADMIN y ADMIN pueden crear proyectos
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo los administradores pueden crear nuevos proyectos.'
      );
    }

    const project = await this.createProjectUseCase.execute(input, user.sub);
    return project.toJSON();
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.listProjectsUseCase.execute({
      id: user.sub,
      role: user.role,
    });
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() _user: JwtPayload
  ) {
    return this.getProjectUseCase.execute(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateProjectInput,
    @CurrentUser() user: JwtPayload
  ) {
    // Control de permisos para actualizar
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para modificar este proyecto.'
        );
      }
      // Regla de permisos: El director solo puede modificar ajustes del pipeline
      if (
        input.name !== undefined ||
        input.slug !== undefined ||
        input.description !== undefined ||
        input.status !== undefined ||
        input.directorId !== undefined ||
        input.goalsConfig !== undefined ||
        input.commissionConfig !== undefined ||
        input.automationConfig !== undefined
      ) {
        throw new ForbiddenException(
          'El director solo tiene autorización para modificar los ajustes del pipeline y el equipo del proyecto.'
        );
      }
    }

    const updated = await this.updateProjectUseCase.execute(id, input);
    return updated.toJSON();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload
  ) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo los administradores pueden archivar proyectos.'
      );
    }

    await this.projectRepository.softDelete(id);
  }

  // -------------------------------------------------------------
  // GESTIÓN DE CATÁLOGO DE PRODUCTOS (Fase 2.3)
  // -------------------------------------------------------------

  @Get(':id/products')
  async listProducts(
    @Param('id') id: string,
    @CurrentUser() _user: JwtPayload
  ) {
    return this.listProjectProductsUseCase.execute(id);
  }

  @Post(':id/products')
  @HttpCode(HttpStatus.CREATED)
  async addProduct(
    @Param('id') id: string,
    @Body() input: CreateProductInput,
    @CurrentUser() user: JwtPayload
  ) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para modificar el catálogo de este proyecto.'
        );
      }
    }

    return this.addProductUseCase.execute(id, input);
  }

  @Patch(':id/products/:productId')
  async updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() input: UpdateProductInput,
    @CurrentUser() user: JwtPayload
  ) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para modificar el catálogo de este proyecto.'
        );
      }
    }

    return this.updateProductUseCase.execute(id, productId, input);
  }

  @Delete(':id/products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload
  ) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para modificar el catálogo de este proyecto.'
        );
      }
    }

    await this.removeProductUseCase.execute(id, productId);
  }

  // -------------------------------------------------------------
  // GESTIÓN DE EQUIPO COMERCIAL (Fase 2.4)
  // -------------------------------------------------------------

  @Get(':id/members')
  async listMembers(
    @Param('id') id: string,
    @CurrentUser() _user: JwtPayload
  ): Promise<ProjectMember[]> {
    return this.listProjectMembersUseCase.execute(id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async assignMember(
    @Param('id') id: string,
    @Body() input: AssignProjectMemberInput,
    @CurrentUser() user: JwtPayload
  ): Promise<ProjectMember> {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para asignar miembros a este proyecto.'
        );
      }
    }

    return this.assignProjectMemberUseCase.execute(id, input, user.sub);
  }

  @Patch(':id/members/:userId')
  async updateMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @Body() input: UpdateProjectMemberInput,
    @CurrentUser() user: JwtPayload
  ): Promise<ProjectMember> {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para modificar miembros en este proyecto.'
        );
      }
    }

    return this.updateProjectMemberUseCase.execute(id, memberUserId, input);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @CurrentUser() user: JwtPayload
  ): Promise<void> {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const project = await this.projectRepository.findById(id);
      if (!project || project.directorId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para desvincular miembros de este proyecto.'
        );
      }
    }

    await this.removeProjectMemberUseCase.execute(id, memberUserId);
  }
}

