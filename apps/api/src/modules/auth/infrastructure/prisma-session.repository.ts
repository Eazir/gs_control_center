import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database';
import {
  CreateSessionData,
  ISessionRepository,
} from '../domain/ports/session-repository.port';
import { SessionEntity } from '../domain/entities/session.entity';

@Injectable()
export class PrismaSessionRepository implements ISessionRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateSessionData): Promise<SessionEntity> {
    const record = await this.prisma.session.create({
      data: {
        userId: data.userId,
        refreshHash: data.refreshHash,
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null,
        expiresAt: data.expiresAt,
      },
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const record = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findByRefreshHash(hash: string): Promise<SessionEntity | null> {
    const record = await this.prisma.session.findFirst({
      where: {
        refreshHash: hash,
        revokedAt: null,
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async rotateRefreshToken(
    sessionId: string,
    newHash: string,
    newExpiresAt: Date
  ): Promise<SessionEntity> {
    const record = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshHash: newHash,
        expiresAt: newExpiresAt,
      },
    });

    return this.toDomain(record);
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toDomain(record: {
    id: string;
    userId: string;
    refreshHash: string;
    userAgent: string | null;
    ip: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
  }): SessionEntity {
    return new SessionEntity({
      id: record.id,
      userId: record.userId,
      refreshHash: record.refreshHash,
      userAgent: record.userAgent,
      ip: record.ip,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    });
  }
}
