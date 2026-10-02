export interface SessionEntityProps {
  id: string;
  userId: string;
  refreshHash: string;
  userAgent?: string | null;
  ip?: string | null;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

/**
 * Entidad de dominio Session.
 * Representa una sesión activa o revocada de un usuario en auth.sessions.
 */
export class SessionEntity {
  constructor(private readonly props: SessionEntityProps) {}

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get refreshHash(): string {
    return this.props.refreshHash;
  }
  get userAgent(): string | null | undefined {
    return this.props.userAgent;
  }
  get ip(): string | null | undefined {
    return this.props.ip;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get revokedAt(): Date | null | undefined {
    return this.props.revokedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  isValid(): boolean {
    if (this.props.revokedAt) return false;
    return this.props.expiresAt.getTime() > Date.now();
  }
}
