import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-secret-with-at-least-thirty-two-characters';

function contextFor(token: string) {
  const request = { headers: { authorization: `Bearer ${token}` } } as any;
  return {
    request,
    context: { switchToHttp: () => ({ getRequest: () => request }) } as any
  };
}

describe('JwtAuthGuard session revocation', () => {
  const jwt = new JwtService();
  const payload = {
    sub: 'user-1', companyId: 'company-1', role: 'ADMIN', email: 'a@example.com',
    username: 'admin', fullName: 'Admin', sessionVersion: 2
  };

  it('accepts an active user with the current session version', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({
      sessionVersion: 2, role: 'ADMIN', isProtected: false, isSystemOwner: false
    }) } } as any;
    const guard = new JwtAuthGuard({ get: () => SECRET } as unknown as ConfigService, prisma);
    const { request, context } = contextFor(await jwt.signAsync(payload, { secret: SECRET }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user.sub).toBe('user-1');
  });

  it('rejects a token issued before a session revocation', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({
      sessionVersion: 3, role: 'ADMIN', isProtected: false, isSystemOwner: false
    }) } } as any;
    const guard = new JwtAuthGuard({ get: () => SECRET } as unknown as ConfigService, prisma);
    const { context } = contextFor(await jwt.signAsync(payload, { secret: SECRET }));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
