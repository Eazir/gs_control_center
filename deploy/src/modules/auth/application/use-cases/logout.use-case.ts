import { Inject, Injectable } from '@nestjs/common';
import {
  ISessionRepository,
  SESSION_REPOSITORY_TOKEN,
} from '../../domain/ports/session-repository.port';
import { TokenService } from '../../../../core/security';
import { RedisService } from '../../../../core/redis';


export interface LogoutUseCaseInput {
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
}


@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(RedisService)
    private readonly redisService: RedisService
  ) {}

  async execute(input: LogoutUseCaseInput): Promise<void> {
    // 1. Invalidar el Access Token incluyéndolo en la denylist de Redis
    if (input.accessToken) {
      const payload = await this.tokenService.verifyAccessToken(input.accessToken);
      if (payload && payload.exp) {
        const ttlSeconds = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
        await this.redisService.blacklistToken(input.accessToken, ttlSeconds);

        // Revocar la sesión en DB
        if (payload.sessionId) {
          await this.sessionRepository.revoke(payload.sessionId);
        }
      }
    }

    // 2. Si se proveyó refresh token, revocar la sesión asociada
    if (input.refreshToken) {
      const refreshTokenHash = this.tokenService.hashToken(input.refreshToken);
      const session = await this.sessionRepository.findByRefreshHash(refreshTokenHash);
      if (session) {
        await this.sessionRepository.revoke(session.id);
      }
    }
  }
}
