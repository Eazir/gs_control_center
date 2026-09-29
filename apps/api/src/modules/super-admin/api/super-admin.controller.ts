import {
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../../auth';
import { JwtPayload } from '@gs/contracts';
import { SuperAdminService } from '../application/super-admin.service';

@Controller('super-admin')
@UseGuards(JwtAuthGuard)
export class SuperAdminController {
  constructor(
    @Inject(SuperAdminService) private readonly superAdminService: SuperAdminService
  ) {}

  private checkSuperAdmin(user: JwtPayload) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Exclusivo para SUPER_ADMIN');
    }
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUserCascade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.checkSuperAdmin(user);
    if (id === user.sub) {
      throw new ForbiddenException('No puedes eliminarte a ti mismo');
    }
    await this.superAdminService.deleteUserCascade(id);
    return { success: true, message: `Usuario ${id} eliminado en cascada` };
  }

  @Post('projects/:id/clean')
  @HttpCode(HttpStatus.OK)
  async cleanProject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.checkSuperAdmin(user);
    await this.superAdminService.cleanProject(id);
    return { success: true, message: `Proyecto ${id} limpiado exitosamente` };
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.OK)
  async deleteProjectCascade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.checkSuperAdmin(user);
    await this.superAdminService.deleteProjectCascade(id);
    return { success: true, message: `Proyecto ${id} eliminado completamente` };
  }
}
