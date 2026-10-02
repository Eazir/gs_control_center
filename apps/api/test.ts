const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  await prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW sales.mv_project_daily_metrics");
  await prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW sales.mv_closer_daily_kpis");
  await prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW sales.mv_product_daily_kpis");
  const raw = await prisma.$queryRawUnsafe("SELECT SUM(marketing_ventas) as mk, SUM(comercial_ventas) as co FROM sales.mv_project_daily_metrics");
  console.log("Refreshed! Marketing ventas:", raw);
  process.exit(0);
})();
