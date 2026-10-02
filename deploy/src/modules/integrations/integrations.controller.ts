import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  Query,
  HttpCode,
  Req,
  Logger,
  Inject
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { ProviderType } from '@prisma/client';
import { Request } from 'express';

@Controller()
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);
  private integrationsService: IntegrationsService;

  constructor(
    @Inject(IntegrationsService)
    integrationsService?: IntegrationsService
  ) {
    this.integrationsService = integrationsService ?? new IntegrationsService();
  }

  private getService(): IntegrationsService {
    if (!this.integrationsService) {
      this.integrationsService = new IntegrationsService();
    }
    return this.integrationsService;
  }

  // Soportar tanto la ruta estándar como los aliases de webhooks usados en el frontend
  @Post([
    'integrations/hotmart/webhook/:projectId',
    'webhooks/hotmart/:projectId',
    'webhooks/v1/inbound/:projectId'
  ])
  @HttpCode(200)
  async handleHotmartWebhook(
    @Param('projectId') projectId: string,
    @Headers('x-hotmart-hottok') hottokHeader: string | undefined,
    @Headers() headers: Record<string, string>,
    @Query('hottok') hottokQuery: string | undefined,
    @Body() payload: Record<string, unknown> | unknown,
    @Req() req: Request,
  ) {
    // Extraer el hottok de cualquier origen válido (Header, Body o Query)
    const payloadObj = (typeof payload === 'object' && payload !== null) ? (payload as Record<string, unknown>) : {};
    const hottok =
      hottokHeader ||
      headers['hottok'] ||
      (typeof payloadObj.hottok === 'string' ? payloadObj.hottok : undefined) ||
      hottokQuery ||
      '';

    this.logger.log(`Webhook entrante para proyecto [${projectId}] desde [${req.ip || 'desconocido'}]`);

    return await this.getService().processHotmartWebhook(projectId, hottok, payload);
  }

  @Get('integrations/config/:projectId')
  async getConfig(
    @Param('projectId') projectId: string,
    @Query('provider') provider?: ProviderType
  ) {
    return await this.getService().getConfig(projectId, provider || ProviderType.HOTMART);
  }

  @Post('integrations/config/:projectId')
  async saveConfig(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      provider?: ProviderType;
      credentialsEnc?: string;
      validFrom?: string | null;
      ignoreSubsequent?: boolean;
      isActive?: boolean;
    }
  ) {
    return await this.getService().saveConfig(projectId, body);
  }
}

