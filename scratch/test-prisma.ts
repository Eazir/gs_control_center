import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const projectId = 'b4a45a30-8025-4c07-b676-e103da4e9ec6'; // Reemplazar con real
  const leadId = '...';

  // Buscar el primer lead
  const lead = await prisma.lead.findFirst();
  console.log("Lead found:", lead?.id);
  
  if (!lead) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          situacion: 'POR_PAGAR',
        }
      });
      console.log("Updated situacion to POR_PAGAR");
    });
  } catch (e) {
    console.error("Error in transaction:", e);
  }
}

run().finally(() => prisma.$disconnect());
