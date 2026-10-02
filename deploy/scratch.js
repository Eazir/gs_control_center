const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const sales = await prisma.sale.findMany();
  console.log(JSON.stringify(sales, null, 2));
  await prisma.$disconnect();
}

main();
