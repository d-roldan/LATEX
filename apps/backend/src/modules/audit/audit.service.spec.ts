import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    user: { findFirst: jest.fn() },
    auditLog: { findMany: jest.fn(), count: jest.fn() },
    plantAuditLog: { findMany: jest.fn(), count: jest.fn() }
  };
  const service = new AuditService(prisma as never);
  const from = new Date('2026-09-20T03:00:00.000Z');
  const to = new Date('2026-09-21T02:59:59.999Z');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      fullName: 'Persona Auditada',
      username: 'auditada',
      role: 'FABRICACION'
    });
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.plantAuditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
    prisma.plantAuditLog.count.mockResolvedValue(0);
  });

  it('combina movimientos de sistema y planta en orden cronológico', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'system-1',
        createdAt: new Date('2026-09-20T15:00:00.000Z'),
        action: 'UPDATE',
        entityType: 'USER',
        entityId: 'user-1',
        before: null,
        after: { fullName: 'Persona Auditada' },
        metadata: null
      }
    ]);
    prisma.plantAuditLog.findMany.mockResolvedValue([
      {
        id: 'plant-1',
        createdAt: new Date('2026-09-20T12:00:00.000Z'),
        action: 'STATUS_CHANGE',
        entityType: 'Tank',
        entityId: 'tank-1',
        reason: null,
        before: { state: 'VACIO' },
        after: { state: 'FABRICANDO' },
        plant: { id: 'plant-1', code: 'LATEX', name: 'Látex' },
        tank: { id: 'tank-1', name: 'Tanque 1', equipmentCode: 'TK-01' },
        lot: null
      }
    ]);
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.plantAuditLog.count.mockResolvedValue(1);

    const result = await service.userActivity('company-1', 'user-1', from, to, 1, 25);

    expect(result.items.map((event) => event.id)).toEqual(['plant-1', 'system-1']);
    expect(result.total).toBe(2);
    expect(result).toEqual(expect.objectContaining({ page: 1, limit: 25, totalPages: 1 }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', userId: 'user-1', createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' },
        take: 25
      })
    );
  });

  it('impide consultar un usuario de otra empresa', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.userActivity('company-1', 'user-2', from, to, 1, 25)).rejects.toThrow(
      NotFoundException
    );
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.plantAuditLog.findMany).not.toHaveBeenCalled();
  });
});
