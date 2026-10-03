import Redis from 'ioredis';

/**
 * Sonda de salud del rol worker: verifica que el broker de BullMQ responda.
 * El worker no expone HTTP, así que el healthcheck de Docker ejecuta este
 * script y usa su exit code (0 = sano, 1 = no sano).
 */
async function main(): Promise<number> {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    await redis.connect();
    await redis.ping();
    return 0;
  } catch {
    return 1;
  } finally {
    redis.disconnect();
  }
}

void main().then((code) => process.exit(code));
