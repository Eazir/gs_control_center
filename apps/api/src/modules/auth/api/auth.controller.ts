import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  LoginInput,
  LoginInputSchema,
  LoginResponse,
  InviteUserInput,
  InviteUserInputSchema,
  AcceptInviteInput,
  AcceptInviteInputSchema,
  UserProfile,
  JwtPayload,
  UserStatus,
  UserRole,
  ForgotPasswordDto,
  ForgotPasswordInputSchema,
  ResetPasswordDto,
  ResetPasswordInputSchema,
} from '@gs/contracts';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case';
import { InviteUserUseCase } from '../application/use-cases/invite-user.use-case';
import { AcceptInvitationUseCase } from '../application/use-cases/accept-invitation.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import { UpdateUserStatusUseCase } from '../application/use-cases/update-user-status.use-case';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';
import { ListInvitationsUseCase } from '../application/use-cases/list-invitations.use-case';
import { DeleteInvitationUseCase } from '../application/use-cases/delete-invitation.use-case';
import { ResendInvitationUseCase } from '../application/use-cases/resend-invitation.use-case';
import { ListActiveClosersUseCase } from '../application/use-cases/list-active-closers.use-case';
import { ForgotPasswordUseCase } from '../application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password.use-case';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from './dto/login.dto';
import {
  AccountLockedError,
  InvalidCredentialsError,
  InvalidInvitationError,
  InvalidSessionError,
  UserAlreadyExistsError,
  UserInactiveError,
} from '../domain/errors/auth.errors';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LoginUseCase)
    private readonly loginUseCase: LoginUseCase,
    @Inject(RefreshTokenUseCase)
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @Inject(LogoutUseCase)
    private readonly logoutUseCase: LogoutUseCase,
    @Inject(GetCurrentUserUseCase)
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    @Inject(InviteUserUseCase)
    private readonly inviteUserUseCase: InviteUserUseCase,
    @Inject(AcceptInvitationUseCase)
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    @Inject(ListUsersUseCase)
    private readonly listUsersUseCase: ListUsersUseCase,
    @Inject(UpdateUserStatusUseCase)
    private readonly updateUserStatusUseCase: UpdateUserStatusUseCase,
    @Inject(UpdateUserUseCase)
    private readonly updateUserUseCase: UpdateUserUseCase,
    @Inject(ListInvitationsUseCase)
    private readonly listInvitationsUseCase: ListInvitationsUseCase,
    @Inject(DeleteInvitationUseCase)
    private readonly deleteInvitationUseCase: DeleteInvitationUseCase,
    @Inject(ResendInvitationUseCase)
    private readonly resendInvitationUseCase: ResendInvitationUseCase,
    @Inject(ListActiveClosersUseCase)
    private readonly listActiveClosersUseCase: ListActiveClosersUseCase,
    @Inject(ForgotPasswordUseCase)
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    @Inject(ResetPasswordUseCase)
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponse> {
    try {
      const result = await this.loginUseCase.execute({
        email: body.email,
        password: body.password,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // Cookie segura con Refresh Token (HttpOnly, SameSite=Strict, Secure en producción)
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });

      return {
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          tokenType: 'Bearer',
          expiresIn: result.expiresIn,
        },
      };
    } catch (err) {
      this.handleDomainError(err);
    }
  }



  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordInputSchema)) body: ForgotPasswordDto
  ): Promise<{ message: string }> {
    await this.forgotPasswordUseCase.execute(body);
    // Siempre respondemos OK sin revelar si el correo existe o no
    return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordInputSchema)) body: ResetPasswordDto
  ): Promise<{ message: string }> {
    await this.resetPasswordUseCase.execute(body);
    return { message: 'Contraseña actualizada con éxito.' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string
  ) {
    try {
      const refreshToken =
        (req.cookies && req.cookies['refreshToken']) || bodyRefreshToken;

      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token no provisto.');
      }

      const result = await this.refreshTokenUseCase.execute({ refreshToken });

      // Actualizar cookie con el nuevo refresh token rotado
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return {
        accessToken: result.accessToken,
        tokenType: 'Bearer',
        expiresIn: result.expiresIn,
      };
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string
  ) {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : undefined;

    const refreshToken =
      (req.cookies && req.cookies['refreshToken']) || bodyRefreshToken;

    await this.logoutUseCase.execute({ accessToken, refreshToken });

    // Limpiar cookie de refresh token
    res.clearCookie('refreshToken', { path: '/auth' });

    return { success: true, message: 'Sesión cerrada exitosamente.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<UserProfile> {
    try {
      return await this.getCurrentUserUseCase.execute(user.sub);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard)
  async invite(
    @Body(new ZodValidationPipe(InviteUserInputSchema)) body: InviteUserInput,
    @CurrentUser() user: JwtPayload
  ) {
    try {
      if (user.role === 'ADMIN' && (body.role === 'SUPER_ADMIN' || body.role === 'ADMIN')) {
        throw new ForbiddenException(
          'Un administrador solo puede invitar roles subordinados (Director, Closer, Cliente).'
        );
      }
      if (user.role === 'DIRECTOR' && body.role !== 'CLOSER') {
        throw new ForbiddenException(
          'Un director comercial solo puede invitar usuarios con rol Closer.'
        );
      }
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'DIRECTOR') {
        throw new ForbiddenException('No tienes permisos para emitir invitaciones.');
      }

      return await this.inviteUserUseCase.execute({
        ...body,
        invitedById: user.sub,
      });
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body(new ZodValidationPipe(AcceptInviteInputSchema)) body: AcceptInviteInput
  ) {
    try {
      return await this.acceptInvitationUseCase.execute(body);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async listUsers(@CurrentUser() user: JwtPayload) {
    try {
      return await this.listUsersUseCase.execute(user.sub, user.role);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Get('users/active-closers')
  @UseGuards(JwtAuthGuard)
  async listActiveClosers(@CurrentUser() user: JwtPayload) {
    try {
      return await this.listActiveClosersUseCase.execute(user.role);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Patch('users/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateUserStatus(
    @Param('id') targetUserId: string,
    @Body('status') status: UserStatus,
    @CurrentUser() user: JwtPayload
  ) {
    try {
      if (!status || !['ACTIVE', 'SUSPENDED', 'INVITED'].includes(status)) {
        throw new BadRequestException('Estado de usuario inválido.');
      }
      return await this.updateUserStatusUseCase.execute({
        targetUserId,
        status,
        requesterId: user.sub,
        requesterRole: user.role,
      });
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('id') targetUserId: string,
    @Body()
    body: {
      fullName?: string;
      phone?: string | null;
      email?: string;
      role?: UserRole;
    },
    @CurrentUser() user: JwtPayload
  ) {
    try {
      return await this.updateUserUseCase.execute({
        targetUserId,
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        role: body.role,
        requesterId: user.sub,
        requesterRole: user.role,
      });
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Get('invitations')
  @UseGuards(JwtAuthGuard)
  async listInvitations(@CurrentUser() user: JwtPayload) {
    try {
      return await this.listInvitationsUseCase.execute(user.role);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Delete('invitations/:id')
  @UseGuards(JwtAuthGuard)
  async deleteInvitation(
    @Param('id') invitationId: string,
    @CurrentUser() user: JwtPayload
  ) {
    try {
      return await this.deleteInvitationUseCase.execute(invitationId, user.role);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  @Post('invitations/:id/resend')
  @UseGuards(JwtAuthGuard)
  async resendInvitation(
    @Param('id') invitationId: string,
    @CurrentUser() user: JwtPayload
  ) {
    try {
      return await this.resendInvitationUseCase.execute(invitationId, user.role);
    } catch (err) {
      this.handleDomainError(err);
    }
  }

  private handleDomainError(err: unknown): never {
    if (
      err instanceof InvalidCredentialsError ||
      (err as { name?: string })?.name === 'InvalidCredentialsError'
    ) {
      throw new UnauthorizedException((err as Error).message);
    }


    if (err instanceof AccountLockedError) {
      throw new HttpException(
        { statusCode: HttpStatus.LOCKED, message: err.message },
        HttpStatus.LOCKED
      );
    }
    if (err instanceof UserInactiveError) {
      throw new ForbiddenException(err.message);
    }
    if (err instanceof InvalidSessionError) {
      throw new UnauthorizedException(err.message);
    }
    if (err instanceof UserAlreadyExistsError) {
      throw new ConflictException(err.message);
    }
    if (err instanceof InvalidInvitationError) {
      throw new BadRequestException(err.message);
    }
    if (err instanceof HttpException) {
      throw err;
    }
    throw new HttpException(
      'Error interno de autenticación.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
