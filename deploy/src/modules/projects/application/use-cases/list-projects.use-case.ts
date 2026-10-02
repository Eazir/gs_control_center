import { Inject, Injectable } from '@nestjs/common';
import { ProjectSummary, UserRole } from '@gs/contracts';
import {
  FindProjectsFilter,
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/ports/project-repository.port';
import { AuthPublicService } from '../../../auth';

export interface ListProjectsResult {
  projects: ProjectSummary[];
  stats: {
    total: number;
    active: number;
    draft: number;
    paused: number;
    archived: number;
  };
}

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(AuthPublicService)
    private readonly authPublicService: AuthPublicService
  ) {}

  async execute(currentUser: { id: string; role: UserRole }): Promise<ListProjectsResult> {
    const filter: FindProjectsFilter = {};

    // Control de acceso según jerarquía de roles de AGENTS.md
    if (currentUser.role === 'DIRECTOR') {
      filter.memberUserId = currentUser.id;
    } else if (currentUser.role === 'CLOSER' || currentUser.role === 'CLIENTE') {
      filter.memberUserId = currentUser.id;
    }
    // SUPER_ADMIN y ADMIN consultan sin filtro de usuario (ven todos los proyectos)

    const projects = await this.projectRepository.findAll(filter);

    // Resolver directores en batch respetando la frontera del módulo auth
    const directorIds = Array.from(
      new Set(
        projects
          .map((p) => p.directorId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    const directors = await this.authPublicService.getUsersByIds(directorIds);
    const directorMap = new Map(directors.map((d) => [d.id, d]));

    // Obtener conteo de miembros en batch para todos los proyectos
    const projectIds = projects.map((p) => p.id);
    const memberCountsMap = await this.projectRepository.countMembersBatch(projectIds);

    // Calcular estadísticas globales
    let active = 0;
    let draft = 0;
    let paused = 0;
    let archived = 0;

    // Fetch currentUser member records for all projects to determine roleInProject
    const currentUserMemberships = await Promise.all(
      projects.map((p) => this.projectRepository.findMember(p.id, currentUser.id))
    );
    const membershipMap = new Map(
      currentUserMemberships.filter((m) => m !== null).map((m) => [m!.projectId, m!.roleInProject])
    );

    const summaries: ProjectSummary[] = projects.map((project) => {
      if (project.status === 'ACTIVE') active++;
      else if (project.status === 'DRAFT') draft++;
      else if (project.status === 'PAUSED') paused++;
      else if (project.status === 'ARCHIVED') archived++;

      const director = project.directorId ? directorMap.get(project.directorId) : null;
      const membersCount = memberCountsMap.get(project.id) ?? 0;
      const roleInProject = membershipMap.get(project.id);

      return {
        ...project.toJSON(),
        directorName: director ? director.fullName : null,
        directorEmail: director ? director.email : null,
        membersCount,
        productsCount: project.products.length,
        currentUserRoleInProject: roleInProject,
      };
    });

    return {
      projects: summaries,
      stats: {
        total: projects.length,
        active,
        draft,
        paused,
        archived,
      },
    };
  }
}
