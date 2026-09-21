import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const COMPANY_ID = process.env.SYSTEM_OWNER_COMPANY_ID?.trim() || 'seed_company_disal';

const companySettings = {
  warningTimeDeviationPct: 20,
  criticalTimeDeviationPct: 40,
  warningCostDeviationPct: 15,
  criticalCostDeviationPct: 30,
  requireDeliveryChecklist: true,
  workOrderCodePrefix: 'DISAL',
  defaultWorkOrderPriority: 3,
  packagingLines: ['A', 'B'],
  packagingFormats: ['1 L', '4 L', '10 L', '20 L'],
  packagingDispensers: ['A', 'B'],
  packagingFilters: ['1', '2', '3'],
  adjustmentReasons: ['Nivel del tanque', 'Viscosidad', 'Cubritivo', 'Preservación', 'Brillo', 'Lavabilidad', 'Color', 'Reemplazo de materia prima', 'Error operativo o de proceso', 'Desaereante', 'Cambio de almacenamiento de producción'],
  plantStageTargetsMinutes: { FABRICANDO: 480, LABORATORIO: 30, AJUSTE: 60, RECHAZADO: 60, APROBADO: 120, ENVASANDO: 360, FUERA_DE_SERVICIO: 480 }
};

const tankNumbers = [101, 102, 103, 104, 105, 106, 107, 108, 109];

async function removeKnownDemoData() {
  const demoOrders = await prisma.order.findMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { id: { startsWith: 'seed_o' } },
        { id: { startsWith: 'DISAL_sample_order_' } },
        { code: { startsWith: 'DEMO-' } }
      ]
    },
    select: { id: true }
  });
  const demoOrderIds = demoOrders.map(({ id }) => id);

  const auditTargets = [
    ...demoOrderIds,
    'seed_u_owner',
    'seed_u_sup',
    'seed_u_op1',
    'seed_u_op2',
    'seed_u_op3',
    'seed_u_op4',
    'seed_u_op5'
  ];

  if (auditTargets.length) {
    await prisma.auditLog.deleteMany({
      where: {
        companyId: COMPANY_ID,
        OR: [
          { entityId: { in: auditTargets } },
          { entityId: { startsWith: 'seed_' } }
        ]
      }
    });
  }

  const orders = await prisma.order.deleteMany({
    where: { id: { in: demoOrderIds }, companyId: COMPANY_ID }
  });

  const resources = await prisma.resource.deleteMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { id: { startsWith: 'seed_r' } },
        { id: { startsWith: 'DISAL_sample_resource_' } },
        { id: { startsWith: 'DISAL_sample_machine_' } }
      ],
      assignments: { none: {} }
    }
  });

  const materials = await prisma.material.deleteMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { id: { startsWith: 'seed_m' } },
        { id: { startsWith: 'DISAL_sample_material_' } }
      ],
      consumptions: { none: {} }
    }
  });

  const clients = await prisma.client.deleteMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { id: { startsWith: 'seed_cl' } },
        { id: { startsWith: 'DISAL_sample_client_' } },
        { email: { endsWith: '.demo' } }
      ],
      orders: { none: {} }
    }
  });

  const users = await prisma.user.deleteMany({
    where: {
      companyId: COMPANY_ID,
      isProtected: false,
      isSystemOwner: false,
      OR: [
        { id: { startsWith: 'seed_u' } },
        { id: { startsWith: 'DISAL_sample_user_' } },
        { email: { endsWith: '@demo.jm' } },
        { email: { endsWith: '@disal.local' } }
      ]
    }
  });

  return {
    orders: orders.count,
    resources: resources.count,
    materials: materials.count,
    clients: clients.count,
    users: users.count
  };
}

async function main() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {
      name: 'Planta de Látex',
      legalName: 'Planta de Látex',
      settings: companySettings
    },
    create: {
      id: COMPANY_ID,
      name: 'Planta de Látex',
      legalName: 'Planta de Látex',
      settings: companySettings
    }
  });

  const removed = await removeKnownDemoData();
  const latex = await prisma.plant.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'LATEX' } }, update: {},
    create: { companyId: COMPANY_ID, code: 'LATEX', name: 'Látex', displayOrder: 10, finalOperation: 'PACKAGING', settings: { packagingLines: companySettings.packagingLines, packagingFormats: companySettings.packagingFormats, packagingDispensers: companySettings.packagingDispensers, packagingFilters: companySettings.packagingFilters, adjustmentReasons: companySettings.adjustmentReasons, stageTargetsMinutes: companySettings.plantStageTargetsMinutes } }
  });
  const additionalPlants = [
    { code: 'TERPLAST', name: 'Terplast', displayOrder: 20, finalOperation: 'PACKAGING' as const, count: 4 },
    { code: 'SLURRY', name: 'Slurry', displayOrder: 30, finalOperation: 'TRANSFER' as const, count: 2 },
    { code: 'ENDUIDO', name: 'Enduido', displayOrder: 40, finalOperation: 'PACKAGING' as const, count: 2 }
  ];
  for (const definition of additionalPlants) {
    const plant = await prisma.plant.upsert({ where: { companyId_code: { companyId: COMPANY_ID, code: definition.code } }, update: {}, create: { companyId: COMPANY_ID, code: definition.code, name: definition.name, displayOrder: definition.displayOrder, finalOperation: definition.finalOperation } });
    for (let number = 1; number <= definition.count; number += 1) {
      const disperser = definition.code === 'SLURRY';
      const terplast = definition.code === 'TERPLAST';
      const tank = await prisma.tank.upsert({
        where: { plantId_number: { plantId: plant.id, number } }, update: {},
        create: { companyId: COMPANY_ID, plantId: plant.id, number, name: terplast ? `TANQUE ${number + 2}` : disperser ? `Dispersora ${number}` : `Equipo ${number}`, capacityKg: terplast ? (number <= 2 ? 1500 : 8000) : null, equipmentCode: disperser ? `DISP${number}` : `EQ${number}`, equipmentType: disperser ? 'DISPERSER' : 'TANK', telemetryMode: definition.code === 'ENDUIDO' ? 'NOT_INSTALLED' : 'PENDING', scaleKey: null }
      });
      const open = await prisma.tankStateHistory.findFirst({ where: { tankId: tank.id, endedAt: null } });
      if (!open) await prisma.tankStateHistory.create({ data: { companyId: COMPANY_ID, plantId: plant.id, tankId: tank.id, state: tank.state, description: 'Estado inicial' } });
    }
  }

  for (const number of tankNumbers) {
    const capacityKg = number <= 102 ? 60_000
      : number <= 104 ? 45_000
        : number <= 107 ? 30_000
          : 10_500;
    const tank = await prisma.tank.upsert({
      where: { plantId_number: { plantId: latex.id, number } },
      update: {},
      create: {
        companyId: COMPANY_ID,
        plantId: latex.id,
        number,
        equipmentCode: 'TK' + number,
        name: `TK${number}`,
        capacityKg,
        scaleKey: `TK${number}`
      }
    });
    const openHistory = await prisma.tankStateHistory.findFirst({ where: { tankId: tank.id, endedAt: null } });
    if (!openHistory) {
      await prisma.tankStateHistory.create({ data: { companyId: COMPANY_ID, plantId: latex.id, tankId: tank.id, state: tank.state, description: 'Estado inicial' } });
    }
  }

  if (process.env.DISAL_ENABLE_WEIGHT_SIMULATOR?.trim().toLowerCase() === 'true') {
    const integrationKey = process.env.NODE_RED_API_KEY?.trim();
    if (!integrationKey) {
      throw new Error('NODE_RED_API_KEY es requerida cuando DISAL_ENABLE_WEIGHT_SIMULATOR=true');
    }
    const keyHash = createHash('sha256').update(integrationKey).digest('hex');
    const localTelemetry = [
      { plantCode: 'LATEX', source: 'NODE_RED_LATEX', scaleKeys: tankNumbers.map((number) => `TK${number}`) },
      { plantCode: 'TERPLAST', source: 'NODE_RED_TERPLAST_LOCAL', scaleKeys: ['TERP01', 'TERP02', 'TERP03', 'TERP04'] },
      { plantCode: 'SLURRY', source: 'NODE_RED_SLURRY_LOCAL', scaleKeys: ['SLURRY01', 'SLURRY02'] }
    ];

    for (const definition of localTelemetry) {
      const plant = await prisma.plant.findUniqueOrThrow({
        where: { companyId_code: { companyId: COMPANY_ID, code: definition.plantCode } }
      });
      const equipment = await prisma.tank.findMany({
        where: { plantId: plant.id },
        orderBy: { number: 'asc' },
        select: { id: true }
      });
      if (equipment.length !== definition.scaleKeys.length) {
        throw new Error(`Cantidad inesperada de equipos para simulación local en ${definition.plantCode}`);
      }
      for (let index = 0; index < equipment.length; index += 1) {
        await prisma.tank.update({
          where: { id: equipment[index].id },
          data: { scaleKey: definition.scaleKeys[index], telemetryMode: 'AUTOMATIC' }
        });
      }
      await prisma.plantIntegration.upsert({
        where: { plantId_source: { plantId: plant.id, source: definition.source } },
        update: { keyHash, isActive: true },
        create: {
          companyId: COMPANY_ID,
          plantId: plant.id,
          source: definition.source,
          keyHash,
          isActive: true
        }
      });
    }
    console.log('Telemetría simulada local habilitada para Látex, Terplast y Slurry.');
  }

  // No elimina equipos con producción: sólo configuraciones obsoletas vacías.
  await prisma.tank.deleteMany({
    where: { plantId: latex.id, number: { notIn: tankNumbers }, lots: { none: {} } }
  });

  console.log('Inicialización de Planta de Látex completada.');
  console.log(`Empresa activa: Planta de Látex (${COMPANY_ID})`);
  console.log(
    `Datos demo eliminados: ${removed.orders} órdenes, ${removed.resources} recursos, ` +
    `${removed.materials} materiales, ${removed.clients} clientes y ${removed.users} usuarios.`
  );
  console.log('No se crean datos ficticios. Ejecutá security:ensure-system-owner para asegurar el administrador protegido.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
