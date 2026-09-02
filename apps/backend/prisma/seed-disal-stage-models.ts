import { OrderStageStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_ID = process.env.SYSTEM_OWNER_COMPANY_ID?.trim() || 'seed_company_disal';

const templates = [
  { code: 'CHASIS', name: 'Fabricación de Chasis', sector: 'Estructuras', minutes: 1440, weight: 12, dependencies: [] },
  { code: 'PAREDES', name: 'Fabricación de Paredes', sector: 'Cerramientos', minutes: 1320, weight: 11, dependencies: [] },
  { code: 'PISO', name: 'Fabricación de Piso', sector: 'Estructuras', minutes: 960, weight: 8, dependencies: [] },
  { code: 'TECHO', name: 'Fabricación de Techo', sector: 'Cerramientos', minutes: 1080, weight: 9, dependencies: [] },
  { code: 'ABERTURAS', name: 'Fabricación de Aberturas', sector: 'Aberturas', minutes: 840, weight: 7, dependencies: [] },
  { code: 'ELECTRICA', name: 'Instalación Eléctrica', sector: 'Electricidad', minutes: 900, weight: 8, dependencies: ['TECHO'] },
  { code: 'SANITARIA', name: 'Instalación Sanitaria', sector: 'Sanitaria', minutes: 900, weight: 8, dependencies: ['TECHO'] },
  { code: 'PINTURA', name: 'Pintura de Componentes', sector: 'Pintura', minutes: 960, weight: 8, dependencies: ['PAREDES', 'TECHO', 'ABERTURAS'] },
  { code: 'ARMADO', name: 'Armado Final de la Casilla', sector: 'Montaje', minutes: 1200, weight: 10, dependencies: ['CHASIS', 'PISO', 'PAREDES', 'TECHO', 'ABERTURAS', 'ELECTRICA', 'SANITARIA', 'PINTURA'] },
  { code: 'TERMINACIONES', name: 'Terminaciones', sector: 'Terminación', minutes: 720, weight: 6, dependencies: ['ARMADO'] },
  { code: 'CALIDAD', name: 'Control de Calidad', sector: 'Calidad', minutes: 300, weight: 5, dependencies: ['TERMINACIONES'], isQualityGate: true },
  { code: 'ENTREGA', name: 'Entrega', sector: 'Logística', minutes: 180, weight: 4, dependencies: ['CALIDAD'], isDeliveryGate: true }
] as const;

const modelDefinitions = [
  ['RC4400', 'Casilla Rural RC4400', '4,40 m'],
  ['RC4900', 'Casilla Rural RC4900', '4,90 m'],
  ['RC6000', 'Casilla Rural RC6000', '6,00 m']
] as const;

async function seedModels() {
  const revisions: Record<string, string> = {};
  for (const [code, name, dimensions] of modelDefinitions) {
    const model = await prisma.cabinModel.upsert({
      where: { companyId_code: { companyId: COMPANY_ID, code } },
      update: { name, isActive: true },
      create: { id: `DISAL_model_${code.toLowerCase()}`, companyId: COMPANY_ID, code, name }
    });
    const revision = await prisma.cabinModelRevision.upsert({
      where: { cabinModelId_version: { cabinModelId: model.id, version: 1 } },
      update: { label: 'Flujo productivo inicial', dimensions, isDefault: true, isActive: true },
      create: {
        id: `DISAL_revision_${code.toLowerCase()}_v1`,
        cabinModelId: model.id,
        version: 1,
        label: 'Flujo productivo inicial',
        dimensions,
        isDefault: true
      }
    });
    revisions[code] = revision.id;
    const stageIds: Record<string, string> = {};
    for (let position = 0; position < templates.length; position += 1) {
      const stage = templates[position];
      const row = await prisma.cabinStageTemplate.upsert({
        where: { revisionId_code: { revisionId: revision.id, code: stage.code } },
        update: {
          name: stage.name,
          sector: stage.sector,
          position,
          estimatedTimeMin: stage.minutes,
          weight: stage.weight,
          isMandatory: true,
          isQualityGate: 'isQualityGate' in stage ? Boolean(stage.isQualityGate) : false,
          isDeliveryGate: 'isDeliveryGate' in stage ? Boolean(stage.isDeliveryGate) : false
        },
        create: {
          id: `DISAL_template_${code.toLowerCase()}_${stage.code.toLowerCase()}`,
          revisionId: revision.id,
          code: stage.code,
          name: stage.name,
          sector: stage.sector,
          position,
          estimatedTimeMin: stage.minutes,
          weight: stage.weight,
          isQualityGate: 'isQualityGate' in stage ? Boolean(stage.isQualityGate) : false,
          isDeliveryGate: 'isDeliveryGate' in stage ? Boolean(stage.isDeliveryGate) : false
        }
      });
      stageIds[stage.code] = row.id;
    }
    for (const stage of templates) {
      for (const prerequisite of stage.dependencies) {
        await prisma.cabinStageDependency.upsert({
          where: {
            stageId_dependsOnStageId: {
              stageId: stageIds[stage.code],
              dependsOnStageId: stageIds[prerequisite]
            }
          },
          update: {},
          create: {
            stageId: stageIds[stage.code],
            dependsOnStageId: stageIds[prerequisite]
          }
        });
      }
    }
  }
  return revisions;
}

const orderScenario: Record<string, {
  model: string;
  statuses: Record<string, OrderStageStatus>;
  assignments: Record<string, string>;
}> = {
  'DISAL-2026-0001': { model: 'RC4400', statuses: { CHASIS: 'EN_PROCESO' }, assignments: { 'martin.acosta@disal.local': 'CHASIS' } },
  'DISAL-2026-0002': { model: 'RC4900', statuses: { TECHO: 'COMPLETADA', ELECTRICA: 'EN_PROCESO' }, assignments: { 'diego.ferreyra@disal.local': 'ELECTRICA' } },
  'DISAL-2026-0003': { model: 'RC6000', statuses: { PAREDES: 'PAUSADA' }, assignments: { 'nicolas.gomez@disal.local': 'PAREDES' } },
  'DISAL-2026-0004': { model: 'RC4400', statuses: {}, assignments: {} },
  'DISAL-2026-0005': { model: 'RC4900', statuses: { PAREDES: 'COMPLETADA', TECHO: 'COMPLETADA', ABERTURAS: 'COMPLETADA', PINTURA: 'EN_PROCESO' }, assignments: { 'sebastian.rios@disal.local': 'PINTURA' } },
  'DISAL-2026-0006': { model: 'RC6000', statuses: { PAREDES: 'EN_PROCESO', ABERTURAS: 'EN_PROCESO' }, assignments: { 'martin.acosta@disal.local': 'PAREDES', 'lucas.benitez@disal.local': 'ABERTURAS' } },
  'DISAL-2026-0007': { model: 'RC4400', statuses: { TECHO: 'COMPLETADA', ELECTRICA: 'EN_PROCESO', SANITARIA: 'EN_PROCESO' }, assignments: { 'diego.ferreyra@disal.local': 'ELECTRICA', 'nicolas.gomez@disal.local': 'SANITARIA' } },
  'DISAL-2026-0008': { model: 'RC4900', statuses: { CHASIS: 'COMPLETADA', PAREDES: 'COMPLETADA', PISO: 'COMPLETADA', TECHO: 'COMPLETADA', ABERTURAS: 'COMPLETADA', ELECTRICA: 'COMPLETADA', SANITARIA: 'COMPLETADA', PINTURA: 'COMPLETADA', ARMADO: 'COMPLETADA', TERMINACIONES: 'COMPLETADA', CALIDAD: 'DISPONIBLE' }, assignments: {} }
};

async function migrateOrders(revisions: Record<string, string>) {
  const owner = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID, isSystemOwner: true }
  });
  for (const [code, scenario] of Object.entries(orderScenario)) {
    const order = await prisma.order.findFirst({ where: { companyId: COMPANY_ID, code } });
    if (!order) continue;
    const templatesForModel = await prisma.cabinStageTemplate.findMany({
      where: { revisionId: revisions[scenario.model] },
      include: { dependencies: true },
      orderBy: { position: 'asc' }
    });
    const orderStages: Record<string, { id: string; status: OrderStageStatus; weight: unknown; progressPct: number }> = {};
    for (const template of templatesForModel) {
      const hasDependencies = template.dependencies.length > 0;
      const explicit = scenario.statuses[template.code];
      const prerequisitesComplete = template.dependencies.every((dependency) => {
        const prerequisite = templatesForModel.find((item) => item.id === dependency.dependsOnStageId);
        return prerequisite && scenario.statuses[prerequisite.code] === 'COMPLETADA';
      });
      const status = explicit ?? (hasDependencies ? (prerequisitesComplete ? 'DISPONIBLE' : 'BLOQUEADA') : 'DISPONIBLE');
      const progressPct = status === 'COMPLETADA' ? 100 : status === 'EN_PROCESO' ? 50 : 0;
      const row = await prisma.orderStage.upsert({
        where: { orderId_code: { orderId: order.id, code: template.code } },
        update: {
          templateId: template.id, name: template.name, sector: template.sector, position: template.position,
          status, progressPct, estimatedTimeMin: template.estimatedTimeMin, weight: template.weight,
          isQualityGate: template.isQualityGate, isDeliveryGate: template.isDeliveryGate
        },
        create: {
          id: `DISAL_order_stage_${order.id}_${template.code.toLowerCase()}`,
          companyId: COMPANY_ID, orderId: order.id, templateId: template.id, code: template.code,
          name: template.name, sector: template.sector, position: template.position, status, progressPct,
          estimatedTimeMin: template.estimatedTimeMin, weight: template.weight,
          isQualityGate: template.isQualityGate, isDeliveryGate: template.isDeliveryGate
        }
      });
      orderStages[template.code] = row;
    }
    for (const template of templatesForModel) {
      for (const dependency of template.dependencies) {
        const prerequisite = templatesForModel.find((item) => item.id === dependency.dependsOnStageId)!;
        await prisma.orderStageDependency.upsert({
          where: {
            stageId_dependsOnStageId: {
              stageId: orderStages[template.code].id,
              dependsOnStageId: orderStages[prerequisite.code].id
            }
          },
          update: {},
          create: {
            stageId: orderStages[template.code].id,
            dependsOnStageId: orderStages[prerequisite.code].id
          }
        });
      }
    }
    for (const [email, stageCode] of Object.entries(scenario.assignments)) {
      const user = await prisma.user.findFirst({ where: { companyId: COMPANY_ID, email } });
      if (!user) continue;
      const assignment = await prisma.orderAssignment.findFirst({
        where: { orderId: order.id, userId: user.id, unassignedAt: null }
      });
      if (assignment) {
        await prisma.orderAssignment.update({
          where: { id: assignment.id },
          data: {
            orderStageId: orderStages[stageCode].id,
            assignedByUserId: owner?.id
          }
        });
        await prisma.resource.update({
          where: { id: assignment.resourceId },
          data: { linkedUserId: user.id }
        });
      }
    }
    const values = Object.values(orderStages);
    const totalWeight = values.reduce((sum, stage) => sum + Number(stage.weight), 0);
    const progressPct = Math.round(values.reduce((sum, stage) => sum + Number(stage.weight) * stage.progressPct, 0) / totalWeight);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        cabinModelRevisionId: revisions[scenario.model],
        progressPct,
        createdByUserId: order.createdByUserId ?? owner?.id
      }
    });
    if (owner) {
      await prisma.orderAssignment.updateMany({
        where: { orderId: order.id, assignedByUserId: null },
        data: { assignedByUserId: owner.id }
      });
      await prisma.operationLog.updateMany({
        where: { orderId: order.id, eventType: 'ASIGNADO' },
        data: { userId: owner.id }
      });
    }
    const primaryStageCode = Object.values(scenario.assignments)[0];
    if (primaryStageCode && orderStages[primaryStageCode]) {
      await prisma.operationLog.updateMany({
        where: { orderId: order.id, eventType: { not: 'OT_CREADA' } },
        data: { orderStageId: orderStages[primaryStageCode].id }
      });
    }
  }
}

async function main() {
  const revisions = await seedModels();
  await migrateOrders(revisions);
  console.log('Modelos, grafos y etapas productivas DISAL cargados.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
