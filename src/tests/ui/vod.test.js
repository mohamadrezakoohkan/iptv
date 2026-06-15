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

// ---------------------------------------------------------------------------
// TASK-0081 — Series browse + seasons/episodes drill-down. Driven against the
// offline demo connect plus a directly-stubbed series store and a stubbed
// loadSerInfo (no live network): switching to Series shows series cards; opening
// a series shows its seasons/episodes; the back control returns to the series
// list. R-0001: the back control's aria-label is present in the baseline markup.
// ---------------------------------------------------------------------------

/**
 * Connect to the demo, inject a series store + a stubbed on-demand episode
 * loader (so the drill-down fills offline), and switch to Series mode.
 */
async function browseSeries(page) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.evaluate(function stub() {
    window.IptvVod.clear();
    window.IptvVod.setMovs([]);
    window.IptvVod.setSers([
      { id: 'ser-1', name: 'Mystery Manor', grp: 'Drama', img: '', cat: '3' },
      { id: 'ser-2', name: 'Wild Planet',   grp: 'Docs',  img: '', cat: '5' },
    ]);
    // Stub the on-demand series-info loader so opening a series fills episodes
    // with NO live network (mirrors how loadVod synthesizes the demo movie).
    window.IptvApi.loadSerInfo = function loadSerInfo(opts) {
      window.IptvVod.setEpis(opts.id, [
        { id: 'ep-1', name: 'Mystery Manor · S1E1 Arrival', grp: 'S1', url: 'u1', img: '', cat: '1', num: 1, kind: 'episode' },
        { id: 'ep-2', name: 'Mystery Manor · S1E2 The Key',  grp: 'S1', url: 'u2', img: '', cat: '1', num: 2, kind: 'episode' },
        { id: 'ep-3', name: 'Mystery Manor · S2E1 Return',   grp: 'S2', url: 'u3', img: '', cat: '2', num: 1, kind: 'episode' },
      ]);
      return Promise.resolve({ ok: true, val: 3 });
    };
    window.IptvUi.rndToggle();
  });
  await page.locator('#content-toggle [data-mode="series"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('#content-toggle [data-mode="series"]');
}

test('Series mode shows series categories in the sidebar and series cards in the grid', async function ({ page }) {
  await browseSeries(page);
  // One card per series, each a drill-down opener (data-ser, never data-id).
  await expect(page.locator('.ch-card[data-ser]')).toHaveCount(2);
  await expect(page.locator('.ch-card[data-id]')).toHaveCount(0);
  await expect(page.locator('.ch-card .ch-name', { hasText: 'Mystery Manor' })).toBeVisible();
  await expect(page.locator('.ch-card .ch-name', { hasText: 'Wild Planet' })).toBeVisible();
  // The sidebar lists the series categories (Drama, Docs) plus All.
  await expect(page.locator('#grp-nav [data-cat="3"]')).toBeVisible();
  await expect(page.locator('#grp-nav [data-cat="5"]')).toBeVisible();
  await expect(page.locator('#grp-nav [data-cat="all"]')).toBeVisible();
});

test('opening a series shows its seasons and selectable episode entries', async function ({ page }) {
  await browseSeries(page);
  await page.click('.ch-card[data-ser="ser-1"]');
  // The drill-down renders the back control + season headers + episode entries.
  const back = page.locator('.ser-back[data-back]');
  await back.waitFor({ state: 'visible', timeout: 5000 });
  // R-0001: aria-label present in the baseline markup (never added at runtime).
  await expect(back).toHaveAttribute('aria-label', 'Back to series list');
  await expect(page.locator('.ser-season-head', { hasText: 'Season 1' })).toBeVisible();
  await expect(page.locator('.ser-season-head', { hasText: 'Season 2' })).toBeVisible();
  // Three selectable episode entries (Vod episode items via data-id).
  await expect(page.locator('.ch-card.epi-row[data-id]')).toHaveCount(3);
  await expect(page.locator('.epi-row .ch-name', { hasText: 'Arrival' })).toBeVisible();
});

test('the back control returns to the series list', async function ({ page }) {
  await browseSeries(page);
  await page.click('.ch-card[data-ser="ser-1"]');
  await page.locator('.ser-back[data-back]').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('.ser-back[data-back]');
  // Back to the series list: both series cards again, no drill-down back control.
  await expect(page.locator('.ch-card[data-ser]')).toHaveCount(2);
  await expect(page.locator('.ser-back')).toHaveCount(0);
});

test('the back control is keyboard-operable (focus + Enter returns to the list)', async function ({ page }) {
  await browseSeries(page);
  await page.click('.ch-card[data-ser="ser-1"]');
  const back = page.locator('.ser-back[data-back]');
  await back.waitFor({ state: 'visible', timeout: 5000 });
  await back.focus();
  await expect(back).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ch-card[data-ser]')).toHaveCount(2);
  await expect(page.locator('.ser-back')).toHaveCount(0);
});
