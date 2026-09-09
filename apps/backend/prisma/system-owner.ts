import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile();

const prisma = new PrismaClient();

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} es requerido`);
  }

  return value;
}

function requireStrongPassword(value: string) {
  if (value.length < 6 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new Error('SYSTEM_OWNER_PASSWORD debe tener al menos 6 caracteres y como máximo 72 bytes');
  }
  return value;
}

async function main() {
  const mode = process.argv.includes('--rotate') ? 'rotate' : 'ensure';
  const companyId = process.env.SYSTEM_OWNER_COMPANY_ID?.trim() || 'seed_company_disal';
  const email = process.env.SYSTEM_OWNER_USERNAME?.trim().toLowerCase() || 'admin@disal.local';
  const username = email.split('@')[0];
  const fullName = process.env.SYSTEM_OWNER_FULL_NAME?.trim() || 'Administrador DISAL';
  const password = process.env.SYSTEM_OWNER_PASSWORD?.trim();

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new Error(`No existe la empresa ${companyId}. Ejecuta el seed o define SYSTEM_OWNER_COMPANY_ID.`);
  }

  const existing = await prisma.user.findUnique({
    where: { companyId_email: { companyId, email } }
  });

  if (mode === 'rotate') {
    const nextPassword = requireStrongPassword(requireEnv('SYSTEM_OWNER_PASSWORD'));
    if (!existing) {
      throw new Error(`No existe el usuario protegido ${email}`);
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(nextPassword, 12),
        isActive: true,
        isProtected: true,
        isSystemOwner: true,
        role: UserRole.ADMIN,
        sessionVersion: { increment: 1 }
      }
    });

    console.log(`Password rotada para ${email}`);
    return;
  }

  const passwordHash = password
    ? await bcrypt.hash(requireStrongPassword(password), 12)
    : undefined;
  if (!existing && !passwordHash) {
    throw new Error('SYSTEM_OWNER_PASSWORD es requerido para crear el usuario protegido');
  }

  const owner = await prisma.user.upsert({
    where: { companyId_email: { companyId, email } },
    update: {
      username,
      fullName,
      role: UserRole.ADMIN,
      isActive: true,
      isProtected: true,
      isSystemOwner: true,
      ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {})
    },
    create: {
      companyId,
      email,
      username,
      fullName,
      role: UserRole.ADMIN,
      isActive: true,
      isProtected: true,
      isSystemOwner: true,
      passwordHash: passwordHash!
    }
  });
  const plants = await prisma.plant.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true } });
  for (const plant of plants) {
    await prisma.userPlantAccess.upsert({
      where: { userId_plantId: { userId: owner.id, plantId: plant.id } },
      update: { canTransfer: plant.code === 'SLURRY' },
      create: { userId: owner.id, plantId: plant.id, canTransfer: plant.code === 'SLURRY' }
    });
  }

  console.log(`Usuario protegido listo: ${email} (usuario: ${username})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
