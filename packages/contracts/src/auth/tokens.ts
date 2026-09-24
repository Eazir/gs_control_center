import { z } from 'zod';
import { UserRoleSchema } from '../common/roles';

/**
 * Payload contenido en el JWT (Access Token).
 * Duración máxima: 15 minutos según AGENTS.md.
 */
export const JwtPayloadSchema = z.object({
  sub: z.string().uuid({ message: 'El ID de usuario debe ser un UUID válido.' }),
  email: z.string().email({ message: 'Email inválido.' }),
  role: UserRoleSchema,
  sessionId: z.string().uuid({ message: 'El ID de sesión debe ser un UUID válido.' }),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

/**
 * Respuesta devuelta tras autenticación o renovación de sesión.
 */
export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer').default('Bearer'),
  expiresIn: z.number().default(900), // 15 minutos en segundos
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;
