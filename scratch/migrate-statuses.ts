import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.findMany();
  let updated = 0;

  for (const sale of sales) {
    let newStatus = sale.status;
    const s = sale.status.toUpperCase();

    if (s === 'APPROVED' || s === 'COMPLETED') {
      newStatus = 'PURCHASE_' + s;
    } else if (s === 'COMPLETE') {
      newStatus = 'PURCHASE_COMPLETE';
    } else if (s === 'CANCELED' || s === 'REFUNDED' || s === 'CHARGEBACK' || s === 'DELAYED') {
      newStatus = 'PURCHASE_' + s;
    } else if (s === 'BILLET_PRINTED') {
      newStatus = 'PURCHASE_BILLET_PRINTED';
    } else if (s === 'ABANDONED_CART' || s === 'SHOPPING_CART') {
      newStatus = 'PURCHASE_OUT_OF_SHOPPING_CART';
    } else if (s === 'PROTEST' || s === 'DISPUTE') {
      newStatus = 'PURCHASE_PROTEST';
    }

    if (newStatus !== sale.status) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { status: newStatus }
      });
      updated++;
    }
  }

  console.log(`Successfully migrated ${updated} sales statuses to new PURCHASE_XXX format.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
