export interface JwtUser {
  sub: string;
  companyId: string;
  role: 'DUENO' | 'SUPERVISOR' | 'OPERARIO' | 'FABRICACION' | 'LABORATORIO' | 'ENVASADO' | 'MONITOREO' | 'JEFATURA' | 'ADMIN' | 'OWNER' | 'OPERATOR';
  email: string;
  username: string;
  fullName: string;
  isProtected?: boolean;
  isSystemOwner?: boolean;
  sessionVersion: number;
}

