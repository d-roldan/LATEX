import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PlantService } from './plant.service';
import { createHash } from 'crypto';

describe('PlantService pausa de envasado de Látex', () => {
  const user = { sub: 'envasado-1' } as any;
  const setup = (state: 'ENVASANDO' | 'ENVASADO_PAUSADO', activeOther = false, code = 'LATEX') => {
    const tx = {
      plant: { findUnique: jest.fn().mockResolvedValue({ code }) },
      tank: { findFirst: jest.fn().mockResolvedValue(activeOther ? { id: 'other' } : null) },
      packagingOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'oe-1' }), update: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ lock: '' }])
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new PlantService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'findTank').mockResolvedValue({
      id: 'tank-101',
      companyId: 'company-1',
      plantId: 'plant-1',
      activeLotId: 'lot-1',
      state,
      version: 3
    });
    const move = jest.spyOn(service as any, 'move').mockResolvedValue(undefined);
    return { service, tx, move };
  };

  it('pausa sin cerrar la OE y libera la línea', async () => {
    const { service, tx, move } = setup('ENVASANDO');
    await expect(
      service.pausePackaging('company-1', 'tank-101', user, { version: 3 })
    ).resolves.toEqual({ ok: true });
    expect(move).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      'ENVASADO_PAUSADO',
      user,
      'lot-1',
      'Envasado pausado'
    );
    expect(tx.packagingOrder.update).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('reanuda la misma OE cuando Devree está libre', async () => {
    const { service, tx, move } = setup('ENVASADO_PAUSADO');
    await expect(
      service.resumePackaging('company-1', 'tank-101', user, { version: 3 })
    ).resolves.toEqual({ ok: true });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(move).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      'ENVASANDO',
      user,
      'lot-1',
      'Envasado reanudado'
    );
    expect(tx.packagingOrder.update).not.toHaveBeenCalled();
  });

  it('rechaza reanudar si otro tanque ya está envasando', async () => {
    const { service, move } = setup('ENVASADO_PAUSADO', true);
    await expect(
      service.resumePackaging('company-1', 'tank-101', user, { version: 3 })
    ).rejects.toThrow('La línea Devree ya está envasando otro tanque');
    expect(move).not.toHaveBeenCalled();
  });

  it('rechaza una versión anterior, una OE cerrada y otra planta', async () => {
    const stale = setup('ENVASANDO');
    await expect(
      stale.service.pausePackaging('company-1', 'tank-101', user, { version: 2 })
    ).rejects.toThrow('El tanque cambió');
    const closed = setup('ENVASANDO');
    closed.tx.packagingOrder.findFirst.mockResolvedValue(null);
    await expect(
      closed.service.pausePackaging('company-1', 'tank-101', user, { version: 3 })
    ).rejects.toThrow('No existe una OE abierta');
    const otherPlant = setup('ENVASANDO', false, 'SINTETICOS');
    await expect(
      otherPlant.service.pausePackaging('company-1', 'tank-101', user, { version: 3 })
    ).rejects.toThrow('sólo está disponible para Látex');
  });
});

describe('PlantService Devree', () => {
  const user = { sub: 'envasado-1' } as any;
  const dto = {
    version: 2,
    packagingOrder: '123456',
    materialCode: '1234',
    line: 'A',
    format: '4 L',
    dispenser: 'A',
    filter: '1',
    description: 'Producto'
  };

  const setup = (plantCode: string, occupied: boolean) => {
    const tx = {
      plant: { findUnique: jest.fn().mockResolvedValue({ code: plantCode }) },
      tank: { findFirst: jest.fn().mockResolvedValue(occupied ? { id: 'other' } : null) },
      $queryRaw: jest.fn().mockResolvedValue([{ lock: '' }]),
      packagingOrder: { create: jest.fn().mockResolvedValue({ id: 'oe-1' }) },
      packagingPlanningCard: { findFirst: jest.fn().mockResolvedValue(null) }
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new PlantService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'findTank').mockResolvedValue({
      id: 'tank-101',
      plantId: 'plant-1',
      state: 'APROBADO',
      version: 2,
      activeLotId: 'lot-1'
    });
    jest.spyOn(service as any, 'assertFinalOperation').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'validatePackaging').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'move').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'audit').mockResolvedValue(undefined);
    return { service, tx, prisma };
  };

  it('permite iniciar el primer tanque de Látex dentro del bloqueo de planta', async () => {
    const { service, tx, prisma } = setup('LATEX', false);
    await expect(service.startPackaging('company-1', 'tank-101', user, dto)).resolves.toEqual({
      ok: true
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.packagingOrder.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'ReadCommitted'
    });
  });

  it('rechaza otro tanque de Látex si Devree ya está envasando', async () => {
    const { service, tx } = setup('LATEX', true);
    await expect(service.startPackaging('company-1', 'tank-101', user, dto)).rejects.toThrow(
      'La línea Devree ya está envasando otro tanque'
    );
    expect(tx.packagingOrder.create).not.toHaveBeenCalled();
  });

  it('no aplica la restricción a otra planta', async () => {
    const { service, tx } = setup('SINTETICOS', true);
    await expect(service.startPackaging('company-1', 'tank-101', user, dto)).resolves.toEqual({
      ok: true
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.tank.findFirst).not.toHaveBeenCalled();
  });
});

describe('PlantService indicadores de TV de Látex', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-11-06T15:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('suma sólo descensos de peso durante envasado y convierte con densidad', async () => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 25 * 60_000);
    const prisma = {
      plant: { findFirst: jest.fn().mockResolvedValue({ id: 'plant-latex' }) },
      tankStateHistory: {
        findMany: jest.fn().mockResolvedValue([
          {
            tankId: 'tank-101',
            startedAt: periodStart,
            endedAt: null,
            lot: { specificWeight: 1.25 },
            tank: { scaleKey: 'TK101', number: 101 }
          }
        ])
      }
    } as any;
    const influx = {
      readWeightSeries: jest.fn().mockResolvedValue({
        status: 'AVAILABLE',
        points: [
          { timestamp: new Date(now.getTime() - 20 * 60_000).toISOString(), grossKg: 1000 },
          { timestamp: new Date(now.getTime() - 15 * 60_000).toISOString(), grossKg: 875 },
          { timestamp: new Date(now.getTime() - 10 * 60_000).toISOString(), grossKg: 880 },
          { timestamp: new Date(now.getTime() - 5 * 60_000).toISOString(), grossKg: 755 }
        ]
      })
    } as any;
    const service = new PlantService(prisma, { get: jest.fn() } as any, {} as any, influx);
    await expect(service.publicPackagingEstimates('LATEX')).resolves.toEqual({
      litersToday: 200,
      status: 'AVAILABLE'
    });
    expect(influx.readWeightSeries).toHaveBeenCalledTimes(1);
  });

  it('no publica un total incompleto si falta la serie de peso', async () => {
    const prisma = {
      plant: { findFirst: jest.fn().mockResolvedValue({ id: 'plant-latex' }) },
      tankStateHistory: {
        findMany: jest.fn().mockResolvedValue([
          {
            tankId: 'tank-101',
            startedAt: new Date(),
            endedAt: null,
            lot: { specificWeight: 1 },
            tank: { scaleKey: 'TK101', number: 101 }
          }
        ])
      }
    } as any;
    const influx = {
      readWeightSeries: jest.fn().mockResolvedValue({ status: 'UNAVAILABLE' })
    } as any;
    const service = new PlantService(prisma, { get: jest.fn() } as any, {} as any, influx);
    await expect(service.publicPackagingEstimates('LATEX')).resolves.toEqual({
      litersToday: null,
      status: 'INCOMPLETE'
    });
  });
});

describe('PlantService planning board', () => {
  const notifications = { notifyTankAction: jest.fn() } as any;

  it('devuelve el lote activo y las tarjetas ordenadas de los tanques de Látex', async () => {
    const prisma = {
      plant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plant-latex',
          code: 'LATEX',
          name: 'Látex',
          userAccesses: [{ canTransfer: false }]
        })
      },
      tank: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tank-101',
            number: 101,
            name: 'TK101',
            capacityKg: 60000,
            state: 'FABRICANDO',
            activeLot: {
              id: 'lot-1',
              manufacturingOrder: '26100101',
              materialCode: '600101',
              description: 'Látex en fabricación'
            },
            planningCards: [
              {
                id: 'card-1',
                manufacturingOrder: '26100102',
                materialCode: '600102',
                description: 'Siguiente lote',
                position: 0,
                updatedAt: new Date('2026-10-01T12:00:00.000Z')
              }
            ]
          }
        ])
      }
    } as any;
    const service = new PlantService(prisma, { get: jest.fn() } as any, notifications);

    const result = await service.planningBoard('company-1', 'user-1', 'latex');

    expect(result.plant).toEqual({ id: 'plant-latex', code: 'LATEX', name: 'Látex' });
    expect(result.tanks[0]).toMatchObject({
      name: 'TK101',
      capacityKg: 60000,
      activeLot: { manufacturingOrder: '26100101' },
      planningCards: [{ id: 'card-1', position: 0 }]
    });
    expect(prisma.tank.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ plantId: 'plant-latex', equipmentType: 'TANK' }),
        orderBy: { number: 'asc' }
      })
    );
  });

  it('mantiene la primera versión de la pizarra limitada a Látex', async () => {
    const prisma = {
      plant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plant-terplast',
          code: 'TERPLAST',
          name: 'Terplast',
          userAccesses: [{ canTransfer: false }]
        })
      }
    } as any;
    const service = new PlantService(prisma, { get: jest.fn() } as any, notifications);

    await expect(service.planningBoard('company-1', 'user-1', 'TERPLAST')).rejects.toThrow(
      'únicamente para la planta Látex'
    );
  });

  it.each(['VACIO', 'FUERA_DE_SERVICIO'])(
    'no permite planificar un tanque con estado %s para envasado',
    async (state) => {
      const create = jest.fn();
      const tx = {
        tank: {
          findFirst: jest.fn().mockResolvedValue({ id: 'tank-107', state })
        },
        packagingPlanningCard: {
          findFirst: jest.fn(),
          count: jest.fn(),
          create
        }
      };
      const prisma = {
        plant: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'plant-latex',
            code: 'LATEX',
            userAccesses: [{ canTransfer: false }]
          })
        },
        $transaction: jest.fn((callback) => callback(tx))
      } as any;
      const service = new PlantService(prisma, { get: jest.fn() } as any, notifications);

      await expect(
        service.createPackagingPlanningCard(
          'company-1',
          { sub: 'user-1', companyId: 'company-1', role: 'ENVASADO' } as any,
          'LATEX',
          { tankId: 'tank-107', dispenser: 'A', filter: '1' }
        )
      ).rejects.toThrow('Los tanques vacíos o fuera de servicio no se pueden planificar');
      expect(create).not.toHaveBeenCalled();
    }
  );

  it('reordena una única secuencia de envasado compartida entre A y B', async () => {
    const update = jest.fn().mockResolvedValue({});
    const tx = {
      tank: { findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' }) },
      packagingPlanningCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'card-c',
          tankId: 'tank-107',
          dispenser: 'B',
          position: 2
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'card-a', dispenser: 'A' },
          { id: 'card-b', dispenser: 'B' }
        ]),
        update
      },
      plantAuditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      plant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plant-latex',
          code: 'LATEX',
          userAccesses: [{ canTransfer: false }]
        })
      },
      $transaction: jest.fn((callback) => callback(tx))
    } as any;
    const service = new PlantService(prisma, { get: jest.fn() } as any, notifications);

    await service.movePackagingPlanningCard(
      'company-1',
      { sub: 'user-1', companyId: 'company-1', role: 'ENVASADO' } as any,
      'LATEX',
      'card-c',
      { dispenser: 'A', position: 0 }
    );

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'card-c' },
      data: { dispenser: 'A', position: 0 }
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'card-a' },
      data: { dispenser: 'A', position: 1 }
    });
    expect(update).toHaveBeenNthCalledWith(3, {
      where: { id: 'card-b' },
      data: { dispenser: 'B', position: 2 }
    });
  });
});

describe('PlantService administrative rollback', () => {
  const admin = { sub: 'admin-1', companyId: 'company-1', role: 'ADMIN' } as any;
  const tank = {
    id: 'tank-101',
    companyId: 'company-1',
    plantId: 'plant-latex',
    name: 'TK101',
    state: 'LABORATORIO',
    version: 7,
    activeLotId: 'lot-1',
    scaleKey: null
  };
  const periods = (current: string, previous: string) => [
    {
      id: 'current',
      state: current,
      lotId: 'lot-1',
      endedAt: null,
      startedAt: new Date('2026-10-27T12:00:00Z')
    },
    {
      id: 'previous',
      state: previous,
      lotId: 'lot-1',
      startedAt: new Date('2026-10-27T11:00:00Z'),
      endedAt: new Date('2026-10-27T12:00:00Z')
    }
  ];
  const setup = (
    state = 'LABORATORIO',
    previous = 'FABRICANDO',
    sampleStatus = 'AWAITING_RECEIPT'
  ) => {
    const currentTank = { ...tank, state };
    const sample =
      sampleStatus === 'NONE'
        ? null
        : {
            id: 'sample-1',
            status: sampleStatus,
            receivedAt: null,
            qualityDecisionId: sampleStatus === 'RESOLVED' ? 'decision-1' : null
          };
    const tx = {
      tank: {
        findFirst: jest.fn().mockResolvedValue(currentTank),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' })
      },
      tankStateHistory: {
        findMany: jest.fn().mockResolvedValue(periods(state, previous)),
        findFirst: jest.fn().mockResolvedValue(periods(state, previous)[0]),
        update: jest.fn(),
        create: jest.fn()
      },
      laboratorySample: {
        findFirst: jest.fn().mockResolvedValue(sample),
        count: jest.fn().mockResolvedValue(sample ? 1 : 0),
        update: jest.fn(),
        create: jest.fn()
      },
      qualityDecision: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'decision-1',
          result: state,
          createdAt: new Date('2026-10-27T12:00:00Z')
        }),
        update: jest.fn()
      },
      packagingPlanningCard: {
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
        updateMany: jest.fn()
      },
      packagingOrder: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      transferOperation: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      productionLot: { update: jest.fn(), findUnique: jest.fn() },
      plant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
      plantAuditLog: { create: jest.fn() }
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const notifications = { notifyTankAction: jest.fn() } as any;
    return { service: new PlantService(prisma, { get: jest.fn() } as any, notifications), tx };
  };

  it('solo admite el rol ADMIN, incluso si otro rol es system owner', async () => {
    const { service, tx } = setup();
    await expect(
      service.rollbackPreview('company-1', 'tank-101', {
        ...admin,
        role: 'JEFATURA',
        isSystemOwner: true
      })
    ).rejects.toThrow('Administrador');
    expect(tx.tank.findFirst).not.toHaveBeenCalled();
  });

  it('retrocede laboratorio a fabricación, anula la muestra y conserva historial', async () => {
    const { service, tx } = setup();
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'LABORATORIO',
      to: 'FABRICANDO',
      version: 7
    });
    await expect(
      service.rollbackState('company-1', 'tank-101', admin, {
        version: 6,
        reason: 'Error de carga'
      })
    ).rejects.toThrow('El tanque cambió');
    expect(tx.laboratorySample.update).not.toHaveBeenCalled();
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Error de carga'
    });
    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: { cancelledAt: expect.any(Date) }
    });
    expect(tx.tank.updateMany).toHaveBeenCalledWith({
      where: { id: 'tank-101', state: 'LABORATORIO', version: 7 },
      data: { state: 'FABRICANDO', version: { increment: 1 } }
    });
    expect(tx.tankStateHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: 'FABRICANDO',
        description: 'Retroceso administrativo: Error de carga'
      })
    });
    expect(tx.plantAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ROLLBACK',
        reason: 'Error de carga'
      })
    });
  });

  it.each(['RECEIVED', 'ANALYZING'])(
    'retrocede laboratorio con muestra %s y conserva sus datos anulados',
    async (status) => {
      const { service, tx } = setup('LABORATORIO', 'FABRICANDO', status);
      await service.rollbackState('company-1', 'tank-101', admin, {
        version: 7,
        reason: 'Volver a fabricación'
      });
      expect(tx.laboratorySample.update).toHaveBeenCalledWith({
        where: { id: 'sample-1' },
        data: { cancelledAt: expect.any(Date) }
      });
      expect(tx.tank.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { state: 'FABRICANDO', version: { increment: 1 } }
        })
      );
    }
  );

  it('anula la decisión de calidad y reabre el análisis sin borrar registros', async () => {
    const { service, tx } = setup('APROBADO', 'LABORATORIO', 'RESOLVED');
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Resultado incorrecto'
    });
    expect(tx.qualityDecision.update).toHaveBeenCalledWith({
      where: { id: 'decision-1' },
      data: { cancelledAt: expect.any(Date) }
    });
    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: { status: 'ANALYZING', resolvedAt: null, qualityDecisionId: null }
    });
    expect(tx.productionLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { specificWeight: null }
    });
  });

  it('recupera una decisión legada sin muestra y solicita una muestra nueva', async () => {
    const { service, tx } = setup('APROBADO', 'LABORATORIO', 'NONE');
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      to: 'LABORATORIO',
      affectedRecord: expect.stringContaining('muestra nueva')
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Aprobación cargada por error'
    });
    expect(tx.qualityDecision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: expect.any(Object), cancelledAt: null })
      })
    );
    expect(tx.laboratorySample.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lotId: 'lot-1',
        iteration: 1,
        requestedByUserId: 'admin-1'
      })
    });
    expect(tx.laboratorySample.update).not.toHaveBeenCalled();
  });

  it('no usa la ruta legada si hay muestras anteriores anuladas', async () => {
    const { service, tx } = setup('APROBADO', 'LABORATORIO', 'NONE');
    tx.laboratorySample.count.mockResolvedValue(1);
    await expect(service.rollbackPreview('company-1', 'tank-101', admin)).rejects.toThrow(
      'No hay una decisión de calidad vigente'
    );
    expect(tx.qualityDecision.findFirst).not.toHaveBeenCalled();
  });

  it('bloquea una reversa de calidad si ya comenzó una OE', async () => {
    const { service, tx } = setup('APROBADO', 'LABORATORIO', 'RESOLVED');
    tx.packagingOrder.count.mockResolvedValue(1);
    await expect(
      service.rollbackState('company-1', 'tank-101', admin, { version: 7, reason: 'Error' })
    ).rejects.toThrow('envasado o trasvase');
    expect(tx.qualityDecision.update).not.toHaveBeenCalled();
  });

  it('quita una planificación sin conexión al retroceder una aprobación', async () => {
    const { service, tx } = setup('APROBADO', 'LABORATORIO', 'RESOLVED');
    tx.packagingPlanningCard.findFirst.mockResolvedValue({
      id: 'card-1',
      hooked: false,
      position: 1,
      tankId: 'tank-101'
    });
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      affectedRecord: expect.stringContaining('tarjeta de planificación')
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Aprobación equivocada'
    });
    expect(tx.packagingPlanningCard.delete).toHaveBeenCalledWith({ where: { id: 'card-1' } });
    expect(tx.packagingPlanningCard.updateMany).toHaveBeenCalledWith({
      where: { plantId: 'plant-latex', position: { gt: 1 } },
      data: { position: { decrement: 1 } }
    });
    expect(tx.plantAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE',
        entityType: 'PackagingPlanningCard',
        entityId: 'card-1'
      })
    });
  });

  it('quita y audita incluso una tarjeta marcada como conectada', async () => {
    const { service, tx } = setup('APROBADO', 'LABORATORIO', 'RESOLVED');
    tx.packagingPlanningCard.findFirst.mockResolvedValue({
      id: 'card-1',
      hooked: true,
      position: 1
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Aprobación incorrecta'
    });
    expect(tx.packagingPlanningCard.delete).toHaveBeenCalledWith({ where: { id: 'card-1' } });
    expect(tx.plantAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE',
        before: expect.objectContaining({ hooked: true })
      })
    });
  });

  it('permite retroceder varios pasos consecutivos del mismo lote', async () => {
    const { service, tx } = setup('AJUSTE', 'LABORATORIO', 'RESOLVED');
    const history = [
      {
        id: 'latest-lab',
        state: 'LABORATORIO',
        lotId: 'lot-1',
        endedAt: null,
        startedAt: new Date('2026-10-27T13:00:00Z')
      },
      {
        id: 'adjustment',
        state: 'AJUSTE',
        lotId: 'lot-1',
        endedAt: new Date(),
        startedAt: new Date('2026-10-27T12:00:00Z')
      },
      {
        id: 'first-lab',
        state: 'LABORATORIO',
        lotId: 'lot-1',
        endedAt: new Date(),
        startedAt: new Date('2026-10-27T11:00:00Z')
      },
      {
        id: 'manufacturing',
        state: 'FABRICANDO',
        lotId: 'lot-1',
        endedAt: new Date(),
        startedAt: new Date('2026-10-27T10:00:00Z')
      }
    ];
    tx.tank.findFirst.mockResolvedValue({ ...tank, state: 'LABORATORIO' });
    tx.tankStateHistory.findMany.mockResolvedValue(history);
    tx.laboratorySample.findFirst.mockResolvedValue({
      id: 'sample-1',
      status: 'ANALYZING',
      qualityDecisionId: null
    });
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'LABORATORIO',
      to: 'AJUSTE'
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Volver al ajuste'
    });
    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: { cancelledAt: expect.any(Date) }
    });
    tx.tank.findFirst.mockResolvedValue({ ...tank, state: 'AJUSTE', version: 8 });
    tx.tankStateHistory.findMany.mockResolvedValue([
      {
        id: 'rollback-ajuste',
        state: 'AJUSTE',
        lotId: 'lot-1',
        endedAt: null,
        startedAt: new Date('2026-10-27T14:00:00Z'),
        description: 'Retroceso administrativo: volver al ajuste'
      },
      { ...history[0], endedAt: new Date() },
      ...history.slice(1)
    ]);
    tx.laboratorySample.findFirst.mockResolvedValue({
      id: 'sample-previous',
      status: 'RESOLVED',
      qualityDecisionId: 'decision-1'
    });
    tx.qualityDecision.findFirst.mockResolvedValue({
      id: 'decision-1',
      result: 'AJUSTE',
      createdAt: new Date('2026-10-27T11:30:00Z')
    });
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'AJUSTE',
      to: 'LABORATORIO'
    });
  });

  it('retrocede el inicio de fabricación y desactiva el lote al volver a vacío', async () => {
    const { service, tx } = setup('FABRICANDO');
    tx.tankStateHistory.findMany.mockResolvedValue([
      {
        id: 'manufacturing',
        state: 'FABRICANDO',
        lotId: 'lot-1',
        endedAt: null,
        startedAt: new Date('2026-10-27T10:00:00Z')
      }
    ]);
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'FABRICANDO',
      to: 'VACIO',
      affectedRecord: 'Lote de fabricación'
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'OF cargada por error'
    });
    expect(tx.productionLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { cancelledAt: expect.any(Date) }
    });
    expect(tx.tank.update).toHaveBeenCalledWith({
      where: { id: 'tank-101' },
      data: { activeLotId: null }
    });
  });

  it('anula una OE activa y permite volver de envasando a aprobado', async () => {
    const { service, tx } = setup('ENVASANDO', 'APROBADO', 'RESOLVED');
    tx.packagingOrder.findMany.mockResolvedValue([{ id: 'oe-1', lotId: 'lot-1' }]);
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'ENVASANDO',
      to: 'APROBADO'
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'OE incorrecta'
    });
    expect(tx.packagingOrder.update).toHaveBeenCalledWith({
      where: { id: 'oe-1' },
      data: { cancelledAt: expect.any(Date) }
    });
  });

  it('anula un trasvase activo y permite volver a aprobado', async () => {
    const { service, tx } = setup('TRASVASANDO', 'APROBADO', 'RESOLVED');
    tx.transferOperation.findMany.mockResolvedValue([{ id: 'transfer-1', lotId: 'lot-1' }]);
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Trasvase incorrecto'
    });
    expect(tx.transferOperation.update).toHaveBeenCalledWith({
      where: { id: 'transfer-1' },
      data: { cancelledAt: expect.any(Date) }
    });
  });

  it('reabre un lote terminado para retroceder de vacío a envasando', async () => {
    const { service, tx } = setup('VACIO', 'ENVASANDO');
    tx.tank.findFirst.mockResolvedValue({ ...tank, state: 'VACIO', activeLotId: null });
    tx.tankStateHistory.findMany.mockResolvedValue([
      {
        id: 'empty',
        state: 'VACIO',
        lotId: 'lot-1',
        endedAt: null,
        startedAt: new Date('2026-10-27T13:00:00Z')
      },
      {
        id: 'packaging',
        state: 'ENVASANDO',
        lotId: 'lot-1',
        endedAt: new Date(),
        startedAt: new Date('2026-10-27T12:00:00Z')
      }
    ]);
    tx.productionLot.findUnique.mockResolvedValue({
      id: 'lot-1',
      finishedAt: new Date(),
      cancelledAt: null
    });
    tx.packagingOrder.findFirst.mockResolvedValue({ id: 'oe-1', finishedAt: new Date() });
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'VACIO',
      to: 'ENVASANDO'
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Cierre incorrecto'
    });
    expect(tx.productionLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { finishedAt: null }
    });
    expect(tx.packagingOrder.update).toHaveBeenCalledWith({
      where: { id: 'oe-1' },
      data: expect.objectContaining({ finishedAt: null })
    });
    expect(tx.tank.update).toHaveBeenCalledWith({
      where: { id: 'tank-101' },
      data: { activeLotId: 'lot-1' }
    });
  });

  it('no reabre un tanque de Látex en envasado si Devree ya ocupa otro', async () => {
    const { service, tx } = setup('VACIO', 'ENVASANDO');
    tx.plant.findUnique.mockResolvedValue({ code: 'LATEX' });
    tx.$queryRaw = jest.fn().mockResolvedValue([{ lock: '' }]);
    tx.tank.findFirst
      .mockResolvedValueOnce({ ...tank, state: 'VACIO', activeLotId: null })
      .mockResolvedValueOnce({ id: 'tank-102' });
    tx.tankStateHistory.findMany.mockResolvedValue([
      { id: 'empty', state: 'VACIO', lotId: 'lot-1', endedAt: null, startedAt: new Date() },
      {
        id: 'packaging',
        state: 'ENVASANDO',
        lotId: 'lot-1',
        endedAt: new Date(),
        startedAt: new Date()
      }
    ]);
    tx.productionLot.findUnique.mockResolvedValue({
      id: 'lot-1',
      finishedAt: new Date(),
      cancelledAt: null
    });
    tx.packagingOrder.findFirst.mockResolvedValue({ id: 'oe-1', finishedAt: new Date() });
    await expect(
      service.rollbackState('company-1', 'tank-101', admin, {
        version: 7,
        reason: 'Cierre incorrecto'
      })
    ).rejects.toThrow('La línea Devree ya está envasando otro tanque');
    expect(tx.productionLot.update).not.toHaveBeenCalled();
  });

  it.each([
    ['TRASVASANDO', true],
    ['RECHAZADO', false]
  ])('reabre desde vacío el cierre de %s', async (previous, hasTransfer) => {
    const { service, tx } = setup('VACIO', previous);
    tx.tank.findFirst.mockResolvedValue({ ...tank, state: 'VACIO', activeLotId: null });
    tx.tankStateHistory.findMany.mockResolvedValue([
      {
        id: 'empty',
        state: 'VACIO',
        lotId: 'lot-1',
        endedAt: null,
        startedAt: new Date('2026-10-27T13:00:00Z')
      },
      {
        id: 'prior',
        state: previous,
        lotId: 'lot-1',
        endedAt: new Date(),
        startedAt: new Date('2026-10-27T12:00:00Z')
      }
    ]);
    tx.productionLot.findUnique.mockResolvedValue({
      id: 'lot-1',
      finishedAt: new Date(),
      cancelledAt: null
    });
    if (hasTransfer)
      tx.transferOperation.findFirst.mockResolvedValue({
        id: 'transfer-1',
        finishedAt: new Date()
      });
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from: 'VACIO',
      to: previous
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Cierre incorrecto'
    });
    if (hasTransfer)
      expect(tx.transferOperation.update).toHaveBeenCalledWith({
        where: { id: 'transfer-1' },
        data: expect.objectContaining({ finishedAt: null })
      });
    expect(tx.tank.update).toHaveBeenCalledWith({
      where: { id: 'tank-101' },
      data: { activeLotId: 'lot-1' }
    });
  });

  it.each([
    ['FUERA_DE_SERVICIO', 'VACIO'],
    ['VACIO', 'FUERA_DE_SERVICIO']
  ])('retrocede el cambio de servicio %s a %s', async (from, to) => {
    const { service, tx } = setup(from, to);
    tx.tank.findFirst.mockResolvedValue({ ...tank, state: from, activeLotId: null });
    tx.tankStateHistory.findMany.mockResolvedValue([
      {
        id: 'current',
        state: from,
        lotId: null,
        endedAt: null,
        startedAt: new Date('2026-10-27T13:00:00Z')
      },
      {
        id: 'previous',
        state: to,
        lotId: null,
        endedAt: new Date(),
        startedAt: new Date('2026-10-27T12:00:00Z'),
        description: 'Mantenimiento'
      }
    ]);
    expect(await service.rollbackPreview('company-1', 'tank-101', admin)).toMatchObject({
      from,
      to
    });
    await service.rollbackState('company-1', 'tank-101', admin, {
      version: 7,
      reason: 'Cambio de servicio erróneo'
    });
    expect(tx.tank.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: to })
      })
    );
  });
});

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
          id: 'tank-101',
          companyId: 'company-1',
          plantId: 'plant-latex',
          number: 101,
          name: 'TK101',
          capacityKg: null,
          scaleKey: 'TK101',
          telemetryMode: 'AUTOMATIC',
          state: 'VACIO',
          version: 0,
          activeLot: null,
          stateHistory: []
        }
      ])
    },
    plant: {
      findFirst: jest.fn().mockResolvedValue({ id: 'plant-latex' }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'plant-latex' }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ settings: {}, code: 'LATEX', finalOperation: 'PACKAGING' })
    }
  } as any;
  const config = {
    get: jest.fn((key: string) =>
      key === 'NODE_RED_API_KEY'
        ? 'integration-secret'
        : key === 'SYSTEM_OWNER_COMPANY_ID'
          ? 'company-1'
          : undefined
    )
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

  it('recibe peso y velocidad juntos con la integración de LATEX', async () => {
    const service = new PlantService(prisma, config, notifications);
    const keyHash = createHash('sha256').update('integration-secret').digest('hex');
    prisma.plant.findFirst.mockResolvedValueOnce({
      id: 'plant-latex',
      code: 'LATEX',
      integrations: [{ source: 'NODE_RED_LATEX', keyHash }]
    });

    const result = await service.ingestPlantWeights('LATEX', 'integration-secret', {
      source: 'NODE_RED_LATEX',
      readings: [{ scaleKey: 'TK101', grossKg: 5070.125 }],
      speeds: [{ line: 'DEVREE', containersPerMinute: 42 }]
    });
    const [tank] = await service.tanks('company-1');

    expect(result).toMatchObject({
      accepted: 1,
      results: [{ scaleKey: 'TK101', status: 'ACCEPTED' }],
      speeds: { accepted: 1, results: [{ line: 'DEVREE', status: 'ACCEPTED' }] }
    });
    expect(tank.telemetry.grossKg).toBe(5070.125);
  });

  it('acepta velocidad opcional en el endpoint legado de pesos de LATEX', async () => {
    const service = new PlantService(prisma, config, notifications);
    const result = await service.ingestWeights('integration-secret', 'company-1', {
      readings: [{ scaleKey: 'TK101', grossKg: 5070.125 }],
      speeds: [{ line: 'DEVREE', containersPerMinute: 0 }]
    });

    expect(result).toMatchObject({ accepted: 1, speeds: { accepted: 1, ignored: 0 } });
  });

  it('muestra la única velocidad de Devree en el tanque con OE activa', async () => {
    const service = new PlantService(prisma, config, notifications);
    const now = new Date();
    const tank = {
      id: 'tank-101',
      companyId: 'company-1',
      plantId: 'plant-latex',
      number: 101,
      name: 'TK101',
      capacityKg: null,
      scaleKey: 'TK101',
      telemetryMode: 'AUTOMATIC',
      state: 'ENVASANDO',
      version: 0,
      activeLot: {
        packagingOrders: [{ line: 'B', startedAt: new Date(now.getTime() - 1000) }],
        qualityDecisions: []
      },
      stateHistory: []
    };
    await service.ingestPackagingSpeeds('integration-secret', 'company-1', {
      readings: [{ line: 'DEVREE', containersPerMinute: 0, measuredAt: now.toISOString() }]
    });
    prisma.tank.findMany.mockResolvedValueOnce([
      tank,
      { ...tank, id: 'tank-102', state: 'APROBADO' }
    ]);

    const [packagingTank, approvedTank] = await service.tanks('company-1');

    expect(packagingTank.packagingSpeed).toMatchObject({ containersPerMinute: 0, online: true });
    expect(approvedTank.packagingSpeed).toMatchObject({ containersPerMinute: null, online: false });
  });

  it('rechaza velocidades dentro del lote de pesos de otra planta', async () => {
    const service = new PlantService(prisma, config, notifications);
    const keyHash = createHash('sha256').update('integration-secret').digest('hex');
    prisma.plant.findFirst.mockResolvedValueOnce({
      id: 'plant-sinteticos',
      code: 'SINTETICOS',
      integrations: [{ source: 'NODE_RED_SINTETICOS', keyHash }]
    });

    await expect(
      service.ingestPlantWeights('SINTETICOS', 'integration-secret', {
        source: 'NODE_RED_SINTETICOS',
        readings: [{ scaleKey: 'SIN01', grossKg: 100 }],
        speeds: [{ line: 'A', containersPerMinute: 42 }]
      })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.tank.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ scaleKey: 'SIN01' }) })
    );
  });

  it('muestra la velocidad de la línea sólo en un tanque con OE activa envasando', async () => {
    const service = new PlantService(prisma, config, notifications);
    const now = new Date();
    const result = await service.ingestPackagingSpeeds('integration-secret', 'company-1', {
      readings: [
        { line: 'A', containersPerMinute: 42, measuredAt: now.toISOString() },
        { line: 'B', containersPerMinute: 0, measuredAt: now.toISOString() }
      ]
    });
    const tank = {
      id: 'tank-101',
      companyId: 'company-1',
      plantId: 'plant-latex',
      number: 101,
      name: 'TK101',
      capacityKg: null,
      scaleKey: 'TK101',
      telemetryMode: 'AUTOMATIC',
      state: 'ENVASANDO',
      version: 0,
      activeLot: {
        packagingOrders: [{ line: 'A', startedAt: new Date(now.getTime() - 1000) }],
        qualityDecisions: []
      },
      stateHistory: []
    };
    prisma.tank.findMany.mockResolvedValueOnce([
      tank,
      {
        ...tank,
        id: 'tank-102',
        activeLot: {
          ...tank.activeLot,
          packagingOrders: [{ line: 'B', startedAt: new Date(now.getTime() - 1000) }]
        }
      }
    ]);
    const [packagingTank, stoppedLineTank] = await service.tanks('company-1');
    prisma.tank.findMany.mockResolvedValueOnce([{ ...tank, state: 'APROBADO' }]);
    const [approvedTank] = await service.tanks('company-1');

    expect(result.persisted).toBe(false);
    expect(packagingTank.packagingSpeed).toMatchObject({
      containersPerMinute: 42,
      online: true
    });
    expect(stoppedLineTank.packagingSpeed.containersPerMinute).toBe(0);
    expect(approvedTank.packagingSpeed.containersPerMinute).toBeNull();
    await expect(
      service.ingestPackagingSpeeds('integration-secret', 'company-1', {
        readings: [
          {
            line: 'A',
            containersPerMinute: 99,
            measuredAt: new Date(now.getTime() - 1000).toISOString()
          }
        ]
      })
    ).resolves.toMatchObject({ accepted: 0, ignored: 1 });
  });

  it('descarta la velocidad anterior al momento de reanudar un tanque', async () => {
    const service = new PlantService(prisma, config, notifications);
    const now = new Date();
    const resumedAt = new Date(now.getTime() - 5_000);
    (service as any).packagingSpeeds.set('plant-latex:DEVREE', {
      containersPerMinute: 20,
      measuredAt: new Date(now.getTime() - 10_000).toISOString(),
      receivedAt: now.toISOString()
    });
    const tank = {
      id: 'tank-101',
      companyId: 'company-1',
      plantId: 'plant-latex',
      number: 101,
      name: 'TK101',
      capacityKg: null,
      scaleKey: 'TK101',
      telemetryMode: 'AUTOMATIC',
      state: 'ENVASANDO',
      version: 3,
      activeLot: {
        packagingOrders: [{ line: 'A', startedAt: new Date(now.getTime() - 60_000) }],
        qualityDecisions: []
      },
      stateHistory: [{ state: 'ENVASANDO', startedAt: resumedAt }]
    };
    prisma.tank.findMany.mockResolvedValueOnce([tank]);
    expect((await service.tanks('company-1'))[0].packagingSpeed.online).toBe(false);
    (service as any).packagingSpeeds.set('plant-latex:DEVREE', {
      containersPerMinute: 20,
      measuredAt: now.toISOString(),
      receivedAt: now.toISOString()
    });
    prisma.tank.findMany.mockResolvedValueOnce([tank]);
    expect((await service.tanks('company-1'))[0].packagingSpeed.online).toBe(true);
  });

  it('requiere una integración de LATEX para recibir la velocidad por planta', async () => {
    const service = new PlantService(prisma, config, notifications);
    const keyHash = createHash('sha256').update('integration-secret').digest('hex');
    prisma.plant.findFirst.mockResolvedValueOnce({
      id: 'plant-latex',
      integrations: [{ source: 'NODE_RED_LATEX', keyHash }]
    });

    await expect(
      service.ingestPlantPackagingSpeeds('LATEX', 'integration-secret', {
        source: 'NODE_RED_LATEX',
        readings: [{ line: 'B', containersPerMinute: 0 }]
      })
    ).resolves.toMatchObject({ accepted: 1, persisted: false });
    await expect(
      service.ingestPlantPackagingSpeeds('SINTETICOS', 'integration-secret', {
        readings: [{ line: 'B', containersPerMinute: 1 }]
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a batch with an invalid integration key', async () => {
    const service = new PlantService(prisma, config, notifications);
    await expect(
      service.ingestWeights('wrong-key', 'company-1', {
        readings: [{ scaleKey: 'TK101', grossKg: 100 }]
      })
    ).rejects.toThrow(UnauthorizedException);
  });

  it('publishes only the read-only fields needed by the TV screen', async () => {
    const service = new PlantService(prisma, config, notifications);
    const [tank] = await service.publicTanks();

    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { id: 'company-1', isActive: true },
      select: {
        id: true,
        plants: { where: { code: 'LATEX', isActive: true }, select: { id: true }, take: 1 }
      }
    });
    expect(tank).toMatchObject({ id: 'tank-101', name: 'TK101', state: 'VACIO' });
    expect(tank).not.toHaveProperty('companyId');
    expect(tank).not.toHaveProperty('scaleKey');
    expect(tank).not.toHaveProperty('version');
  });

  it('publica todas las plantas en una sola respuesta plana para Grafana', async () => {
    prisma.tank.findMany.mockClear();
    prisma.company.findFirst.mockResolvedValueOnce({
      id: 'company-1',
      plants: [
        { id: 'plant-latex', code: 'LATEX', name: 'Látex' },
        { id: 'plant-sinteticos', code: 'SINTETICOS', name: 'Sintéticos' }
      ]
    });
    const service = new PlantService(prisma, config, notifications);

    const tanks = await service.publicAllTanks();

    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { id: 'company-1', isActive: true },
      select: {
        id: true,
        plants: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
    expect(tanks).toHaveLength(2);
    expect(tanks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ plantCode: 'LATEX', plantName: 'Látex', name: 'TK101' }),
        expect.objectContaining({
          plantCode: 'SINTETICOS',
          plantName: 'Sintéticos',
          name: 'TK101'
        })
      ])
    );
    expect(prisma.tank.findMany).toHaveBeenCalledTimes(2);
  });

  it('publica únicamente los motivos de ajuste necesarios para la pantalla TV', async () => {
    prisma.tank.findMany.mockResolvedValueOnce([
      {
        id: 'tank-101',
        companyId: 'company-1',
        plantId: 'plant-latex',
        number: 101,
        name: 'TK101',
        capacityKg: 60000,
        scaleKey: 'TK101',
        telemetryMode: 'AUTOMATIC',
        state: 'AJUSTE',
        version: 1,
        stateHistory: [],
        activeLot: {
          id: 'lot-1',
          manufacturingOrder: '26090101',
          materialCode: '600101',
          description: 'Látex',
          specificWeight: null,
          packagingOrders: [],
          laboratorySamples: [],
          qualityDecisions: [
            {
              id: 'decision-1',
              result: 'AJUSTE',
              reason: 'Viscosidad',
              adjustmentReasons: ['Viscosidad'],
              adjustmentItems: [{ id: 'item-1', materialCode: '1010', quantityKg: 10, position: 0 }]
            }
          ]
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

  it('usa únicamente las opciones de envasado propias de Sinteticos', async () => {
    prisma.plant.findUnique.mockResolvedValueOnce({
      settings: {},
      code: 'SINTETICOS',
      finalOperation: 'PACKAGING'
    });
    const service = new PlantService(prisma, config, notifications);

    const result = await (service as any).loadConfig('company-1', 'plant-sinteticos');

    expect(result.lines).toEqual(['Linea 1', 'Linea 20', 'Linea 3']);
    expect(result.formats).toEqual(['0.25L', '0.5L', '1L', '4L', '10L']);
  });

  it('permite en Sinteticos una OE sin dosificadora, filtro ni descripción', async () => {
    prisma.plant.findUnique.mockResolvedValueOnce({
      settings: {},
      code: 'SINTETICOS',
      finalOperation: 'PACKAGING'
    });
    const service = new PlantService(prisma, config, notifications);

    await expect(
      (service as any).validatePackaging(
        'company-1',
        {
          packagingOrder: '123456',
          materialCode: '1234',
          line: 'Linea 20',
          format: '0.5L'
        },
        'plant-sinteticos'
      )
    ).resolves.toBeUndefined();
  });

  it('mantiene los campos de envasado obligatorios para Látex', async () => {
    const service = new PlantService(prisma, config, notifications);

    await expect(
      (service as any).validatePackaging(
        'company-1',
        {
          packagingOrder: '123456',
          materialCode: '1234',
          line: 'A',
          format: '4 L'
        },
        'plant-latex'
      )
    ).rejects.toThrow('Dosificadora no configurada');
  });
});

describe('PlantService laboratory sample cycle', () => {
  const user = { sub: 'lab-user', companyId: 'company-1', role: 'LABORATORIO' } as any;
  const tank = {
    id: 'tank-101',
    companyId: 'company-1',
    plantId: 'plant-latex',
    name: 'TK101',
    state: 'LABORATORIO',
    version: 7,
    activeLotId: 'lot-1'
  };

  const createService = (
    sample: any = {
      id: 'sample-1',
      status: 'AWAITING_RECEIPT',
      iteration: 1
    }
  ) => {
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

    const result = await service.receiveLaboratorySample('company-1', 'tank-101', user, {
      version: 7,
      startAnalysis: false
    });

    expect(result).toMatchObject({ ok: true, sampleId: 'sample-1' });
    expect(tx.tank.updateMany).toHaveBeenCalledWith({
      where: { id: 'tank-101', state: 'LABORATORIO', version: 7 },
      data: { version: { increment: 1 } }
    });
    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: expect.objectContaining({
        status: 'RECEIVED',
        receivedByUserId: 'lab-user',
        receivedAt: expect.any(Date)
      })
    });
    expect(tx.plantAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SAMPLE_RECEIVED', entityType: 'LaboratorySample' })
      })
    );
  });

  it('puede iniciar el análisis al mismo tiempo que recibe la muestra', async () => {
    const { service, tx } = createService();

    await service.receiveLaboratorySample('company-1', 'tank-101', user, {
      version: 7,
      startAnalysis: true
    });

    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: expect.objectContaining({
        status: 'ANALYZING',
        analysisStartedByUserId: 'lab-user',
        analysisStartedAt: expect.any(Date)
      })
    });
  });

  it('inicia el análisis de una muestra recibida que estaba en espera', async () => {
    const { service, tx } = createService({ id: 'sample-1', status: 'RECEIVED', iteration: 1 });

    await service.startLaboratoryAnalysis('company-1', 'tank-101', user, { version: 7 });

    expect(tx.tank.updateMany).toHaveBeenCalledWith({
      where: { id: 'tank-101', state: 'LABORATORIO', version: 7 },
      data: { version: { increment: 1 } }
    });
    expect(tx.laboratorySample.update).toHaveBeenCalledWith({
      where: { id: 'sample-1' },
      data: expect.objectContaining({
        status: 'ANALYZING',
        analysisStartedByUserId: 'lab-user',
        analysisStartedAt: expect.any(Date)
      })
    });
    expect(tx.plantAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'LABORATORY_ANALYSIS_STARTED' })
      })
    );
  });

  it('impide informar un resultado antes de confirmar la recepción', async () => {
    const { service, tx } = createService(null);

    await expect(
      service.quality('company-1', 'tank-101', user, {
        version: 7,
        result: 'APROBADO',
        employeeNumber: '1234',
        specificWeight: 1.25
      })
    ).rejects.toThrow('Laboratorio debe iniciar el análisis');
    expect(tx.qualityDecision.create).not.toHaveBeenCalled();
  });
});

describe('PlantService quality adjustment correction', () => {
  const user = { sub: 'lab-user', companyId: 'company-1', role: 'LABORATORIO' } as any;
  const currentDecision = {
    id: 'decision-1',
    reason: 'Viscosidad',
    adjustmentReasons: ['Viscosidad'],
    adjustmentItems: [{ id: 'item-1', materialCode: '1010', quantityKg: 10, position: 0 }]
  };

  const createService = (tankState = 'AJUSTE') => {
    const tx = {
      tank: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tank-101',
          companyId: 'company-1',
          plantId: 'plant-latex',
          name: 'TK101',
          state: tankState,
          version: 4,
          activeLotId: 'lot-1'
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plantId: 'plant-latex' })
      },
      qualityDecision: {
        findFirst: jest.fn().mockResolvedValue(currentDecision),
        update: jest.fn().mockResolvedValue({
          id: 'decision-1',
          reason: 'Color, Viscosidad',
          adjustmentReasons: ['Color', 'Viscosidad'],
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

    await expect(
      service.correctQualityAdjustment('company-1', 'tank-101', user, {
        version: 4,
        adjustmentReasons: ['Color', 'Viscosidad'],
        adjustments: [{ materialCode: '2020', quantityKg: 8.5 }]
      })
    ).resolves.toEqual({ ok: true });

    expect(tx.tank.updateMany).toHaveBeenCalledWith({
      where: { id: 'tank-101', state: 'AJUSTE', version: 4 },
      data: { version: { increment: 1 } }
    });
    expect(tx.qualityDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'decision-1' },
        data: expect.objectContaining({
          reason: 'Color, Viscosidad',
          adjustmentReasons: ['Color', 'Viscosidad'],
          adjustmentItems: {
            deleteMany: {},
            create: [{ position: 0, materialCode: '2020', quantityKg: 8.5 }]
          }
        })
      })
    );
    expect(tx.plantAuditLog.create).toHaveBeenCalled();
    expect(notifications.notifyTankAction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ targetSector: 'FABRICACION' })
    );
  });

  it('rechaza la corrección si el tanque ya no está en AJUSTE', async () => {
    const { service, tx } = createService('LABORATORIO');

    await expect(
      service.correctQualityAdjustment('company-1', 'tank-101', user, {
        version: 4,
        adjustmentReasons: ['Color'],
        adjustments: [{ materialCode: '2020', quantityKg: 8.5 }]
      })
    ).rejects.toThrow(ConflictException);
    expect(tx.qualityDecision.update).not.toHaveBeenCalled();
  });

  it('registra agitación o recirculación sin materiales al corregir el ajuste', async () => {
    const { service, tx } = createService();

    await expect(
      service.correctQualityAdjustment('company-1', 'tank-101', user, {
        version: 4,
        adjustmentReasons: ['Agitación/Recirculación']
      })
    ).resolves.toEqual({ ok: true });

    expect(tx.qualityDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Agitación/Recirculación',
          adjustmentItems: { deleteMany: {}, create: [] }
        })
      })
    );
  });
});

describe('PlantService history pagination', () => {
  it('ordena de forma estable y aplica un offset seguro para el informe completo', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PlantService(
      { tankStateHistory: { findMany } } as any,
      { get: jest.fn() } as any,
      { notifyTankAction: jest.fn() } as any
    );

    await service.history(
      'company-1',
      undefined,
      undefined,
      undefined,
      undefined,
      'plant-latex',
      '1000'
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-1', plantId: 'plant-latex' }),
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: 1000,
        skip: 1000
      })
    );

    await service.history(
      'company-1',
      undefined,
      undefined,
      undefined,
      undefined,
      'plant-latex',
      'Infinity'
    );
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0 }));
  });
});

describe('PlantService history summary', () => {
  const makeService = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValue(rows);
    const service = new PlantService(
      { $queryRaw: queryRaw } as any,
      { get: jest.fn() } as any,
      { notifyTankAction: jest.fn() } as any
    );
    return { service, queryRaw };
  };

  it('ordena todas las OF antes de paginar, sin fusionar lotes con igual numeración', async () => {
    const { service } = makeService([
      {
        lotId: 'a',
        manufacturingOrder: '00000010',
        materialCode: '100010',
        description: 'Zeta',
        adjustments: 1n,
        packagingOrders: 2n
      },
      {
        lotId: 'b',
        manufacturingOrder: '00000002',
        materialCode: '100002',
        description: 'Ácido',
        adjustments: 0n,
        packagingOrders: 1n
      },
      {
        lotId: 'c',
        manufacturingOrder: '00000010',
        materialCode: '100003',
        description: 'Base',
        adjustments: 3n,
        packagingOrders: 0n
      }
    ]);

    const first = await service.historySummary('company-1', 'plant-1', {
      sortBy: 'manufacturingOrder',
      sortDirection: 'asc',
      offset: '0',
      limit: '2'
    });
    const second = await service.historySummary('company-1', 'plant-1', {
      sortBy: 'manufacturingOrder',
      sortDirection: 'asc',
      offset: '2',
      limit: '2'
    });
    expect(first).toMatchObject({ total: 3, rows: [{ lotId: 'b' }, { lotId: 'a' }] });
    expect(second.rows).toEqual([expect.objectContaining({ lotId: 'c' })]);

    const byAdjustments = await service.historySummary('company-1', 'plant-1', {
      sortBy: 'adjustments',
      sortDirection: 'desc'
    });
    expect(byAdjustments.rows.map((row) => row.lotId)).toEqual(['c', 'a', 'b']);
    const byProduct = await service.historySummary('company-1', 'plant-1', {
      sortBy: 'description',
      sortDirection: 'asc'
    });
    expect(byProduct.rows.map((row) => row.lotId)).toEqual(['b', 'c', 'a']);
  });

  it('restringe la consulta a empresa/planta y cuenta decisiones, no estados ni materiales', async () => {
    const { service, queryRaw } = makeService([]);
    await service.historySummary('company-1', 'plant-1', {
      from: '2026-10-01',
      to: '2026-10-31',
      search: 'OF',
      state: 'AJUSTE'
    });
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.sql).toContain('h."companyId"');
    expect(sql.sql).toContain('h."plantId"');
    expect(sql.sql).toContain('"QualityDecision"');
    expect(sql.sql).toContain('q."cancelledAt" IS NULL');
    expect(sql.values).toContain('company-1');
    expect(sql.values).toContain('plant-1');
    expect(sql.values).toContain('OF');
  });

  it('rechaza columnas y límites no permitidos antes de consultar', async () => {
    const { service, queryRaw } = makeService([]);
    await expect(
      service.historySummary('company-1', 'plant-1', { sortBy: 'drop table' })
    ).rejects.toThrow(BadRequestException);
    await expect(service.historySummary('company-1', 'plant-1', { limit: '1001' })).rejects.toThrow(
      BadRequestException
    );
    await expect(
      service.historySummary('company-1', 'plant-1', { state: 'INVENTADO' })
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.historySummary('company-1', 'plant-1', { from: '2026-02-31' })
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.historySummary('company-1', 'plant-1', { from: '2026-11-01', to: '2026-10-31' })
    ).rejects.toThrow(BadRequestException);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
