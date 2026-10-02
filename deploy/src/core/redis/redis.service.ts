import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    const defaultUrl = 'redis://:adminRedis_tyr_051025@127.0.0.1:6379';
    let url = process.env.REDIS_URL || defaultUrl;

    // En Windows host fuera del contenedor Docker, traducir hostname @redis: a @127.0.0.1:
    const fs = require('fs');
    if (url.includes('@redis:') && !fs.existsSync('/.dockerenv')) {
      url = url.replace('@redis:', '@127.0.0.1:');
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Genera un hash SHA-256 para usar como clave segura en Redis (evita guardar el token completo).
   */
  private tokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Agrega un Access Token a la denylist con TTL en segundos (revocación inmediata).
   */
  async addToDenylist(token: string, ttlSeconds: number = 900): Promise<void> {
    const key = `denylist:jwt:${this.tokenHash(token)}`;
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }

  async blacklistToken(token: string, ttlSeconds: number = 900): Promise<void> {
    return this.addToDenylist(token, ttlSeconds);
  }

  /**
   * Verifica si un Access Token está revocado en la denylist.
   */
  async isDenylisted(token: string): Promise<boolean> {
    const key = `denylist:jwt:${this.tokenHash(token)}`;
    const result = await this.client.exists(key);
    return result === 1;
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.isDenylisted(token);
  }


  /**
   * Marca una sesión como revocada globalmente en Redis.
   */
  async revokeSession(sessionId: string, ttlSeconds: number = 604800): Promise<void> {
    const key = `session:revoked:${sessionId}`;
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }

  /**
   * Verifica si una sesión fue revocada en Redis.
   */
  async isSessionRevoked(sessionId: string): Promise<boolean> {
    const key = `session:revoked:${sessionId}`;
    const result = await this.client.exists(key);
    return result === 1;
  }
}
