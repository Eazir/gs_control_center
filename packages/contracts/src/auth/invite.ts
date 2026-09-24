import { z } from 'zod';
import { UserRoleSchema } from '../common/roles';

export const InviteUserInputSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido.' }).toLowerCase(),
  role: UserRoleSchema,
  fullName: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }).trim(),
});

export type InviteUserInput = z.infer<typeof InviteUserInputSchema>;

export const AcceptInviteInputSchema = z.object({
  token: z.string().min(1, { message: 'El token de invitación es requerido.' }),
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
    .regex(/[A-Z]/, { message: 'Debe contener al menos una mayúscula.' })
    .regex(/[0-9]/, { message: 'Debe contener al menos un número.' }),
  fullName: z.string().min(2).optional(),
});

export type AcceptInviteInput = z.infer<typeof AcceptInviteInputSchema>;
