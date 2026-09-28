import { z } from 'zod';

export const RawSaleSchema = z.object({
  source: z.string(),
  externalOrderId: z.string(),
  externalTxnId: z.string(),
  
  leadName: z.string().nullable().optional(),
  leadEmail: z.string().email().catch('unknown@example.com'),
  leadPhone: z.string().nullable().optional(),
  
  productName: z.string(),
  productId: z.string().nullable().optional(),
  status: z.string(),
  
  amount: z.number(),
  currency: z.string().default('USD'),
  
  paymentMethod: z.string().nullable().optional(),
  installments: z.number().default(1),

  // Metadatos extendidos de Hotmart / Pasarelas
  offerCode: z.string().nullable().optional(),
  sck: z.string().nullable().optional(),
  recurrencyNumber: z.number().nullable().optional(),
  isSubscription: z.boolean().nullable().optional(),
  date: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type RawSale = z.infer<typeof RawSaleSchema>;

// DTO para registrar una venta manual
export const ManualSaleSchema = z.object({
  leadEmail: z.string().email('Email inválido'),
  leadName: z.string().min(1, 'El nombre es obligatorio'),
  leadPhone: z.string().optional(),
  productName: z.string().min(1, 'El producto es obligatorio'),
  productId: z.string().optional(),
  closerId: z.string().optional(),
  amount: z.number().min(0, 'El monto debe ser positivo'),
  currency: z.string().default('USD'),
  status: z.enum(['APPROVED', 'REFUNDED', 'CANCELED', 'PENDING']).default('APPROVED'),
  date: z.string().datetime().optional()
});

export type ManualSaleDto = z.infer<typeof ManualSaleSchema>;

// Interfaz para la lista de ventas y transacciones en frontend
export interface SaleListItem {
  id: string;
  source: string;
  externalOrderId: string;
  externalTxnId?: string;
  productName: string;
  productId?: string | null;
  offerCode?: string | null;
  sck?: string | null;
  status: string;
  amount: number;
  currency: string;
  paymentMethod?: string | null;
  installments?: number | null;
  createdAt: string;
  updatedAt?: string;
  closerId?: string | null;
  closerName?: string | null;
  closerEmail?: string | null;
  lead: {
    id?: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
    closerId?: string | null;
    closerName?: string | null;
  };
  metadata?: Record<string, unknown> | null;
}
