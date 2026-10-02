import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './check-policies.decorator';
import { JwtPayload } from '@gs/contracts';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(CaslAbilityFactory)
    private readonly caslAbilityFactory: CaslAbilityFactory
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getHandler()) || [];

    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Usuario no autenticado para evaluar políticas de autorización.'
      );
    }

    const ability = this.caslAbilityFactory.createForUser({
      id: user.sub,
      role: user.role,
      email: user.email,
    });

    const isAuthorized = policyHandlers.every((handler) => {
      if (typeof handler === 'function') {
        return handler(ability);
      }
      return handler.handle(ability);
    });

    if (!isAuthorized) {
      throw new ForbiddenException(
        'No tienes permisos suficientes para realizar esta acción (Regla de autorización CASL).'
      );
    }

    return true;
  }
}
