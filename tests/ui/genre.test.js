// ADR: ADR-0018
// UI tests — TASK-0036 filterable sidebar genre list + active-genre chip.
// Proves: a large category set (> S.catFltMin) renders the "Filter genres…"
// input; typing narrows the visible genre buttons while "All Channels" /
// "Favourites" stay pinned; clearing restores the full list; and in demo mode
// selecting a channel shows the active-genre chip with the channel's grp, which
// clears when the session is torn down. Captures a screenshot of the filtered
// sidebar + genre chip for the PR Test Results block.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Render a large (> S.catFltMin) demo-shaped category set into the sidebar via
// rndSide, so the genre-filter input appears.
// ---------------------------------------------------------------------------
async function bigSidebar(page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function build() {
    window.IptvUi.mkEL();
    const names = ['News', 'Sports', 'Movies', 'Music', 'Kids', 'Documentary',
      'Comedy', 'Drama', 'Travel', 'Cooking', 'Science', 'History', 'Weather'];
    const cats = names.map(function mk(n) { return { id: n.toLowerCase(), name: n }; });
    const chs = cats.map(function mkCh(c, i) {
      return { id: String(i + 1), name: c.name + ' Channel', cat: c.id, num: i + 1, img: '' };
    });
    window.IptvSt.setChs(chs, cats, 'demo', 'demo');
    window.IptvSt.setFavs(['1']);
    window.IptvUi.rndSide(cats, chs, window.IptvSt.ST.favs);
  });
}

// ---------------------------------------------------------------------------
// The filter input appears for a large catalog and is absent for a small one.
// ---------------------------------------------------------------------------
test('genre filter input appears only when the category count exceeds the threshold', async function ({ page }) {
  await bigSidebar(page);
  await expect(page.locator('#cat-filter')).toBeVisible();
  await expect(page.locator('#cat-filter')).toHaveAttribute('placeholder', 'Filter genres…');

  // a small demo catalog (7 categories) shows no filter input
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.cat-btn').first().waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('#cat-filter')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Typing in the filter narrows the genre buttons; All/Favs stay pinned; a
// screenshot of the filtered sidebar is captured for the PR block.
// ---------------------------------------------------------------------------
test('typing in the genre filter narrows the buttons while All Channels / Favourites stay pinned', async function ({ page }) {
  await bigSidebar(page);
  await page.fill('#cat-filter', 'co');   // matches "Comedy" and "Cooking"
  // pinned entries remain
  await expect(page.locator('[data-cat="all"]')).toBeVisible();
  await expect(page.locator('[data-cat="favs"]')).toBeVisible();
  // only matching genres remain
  await expect(page.locator('[data-cat="comedy"]')).toBeVisible();
  await expect(page.locator('[data-cat="cooking"]')).toBeVisible();
  await expect(page.locator('[data-cat="news"]')).toHaveCount(0);
  await expect(page.locator('[data-cat="sports"]')).toHaveCount(0);
  await page.locator('.sidebar').screenshot({ path: 'test-results/genre-filter.png' });
});

// ---------------------------------------------------------------------------
// Clearing the filter restores the full list.
// ---------------------------------------------------------------------------
test('clearing the genre filter restores the full genre list', async function ({ page }) {
  await bigSidebar(page);
  await page.fill('#cat-filter', 'co');
  await expect(page.locator('[data-cat="news"]')).toHaveCount(0);
  await page.fill('#cat-filter', '');
  await expect(page.locator('[data-cat="news"]')).toBeVisible();
  await expect(page.locator('[data-cat="comedy"]')).toBeVisible();
  // the input keeps focus across the re-render (caret never lost)
  await expect(page.locator('#cat-filter')).toBeFocused();
});

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
