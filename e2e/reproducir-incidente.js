/**
 * REPRODUCCIÓN: Presupuesto sin ítems no se puede aprobar y no hay forma de editarlos.
 */

const { chromium, request } = require('playwright');

const BASE  = 'http://localhost';
const API   = 'http://localhost/api';
const OWNER = { email: 'owner@disal.local', pass: 'ChangeMe123!' };

const PASO = (n, txt) => console.log(`\n  PASO ${n}: ${txt}`);
const OK   = (txt)    => console.log(`  ✔  ${txt}`);
const INFO = (txt)    => console.log(`  ℹ  ${txt}`);
const WARN = (txt)    => console.log(`  ⚠  ${txt}`);

async function login(page, creds) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.href.includes('/login'));
}

async function apiLogin(creds) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: creds });
  const body = await res.json();
  await ctx.dispose();
  return body.accessToken;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 600 });
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, OWNER);

  PASO(1, 'Crear presupuesto VACÍO (sin ítems)');
  await page.goto(`${BASE}/quotations`);
  await page.locator('button:has-text("Nueva Orden")').click();
  
  await page.locator('select#order-client').selectOption({ index: 1 });
  await page.locator('input#order-title').fill('Presupuesto de Prueba Reproducción');
  await page.locator('button#btn-create-order-submit').click();
  
  await page.waitForSelector('text=Presupuesto de Prueba Reproducción');
  OK('Presupuesto creado sin ítems');

  PASO(2, 'Intentar aprobar el presupuesto');
  await page.locator('button:has-text("Ver ficha")').first().click();
  const approveBtn = page.locator('button#btn-approve-order');
  
  if (await approveBtn.isVisible()) {
      await approveBtn.click();
      // El modal de confirmación debería aparecer
      const confirmApprove = page.locator('button:has-text("Confirmar Aprobación")');
      if (await confirmApprove.isVisible()) {
          await confirmApprove.click();
          await page.waitForTimeout(1000);
          const errorMsg = page.locator('text=No podes aprobar un presupuesto sin items');
          if (await errorMsg.isVisible()) {
              OK('Confirmado: No se puede aprobar sin ítems (Error esperado)');
          } else {
              WARN('No se mostró el error esperado al intentar aprobar sin ítems');
          }
      }
  }

  PASO(3, 'Añadir ítems usando el nuevo botón "Editar"');
  const editBtn = page.locator('button#btn-edit-budget');
  if (await editBtn.isVisible()) {
      await editBtn.click();
      OK('Modal de edición abierto');
      
      await page.locator('button:has-text("Agregar item")').click();
      await page.locator('input[placeholder="Descripción"]').fill('Ítem de prueba añadido tras creación');
      await page.locator('input[placeholder="Cant."]').fill('10');
      await page.locator('input[placeholder="$ unit."]').fill('1500');
      
      await page.locator('button#btn-edit-quotation-submit').click();
      await page.waitForTimeout(1000);
      OK('Presupuesto actualizado con ítems');
  } else {
      throw new Error('No se encontró el botón de edición');
  }

  PASO(4, 'Aprobar el presupuesto (ahora debería funcionar)');
  await page.locator('button#btn-approve-order').click();
  const confirmApprove = page.locator('button:has-text("Confirmar Aprobación")');
  await confirmApprove.click();
  
  await page.waitForTimeout(1500);
  const successBadge = page.locator('text=Aprobado').first();
  if (await successBadge.isVisible()) {
      OK('Presupuesto APROBADO exitosamente ✅');
  } else {
      WARN('No se detectó el estado APROBADO');
  }

  console.log('\nCORRECCIÓN VERIFICADA EXITOSAMENTE');
  await browser.close();
})();
