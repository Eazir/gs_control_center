import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@gs/contracts';
import { AppAction } from './actions';
import { AppSubject, Lead, Project, Sale, User, Invitation } from './subjects';

export interface UserContext {
  id: string;
  role: UserRole;
  email?: string;
  assignedProjectIds?: string[];
}

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

/**
 * Factoría de habilidades de CASL que implementa la matriz de autorización
 * de los 5 roles canónicos de GrowthSell según AGENTS.md:
 * SUPER_ADMIN > ADMIN > DIRECTOR > CLOSER > CLIENTE
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN': {
        // Acceso administrativo global
        can('manage', 'all');
        break;
      }

      case 'DIRECTOR': {
        // Dirección comercial: gestión de closers, leads y ventas asignadas
        can('read', Project);
        can('update', Project);
        can('manage', Lead);
        can('manage', 'Closer');
        can('read', Sale);
        can(['read', 'create'], Invitation);
        can('read', 'Dashboard');
        can('read', User);
        break;
      }

      case 'CLOSER': {
        // Regla no negociable de AGENTS.md:
        // CLOSER solo ve y edita sus leads asignados. Jamás información operativa de otros closers.
        can('read', Lead, { closerId: user.id });
        can('update', Lead, { closerId: user.id });
        can('read', Sale);
        can('read', 'Dashboard');

        // Prohibiciones explícitas:
        cannot('read', 'Closer');
        cannot('manage', Project);
        cannot('manage', Invitation);
        cannot('manage', User);
        break;
      }

      case 'CLIENTE': {
        // Regla no negociable de AGENTS.md:
        // CLIENTE es solo lectura del dashboard de su proyecto; JAMÁS datos de contacto de leads ni info operativa de closers.
        can('read', 'Dashboard');
        can('read', Project);

        // Prohibiciones estrictas e innegociables:
        cannot('read', Lead);
        cannot('read', 'Closer');
        cannot('manage', Invitation);
        break;
      }

      default: {
        cannot('manage', 'all');
      }
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<AppSubject>,
    });
  }
}
