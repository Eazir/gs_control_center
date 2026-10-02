import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';

export interface UserPublicProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  phone?: string | null;
}

/**
 * Servicio público del módulo Auth.
 * Único punto de contacto para otros módulos (proyectos, ventas, etc.) según AGENTS.md.
 */
@Injectable()
export class AuthPublicService {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async getUserById(id: string): Promise<UserPublicProfile | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive(),
      phone: user.phone ?? null,
    };
  }

  async getUsersByIds(ids: string[]): Promise<UserPublicProfile[]> {
    if (!ids.length) return [];
    const users = await this.userRepository.findByIds(ids);
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive(),
      phone: user.phone ?? null,
    }));
  }

  async getUserByEmail(email: string): Promise<UserPublicProfile | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive(),
      phone: user.phone ?? null,
    };
  }

  async getProfile(userId: string): Promise<UserPublicProfile> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`Usuario con id ${userId} no encontrado`);
    }
    return user;
  }
}

