import { ForbiddenException } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';

describe('AuditLogsController', () => {
  const prisma = {};
  const auditService = { dashboard: jest.fn() };
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
});
