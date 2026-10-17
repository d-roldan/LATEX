import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Ejecutar sólo en el destino elegido y con respaldo verificado. No asigna permisos a usuarios.
async function main() {
  const prisma = new PrismaClient();
  try {
    const companyId = process.env.SYSTEM_OWNER_COMPANY_ID?.trim() || 'seed_company_disal';
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Empresa no encontrada; indicar SYSTEM_OWNER_COMPANY_ID');
    const plant = await prisma.plant.upsert({
      where: { companyId_code: { companyId, code: 'ENVASES' } },
      update: {},
      create: {
        companyId,
        code: 'ENVASES',
        name: 'ENVASES',
        displayOrder: 60,
        finalOperation: 'PACKAGING',
        settings: { equipmentType: 'INJECTION_MACHINE', monitoringOnly: true }
      }
    });
    const key = process.env.ENVASES_NODE_RED_KEY?.trim();
    if (key) {
      if (key.length < 32)
        throw new Error('ENVASES_NODE_RED_KEY debe tener al menos 32 caracteres');
      const keyHash = createHash('sha256').update(key).digest('hex');
      await prisma.plantIntegration.upsert({
        where: { plantId_source: { plantId: plant.id, source: 'NODE_RED_ENVASES' } },
        update: { keyHash, isActive: true },
        create: {
          companyId,
          plantId: plant.id,
          source: 'NODE_RED_ENVASES',
          keyHash,
          isActive: true
        }
      });
    }
    console.log(
      `ENVASES preparada para empresa ${companyId}; integración ${key ? 'activa' : 'pendiente de clave'}.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
