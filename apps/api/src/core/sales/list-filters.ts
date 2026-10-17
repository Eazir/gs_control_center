import { Prisma } from '@prisma/client';
import type { ListFilters } from '@gs/contracts';

export type OriginFilter = 'marketing' | 'comercial' | 'todos';

/**
 * Codifica el cursor de paginación keyset sobre (createdAt DESC, id DESC).
 */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

/**
 * Decodifica un cursor keyset devolviendo la fecha y el ID, o null si es inválido.
 */
export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.lastIndexOf('|');
    if (sep < 0) return null;
    const d = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (Number.isNaN(d.getTime()) || !id) return null;
    return { createdAt: d, id };
  } catch {
    return null;
  }
}

/**
 * Construye un rango de fechas { gte, lt } en UTC basado en day o from/to.
 */
export function buildDateRange(day?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  const gte = from ?? day;
  if (!gte) return undefined;
  const gteDate = new Date(`${gte}T00:00:00.000Z`);
  const lt = to ?? day;
  const ltDate = new Date(`${lt}T23:59:59.999Z`);
  return { gte: gteDate, lt: ltDate };
}

/**
 * Construye la cláusula de origen comercial o marketing según la atribución de F3.
 */
export function buildOriginClause(origin: OriginFilter): Prisma.SaleWhereInput | undefined {
  if (origin === 'todos') return undefined;
  const attrComercial: Prisma.SaleWhereInput = {
    metadata: { path: ['attribution'], equals: 'COMERCIAL' },
  };
  if (origin === 'comercial') {
    return { OR: [{ closerId: { not: null } }, attrComercial] };
  }
  return { AND: [{ closerId: null }, { NOT: attrComercial }] };
}

const APPROVED = ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];

export interface SaleWhereOptions {
  role?: string | undefined;
  userId?: string | undefined;
  /** true para listSales (solo aprobadas por defecto); false para listTransactions (todos los estados). */
  approvedOnly?: boolean | undefined;
}

/**
 * Construye el objeto where de Prisma para ventas y transacciones aplicando filtros y RAC/RLS.
 */
export function buildSaleWhereClause(
  projectId: string,
  filters: ListFilters,
  options: SaleWhereOptions = {}
): Prisma.SaleWhereInput {
  const and: Prisma.SaleWhereInput[] = [{ projectId }];

  if (options.role === 'CLOSER' && options.userId) {
    and.push({ closerId: options.userId });
  }

  if (options.approvedOnly && !filters.status) {
    and.push({ status: { in: APPROVED, mode: 'insensitive' } });
  } else if (filters.status) {
    and.push({ status: { equals: filters.status, mode: 'insensitive' } });
  }

  if (filters.productId) and.push({ productId: filters.productId });
  if (filters.closerId) and.push({ closerId: filters.closerId });

  const origin = buildOriginClause(filters.origin);
  if (origin) and.push(origin);
  const range = buildDateRange(filters.day, filters.from, filters.to);
  if (range) and.push({ createdAt: range });

  return and.length === 1 ? and[0]! : { AND: and };
}

export interface LeadWhereOptions {
  role?: string | undefined;
  userId?: string | undefined;
}

/**
 * Construye el objeto where de Prisma para leads aplicando filtros, búsqueda y RAC/RLS.
 */
export function buildLeadWhereClause(
  projectId: string,
  filters: ListFilters,
  options: LeadWhereOptions = {}
): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [{ projectId }];

  if (options.role === 'CLOSER' && options.userId) {
    and.push({
      OR: [
        { closerId: options.userId },
        { sales: { some: { closerId: options.userId } } },
      ],
    });
  }

  if (filters.closerId) {
    and.push({
      OR: [
        { closerId: filters.closerId },
        { sales: { some: { closerId: filters.closerId } } },
      ],
    });
  }

  if (filters.productId) {
    and.push({ sales: { some: { productId: filters.productId } } });
  }

  if (filters.status) {
    and.push({ sales: { some: { status: { equals: filters.status, mode: 'insensitive' } } } });
  }

  const comercialSale: Prisma.SaleWhereInput = {
    OR: [{ closerId: { not: null } }, { metadata: { path: ['attribution'], equals: 'COMERCIAL' } }],
  };
  if (filters.origin === 'comercial') {
    and.push({ OR: [{ closerId: { not: null } }, { sales: { some: comercialSale } }] });
  } else if (filters.origin === 'marketing') {
    and.push({ AND: [{ closerId: null }, { NOT: { sales: { some: comercialSale } } }] });
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          sales: {
            some: {
              OR: [
                { externalTxnId: { contains: q, mode: 'insensitive' } },
                { externalOrderId: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  const range = buildDateRange(filters.day, filters.from, filters.to);
  if (range) and.push({ updatedAt: range });

  return and.length === 1 ? and[0]! : { AND: and };
}
