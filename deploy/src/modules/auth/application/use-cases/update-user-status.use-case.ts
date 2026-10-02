import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';

export interface UpdateUserStatusInput {
  targetUserId: string;
  status: UserStatus;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(input: UpdateUserStatusInput): Promise<{ success: boolean; id: string; status: UserStatus }> {
    if (input.requesterRole !== 'SUPER_ADMIN' && input.requesterRole !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para modificar el estado de usuarios.');
    }

    const targetUser = await this.userRepository.findById(input.targetUserId);
    if (!targetUser) {
      throw new NotFoundException('El usuario especificado no existe.');
    }

    // Regla de seguridad: Un Super Admin no puede suspenderse a sí mismo
    if (targetUser.id === input.requesterId && input.status === 'SUSPENDED') {
      throw new BadRequestException('No puedes suspender tu propia cuenta de Super Administrador.');
    }

    // Regla de jerarquía: Un ADMIN no puede modificar a un SUPER_ADMIN ni a otro ADMIN
    if (input.requesterRole === 'ADMIN') {
      if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') {
        throw new ForbiddenException('No tienes autorización para modificar a usuarios administradores.');
      }
    }

    const updated = await this.userRepository.update(targetUser.id, {
      status: input.status,
    });

    return {
      success: true,
      id: updated.id,
      status: updated.status,
    };
  }
}
