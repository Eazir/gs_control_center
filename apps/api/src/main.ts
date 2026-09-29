import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// Cargar variables de entorno (.env de la raíz y local)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function bootstrap() {
  const args = process.argv.slice(2);
  const roleArg = args.find((arg) => arg.startsWith('--role='));
  const role = roleArg?.split('=')[1]?.trim() || 'api';

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Aumentar límite del body para importaciones CSV masivas (default: 100KB)
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  app.use(cookieParser());

  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'],
    credentials: true,
  });


  // Healthcheck endpoint estándar para Docker
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/health', (_req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    res.status(200).json({ status: 'ok', role, timestamp: new Date().toISOString() });
  });

  if (role === 'worker') {
    console.info('[Worker] Proceso worker inicializado en modo background.');
    // En worker no es obligatorio exponer puerto HTTP, pero inicializamos el contexto de aplicación
    await app.init();
    return;
  }

  const port = role === 'ingest' ? Number(process.env.INGEST_PORT || 3002) : Number(process.env.PORT || 3001);
  await app.listen(port);
  console.info(`[${role.toUpperCase()}] Servicio iniciado en el puerto ${port} (v1.0.2)`);
}

bootstrap().catch((err: unknown) => {
  console.error('Error fatal al iniciar la aplicación:', err);
  process.exit(1);
});
