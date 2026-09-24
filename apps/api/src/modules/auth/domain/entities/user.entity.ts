import { UserRole, UserStatus } from '@gs/contracts';

export interface UserEntityProps {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  mfaSecretEnc?: string | null;
  mfaEnabled: boolean;
  lastLoginAt?: Date | null;
  failedAttempts: number;
  lockedUntil?: Date | null;
  preferences: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Entidad de dominio User.
 * Encapsula el estado y las reglas de negocio del usuario en auth.users.
 */
export class UserEntity {
  constructor(private readonly props: UserEntityProps) {}

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get phone(): string | null | undefined {
    return this.props.phone;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get mfaEnabled(): boolean {
    return this.props.mfaEnabled;
  }
  get lastLoginAt(): Date | null | undefined {
    return this.props.lastLoginAt;
  }
  get failedAttempts(): number {
    return this.props.failedAttempts;
  }
  get lockedUntil(): Date | null | undefined {
    return this.props.lockedUntil;
  }
  get preferences(): Record<string, unknown> {
    return this.props.preferences;
  }
  get metadata(): Record<string, unknown> {
    return this.props.metadata;
  }
  get createdBy(): string | null | undefined {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt;
  }

  isLocked(): boolean {
    if (!this.props.lockedUntil) return false;
    return this.props.lockedUntil.getTime() > Date.now();
  }

  isActive(): boolean {
    return this.props.status === 'ACTIVE' && !this.props.deletedAt;
  }
}
