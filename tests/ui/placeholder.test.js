// ADR: ADR-0002
// UI tests — server scaffolding only; no user-facing rendering at TASK-0001.
// Placeholder test keeps Playwright suite non-empty until client tasks land.

const { test, expect } = require('@playwright/test');

test('placeholder — suite exists', async function () {
  expect(true).toBe(true);
});
