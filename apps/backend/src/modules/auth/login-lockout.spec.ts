import {
  hasExpiredLoginLock,
  LOGIN_LOCKOUT_MS,
  maxFailedLoginAttempts
} from './login-lockout';

describe('login lockout policy', () => {
  it.each(['OPERARIO', 'SUPERVISOR'])('allows 5 failed attempts for %s', (role) => {
    expect(maxFailedLoginAttempts(role)).toBe(5);
  });

  it.each(['ADMIN', 'DUENO'])('allows 10 failed attempts for %s', (role) => {
    expect(maxFailedLoginAttempts(role)).toBe(10);
  });

  it('locks accounts for 15 minutes', () => {
    expect(LOGIN_LOCKOUT_MS).toBe(15 * 60 * 1000);
  });

  it('only resets the counter when a persisted lock has expired', () => {
    const now = new Date('2026-08-05T12:00:00.000Z');
    expect(hasExpiredLoginLock(null, now)).toBe(false);
    expect(hasExpiredLoginLock(new Date('2026-08-05T12:01:00.000Z'), now)).toBe(false);
    expect(hasExpiredLoginLock(new Date('2026-08-05T11:59:00.000Z'), now)).toBe(true);
  });
});
