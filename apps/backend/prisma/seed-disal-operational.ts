import {
  CommercialStatus,
  MaterialMovementType,
  OperationEventType,
  PrismaClient,
  ProductionStatus,
  ResourceStatus,
  ResourceType,
  UserRole
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const COMPANY_ID = process.env.SYSTEM_OWNER_COMPANY_ID?.trim() || 'seed_company_disal';
const SAMPLE_PASSWORD = process.env.DISAL_SAMPLE_PASSWORD?.trim();

function daysFromNow(days: number, hour = 8) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function hoursFrom(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function main() {
  if (!SAMPLE_PASSWORD || SAMPLE_PASSWORD.length < 10) {
    throw new Error('DISAL_SAMPLE_PASSWORD es requerida y debe tener al menos 10 caracteres.');
  }

  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    throw new Error(`No existe la empresa ${COMPANY_ID}. Ejecutá primero prisma:seed.`);
  }

  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 12);

  const operatorDefinitions = [
    {
      id: 'DISAL_sample_user_01',
      email: 'martin.acosta@disal.local',
      fullName: 'Martín Acosta',
      sector: 'Estructuras y soldadura'
    },
    {
      id: 'DISAL_sample_user_02',
      email: 'lucas.benitez@disal.local',
      fullName: 'Lucas Benítez',
      sector: 'Aberturas y carpintería metálica'
    },
    {
      id: 'DISAL_sample_user_03',
      email: 'diego.ferreyra@disal.local',
      fullName: 'Diego Ferreyra',
      sector: 'Instalaciones eléctricas'
    },
    {
      id: 'DISAL_sample_user_04',
      email: 'nicolas.gomez@disal.local',
      fullName: 'Nicolás Gómez',
      sector: 'Aislación y revestimientos'
    },
    {
      id: 'DISAL_sample_user_05',
      email: 'sebastian.rios@disal.local',
      fullName: 'Sebastián Ríos',
      sector: 'Pintura y terminación'
    }
  ];

  const users: Record<string, { id: string; fullName: string }> = {};
  for (const definition of operatorDefinitions) {
    const user = await prisma.user.upsert({
      where: {
        companyId_email: {
          companyId: COMPANY_ID,
          email: definition.email
        }
      },
      update: {
        username: definition.email.split('@')[0],
        fullName: definition.fullName,
        passwordHash,
        role: UserRole.OPERARIO,
        isActive: true,
        isProtected: false,
        isSystemOwner: false
      },
      create: {
        id: definition.id,
        companyId: COMPANY_ID,
        email: definition.email,
        username: definition.email.split('@')[0],
        fullName: definition.fullName,
        passwordHash,
        role: UserRole.OPERARIO,
        isActive: true
      }
    });
    users[definition.id] = user;
  }

  const humanResources: Record<string, { id: string; name: string }> = {};
  for (const definition of operatorDefinitions) {
    const user = users[definition.id];
    humanResources[definition.id] = await prisma.resource.upsert({
      where: { id: `DISAL_sample_resource_${definition.id.slice(-2)}` },
      update: {
        companyId: COMPANY_ID,
        type: ResourceType.HUMANO,
        name: user.fullName,
        sector: definition.sector,
        status: ResourceStatus.OCUPADO,
        notes: 'Operario incluido en el escenario operativo DISAL',
        isActive: true
      },
      create: {
        id: `DISAL_sample_resource_${definition.id.slice(-2)}`,
        companyId: COMPANY_ID,
        type: ResourceType.HUMANO,
        name: user.fullName,
        sector: definition.sector,
        status: ResourceStatus.OCUPADO,
        notes: 'Operario incluido en el escenario operativo DISAL',
        isActive: true
      }
    });
  }

  const machineDefinitions = [
    ['DISAL_sample_machine_01', 'Mesa de corte y plegado', 'Estructuras'],
    ['DISAL_sample_machine_02', 'Soldadora MIG 1', 'Soldadura'],
    ['DISAL_sample_machine_03', 'Banco de instalaciones eléctricas', 'Electricidad'],
    ['DISAL_sample_machine_04', 'Cabina de pintura', 'Pintura'],
    ['DISAL_sample_machine_05', 'Puesto de terminación y control', 'Terminación']
  ] as const;

  const machines: Record<string, { id: string; name: string }> = {};
  for (const [id, name, sector] of machineDefinitions) {
    machines[id] = await prisma.resource.upsert({
      where: { id },
      update: {
        companyId: COMPANY_ID,
        type: ResourceType.MAQUINA,
        name,
        sector,
        status: ResourceStatus.OCUPADO,
        notes: 'Equipo incluido en el escenario operativo DISAL',
        isActive: true
      },
      create: {
        id,
        companyId: COMPANY_ID,
        type: ResourceType.MAQUINA,
        name,
        sector,
        status: ResourceStatus.OCUPADO,
        notes: 'Equipo incluido en el escenario operativo DISAL',
        isActive: true
      }
    });
  }

  const clientDefinitions = [
    ['DISAL_sample_client_01', 'Agropecuaria Los Ombúes', 'Producción agrícola', 'compras@losombues.example'],
    ['DISAL_sample_client_02', 'Estancia La Esperanza', 'Ganadería', 'administracion@laesperanza.example'],
    ['DISAL_sample_client_03', 'Servicios Ganaderos del Sur', 'Servicios rurales', 'proyectos@ganaderosdelsur.example'],
    ['DISAL_sample_client_04', 'Agrotransportes del Centro', 'Logística agropecuaria', 'operaciones@agrotransportes.example'],
    ['DISAL_sample_client_05', 'Cabaña Santa Rosa', 'Cría bovina', 'compras@santarosa.example'],
    ['DISAL_sample_client_06', 'Cooperativa Rural Norte', 'Cooperativa agropecuaria', 'infraestructura@ruralnorte.example'],
    ['DISAL_sample_client_07', 'Campos del Horizonte', 'Producción mixta', 'administracion@camposdelhorizonte.example'],
    ['DISAL_sample_client_08', 'Establecimiento Don Raúl', 'Agricultura y contratistas', 'contacto@donraul.example']
  ] as const;

  const clients: Record<string, { id: string }> = {};
  for (const [id, name, industry, email] of clientDefinitions) {
    clients[id] = await prisma.client.upsert({
      where: { id },
      update: {
        companyId: COMPANY_ID,
        name,
        industry,
        email,
        notes: 'Cliente ficticio del escenario operativo DISAL',
        isActive: true
      },
      create: {
        id,
        companyId: COMPANY_ID,
        name,
        industry,
        email,
        notes: 'Cliente ficticio del escenario operativo DISAL',
        isActive: true
      }
    });
  }

  const materialDefinitions = [
    ['DISAL_sample_material_01', 'Tubo estructural 60x40x2 mm', 'Estructura', 'm', 18500, 520],
    ['DISAL_sample_material_02', 'Chapa galvanizada calibre 25', 'Cerramiento', 'm2', 22400, 410],
    ['DISAL_sample_material_03', 'Panel aislante EPS 50 mm', 'Aislación', 'm2', 19800, 265],
    ['DISAL_sample_material_04', 'Fenólico 18 mm', 'Pisos', 'placa', 68500, 72],
    ['DISAL_sample_material_05', 'Revestimiento PVC interior', 'Revestimiento', 'm2', 17600, 330],
    ['DISAL_sample_material_06', 'Cable taller 3x2,5 mm', 'Electricidad', 'm', 2350, 980],
    ['DISAL_sample_material_07', 'Abertura aluminio 1200x1000', 'Aberturas', 'u', 248000, 28],
    ['DISAL_sample_material_08', 'Puerta exterior metálica', 'Aberturas', 'u', 315000, 18],
    ['DISAL_sample_material_09', 'Pintura poliuretánica exterior', 'Pintura', 'l', 21800, 160],
    ['DISAL_sample_material_10', 'Consumibles de soldadura MIG', 'Soldadura', 'kg', 12400, 95]
  ] as const;

  const materials: Record<string, { id: string; unitCost: unknown }> = {};
  for (const [id, name, category, unit, unitCost, initialStock] of materialDefinitions) {
    materials[id] = await prisma.material.upsert({
      where: { id },
      update: {
        companyId: COMPANY_ID,
        name,
        category,
        unit,
        unitCost,
        isActive: true
      },
      create: {
        id,
        companyId: COMPANY_ID,
        name,
        category,
        unit,
        unitCost,
        stock: initialStock,
        isActive: true
      }
    });
    await prisma.materialMovement.upsert({
      where: { id: `DISAL_sample_initial_${id.slice(-2)}` },
      update: {
        companyId: COMPANY_ID,
        materialId: id,
        type: MaterialMovementType.ENTRADA,
        quantity: initialStock,
        unitCost,
        note: 'Stock inicial del escenario operativo DISAL'
      },
      create: {
        id: `DISAL_sample_initial_${id.slice(-2)}`,
        companyId: COMPANY_ID,
        materialId: id,
        type: MaterialMovementType.ENTRADA,
        quantity: initialStock,
        unitCost,
        note: 'Stock inicial del escenario operativo DISAL'
      }
    });
  }

  type OrderDefinition = {
    id: string;
    code: string;
    clientId: string;
    model: string;
    title: string;
    currentProcess: string;
    detail: string;
    status: ProductionStatus;
    priority: number;
    startedDaysAgo?: number;
    plannedInDays: number;
    commitmentInDays: number;
    estimatedTimeMin: number;
    estimatedCost: number;
    operators: string[];
    machineId: string;
    progressNote: string;
    pauseReason?: string;
  };

  const orderDefinitions: OrderDefinition[] = [
    {
      id: 'DISAL_sample_order_01',
      code: 'DISAL-2026-0001',
      clientId: 'DISAL_sample_client_01',
      model: 'RC4400',
      title: 'Casilla rural RC4400 - Oficina de campo',
      currentProcess: 'Armado y soldadura de estructura',
      detail: 'Oficina de campo con escritorio doble, ventana lateral y preinstalación de aire acondicionado.',
      status: ProductionStatus.EN_PROCESO,
      priority: 2,
      startedDaysAgo: 8,
      plannedInDays: -10,
      commitmentInDays: 16,
      estimatedTimeMin: 6200,
      estimatedCost: 14800000,
      operators: ['DISAL_sample_user_01'],
      machineId: 'DISAL_sample_machine_02',
      progressNote: 'Estructura principal armada. Se completa soldadura de techo y refuerzos laterales.'
    },
    {
      id: 'DISAL_sample_order_02',
      code: 'DISAL-2026-0002',
      clientId: 'DISAL_sample_client_02',
      model: 'RC4900',
      title: 'Casilla rural RC4900 - Vestuario para personal',
      currentProcess: 'Instalación eléctrica y tablero',
      detail: 'Vestuario rural para ocho personas con iluminación LED, tomas reforzadas y termotanque eléctrico.',
      status: ProductionStatus.EN_PROCESO,
      priority: 1,
      startedDaysAgo: 13,
      plannedInDays: -15,
      commitmentInDays: 8,
      estimatedTimeMin: 7800,
      estimatedCost: 17600000,
      operators: ['DISAL_sample_user_03'],
      machineId: 'DISAL_sample_machine_03',
      progressNote: 'Cableado principal tendido. Falta montar tablero, protecciones y prueba de aislación.'
    },
    {
      id: 'DISAL_sample_order_03',
      code: 'DISAL-2026-0003',
      clientId: 'DISAL_sample_client_03',
      model: 'RC6000',
      title: 'Casilla rural RC6000 - Comedor de cuadrilla',
      currentProcess: 'Aislación térmica de paneles',
      detail: 'Comedor para doce personas con mesada, bacha, anafe y sector de guardado.',
      status: ProductionStatus.PAUSADA,
      priority: 1,
      startedDaysAgo: 11,
      plannedInDays: -13,
      commitmentInDays: 5,
      estimatedTimeMin: 9600,
      estimatedCost: 22400000,
      operators: ['DISAL_sample_user_04'],
      machineId: 'DISAL_sample_machine_05',
      progressNote: 'Laterales aislados al 70%. El frente quedó preparado para continuar.',
      pauseReason: 'Faltan paneles aislantes EPS para completar techo y frente.'
    },
    {
      id: 'DISAL_sample_order_04',
      code: 'DISAL-2026-0004',
      clientId: 'DISAL_sample_client_04',
      model: 'RC4400',
      title: 'Casilla rural RC4400 - Puesto de control',
      currentProcess: 'Corte y plegado de componentes',
      detail: 'Puesto de control de acceso con visual de tres lados, mostrador y espacio para equipos.',
      status: ProductionStatus.PLANIFICADA,
      priority: 3,
      plannedInDays: 1,
      commitmentInDays: 24,
      estimatedTimeMin: 5900,
      estimatedCost: 13900000,
      operators: ['DISAL_sample_user_02'],
      machineId: 'DISAL_sample_machine_01',
      progressNote: 'Planos liberados. Material reservado y corte programado para el próximo turno.'
    },
    {
      id: 'DISAL_sample_order_05',
      code: 'DISAL-2026-0005',
      clientId: 'DISAL_sample_client_05',
      model: 'RC4900',
      title: 'Casilla rural RC4900 - Dormitorio rural',
      currentProcess: 'Pintura exterior y terminaciones',
      detail: 'Dormitorio para cuatro personas con placares, mosquiteros y equipo de climatización.',
      status: ProductionStatus.EN_PROCESO,
      priority: 2,
      startedDaysAgo: 19,
      plannedInDays: -21,
      commitmentInDays: 3,
      estimatedTimeMin: 8200,
      estimatedCost: 18900000,
      operators: ['DISAL_sample_user_05'],
      machineId: 'DISAL_sample_machine_04',
      progressNote: 'Primera mano aplicada. Continúan acabado exterior, sellados y retoques interiores.'
    },
    {
      id: 'DISAL_sample_order_06',
      code: 'DISAL-2026-0006',
      clientId: 'DISAL_sample_client_06',
      model: 'RC6000',
      title: 'Casilla rural RC6000 - Oficina técnica',
      currentProcess: 'Colocación de aberturas y cerramientos',
      detail: 'Oficina técnica con sala de reunión, puestos administrativos y red de datos.',
      status: ProductionStatus.EN_PROCESO,
      priority: 3,
      startedDaysAgo: 6,
      plannedInDays: -8,
      commitmentInDays: 19,
      estimatedTimeMin: 10200,
      estimatedCost: 23800000,
      operators: ['DISAL_sample_user_01', 'DISAL_sample_user_02'],
      machineId: 'DISAL_sample_machine_01',
      progressNote: 'Cerramiento exterior al 55%. Se colocan marcos y se ajustan aberturas.'
    },
    {
      id: 'DISAL_sample_order_07',
      code: 'DISAL-2026-0007',
      clientId: 'DISAL_sample_client_07',
      model: 'RC4400',
      title: 'Casilla rural RC4400 - Sanitario de campaña',
      currentProcess: 'Revestimiento interior e instalaciones',
      detail: 'Módulo sanitario con dos duchas, dos inodoros, lavamanos y tanque elevado.',
      status: ProductionStatus.EN_PROCESO,
      priority: 1,
      startedDaysAgo: 15,
      plannedInDays: -17,
      commitmentInDays: 7,
      estimatedTimeMin: 7100,
      estimatedCost: 16500000,
      operators: ['DISAL_sample_user_03', 'DISAL_sample_user_04'],
      machineId: 'DISAL_sample_machine_03',
      progressNote: 'Revestimiento húmedo en ejecución y tendido eléctrico listo para artefactos.'
    },
    {
      id: 'DISAL_sample_order_08',
      code: 'DISAL-2026-0008',
      clientId: 'DISAL_sample_client_08',
      model: 'RC4900',
      title: 'Casilla rural RC4900 - Depósito de herramientas',
      currentProcess: 'Control final y corrección de detalles',
      detail: 'Depósito con estanterías reforzadas, banco de trabajo y acceso de doble hoja.',
      status: ProductionStatus.EN_PROCESO,
      priority: 2,
      startedDaysAgo: 20,
      plannedInDays: -22,
      commitmentInDays: 2,
      estimatedTimeMin: 7600,
      estimatedCost: 17100000,
      operators: ['DISAL_sample_user_05'],
      machineId: 'DISAL_sample_machine_05',
      progressNote: 'Control dimensional aprobado. Se corrigen sellados y se prepara checklist de entrega.'
    }
  ];

  const orders: Record<string, { id: string }> = {};
  for (const definition of orderDefinitions) {
    const startedAt = definition.startedDaysAgo === undefined
      ? null
      : daysFromNow(-definition.startedDaysAgo, 7);
    const description = [
      `Modelo: ${definition.model}.`,
      `Proceso actual: ${definition.currentProcess}.`,
      definition.detail,
      definition.progressNote
    ].join(' ');

    const order = await prisma.order.upsert({
      where: {
        companyId_code: {
          companyId: COMPANY_ID,
          code: definition.code
        }
      },
      update: {
        clientId: clients[definition.clientId].id,
        title: definition.title,
        description,
        purchaseOrderNumber: `OC-${definition.code.slice(-4)}`,
        commercialStatus: CommercialStatus.APROBADO,
        approvedAt: daysFromNow(definition.plannedInDays - 5),
        deliveryTimeDays: definition.commitmentInDays - definition.plannedInDays,
        estimatedMaterials: `Modelo ${definition.model}. Materiales reservados según configuración.`,
        productionStatus: definition.status,
        priority: definition.priority,
        plannedDate: daysFromNow(definition.plannedInDays),
        commitmentDate: daysFromNow(definition.commitmentInDays),
        startedAt,
        estimatedTimeMin: definition.estimatedTimeMin,
        estimatedCost: definition.estimatedCost,
        notes: definition.progressNote
      },
      create: {
        id: definition.id,
        companyId: COMPANY_ID,
        clientId: clients[definition.clientId].id,
        createdByUserId: null,
        code: definition.code,
        title: definition.title,
        description,
        purchaseOrderNumber: `OC-${definition.code.slice(-4)}`,
        commercialStatus: CommercialStatus.APROBADO,
        approvedAt: daysFromNow(definition.plannedInDays - 5),
        deliveryTimeDays: definition.commitmentInDays - definition.plannedInDays,
        estimatedMaterials: `Modelo ${definition.model}. Materiales reservados según configuración.`,
        productionStatus: definition.status,
        priority: definition.priority,
        plannedDate: daysFromNow(definition.plannedInDays),
        commitmentDate: daysFromNow(definition.commitmentInDays),
        startedAt,
        estimatedTimeMin: definition.estimatedTimeMin,
        estimatedCost: definition.estimatedCost,
        notes: definition.progressNote
      }
    });
    orders[definition.id] = order;

    await prisma.orderItem.upsert({
      where: { id: `${definition.id}_item` },
      update: {
        orderId: order.id,
        description: `${definition.title} - configuración completa`,
        quantity: 1,
        unit: 'unidad',
        estimatedUnitCost: definition.estimatedCost,
        estimatedHoursMin: definition.estimatedTimeMin,
        position: 0
      },
      create: {
        id: `${definition.id}_item`,
        orderId: order.id,
        description: `${definition.title} - configuración completa`,
        quantity: 1,
        unit: 'unidad',
        estimatedUnitCost: definition.estimatedCost,
        estimatedHoursMin: definition.estimatedTimeMin,
        position: 0
      }
    });

    const estimatedHours = definition.estimatedTimeMin / 60;
    const costing = [
      ['Estructura y soldadura', estimatedHours * 0.28, 18500],
      ['Cerramientos e instalaciones', estimatedHours * 0.42, 17200],
      ['Terminación y control', estimatedHours * 0.3, 16800]
    ] as const;
    for (let index = 0; index < costing.length; index += 1) {
      const [label, hours, rate] = costing[index];
      await prisma.orderCostingHour.upsert({
        where: { id: `${definition.id}_cost_${index}` },
        update: {
          orderId: order.id,
          label,
          hours,
          ratePerHour: rate,
          position: index
        },
        create: {
          id: `${definition.id}_cost_${index}`,
          orderId: order.id,
          label,
          hours,
          ratePerHour: rate,
          position: index
        }
      });
    }

    for (let index = 0; index < definition.operators.length; index += 1) {
      const operatorId = definition.operators[index];
      const user = users[operatorId];
      const resource = humanResources[operatorId];
      await prisma.orderAssignment.upsert({
        where: { id: `${definition.id}_operator_${index}` },
        update: {
          companyId: COMPANY_ID,
          orderId: order.id,
          resourceId: resource.id,
          userId: user.id,
          assignedAt: startedAt ?? daysFromNow(definition.plannedInDays),
          unassignedAt: null
        },
        create: {
          id: `${definition.id}_operator_${index}`,
          companyId: COMPANY_ID,
          orderId: order.id,
          resourceId: resource.id,
          userId: user.id,
          assignedAt: startedAt ?? daysFromNow(definition.plannedInDays)
        }
      });
    }

    await prisma.orderAssignment.upsert({
      where: { id: `${definition.id}_machine` },
      update: {
        companyId: COMPANY_ID,
        orderId: order.id,
        resourceId: machines[definition.machineId].id,
        userId: null,
        assignedAt: startedAt ?? daysFromNow(definition.plannedInDays),
        unassignedAt: null
      },
      create: {
        id: `${definition.id}_machine`,
        companyId: COMPANY_ID,
        orderId: order.id,
        resourceId: machines[definition.machineId].id,
        assignedAt: startedAt ?? daysFromNow(definition.plannedInDays)
      }
    });

    const primaryOperator = users[definition.operators[0]];
    const primaryResource = humanResources[definition.operators[0]];
    const referenceDate = startedAt ?? daysFromNow(definition.plannedInDays);
    const logs: Array<{
      id: string;
      eventType: OperationEventType;
      eventAt: Date;
      note?: string;
      pauseReason?: string;
    }> = [
      {
        id: `${definition.id}_log_created`,
        eventType: OperationEventType.OT_CREADA,
        eventAt: hoursFrom(referenceDate, -4),
        note: `${definition.code} creada para ${definition.title}.`
      },
      {
        id: `${definition.id}_log_assigned`,
        eventType: OperationEventType.ASIGNADO,
        eventAt: hoursFrom(referenceDate, -2),
        note: `Responsables asignados para ${definition.currentProcess}.`
      }
    ];
    if (definition.status !== ProductionStatus.PLANIFICADA) {
      logs.push(
        {
          id: `${definition.id}_log_start`,
          eventType: OperationEventType.INICIO,
          eventAt: referenceDate,
          note: `Inicio de fabricación. Proceso: ${definition.currentProcess}.`
        },
        {
          id: `${definition.id}_log_progress`,
          eventType: OperationEventType.NOTA,
          eventAt: daysFromNow(-1, 15),
          note: definition.progressNote
        }
      );
    }
    if (definition.status === ProductionStatus.PAUSADA) {
      logs.push({
        id: `${definition.id}_log_pause`,
        eventType: OperationEventType.PAUSA,
        eventAt: daysFromNow(0, 9),
        pauseReason: definition.pauseReason,
        note: `Producción pausada: ${definition.pauseReason}`
      });
    }

    for (const log of logs) {
      await prisma.operationLog.upsert({
        where: { id: log.id },
        update: {
          companyId: COMPANY_ID,
          orderId: order.id,
          resourceId: primaryResource.id,
          userId: primaryOperator.id,
          eventType: log.eventType,
          eventAt: log.eventAt,
          note: log.note,
          pauseReason: log.pauseReason
        },
        create: {
          id: log.id,
          companyId: COMPANY_ID,
          orderId: order.id,
          resourceId: primaryResource.id,
          userId: primaryOperator.id,
          eventType: log.eventType,
          eventAt: log.eventAt,
          note: log.note,
          pauseReason: log.pauseReason
        }
      });
    }
  }

  const consumptionDefinitions = [
    ['01', 'DISAL_sample_order_01', 'DISAL_sample_material_01', 82, 'Estructura principal'],
    ['02', 'DISAL_sample_order_01', 'DISAL_sample_material_10', 11, 'Soldadura de estructura'],
    ['03', 'DISAL_sample_order_02', 'DISAL_sample_material_06', 145, 'Tendido eléctrico'],
    ['04', 'DISAL_sample_order_03', 'DISAL_sample_material_03', 76, 'Aislación de laterales'],
    ['05', 'DISAL_sample_order_05', 'DISAL_sample_material_09', 28, 'Pintura exterior'],
    ['06', 'DISAL_sample_order_06', 'DISAL_sample_material_02', 96, 'Cerramiento exterior'],
    ['07', 'DISAL_sample_order_06', 'DISAL_sample_material_07', 4, 'Colocación de ventanas'],
    ['08', 'DISAL_sample_order_07', 'DISAL_sample_material_05', 64, 'Revestimiento interior'],
    ['09', 'DISAL_sample_order_07', 'DISAL_sample_material_06', 112, 'Instalación eléctrica'],
    ['10', 'DISAL_sample_order_08', 'DISAL_sample_material_08', 1, 'Puerta doble exterior'],
    ['11', 'DISAL_sample_order_08', 'DISAL_sample_material_09', 22, 'Terminación de pintura']
  ] as const;

  for (const [suffix, orderId, materialId, quantity, note] of consumptionDefinitions) {
    const definition = orderDefinitions.find((item) => item.id === orderId)!;
    const operator = users[definition.operators[0]];
    const material = materials[materialId];
    await prisma.materialConsumption.upsert({
      where: { id: `DISAL_sample_consumption_${suffix}` },
      update: {
        companyId: COMPANY_ID,
        orderId: orders[orderId].id,
        materialId: material.id,
        createdByUserId: operator.id,
        quantity,
        unitCostSnapshot: Number(material.unitCost),
        note,
        consumedAt: daysFromNow(-1, 11)
      },
      create: {
        id: `DISAL_sample_consumption_${suffix}`,
        companyId: COMPANY_ID,
        orderId: orders[orderId].id,
        materialId: material.id,
        createdByUserId: operator.id,
        quantity,
        unitCostSnapshot: Number(material.unitCost),
        note,
        consumedAt: daysFromNow(-1, 11)
      }
    });
    await prisma.materialMovement.upsert({
      where: { id: `DISAL_sample_consumption_movement_${suffix}` },
      update: {
        companyId: COMPANY_ID,
        materialId: material.id,
        type: MaterialMovementType.CONSUMO,
        quantity: -quantity,
        unitCost: Number(material.unitCost),
        note: `Consumo ${definition.code}: ${note}`
      },
      create: {
        id: `DISAL_sample_consumption_movement_${suffix}`,
        companyId: COMPANY_ID,
        materialId: material.id,
        type: MaterialMovementType.CONSUMO,
        quantity: -quantity,
        unitCost: Number(material.unitCost),
        note: `Consumo ${definition.code}: ${note}`
      }
    });
  }

  for (const material of Object.values(materials)) {
    const stock = await prisma.materialMovement.aggregate({
      where: { companyId: COMPANY_ID, materialId: material.id },
      _sum: { quantity: true }
    });
    await prisma.material.update({
      where: { id: material.id },
      data: { stock: Number(stock._sum.quantity ?? 0) }
    });
  }

  console.log('Escenario operativo DISAL cargado correctamente.');
  console.log('8 empresas cliente, 8 casillas activas, 5 operarios, 10 recursos y 10 materiales.');
  for (const definition of orderDefinitions) {
    const names = definition.operators.map((id) => users[id].fullName).join(' + ');
    console.log(`${definition.code} | ${definition.status} | ${definition.currentProcess} | ${names}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
