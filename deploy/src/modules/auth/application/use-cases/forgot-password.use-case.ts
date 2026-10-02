import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository, USER_REPOSITORY_TOKEN } from '../../domain/ports/user-repository.port';
import { CommunicationsService } from '../../../communications';
import { ForgotPasswordDto } from '@gs/contracts';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService
  ) {}

  async execute(input: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email);
    
    // Si el usuario no existe, no hacemos nada ni damos error 
    // para evitar la enumeración de usuarios
    if (!user) {
      return;
    }

    const secret = process.env.JWT_RESET_SECRET || 'fallback_reset_secret_key_123';
    
    // El token incluye el passwordHash para que se invalide automáticamente 
    // una vez que la contraseña sea cambiada.
    const token = await this.jwtService.signAsync(
      { sub: user.id, type: 'reset' },
      { 
        secret: secret + user.passwordHash,
        expiresIn: '1h' 
      }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    await this.communicationsService.enqueueEmail({
      to: user.email,
      subject: 'Recuperación de Contraseña - GrowthShell',
      template: 'PASSWORD_RECOVERY',
      payload: { link: resetLink, name: user.fullName }
    });
  }
}
