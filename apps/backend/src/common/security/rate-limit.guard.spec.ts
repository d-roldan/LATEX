import { rateLimitTracker } from './rate-limit.guard';

describe('rateLimitTracker', () => {
  it('uses the client IP for unauthenticated requests', () => {
    expect(rateLimitTracker({ ip: '192.0.2.10', headers: {} })).toBe('ip:192.0.2.10');
  });

  it('uses a non-reversible token fingerprint for authenticated requests', () => {
    const tracker = rateLimitTracker({
      ip: '192.0.2.10',
      headers: { authorization: 'Bearer test-token' }
    });
    expect(tracker).toMatch(/^token:[a-f0-9]{64}$/);
    expect(tracker).not.toContain('test-token');
  });

  it('gives different authenticated sessions independent quotas', () => {
    const first = rateLimitTracker({ headers: { authorization: 'Bearer first' } });
    const second = rateLimitTracker({ headers: { authorization: 'Bearer second' } });
    expect(first).not.toBe(second);
  });
});
