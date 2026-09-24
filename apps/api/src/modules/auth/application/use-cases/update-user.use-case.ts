import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';

export interface UpdateUserInput {
  targetUserId: string;
  fullName?: string | undefined;
  phone?: string | null | undefined;
  email?: string | undefined;
  role?: UserRole | undefined;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(input: UpdateUserInput) {
    if (input.requesterRole !== 'SUPER_ADMIN' && input.requesterRole !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para modificar usuarios.');
    }

    const targetUser = await this.userRepository.findById(input.targetUserId);
    if (!targetUser) {
      throw new NotFoundException('El usuario especificado no existe.');
    }

    // Regla no negociable: No está permitido modificar el rol de un usuario ya que generaría conflictos
    // con permisos CASL, asignaciones de proyectos, jerarquías comerciales y trazabilidad.
    if (input.role !== undefined && input.role !== targetUser.role) {
      throw new BadRequestException(
        'No está permitido modificar el rol de un usuario para preservar la integridad de permisos y asignaciones activas.'
      );
    }

    // Regla de jerarquía: Un ADMIN no puede modificar a un SUPER_ADMIN
    if (input.requesterRole === 'ADMIN') {
      if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') {
        throw new ForbiddenException('No tienes autorización para modificar usuarios administradores.');
      }
    }

    // Si se modifica el correo, validar que no esté en uso por otra cuenta
    if (input.email && input.email.toLowerCase() !== targetUser.email.toLowerCase()) {
      const existing = await this.userRepository.findByEmail(input.email.toLowerCase());
      if (existing && existing.id !== targetUser.id) {
        throw new ConflictException('El correo electrónico ya se encuentra registrado por otro usuario.');
      }
    }

    const updated = await this.userRepository.update(targetUser.id, {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ? input.email.toLowerCase() : undefined,
    });

    return {
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone ?? null,
        role: updated.role,
        status: updated.status,
        createdAt: updated.createdAt,
        lastLoginAt: updated.lastLoginAt ?? null,
      },
    };
  }
}
