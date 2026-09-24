import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateProjectInput, UpdateProjectInputSchema } from '@gs/contracts';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
  UpdateProjectData,
} from '../../domain/ports/project-repository.port';
import { ProjectEntity } from '../../domain/entities/project.entity';
import { AuthPublicService } from '../../../auth';

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(AuthPublicService)
    private readonly authPublicService: AuthPublicService
  ) {}

  async execute(id: string, input: UpdateProjectInput): Promise<ProjectEntity> {
    const validated = UpdateProjectInputSchema.parse(input);

    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Proyecto con id '${id}' no encontrado.`);
    }

    if (validated.slug && validated.slug.toLowerCase() !== project.slug) {
      const existing = await this.projectRepository.findBySlug(validated.slug.toLowerCase());
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Ya existe otro proyecto con el slug '${validated.slug}'.`
        );
      }
    }

    if (validated.directorId) {
      const director = await this.authPublicService.getUserById(validated.directorId);
      if (!director) {
        throw new BadRequestException(
          `El usuario director con id '${validated.directorId}' no existe.`
        );
      }
    }

    const updateData: UpdateProjectData = {};
    if (validated.name !== undefined) updateData.name = validated.name.trim();
    if (validated.slug !== undefined) updateData.slug = validated.slug.toLowerCase().trim();
    if (validated.description !== undefined) {
      updateData.description = validated.description?.trim() || null;
    }
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.directorId !== undefined) updateData.directorId = validated.directorId;
    if (validated.goalsConfig !== undefined) updateData.goalsConfig = validated.goalsConfig;
    if (validated.commissionConfig !== undefined) updateData.commissionConfig = validated.commissionConfig;
    if (validated.automationConfig !== undefined) updateData.automationConfig = validated.automationConfig;
    if (validated.settings !== undefined) updateData.settings = validated.settings;
    if (validated.startDate !== undefined) {
      updateData.startDate = validated.startDate ? new Date(validated.startDate) : null;
    }
    if (validated.endDate !== undefined) {
      updateData.endDate = validated.endDate ? new Date(validated.endDate) : null;
    }

    return this.projectRepository.update(id, updateData);
  }
}
