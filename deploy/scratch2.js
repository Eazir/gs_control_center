const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: '534e9983-9e10-4141-beda-ea24e52a439f' },
    select: { products: true, members: true }
  });
  console.log(JSON.stringify(project, null, 2));
  await prisma.$disconnect();
}

main();
