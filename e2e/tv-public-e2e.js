const { chromium } = require('playwright');

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8081';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const tvResponse = page.waitForResponse(
      (response) => response.url().includes('/api/plants/LATEX/tv') && response.status() === 200
    );
    await page.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await tvResponse;
    await page.getByRole('heading', { name: 'Visualización de Planta' }).waitFor();

    if (new URL(page.url()).pathname !== '/tv') {
      throw new Error(`La TV fue redirigida inesperadamente a ${page.url()}`);
    }
    if (await page.locator('.tank-card').count() === 0) {
      throw new Error('La TV pública no mostró tarjetas de equipos');
    }

    await page.goto(`${baseUrl}/fabricacion`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login');
    console.log('OK: /tv es público y /fabricacion continúa protegido.');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
