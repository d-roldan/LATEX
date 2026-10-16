const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: '../output/e2e-report', open: 'never' }]],
  outputDir: '../output/e2e-results',
  globalSetup: require.resolve('./support/preflight.cjs'),
  use: { baseURL: process.env.E2E_BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' }
});
