import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database';

import {
  CreateInvitationData,
  IInvitationRepository,
} from '../domain/ports/invitation-repository.port';
import { InvitationEntity } from '../domain/entities/invitation.entity';
import { UserRole } from '@gs/contracts';

@Injectable()
export class PrismaInvitationRepository implements IInvitationRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(data: CreateInvitationData): Promise<InvitationEntity> {
    const record = await this.prisma.invitation.create({
      data: {
        email: data.email.toLowerCase(),
        role: data.role as UserRole,
        tokenHash: data.tokenHash,
        invitedById: data.invitedById ?? '00000000-0000-0000-0000-000000000000',
        expiresAt: data.expiresAt,
      },
    });

    return this.toDomain(record);
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationEntity | null> {
    const record = await this.prisma.invitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findById(id: string): Promise<InvitationEntity | null> {
    const record = await this.prisma.invitation.findUnique({
      where: { id },
      include: {
        invitedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findAll(): Promise<InvitationEntity[]> {
    const records = await this.prisma.invitation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return records.map((record) => this.toDomain(record));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invitation.delete({
      where: { id },
    });
  }

  async updateToken(id: string, tokenHash: string, expiresAt: Date): Promise<InvitationEntity> {
    const record = await this.prisma.invitation.update({
      where: { id },
      data: {
        tokenHash,
        expiresAt,
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return this.toDomain(record);
  }

  async markAccepted(id: string): Promise<InvitationEntity> {
    const record = await this.prisma.invitation.update({
      where: { id },
      data: {
        acceptedAt: new Date(),
      },
    });

    return this.toDomain(record);
  }

  private toDomain(record: {
    id: string;
    email: string;
    role: string;
    tokenHash: string;
    invitedById: string;
    invitedBy?: {
      id: string;
      fullName: string;
      email: string;
      role: string;
    } | null;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }): InvitationEntity {
    return new InvitationEntity({
      id: record.id,
      email: record.email,
      role: record.role as UserRole,
      tokenHash: record.tokenHash,
      invitedById: record.invitedById,
      invitedBy: record.invitedBy
        ? {
            id: record.invitedBy.id,
            fullName: record.invitedBy.fullName,
            email: record.invitedBy.email,
            role: record.invitedBy.role as UserRole,
          }
        : null,
      expiresAt: record.expiresAt,
      acceptedAt: record.acceptedAt,
      createdAt: record.createdAt,
    });
  }
}
