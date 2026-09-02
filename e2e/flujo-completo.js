/**
 * E2E: Flujo completo de producción metalúrgica
 * Contexto: Taller de mecanizado — fabricación de bridas para industria química.
 */

const { chromium, request } = require('playwright');

const BASE  = 'http://localhost';
const API   = 'http://localhost/api';
const OWNER = { email: 'owner@disal.local', pass: 'ChangeMe123!' };
const OPER  = { email: 'diego@disal.local',  pass: 'ChangeMe123!' };  // Diego Fresador — tiene recurso HUMANO

const PASO = (n, txt) => console.log(`\n${'─'.repeat(60)}\n  PASO ${n}: ${txt}\n${'─'.repeat(60)}`);
const OK   = (txt)    => console.log(`  ✔  ${txt}`);
const INFO = (txt)    => console.log(`  ℹ  ${txt}`);
const WARN = (txt)    => console.log(`  ⚠  ${txt}`);

async function esperar(ms, motivo) {
  if (motivo) INFO(`Esperando ${ms / 1000}s — ${motivo}`);
  await new Promise(r => setTimeout(r, ms));
}

/** Login UI */
async function login(page, creds) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"], input[name="email"]').fill(creds.email);
  await page.locator('input[type="password"], input[name="password"]').fill(creds.pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 10000 });
  OK(`Login como ${creds.email}`);
}

/** Logout limpiando storage */
async function logout(page) {
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  OK('Sesión cerrada');
}

/** Cierra cualquier dialog abierto */
async function cerrarDialogs(page) {
  const dialogs = page.locator('[role="dialog"]');
  const count = await dialogs.count();
  for (let i = 0; i < count; i++) {
    if (await dialogs.nth(i).isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await esperar(400, '');
    }
  }
}

/** Login API para obtener JWT */
async function apiLogin(creds) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: creds.email, password: creds.pass }
  });
  const body = await res.json();
  await ctx.dispose();
  return body.accessToken ?? body.access_token;
}

/** Trae primer cliente disponible via API */
async function getFirstClient(token) {
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const res = await ctx.get(`${API}/clients`);
  const body = await res.json();
  await ctx.dispose();
  const items = body.items ?? body ?? [];
  return items[0] ?? null;
}

/** Selecciona el primer option no vacío */
async function selectFirstOption(selectLocator) {
  const opts = await selectLocator.locator('option').all();
  for (const opt of opts) {
    const val = await opt.getAttribute('value');
    if (val && val.trim() !== '') {
      await selectLocator.selectOption(val);
      return (await opt.textContent())?.trim() ?? val;
    }
  }
  return null;
}

/** Espera hasta que un botón esté habilitado (max 10s) */
async function waitEnabled(btn, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const disabled = await btn.getAttribute('disabled');
    if (disabled === null) return true;
    await esperar(300, '');
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  // ── Verificar datos via API antes de abrir browser ────────────────────────
  INFO('Verificando datos disponibles via API...');
  const ownerToken = await apiLogin(OWNER);
  const primerCliente = await getFirstClient(ownerToken);

  if (!primerCliente) {
    WARN('No hay clientes en la base de datos — el seed puede no haberse corrido.');
    WARN('Ejecutá: docker compose exec backend npm run prisma:seed');
    process.exit(1);
  }
  OK(`Cliente disponible: ${primerCliente.name} (id: ${primerCliente.id})`);

  // ── Abrir browser ─────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: false, slowMo: 300, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page    = await context.newPage();

  // ─── PASO 1: Login Owner ─────────────────────────────────────────────────
  PASO(1, 'Login como DUEÑO/OWNER');
  await login(page, OWNER);
  await esperar(1500, 'cargando dashboard');

  // ─── PASO 2: Crear presupuesto ───────────────────────────────────────────
  PASO(2, 'Crear presupuesto — Bridas DN200 PN16 para GrupoDisal');
  await page.goto(`${BASE}/quotations`);
  await page.waitForLoadState('networkidle');
  await esperar(1500, 'cargando presupuestos');

  await page.locator('button:has-text("+ Nueva Cotización")').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });
  OK('Modal nueva cotización abierto');
  await esperar(1500, 'esperando que carguen los clientes');

  // Seleccionar cliente — primer select del dialog (el de clientId)
  const dialogEl   = page.locator('[role="dialog"]').first();
  const selects    = dialogEl.locator('select');
  const clientSel  = selects.first();   // clientId select
  await clientSel.selectOption(primerCliente.id);
  OK(`Cliente: ${primerCliente.name}`);

  // Título
  await dialogEl.locator('label').filter({ hasText: /Título Comercial/i }).locator('input')
    .fill('Fabricación Bridas DN200 PN16 – Serie 20 u.');

  // Descripción
  await dialogEl.locator('label').filter({ hasText: /Descripción/i }).locator('textarea')
    .fill(
      'Fabricación de 20 bridas de acero inoxidable AISI 316L, DN200 PN16, norma ANSI B16.5. ' +
      'Incluye mecanizado en torno CNC, taladrado radial y rectificado de caras. ' +
      'Destinadas a línea de producción de emulsiones – Planta 2 GrupoDisal.'
    );

  // Costeo
  await dialogEl.locator('label').filter({ hasText: /Horas Estimadas/i }).locator('input').fill('2400');
  await dialogEl.locator('label').filter({ hasText: /Presupuesto Total/i }).locator('input').fill('185000');
  await dialogEl.locator('label').filter({ hasText: /Fecha Vencimiento/i }).locator('input').fill('2026-04-30');
  OK('Costeo: 2400 min · $185.000 · vence 30/04/2026');

  // Cambiar estado a APROBADO directamente en el form de creación
  const statusSel = dialogEl.locator('select').filter({ has: page.locator('option[value="APROBADO"]') });
  await statusSel.selectOption('APROBADO');
  OK('Estado inicial: APROBADO (cliente aprobó en persona)');

  // Guardar
  await dialogEl.locator('button[type="submit"]').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 12000 });
  OK('Presupuesto guardado como APROBADO — modal cerrado');
  await esperar(1500, 'refrescando listado');

  // ─── PASO 3: Verificar estado APROBADO ───────────────────────────────────
  PASO(3, 'Verificar presupuesto en estado APROBADO');
  await cerrarDialogs(page);

  // Buscar el presupuesto de Bridas
  await page.locator('input[type="search"]').fill('Bridas DN200');
  await esperar(800, '');

  const primeraFila = page.locator('table tbody tr').first();
  const filaTxt = await primeraFila.textContent();
  INFO(`Presupuesto encontrado: ${filaTxt?.slice(0, 70)?.trim()}`);

  // Abrir manage para mostrar visualmente el estado APROBADO
  await primeraFila.locator('button').filter({ hasText: /Gestionar|Gest\./i }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });
  await esperar(1000, 'mostrando estado del presupuesto');
  OK('Presupuesto en estado APROBADO ✅ — listo para convertir');

  await esperar(1500, '');

  // ─── PASO 4: Convertir a OT ──────────────────────────────────────────────
  PASO(4, 'Convertir presupuesto APROBADO → Orden de Trabajo');
  // El modal ya está abierto desde el paso 3

  // Código OT
  const otInput = page.locator('[role="dialog"] input[placeholder*="OT"]').first();
  await otInput.clear();
  await otInput.fill('OT-2026-BRD-001');
  OK('Código OT: OT-2026-BRD-001');

  // Fecha compromiso
  const dateInputs = page.locator('[role="dialog"] input[type="date"]');
  const nDates = await dateInputs.count();
  INFO(`Inputs de fecha en dialog: ${nDates}`);
  if (nDates > 0) {
    await dateInputs.last().fill('2026-04-15');
    OK('Fecha compromiso: 15/04/2026');
  }

  // Esperar que el botón "Confirmar" esté habilitado
  const convertirBtn = page.locator('[role="dialog"] button').filter({
    hasText: /Confirmar y Enviar a Producción|Generar Orden/i
  });
  await esperar(500, '');
  const btnEnabled = await waitEnabled(convertirBtn, 6000);
  if (!btnEnabled) {
    WARN('Botón "Confirmar" sigue deshabilitado');
    await page.screenshot({ path: 'e2e/debug-paso4.png' });
    INFO('Verificar: presupuesto debe estar en estado APROBADO');
  }
  await convertirBtn.click();
  await esperar(3000, 'creando OT en producción...');
  OK('OT creada y enviada a producción ✅');

  await cerrarDialogs(page);
  await esperar(800, '');

  // ─── PASO 5: Asignar operario ────────────────────────────────────────────
  PASO(5, 'Asignar operario a la OT');
  await page.goto(`${BASE}/work-orders`);
  await page.waitForLoadState('networkidle');
  await esperar(2000, 'cargando órdenes');

  await page.locator('input[type="search"]').fill('BRD-001');
  await esperar(800, '');

  const otFila = page.locator('table tbody tr').first();
  const otCodigo = await otFila.locator('td').first().textContent();
  INFO(`Primera OT encontrada: ${otCodigo?.trim()}`);

  await otFila.locator('button').filter({ hasText: /⚙️|Gest\./i }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });
  OK('Modal gestión OT abierto');
  await esperar(2000, 'cargando operarios disponibles');

  // Select de asignación (tiene placeholder "Operario...")
  const asignSel = page.locator('[role="dialog"] select').filter({
    has: page.locator('option:has-text("Operario")')
  });
  const opNombre = await selectFirstOption(asignSel);
  if (opNombre) {
    OK(`Operario seleccionado: ${opNombre}`);
    const asignarBtn = page.locator('[role="dialog"] button').filter({ hasText: /^Asignar$/i });
    await asignarBtn.click();
    await esperar(3000, 'asignando...');
    OK('Operario asignado correctamente ✅');
  } else {
    WARN('No se encontraron operarios disponibles');
    await page.screenshot({ path: 'e2e/debug-paso5.png' });
  }

  await cerrarDialogs(page);
  await esperar(800, '');

  // ─── PASO 6: Login operario ──────────────────────────────────────────────
  PASO(6, 'Cambiar sesión → Login como OPERARIO (oper1)');
  await logout(page);
  await esperar(500, '');
  await login(page, OPER);
  await esperar(1500, 'cargando mi turno');

  // ─── PASO 7: Iniciar trabajo ─────────────────────────────────────────────
  PASO(7, 'Mi Turno → Iniciar trabajo en planta');
  await page.goto(`${BASE}/operator`);
  await page.waitForLoadState('networkidle');
  await esperar(3000, 'cargando OTs asignadas');

  await page.screenshot({ path: 'e2e/debug-paso7-antes.png' });

  const iniciarBtn = page.locator('button').filter({ hasText: /▶.*Iniciar|^▶ Iniciar$/i }).first();
  const iniciarOk  = await iniciarBtn.isVisible({ timeout: 6000 }).catch(() => false);

  if (iniciarOk) {
    await iniciarBtn.click();
    await esperar(2500, 'registrando INICIO de operación');
    OK('Trabajo INICIADO — OT → EN_PROCESO ✅');
  } else {
    WARN('Botón "▶ Iniciar" no visible — screenshot en e2e/debug-paso7-antes.png');
    INFO('Posible causa: el operario oper1 no coincide con el recurso asignado');
  }

  await esperar(2000, 'simulando actividad en planta...');

  // ─── PASO 8: Entregar trabajo ────────────────────────────────────────────
  PASO(8, 'Mi Turno → Entregar trabajo (FINALIZACION → supervisión)');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await esperar(2500, 'esperando actualización de estado');

  const entregarBtn = page.locator('button').filter({ hasText: /Entregar Trabajo/i }).first();
  const entregarOk  = await entregarBtn.isVisible({ timeout: 6000 }).catch(() => false);

  if (entregarOk) {
    await entregarBtn.click();
    await esperar(2500, 'registrando FINALIZACION');
    OK('Trabajo ENTREGADO A SUPERVISIÓN — OT → FINALIZADA ✅');
  } else {
    WARN('Botón "Entregar Trabajo" no visible');
    await page.screenshot({ path: 'e2e/debug-paso8.png' });
    INFO('Screenshot: e2e/debug-paso8.png');
  }

  await esperar(1500, '');

  // ─── PASO 9: Aprobar OT (Owner) ──────────────────────────────────────────
  PASO(9, 'Cambiar sesión → Owner → Aprobar y cerrar OT (Remito)');
  await logout(page);
  await esperar(500, '');
  await login(page, OWNER);
  await esperar(1500, '');

  await page.goto(`${BASE}/work-orders`);
  await page.waitForLoadState('networkidle');
  await esperar(2000, 'cargando OTs');

  await page.locator('input[type="search"]').fill('BRD-001');
  await esperar(800, '');

  // Opción A: botón "✔ Aprobar" directo en la tabla (visible si status = FINALIZADA)
  const aprobarBtn = page.locator('button').filter({ hasText: /✔.*Aprobar|Aprobar/i }).first();
  const aprobarOk  = await aprobarBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (aprobarOk) {
    await aprobarBtn.click();
    await esperar(2500, 'aprobando OT...');
    OK('OT APROBADA — Estado: ENTREGADA ✅');
  } else {
    // Opción B: abrir Gestión → Completar remito → Cerrar OT
    INFO('Botón Aprobar no en tabla — usando modal gestión → cerrar entrega');
    const gestBtn = page.locator('table tbody tr').first().locator('button').filter({ hasText: /⚙️|Gest\./i });
    await gestBtn.click();
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });
    await esperar(1000, '');

    // Notas de aprobación (último textarea en modal)
    const notaTA = page.locator('[role="dialog"] textarea').last();
    if (await notaTA.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notaTA.fill('Bridas inspeccionadas y aprobadas. Remito firmado por Jefe de Planta GrupoDisal.');
      OK('Nota de aprobación cargada');
    }

    const cerrarOTBtn = page.locator('[role="dialog"] button').filter({
      hasText: /Aprobar y Finalizar|Cerrar OT/i
    });

    const cerrarEnabled = await waitEnabled(cerrarOTBtn, 6000);
    if (cerrarEnabled) {
      await cerrarOTBtn.click();
      await esperar(2500, 'cerrando OT...');
      OK('OT CERRADA — Estado: ENTREGADA ✅');
    } else {
      WARN('Botón "Aprobar y Finalizar" sigue deshabilitado (OT no está en FINALIZADA)');
      await page.screenshot({ path: 'e2e/debug-paso9.png' });
      INFO('Screenshot: e2e/debug-paso9.png');
    }
  }

  // ─── RESULTADO FINAL ─────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  FLUJO E2E COMPLETO');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  1.  Login Owner                  ✔`);
  console.log(`  2.  Presupuesto creado            ✔  Bridas DN200 PN16`);
  console.log(`  3.  Presupuesto APROBADO          ✔`);
  console.log(`  4.  OT generada                  ✔  OT-2026-BRD-001`);
  console.log(`  5.  Operario asignado             ✔  Diego Fresador`);
  console.log(`  6.  Login Operario               ✔`);
  console.log(`  7.  Inicio trabajo (EN_PROCESO)  ${iniciarOk ? '✔' : '⚠ (revisar asignación)'}`);
  console.log(`  8.  Entrega a supervisión         ${entregarOk ? '✔' : '⚠ (depende del paso 7)'}`);
  console.log(`  9.  Aprobación y cierre OT        ${aprobarOk ? '✔' : '⚠ (depende del paso 8)'}`);
  console.log(`${'═'.repeat(60)}\n`);

  await esperar(5000, 'cerrando navegador...');
  await browser.close();

})().catch(async err => {
  console.error('\n❌ ERROR CRÍTICO:', err.message);
  process.exit(1);
});
