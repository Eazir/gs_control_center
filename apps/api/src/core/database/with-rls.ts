import { Prisma, PrismaClient } from '@prisma/client';
import { UserRole } from '@gs/contracts';

export interface AuthContext {
  userId: string;
  role: UserRole;
}

/**
 * Helper transaccional obligatorio para ejecutar consultas Prisma con Row Level Security (RLS).
 *
 * @remarks
 * Prisma agrupa conexiones en un pool. Ejecutar `SET LOCAL` fuera de una transacción no tiene efecto
 * o puede contaminar conexiones subsecuentes del pool. `withRls` ejecuta dentro de `prisma.$transaction`
 * configurando variables de sesión con `is_local = true`, garantizando que PostgreSQL aplique
 * las políticas de RLS exclusivamente durante la duración de la transacción (AGENTS.md).
 *
 * @param prisma - Instancia de PrismaClient o PrismaService.
 * @param ctx - Contexto de autenticación del usuario actual (userId y role).
 * @param fn - Función que ejecuta operaciones Prisma dentro de la transacción protegida.
 */
export async function withRls<T>(
  prisma: PrismaClient,
  ctx: AuthContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE gs_app;`);
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_user_role', $2, true)`,
      ctx.userId,
      ctx.role
    );
    return fn(tx);
  });
}
