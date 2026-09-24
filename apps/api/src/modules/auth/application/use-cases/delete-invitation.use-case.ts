import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IInvitationRepository,
  INVITATION_REPOSITORY_TOKEN,
} from '../../domain/ports/invitation-repository.port';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';

@Injectable()
export class DeleteInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY_TOKEN)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(
    invitationId: string,
    requesterRole: UserRole
  ): Promise<{ success: boolean; message: string }> {
    if (requesterRole !== 'SUPER_ADMIN' && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para revocar invitaciones.');
    }

    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException('La invitación no existe.');
    }

    // Regla: Las invitaciones ya aceptadas no se pueden eliminar (auditoría histórica)
    if (invitation.acceptedAt) {
      throw new BadRequestException('No se puede eliminar una invitación que ya fue aceptada.');
    }

    // Eliminar la invitación
    await this.invitationRepository.delete(invitationId);

    // Si el usuario asociado está en estado INVITED, eliminar su pre-registro
    const user = await this.userRepository.findByEmail(invitation.email);
    if (user && user.status === 'INVITED') {
      await this.userRepository.delete(user.id);
    }

    return {
      success: true,
      message: 'Invitación y pre-registro de usuario eliminados exitosamente.',
    };
  }
}
