import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';
import { TokenService } from '../../../../core/security';
import { RedisService } from '../../../../core/redis';

import { JwtPayload } from '@gs/contracts';

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(RedisService)
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido (Bearer token).');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Token de acceso inválido.');
    }

    // 1. Validar contra la denylist en Redis
    const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token de acceso revocado.');
    }

    // 2. Verificar firma y expiración del JWT
    const payload = await this.tokenService.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Token de acceso inválido o expirado.');
    }

    request.user = payload;
    return true;
  }
}
