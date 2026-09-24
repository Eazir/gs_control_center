import { z } from 'zod';
import { UserRoleSchema } from '../common/roles';

export const UserStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'INVITED', 'DELETED']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable().optional(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  mfaEnabled: z.boolean(),
  preferences: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
