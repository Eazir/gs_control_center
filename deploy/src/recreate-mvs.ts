import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const sqlFile = path.join(__dirname, '..', '..', '..', 'db_postgres', '12_materialized_views_v2.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    console.log('Dropping old views if they exist...');
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS sales.mv_project_daily_metrics CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS sales.mv_closer_daily_kpis CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS sales.mv_product_daily_kpis CASCADE;`);
    
    console.log('Applying 12_materialized_views_v2.sql...');
    // Split the SQL into individual statements
    const statements = sql
      .replace(/--.*$/gm, '') // Remove all comments
      .split(/(?<=;)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    for (const stmt of statements) {
      if (stmt) {
        await prisma.$executeRawUnsafe(stmt);
      }
    }
    
    console.log('Views recreated successfully.');
  } catch (e) {
    console.error('Error recreating views:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
