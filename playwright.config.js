// ADR: ADR-0002
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
});
