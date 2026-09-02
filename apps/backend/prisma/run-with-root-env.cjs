const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.resolve(process.cwd(), '..', '..', '.env');

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Uso: node prisma/run-with-root-env.cjs <comando> [...args]');
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env
});

process.exit(result.status ?? 1);
