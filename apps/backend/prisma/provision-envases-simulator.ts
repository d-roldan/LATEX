import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Sólo para la base local de desarrollo; no modifica la integración industrial real.
async function main() {
  if (process.env.DISAL_ENABLE_ENVASES_SIMULATOR !== 'true')
    throw new Error('Simulador ENVASES deshabilitado');
  const key = process.env.ENVASES_SIM_NODE_RED_KEY?.trim();
  if (!key || key.length < 32) throw new Error('Falta clave local ENVASES_SIM_NODE_RED_KEY');
  const prisma = new PrismaClient();
  try {
    const companyId = process.env.SYSTEM_OWNER_COMPANY_ID?.trim() || 'seed_company_disal';
    const plant = await prisma.plant.findUnique({
      where: { companyId_code: { companyId, code: 'ENVASES' } }
    });
    if (!plant) throw new Error('ENVASES no existe en la base local');
    await prisma.plantIntegration.upsert({
      where: { plantId_source: { plantId: plant.id, source: 'NODE_RED_ENVASES_SIM' } },
      update: { keyHash: createHash('sha256').update(key).digest('hex'), isActive: true },
      create: {
        companyId,
        plantId: plant.id,
        source: 'NODE_RED_ENVASES_SIM',
        keyHash: createHash('sha256').update(key).digest('hex'),
        isActive: true
      }
    });
    console.log('Credencial local de simulación ENVASES actualizada.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
