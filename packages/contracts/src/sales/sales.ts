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
  installments: z.number().default(1)
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

// Interfaz para la lista de ventas en frontend
export interface SaleListItem {
  id: string;
  source: string;
  externalOrderId: string;
  productName: string;
  productId?: string | null;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  lead: {
    name: string | null;
    email: string | null;
    closerId?: string | null;
  };
}
