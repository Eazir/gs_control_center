import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { CommissionConfig } from '@gs/contracts';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * Recalcula todas las comisiones de un closer en un mes específico para un proyecto.
   * Debe llamarse cuando una venta se crea, se aprueba, se reembolsa, o se elimina.
   */
  async reconcileCloserCommissions(projectId: string, closerId: string, monthDate: Date) {
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { commissionConfig: true }
    });

    if (!project) return;
    const config = (project.commissionConfig || {}) as unknown as CommissionConfig;
    
    // Obtener todas las ventas válidas del closer en el mes, ordenadas por fecha de pago/creación
    const sales = await this.prisma.sale.findMany({
      where: {
        projectId,
        closerId,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        status: { in: ['APPROVED', 'PURCHASE_APPROVED', 'COMPLETE', 'PURCHASE_COMPLETE', 'APROBADO', 'COMPLETA', 'COMPLETO', 'Aprobado', 'Completo'] }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Separaremos el acumulado por grupos para poder calcular los escalones correctamente
    const accumulatedByGroup = new Map<string, number>();

    for (const sale of sales) {
      const amount = Number(sale.amount);
      const productName = sale.productName || '';

      // 1. Identificar si el producto pertenece a un CommissionGroup
      let matchedGroup = config.groups?.find(g => g.productIds.includes(productName));
      // Si el productName es un ID, puede que coincida con productIds, si es nombre, asumimos matching temporal
      // Idealmente, las ventas tienen productId, pero si no, usamos match string
      if (!matchedGroup) {
        matchedGroup = config.groups?.find(g => g.name.toLowerCase() === productName.toLowerCase());
      }

      let closerPercent = config.defaultCloserPercentage ?? 10; // Fallback

      if (matchedGroup) {
        const acc = accumulatedByGroup.get(matchedGroup.id) || 0;
        
        // Buscar el escalón (tier) aplicable
        // Ordenamos los tiers por umbral descendente para encontrar el más alto que hayamos superado
        let appliedPercent = matchedGroup.basePercentages.closer;
        if (matchedGroup.goals && matchedGroup.goals.length > 0) {
          const goals = matchedGroup.goals[0]; // Tomamos la primera meta del grupo
          if (goals && goals.tiers && goals.tiers.length > 0) {
            const sortedTiers = [...goals.tiers].sort((a, b) => b.revenueThreshold - a.revenueThreshold);
            for (const tier of sortedTiers) {
              if (acc >= tier.revenueThreshold) {
                appliedPercent = tier.percentages.closer;
                break;
              }
            }
          }
        }
        closerPercent = appliedPercent;
        accumulatedByGroup.set(matchedGroup.id, acc + amount);
      } else {
        // Logica global (fuera de grupos)
        // Podríamos aplicar tiers globales si los hubiera en la configuración
      }

      // Calcular monto de comisión (redondeado a 2 decimales para evitar errores de coma flotante)
      const commissionAmount = Math.round(amount * (closerPercent / 100) * 100) / 100;

      // Actualizar la venta si la comisión calculada difiere de la actual
      const currentCommission = sale.commissionAmount ? Number(sale.commissionAmount.toString()) : 0;
      if (currentCommission !== commissionAmount) {
        await this.prisma.sale.update({
          where: { id: sale.id },
          data: { commissionAmount }
        });
      }
    }

    // Refrescar vistas materializadas para que el dashboard refleje los cambios
    try {
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_project_daily_metrics;`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_closer_daily_kpis;`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW sales.mv_product_daily_kpis;`);
    } catch (e) {
      this.logger.error(`Error refrescando vistas tras recalcular comisiones:`, e);
    }
  }
}
