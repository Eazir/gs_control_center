import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../core/redis';
import { Resend } from 'resend';
import { SendEmailEvent } from '@gs/contracts/src/communications/email.schema';

@Injectable()
export class CommunicationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommunicationsWorker.name);
  private readonly QUEUE_NAME = 'queue:emails';
  private readonly resend: Resend;
  private isRunning = false;

  constructor(
    @Inject(RedisService)
    private readonly redis: RedisService
  ) {
    // Si no hay API key, inicializar de todos modos pero advirtiendo
    const resendApiKey = process.env.RESEND_API_KEY || 're_dummy';
    this.resend = new Resend(resendApiKey);
  }

  onModuleInit() {
    // Solo iniciar el worker si estamos en rol 'worker' o si el sistema es monolith puro
    const roleArg = process.argv.find((arg) => arg.startsWith('--role='));
    const role = roleArg?.split('=')[1]?.trim() || 'api';
    
    // En este proyecto, asumimos que 'api' también puede procesar en dev, pero en prod
    // lo ideal sería separarlo. Para simplificar, lo iniciamos si es api o worker.
    if (role === 'worker' || role === 'api') {
      this.isRunning = true;
      this.logger.log(`Iniciando worker de comunicaciones (Rol: ${role})`);
      this.processQueue();
    }
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  private async processQueue() {
    const redisClient = this.redis.getClient();
    
    while (this.isRunning) {
      try {
        // brpop extrae de la cola y espera hasta 5 segundos si está vacía
        const result = await redisClient.brpop(this.QUEUE_NAME, 5);
        if (result) {
          const [, message] = result;
          const job = JSON.parse(message);
          await this.handleEmailJob(job.data as SendEmailEvent, job.id);
        }
      } catch (error) {
        this.logger.error('Error procesando la cola de emails', error);
        // Pequeña pausa para no saturar en caso de error continuo
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async handleEmailJob(event: SendEmailEvent, jobId: string) {
    this.logger.log(`Procesando envío de email [${event.template}] para ${event.to}`);

    try {
      const htmlContent = this.renderTemplate(event);
      
      if (process.env.RESEND_API_KEY) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'GrowthShell <noreply@growth-sell.xyz>', // Dominio verificado de la plataforma
          to: event.to,
          subject: event.subject,
          html: htmlContent,
        });
        
        if (result.error) {
           this.logger.error(`Resend devolvió error: ${JSON.stringify(result.error)}`);
        } else {
           this.logger.log(`Email enviado con éxito (ID: ${result.data?.id})`);
        }
      } else {
        // Modo simulación si no hay API Key
        this.logger.warn(`Simulando envío (No hay RESEND_API_KEY). Contenido: ${event.subject}`);
      }
    } catch (error) {
      this.logger.error(`Falló el envío de correo para el trabajo ${jobId}`, error);
      // En un entorno de producción real, aquí podríamos re-encolar a una cola de fallos (DLQ)
    }
  }

  private renderTemplate(event: SendEmailEvent): string {
    const primaryColor = '#10B981'; // Color principal de marca
    const actionUrl = event.payload.link || '#';
    const actionText = event.template === 'USER_INVITATION' ? 'Activar cuenta' : 'Cambiar contraseña';
    const message = event.template === 'USER_INVITATION' 
      ? `Has sido invitado a formar parte de <b>GrowthShell</b>. Para activar tu cuenta y configurar tu contraseña, haz clic en el siguiente botón.`
      : `Hemos recibido una solicitud para cambiar tu contraseña. Haz clic en el botón de abajo para establecer una nueva.`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">GrowthShell</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155;">
          <h2 style="margin-top: 0;">Hola,</h2>
          <p style="font-size: 16px; line-height: 1.5;">${message}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" style="background-color: ${primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              ${actionText}
            </a>
          </div>
          <p style="font-size: 14px; color: #64748b;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${actionUrl}" style="color: ${primaryColor};">${actionUrl}</a>
          </p>
          ${event.template === 'PASSWORD_RECOVERY' ? '<p style="font-size: 14px; color: #64748b;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>' : ''}
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">© ${new Date().getFullYear()} GrowthShell. Todos los derechos reservados.</p>
        </div>
      </div>
    `;
  }
}
