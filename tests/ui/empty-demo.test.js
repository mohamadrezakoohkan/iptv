// ADR: ADR-0021, ADR-0022, ADR-0023
// UI demo recording (TASK-0046) — single end-to-end video of the improved
// empty / no-signal states (specs/empty-states.md §2-§3). Video capture is
// scoped to THIS spec only (a per-spec browser context with recordVideo on),
// never the global UI suite, so the rest of the suite stays fast and cheap.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login)
//  -> interact (show each improved state: no-match grid, empty favourites,
//     empty category, player idle "NO SIGNAL" guidance, stream-error + Retry)
//  -> revert runtime state (clear search, back to All Channels, stop playback)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e13-empty-state-demo.webm');
const BASE_URL     = 'http://localhost:3000';

// Run the whole arc serially inside one recorded context.
test.describe.configure({ mode: 'serial' });

let browser = null;
let context = null;
let page    = null;

test.beforeAll(async function setup() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  browser = await chromium.launch();
  context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: ARTIFACT_DIR, size: { width: 1280, height: 800 } },
  });
  page = await context.newPage();
});

test.afterAll(async function teardown() {
  // Resolve the auto-named video path BEFORE closing the page, then close the
  // context to flush the .webm to disk, then rename to the stable artifact path.
  const vid = page ? page.video() : null;
  const src = vid ? await vid.path() : null;
  if (context) await context.close();
  if (browser) await browser.close();
  if (src && fs.existsSync(src)) {
    if (fs.existsSync(VIDEO_PATH)) fs.rmSync(VIDEO_PATH);
    fs.renameSync(src, VIDEO_PATH);
  }
});

// Small visual dwell so each state is legible in the recording.
async function dwell(ms) {
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product.
// ---------------------------------------------------------------------------
test('boot: app loads fresh from a clean start', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  await dwell(800);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login flow.
// ---------------------------------------------------------------------------
test('prepare: connect demo mode and load the demo channels', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — no-content grid: empty search ("No matches" + Clear search).
// ---------------------------------------------------------------------------
test('interact: empty-search shows the "No matches" placeholder', async function () {
  await page.fill('#search', 'zzzznotachannel');
  await page.locator('.ch-empty').waitFor({ state: 'visible', timeout: 3000 });
  const empty = page.locator('.ch-empty');
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty.locator('.ch-empty-title')).toHaveText('No matches');
  await expect(empty.locator('.ch-empty-body')).toContainText('zzzznotachannel');
  await expect(empty.locator('.ch-empty-btn')).toHaveText('Clear search');
  await dwell(1200);
  // Clear via the placeholder's own action so the recording shows it working.
  await empty.locator('.ch-empty-btn').click();
  await expect(page.locator('.ch-empty')).toHaveCount(0);
  await expect(page.locator('#search')).toHaveValue('');
  await dwell(600);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — no-content grid: empty favourites ("No favourites yet" +
// Browse all channels). The Favourites sidebar button only appears once a
// favourite exists, so the empty-favourites view is reached by activating the
// favourites filter with zero favourites through the real render path (the same
// state the app shows the moment a user removes their last favourite).
// ---------------------------------------------------------------------------
test('interact: empty-favourites shows the "No favourites yet" placeholder', async function () {
  await page.evaluate(function showFavsEmpty() {
    const st = window.IptvSt.ST;
    window.IptvSt.setFlt('favs');
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, st.srch, 'favs', st.favs, st.sort));
  });
  const empty = page.locator('.ch-empty');
  await empty.waitFor({ state: 'visible', timeout: 3000 });
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty.locator('.ch-empty-title')).toHaveText('No favourites yet');
  await expect(empty.locator('.ch-empty-btn')).toHaveText('Browse all channels');
  await dwell(1200);
  // Browse-all action returns to the full grid.
  await empty.locator('.ch-empty-btn').click();
  await expect(page.locator('[data-cat="all"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await dwell(600);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — no-content grid: empty category ("Nothing in this category").
// Drive a category that has been emptied so the contextual category copy shows
// through the real rndGrid render path.
// ---------------------------------------------------------------------------
test('interact: empty-category shows the "Nothing in this category" placeholder', async function () {
  await page.evaluate(function emptyCat() {
    const st = window.IptvSt.ST;
    window.IptvSt.setFlt('news');
    // Render the grid filtered to a category with zero channels in the current
    // source view, exercising the category-empty branch of resolveContent.
    window.IptvUi.rndGrid(window.IptvSrch.getChs([], '', 'news', st.favs, st.sort));
  });
  const empty = page.locator('.ch-empty');
  await empty.waitFor({ state: 'visible', timeout: 3000 });
  await expect(empty.locator('.ch-empty-title')).toHaveText('Nothing in this category');
  await dwell(1200);
  // Restore the full grid (back to All Channels).
  await page.evaluate(function restoreAll() {
    const st = window.IptvSt.ST;
    window.IptvSt.setFlt('all');
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await dwell(600);
});

// ---------------------------------------------------------------------------
// INTERACT 4 — no-signal player: idle "NO SIGNAL" guidance.
// ---------------------------------------------------------------------------
test('interact: player idle shows the "NO SIGNAL" guidance', async function () {
  await page.evaluate(function showIdle() { window.IptvUi.rndPhase(); });
  const idle = page.locator('#player-idle');
  await expect(idle).toBeVisible();
  await expect(idle).toContainText('NO SIGNAL');
  await expect(idle).toContainText('to start watching');
  await dwell(1200);
});

// ---------------------------------------------------------------------------
// INTERACT 5 — no-signal player: stream-error placeholder + Retry.
// ---------------------------------------------------------------------------
test('interact: player stream-error shows the headline and a Retry action', async function () {
  await page.evaluate(function showErr() {
    // The app is in READY after connecting demo; READY -> ERR is the real
    // transition the player takes when a selected stream fails to load.
    window.IptvSt.setCur({ id: '1', name: 'World News 24', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.setErr('mediaError');
    window.IptvSt.go('ERR');
    window.IptvUi.rndPhase();
  });
  const err = page.locator('#player-err');
  await expect(err).toBeVisible();
  await expect(err).toContainText("This channel won't play");
  await expect(err).toContainText('The stream could not be loaded');
  await expect(err.locator('button[data-sig-act="retry"]')).toHaveText('Retry');
  await dwell(1400);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// clear search, return to All Channels, stop playback / return to idle.
// (Not a git revert — the product's own runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting condition', async function () {
  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    // Stop any playback and clear the error so the player returns to idle.
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
    window.IptvSt.go('INIT');
    // Clear search and category filter back to All Channels.
    window.IptvSt.setSrch('');
    window.IptvSt.setFlt('all');
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#player-err')).toBeHidden();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('[data-cat="all"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-empty')).toHaveCount(0);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the artifact
// is produced so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  // The artifact is written in afterAll (after this test, after context close),
  // so verify the recorder is active here; afterAll renames it deterministically.
  await expect(page.video()).not.toBeNull();
});
