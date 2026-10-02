import { SessionEntity } from '../entities/session.entity';

export const SESSION_REPOSITORY_TOKEN = Symbol('ISessionRepository');

export interface CreateSessionData {
  userId: string;
  refreshHash: string;
  userAgent?: string | null | undefined;
  ip?: string | null | undefined;
  expiresAt: Date;
}


export interface ISessionRepository {
  create(data: CreateSessionData): Promise<SessionEntity>;
  findById(id: string): Promise<SessionEntity | null>;
  findByRefreshHash(hash: string): Promise<SessionEntity | null>;
  rotateRefreshToken(sessionId: string, newHash: string, newExpiresAt: Date): Promise<SessionEntity>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
