import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectSummary } from '@gs/contracts';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/ports/project-repository.port';
import { AuthPublicService } from '../../../auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GetProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(AuthPublicService)
    private readonly authPublicService: AuthPublicService
  ) {}

  async execute(idOrSlug: string): Promise<ProjectSummary> {
    const isUuid = UUID_REGEX.test(idOrSlug);

    const project = isUuid
      ? await this.projectRepository.findById(idOrSlug)
      : await this.projectRepository.findBySlug(idOrSlug);

    if (!project) {
      throw new NotFoundException(`El proyecto '${idOrSlug}' no existe o fue archivado.`);
    }

    let directorName: string | null = null;
    let directorEmail: string | null = null;

    if (project.directorId) {
      const director = await this.authPublicService.getUserById(project.directorId);
      if (director) {
        directorName = director.fullName;
        directorEmail = director.email;
      }
    }

    const members = await this.projectRepository.findMembers(project.id);

    return {
      ...project.toJSON(),
      directorName,
      directorEmail,
      membersCount: members.length,
      productsCount: project.products.length,
    };
  }
}
