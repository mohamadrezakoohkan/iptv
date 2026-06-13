// ADR: ADR-0006
'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['src/tests/int/**/*.test.js'],
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
