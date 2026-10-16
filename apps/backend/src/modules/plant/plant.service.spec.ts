import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PlantService } from './plant.service';
import { createHash } from 'crypto';

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
