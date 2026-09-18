import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    companyId: 'company-1',
    email: 'usuario@disal.local',
    username: 'usuario',
    fullName: 'Usuario Prueba',
    passwordHash: 'hash',
    role: 'FABRICACION',
    isProtected: false,
    isSystemOwner: false,
    sessionVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    company: { id: 'company-1', name: 'DISAL', isActive: true }
  };
  const prisma = {
    user: {
      findMany: jest.fn(),
      update: jest.fn()
    }
  };
  const jwtService = { signAsync: jest.fn() };
  const configService = { get: jest.fn() };
  const auditService = { log: jest.fn() };
  const service = new AuthService(
    prisma as never,
    jwtService as never,
    configService as never,
    auditService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([user]);
    prisma.user.update.mockResolvedValue({ failedLoginAttempts: 1 });
    configService.get.mockImplementation((key: string, fallback?: string) =>
      key === 'JWT_SECRET' ? 'test-secret' : fallback
    );
    jwtService.signAsync.mockResolvedValue('token');
    auditService.log.mockResolvedValue(undefined);
  });

  it('registra un intento fallido para un usuario conocido', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ identifier: user.username, password: 'incorrecta' })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditService.log).toHaveBeenCalledWith({
      companyId: user.companyId,
      userId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'LOGIN',
      metadata: { result: 'FAILED', failedAttempts: 1 }
    });
  });

  it('identifica explícitamente un ingreso correcto', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ identifier: user.username, password: 'correcta' })
    ).resolves.toEqual(expect.objectContaining({ accessToken: 'token' }));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: user.companyId,
        userId: user.id,
        action: 'LOGIN',
        metadata: { email: user.email, result: 'SUCCESS' }
      })
    );
  });
});
