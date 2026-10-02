import {
  LoginInput,
  LoginInputSchema,
  LoginResponse,
  LoginResponseSchema,
} from '@gs/contracts';
import { BadRequestException, PipeTransform } from '@nestjs/common';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: { errors: Array<{ path: (string | number)[]; message: string }> } } }) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success && result.error) {
      const messages = result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new BadRequestException({
        statusCode: 400,
        message: 'Error de validación',
        errors: messages,
      });
    }
    return result.data;
  }
}

export { LoginInputSchema, type LoginInput, LoginResponseSchema, type LoginResponse };
