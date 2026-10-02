import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Servicio de hashing seguro de contraseñas usando Argon2id.
 * Conforme con los estándares de seguridad de AGENTS.md y OWASP.
 */
@Injectable()
export class PasswordService {
  /**
   * Hashea una contraseña plana usando Argon2id con parámetros recomendados.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Compara una contraseña plana contra su hash de Argon2id en tiempo constante.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
