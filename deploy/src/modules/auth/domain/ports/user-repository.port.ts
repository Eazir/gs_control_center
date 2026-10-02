import { UserRole, UserStatus } from '@gs/contracts';
import { UserEntity } from '../entities/user.entity';

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  status?: UserStatus;
  createdBy?: string | null;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserData {
  email?: string | undefined;
  passwordHash?: string | undefined;
  fullName?: string | undefined;
  phone?: string | null | undefined;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  lastLoginAt?: Date | undefined;
  failedAttempts?: number | undefined;
  lockedUntil?: Date | null | undefined;
  preferences?: Record<string, unknown> | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  findByIds(ids: string[]): Promise<UserEntity[]>;
  findAll(): Promise<UserEntity[]>;
  create(data: CreateUserData): Promise<UserEntity>;
  update(id: string, data: UpdateUserData): Promise<UserEntity>;
  delete(id: string): Promise<void>;
}
