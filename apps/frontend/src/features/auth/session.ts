import { LegacyUserRole, SessionData } from './types';

const SESSION_KEY = 'disal.session';

function getStoredSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function normalizeRole(role: string): LegacyUserRole {
  if (role === 'OWNER') return 'DUENO';
  if (role === 'OPERATOR') return 'OPERARIO';
  if (['DUENO', 'SUPERVISOR', 'OPERARIO', 'FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN'].includes(role)) return role as LegacyUserRole;
  return 'OPERARIO';
}

export function getSession(): SessionData | null {
  const raw = getStoredSession();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.user?.role) {
      return parsed;
    }

    const normalized = {
      ...parsed,
      user: {
        ...parsed.user,
        role: normalizeRole(parsed.user.role)
      }
    };

    if (normalized.user.role !== parsed.user.role) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getSessionUser() {
  return getSession()?.user ?? null;
}

export function getAccessToken(): string | null {
  return getSession()?.accessToken ?? null;
}

export function setSession(session: SessionData | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSessionAndRedirect(): void {
  setSession(null);
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}
