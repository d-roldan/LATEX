import { UnauthorizedException } from '@nestjs/common';
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

  it('uses Buenos Aires day boundaries as UTC instants', () => {
    const service = new PlantService(prisma, config, notifications);
    const bounds = (service as any).plantDayBounds('2026-09-03');
    expect(bounds.start.toISOString()).toBe('2026-09-03T03:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-09-04T03:00:00.000Z');
  });

  it('usa las celdas y formatos vigentes como configuración de Látex', async () => {
    const service = new PlantService(prisma, config, notifications);
    const result = await (service as any).loadConfig('company-1', 'plant-latex');

    expect(result.lines).toEqual(['A', 'B']);
    expect(result.formats).toEqual(['1 L', '4 L', '10 L', '20 L']);
  });
});
