import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'DUENO' | 'SUPERVISOR' | 'OPERARIO' | 'FABRICACION' | 'LABORATORIO' | 'ENVASADO' | 'MONITOREO' | 'ADMIN'>) =>
  SetMetadata(ROLES_KEY, roles);

