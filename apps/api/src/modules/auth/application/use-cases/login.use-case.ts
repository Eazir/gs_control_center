import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';
import {
  ISessionRepository,
  SESSION_REPOSITORY_TOKEN,
} from '../../domain/ports/session-repository.port';
import { PasswordService, TokenService } from '../../../../core/security';

import {
  AccountLockedError,
  InvalidCredentialsError,
  UserInactiveError,
} from '../../domain/errors/auth.errors';

export interface LoginUseCaseInput {
  email: string;
  password: string;
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
}


export interface LoginUseCaseOutput {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  async execute(input: LoginUseCaseInput): Promise<LoginUseCaseOutput> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (user.isLocked()) {
      throw new AccountLockedError(user.lockedUntil!);
    }

    if (!user.isActive()) {
      throw new UserInactiveError();
    }

    const isPasswordValid = await this.passwordService.verify(
      user.passwordHash,
      input.password
    );

    if (!isPasswordValid) {
      const failedAttempts = user.failedAttempts + 1;
      let lockedUntil: Date | null = null;

      // Bloqueo temporal tras 5 intentos fallidos (15 min)
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.userRepository.update(user.id, {
        failedAttempts,
        lockedUntil,
      });

      if (lockedUntil) {
        throw new AccountLockedError(lockedUntil);
      }

      throw new InvalidCredentialsError();
    }

    // Reset de intentos y actualización de último acceso
    await this.userRepository.update(user.id, {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    // Generar Refresh Token y su hash SHA-256
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const session = await this.sessionRepository.create({
      userId: user.id,
      refreshHash: refreshTokenHash,
      userAgent: input.userAgent ?? null,
      ip: input.ipAddress ?? null,
      expiresAt,
    });

    // Generar JWT Access Token (15 min)
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 min en segundos
    };
  }
}
