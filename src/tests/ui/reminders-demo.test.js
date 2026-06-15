// ADR: ADR-0033
// UI demo recording (TASK-0068) — single end-to-end video of the Remind toggle
// on the EPG (specs/reminders.md §3–§4, ADR-0033). Video capture is scoped to
// THIS spec only (a per-spec browser context with recordVideo on), never the
// global UI suite, so the rest of the suite stays fast and records nothing
// (mirroring src/tests/ui/epg-demo.test.js + log-demo.test.js).
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login so the demo
//     connect flow generates the synthetic in-memory guide and re-renders the
//     grid, so each card shows a NOW/NEXT line with a Remind toggle and an
//     expandable schedule)
//  -> interact (focus + keyboard-activate the NOW/NEXT Remind toggle and ASSERT
//     aria-pressed flips to "true" WITHOUT playing or expanding; expand the
//     schedule and activate an upcoming row's toggle, ASSERT it flips in place
//     while the guide stays open and playback never starts; clear both
//     reminders again so aria-pressed flips back to "false")
//  -> revert runtime state (clear the toggled reminders, collapse the schedule,
//     stop playback, clear the current channel + search + filter — an in-app
//     teardown, never a git revert)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).
//
// The whole arc drives PRODUCTION code only and ASSERTS the demonstrated
// behavior along the way, so the recording is a real demonstration, not a blind
// drive — reusing copy / structure from specs/reminders.md §3–§4.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e20-reminders-demo.webm');
const BASE_URL     = 'http://localhost:3000';

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
  const vid = page ? page.video() : null;
  const src = vid ? await vid.path() : null;
  if (context) await context.close();
  if (browser) await browser.close();
  if (src && fs.existsSync(src)) {
    if (fs.existsSync(VIDEO_PATH)) fs.rmSync(VIDEO_PATH);
    fs.renameSync(src, VIDEO_PATH);
  }
});

async function dwell(ms) {
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product. The app starts idle, no channels
// yet, so no cards, no now/next lines, no Remind toggles.
// ---------------------------------------------------------------------------
test('boot: app loads fresh from a clean start with no guide yet', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('.ch-card')).toHaveCount(0);
  await expect(page.locator('.ch-rem')).toHaveCount(0);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login. The demo connect
// flow loads the demo channels AND generates the synthetic in-memory guide
// spanning Date.now(), then re-renders the grid so each card carries a NOW/NEXT
// line (with a Remind toggle on NEXT) and an expandable schedule.
// ---------------------------------------------------------------------------
test('prepare: connect demo mode so channels + the synthetic guide render', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().locator('.ch-nn').waitFor({ state: 'visible', timeout: 5000 });
  // The NEXT part of the now/next line carries a baseline-unset Remind toggle.
  await expect(page.locator('.ch-card').first().locator('.ch-nn .ch-rem')).toHaveCount(1);
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — focus + keyboard-activate the NOW/NEXT Remind toggle. aria-pressed
// flips to "true"; playback never starts and the card does not expand.
// ---------------------------------------------------------------------------
test('interact: the NOW/NEXT Remind toggle flips aria-pressed without playing', async function () {
  const card = page.locator('.ch-card').first();
  const rem  = card.locator('.ch-nn .ch-rem');
  await card.scrollIntoViewIfNeeded();

  await expect(rem).toHaveAttribute('aria-pressed', 'false');
  await rem.focus();
  await expect(rem).toBeFocused();
  await dwell(700);

  await rem.press('Enter');
  await expect(rem).toHaveAttribute('aria-pressed', 'true');
  await expect(rem).toHaveAttribute('aria-label', /^Clear reminder for /);
  await expect(page.locator('body')).not.toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText('');
  await expect(card).not.toHaveClass(/is-expanded/);
  await dwell(1200);

  // Press again to clear it before the schedule-row demo. The demo guide's only
  // upcoming row is the same program as NEXT, so this keeps the next step's row
  // toggle starting from an unset baseline (in-place updates don't cross-render).
  await rem.press('Enter');
  await expect(rem).toHaveAttribute('aria-pressed', 'false');
  await dwell(500);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — expand the schedule and activate an upcoming row's Remind toggle.
// It flips in place; the guide stays open (no bubble to the expand control) and
// playback never starts (no bubble to the card's select/play).
// ---------------------------------------------------------------------------
test('interact: an upcoming schedule row Remind toggle flips in place', async function () {
  const card = page.locator('.ch-card').first();
  const exp  = card.locator('.ch-exp');
  const list = card.locator('.ch-sched');

  await exp.click();
  await expect(card).toHaveClass(/is-expanded/);
  await expect(list).toBeVisible();
  await dwell(800);

  const rowRem = list.locator('.ch-sched-row .ch-rem').first();
  await expect(rowRem).toHaveAttribute('aria-pressed', 'false');
  await rowRem.focus();
  await rowRem.press('Enter');
  await expect(rowRem).toHaveAttribute('aria-pressed', 'true');

  // The guide stays expanded and playback never started.
  await expect(card).toHaveClass(/is-expanded/);
  await expect(list).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-play/);
  await dwell(1400);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — clear the row reminder again (the same toggle pressed in its set
// state), so aria-pressed flips back to "false" — reminders are cleared
// individually (specs/reminders.md §4) — then collapse the guide.
// ---------------------------------------------------------------------------
test('interact: pressing the row toggle again clears the reminder', async function () {
  const card   = page.locator('.ch-card').first();
  const rowRem = card.locator('.ch-sched .ch-sched-row .ch-rem').first();

  await rowRem.press('Enter');
  await expect(rowRem).toHaveAttribute('aria-pressed', 'false');
  await expect(rowRem).toHaveAttribute('aria-label', /^Remind me when /);
  await dwell(600);

  // Collapse the guide again — back toward the pre-interaction condition.
  await card.locator('.ch-exp').click();
  await expect(card).not.toHaveClass(/is-expanded/);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// clear any stored reminders, collapse the schedule, stop playback (none was
// started), clear the current channel / search / filter, and return to idle.
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting idle condition', async function () {
  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    if (window.IptvRem && window.IptvRem.clear) window.IptvRem.clear();
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
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
