import { z } from 'zod';

/**
 * Contrato de paginación por cursor (keyset pagination).
 * Obligatorio en todo listado según AGENTS.md (prohibido OFFSET).
 */
export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

/**
 * Metadatos de respuesta paginada por cursor.
 */
export const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable().optional(),
  endCursor: z.string().nullable().optional(),
  totalCount: z.number().int().nonnegative().optional(),
});

export type PageInfo = z.infer<typeof PageInfoSchema>;
