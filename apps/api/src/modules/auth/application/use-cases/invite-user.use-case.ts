import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';
import {
  IInvitationRepository,
  INVITATION_REPOSITORY_TOKEN,
} from '../../domain/ports/invitation-repository.port';
import { TokenService, PasswordService } from '../../../../core/security';
import { CommunicationsService } from '../../../communications';

import { UserAlreadyExistsError } from '../../domain/errors/auth.errors';
import crypto from 'node:crypto';

export interface InviteUserUseCaseInput {
  email: string;
  role: UserRole;
  fullName: string;
  invitedById: string;
}

export interface InviteUserUseCaseOutput {
  invitationId: string;
  token: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class InviteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(INVITATION_REPOSITORY_TOKEN)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService
  ) {}

  async execute(input: InviteUserUseCaseInput): Promise<InviteUserUseCaseOutput> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new UserAlreadyExistsError();
    }

    // Token seguro aleatorio de invitación
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.tokenService.hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const invitation = await this.invitationRepository.create({
      email: input.email,
      role: input.role,
      tokenHash,
      invitedById: input.invitedById,
      expiresAt,
    });

    // Crear usuario pre-registrado en estado INVITED con hash temporal
    const tempPassword = crypto.randomBytes(24).toString('hex');
    const passwordHash = await this.passwordService.hash(tempPassword);

    await this.userRepository.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
      status: 'INVITED',
      createdBy: input.invitedById,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/accept-invite?email=${encodeURIComponent(input.email)}&token=${plainToken}`;

    await this.communicationsService.enqueueEmail({
      to: input.email,
      subject: 'Invitación a GrowthShell',
      template: 'USER_INVITATION',
      payload: { link: inviteLink, name: input.fullName }
    });

    return {
      invitationId: invitation.id,
      token: plainToken,
      email: invitation.email,
      role: invitation.role,
    };
  }
}
