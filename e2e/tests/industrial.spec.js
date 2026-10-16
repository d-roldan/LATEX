const { test, expect } = require('@playwright/test');
const { login, auth, tank, action } = require('../support/api.cjs');

test.describe.configure({ mode: 'serial' });
const plant = process.env.E2E_PLANT_CODE;
const id = process.env.E2E_TANK_ID;
const path = `/api/plants/${plant}/tanks/${id}`;
const unique = Date.now().toString().slice(-8);
let admin;

test.beforeAll(async ({ playwright }) => {
  const setup = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
  try {
    admin = await login(setup, process.env.E2E_ADMIN_IDENTIFIER, process.env.E2E_ADMIN_PASSWORD);
    const current = await tank(setup, admin, plant, id);
    expect(current.state, 'se requiere un tanque VACIO en una base descartable').toBe('VACIO');
    const configResponse = await setup.get(`/api/plants/${plant}/config`, { headers: auth(admin) });
    expect(configResponse.ok()).toBeTruthy();
    expect((await configResponse.json()).finalOperation).toBe('PACKAGING');
  } finally {
    await setup.dispose();
  }
});

test('A: fabricación, laboratorio, aprobación y envasado completo', async ({ request }) => {
  let current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'manufacturing', { version: current.version, manufacturingOrder: unique, materialCode: process.env.E2E_MATERIAL_CODE, description: 'Ensayo E2E aislado' });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('FABRICANDO');
  await action(request, admin, plant, id, 'send-to-lab', { version: current.version });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('LABORATORIO');
  await action(request, admin, plant, id, 'laboratory/sample-received', { version: current.version, startAnalysis: true });
  current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'quality', { version: current.version, result: 'APROBADO', employeeNumber: process.env.E2E_EMPLOYEE_NUMBER, specificWeight: 1.1 });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('APROBADO');
  await action(request, admin, plant, id, 'packaging', { version: current.version, packagingOrder: unique.slice(-6), materialCode: process.env.E2E_PACKAGING_MATERIAL, line: process.env.E2E_PACKAGING_LINE, format: process.env.E2E_PACKAGING_FORMAT, dispenser: process.env.E2E_DISPENSER, filter: process.env.E2E_FILTER, description: 'Ensayo E2E aislado' });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('ENVASANDO');
  await action(request, admin, plant, id, 'packaging/finish', { version: current.version, producedKg: 1 });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('VACIO');
  expect(current.activeLotId).toBeNull();
});

test('B: ajuste, rechazo, transición inválida e historial', async ({ request }) => {
  let current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'manufacturing', { version: current.version, manufacturingOrder: String(Number(unique) + 1).padStart(8, '0'), materialCode: process.env.E2E_MATERIAL_CODE, description: 'Ensayo laboratorio E2E' });
  current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'send-to-lab', { version: current.version });
  current = await tank(request, admin, plant, id);
  const invalid = await request.post(`${path}/packaging`, { headers: auth(admin), data: { version: current.version, packagingOrder: unique.slice(-6), materialCode: process.env.E2E_PACKAGING_MATERIAL, line: process.env.E2E_PACKAGING_LINE, format: process.env.E2E_PACKAGING_FORMAT, dispenser: process.env.E2E_DISPENSER, filter: process.env.E2E_FILTER, description: 'Transición inválida' } });
  expect(invalid.status()).toBe(409);
  await action(request, admin, plant, id, 'laboratory/sample-received', { version: current.version, startAnalysis: true });
  current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'quality', { version: current.version, result: 'AJUSTE', employeeNumber: process.env.E2E_EMPLOYEE_NUMBER, adjustmentReasons: ['Agitación/Recirculación'] });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('AJUSTE');
  await action(request, admin, plant, id, 'send-to-lab', { version: current.version });
  current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'laboratory/sample-received', { version: current.version, startAnalysis: true });
  current = await tank(request, admin, plant, id);
  await action(request, admin, plant, id, 'quality', { version: current.version, result: 'RECHAZADO_DESTRUIR', employeeNumber: process.env.E2E_EMPLOYEE_NUMBER, reason: 'Ensayo E2E aislado' });
  current = await tank(request, admin, plant, id);
  expect(current.state).toBe('RECHAZADO');
  const history = await request.get(`/api/plants/${plant}/history/states?tankId=${id}`, { headers: auth(admin) });
  expect(history.ok()).toBeTruthy();
  const states = await history.json();
  for (const state of ['FABRICANDO', 'LABORATORIO', 'AJUSTE', 'RECHAZADO']) expect(states.some((item) => item.state === state)).toBeTruthy();
  await action(request, admin, plant, id, 'empty-rejected', { version: current.version });
  expect((await tank(request, admin, plant, id)).state).toBe('VACIO');
});

test('C y D: permisos efectivos y separación entre plantas', async ({ request }) => {
  const operator = await login(request, process.env.E2E_OPERATOR_IDENTIFIER, process.env.E2E_OPERATOR_PASSWORD);
  const profile = await request.get('/api/auth/me', { headers: auth(operator) });
  expect(profile.ok()).toBeTruthy();
  expect((await profile.json()).role).toBe('FABRICACION');
  const forbidden = await request.post(`${path}/quality`, { headers: auth(operator), data: { version: 0, result: 'APROBADO', employeeNumber: process.env.E2E_EMPLOYEE_NUMBER, specificWeight: 1.1 } });
  expect(forbidden.status()).toBe(403);
  const plants = await request.get('/api/plants', { headers: auth(operator) });
  expect(plants.ok()).toBeTruthy();
  const allowed = await plants.json();
  expect(allowed.some((item) => item.code === plant)).toBeTruthy();
  expect(allowed.some((item) => item.code === process.env.E2E_OTHER_PLANT_CODE)).toBeFalsy();
  const other = await request.get(`/api/plants/${process.env.E2E_OTHER_PLANT_CODE}/tanks`, { headers: auth(operator) });
  expect(other.status()).toBe(404);
  const cross = await request.post(`/api/plants/${process.env.E2E_OTHER_PLANT_CODE}/tanks/${id}/manufacturing`, { headers: auth(admin), data: { version: 0, manufacturingOrder: unique, materialCode: process.env.E2E_MATERIAL_CODE, description: 'Debe fallar' } });
  expect(cross.status()).toBe(404);
});

test('C: el frontend oculta Laboratorio al perfil de Fabricación', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-identifier').fill(process.env.E2E_OPERATOR_IDENTIFIER);
  await page.locator('#login-password').fill(process.env.E2E_OPERATOR_PASSWORD);
  await page.locator('#login-submit').click();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('nav').getByRole('link', { name: 'Laboratorio' })).toHaveCount(0);
  await page.goto('/laboratorio');
  await expect(page).not.toHaveURL(/\/laboratorio(?:\?|$)/);
});
