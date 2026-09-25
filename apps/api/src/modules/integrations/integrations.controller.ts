import { Controller, Post, Param, Body, Headers, HttpCode, UnauthorizedException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('hotmart/webhook/:projectId')
  @HttpCode(200)
  async handleHotmartWebhook(
    @Param('projectId') projectId: string,
    @Headers('x-hotmart-hottok') hottok: string | undefined,
    @Body() payload: unknown,
  ) {
    if (!hottok) {
      throw new UnauthorizedException('Missing Hottok');
    }
    
    // El servicio valida la firma, guarda en DB y encola
    await this.integrationsService.processHotmartWebhook(projectId, hottok, payload);
    return { received: true };
  }
}
