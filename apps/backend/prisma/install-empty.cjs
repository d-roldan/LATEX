const { execFileSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' LIMIT 1`);
  await prisma.$disconnect();
  if (rows.length) throw new Error('Instalación vacía rechazada: la base ya contiene tablas de aplicación. Usar el procedimiento de actualización/baseline auditado.');
  const cli = join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
  const run = (args) => execFileSync(process.execPath, [cli, ...args, '--schema', join(__dirname, 'schema.prisma')], { stdio: 'inherit', env: process.env });
  run(['db', 'push', '--skip-generate']);
  const migrations = readdirSync(join(__dirname, 'migrations'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  for (const migration of migrations) run(['migrate', 'resolve', '--applied', migration]);
  run(['validate']);
  console.log(`Baseline verificado: esquema actual materializado y ${migrations.length} migraciones reconciliadas.`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
