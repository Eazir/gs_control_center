import { Module } from '@nestjs/common';
import { AuthController } from './api/auth.controller';
import { JwtAuthGuard } from './api/guards/jwt-auth.guard';
import { USER_REPOSITORY_TOKEN } from './domain/ports/user-repository.port';
import { SESSION_REPOSITORY_TOKEN } from './domain/ports/session-repository.port';
import { INVITATION_REPOSITORY_TOKEN } from './domain/ports/invitation-repository.port';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaInvitationRepository } from './infrastructure/prisma-invitation.repository';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { InviteUserUseCase } from './application/use-cases/invite-user.use-case';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { UpdateUserStatusUseCase } from './application/use-cases/update-user-status.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { ListInvitationsUseCase } from './application/use-cases/list-invitations.use-case';
import { DeleteInvitationUseCase } from './application/use-cases/delete-invitation.use-case';
import { ResendInvitationUseCase } from './application/use-cases/resend-invitation.use-case';
import { ListActiveClosersUseCase } from './application/use-cases/list-active-closers.use-case';
import { AuthPublicService } from './application/services/auth-public.service';

@Module({
  controllers: [AuthController],
  providers: [
    // Puertos / Repositorios
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: PrismaUserRepository,
    },
    {
      provide: SESSION_REPOSITORY_TOKEN,
      useClass: PrismaSessionRepository,
    },
    {
      provide: INVITATION_REPOSITORY_TOKEN,
      useClass: PrismaInvitationRepository,
    },
    // Casos de Uso
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetCurrentUserUseCase,
    InviteUserUseCase,
    AcceptInvitationUseCase,
    ListUsersUseCase,
    UpdateUserStatusUseCase,
    UpdateUserUseCase,
    ListInvitationsUseCase,
    DeleteInvitationUseCase,
    ResendInvitationUseCase,
    ListActiveClosersUseCase,
    // Guards
    JwtAuthGuard,
    // Servicio Público para otros módulos
    AuthPublicService,
  ],
  exports: [AuthPublicService, JwtAuthGuard],
})
export class AuthModule {}
