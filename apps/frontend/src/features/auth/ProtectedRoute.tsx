import { Navigate, Outlet } from 'react-router-dom';
import { getSessionUser } from './session';
import { UserRole } from './types';

interface Props {
  allowedRoles?: UserRole[];
  systemOwnerOnly?: boolean;
}

export function ProtectedRoute({ allowedRoles, systemOwnerOnly = false }: Props) {
  const user = getSessionUser();
  const normalizedRole =
    user?.role === 'OWNER' ? 'DUENO' : user?.role === 'OPERATOR' ? 'OPERARIO' : user?.role;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (systemOwnerOnly && !user.isSystemOwner) {
    return <Navigate to="/admin" replace />;
  }

  if (allowedRoles && normalizedRole && !allowedRoles.includes(normalizedRole as UserRole)) {
    const home: Record<string, string> = {
      FABRICACION: '/fabricacion',
      LABORATORIO: '/laboratorio',
      ENVASADO: '/envasado',
      MONITOREO: '/historial',
      JEFATURA: '/jefatura',
      ADMIN: '/admin',
      OPERARIO: '/fabricacion'
    };
    return <Navigate to={home[normalizedRole] ?? '/tv'} replace />;
  }

  return <Outlet />;
}
