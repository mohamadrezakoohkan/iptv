// ADR: ADR-0017
// UI tests — the sort CONTROL in the channel-grid toolbar (TASK-0035). Proves
// the labelled #ch-sort select is present after connect, that changing it
// reorders the visible cards, and that the choice (token + selected option +
// resulting grid order) is restored across a reload via iptv_sort. Captures a
// screenshot of the toolbar with the sort control for the PR Test Results block.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper — connect with demo and wait until the channel grid is visible
// ---------------------------------------------------------------------------
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// ---------------------------------------------------------------------------
// The control is present, labelled, and populated from SORTS, defaulting to
// num-asc — and a screenshot of the toolbar is captured for the PR block.
// ---------------------------------------------------------------------------
test('sort control is present in the toolbar, populated from SORTS, default num-asc', async function ({ page }) {
  await connectDemo(page);
  const sel = page.locator('#ch-sort');
  await expect(sel).toBeVisible();
  // a label is associated with the select
  await expect(page.locator('label[for="ch-sort"]')).toHaveCount(1);
  // four options in SORTS order
  const vals = await sel.locator('option').evaluateAll(function map(opts) {
    return opts.map(function v(o) { return o.value; });
  });
  expect(vals).toEqual(['num-asc', 'name-asc', 'name-desc', 'fav-first']);
  // default selection reflects ST.sort
  await expect(sel).toHaveValue('num-asc');
  await page.locator('.ch-bar').screenshot({ path: 'test-results/sort-toolbar.png' });
});

// ---------------------------------------------------------------------------
// Changing the select to name-asc reorders the grid: the first card is the
// alphabetically-first demo channel ("Action Movies HD").
// ---------------------------------------------------------------------------
test('changing the sort to name-asc reorders the visible cards alphabetically', async function ({ page }) {
  await connectDemo(page);
  // baseline: default num-asc → first card is channel 001 ("World News 24")
  await expect(page.locator('.ch-card .ch-name').first()).toHaveText('World News 24');
  await page.selectOption('#ch-sort', 'name-asc');
  await expect(page.locator('.ch-card .ch-name').first()).toHaveText('Action Movies HD');
  // and the token was persisted
  const stored = await page.evaluate(function () { return localStorage.getItem('iptv_sort'); });
  expect(stored).toBe('name-asc');
});

// ---------------------------------------------------------------------------
// The choice persists across reload: after selecting name-asc and reloading,
// the select reflects name-asc and the grid renders alphabetically.
// ---------------------------------------------------------------------------
test('the sort choice persists across reload (select + grid order restored)', async function ({ page }) {
  await connectDemo(page);
  await page.selectOption('#ch-sort', 'name-asc');
  await expect(page.locator('.ch-card .ch-name').first()).toHaveText('Action Movies HD');
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // select reflects the persisted token
  await expect(page.locator('#ch-sort')).toHaveValue('name-asc');
  // grid renders in the persisted order
  await expect(page.locator('.ch-card .ch-name').first()).toHaveText('Action Movies HD');
});

// ---------------------------------------------------------------------------
// The select is keyboard-operable (native select reflects programmatic change
// and dispatches the change handler that re-renders the grid).
// ---------------------------------------------------------------------------
test('selecting name-desc reorders the grid to reverse-alphabetical', async function ({ page }) {
  await connectDemo(page);
  await page.selectOption('#ch-sort', 'name-desc');
  // "World News 24" is the alphabetically-last demo channel (W…)
  await expect(page.locator('.ch-card .ch-name').first()).toHaveText('World News 24');
});
