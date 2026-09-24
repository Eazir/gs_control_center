import { z } from 'zod';
import { UserRoleSchema } from '../common/roles';
import { AuthTokensSchema } from './tokens';

export const LoginInputSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido.' }).toLowerCase(),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' }),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const LoginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: UserRoleSchema,
  }),
  tokens: AuthTokensSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
