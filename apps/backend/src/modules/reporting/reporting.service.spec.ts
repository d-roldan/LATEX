import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  const user = { sub: 'user-1', companyId: 'company-1', role: 'JEFATURA' } as JwtUser;
  const plant = { id: 'plant-1', code: 'LATEX', name: 'Látex', finalOperation: 'PACKAGING' };
  const prisma = {
    plant: { findMany: jest.fn() },
    productionLot: { count: jest.fn(), findMany: jest.fn() },
    qualityDecision: { count: jest.fn() },
    laboratorySample: { count: jest.fn() },
    $transaction: jest.fn()
  };
  const service = new ReportingService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.plant.findMany.mockResolvedValue([plant]);
    prisma.productionLot.count.mockReturnValue(Promise.resolve(0));
    prisma.productionLot.findMany.mockReturnValue(Promise.resolve([]));
    prisma.qualityDecision.count.mockReturnValue(Promise.resolve(0));
    prisma.laboratorySample.count.mockReturnValue(Promise.resolve(0));
    prisma.$transaction.mockResolvedValue([0, 0, 0, 0, 0]);
  });

  it('rechaza una planta ajena antes de consultar métricas', async () => {
    await expect(service.overview(user, { month: '2026-10', plantIds: 'plant-2' })).rejects.toThrow(
      NotFoundException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.productionLot.count).not.toHaveBeenCalled();
  });

  it('aplica empresa, planta y el intervalo mensual argentino [inicio, fin)', async () => {
    prisma.$transaction.mockResolvedValue([3, 1, 4, 2, 3]);
    const result = await service.overview(user, { month: '2026-10', plantIds: 'plant-1' });

    expect(prisma.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          userAccesses: { some: { userId: 'user-1' } }
        })
      })
    );
    expect(prisma.productionLot.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        companyId: 'company-1',
        plantId: { in: ['plant-1'] },
        startedAt: {
          gte: new Date('2026-10-01T03:00:00.000Z'),
          lt: new Date('2026-11-01T03:00:00.000Z')
        }
      })
    });
    expect(result.totals).toEqual({
      startedLots: 3,
      finishedLots: 1,
      decisions: 4,
      adjustments: 2,
      receivedSamples: 3
    });
  });

  it('rechaza mes inválido y paginación excesiva', async () => {
    await expect(service.overview(user, { month: '2026-13' })).rejects.toThrow(BadRequestException);
    await expect(service.orders(user, { month: '2026-10', limit: '1000' })).rejects.toThrow(
      BadRequestException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aplica un rango diario argentino con fin exclusivo', () => {
    const period = service.period(undefined, '2026-10-31', '2026-11-01');
    expect(period.startInclusive).toBe('2026-10-31T03:00:00.000Z');
    expect(period.endExclusive).toBe('2026-11-02T03:00:00.000Z');
    expect(period.label).toBe('31/10/2026–01/11/2026');
  });

  it('rechaza fechas inexistentes, rangos invertidos y excesivos', () => {
    expect(() => service.period(undefined, '2026-02-30', '2026-03-02')).toThrow(
      BadRequestException
    );
    expect(() => service.period(undefined, '2026-11-02', '2026-11-01')).toThrow(
      BadRequestException
    );
    expect(() => service.period(undefined, '2025-01-01', '2026-11-01')).toThrow(
      BadRequestException
    );
    expect(() => service.period(undefined, '2026-11-01')).toThrow(BadRequestException);
  });

  it('permite seleccionar cero plantas explícitamente sin ampliar el alcance', async () => {
    await expect(service.scope(user, 'none')).resolves.toEqual([]);
  });
});
