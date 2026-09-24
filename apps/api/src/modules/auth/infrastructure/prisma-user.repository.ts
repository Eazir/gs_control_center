import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database';

import {
  CreateUserData,
  IUserRepository,
  UpdateUserData,
} from '../domain/ports/user-repository.port';
import { UserEntity } from '../domain/entities/user.entity';
import { UserRole, UserStatus } from '@gs/contracts';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (!ids.length) return [];
    const records = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findAll(): Promise<UserEntity[]> {
    const records = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return records.map((record) => this.toDomain(record));
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const record = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        phone: data.phone ?? null,
        role: data.role as UserRole,
        status: (data.status as UserStatus) ?? 'INVITED',
        createdBy: data.createdBy ?? null,
        preferences: (data.preferences ?? {}) as Prisma.InputJsonValue,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return this.toDomain(record);
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    const updatePayload: Prisma.UserUpdateInput = {};

    if (data.email !== undefined) updatePayload.email = data.email.toLowerCase();
    if (data.passwordHash !== undefined) updatePayload.passwordHash = data.passwordHash;
    if (data.fullName !== undefined) updatePayload.fullName = data.fullName;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.role !== undefined) updatePayload.role = data.role as UserRole;
    if (data.status !== undefined) updatePayload.status = data.status as UserStatus;
    if (data.lastLoginAt !== undefined) updatePayload.lastLoginAt = data.lastLoginAt;
    if (data.failedAttempts !== undefined) updatePayload.failedAttempts = data.failedAttempts;
    if (data.lockedUntil !== undefined) updatePayload.lockedUntil = data.lockedUntil;
    if (data.preferences !== undefined)
      updatePayload.preferences = data.preferences as Prisma.InputJsonValue;
    if (data.metadata !== undefined)
      updatePayload.metadata = data.metadata as Prisma.InputJsonValue;

    const record = await this.prisma.user.update({
      where: { id },
      data: updatePayload,
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  private toDomain(record: {
    id: string;
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string | null;
    role: string;
    status: string;
    mfaSecretEnc: string | null;
    mfaEnabled: boolean;
    lastLoginAt: Date | null;
    failedAttempts: number;
    lockedUntil: Date | null;
    preferences: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): UserEntity {
    return new UserEntity({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      fullName: record.fullName,
      phone: record.phone,
      role: record.role as UserRole,
      status: record.status as UserStatus,
      mfaSecretEnc: record.mfaSecretEnc,
      mfaEnabled: record.mfaEnabled,
      lastLoginAt: record.lastLoginAt,
      failedAttempts: record.failedAttempts,
      lockedUntil: record.lockedUntil,
      preferences: (record.preferences as Record<string, unknown>) ?? {},
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
