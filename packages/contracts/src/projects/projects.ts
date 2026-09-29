import { z } from 'zod';

/**
 * Estados de operación de un proyecto
 */
export const ProjectStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * Roles dentro de un proyecto específico
 */
export const ProjectRoleSchema = z.enum(['DIRECTOR', 'CLOSER', 'CLIENTE']);
export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

/**
 * Elemento de producto en catálogo (almacenado en JSONB validado)
 */
export const ProductItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'El nombre del producto es obligatorio'),
  offerCode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  isMarketing: z.boolean().default(false),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  installments: z
    .number()
    .int('Las cuotas deben ser un número entero')
    .min(1, 'El producto debe tener al menos 1 cuota')
    .max(360, 'El máximo de cuotas es 360')
    .default(1),
  currency: z.string().default('USD'),
  ownerCloserId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
});
export type ProductItem = z.infer<typeof ProductItemSchema>;

/**
 * Entrada para crear un producto en el catálogo
 */
export const CreateProductInputSchema = z.object({
  name: z.string().min(1, 'El nombre del producto es obligatorio'),
  offerCode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  isMarketing: z.boolean().default(false),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  installments: z
    .number()
    .int('Las cuotas deben ser un número entero')
    .min(1, 'El producto debe tener al menos 1 cuota')
    .max(360, 'El máximo de cuotas es 360')
    .default(1),
  currency: z.string().min(1).default('USD'),
  ownerCloserId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true).optional(),
});
export type CreateProductInput = z.input<typeof CreateProductInputSchema>;

/**
 * Entrada para actualizar un producto en el catálogo
 */
export const UpdateProductInputSchema = z.object({
  name: z.string().min(1).optional(),
  offerCode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  isMarketing: z.boolean().optional(),
  price: z.number().min(0).optional(),
  installments: z
    .number()
    .int('Las cuotas deben ser un número entero')
    .min(1, 'El producto debe tener al menos 1 cuota')
    .max(360, 'El máximo de cuotas es 360')
    .optional(),
  currency: z.string().min(1).optional(),
  ownerCloserId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
});
export type UpdateProductInput = z.input<typeof UpdateProductInputSchema>;


/**
 * Escalón o tier de comisión según porcentaje de cumplimiento de meta
 */
export const CommissionTierSchema = z.object({
  id: z.string(),
  minPercent: z.number().min(0).max(500), // ej: 0, 80, 100, 120
  closerPercentage: z.number().min(0).max(100),
  directorPercentage: z.number().min(0).max(100),
  companyPercentage: z.number().min(0).max(100),
  externalPercentage: z.number().min(0).max(100).default(0),
});
export type CommissionTier = z.infer<typeof CommissionTierSchema>;

/**
 * Meta comercial vinculada a productos y con comisiones ajustables
 */
export const GoalItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre de la meta es obligatorio'),
  targetRevenue: z.number().min(0),
  currency: z.string().default('USD'),
  productIds: z.array(z.string()).default([]), // IDs de productos incluidos (vacío = todos)
  closerPercentage: z.number().min(0).max(100).default(10),
  directorPercentage: z.number().min(0).max(100).default(3),
  companyPercentage: z.number().min(0).max(100).default(82),
  externalPercentage: z.number().min(0).max(100).default(5),
  tiers: z.array(CommissionTierSchema).default([]),
  period: z.enum(['MONTHLY', 'LAUNCH', 'QUARTERLY', 'ANNUAL']).default('MONTHLY'),
  active: z.boolean().default(true),
});
export type GoalItem = z.infer<typeof GoalItemSchema>;

/**
 * Reparto porcentual de una venta.
 * Debe cumplir: company + director + closer === teamTotal.
 * `external` (pasarelas/afiliados) se procesa por separado y no participa en la suma.
 */
export const CommissionPercentagesSchema = z
  .object({
    teamTotal: z.number().min(0).max(100, 'El total no puede superar 100%'),
    company: z.number().min(0).max(100, 'La comisión de empresa no puede superar 100%'),
    director: z.number().min(0).max(100, 'La comisión de director no puede superar 100%'),
    closer: z.number().min(0).max(100, 'La comisión de closer no puede superar 100%'),
    external: z.number().min(0).max(100).default(0),
  })
  .refine((p) => Math.abs(p.company + p.director + p.closer - p.teamTotal) < 1e-6, {
    message:
      'La suma de empresa + director + closer debe ser exactamente igual al porcentaje total del equipo (teamTotal)',
    path: ['teamTotal'],
  });
export type CommissionPercentages = z.infer<typeof CommissionPercentagesSchema>;

/**
 * Escalón (Tier) de meta de un grupo de comisión.
 * Define un umbral de facturación y el reparto de comisiones asociado.
 */
export const GoalTierSchema = z.object({
  id: z.string(),
  revenueThreshold: z.number().min(0, 'El umbral de facturación no puede ser negativo'),
  percentages: CommissionPercentagesSchema,
});
export type GoalTier = z.infer<typeof GoalTierSchema>;

/**
 * Meta de facturación de un grupo de comisión.
 * Cuando la facturación alcanza los distintos umbrales (escalones), se aplican los porcentajes correspondientes.
 */
export const CommissionGroupGoalSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre de la meta es obligatorio'),
  targetRevenue: z.number().min(0, 'La meta de facturación no puede ser negativa'),
  currency: z.string().default('USD'),
  tiers: z.array(GoalTierSchema).default([]),
  active: z.boolean().default(true),
});
export type CommissionGroupGoal = z.infer<typeof CommissionGroupGoalSchema>;

/**
 * Grupo de comisión: agrupa productos con un reparto base y metas escalonadas.
 * Un producto solo puede pertenecer a un único grupo (regla de unicidad a validar
 * en el backend y en la UI, ya que cruza grupos del mismo proyecto).
 */
export const CommissionGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre del grupo de comisión es obligatorio'),
  productIds: z.array(z.string()).default([]),
  basePercentages: CommissionPercentagesSchema,
  goals: z.array(CommissionGroupGoalSchema).default([]),
  active: z.boolean().default(true),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type CommissionGroup = z.infer<typeof CommissionGroupSchema>;

/**
 * Entrada para crear un grupo de comisión
 */
export const CreateCommissionGroupInputSchema = z.object({
  name: z.string().min(1, 'El nombre del grupo de comisión es obligatorio'),
  productIds: z.array(z.string()).default([]),
  basePercentages: CommissionPercentagesSchema,
  goals: z.array(CommissionGroupGoalSchema).default([]),
});
export type CreateCommissionGroupInput = z.infer<typeof CreateCommissionGroupInputSchema>;

/**
 * Entrada para actualizar un grupo de comisión
 */
export const UpdateCommissionGroupInputSchema = z.object({
  name: z.string().min(1).optional(),
  productIds: z.array(z.string()).optional(),
  basePercentages: CommissionPercentagesSchema.optional(),
  goals: z.array(CommissionGroupGoalSchema).optional(),
  active: z.boolean().optional(),
});
export type UpdateCommissionGroupInput = z.infer<typeof UpdateCommissionGroupInputSchema>;


/**
 * Configuración de comisiones del proyecto
 */
export const CommissionConfigSchema = z.object({
  defaultCloserPercentage: z.number().min(0).max(100).default(10),
  defaultDirectorPercentage: z.number().min(0).max(100).default(3),
  defaultCompanyPercentage: z.number().min(0).max(100).default(82),
  defaultExternalPercentage: z.number().min(0).max(100).default(5),
  tiers: z.array(CommissionTierSchema).default([]),
  groups: z.array(CommissionGroupSchema).default([]),
});
export type CommissionConfig = z.infer<typeof CommissionConfigSchema>;

/**
 * Configuración de metas comerciales mensuales
 */
export const GoalsConfigSchema = z.object({
  monthlyTargetRevenue: z.number().min(0).default(0),
  currency: z.string().min(1).default('USD'),
  targetCallsPerCloser: z.number().min(0).optional(),
  goals: z.array(GoalItemSchema).default([]).optional(),
});
export type GoalsConfig = z.infer<typeof GoalsConfigSchema>;

/**
 * Entidad completa de Proyecto
 */
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().nullable().optional(),
  status: ProjectStatusSchema,
  directorId: z.string().uuid().nullable().optional(),
  products: z.array(ProductItemSchema).default([]),
  goalsConfig: GoalsConfigSchema.default({ monthlyTargetRevenue: 0, currency: 'USD', goals: [] }),
  commissionConfig: z.record(z.unknown()).default({}),
  automationConfig: z.record(z.unknown()).nullable().optional(),
  settings: z.record(z.unknown()).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

/**
 * Entrada para crear un proyecto
 */
export const CreateProjectInputSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  slug: z
    .string()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener minúsculas, números y guiones')
    .optional(),
  description: z.string().optional().nullable(),
  status: ProjectStatusSchema.default('DRAFT').optional(),
  directorId: z.string().uuid('ID de director inválido').optional().nullable(),
  goalsConfig: GoalsConfigSchema.optional(),
  commissionConfig: CommissionConfigSchema.optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

/**
 * Entrada para actualizar un proyecto
 */
export const UpdateProjectInputSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener minúsculas, números y guiones')
    .optional(),
  description: z.string().optional().nullable(),
  status: ProjectStatusSchema.optional(),
  directorId: z.string().uuid().optional().nullable(),
  goalsConfig: GoalsConfigSchema.optional(),
  commissionConfig: CommissionConfigSchema.optional(),
  automationConfig: z.record(z.unknown()).optional().nullable(),
  settings: z.record(z.unknown()).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

/**
 * Resumen de proyecto para listados y tarjetas de UI
 */
export const ProjectSummarySchema = ProjectSchema.extend({
  directorName: z.string().nullable().optional(),
  directorEmail: z.string().nullable().optional(),
  membersCount: z.number().default(0),
  productsCount: z.number().default(0),
  currentUserRoleInProject: ProjectRoleSchema.optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

/**
 * Miembro asignado a un proyecto (con datos enriquecidos de usuario para la UI)
 */
export const ProjectMemberSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  roleInProject: ProjectRoleSchema,
  permissions: z.record(z.unknown()).default({}),
  sckCodes: z.array(z.string()).default([]),
  assignedBy: z.string().uuid().nullable().optional(),
  assignedAt: z.coerce.date(),
  userName: z.string().nullable().optional(),
  userEmail: z.string().nullable().optional(),
  userRole: z.string().nullable().optional(),
  userPhone: z.string().nullable().optional(),
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

/**
 * Entrada para asignar un usuario a un proyecto
 */
export const AssignProjectMemberInputSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  roleInProject: ProjectRoleSchema.default('CLOSER'),
  permissions: z.record(z.unknown()).optional(),
  sckCodes: z.array(z.string()).optional(),
});
export type AssignProjectMemberInput = z.infer<typeof AssignProjectMemberInputSchema>;

/**
 * Entrada para actualizar el rol o permisos de un miembro en el proyecto
 */
export const UpdateProjectMemberInputSchema = z.object({
  roleInProject: ProjectRoleSchema.optional(),
  permissions: z.record(z.unknown()).optional(),
  sckCodes: z.array(z.string()).optional(),
});
export type UpdateProjectMemberInput = z.infer<typeof UpdateProjectMemberInputSchema>;

