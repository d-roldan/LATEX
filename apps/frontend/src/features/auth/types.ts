export type UserRole = 'DUENO' | 'SUPERVISOR' | 'OPERARIO' | 'FABRICACION' | 'LABORATORIO' | 'ENVASADO' | 'MONITOREO' | 'JEFATURA' | 'ADMIN';
export type LegacyUserRole = UserRole | 'OWNER' | 'OPERATOR';

export interface SessionUser {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  username: string;
  role: LegacyUserRole;
  companyName: string;
  isProtected?: boolean;
  isSystemOwner?: boolean;
}

export interface SessionData {
  accessToken: string;
  user: SessionUser;
}

