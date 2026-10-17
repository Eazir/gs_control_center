import process from 'node:process';
import { PrismaService } from '../src/core/database/prisma.service';
import { CommissionService } from '../src/modules/sales/commission.service';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const APPROVED_STATUSES = [
  'APPROVED',
  'PURCHASE_APPROVED',
  'COMPLETE',
  'PURCHASE_COMPLETE',
  'APROBADO',
  'COMPLETA',
  'COMPLETO',
  'Aprobado',
  'Completo',
];

async function getSourceCount(prisma: PrismaService): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM sales.sales
    WHERE status IN (${APPROVED_STATUSES[0]}, ${APPROVED_STATUSES[1]}, ${APPROVED_STATUSES[2]}, ${APPROVED_STATUSES[3]}, ${APPROVED_STATUSES[4]}, ${APPROVED_STATUSES[5]}, ${APPROVED_STATUSES[6]}, ${APPROVED_STATUSES[7]}, ${APPROVED_STATUSES[8]});
  `;
  return Number(result[0]?.count ?? 0);
}

async function getMvCount(prisma: PrismaService): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ sum: bigint | null }>>`
    SELECT COALESCE(SUM(ventas_totales), 0)::bigint AS sum
    FROM sales.mv_project_daily_metrics;
  `;
  return Number(result[0]?.sum ?? 0);
}

async function main(): Promise<void> {
  console.info('🧪 Iniciando prueba de integración: Consistencia de MVs y refreshMetricsViews (T2)...');
  const prisma = new PrismaService();
  await prisma.$connect();
  const commissionService = new CommissionService(prisma);

  try {
    // 2a. Consistencia fuente vs MV (read-only)
    console.info('2a. Verificando consistencia fuente vs MV...');
    const sourceCount = await getSourceCount(prisma);
    const mvCount = await getMvCount(prisma);
    console.info(`  Conteo fuente: ${sourceCount}, Conteo MV: ${mvCount}`);
    assert(
      sourceCount === mvCount,
      `Inconsistencia: Fuente=${sourceCount} !== MV=${mvCount}`
    );
    console.info('  ✔ Consistencia fuente vs MV verificada.');

    // 2b. refreshMetricsViews() ejecuta sin error y es idempotente
    console.info('2b. Ejecutando refreshMetricsViews()...');
    await commissionService.refreshMetricsViews();
    const mvCountAfterRefresh = await getMvCount(prisma);
    assert(
      mvCountAfterRefresh === sourceCount,
      `Idempotencia falló: Antes=${sourceCount}, Después de refresh=${mvCountAfterRefresh}`
    );
    console.info('  ✔ refreshMetricsViews ejecutado sin errores e idempotente.');

    // 2c. (Integración, con revert) Un reembolso sale del conteo tras el refresco
    console.info('2c. Verificando que un reembolso sale del conteo tras refreshMetricsViews...');
    const targetSale = await prisma.sale.findFirst({
      where: { status: 'COMPLETE' },
      select: { id: true, status: true },
    });
    assert(targetSale !== null, 'No se encontró ninguna venta con status COMPLETE para la prueba 2c');

    const antes = await getMvCount(prisma);

    try {
      await prisma.sale.update({
        where: { id: targetSale!.id },
        data: { status: 'REFUNDED' },
      });

      await commissionService.refreshMetricsViews();
      const despues = await getMvCount(prisma);

      assert(
        despues === antes - 1,
        `El conteo no decrementó correctamente: antes=${antes}, después=${despues}`
      );
      console.info(`  ✔ Reembolso reflejado correctamente: ${antes} -> ${despues}`);
    } finally {
      console.info('  Limpiando y revirtiendo estado de la venta de prueba...');
      await prisma.sale.update({
        where: { id: targetSale!.id },
        data: { status: 'COMPLETE' },
      });
      await commissionService.refreshMetricsViews();
      const restaurado = await getMvCount(prisma);
      console.info(`  ✔ Estado revertido. Conteo restaurado a ${restaurado}`);
    }

    console.info('verify-metrics-refresh: OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Fallo en verify-metrics-refresh:', err);
  process.exit(1);
});
