import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT * FROM sales.mv_daily_kpis LIMIT 1`;
    console.log("mv_daily_kpis:", result);
  } catch (e) {
    console.error("mv_daily_kpis error:", e);
  }
}

main().finally(() => prisma.$disconnect());
