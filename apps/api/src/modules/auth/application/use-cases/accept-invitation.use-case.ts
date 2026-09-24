import { Inject, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';
import {
  IInvitationRepository,
  INVITATION_REPOSITORY_TOKEN,
} from '../../domain/ports/invitation-repository.port';
import { PasswordService, TokenService } from '../../../../core/security';

import { InvalidInvitationError } from '../../domain/errors/auth.errors';

export interface AcceptInvitationUseCaseInput {
  token: string;
  password: string;
  fullName?: string | undefined;
}


@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(INVITATION_REPOSITORY_TOKEN)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  async execute(input: AcceptInvitationUseCaseInput): Promise<{ success: boolean; email: string }> {
    const tokenHash = this.tokenService.hashToken(input.token);
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);

    if (!invitation || !invitation.isValid()) {
      throw new InvalidInvitationError();
    }

    const user = await this.userRepository.findByEmail(invitation.email);
    if (!user) {
      throw new InvalidInvitationError('Usuario asociado a la invitación no existe.');
    }

    // Hashear la contraseña final con Argon2id
    const passwordHash = await this.passwordService.hash(input.password);

    await this.userRepository.update(user.id, {
      passwordHash,
      fullName: input.fullName || user.fullName,
      status: 'ACTIVE',
    });

    await this.invitationRepository.markAccepted(invitation.id);

    return {
      success: true,
      email: user.email,
    };
  }
}
