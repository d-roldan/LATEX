import { ForbiddenException } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';

describe('AuditLogsController', () => {
  const prisma = {};
  const auditService = { dashboard: jest.fn(), userActivity: jest.fn() };
  const controller = new AuditLogsController(prisma as never, auditService as never);
  const baseUser = {
    sub: 'admin-1',
    companyId: 'company-1',
    role: 'ADMIN',
    email: 'admin@disal.local',
    username: 'admin',
    fullName: 'Administrador',
    sessionVersion: 0
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.dashboard.mockResolvedValue({ summary: {}, users: [], activity: { items: [] } });
    auditService.userActivity.mockResolvedValue({ items: [], total: 0 });
  });

  it('rechaza a un administrador que no es Super Usuario', () => {
    expect(() => controller.dashboard(baseUser)).toThrow(ForbiddenException);
    expect(auditService.dashboard).not.toHaveBeenCalled();
  });

  it('permite al Super Usuario consultar la auditoría integral', async () => {
    await controller.dashboard({ ...baseUser, isSystemOwner: true });

    expect(auditService.dashboard).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({
        page: 1,
        limit: 25,
        source: undefined,
        action: undefined
      })
    );
  });

  it('consulta el historial cronológico del usuario dentro de la empresa', async () => {
    await controller.userActivity(
      { ...baseUser, isSystemOwner: true },
      'user-2',
      '2026-09-20T00:00:00-03:00',
      '2026-09-20T23:59:59.999-03:00',
      '2',
      '50'
    );

    expect(auditService.userActivity).toHaveBeenCalledWith(
      'company-1',
      'user-2',
      new Date('2026-09-20T00:00:00-03:00'),
      new Date('2026-09-20T23:59:59.999-03:00'),
      2,
      50
    );
  });

  it('rechaza el historial de usuario a un administrador que no es Super Usuario', () => {
    expect(() => controller.userActivity(baseUser, 'user-2')).toThrow(ForbiddenException);
    expect(auditService.userActivity).not.toHaveBeenCalled();
  });
});
