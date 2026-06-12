// ADR: ADR-0018
// UI tests — active-genre chip + source-order category browsing. In demo mode
// selecting a channel shows the active-genre chip with the channel's grp;
// selecting a sidebar genre filters the grid to that category; and a category
// filter integrates with the sort control. The ADR-0018 genre-filter input was
// removed (E11); the surviving chip markup is verified here pending TASK-0040.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Demo mode: selecting a channel shows the active-genre chip with its grp.
// ---------------------------------------------------------------------------
test('selecting a demo channel shows the active-genre chip with the channel grp', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // chip hidden before any selection
  await expect(page.locator('#genre-chip')).toBeHidden();
  // select the first card ("World News 24", grp "News")
  await page.locator('.ch-card').first().click();
  const chip = page.locator('#genre-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText('News');
  await expect(page.locator('#now-info')).toHaveText('World News 24');
  await page.locator('.content-head').screenshot({ path: 'test-results/genre-chip.png' });
});

// ---------------------------------------------------------------------------
// Selecting a genre filters the channel grid by that category (demo category
// browsing works end-to-end — the demo cat-id casing fix, ADR-0008/0009).
// ---------------------------------------------------------------------------
test('selecting a sidebar genre filters the channel grid to that category', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // Kids has exactly 3 demo channels
  await page.locator('[data-cat="kids"]').click();
  await expect(page.locator('[data-cat="kids"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-card')).toHaveCount(3);
  // the grid is non-empty (browsing actually works, not zero-channels)
  await expect(page.locator('.ch-empty')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Genre browsing integrates with the sort control (TASK-0035) without
// regressions: a category filter + a sort still yields the expected order.
// ---------------------------------------------------------------------------
test('genre filter + sort integrate: a category stays sorted by the chosen sort', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-cat="news"]').click();
  await page.selectOption('#ch-sort', 'name-asc');
  // News demo channels A→Z: Business Now, Daily Headlines, Regional News, Weather 24, World News 24
  await expect(page.locator('.ch-card .ch-name').first()).toHaveText('Business Now');
});
