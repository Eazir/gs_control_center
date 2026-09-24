import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';

export interface ActiveCloserItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * Retorna únicamente los usuarios con role CLOSER y status ACTIVE.
 * Accesible para SUPER_ADMIN, ADMIN y DIRECTOR.
 * A diferencia de ListUsersUseCase, no bloquea a DIRECTOR.
 */
@Injectable()
export class ListActiveClosersUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(currentUserRole: UserRole): Promise<ActiveCloserItem[]> {
    const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR'];
    if (!allowedRoles.includes(currentUserRole)) {
      throw new ForbiddenException(
        'No tienes permisos para consultar la lista de closers activos.'
      );
    }

    const allUsers = await this.userRepository.findAll();

    return allUsers
      .filter((u) => u.role === 'CLOSER' && u.status === 'ACTIVE')
      .map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone ?? null,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
      }));
  }
}
