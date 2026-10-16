const { execFileSync } = require('node:child_process');

function inspect(name) {
  const raw = execFileSync('docker', ['inspect', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(raw)[0];
}

module.exports = async () => {
  if (process.env.E2E_DISPOSABLE !== 'latex-e2e') {
    throw new Error('E2E bloqueado: E2E_DISPOSABLE debe ser latex-e2e.');
  }
  const url = new URL(process.env.E2E_BASE_URL || '');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:' || !url.port) {
    throw new Error('E2E bloqueado: E2E_BASE_URL debe usar http y un puerto local explícito.');
  }
  const db = inspect('disal-db');
  const backend = inspect('disal-backend');
  const nginx = inspect('disal-nginx');
  for (const item of [db, backend, nginx]) {
    if (!item.State.Running || item.Config.Labels?.['com.docker.compose.project'] !== 'latex-e2e') {
      throw new Error('E2E bloqueado: los tres contenedores deben pertenecer al proyecto Compose latex-e2e.');
    }
  }
  const env = Object.fromEntries(backend.Config.Env.map((entry) => entry.split(/=(.*)/s).slice(0, 2)));
  const database = new URL(env.DATABASE_URL);
  const dbEnv = Object.fromEntries(db.Config.Env.map((entry) => entry.split(/=(.*)/s).slice(0, 2)));
  if (database.hostname !== 'disal-db' || database.pathname.slice(1) !== 'latex_e2e' || dbEnv.POSTGRES_DB !== 'latex_e2e' || !db.Mounts.some((mount) => mount.Destination === '/var/lib/postgresql/data' && mount.Name?.startsWith('latex-e2e_'))) {
    throw new Error('E2E bloqueado: backend y volumen PostgreSQL no son descartables.');
  }
  const ports = nginx.NetworkSettings.Ports?.['80/tcp'] || [];
  if (!ports.some((port) => port.HostPort === url.port)) {
    throw new Error('E2E bloqueado: E2E_BASE_URL no corresponde al puerto del Nginx aislado.');
  }
  for (const key of ['E2E_ADMIN_IDENTIFIER', 'E2E_ADMIN_PASSWORD', 'E2E_PLANT_CODE', 'E2E_TANK_ID', 'E2E_MATERIAL_CODE', 'E2E_PACKAGING_MATERIAL', 'E2E_PACKAGING_LINE', 'E2E_PACKAGING_FORMAT', 'E2E_DISPENSER', 'E2E_FILTER', 'E2E_EMPLOYEE_NUMBER', 'E2E_OPERATOR_IDENTIFIER', 'E2E_OPERATOR_PASSWORD', 'E2E_OTHER_PLANT_CODE']) {
    if (!process.env[key]) throw new Error(`E2E: falta ${key}.`);
  }
};
