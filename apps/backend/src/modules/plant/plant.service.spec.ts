import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PlantService } from './plant.service';

describe('PlantService telemetry', () => {
  const prisma = {
    company: {
      findFirst: jest.fn().mockResolvedValue({ id: 'company-1', plants: [{ id: 'plant-latex' }] }),
      findUnique: jest.fn().mockResolvedValue({ settings: {} })
    },
    tank: {
      findFirst: jest.fn().mockResolvedValue({ id: 'tank-101' }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tank-101', companyId: 'company-1', plantId: 'plant-latex', number: 101, name: 'TK101', capacityKg: null,
          scaleKey: 'TK101', telemetryMode: 'AUTOMATIC', state: 'VACIO', version: 0, activeLot: null, stateHistory: []
        }
      ])
    },
    plant: { findFirst: jest.fn().mockResolvedValue({ id: 'plant-latex' }), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'plant-latex' }), findUnique: jest.fn().mockResolvedValue({ settings: {}, code: 'LATEX', finalOperation: 'PACKAGING' }) }
  } as any;
  const config = {
    get: jest.fn((key: string) => key === 'NODE_RED_API_KEY' ? 'integration-secret' : key === 'SYSTEM_OWNER_COMPANY_ID' ? 'company-1' : undefined)
  } as any;
  const notifications = { notifyTankAction: jest.fn() } as any;

  it('keeps weight readings in memory and marks the response as non-persistent', async () => {
    const service = new PlantService(prisma, config, notifications);
    const result = await service.ingestWeights('integration-secret', 'company-1', {
      readings: [{ scaleKey: 'TK101', grossKg: 5070.125 }]
    });
    const tanks = await service.tanks('company-1');

    expect(result.persisted).toBe(false);
    expect(tanks[0].telemetry.grossKg).toBe(5070.125);
    expect(tanks[0].telemetry.online).toBe(true);
  });

  it('rejects a batch with an invalid integration key', async () => {
    const service = new PlantService(prisma, config, notifications);
    await expect(service.ingestWeights('wrong-key', 'company-1', {
      readings: [{ scaleKey: 'TK101', grossKg: 100 }]
    })).rejects.toThrow(UnauthorizedException);
  });

  it('publishes only the read-only fields needed by the TV screen', async () => {
    const service = new PlantService(prisma, config, notifications);
    const [tank] = await service.publicTanks();

    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { id: 'company-1', isActive: true },
      select: { id: true, plants: { where: { code: 'LATEX', isActive: true }, select: { id: true }, take: 1 } }
    });
    expect(tank).toMatchObject({ id: 'tank-101', name: 'TK101', state: 'VACIO' });
    expect(tank).not.toHaveProperty('companyId');
    expect(tank).not.toHaveProperty('scaleKey');
    expect(tank).not.toHaveProperty('version');
  });

  it('publica únicamente los motivos de ajuste necesarios para la pantalla TV', async () => {
    prisma.tank.findMany.mockResolvedValueOnce([
      {
        id: 'tank-101', companyId: 'company-1', plantId: 'plant-latex', number: 101, name: 'TK101', capacityKg: 60000,
        scaleKey: 'TK101', telemetryMode: 'AUTOMATIC', state: 'AJUSTE', version: 1, stateHistory: [],
        activeLot: {
          id: 'lot-1', manufacturingOrder: '26090101', materialCode: '600101', description: 'Látex', specificWeight: null,
          packagingOrders: [],
          laboratorySamples: [],
          qualityDecisions: [{
            id: 'decision-1', result: 'AJUSTE', reason: 'Viscosidad', adjustmentReasons: ['Viscosidad'],
            adjustmentItems: [{ id: 'item-1', materialCode: '1010', quantityKg: 10, position: 0 }]
          }]
        }
      }
    ]);
    const service = new PlantService(prisma, config, notifications);

    const [tank] = await service.publicTanks();

    expect(tank.activeLot?.qualityDecisions).toEqual([
      { reason: 'Viscosidad', adjustmentReasons: ['Viscosidad'] }
    ]);
  });

  it('uses Buenos Aires day boundaries as UTC instants', () => {
    const service = new PlantService(prisma, config, notifications);
    const bounds = (service as any).plantDayBounds('2026-09-03');
    expect(bounds.start.toISOString()).toBe('2026-09-03T03:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-09-04T03:00:00.000Z');
  });

  it('usa las opciones de envasado vigentes como configuración de Látex', async () => {
    const service = new PlantService(prisma, config, notifications);
    const result = await (service as any).loadConfig('company-1', 'plant-latex');

    expect(result.lines).toEqual(['A', 'B']);
    expect(result.formats).toEqual(['1 L', '4 L', '10 L', '20 L']);
    expect(result.dispensers).toEqual(['A', 'B']);
    expect(result.filters).toEqual(['1', '2', '3']);
  });
});

describe('PlantService laboratory sample cycle', () => {
  const user = { sub: 'lab-user', companyId: 'company-1', role: 'LABORATORIO' } as any;
  const tank = {
    id: 'tank-101', companyId: 'company-1', plantId: 'plant-latex', name: 'TK101',
    state: 'LABORATORIO', version: 7, activeLotId: 'lot-1'
  };

  const createService = (sample: any = {
    id: 'sample-1', status: 'AWAITING_RECEIPT', iteration: 1
  }) => {
    const tx = {
      tank: {
        findFirst: jest.fn().mockResolvedValue(tank),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' })
      },
      laboratorySample: {
        findFirst: jest.fn().mockResolvedValue(sample),
        update: jest.fn().mockResolvedValue({ id: 'sample-1' })
      },
      qualityDecision: { create: jest.fn() },
      productionLot: { update: jest.fn() },
      plantAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const notifications = { notifyTankAction: jest.fn() } as any;
    return { service: new PlantService(prisma, { get: jest.fn() } as any, notifications), tx };
  };

  it('registra quién recibió la muestra sin cambiar el estado físico del tanque', async () => {
    const { service, tx } = createService();

    const result = await service.receiveLaboratorySample('company-1', 'tank-101', user, { version: 7 });

    expect(result).toMatchObject({ ok: true, sampleId: 'sample-1' });
    expect(tx.tank.updateMany).toHaveBeenCalledWith({
      where: { id: 'tank-101', state: 'LABORATORIO', version: 7 },
      data: { version: { increment: 1 } }
    });
    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: expect.objectContaining({ status: 'RECEIVED', receivedByUserId: 'lab-user', receivedAt: expect.any(Date) })
    });
    expect(tx.plantAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'SAMPLE_RECEIVED', entityType: 'LaboratorySample' })
    }));
  });

  it('impide informar un resultado antes de confirmar la recepción', async () => {
    const { service, tx } = createService(null);

    await expect(service.quality('company-1', 'tank-101', user, {
      version: 7,
      result: 'APROBADO',
      employeeNumber: '1234',
      specificWeight: 1.25
    })).rejects.toThrow('Laboratorio debe confirmar la recepción de la muestra');
    expect(tx.qualityDecision.create).not.toHaveBeenCalled();
  });
});

describe('PlantService quality adjustment correction', () => {
  const user = { sub: 'lab-user', companyId: 'company-1', role: 'LABORATORIO' } as any;
  const currentDecision = {
    id: 'decision-1', reason: 'Viscosidad', adjustmentReasons: ['Viscosidad'],
    adjustmentItems: [{ id: 'item-1', materialCode: '1010', quantityKg: 10, position: 0 }]
  };

  const createService = (tankState = 'AJUSTE') => {
    const tx = {
      tank: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tank-101', companyId: 'company-1', plantId: 'plant-latex', name: 'TK101',
          state: tankState, version: 4, activeLotId: 'lot-1'
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' })
      },
      qualityDecision: {
        findFirst: jest.fn().mockResolvedValue(currentDecision),
        update: jest.fn().mockResolvedValue({
          id: 'decision-1', reason: 'Color, Viscosidad', adjustmentReasons: ['Color', 'Viscosidad'],
          adjustmentItems: [{ id: 'item-2', materialCode: '2020', quantityKg: 8.5, position: 0 }]
        })
      },
      plantAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const notifications = { notifyTankAction: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new PlantService(prisma, { get: jest.fn() } as any, notifications);
    return { service, tx, notifications };
  };

  it('reemplaza los datos, incrementa la versión y deja auditoría', async () => {
    const { service, tx, notifications } = createService();

    await expect(service.correctQualityAdjustment('company-1', 'tank-101', user, {
      version: 4,
      adjustmentReasons: ['Color', 'Viscosidad'],
      adjustments: [{ materialCode: '2020', quantityKg: 8.5 }]
    })).resolves.toEqual({ ok: true });

    expect(tx.tank.updateMany).toHaveBeenCalledWith({
      where: { id: 'tank-101', state: 'AJUSTE', version: 4 },
      data: { version: { increment: 1 } }
    });
    expect(tx.qualityDecision.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'decision-1' },
      data: expect.objectContaining({
        reason: 'Color, Viscosidad',
        adjustmentReasons: ['Color', 'Viscosidad'],
        adjustmentItems: {
          deleteMany: {},
          create: [{ position: 0, materialCode: '2020', quantityKg: 8.5 }]
        }
      })
    }));
    expect(tx.plantAuditLog.create).toHaveBeenCalled();
    expect(notifications.notifyTankAction).toHaveBeenCalledWith(tx, expect.objectContaining({ targetSector: 'FABRICACION' }));
  });

  it('rechaza la corrección si el tanque ya no está en AJUSTE', async () => {
    const { service, tx } = createService('LABORATORIO');

    await expect(service.correctQualityAdjustment('company-1', 'tank-101', user, {
      version: 4,
      adjustmentReasons: ['Color'],
      adjustments: [{ materialCode: '2020', quantityKg: 8.5 }]
    })).rejects.toThrow(ConflictException);
    expect(tx.qualityDecision.update).not.toHaveBeenCalled();
  });
});
