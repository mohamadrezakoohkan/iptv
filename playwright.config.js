// ADR: ADR-0002
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './src/tests/ui',
  outputDir: '.playwright-out',
  timeout: 30000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'node src/server/srv.js',
    port: 3000,
    reuseExistingServer: true,
  },
});
