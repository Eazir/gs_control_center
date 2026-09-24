import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignProjectMemberInput,
  AssignProjectMemberInputSchema,
  ProjectMember,
  UpdateProjectMemberInput,
  UpdateProjectMemberInputSchema,
} from '@gs/contracts';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/ports/project-repository.port';
import { AuthPublicService } from '../../../auth';

@Injectable()
export class ListProjectMembersUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(AuthPublicService)
    private readonly authPublicService: AuthPublicService
  ) {}

  async execute(projectId: string): Promise<ProjectMember[]> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id ${projectId} no encontrado`);
    }

    const records = await this.projectRepository.findMembers(projectId);
    if (!records.length) {
      return [];
    }

    // Resolver en batch los perfiles de los usuarios respetando la frontera de Auth
    const userIds = records.map((r) => r.userId);
    const users = await this.authPublicService.getUsersByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return records.map((record) => {
      const user = userMap.get(record.userId);
      return {
        id: record.id,
        projectId: record.projectId,
        userId: record.userId,
        roleInProject: record.roleInProject,
        permissions: record.permissions,
        assignedBy: record.assignedBy,
        assignedAt: record.assignedAt,
        userName: user?.fullName ?? null,
        userEmail: user?.email ?? null,
        userRole: user?.role ?? null,
        userPhone: user?.phone ?? null,
      };
    });
  }
}

@Injectable()
export class AssignProjectMemberUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(AuthPublicService)
    private readonly authPublicService: AuthPublicService
  ) {}

  async execute(
    projectId: string,
    rawInput: AssignProjectMemberInput,
    assignedBy?: string | null
  ): Promise<ProjectMember> {
    const parseResult = AssignProjectMemberInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }
    const input = parseResult.data;

    // Verificar que el proyecto exista y esté activo
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id ${projectId} no encontrado`);
    }

    // Verificar que el usuario exista en Auth
    const user = await this.authPublicService.getUserById(input.userId);
    if (!user) {
      throw new NotFoundException(`Usuario con id ${input.userId} no encontrado`);
    }

    // Inferir el roleInProject basándose en el rol global del usuario
    let inferredRoleInProject: 'DIRECTOR' | 'CLOSER' | 'CLIENTE' = 'CLOSER';
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'DIRECTOR') {
      inferredRoleInProject = 'DIRECTOR';
    } else if (user.role === 'CLIENTE') {
      inferredRoleInProject = 'CLIENTE';
    }

    // Sobrescribir input.roleInProject con el valor inferido
    input.roleInProject = inferredRoleInProject;

    // Verificar si ya hay un director asignado
    if (inferredRoleInProject === 'DIRECTOR') {
      const existingMembers = await this.projectRepository.findMembers(projectId);
      if (existingMembers.some(m => m.roleInProject === 'DIRECTOR')) {
        throw new BadRequestException('Solo puede haber un director comercial por proyecto.');
      }
    }

    // Verificar si ya hay un cliente asignado
    if (inferredRoleInProject === 'CLIENTE') {
      const existingMembers = await this.projectRepository.findMembers(projectId);
      if (existingMembers.some(m => m.roleInProject === 'CLIENTE')) {
        throw new BadRequestException('Solo puede haber un cliente por proyecto.');
      }
    }

    const record = await this.projectRepository.addMember({
      projectId,
      userId: input.userId,
      roleInProject: input.roleInProject,
      permissions: input.permissions ?? {},
      assignedBy: assignedBy ?? null,
    });

    if (input.roleInProject === 'DIRECTOR') {
      await this.projectRepository.update(projectId, { directorId: input.userId });
    }

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      roleInProject: record.roleInProject,
      permissions: record.permissions,
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt,
      userName: user.fullName,
      userEmail: user.email,
      userRole: user.role,
      userPhone: user.phone ?? null,
    };
  }
}

@Injectable()
export class UpdateProjectMemberUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(AuthPublicService)
    private readonly authPublicService: AuthPublicService
  ) {}

  async execute(
    projectId: string,
    userId: string,
    rawInput: UpdateProjectMemberInput
  ): Promise<ProjectMember> {
    const parseResult = UpdateProjectMemberInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }
    const input = parseResult.data;

    const existing = await this.projectRepository.findMember(projectId, userId);
    if (!existing) {
      throw new NotFoundException(
        `El usuario no está asignado como miembro de este proyecto`
      );
    }

    if (input.roleInProject === 'DIRECTOR' && existing.roleInProject !== 'DIRECTOR') {
      const existingMembers = await this.projectRepository.findMembers(projectId);
      if (existingMembers.some(m => m.roleInProject === 'DIRECTOR' && m.userId !== userId)) {
        throw new BadRequestException('Solo puede haber un director comercial por proyecto.');
      }
    }

    const record = await this.projectRepository.updateMember(
      projectId,
      userId,
      input.roleInProject,
      input.permissions
    );

    if (input.roleInProject === 'DIRECTOR' && existing.roleInProject !== 'DIRECTOR') {
      await this.projectRepository.update(projectId, { directorId: userId });
    } else if (existing.roleInProject === 'DIRECTOR' && input.roleInProject !== 'DIRECTOR') {
      await this.projectRepository.update(projectId, { directorId: null });
    }

    const user = await this.authPublicService.getUserById(userId);

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      roleInProject: record.roleInProject,
      permissions: record.permissions,
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt,
      userName: user?.fullName ?? null,
      userEmail: user?.email ?? null,
      userRole: user?.role ?? null,
      userPhone: user?.phone ?? null,
    };
  }
}

@Injectable()
export class RemoveProjectMemberUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository
  ) {}

  async execute(projectId: string, userId: string): Promise<{ success: boolean }> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id ${projectId} no encontrado`);
    }

    const existing = await this.projectRepository.findMember(projectId, userId);
    if (existing?.roleInProject === 'DIRECTOR') {
      await this.projectRepository.update(projectId, { directorId: null });
    }

    await this.projectRepository.removeMember(projectId, userId);
    return { success: true };
  }
}
