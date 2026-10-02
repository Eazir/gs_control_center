import { Inject, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/ports/user-repository.port';
import { UserProfile } from '@gs/contracts';
import { UserInactiveError } from '../../domain/errors/auth.errors';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);

    if (!user || !user.isActive()) {
      throw new UserInactiveError();
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
