import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { JwtPayload, JwtPayloadSchema } from '@gs/contracts';

@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService
  ) {

    this.secret =
      process.env.JWT_ACCESS_SECRET ||
      '86828895e63edc73d7efb6f4fc043ecef35eba55227ac5836d4690230ec21f75';
  }

  /**
   * Emite un Access Token firmado con expiración máxima de 15 minutos (AGENTS.md).
   */
  async signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.secret,
      expiresIn: '15m',
    });
  }

  /**
   * Valida la firma y vigencia del JWT, y parsea su payload contra el contrato Zod.
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: this.secret,
      });
      const parsed = JwtPayloadSchema.safeParse(decoded);
      if (!parsed.success) {
        throw new UnauthorizedException('Token con estructura o claims inválidos.');
      }
      return parsed.data;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  /**
   * Genera un refresh token criptográfico aleatorio seguro de 80 caracteres hex (40 bytes de entropía).
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  /**
   * Hashea un refresh token con SHA-256 para persistencia en base de datos.
   * Nunca se guarda el refresh token en texto plano (AGENTS.md).
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  hashToken(token: string): string {
    return this.hashRefreshToken(token);
  }

  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    return this.signAccessToken(payload);
  }
}

