import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@gs/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface UserMetrics {
  total: number;
  active: number;
  invited: number;
  suspended: number;
}

export interface ListUsersOutput {
  users: UserListItem[];
  metrics: UserMetrics;
}

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(currentUserId: string, currentUserRole: UserRole): Promise<ListUsersOutput> {
    const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR'];
    if (!allowedRoles.includes(currentUserRole)) {
      throw new ForbiddenException('No tienes permisos para consultar la lista de usuarios.');
    }

    const allUsers = await this.userRepository.findAll();

    // Regla de privacidad y seguridad:
    // Solo el SUPER_ADMIN puede verse a sí mismo en la gestión de usuarios (nadie más puede verlo).
    // Si es ADMIN, solo puede ver roles operativos y clientes: DIRECTOR, CLOSER, CLIENTE
    // Si es DIRECTOR, solo puede ver a los CLOSER
    const allowedRolesForAdmin: UserRole[] = ['DIRECTOR', 'CLOSER', 'CLIENTE'];
    const allowedRolesForDirector: UserRole[] = ['CLOSER'];

    const filteredUsers = allUsers.filter((u) => {
      if (u.role === 'SUPER_ADMIN') {
        // Solo el propio Super Admin logueado puede verse a sí mismo
        return currentUserRole === 'SUPER_ADMIN' && u.id === currentUserId;
      }
      if (currentUserRole === 'ADMIN') {
        return allowedRolesForAdmin.includes(u.role);
      }
      if (currentUserRole === 'DIRECTOR') {
        return allowedRolesForDirector.includes(u.role);
      }
      return true;
    });

    const users: UserListItem[] = filteredUsers.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone ?? null,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? null,
    }));

    const metrics: UserMetrics = {
      total: users.length,
      active: users.filter((u) => u.status === 'ACTIVE').length,
      invited: users.filter((u) => u.status === 'INVITED').length,
      suspended: users.filter((u) => u.status === 'SUSPENDED').length,
    };

    return {
      users,
      metrics,
    };
  }
}
