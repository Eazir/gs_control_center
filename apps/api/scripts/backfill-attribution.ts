import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SalesService } from '../src/modules/sales/sales.service';

// Cargar variables de entorno tanto si se corre desde raíz como desde apps/api
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const projectId = args.find((a) => a.startsWith('--projectId='))?.split('=')[1];

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const sales = app.get(SalesService);
  const report = await sales.backfillAttribution({ projectId, apply });
  console.info(JSON.stringify(report, null, 2));
  await app.close();
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
