import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateProjectInput, CreateProjectInputSchema } from '@gs/contracts';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/ports/project-repository.port';
import { ProjectEntity } from '../../domain/entities/project.entity';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository
  ) {}

  async execute(input: CreateProjectInput, createdById?: string): Promise<ProjectEntity> {
    const validated = CreateProjectInputSchema.parse(input);

    const slug = validated.slug && validated.slug.trim().length > 0
      ? validated.slug.toLowerCase().trim()
      : generateSlug(validated.name);

    const existing = await this.projectRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException(
        `Ya existe un proyecto con el identificador '${slug}'. Elige un nombre o slug diferente.`
      );
    }

    return this.projectRepository.create({
      name: validated.name.trim(),
      slug,
      description: validated.description?.trim() || null,
      status: validated.status ?? 'DRAFT',
      directorId: validated.directorId || null,
      goalsConfig: validated.goalsConfig ?? {
        monthlyTargetRevenue: 0,
        currency: 'USD',
        goals: [],
      },
      commissionConfig: validated.commissionConfig ?? {
        defaultCloserPercentage: 10,
        defaultDirectorPercentage: 3,
        defaultCompanyPercentage: 82,
        defaultExternalPercentage: 5,
        tiers: [],
      },
      startDate: validated.startDate ? new Date(validated.startDate) : null,
      endDate: validated.endDate ? new Date(validated.endDate) : null,
      createdBy: createdById || null,
    });
  }
}
