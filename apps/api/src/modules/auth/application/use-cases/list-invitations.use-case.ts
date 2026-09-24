import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IInvitationRepository,
  INVITATION_REPOSITORY_TOKEN,
} from '../../domain/ports/invitation-repository.port';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

export interface InvitationListItem {
  id: string;
  email: string;
  role: UserRole;
  invitedById: string;
  invitedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  } | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  status: InvitationStatus;
}

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY_TOKEN)
    private readonly invitationRepository: IInvitationRepository
  ) {}

  async execute(currentUserRole: UserRole): Promise<{ invitations: InvitationListItem[] }> {
    if (currentUserRole !== 'SUPER_ADMIN' && currentUserRole !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para consultar las invitaciones.');
    }

    const records = await this.invitationRepository.findAll();
    const now = new Date();

    const invitations: InvitationListItem[] = records.map((inv) => {
      let status: InvitationStatus = 'PENDING';
      if (inv.acceptedAt) {
        status = 'ACCEPTED';
      } else if (new Date(inv.expiresAt) < now) {
        status = 'EXPIRED';
      }

      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedById: inv.invitedById,
        invitedBy: inv.invitedBy ?? null,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt ?? null,
        createdAt: inv.createdAt,
        status,
      };
    });

    return { invitations };
  }
}
