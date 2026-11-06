/* Importación histórica local de sólo datos cerrados. No ejecutar en producción. */
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient, Prisma } = require('/app/node_modules/@prisma/client');

const sourcePath = process.argv[2];
const expectedLocalPlantId = 'plant_latex_065cde85b26b78fb5c5f3c3a711fae02';
const apply = process.argv.includes('--apply');
const backupPath = process.argv.find((arg) => arg.startsWith('--backup='))?.slice(9);
if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('Falta el NDJSON de origen');
if (apply && (!backupPath || !fs.existsSync(backupPath) || fs.statSync(backupPath).size < 1024))
  throw new Error('Para aplicar se exige un respaldo local válido mediante --backup=...');

const by = {};
for (const [index, line] of fs.readFileSync(sourcePath, 'utf8').trim().split(/\r?\n/).entries()) {
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    throw new Error(`JSON inválido en línea ${index + 1}`);
  }
  (by[row.entity] ??= []).push(row.data);
}
const manifest = by.manifest?.[0];
if (
  manifest?.format !== 'LATEX_REPORTING_NDJSON_V1' ||
  manifest.plantCode !== 'LATEX' ||
  manifest.consistentSnapshot !== true ||
  by.Company?.length !== 1 ||
  by.Plant?.length !== 1
)
  throw new Error('Manifiesto o alcance de exportación inválido');
const sourceCompany = by.Company[0].id;
const sourcePlant = by.Plant[0].id;
if (by.Plant[0].companyId !== sourceCompany) throw new Error('Empresa de origen inconsistente');

const ids = {};
for (const [entity, rows] of Object.entries(by)) {
  const values = rows.map((row) => row.id).filter(Boolean);
  ids[entity] = new Set(values);
  if (values.length !== ids[entity].size) throw new Error(`IDs duplicados en ${entity}`);
  if (rows.some((row) => row.companyId && row.companyId !== sourceCompany))
    throw new Error(`Empresa cruzada en ${entity}`);
  if (rows.some((row) => row.plantId && row.plantId !== sourcePlant))
    throw new Error(`Planta cruzada en ${entity}`);
}
const reference = (entity, field, target, optional = false) => {
  for (const row of by[entity] ?? []) {
    if (!row[field] && optional) continue;
    if (!ids[target]?.has(row[field]))
      throw new Error(`Referencia ${entity}.${field} ausente en exportación`);
  }
};
reference('ProductionLot', 'tankId', 'Tank');
reference('ProductionLot', 'createdByUserId', 'User');
reference('TankStateHistory', 'tankId', 'Tank');
reference('TankStateHistory', 'lotId', 'ProductionLot', true);
reference('TankStateHistory', 'userId', 'User', true);
reference('QualityDecision', 'lotId', 'ProductionLot');
reference('QualityDecision', 'userId', 'User');
reference('LaboratorySample', 'lotId', 'ProductionLot');
reference('LaboratorySample', 'tankId', 'Tank');
reference('LaboratorySample', 'qualityDecisionId', 'QualityDecision', true);
for (const field of ['requestedByUserId', 'receivedByUserId', 'analysisStartedByUserId'])
  reference('LaboratorySample', field, 'User', true);
reference('QualityAdjustmentItem', 'qualityDecisionId', 'QualityDecision');
reference('PackagingOrder', 'lotId', 'ProductionLot');
reference('PackagingOrder', 'tankId', 'Tank');
reference('PackagingOrder', 'startedByUserId', 'User');
reference('PackagingOrder', 'finishedByUserId', 'User', true);
reference('PlantAuditLog', 'lotId', 'ProductionLot', true);
reference('PlantAuditLog', 'tankId', 'Tank', true);
reference('PlantAuditLog', 'userId', 'User', true);

const date = (value) => (value == null ? null : new Date(value));
const dates = (row, fields) => Object.fromEntries(fields.map((field) => [field, date(row[field])]));
for (const rows of Object.values(by))
  for (const row of rows)
    for (const field of [
      'startedAt',
      'endedAt',
      'createdAt',
      'updatedAt',
      'requestedAt',
      'receivedAt',
      'analysisStartedAt',
      'resolvedAt',
      'finishedAt',
      'scheduledAt'
    ])
      if (row[field] != null && !Number.isFinite(Date.parse(row[field])))
        throw new Error(`Fecha inválida en ${field}`);

const prisma = new PrismaClient();
async function main() {
  const company = await prisma.company.findUnique({
    where: { id: sourceCompany },
    select: { id: true }
  });
  if (!company) throw new Error('La empresa de origen no existe en local');
  const plant = await prisma.plant.findFirst({
    where: { companyId: company.id, code: 'LATEX' },
    select: { id: true, code: true }
  });
  if (!plant) throw new Error('LATEX no existe en local');
  if (plant.id !== expectedLocalPlantId)
    throw new Error('Este importador sólo admite la base local verificada de LATEX');
  const tanks = await prisma.tank.findMany({
    where: { companyId: company.id, plantId: plant.id },
    select: { id: true, number: true, equipmentCode: true }
  });
  const tankMap = new Map();
  for (const source of by.Tank ?? []) {
    const local = tanks.find(
      (tank) => tank.number === source.number && tank.equipmentCode === source.equipmentCode
    );
    if (!local) throw new Error(`Tanque ${source.number} no coincide con local`);
    tankMap.set(source.id, local.id);
  }
  const models = {
    User: 'user',
    ProductionLot: 'productionLot',
    TankStateHistory: 'tankStateHistory',
    QualityDecision: 'qualityDecision',
    LaboratorySample: 'laboratorySample',
    QualityAdjustmentItem: 'qualityAdjustmentItem',
    PackagingOrder: 'packagingOrder',
    PlantAuditLog: 'plantAuditLog'
  };
  if (process.argv.includes('--verify')) {
    const expected = {
      User: by.User.length,
      ProductionLot: by.ProductionLot.length,
      TankStateHistory: by.TankStateHistory.filter((row) => row.endedAt).length,
      QualityDecision: by.QualityDecision.length,
      LaboratorySample: by.LaboratorySample.filter(
        (row) => row.resolvedAt && row.status === 'RESOLVED'
      ).length,
      QualityAdjustmentItem: by.QualityAdjustmentItem.length,
      PackagingOrder: by.PackagingOrder.filter((row) => row.finishedAt).length,
      PlantAuditLog: by.PlantAuditLog.length
    };
    const actual = {};
    for (const [entity, model] of Object.entries(models)) {
      actual[entity] = await prisma[model].count({
        where: { id: { in: [...ids[entity]] } }
      });
      if (actual[entity] !== expected[entity])
        throw new Error(
          `Importación incompleta para ${entity}: ${actual[entity]}/${expected[entity]}`
        );
    }
    const activeArchivedUsers = await prisma.user.count({
      where: { id: { in: [...ids.User] }, isActive: true }
    });
    const archivedUserAccess = await prisma.userPlantAccess.count({
      where: { userId: { in: [...ids.User] } }
    });
    if (activeArchivedUsers || archivedUserAccess)
      throw new Error('Los usuarios históricos tienen acceso activo');
    console.log(
      JSON.stringify({ mode: 'VERIFY', actual, activeArchivedUsers, archivedUserAccess })
    );
    return;
  }
  const collisions = {};
  for (const [entity, model] of Object.entries(models)) {
    const sourceIds = [...(ids[entity] ?? [])];
    collisions[entity] = sourceIds.length
      ? (
          await prisma[model].findMany({
            where: { id: { in: sourceIds } },
            select: { id: true }
          })
        ).length
      : 0;
  }
  if (Object.values(collisions).some(Boolean))
    throw new Error(`IDs de origen ya presentes en local: ${JSON.stringify(collisions)}`);
  const localOrders = await prisma.productionLot.findMany({
    where: {
      companyId: company.id,
      plantId: plant.id,
      manufacturingOrder: { in: (by.ProductionLot ?? []).map((lot) => lot.manufacturingOrder) }
    },
    select: { manufacturingOrder: true, materialCode: true }
  });
  const duplicateOrderTexts = (by.ProductionLot ?? []).filter((lot) =>
    localOrders.some(
      (local) =>
        local.manufacturingOrder === lot.manufacturingOrder &&
        local.materialCode === lot.materialCode
    )
  ).length;
  if (duplicateOrderTexts)
    throw new Error(`Hay ${duplicateOrderTexts} OF/material ya presentes con distinto ID`);
  const archivedUsernames = (by.User ?? []).map((user) => `historico_${user.username}`);
  const usernameConflicts = await prisma.user.count({
    where: { companyId: company.id, username: { in: archivedUsernames } }
  });
  if (usernameConflicts) throw new Error('Ya existen usuarios históricos con esos nombres');

  const closedStates = (by.TankStateHistory ?? []).filter((row) => row.endedAt);
  const closedPackaging = (by.PackagingOrder ?? []).filter((row) => row.finishedAt);
  const resolvedSamples = (by.LaboratorySample ?? []).filter(
    (row) => row.resolvedAt && row.status === 'RESOLVED'
  );
  const counts = {
    archivedUsers: by.User?.length ?? 0,
    lots: by.ProductionLot?.length ?? 0,
    closedStates: closedStates.length,
    excludedOpenStates: (by.TankStateHistory?.length ?? 0) - closedStates.length,
    decisions: by.QualityDecision?.length ?? 0,
    resolvedSamples: resolvedSamples.length,
    excludedOpenSamples: (by.LaboratorySample?.length ?? 0) - resolvedSamples.length,
    adjustmentItems: by.QualityAdjustmentItem?.length ?? 0,
    closedPackaging: closedPackaging.length,
    excludedOpenPackaging: (by.PackagingOrder?.length ?? 0) - closedPackaging.length,
    auditLogs: by.PlantAuditLog?.length ?? 0
  };
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', plant: plant.code, counts }));
  if (!apply) return;

  const importedAt = new Date();
  const mapTank = (id) => (id ? tankMap.get(id) : null);
  const batches = async (tx, model, rows) => {
    for (let i = 0; i < rows.length; i += 250) {
      await tx[model].createMany({ data: rows.slice(i, i + 250) });
    }
  };
  await prisma.$transaction(
    async (tx) => {
      await batches(
        tx,
        'user',
        by.User.map((row) => ({
          id: row.id,
          companyId: company.id,
          username: `historico_${row.username}`,
          email: `historico+${crypto.createHash('sha256').update(row.id).digest('hex').slice(0, 24)}@import.local.invalid`,
          fullName: row.fullName,
          role: row.role,
          isActive: false,
          passwordHash: `!disabled:${crypto.randomBytes(32).toString('hex')}`,
          createdAt: importedAt
        }))
      );
      await batches(
        tx,
        'productionLot',
        by.ProductionLot.map((row) => ({
          ...row,
          companyId: company.id,
          plantId: plant.id,
          tankId: mapTank(row.tankId),
          ...dates(row, ['scheduledAt', 'startedAt', 'finishedAt', 'createdAt', 'updatedAt']),
          cancelledAt: null
        }))
      );
      await batches(
        tx,
        'tankStateHistory',
        closedStates.map((row) => ({
          ...row,
          companyId: company.id,
          plantId: plant.id,
          tankId: mapTank(row.tankId),
          ...dates(row, ['startedAt', 'endedAt'])
        }))
      );
      await batches(
        tx,
        'qualityDecision',
        by.QualityDecision.map((row) => ({
          ...row,
          companyId: company.id,
          plantId: plant.id,
          ...dates(row, ['createdAt']),
          cancelledAt: null
        }))
      );
      await batches(
        tx,
        'qualityAdjustmentItem',
        by.QualityAdjustmentItem.map((row) => ({
          ...row,
          ...dates(row, ['createdAt'])
        }))
      );
      await batches(
        tx,
        'laboratorySample',
        resolvedSamples.map((row) => ({
          ...row,
          companyId: company.id,
          plantId: plant.id,
          tankId: mapTank(row.tankId),
          ...dates(row, [
            'requestedAt',
            'receivedAt',
            'analysisStartedAt',
            'resolvedAt',
            'createdAt'
          ]),
          cancelledAt: null
        }))
      );
      await batches(
        tx,
        'packagingOrder',
        closedPackaging.map((row) => ({
          ...row,
          companyId: company.id,
          plantId: plant.id,
          tankId: mapTank(row.tankId),
          ...dates(row, ['startedAt', 'finishedAt', 'createdAt', 'updatedAt']),
          cancelledAt: null
        }))
      );
      await batches(
        tx,
        'plantAuditLog',
        by.PlantAuditLog.map((row) => ({
          ...row,
          companyId: company.id,
          plantId: plant.id,
          tankId: mapTank(row.tankId),
          before: row.before === null ? Prisma.JsonNull : row.before,
          after: row.after === null ? Prisma.JsonNull : row.after,
          ...dates(row, ['createdAt'])
        }))
      );
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 120_000
    }
  );
  console.log('IMPORT_COMPLETE');
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
