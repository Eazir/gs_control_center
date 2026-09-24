import { z } from 'zod';

/**
 * Roles del sistema según AGENTS.md:
 * SUPER_ADMIN > ADMIN > DIRECTOR > CLOSER > CLIENTE
 */
export const UserRoleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'DIRECTOR',
  'CLOSER',
  'CLIENTE',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;
