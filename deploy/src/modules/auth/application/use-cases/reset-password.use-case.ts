import { Inject, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository, USER_REPOSITORY_TOKEN } from '../../domain/ports/user-repository.port';
import { PasswordService } from '../../../../core/security';
import { ResetPasswordDto } from '@gs/contracts';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService
  ) {}

  async execute(input: ResetPasswordDto): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const secret = process.env.JWT_RESET_SECRET || 'fallback_reset_secret_key_123';

    try {
      // Validamos el token contra la firma dinámica (que incluye el hash actual)
      const decoded = await this.jwtService.verifyAsync(input.token, {
        secret: secret + user.passwordHash,
      });

      if (decoded.sub !== user.id || decoded.type !== 'reset') {
        throw new Error('Invalid token type or subject');
      }
    } catch {
      throw new UnauthorizedException('El token ha expirado o ya fue utilizado.');
    }

    // Hasheamos y actualizamos la nueva contraseña
    const newPasswordHash = await this.passwordService.hash(input.newPassword);
    
    await this.userRepository.update(user.id, {
      passwordHash: newPasswordHash
    });
  }
}
