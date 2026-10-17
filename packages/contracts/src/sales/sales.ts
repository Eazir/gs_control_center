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
  affiliates: z.array(z.any()).nullable().optional(),
  recurrencyNumber: z.number().nullable().optional(),
  isSubscription: z.boolean().nullable().optional(),
  date: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type RawSale = z.infer<typeof RawSaleSchema>;

// DTO para registrar una venta manual
export const ManualSaleSchema = z.object({
  leadEmail: z.union([z.string().email('Email inválido'), z.literal('')]).optional().nullable(),
  leadName: z.string().min(1, 'El nombre es obligatorio'),
  leadPhone: z.string().optional(),
  productName: z.string().min(1, 'El producto es obligatorio'),
  productId: z.string().optional(),
  closerId: z.string().optional(),
  amount: z.number().min(0, 'El monto debe ser positivo'),
  currency: z.string().default('USD'),
  status: z.string().default('PURCHASE_APPROVED'),
  date: z.string().datetime().optional()
});

export type ManualSaleDto = z.infer<typeof ManualSaleSchema>;

// Esquemas de importación CSV masiva
export const LeadSituacionEnum = z.enum([
  'POR_PAGAR', 'SEGUIMIENTO', 'NO_RESPONDE', 'NO_CALIFICA', 
  'YA_HABIA_ENTRADO', 'PAGO_COMPLETO', 'PAGO_A_CUOTAS', 'RESERVA', 'SIN_WSP'
]);

export const CsvLeadImportSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Email inválido para importación').optional().nullable(),
  phone: z.string().min(1, 'El teléfono es obligatorio'),
  closerId: z.string().optional().nullable(), // UUID directo del closer (asignación manual/equitativa)
  sck: z.string().optional().nullable(), // Código SCK para resolver closer vía projectUser.sckCodes
  productOfInterest: z.string().optional(),
  situacion: z.preprocess(
    (val) => typeof val === 'string' ? val.toUpperCase().replace(/\s+/g, '_') : val,
    LeadSituacionEnum.nullable().optional()
  ), // Nueva columna de situación (lista específica)
  pipelineStage: z.string().optional().nullable(), // Estado del lead (opcional): uncontacted, followup, etc.
});

export type CsvLeadImportDto = z.infer<typeof CsvLeadImportSchema>;

export const CsvSaleImportSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  leadName: z.string().optional(),
  leadEmail: z.string().email('Email inválido para importación').optional().or(z.literal('')),
  leadPhone: z.string().min(1, 'El teléfono es requerido'),
  offerCode: z.string().min(1, 'El código de oferta es requerido'),
  status: z.string().min(1, 'El estado de la transacción es requerido'),
  sck: z.string().min(1, 'El SCK es requerido'),
  affiliateName: z.string().min(1, 'El nombre del afiliado es requerido'),
  paymentMethod: z.string().optional(),
  installments: z.coerce.number().default(1),
  isFirstInstallment: z.boolean().default(true),
  externalTxnId: z.string().min(1, 'El código de transacción es requerido'),
  externalOrderId: z.string().optional(), // ID de la orden (para agrupar transacciones de la misma compra)
  productName: z.string().optional(),
  amount: z.coerce.number().default(0),
  currency: z.string().default('USD'),
});

export type CsvSaleImportDto = z.infer<typeof CsvSaleImportSchema>;

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
  pipelineStage?: string | null;
  pipelineSubstatus?: string | null;
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

export const UpdateLeadSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().or(z.literal('')).nullable().optional(),
  situacion: z.preprocess(
    (val) => typeof val === 'string' ? val.toUpperCase().replace(/\s+/g, '_') : val,
    LeadSituacionEnum.nullable().optional()
  ),
  closerId: z.string().uuid().nullable().optional(),
  productOfInterest: z.string().nullable().optional(),
});

export type UpdateLeadDto = z.infer<typeof UpdateLeadSchema>;

export const UpdateTransactionStatusSchema = z.object({
  status: z.string().optional(),
  pipelineStage: z.string().optional(),
  pipelineSubstatus: z.string().nullable().optional(),
});

export type UpdateTransactionStatusDto = z.infer<typeof UpdateTransactionStatusSchema>;

export const OriginFilterEnum = z.enum(['marketing', 'comercial', 'todos']);

export const ListFiltersSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  origin: OriginFilterEnum.default('todos'),
  productId: z.string().optional(),
  closerId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListFilters = z.infer<typeof ListFiltersSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

