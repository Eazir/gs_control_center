import { Inject, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';
import {
  ISessionRepository,
  SESSION_REPOSITORY_TOKEN,
} from '../../domain/ports/session-repository.port';
import { TokenService } from '../../../../core/security';

import {
  AccountLockedError,
  InvalidSessionError,
  UserInactiveError,
} from '../../domain/errors/auth.errors';

export interface RefreshTokenUseCaseInput {
  refreshToken: string;
}

export interface RefreshTokenUseCaseOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  async execute(input: RefreshTokenUseCaseInput): Promise<RefreshTokenUseCaseOutput> {
    if (!input.refreshToken) {
      throw new InvalidSessionError('Refresh token no provisto.');
    }

    const refreshTokenHash = this.tokenService.hashToken(input.refreshToken);
    const session = await this.sessionRepository.findByRefreshHash(refreshTokenHash);

    if (!session || !session.isValid()) {
      throw new InvalidSessionError('Sesión expirada o revocada.');
    }

    const user = await this.userRepository.findById(session.userId);

    if (!user) {
      throw new InvalidSessionError('Usuario no encontrado.');
    }

    if (user.isLocked()) {
      throw new AccountLockedError(user.lockedUntil!);
    }

    if (!user.isActive()) {
      throw new UserInactiveError();
    }

    // Rotación del Refresh Token (Single-Use Token)
    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = this.tokenService.hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await this.sessionRepository.rotateRefreshToken(
      session.id,
      newRefreshTokenHash,
      newExpiresAt
    );

    // Emisión de nuevo Access Token (15 min)
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }
}
