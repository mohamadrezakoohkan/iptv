// ADR: ADR-0001, ADR-0022
// UI tests — Channel grid + channel card for TASK-0006; contextual empty-state
// placeholders + working actions for TASK-0044 (ADR-0022).
// Uses page.evaluate to set up state directly (TASK-0009 main.js not yet done).

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper: connect demo mode through the real footer login flow.
// ---------------------------------------------------------------------------
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Helper: load page, init EL, set up 31-channel demo state, render grid
// ---------------------------------------------------------------------------
async function setupGrid(page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    // 31-channel demo data matching api.js DEMO_DATA
    const chs = [];
    const cats = [
      { id: 'news',          name: 'News'          },
      { id: 'sports',        name: 'Sports'        },
      { id: 'movies',        name: 'Movies'        },
      { id: 'entertainment', name: 'Entertainment' },
      { id: 'kids',          name: 'Kids'          },
      { id: 'music',         name: 'Music'         },
      { id: 'documentary',   name: 'Documentary'   },
    ];
    const rows = [
      ['news',          ['World News 24', 'Daily Headlines', 'Business Now', 'Weather 24', 'Regional News']],
      ['sports',        ['Sports Arena HD', 'Racket TV', 'Football Hub', 'Motor Live', 'Extreme Sports', 'Padel One']],
      ['movies',        ['Cinema One', 'Classic Films', 'Action Movies HD', 'Indie Screen', 'Comedy Films']],
      ['entertainment', ['Prime Variety', 'Reality 24', 'Talk & Late Night', 'Lifestyle TV']],
      ['kids',          ['Toon Time', 'Junior TV', 'Learning Land']],
      ['music',         ['Hits 24/7', 'Classical Stage', 'Urban Beats', 'Retro Radio TV']],
      ['documentary',   ['Nature & Wild', 'History Vault', 'Science Today', 'True Crime Files']],
    ];
    let cnt = 1;
    for (let i = 0; i < rows.length; i += 1) {
      const cat = rows[i][0];
      const names = rows[i][1];
      for (let j = 0; j < names.length; j += 1) {
        chs.push({ id: String(cnt), name: names[j], cat, num: cnt, img: '', url: '' });
        cnt += 1;
      }
    }
    window.IptvSt.setChs(chs, cats, 'demo', 'demo');
    window.IptvUi.rndGrid(chs);
  });
}

// ---------------------------------------------------------------------------
// Grid render count
// ---------------------------------------------------------------------------
test('rndGrid renders 31 channel cards', async function ({ page }) {
  await setupGrid(page);
  const cards = page.locator('.ch-card');
  await expect(cards).toHaveCount(31);
});

// ---------------------------------------------------------------------------
// Card structure — number padding
// ---------------------------------------------------------------------------
test('first card has number "001"', async function ({ page }) {
  await setupGrid(page);
  const first = page.locator('.ch-card').first();
  await expect(first.locator('.ch-num')).toHaveText('001');
});

// ---------------------------------------------------------------------------
// Card role and tabindex
// ---------------------------------------------------------------------------
test('channel cards have role=button and tabindex=0', async function ({ page }) {
  await setupGrid(page);
  const first = page.locator('.ch-card').first();
  await expect(first).toHaveAttribute('role', 'button');
  await expect(first).toHaveAttribute('tabindex', '0');
});

// ---------------------------------------------------------------------------
// Card star aria-label when not in favs
// ---------------------------------------------------------------------------
test('star aria-label is "Add to favourites" when not in favs', async function ({ page }) {
  await setupGrid(page);
  const star = page.locator('.ch-fav').first();
  await expect(star).toHaveAttribute('aria-label', 'Add to favourites');
});

// ---------------------------------------------------------------------------
// Clicking a card calls setCur and gains ch-active class after re-render
// ---------------------------------------------------------------------------
test('clicking a card marks it ch-active after rndGrid re-render', async function ({ page }) {
  await setupGrid(page);
  // Click the first card (which has data-id="1")
  await page.locator('.ch-card').first().click();
  // Re-render the grid so ch-active class is applied via mkCard
  await page.evaluate(function () {
    const st = window.IptvSt.ST;
    window.IptvUi.rndGrid(st.chs);
  });
  const first = page.locator('.ch-card').first();
  await expect(first).toHaveClass(/ch-active/);
});

// ---------------------------------------------------------------------------
// Clicking the star adds class "on" (toggleFav in-place DOM update)
// ---------------------------------------------------------------------------
test('clicking a star adds class "on" to the star element', async function ({ page }) {
  await setupGrid(page);
  const star = page.locator('.ch-fav').first();
  await expect(star).not.toHaveClass(/\bon\b/);
  await star.click();
  await expect(star).toHaveClass(/\bon\b/);
});

// ---------------------------------------------------------------------------
// Star aria-label changes after toggle
// ---------------------------------------------------------------------------
test('star aria-label changes to "Remove from favourites" after clicking', async function ({ page }) {
  await setupGrid(page);
  const star = page.locator('.ch-fav').first();
  await star.click();
  await expect(star).toHaveAttribute('aria-label', 'Remove from favourites');
});

// ---------------------------------------------------------------------------
// Clicking star a second time removes class "on"
// ---------------------------------------------------------------------------
test('clicking star twice toggles "on" back off', async function ({ page }) {
  await setupGrid(page);
  const star = page.locator('.ch-fav').first();
  await star.click();
  await expect(star).toHaveClass(/\bon\b/);
  await star.click();
  await expect(star).not.toHaveClass(/\bon\b/);
});

// ---------------------------------------------------------------------------
// Favourites filter — rndGrid with fav-filtered chs shows only starred cards
// ---------------------------------------------------------------------------
test('rndGrid with favs-filtered channels shows only starred cards', async function ({ page }) {
  await setupGrid(page);
  // Star the first and third cards (id=1 and id=3)
  await page.locator('.ch-fav').nth(0).click();
  await page.locator('.ch-fav').nth(2).click();
  // Apply favs filter: call getChs with 'favs' filter and re-render
  await page.evaluate(function () {
    const st   = window.IptvSt.ST;
    const chs  = window.IptvSrch.getChs(st.chs, '', 'favs', st.favs);
    window.IptvUi.rndGrid(chs);
  });
  const cards = page.locator('.ch-card');
  await expect(cards).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// mkCard is exported on window.IptvUi
// ---------------------------------------------------------------------------
test('window.IptvUi.mkCard is a function', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const ok = await page.evaluate(function () {
    return typeof window.IptvUi !== 'undefined' && typeof window.IptvUi.mkCard === 'function';
  });
  expect(ok).toBe(true);
});

// ---------------------------------------------------------------------------
// toggleFav is exported on window.IptvUi
// ---------------------------------------------------------------------------
test('window.IptvUi.toggleFav is a function', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const ok = await page.evaluate(function () {
    return typeof window.IptvUi !== 'undefined' && typeof window.IptvUi.toggleFav === 'function';
  });
  expect(ok).toBe(true);
});

// ---------------------------------------------------------------------------
// TASK-0044 (ADR-0022) — contextual empty placeholders + working actions.
// No-match search: real demo connect → type a non-matching query → the grid
// shows the "No matches" placeholder + a working "Clear search" button that
// restores the grid. Captures a screenshot of the placeholder for the PR.
// ---------------------------------------------------------------------------
test('no-match search shows "No matches" placeholder and Clear search restores the grid', async function ({ page }) {
  await connectDemo(page);
  await page.fill('#search', 'zzzznotachannel');
  await page.locator('.ch-empty').waitFor({ state: 'visible', timeout: 3000 });
  const empty = page.locator('.ch-empty');
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty.locator('.ch-empty-title')).toHaveText('No matches');
  await expect(empty.locator('.ch-empty-body')).toContainText('zzzznotachannel');
  await page.screenshot({ path: 'test-results/task-0044-empty-no-match.png' });
  const btn = empty.locator('.ch-empty-btn');
  await expect(btn).toHaveText('Clear search');
  await btn.click();
  // Clearing the search restores the (unfiltered) grid.
  await expect(page.locator('.ch-card').first()).toBeVisible();
  await expect(page.locator('.ch-empty')).toHaveCount(0);
  await expect(page.locator('#search')).toHaveValue('');
});

// ---------------------------------------------------------------------------
// Empty favourites: drive the favourites filter with zero favourites, assert
// the "No favourites yet" placeholder, then click the real "Browse all
// channels" action and assert it restores the full channel grid.
// ---------------------------------------------------------------------------
test('empty favourites shows "No favourites yet" and Browse all channels restores all', async function ({ page }) {
  await connectDemo(page);
  // Reach the empty-favourites state: favourites filter active, no favourites.
  await page.evaluate(function () {
    const st = window.IptvSt.ST;
    window.IptvSt.setFlt('favs');
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, st.srch, 'favs', st.favs, st.sort));
  });
  const empty = page.locator('.ch-empty');
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty.locator('.ch-empty-title')).toHaveText('No favourites yet');
  const btn = empty.locator('.ch-empty-btn');
  await expect(btn).toHaveText('Browse all channels');
  await btn.click();
  await expect(page.locator('[data-cat="all"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-empty')).toHaveCount(0);
  await expect(page.locator('.ch-card')).toHaveCount(31);
});

// ---------------------------------------------------------------------------
// The empty placeholder icon is decorative (aria-hidden) — accessibility.
// ---------------------------------------------------------------------------
test('empty placeholder icon is aria-hidden', async function ({ page }) {
  await connectDemo(page);
  await page.fill('#search', 'zzzznotachannel');
  await page.locator('.ch-empty').waitFor({ state: 'visible', timeout: 3000 });
  await expect(page.locator('.ch-empty .ch-empty-ico')).toHaveAttribute('aria-hidden', 'true');
});
