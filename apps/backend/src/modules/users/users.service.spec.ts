import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    userPlantAccess: {
      deleteMany: jest.fn(),
      createMany: jest.fn()
    },
    plant: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  };
  const auditService = { log: jest.fn() };
  const service = new UsersService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.userPlantAccess.deleteMany.mockResolvedValue({ count: 0 });
    prisma.userPlantAccess.createMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(async (operation: (tx: typeof prisma) => unknown) =>
      operation(prisma)
    );
    auditService.log.mockResolvedValue(undefined);
  });

  it('crea los accesos para todas las plantas seleccionadas', async () => {
    prisma.plant.findMany.mockResolvedValue([{ id: 'plant-1' }, { id: 'plant-2' }]);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'usuario@disal.local',
      username: 'usuario',
      fullName: 'Usuario Prueba',
      role: UserRole.FABRICACION,
      isActive: true,
      plantAccesses: []
    });

    await service.create(
      'company-1',
      {
        email: 'usuario@disal.local',
        username: 'usuario',
        fullName: 'Usuario Prueba',
        password: '123456',
        role: UserRole.FABRICACION,
        plantIds: ['plant-1', 'plant-2']
      },
      'admin-1'
    );

    expect(prisma.plant.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        isActive: true,
        id: { in: ['plant-1', 'plant-2'] }
      },
      select: { id: true }
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plantAccesses: {
            create: [{ plantId: 'plant-1' }, { plantId: 'plant-2' }]
          }
        })
      })
    );
  });

  it('rechaza plantas inactivas o de otra empresa', async () => {
    prisma.plant.findMany.mockResolvedValue([{ id: 'plant-1' }]);

    await expect(
      service.create('company-1', {
        email: 'usuario@disal.local',
        username: 'usuario',
        fullName: 'Usuario Prueba',
        password: '123456',
        role: UserRole.FABRICACION,
        plantIds: ['plant-1', 'plant-ajena']
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('actualiza las plantas sin recrear los accesos que se conservan', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      isProtected: false,
      isSystemOwner: false,
      plantAccesses: [{ plantId: 'plant-1' }, { plantId: 'plant-2' }]
    });
    prisma.plant.findMany.mockResolvedValue([{ id: 'plant-2' }, { id: 'plant-3' }]);

    await service.updatePlants('company-1', 'user-1', ['plant-2', 'plant-3'], 'admin-1', {
      sub: 'admin-1',
      companyId: 'company-1',
      role: UserRole.ADMIN,
      email: 'admin@disal.local',
      username: 'admin',
      fullName: 'Administrador',
      sessionVersion: 0
    });

    expect(prisma.userPlantAccess.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', plantId: { in: ['plant-1'] } }
    });
    expect(prisma.userPlantAccess.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', plantId: 'plant-3' }],
      skipDuplicates: true
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        entityType: 'USER',
        entityId: 'user-1',
        action: 'ASSIGN',
        before: { plantIds: ['plant-1', 'plant-2'] },
        after: { plantIds: ['plant-2', 'plant-3'] }
      })
    );
  });

  it('rechaza al editar una planta inactiva o de otra empresa', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      isProtected: false,
      isSystemOwner: false,
      plantAccesses: [{ plantId: 'plant-1' }]
    });
    prisma.plant.findMany.mockResolvedValue([{ id: 'plant-1' }]);

    await expect(
      service.updatePlants('company-1', 'user-1', ['plant-1', 'plant-ajena'], 'admin-1', {
        sub: 'admin-1',
        companyId: 'company-1',
        role: UserRole.ADMIN,
        email: 'admin@disal.local',
        username: 'admin',
        fullName: 'Administrador',
        sessionVersion: 0
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
