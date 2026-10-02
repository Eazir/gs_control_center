import { z } from 'zod';

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido.' }).toLowerCase(),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido.' }).toLowerCase(),
  token: z.string().min(1, { message: 'El token es obligatorio.' }),
  newPassword: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' }),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordInputSchema>;
