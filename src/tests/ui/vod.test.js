// ADR: ADR-0038
// UI tests — Live | Movies | Series content toggle (TASK-0079,
// specs/vod-library.md §5a, §8). Driven against the offline demo connect (the
// demo synthesizes one VOD movie, §6, so the Movies tab surfaces with NO live
// network) plus a directly stubbed VOD store for the contextual-presence and
// switching assertions. Covers: the toggle renders in the content area; the
// active option is visually marked (.active) with aria-pressed reflecting it
// (Rule R-0001 — present in baseline, only flipped); contextual presence
// (Movies surfaces on demo, Series hidden); switching to a mode re-renders the
// sidebar + grid from that mode's set; the toggle is keyboard-operable.

'use strict';

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

test('the content toggle is present in the content area with three options', async function ({ page }) {
  await page.goto(BASE_URL);
  const tog = page.locator('#content-toggle');
  await expect(tog).toBeAttached();
  await expect(tog.locator('.ct-opt')).toHaveCount(3);
  // R-0001: aria-pressed is present in the baseline markup before any interaction.
  await expect(tog.locator('[data-mode="live"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(tog.locator('[data-mode="movies"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(tog.locator('[data-mode="series"]')).toHaveAttribute('aria-pressed', 'false');
});

test('before any connection only Live shows (contextual presence)', async function ({ page }) {
  await page.goto(BASE_URL);
  await expect(page.locator('#content-toggle [data-mode="live"]')).toBeVisible();
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toBeHidden();
  await expect(page.locator('#content-toggle [data-mode="series"]')).toBeHidden();
});

test('demo connect surfaces the Movies tab (synthesized movie) but not Series', async function ({ page }) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // The best-effort demo VOD synthesis fills one movie, then rndVod reveals Movies.
  await page.locator('#content-toggle [data-mode="movies"]').waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toBeVisible();
  await expect(page.locator('#content-toggle [data-mode="series"]')).toBeHidden();
  // Default mode is live: Live is active.
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveClass(/active/);
});

test('switching to Movies marks it active and re-renders the sidebar + grid', async function ({ page }) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('#content-toggle [data-mode="movies"]').waitFor({ state: 'visible', timeout: 5000 });

  const live  = page.locator('#content-toggle [data-mode="live"]');
  const movs  = page.locator('#content-toggle [data-mode="movies"]');

  await movs.click();
  // The Movies option becomes the active, aria-pressed one; Live releases.
  await expect(movs).toHaveClass(/active/);
  await expect(movs).toHaveAttribute('aria-pressed', 'true');
  await expect(live).not.toHaveClass(/active/);
  await expect(live).toHaveAttribute('aria-pressed', 'false');

  // The grid re-renders from the movie set: the synthesized demo movie card shows.
  await expect(page.locator('.ch-card')).toHaveCount(1);
  // The sidebar re-renders from the movie set's categories.
  await expect(page.locator('#grp-nav .cat-btn')).not.toHaveCount(0);
});

test('switching back to Live restores the live channel grid', async function ({ page }) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('#content-toggle [data-mode="movies"]').waitFor({ state: 'visible', timeout: 5000 });
  const liveCount = await page.locator('.ch-card').count();

  await page.click('#content-toggle [data-mode="movies"]');
  await expect(page.locator('.ch-card')).toHaveCount(1);

  await page.click('#content-toggle [data-mode="live"]');
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-card')).toHaveCount(liveCount);
});

test('the toggle is keyboard-operable (focus + Enter activates a mode)', async function ({ page }) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  const movs = page.locator('#content-toggle [data-mode="movies"]');
  await movs.waitFor({ state: 'visible', timeout: 5000 });

  await movs.focus();
  await expect(movs).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(movs).toHaveClass(/active/);
  await expect(movs).toHaveAttribute('aria-pressed', 'true');
});

// ---------------------------------------------------------------------------
// TASK-0080 — Movies browse: VOD movie categories in the sidebar + movie poster
// cards in the grid; a category click filters the movie grid; search filters
// movies. Driven against a directly-stubbed multi-category VOD movie store so
// the category filter and search assertions have something to bite on offline.
// ---------------------------------------------------------------------------

/** Connect to the demo and inject a multi-category movie store, then switch to Movies. */
async function browseMovies(page) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.evaluate(function stub() {
    window.IptvVod.clear();
    // VOD-style ids (mirroring the real `demo-vod-N` convention) so they never
    // collide with the demo's live-channel EPG entries — VOD ids have no EPG.
    window.IptvVod.setMovs([
      { id: 'vod-1', name: 'Action Alpha', grp: 'Action', url: 'u1', img: '', cat: '7', num: 1, kind: 'movie' },
      { id: 'vod-2', name: 'Action Beta',  grp: 'Action', url: 'u2', img: 'http://x/p2.png', cat: '7', num: 2, kind: 'movie' },
      { id: 'vod-3', name: 'Doc Gamma',    grp: 'Docs',   url: 'u3', img: '', cat: '9', num: 3, kind: 'movie' },
    ]);
    window.IptvVod.setSers([]);
    window.IptvUi.rndToggle();
  });
  await page.locator('#content-toggle [data-mode="movies"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('#content-toggle [data-mode="movies"]');
}

test('Movies mode shows movie categories in the sidebar and poster cards in the grid', async function ({ page }) {
  await browseMovies(page);
  // The grid renders one card per movie item.
  await expect(page.locator('.ch-card')).toHaveCount(3);
  await expect(page.locator('.ch-card .ch-name', { hasText: 'Action Alpha' })).toBeVisible();
  // A movie with a poster img renders an <img>; a poster-less one falls back to the letter-tile.
  await expect(page.locator('.ch-card .ch-logo')).toHaveCount(1);
  await expect(page.locator('.ch-card .ch-logo-fb')).toHaveCount(2);
  // The sidebar lists the movie categories (Action, Docs) plus All.
  await expect(page.locator('#grp-nav [data-cat="7"]')).toBeVisible();
  await expect(page.locator('#grp-nav [data-cat="9"]')).toBeVisible();
  await expect(page.locator('#grp-nav [data-cat="all"]')).toBeVisible();
  // Movie cards carry no live-only affordances.
  await expect(page.locator('.ch-card .ch-nn')).toHaveCount(0);
  await expect(page.locator('.ch-card [data-rem]')).toHaveCount(0);
  await expect(page.locator('.ch-card [data-replay]')).toHaveCount(0);
});

test('clicking a movie category filters the movie grid by that category', async function ({ page }) {
  await browseMovies(page);
  await page.click('#grp-nav [data-cat="9"]');
  await expect(page.locator('#grp-nav [data-cat="9"]')).toHaveClass(/active/);
  // Only the single Docs movie remains.
  await expect(page.locator('.ch-card')).toHaveCount(1);
  await expect(page.locator('.ch-card .ch-name', { hasText: 'Doc Gamma' })).toBeVisible();
});

test('search filters the movie set by name within Movies mode', async function ({ page }) {
  await browseMovies(page);
  await page.fill('#search', 'doc');
  await expect(page.locator('.ch-card')).toHaveCount(1);
  await expect(page.locator('.ch-card .ch-name', { hasText: 'Doc Gamma' })).toBeVisible();
});

test('contextual presence with a stubbed store: Series appears only with series', async function ({ page }) {
  await page.goto(BASE_URL);
  await page.evaluate(function stub() {
    window.IptvVod.clear();
    window.IptvVod.setMovs([{ id: 'm1', name: 'Stub Movie', grp: 'Stub', url: '', img: '', cat: 'c1', num: 1, kind: 'movie' }]);
    window.IptvVod.setSers([{ id: 's1', name: 'Stub Series', grp: 'Stub', img: '', cat: 'c2' }]);
    window.IptvUi.rndToggle();
  });
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toBeVisible();
  await expect(page.locator('#content-toggle [data-mode="series"]')).toBeVisible();

  // Switching to Series renders the series browse entries through the grid.
  await page.click('#content-toggle [data-mode="series"]');
  await expect(page.locator('#content-toggle [data-mode="series"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-card')).toHaveCount(1);
});
