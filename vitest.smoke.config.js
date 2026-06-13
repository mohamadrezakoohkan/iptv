// ADR: ADR-0027
'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['src/tests/smoke/**/*.test.js'],
    testTimeout: 600000,
    hookTimeout: 600000,
    fileParallelism: false,
  },
});
