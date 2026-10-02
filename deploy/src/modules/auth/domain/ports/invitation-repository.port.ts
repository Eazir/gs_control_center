import { UserRole } from '@gs/contracts';
import { InvitationEntity } from '../entities/invitation.entity';

export const INVITATION_REPOSITORY_TOKEN = Symbol('IInvitationRepository');

export interface CreateInvitationData {
  email: string;
  role: UserRole;
  tokenHash: string;
  invitedById?: string | null;
  expiresAt: Date;
}

export interface IInvitationRepository {
  create(data: CreateInvitationData): Promise<InvitationEntity>;
  findByTokenHash(tokenHash: string): Promise<InvitationEntity | null>;
  findById(id: string): Promise<InvitationEntity | null>;
  findAll(): Promise<InvitationEntity[]>;
  delete(id: string): Promise<void>;
  updateToken(id: string, tokenHash: string, expiresAt: Date): Promise<InvitationEntity>;
  markAccepted(id: string): Promise<InvitationEntity>;
}
