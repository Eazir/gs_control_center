import { z } from 'zod';

export const EmailTemplateSchema = z.enum([
  'USER_INVITATION',
  'PASSWORD_RECOVERY',
]);

export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

export const SendEmailEventSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  template: EmailTemplateSchema,
  payload: z.record(z.any()), // Plantilla dinámica
});

export type SendEmailEvent = z.infer<typeof SendEmailEventSchema>;
