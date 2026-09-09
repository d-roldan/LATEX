import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('limits sector users to their own notifications while administrators can list every sector', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries))
    } as any;
    const service = new NotificationsService(prisma);
    const baseUser = { sub: 'user-1', companyId: 'company-1' } as any;

    await service.list({ ...baseUser, role: 'LABORATORIO' });
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ targetSector: 'LABORATORIO' })
    }));

    await service.list({ ...baseUser, role: 'ADMIN' });
    expect(prisma.notification.findMany.mock.calls.at(-1)[0].where).not.toHaveProperty('targetSector');
  });

  it('creates one actionable tank notification for every active sector user and administrator except the actor', async () => {
    const client = {
      tank: { findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'lab-1' }, { id: 'admin-1' }]) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 2 }) }
    } as any;
    const service = new NotificationsService({} as any);

    await service.notifyTankAction(client, {
      companyId: 'company-1', actorUserId: 'fabricacion-1', tankId: 'tank-103',
      targetSector: 'LABORATORIO', title: 'Tanque disponible para analizar', message: 'TK103 espera análisis.'
    });

    expect(client.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company-1', isActive: true, id: { not: 'fabricacion-1' }, plantAccesses: { some: { plantId: 'plant-latex' } } })
    }));
    expect(client.notification.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ userId: 'lab-1', plantId: 'plant-latex', tankId: 'tank-103', targetSector: 'LABORATORIO', type: NotificationType.TANK_ACTION_REQUIRED }),
      expect.objectContaining({ userId: 'admin-1', plantId: 'plant-latex', tankId: 'tank-103', targetSector: 'LABORATORIO', type: NotificationType.TANK_ACTION_REQUIRED })
    ] });
  });

  it('does not create rows when a target sector has no recipients', async () => {
    const client = {
      tank: { findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { createMany: jest.fn() }
    } as any;
    const service = new NotificationsService({} as any);

    await expect(service.notifyTankAction(client, {
      companyId: 'company-1', actorUserId: 'lab-1', tankId: 'tank-101',
      targetSector: 'ENVASADO', title: 'Disponible', message: 'Listo.'
    })).resolves.toEqual({ created: 0 });
    expect(client.notification.createMany).not.toHaveBeenCalled();
  });
});
