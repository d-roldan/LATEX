export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export function maxFailedLoginAttempts(role: string): number {
  return role === 'ADMIN' || role === 'DUENO' ? 10 : 5;
}

export function hasExpiredLoginLock(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() <= now.getTime();
}
