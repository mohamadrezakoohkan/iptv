// ADR: ADR-0024
// UI tests — content vertical rhythm, two-radii system, tabular numbers
// (TASK-0049, spacing-sizing.md rules 4 + 6 + 9). In demo mode (so cards,
// numbers and badges render) the running page resolves: a .ch-card to 8px
// border-radius + 12px padding, the .ch-grid to a 12px gap/row-gap, a .fmt-chip
// and the .btn to 6px radius, a .cat-count to a 4px radius, and the numeric
// elements (.ch-num, .cat-count) to a mono font with tabular-nums. Captures
// task-0049-grid-cards.png to the run-artifacts dir.

'use strict';

const { test, expect } = require('@playwright/test');

// Connect demo mode through the real footer login flow, then wait for the grid.
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// Computed style value of the first matching element for `prop`.
async function styleOf(page, sel, prop) {
  return page.evaluate(function read(a) {
    const el = document.querySelector(a.sel);
    return window.getComputedStyle(el).getPropertyValue(a.prop).trim();
  }, { sel, prop });
}

test('a channel card resolves to --r2 (8px) radius and --s3 (12px) padding', async function ({ page }) {
  await connectDemo(page);
  expect(await styleOf(page, '.ch-card', 'border-top-left-radius')).toBe('8px');
  // padding is symmetric --s3 (12px) on all four sides
  expect(await styleOf(page, '.ch-card', 'padding-top')).toBe('12px');
  expect(await styleOf(page, '.ch-card', 'padding-left')).toBe('12px');
  await page.screenshot({ path: 'test-results/task-0049-grid-cards.png' });
});

test('the channel grid resolves to a 12px gap (--s3)', async function ({ page }) {
  await connectDemo(page);
  expect(await styleOf(page, '.ch-grid', 'row-gap')).toBe('12px');
  expect(await styleOf(page, '.ch-grid', 'column-gap')).toBe('12px');
});

test('a format chip and the connect button resolve to --r1 (6px) radius', async function ({ page }) {
  await connectDemo(page);
  expect(await styleOf(page, '.fmt-chip', 'border-top-left-radius')).toBe('6px');
  expect(await styleOf(page, '.btn', 'border-top-left-radius')).toBe('6px');
});

test('a count badge resolves to a 4px (--s1) radius', async function ({ page }) {
  await connectDemo(page);
  expect(await styleOf(page, '.cat-count', 'border-top-left-radius')).toBe('4px');
});

test('numeric elements use a mono font with tabular-nums', async function ({ page }) {
  await connectDemo(page);

  const numVariant = await styleOf(page, '.ch-num', 'font-variant-numeric');
  expect(numVariant).toContain('tabular-nums');
  const numFamily = await styleOf(page, '.ch-num', 'font-family');
  expect(numFamily.toLowerCase()).toContain('mono');

  const cntVariant = await styleOf(page, '.cat-count', 'font-variant-numeric');
  expect(cntVariant).toContain('tabular-nums');
  const cntFamily = await styleOf(page, '.cat-count', 'font-family');
  expect(cntFamily.toLowerCase()).toContain('mono');
});

test('player wrapper resolves to a 24px vertical rhythm top and 0 bottom (--s6 / 0)', async function ({ page }) {
  await connectDemo(page);
  expect(await styleOf(page, '.player-wrap', 'padding-top')).toBe('24px');
  expect(await styleOf(page, '.player-wrap', 'padding-bottom')).toBe('0px');
});
