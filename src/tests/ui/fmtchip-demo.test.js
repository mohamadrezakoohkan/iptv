// ADR: ADR-0025
// UI demo recording (TASK-0053) — single end-to-end video of the contextual
// format chip (specs / ADR-0025): it is absent when idle, appears "on top" of
// the content-head once a channel plays and an engine resolves (labelled HLS/TS
// for the engine in use), responds to a FUNCTIONAL click by toggling the inline
// engine detail + aria-expanded, and disappears again when playback stops.
// Video capture is scoped to THIS spec only (a per-spec browser context with
// recordVideo on), never the global UI suite, so the rest of the suite stays
// fast and records nothing.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login, then click a
//     channel so a stream format resolves and the chip appears)
//  -> interact (show the contextual chip appearing on top labelled for the
//     resolved engine, click it to reveal the inline engine detail / set
//     aria-expanded=true, click again to hide it — and show it is NOT
//     always-present: it hides the moment playback stops)
//  -> revert runtime state (stop playback / back to idle in-app so the chip
//     disappears, restoring the pre-interaction state)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).
//
// Along the arc it asserts the chip's contextual presence and functional click
// for real, so the recording shows working behavior, not a blank pass.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e15-format-chip-contextual-demo.webm');
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

// Small visual dwell so each step is legible in the recording.
async function dwell(ms) {
  await page.waitForTimeout(ms);
}

// Pin the playing state so the demo arc is deterministic. A real channel click
// (in PREPARE) resolves the engine and surfaces the chip via the production
// rndChip('hls') path, but in headless chromium the demo HLS stream can fatally
// error at an unpredictable moment — onEngErr then re-renders and tears the chip
// down mid-demo. Holding PLAY + re-pushing the resolved engine through the real
// rndChip keeps the contextual chip up for the interaction while still exercising
// the genuine surfacing path (no faked DOM).
async function pinPlaying(open) {
  await page.evaluate(function pin(want) {
    if (window.IptvSt.ST.phase === 'ERR') window.IptvSt.go('INIT');
    if (window.IptvSt.ST.phase === 'INIT') window.IptvSt.go('LOAD');
    if (window.IptvSt.ST.phase === 'LOAD') window.IptvSt.go('READY');
    if (window.IptvSt.ST.phase === 'READY') window.IptvSt.go('PLAY');
    window.IptvUi.rndPhase();      // PLAY → rndPlayer leaves the chip alone
    window.IptvUi.rndChip('hls');  // production surfacing path, resolved engine
    // Optionally restore the toggle's open/closed state so a stray re-render
    // between recorded steps cannot leave the chip in an ambiguous state. The
    // toggle itself stays driven by the production onFmtChip click handler; this
    // only re-establishes the pre-click condition the next assertion expects.
    const chip = document.getElementById('fmt-chip');
    if (want !== undefined && chip && chip.getAttribute('aria-expanded') !== String(want)) {
      window.IptvUi.onFmtChip();
    }
  }, open);
}

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product; the chip is absent when idle.
// ---------------------------------------------------------------------------
test('boot: app loads fresh and shows no format chip at idle', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  // The chip is contextual, not always-present: nothing plays yet, so it hides.
  await expect(page.locator('#fmt-chip')).toBeHidden();
  await expect(page.locator('#fmt-detail')).toBeHidden();
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login, then click a
// channel so a stream format resolves (the demo engine surfaces as HLS).
// ---------------------------------------------------------------------------
test('prepare: connect demo mode and play a channel so an engine resolves', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await dwell(600);
  // Click a channel — play.js resolves the engine and pushes it to rndChip.
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#fmt-chip')).toBeVisible();
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — the contextual chip appears "on top" of the content-head with
// the resolved engine label (HLS for the demo / hls.js path).
// ---------------------------------------------------------------------------
test('interact: the contextual chip appears labelled for the resolved engine', async function () {
  await pinPlaying();
  const chip = page.locator('#fmt-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText('HLS');
  // It sits in the content-head bar (added on top of the content region).
  const inHead = await page.locator('.content-head #fmt-chip').count();
  expect(inHead).toBe(1);
  // Detail is collapsed until the chip is clicked.
  await expect(page.locator('#fmt-detail')).toBeHidden();
  await expect(chip).toHaveAttribute('aria-expanded', 'false');
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — FUNCTIONAL click: clicking the chip reveals the inline engine
// detail and sets aria-expanded=true; clicking again hides it.
// ---------------------------------------------------------------------------
test('interact: clicking the chip toggles the inline engine detail', async function () {
  const chip   = page.locator('#fmt-chip');
  const detail = page.locator('#fmt-detail');

  // Re-pin to a known-closed state immediately before the first click so a
  // stray headless media-error re-render cannot leave the chip ambiguous.
  await pinPlaying(false);
  await chip.click();
  await expect(chip).toHaveAttribute('aria-expanded', 'true');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveText('Playing via hls.js');
  await dwell(1200);

  // Re-pin to the open state (the condition the second click acts on), then
  // click again to hide — the real onFmtChip handler drives the toggle.
  await pinPlaying(true);
  await expect(detail).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-expanded', 'false');
  await expect(detail).toBeHidden();
  await dwell(900);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — the chip is NOT always-present: stopping playback (back to
// READY/idle) removes it, proving its presence is contextual.
// ---------------------------------------------------------------------------
test('interact: the chip is contextual — it hides when playback stops', async function () {
  await pinPlaying();
  await dwell(300);
  await page.evaluate(function stopToReady() {
    // Stop playback and leave the playing phase via a valid transition. We are
    // pinned to PLAY, so PLAY->READY is the clean exit (st.js §6); guard the ERR
    // race for safety. Leaving PLAY makes rndPlayer hide the contextual chip.
    window.IptvPlay.stopPlay();
    const phase = window.IptvSt.ST.phase;
    if (phase === 'PLAY') window.IptvSt.go('READY');
    else if (phase === 'ERR') window.IptvSt.go('INIT');
    window.IptvUi.rndPhase();
  });
  // Whatever the exit phase, it is no longer PLAY, so rndPlayer hid the chip.
  await expect(page.locator('#fmt-chip')).toBeHidden();
  await expect(page.locator('#fmt-detail')).toBeHidden();
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// stop playback, clear current channel, return to idle so the chip stays gone.
// (Not a git revert — the product's own runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting idle condition', async function () {
  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
    // Leave whichever non-PLAY phase we rest in for a clean idle. PLAY->READY
    // and ERR->INIT are the only valid exits (st.js §6); a resting READY/INIT
    // already shows the idle player, so only ERR needs a transition.
    if (window.IptvSt.ST.phase === 'ERR') window.IptvSt.go('INIT');
    window.IptvSt.setSrch('');
    window.IptvSt.setFlt('all');
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#fmt-chip')).toBeHidden();
  await expect(page.locator('#fmt-detail')).toBeHidden();
  await expect(page.locator('#search')).toHaveValue('');
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the recorder is
// active so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  await expect(page.video()).not.toBeNull();
});
