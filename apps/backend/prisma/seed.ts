import { PrismaClient } from '@prisma/client';

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
  packagingLines: ['Línea 1', 'Línea 20', 'Línea 3'],
  packagingFormats: ['0,25 L', '0,50 L', '1 L', '4 L', '10 L'],
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

  for (const number of tankNumbers) {
    const capacityKg = number <= 102 ? 60_000
      : number <= 104 ? 45_000
        : number <= 107 ? 30_000
          : 10_500;
    const tank = await prisma.tank.upsert({
      where: { companyId_number: { companyId: COMPANY_ID, number } },
      update: { name: `TK${number}`, capacityKg, scaleKey: `TK${number}` },
      create: {
        companyId: COMPANY_ID,
        number,
        name: `TK${number}`,
        capacityKg,
        scaleKey: `TK${number}`
      }
    });
    const openHistory = await prisma.tankStateHistory.findFirst({ where: { tankId: tank.id, endedAt: null } });
    if (!openHistory) {
      await prisma.tankStateHistory.create({ data: { companyId: COMPANY_ID, tankId: tank.id, state: tank.state, description: 'Estado inicial' } });
    }
  }

  // No elimina equipos con producción: sólo configuraciones obsoletas vacías.
  await prisma.tank.deleteMany({
    where: { companyId: COMPANY_ID, number: { notIn: tankNumbers }, lots: { none: {} } }
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
