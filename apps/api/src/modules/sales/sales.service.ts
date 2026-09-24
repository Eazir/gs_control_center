import { Injectable } from '@nestjs/common';
// Importación válida y autorizada a través de la interfaz pública:
import { AuthService } from '../auth';

@Injectable()
export class SalesService {
  constructor(private readonly authService: AuthService) {}

  async getSaleDetails(saleId: string, closerId: string) {
    const profile = await this.authService.getProfile(closerId);
    return {
      saleId,
      closer: profile.email,
      amount: 497,
      currency: 'USD',
    };
  }
}
