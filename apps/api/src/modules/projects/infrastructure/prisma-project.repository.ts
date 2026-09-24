import { Inject, Injectable } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import { PrismaService } from '../../../core/database';
import {
  AddMemberData,
  CreateProjectData,
  FindProjectsFilter,
  IProjectRepository,
  ProjectMemberRecord,
  UpdateProjectData,
} from '../domain/ports/project-repository.port';
import { ProjectEntity } from '../domain/entities/project.entity';
import { GoalsConfig, ProductItem, ProjectRole, ProjectStatus } from '@gs/contracts';


@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateProjectData): Promise<ProjectEntity> {
    const createInput: Prisma.ProjectCreateInput = {
      name: data.name,
      slug: data.slug.toLowerCase(),
      description: data.description ?? null,
      status: data.status ?? 'DRAFT',
      directorId: data.directorId ?? null,
      products: (data.products ?? []) as unknown as Prisma.InputJsonValue,
      goalsConfig: (data.goalsConfig ?? {
        monthlyTargetRevenue: 0,
        currency: 'USD',
      }) as unknown as Prisma.InputJsonValue,
      commissionConfig: (data.commissionConfig ?? {}) as unknown as Prisma.InputJsonValue,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      createdBy: data.createdBy ?? null,
    };

    if (data.id) {
      createInput.id = data.id;
    }

    const record = await this.prisma.project.create({
      data: createInput,
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const record = await this.prisma.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findBySlug(slug: string): Promise<ProjectEntity | null> {
    const record = await this.prisma.project.findFirst({
      where: {
        slug: slug.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findAll(filter?: FindProjectsFilter): Promise<ProjectEntity[]> {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
    };

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.directorId) {
      where.directorId = filter.directorId;
    }

    if (filter?.memberUserId) {
      where.OR = [
        { directorId: filter.memberUserId },
        {
          members: {
            some: {
              userId: filter.memberUserId,
            },
          },
        },
      ];
    }

    const records = await this.prisma.project.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return records.map((record) => this.toDomain(record));
  }

  async update(id: string, data: UpdateProjectData): Promise<ProjectEntity> {
    const updateData: Prisma.ProjectUpdateInput = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug.toLowerCase();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.directorId !== undefined) updateData.directorId = data.directorId;
    if (data.products !== undefined) {
      updateData.products = data.products as unknown as Prisma.InputJsonValue;
    }
    if (data.goalsConfig !== undefined) {
      updateData.goalsConfig = data.goalsConfig as unknown as Prisma.InputJsonValue;
    }
    if (data.commissionConfig !== undefined) {
      updateData.commissionConfig = data.commissionConfig as unknown as Prisma.InputJsonValue;
    }
    if (data.automationConfig !== undefined) {
      updateData.automationConfig = data.automationConfig as unknown as Prisma.InputJsonValue;
    }
    if (data.settings !== undefined) {
      updateData.settings = data.settings as unknown as Prisma.InputJsonValue;
    }
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    const record = await this.prisma.project.update({
      where: { id },
      data: updateData,
    });

    return this.toDomain(record);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.project.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });
  }

  async countActive(): Promise<number> {
    return this.prisma.project.count({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
  }

  async countTotal(): Promise<number> {
    return this.prisma.project.count({
      where: {
        deletedAt: null,
      },
    });
  }

  async addMember(data: AddMemberData): Promise<ProjectMemberRecord> {
    const updateData: Prisma.ProjectUserUpdateInput = {
      roleInProject: data.roleInProject,
    };
    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions as unknown as Prisma.InputJsonValue;
    }

    const record = await this.prisma.projectUser.upsert({
      where: {
        projectId_userId: {
          projectId: data.projectId,
          userId: data.userId,
        },
      },
      create: {
        projectId: data.projectId,
        userId: data.userId,
        roleInProject: data.roleInProject,
        permissions: (data.permissions ?? {}) as unknown as Prisma.InputJsonValue,
        assignedBy: data.assignedBy ?? null,
      },
      update: updateData,
    });

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      roleInProject: record.roleInProject as ProjectRole,
      permissions: (record.permissions as Record<string, unknown>) ?? {},
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt,
    };
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectUser.deleteMany({
      where: {
        projectId,
        userId,
      },
    });
  }

  async updateMember(
    projectId: string,
    userId: string,
    roleInProject?: ProjectRole,
    permissions?: Record<string, unknown>
  ): Promise<ProjectMemberRecord> {
    const updateData: Prisma.ProjectUserUpdateInput = {};
    if (roleInProject !== undefined) updateData.roleInProject = roleInProject;
    if (permissions !== undefined) {
      updateData.permissions = permissions as unknown as Prisma.InputJsonValue;
    }

    const record = await this.prisma.projectUser.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: updateData,
    });

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      roleInProject: record.roleInProject as ProjectRole,
      permissions: (record.permissions as Record<string, unknown>) ?? {},
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt,
    };
  }

  async findMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    const records = await this.prisma.projectUser.findMany({
      where: { projectId },
      orderBy: { assignedAt: 'asc' },
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      roleInProject: record.roleInProject as ProjectRole,
      permissions: (record.permissions as Record<string, unknown>) ?? {},
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt,
    }));
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null> {
    const record = await this.prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      roleInProject: record.roleInProject as ProjectRole,
      permissions: (record.permissions as Record<string, unknown>) ?? {},
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt,
    };
  }

  async countMembers(projectId: string): Promise<number> {
    return this.prisma.projectUser.count({
      where: { projectId },
    });
  }

  async countMembersBatch(projectIds: string[]): Promise<Map<string, number>> {
    if (!projectIds.length) return new Map();

    const counts = await this.prisma.projectUser.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
      },
      _count: {
        id: true,
      },
    });

    const map = new Map<string, number>();
    for (const c of counts) {
      map.set(c.projectId, c._count.id);
    }
    return map;
  }


  private toDomain(record: Project): ProjectEntity {
    return ProjectEntity.fromPersistence({
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      status: record.status as ProjectStatus,
      directorId: record.directorId,
      products: (record.products as unknown as ProductItem[]) ?? [],
      goalsConfig:
        (record.goalsConfig as unknown as GoalsConfig) ?? {
          monthlyTargetRevenue: 0,
          currency: 'USD',
        },
      commissionConfig:
        (record.commissionConfig as unknown as Record<string, unknown>) ?? {},
      automationConfig:
        (record.automationConfig as unknown as Record<string, unknown>) ?? null,
      settings: (record.settings as unknown as Record<string, unknown>) ?? null,
      startDate: record.startDate,
      endDate: record.endDate,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
