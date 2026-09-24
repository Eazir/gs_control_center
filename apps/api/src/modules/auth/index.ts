/**
 * Interfaz pública del módulo Auth.
 * Único punto de importación permitido para otros módulos según AGENTS.md.
 */

export { AuthModule } from './auth.module';
export {
  AuthPublicService,
  AuthPublicService as AuthService,
  type UserPublicProfile,
} from './application/services/auth-public.service';

export { JwtAuthGuard } from './api/guards/jwt-auth.guard';
export { CurrentUser } from './api/decorators/current-user.decorator';
