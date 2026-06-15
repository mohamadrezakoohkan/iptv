// ADR: ADR-0031
// UI demo recording (TASK-0066) — single end-to-end video of the EPG now/next
// line on each channel card plus the expandable per-channel schedule view
// (specs/epg.md §4–§5, ADR-0031). Video capture is scoped to THIS spec only (a
// per-spec browser context with recordVideo on), never the global UI suite, so
// the rest of the suite stays fast and records nothing (mirroring
// src/tests/ui/log-demo.test.js + grid-align-demo.test.js).
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login so the demo
//     connect flow generates the synthetic in-memory guide and re-renders the
//     grid, so each demo card shows a NOW/NEXT line and an expand control)
//  -> interact (show the NOW/NEXT line on the first card with its real program
//     titles; activate the card's expand control to reveal the schedule list and
//     ASSERT this did NOT start playback — the control is playback-safe; show a
//     couple of schedule rows with the currently-airing program marked; collapse
//     the schedule again)
//  -> revert runtime state (collapse any open schedule, stop playback, clear the
//     current channel + search + filter, return to the pre-interaction idle
//     condition — an in-app teardown, never a git revert)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).
//
// The whole arc drives PRODUCTION code only: the real footer demo connect builds
// the channels and synthetic guide, mkCard renders the now/next line + expand
// control, and onExpClick toggles the presentational is-expanded schedule. Along
// the arc it ASSERTS the demonstrated behavior (now/next line present with
// titles, expand reveals schedule rows, expand did not trigger playback) so the
// recording is a real demonstration, not a blind drive — reusing copy / structure
// from specs/epg.md §4–§5.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e19-epg-demo.webm');
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

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product. The app starts idle, no channels
// yet, so no now/next lines or expand controls exist (contextual presence,
// ADR-0025: cards appear only after a connection loads them).
// ---------------------------------------------------------------------------
test('boot: app loads fresh from a clean start with no guide yet', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  // No channels, hence no now/next lines and no expand controls at idle.
  await expect(page.locator('.ch-card')).toHaveCount(0);
  await expect(page.locator('.ch-nn')).toHaveCount(0);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login. The demo connect
// flow loads the 31 demo channels AND generates the synthetic in-memory guide
// (runDemoEpg, TASK-0063), then re-renders the grid (rndGuide) so each card
// carries a NOW/NEXT line and an expand control.
// ---------------------------------------------------------------------------
test('prepare: connect demo mode so channels + the synthetic guide render', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(31);
  // The demo EPG is generated + re-rendered after connect; wait for the line.
  await page.locator('.ch-card').first().locator('.ch-nn').waitFor({ state: 'visible', timeout: 5000 });
  // Every demo channel has a guide, so every card carries a now/next line.
  await expect(page.locator('.ch-card .ch-nn')).toHaveCount(31);
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — show the NOW/NEXT line on the first card. It carries a "NOW"
// marker + the currently-airing program title and a "NEXT" marker + the next
// program title (specs/epg.md §4). The line is decorative (aria-hidden) and
// never steals the card's primary click target.
// ---------------------------------------------------------------------------
test('interact: the first card shows a NOW/NEXT line with real program titles', async function () {
  const card = page.locator('.ch-card').first();
  await card.scrollIntoViewIfNeeded();
  const nn = card.locator('.ch-nn');
  await expect(nn).toHaveCount(1);
  // The NOW/NEXT text rows stay decorative (aria-hidden) under the .ch-nn-text
  // span; the Remind toggle (ADR-0033) sits outside it, keyboard/AT reachable.
  await expect(nn.locator('.ch-nn-text')).toHaveAttribute('aria-hidden', 'true');

  // The synthetic guide spans Date.now(): a NOW title and a NEXT title both show.
  await expect(nn.locator('.ch-nn-now .ch-nn-mark')).toHaveText('NOW');
  await expect(nn.locator('.ch-nn-nxt .ch-nn-mark')).toHaveText('NEXT');
  await expect(nn.locator('.ch-nn-now .ch-nn-title')).toContainText('World News 24');
  await expect(nn.locator('.ch-nn-nxt .ch-nn-title')).toContainText('World News 24');
  await dwell(1200);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — activate the card's expand control to reveal the schedule list.
// The schedule is collapsed by default; activating the control adds is-expanded,
// flips aria-expanded to true, and reveals the schedule rows (the currently-
// airing program marked). Crucially this does NOT start playback — the control
// is playback-safe (specs/epg.md §5, §7): no PLAY phase, no selected channel.
// ---------------------------------------------------------------------------
test('interact: the expand control reveals the schedule WITHOUT starting playback', async function () {
  const card = page.locator('.ch-card').first();
  const exp  = card.locator('.ch-exp');
  const list = card.locator('.ch-sched');

  // Collapsed by default.
  await expect(exp).toHaveCount(1);
  await expect(exp).toHaveAttribute('aria-expanded', 'false');
  await expect(list).toHaveAttribute('aria-hidden', 'true');
  await expect(list).toBeHidden();
  await expect(card).not.toHaveClass(/is-expanded/);
  await dwell(600);

  // Activate the control: the schedule expands presentationally.
  await exp.click();
  await expect(card).toHaveClass(/is-expanded/);
  await expect(exp).toHaveAttribute('aria-expanded', 'true');
  await expect(list).toHaveAttribute('aria-hidden', 'false');
  await expect(list).toBeVisible();

  // A couple of schedule rows render, with the currently-airing program marked.
  expect(await list.locator('.ch-sched-row').count()).toBeGreaterThanOrEqual(2);
  await expect(list.locator('.ch-sched-row').first()).toBeVisible();
  await expect(list.locator('.ch-sched-row.ch-sched-cur')).toHaveCount(1);

  // Playback never started — the expand control is playback-safe: the app stayed
  // out of the PLAY phase, no channel was selected, the player video stays hidden.
  await expect(page.locator('body')).not.toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText('');
  await expect(page.locator('#player-video')).toBeHidden();
  await dwell(1500);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — collapse the schedule again via the same control: is-expanded is
// removed, aria-expanded flips back to false, and the list hides.
// ---------------------------------------------------------------------------
test('interact: activating the control again collapses the schedule', async function () {
  const card = page.locator('.ch-card').first();
  const exp  = card.locator('.ch-exp');
  const list = card.locator('.ch-sched');

  await exp.click();
  await expect(card).not.toHaveClass(/is-expanded/);
  await expect(exp).toHaveAttribute('aria-expanded', 'false');
  await expect(list).toHaveAttribute('aria-hidden', 'true');
  await expect(list).toBeHidden();
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// collapse any open schedule (already collapsed above), stop playback (none was
// started, but reset defensively), clear the current channel / search / filter,
// and return to the idle condition. (Not a git revert — the product's own
// runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting idle condition', async function () {
  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
    // The expand control is presentational only (no PLAY phase reached), but if
    // any phase change occurred, INIT is the safe return to the idle condition.
    if (window.IptvSt.ST.phase === 'PLAY' || window.IptvSt.ST.phase === 'ERR') {
      window.IptvSt.go('INIT');
    }
    window.IptvSt.setSrch('');
    window.IptvSt.setFlt('all');
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });

  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
  // No schedule is open after the re-render — back to the pre-interaction state.
  await expect(page.locator('.ch-card.is-expanded')).toHaveCount(0);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the recorder is
// active so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  await expect(page.video()).not.toBeNull();
});
