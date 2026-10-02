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
import { TokenService } from '../../../../core/security';
import { CommunicationsService } from '../../../communications';
import crypto from 'node:crypto';

export interface ResendInvitationOutput {
  invitationId: string;
  token: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
}

@Injectable()
export class ResendInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY_TOKEN)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService
  ) {}

  async execute(
    invitationId: string,
    currentUserRole: UserRole
  ): Promise<ResendInvitationOutput> {
    if (currentUserRole !== 'SUPER_ADMIN' && currentUserRole !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permisos para renovar o reenviar invitaciones.'
      );
    }

    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException('La invitación solicitada no existe.');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException(
        'Esta invitación ya fue aceptada y la cuenta se encuentra activa.'
      );
    }

    // Generar nuevo token seguro y renovar expiración por 7 días
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.tokenService.hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.invitationRepository.updateToken(
      invitation.id,
      tokenHash,
      expiresAt
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/accept-invite?email=${encodeURIComponent(updated.email)}&token=${plainToken}`;

    await this.communicationsService.enqueueEmail({
      to: updated.email,
      subject: 'Recordatorio: Invitación a GrowthShell',
      template: 'USER_INVITATION',
      payload: { link: inviteLink, name: 'Usuario' } // name could be passed or omitted if not known
    });

    return {
      invitationId: updated.id,
      token: plainToken,
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt,
    };
  }
}
