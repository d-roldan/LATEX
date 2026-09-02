import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { JwtUser } from './jwt-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private normalizeRole(role: JwtUser['role'] | undefined): Exclude<JwtUser['role'], 'OWNER' | 'OPERATOR'> | undefined {
    if (!role) {
      return undefined;
    }

    if (role === 'OWNER') {
      return 'DUENO';
    }

    if (role === 'OPERATOR') {
      return 'OPERARIO';
    }

    return role;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<JwtUser['role']>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const normalizedRole = this.normalizeRole(request.user?.role);

    if (request.user?.isSystemOwner) {
      return true;
    }

    if (!request.user || !normalizedRole || !requiredRoles.includes(normalizedRole)) {
      throw new ForbiddenException('No tenes permisos para esta accion');
    }

    return true;
  }
}
