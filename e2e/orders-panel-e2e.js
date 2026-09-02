/**
 * E2E: panel actual de Ordenes de Produccion.
 *
 * Cubre UI principal y flujo operativo completo:
 * login, tabs/filtros, alta de presupuesto desde UI, aprobacion,
 * asignacion, eventos de produccion, consumo, cierre/remito y limpieza.
 */

const { chromium, request } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:5173';
const API = process.env.E2E_API || `${BASE}/api`;
const HEADLESS = process.env.E2E_HEADLESS !== 'false';
const OWNER = { email: 'owner@disal.local', password: 'ChangeMe123!' };
const OPER = { email: 'diego@disal.local', password: 'ChangeMe123!' };
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const PREFIX = `E2E Ordenes Panel ${RUN_ID}`;

const createdOrderIds = [];

const step = (text) => console.log(`\n== ${text} ==`);
const ok = (text) => console.log(`OK: ${text}`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function apiContext(token) {
  return request.newContext({
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : undefined
  });
}

async function apiLogin(creds) {
  const ctx = await apiContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: creds.email, password: creds.password }
  });
  assert(res.ok(), `No se pudo iniciar sesion API: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  assert(body.accessToken, 'La API no devolvio accessToken');
  return body.accessToken;
}

async function apiGet(token, path) {
  const ctx = await apiContext(token);
  const res = await ctx.get(`${API}${path}`);
  assert(res.ok(), `GET ${path} fallo: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body;
}

async function apiPost(token, path, data) {
  const ctx = await apiContext(token);
  const res = await ctx.post(`${API}${path}`, { data });
  assert(res.ok(), `POST ${path} fallo: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body;
}

async function uploadAttachment(token, orderId) {
  const ctx = await apiContext(token);
  const res = await ctx.post(`${API}/orders/${orderId}/attachments`, {
    multipart: {
      file: {
        name: `e2e-${RUN_ID}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`Adjunto E2E ${RUN_ID}`)
      }
    }
  });
  assert(res.ok(), `POST attachment fallo: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body;
}

async function apiDelete(token, path) {
  const ctx = await apiContext(token);
  const res = await ctx.delete(`${API}${path}`);
  assert(res.ok(), `DELETE ${path} fallo: ${res.status()} ${await res.text()}`);
  await ctx.dispose();
}

async function loginUi(page, creds) {
  await page.goto(`${BASE}/login`);
  await page.locator('#login-email').fill(creds.email);
  await page.locator('#login-password').fill(creds.password);
  await page.locator('#login-submit').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

async function cleanup(token) {
  for (const id of [...createdOrderIds].reverse()) {
    try {
      await apiDelete(token, `/orders/${id}`);
      ok(`orden de prueba eliminada: ${id}`);
    } catch (err) {
      console.warn(`WARN: no se pudo eliminar ${id}: ${err.message}`);
    }
  }
}

async function getFirstClient(token) {
  const clients = await apiGet(token, '/clients');
  const list = clients.items || clients;
  assert(Array.isArray(list) && list.length > 0, 'No hay clientes disponibles para E2E');
  return list[0];
}

async function getDiego(token) {
  const users = await apiGet(token, '/users?role=OPERARIO&active=true');
  const userList = users.items || users;
  const user = userList.find((u) => u.email === OPER.email) || userList[0];
  assert(user, 'No hay operarios disponibles para asignar');

  const resources = await apiGet(token, '/resources?active=true');
  const resourceList = resources.items || resources;
  const resource =
    resourceList.find((r) => r.name?.trim().toLowerCase() === user.fullName?.trim().toLowerCase()) ||
    resourceList.find((r) => r.type === 'HUMANO') ||
    resourceList[0];
  assert(resource, 'No hay recursos activos disponibles para asignar');

  return { user, resource };
}

async function getConsumableMaterial(token) {
  const materials = await apiGet(token, '/materials?active=true');
  const list = materials.items || materials;
  return list.find((m) => Number(m.stock) >= 0.01) || null;
}

async function createDirectOrder(token, client) {
  const direct = await apiPost(token, '/orders', {
    type: 'direct',
    clientId: client.id,
    title: `${PREFIX} - OT directa sin OC`,
    description: 'Validacion E2E de OT directa y filtro sin orden de compra.',
    estimatedTimeMin: 90,
    estimatedCost: 12345,
    priority: 2,
    commitmentDate: '2026-12-20',
    plannedDate: '2026-12-18',
    notes: 'Orden creada por E2E y eliminada al finalizar.'
  });
  createdOrderIds.push(direct.id);
  return direct;
}

(async () => {
  step('Preparar datos y sesion API');
  const ownerToken = await apiLogin(OWNER);
  const operToken = await apiLogin(OPER);
  const client = await getFirstClient(ownerToken);
  const { user: operatorUser, resource } = await getDiego(ownerToken);
  const material = await getConsumableMaterial(ownerToken);
  ok(`cliente=${client.name}; operario=${operatorUser.fullName}; recurso=${resource.name}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  try {
    step('Login UI y panel /orders');
    await loginUi(page, OWNER);
    await page.goto(`${BASE}/orders`);
    await page.waitForLoadState('networkidle');
    await page.locator('h2', { hasText: /Ordenes|Órdenes/i }).waitFor({ timeout: 10000 });
    await page.locator('#btn-new-order').waitFor({ timeout: 10000 });
    for (const tab of ['all', 'quotations', 'production', 'closed', 'noPurchaseOrder']) {
      await page.locator(`#tab-orders-${tab}`).click();
      await page.waitForTimeout(350);
    }
    ok('tabs principales, buscador y boton Nueva Orden disponibles');

    step('Crear presupuesto desde UI');
    await page.locator('#tab-orders-all').click();
    await page.locator('#btn-new-order').click();
    await page.locator('#order-client').selectOption(client.id);
    await page.locator('#order-title').fill(`${PREFIX} - Presupuesto`);
    await page.locator('#order-description').fill('Validacion E2E del flujo comercial y productivo.');
    await page.locator('#order-purchase-number').fill(`OC-E2E-${RUN_ID}`);
    await page.locator('#order-estimated-time').fill('180');
    await page.locator('#order-valid-until').fill('2026-12-31');
    await page.locator('#order-delivery-days').fill('15');
    await page.locator('button', { hasText: 'Agregar item' }).click();
    await page.locator('input[placeholder="Descripcion"], input[placeholder="Descripción"]').fill('Rectificado de prueba E2E');
    await page.locator('input[placeholder="Cant."]').fill('2');
    await page.locator('input[placeholder="$ unit."]').fill('5000');
    await page.locator('button', { hasText: '+ Torneado' }).click();
    await page.locator('input[placeholder="Horas"]').fill('2');
    await page.locator('input[placeholder="$/hr"]').fill('3000');
    await page.locator('#btn-create-order-submit').click();
    await page.locator('#orders-search').fill(PREFIX);
    await page.waitForTimeout(1200);

    const createdMatches = await apiGet(ownerToken, `/orders?search=${encodeURIComponent(PREFIX)}`);
    const quotation = createdMatches.find((o) => o.title === `${PREFIX} - Presupuesto`);
    assert(quotation, 'No se encontro el presupuesto creado por UI en API');
    createdOrderIds.push(quotation.id);
    assert(quotation.commercialStatus === 'BORRADOR', 'El presupuesto no quedo como BORRADOR');
    ok(`presupuesto creado: ${quotation.code}`);

    step('Validar busqueda, detalle y secciones Presupuestos/Orden de Trabajo');
    await page.locator('#orders-search').fill(PREFIX);
    await page.locator('#orders-table tbody tr').first().locator('button[aria-label="Ver detalle"]').click();
    await page.locator('#order-detail-panel').waitFor({ timeout: 10000 });
    await page.locator('#order-detail-panel', { hasText: 'Presupuestos' }).waitFor();
    await page.locator('#order-detail-panel button', { hasText: /Orden de Trabajo/i }).click();
    await page.locator('#order-detail-panel', { hasText: /aun no|aún no|fase de produccion|fase de producción/i }).waitFor();
    await page.locator('#order-detail-panel button', { hasText: /Presupuestos/i }).click();
    await page.locator('#order-detail-panel button', { hasText: 'PDF' }).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    ok('detalle abre correctamente, muestra fase comercial sin produccion inicial y boton PDF');

    step('Aprobar presupuesto y activar produccion');
    const approved = await apiPost(ownerToken, `/orders/${quotation.id}/approve`, {
      commitmentDate: '2026-12-22',
      priority: 2
    });
    assert(approved.commercialStatus === 'APROBADO', 'No quedo comercialmente aprobado');
    assert(approved.productionStatus === 'PENDIENTE', 'No paso a produccion PENDIENTE');
    ok('presupuesto aprobado y convertido a produccion');

    step('Asignar recurso/operario');
    await apiPost(ownerToken, `/orders/${quotation.id}/assignments`, {
      resourceId: resource.id,
      userId: operatorUser.id
    });
    const afterAssign = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(afterAssign.assignments?.some((a) => a.userId === operatorUser.id), 'La asignacion no quedo registrada');
    ok('asignacion registrada');

    step('Adjuntos de orden');
    const attachment = await uploadAttachment(ownerToken, quotation.id);
    let withAttachment = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(withAttachment.attachments?.some((a) => a.id === attachment.id), 'El adjunto no quedo asociado a la orden');
    await apiDelete(ownerToken, `/orders/${quotation.id}/attachments/${attachment.id}`);
    withAttachment = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(!withAttachment.attachments?.some((a) => a.id === attachment.id), 'El adjunto no se elimino correctamente');
    ok('upload y eliminacion de adjuntos validados');

    step('Eventos operativos y consumo');
    await apiPost(operToken, `/orders/${quotation.id}/events`, { eventType: 'INICIO', note: 'Inicio E2E' });
    let order = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(order.productionStatus === 'EN_PROCESO', 'INICIO no paso a EN_PROCESO');

    await apiPost(operToken, `/orders/${quotation.id}/events`, { eventType: 'PAUSA', note: 'Pausa E2E', pauseReason: 'Control dimensional' });
    order = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(order.productionStatus === 'PAUSADA', 'PAUSA no paso a PAUSADA');

    await apiPost(operToken, `/orders/${quotation.id}/events`, { eventType: 'REANUDACION', note: 'Reanudacion E2E' });
    order = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(order.productionStatus === 'EN_PROCESO', 'REANUDACION no volvio a EN_PROCESO');

    if (material) {
      await apiPost(operToken, `/orders/${quotation.id}/consumptions`, {
        materialId: material.id,
        quantity: 0.01,
        note: 'Consumo minimo E2E'
      });
      order = await apiGet(ownerToken, `/orders/${quotation.id}`);
      assert(order.materialConsumptions?.length > 0, 'El consumo no quedo asociado a la orden');
      ok(`consumo registrado sobre ${material.name}`);
    } else {
      console.warn('WARN: no habia material con stock para probar consumo');
    }

    await apiPost(operToken, `/orders/${quotation.id}/events`, { eventType: 'FINALIZACION', note: 'Finalizacion E2E' });
    order = await apiGet(ownerToken, `/orders/${quotation.id}`);
    assert(order.productionStatus === 'FINALIZADA', 'FINALIZACION no paso a FINALIZADA');
    ok('eventos INICIO/PAUSA/REANUDACION/FINALIZACION validados');

    step('Cerrar entrega/remito');
    const delivered = await apiPost(ownerToken, `/orders/${quotation.id}/close-delivery`, {
      deliveryChecklist: 'Checklist E2E completo',
      deliveryNote: 'Remito validado por E2E',
      isSigned: true
    });
    assert(delivered.productionStatus === 'ENTREGADA', 'close-delivery no paso a ENTREGADA');
    assert(delivered.isSigned === true, 'El remito no quedo marcado como firmado');
    ok('cierre de entrega validado');

    step('Validar filtros de UI con orden cerrada y OT directa sin OC');
    const direct = await createDirectOrder(ownerToken, client);
    await page.goto(`${BASE}/orders`);
    await page.locator('#orders-search').fill(PREFIX);
    await page.locator('#tab-orders-closed').click();
    await page.waitForTimeout(1200);
    await page.locator('#orders-table', { hasText: 'Entregada' }).waitFor({ timeout: 10000 });
    await page.locator('#orders-table tbody tr').first().locator('button[aria-label="Ver detalle"]').click();
    await page.locator('#order-detail-panel button', { hasText: /Orden de Trabajo/i }).click();
    await page.locator('#order-detail-panel button', { hasText: /Descargar Remito/i }).waitFor({ timeout: 10000 });
    await page.locator('#order-detail-panel button[aria-label="Cerrar"]').click();
    await page.locator('#order-detail-panel').waitFor({ state: 'detached', timeout: 10000 });

    await page.locator('#tab-orders-noPurchaseOrder').click();
    await page.locator('#orders-search').fill('OT directa sin OC');
    await page.waitForTimeout(1200);
    await page.locator('#orders-table', { hasText: direct.title }).waitFor({ timeout: 10000 });
    ok('filtros Cerrados y Sin Orden de Compra validados');

    step('Validar vista Mi Turno del operario');
    await page.evaluate(() => localStorage.clear());
    await loginUi(page, OPER);
    await page.goto(`${BASE}/operator`);
    await page.waitForLoadState('networkidle');
    await page.locator('body').waitFor({ timeout: 10000 });
    ok('operario puede entrar a Mi Turno sin errores despues del flujo');

    step('Resultado');
    ok('E2E del panel Ordenes de Produccion finalizado correctamente');
  } finally {
    await browser.close();
    await cleanup(ownerToken);
  }
})().catch((err) => {
  console.error(`\nERROR E2E: ${err.stack || err.message}`);
  process.exit(1);
});
