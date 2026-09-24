import { z } from 'zod';

/**
 * Validación estricta de identificadores UUID (v4 o v7).
 */
export const UuidSchema = z.string().uuid({
  message: 'El identificador debe ser un UUID válido.',
});

export type Uuid = z.infer<typeof UuidSchema>;
