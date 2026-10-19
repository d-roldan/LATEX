import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const packages = ['apps/backend', 'apps/frontend'];
const tools = ['prettier', 'eslint'];
const errors = [];

for (const packageDir of packages) {
  const lock = JSON.parse(readFileSync(join(packageDir, 'package-lock.json'), 'utf8'));
  for (const tool of tools) {
    const expected = lock.packages?.[`node_modules/${tool}`]?.version;
    let installed;
    try {
      installed = JSON.parse(
        readFileSync(join(packageDir, 'node_modules', tool, 'package.json'), 'utf8')
      ).version;
    } catch {
      installed = 'ausente';
    }
    if (!expected || installed !== expected) {
      errors.push(`${packageDir}: ${tool} instalado=${installed}, lockfile=${expected ?? 'ausente'}`);
    }
  }
}

if (errors.length) {
  console.error('Las herramientas locales no coinciden con los lockfiles:');
  for (const error of errors) console.error(`- ${error}`);
  console.error('Ejecutar npm ci en los paquetes indicados antes de validar y publicar.');
  process.exitCode = 1;
} else {
  console.log('Herramientas de formato y lint iguales a los lockfiles.');
}
