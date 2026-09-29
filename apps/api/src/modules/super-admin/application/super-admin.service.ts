import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../../core/database';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Elimina un usuario en cascada.
   * Si es CLOSER, preserva la info financiera (sales/leads) poniendo closerId a null.
   * Elimina sus sesiones, invitaciones y proyectos asignados.
   */
  async deleteUserCascade(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Quitar closerId de las ventas (preservar valor contable)
      await tx.sale.updateMany({
        where: { closerId: userId },
        data: { closerId: null },
      });

      // 2. Quitar closerId de los leads
      await tx.lead.updateMany({
        where: { closerId: userId },
        data: { closerId: null },
      });

      // 3. Eliminar sesiones
      await tx.session.deleteMany({
        where: { userId },
      });

      // 4. Eliminar roles en proyectos
      await tx.projectUser.deleteMany({
        where: { userId },
      });

      // 5. Eliminar finalmente el usuario
      await tx.user.delete({
        where: { id: userId },
      });
      
      this.logger.warn(`Usuario ${userId} eliminado en cascada por SUPER_ADMIN.`);
    });
  }

  /**
   * Vacía las tablas transaccionales de un proyecto, 
   * manteniendo su información base, configuración y equipo.
   */
  async cleanProject(projectId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Borrar eventos de integración (historial de webhooks)
      await tx.integrationEvent.deleteMany({ where: { projectId } });

      // Borrar ventas (necesario antes que leads por la relación FK en el schema)
      await tx.sale.deleteMany({ where: { projectId } });

      // Borrar leads
      await tx.lead.deleteMany({ where: { projectId } });

      this.logger.warn(`Proyecto ${projectId} ha sido limpiado por SUPER_ADMIN.`);
    });
  }

  /**
   * Elimina completamente el proyecto de la base de datos (hard delete).
   */
  async deleteProjectCascade(projectId: string) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Vaciar contenido
      await tx.integrationEvent.deleteMany({ where: { projectId } });
      await tx.sale.deleteMany({ where: { projectId } });
      await tx.lead.deleteMany({ where: { projectId } });

      // 2. Eliminar integraciones y configuraciones
      await tx.integrationConfig.deleteMany({ where: { projectId } });

      // 3. Eliminar miembros del proyecto
      await tx.projectUser.deleteMany({ where: { projectId } });

      // 4. Eliminar el proyecto
      await tx.project.delete({ where: { id: projectId } });
      
      this.logger.warn(`Proyecto ${projectId} eliminado completamente por SUPER_ADMIN.`);
    });
  }
}
