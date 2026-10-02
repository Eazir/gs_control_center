import { ProjectStatus, GoalsConfig, ProductItem, ProjectRole } from '@gs/contracts';
import { ProjectEntity } from '../entities/project.entity';

export interface CreateProjectData {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: ProjectStatus;
  directorId?: string | null;
  products?: ProductItem[];
  goalsConfig?: GoalsConfig;
  commissionConfig?: Record<string, unknown>;
  startDate?: Date | null;
  endDate?: Date | null;
  createdBy?: string | null;
}

export interface UpdateProjectData {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: ProjectStatus;
  directorId?: string | null;
  products?: ProductItem[];
  goalsConfig?: GoalsConfig;
  commissionConfig?: Record<string, unknown>;
  automationConfig?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface FindProjectsFilter {
  status?: ProjectStatus;
  directorId?: string;
  memberUserId?: string;
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  userId: string;
  roleInProject: ProjectRole;
  permissions: Record<string, unknown>;
  sckCodes: string[];
  assignedBy?: string | null;
  assignedAt: Date;
}

export interface AddMemberData {
  projectId: string;
  userId: string;
  roleInProject: ProjectRole;
  permissions?: Record<string, unknown>;
  sckCodes?: string[];
  assignedBy?: string | null;
}

export interface IProjectRepository {
  create(data: CreateProjectData): Promise<ProjectEntity>;
  findById(id: string): Promise<ProjectEntity | null>;
  findBySlug(slug: string): Promise<ProjectEntity | null>;
  findAll(filter?: FindProjectsFilter): Promise<ProjectEntity[]>;
  update(id: string, data: UpdateProjectData): Promise<ProjectEntity>;
  softDelete(id: string): Promise<void>;
  countActive(): Promise<number>;
  countTotal(): Promise<number>;

  // Miembros del equipo comercial
  addMember(data: AddMemberData): Promise<ProjectMemberRecord>;
  removeMember(projectId: string, userId: string): Promise<void>;
  updateMember(
    projectId: string,
    userId: string,
    roleInProject?: ProjectRole,
    permissions?: Record<string, unknown>,
    sckCodes?: string[]
  ): Promise<ProjectMemberRecord>;
  findMembers(projectId: string): Promise<ProjectMemberRecord[]>;
  findMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null>;
  countMembers(projectId: string): Promise<number>;
  countMembersBatch(projectIds: string[]): Promise<Map<string, number>>;
}

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

