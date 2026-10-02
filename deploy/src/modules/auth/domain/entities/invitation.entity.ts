import { UserRole } from '@gs/contracts';

export interface InvitationEntityProps {
  id: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  invitedById: string;
  invitedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  } | null;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
}

/**
 * Entidad de dominio Invitation.
 * Representa una invitación enviada a un nuevo usuario en auth.invitations.
 */
export class InvitationEntity {
  constructor(private readonly props: InvitationEntityProps) {}

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get invitedById(): string {
    return this.props.invitedById;
  }
  get invitedBy(): { id: string; fullName: string; email: string; role: UserRole } | null | undefined {
    return this.props.invitedBy;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get acceptedAt(): Date | null | undefined {
    return this.props.acceptedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  isValid(): boolean {
    if (this.props.acceptedAt) return false;
    return this.props.expiresAt.getTime() > Date.now();
  }
}
