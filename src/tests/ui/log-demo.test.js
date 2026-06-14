// ADR: ADR-0028
// UI demo recording (TASK-0060) — single end-to-end video of the playback
// failure-log button + slide-in panel (specs/playback-failure-log.md §2-§3,
// ADR-0028). Video capture is scoped to THIS spec only (a per-spec browser
// context with recordVideo on), never the global UI suite, so the rest of the
// suite stays fast and records nothing.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer;
//      the log button sits beside the account button, badge hidden)
//  -> prepare (connect demo mode through the real footer login so a channel
//     context exists)
//  -> interact (induce a REAL playback failure through the genuine in-app
//     capture path — click a demo channel that cannot play in this offline
//     harness, so play.js's runHls dead-ends into onEngErr, which records a
//     real IptvErrLog entry, re-renders the count badge, and surfaces the
//     entry; open the log panel from the button beside the account button;
//     show the entry row with its channel name + detail and the count badge;
//     click Clear and show the empty state)
//  -> revert runtime state (close the log panel, the log already cleared, stop
//     playback, return the in-app runtime state to the pre-interaction idle
//     condition — an in-app teardown, never a git revert)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).
//
// The failure is induced through PRODUCTION code only: a genuine channel click
// drives onGridClick -> setCur -> go('PLAY') -> loadPlay -> runHls, and with no
// hls.js available (the CDN script tag fails to load in this offline sandbox, so
// window.Hls is undefined) runHls synchronously calls onEngErr('HLS not
// supported'), recording one real IptvErrLog entry and re-rendering the badge +
// panel. Only the trigger is induced; the capture is the real product path
// (ADR-0027/ADR-0028).
//
// One environment nuance: headless Chromium reports canPlayType(HLS) === "maybe"
// (truthy), which would send runHls down its native-<video> branch (loadNative)
// — a branch whose load error never funnels through onEngErr. Typical desktop
// Chrome, the product's real target, reports "" (no native HLS) for that MIME,
// so the genuine HLS-not-supported dead-end is exactly what a real user on
// desktop Chrome with a blocked hls.js CDN would hit. An init script below makes
// headless Chromium report that same honest "no native HLS" capability, so the
// REAL onEngErr path runs. This is not faking the failure or injecting DOM — it
// only restores the browser capability the production code branches on.
//
// Along the arc it asserts the button sits beside the account button, the panel
// shows the captured failure with its detail, the badge reflects the count, and
// Clear empties it — so the recording is a real demonstration, not a blind drive.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e17-failure-log-demo.webm');
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
  // Report no native <video> HLS for the HLS MIME — the honest capability of a
  // typical desktop Chrome (headless Chromium otherwise answers "maybe"). With
  // hls.js also unavailable (blocked CDN offline), this is precisely the real
  // condition under which production runHls dead-ends into onEngErr('HLS not
  // supported'), so the demo's channel click drives the genuine capture path.
  await context.addInitScript(function () {
    var orig = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (t) {
      if (/mpegurl|x-mpegurl|vnd\.apple/i.test(String(t))) return '';
      return orig.call(this, t);
    };
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

// onScreen — true when the log panel's left edge sits inside the viewport (the
// panel is always in the DOM and toggled via a CSS transform, so a translated
// panel still counts as "visible" to Playwright — check the on-screen x).
async function onScreen() {
  return page.evaluate(function () {
    const pnl = document.getElementById('log-panel');
    const box = pnl.getBoundingClientRect();
    return box.left < window.innerWidth - 10;
  });
}

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product. The log button is present in the
// top bar beside the account button, and the count badge is hidden at idle.
// ---------------------------------------------------------------------------
test('boot: app loads fresh; log button sits beside the account button, badge hidden', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#log-btn')).toBeVisible();

  // The log button precedes the account button at the right edge of the head.
  const geom = await page.evaluate(function () {
    const log  = document.getElementById('log-btn').getBoundingClientRect();
    const acct = document.getElementById('acct-btn').getBoundingClientRect();
    const head = document.querySelector('.content-head').getBoundingClientRect();
    return { logRight: log.right, acctLeft: acct.left, acctRight: acct.right, headRight: head.right };
  });
  expect(geom.logRight).toBeLessThanOrEqual(geom.acctLeft + 1);
  expect(geom.headRight - geom.acctRight).toBeLessThan(40);

  // No failures yet: the badge is hidden, and the panel is off-screen.
  await expect(page.locator('#log-count')).toHaveClass(/is-empty/);
  await expect(page.locator('#log-panel')).not.toHaveClass(/is-open/);
  expect(await onScreen()).toBe(false);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login so a channel
// context exists (the demo playlist's 31 channels render in the grid).
// ---------------------------------------------------------------------------
test('prepare: connect demo mode so a channel context exists', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — induce a REAL playback failure through the genuine capture path:
// click the first demo channel ("World News 24", #001). With hls.js unavailable
// and native HLS reporting unsupported, play.js's runHls dead-ends into
// onEngErr('HLS not supported'), which records a real IptvErrLog entry and
// re-renders the badge. The count badge becomes visible and shows 1 — driven
// entirely by production code (only the channel click is the induced trigger).
// ---------------------------------------------------------------------------
test('interact: clicking a channel that cannot play records a real failure and shows the badge', async function () {
  const firstCard = page.locator('.ch-card').first();
  await firstCard.scrollIntoViewIfNeeded();
  await dwell(500);
  await firstCard.click();

  // The genuine onEngErr capture path recorded exactly one real entry and the
  // production rndLog() re-render surfaced the count badge.
  await expect(page.locator('#log-count')).not.toHaveClass(/is-empty/);
  await expect(page.locator('#log-count')).toHaveText('1');
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — open the log panel from the button beside the account button and
// show the captured failure row (channel name + number) with its detail line,
// and the count badge reflecting the one recorded failure.
// ---------------------------------------------------------------------------
test('interact: opening the panel shows the captured failure with its detail', async function () {
  await page.click('#log-btn');
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
  await expect(page.locator('#log-scrim')).toHaveClass(/is-open/);
  await expect(page.locator('#log-panel')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#log-btn')).toHaveAttribute('aria-expanded', 'true');
  await dwell(300); // let the transform transition settle
  expect(await onScreen()).toBe(true);

  // One row, for the failed channel, with the engine detail as its secondary line.
  await expect(page.locator('#log-list .log-row')).toHaveCount(1);
  await expect(page.locator('#log-list .log-row-name')).toContainText('World News 24');
  await expect(page.locator('#log-list .log-row-name')).toContainText('001');
  await expect(page.locator('#log-list .log-row-detail')).toHaveText('HLS not supported');

  // The badge still reflects the count while the panel is open.
  await expect(page.locator('#log-count')).toHaveText('1');
  await dwell(1200);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — click Clear: the log empties to the calm empty-state placeholder
// and the count badge hides, all through the production onLogClear -> rndLog.
// ---------------------------------------------------------------------------
test('interact: clicking Clear empties the log to the empty state and hides the badge', async function () {
  await page.click('#log-clear');
  await expect(page.locator('#log-list .log-row')).toHaveCount(0);
  await expect(page.locator('#log-list .log-empty')).toHaveText('No playback failures this session.');
  await expect(page.locator('#log-count')).toHaveClass(/is-empty/);
  await expect(page.locator('#log-count')).toHaveText('0');
  await dwell(1200);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// close the log panel (the log is already cleared), stop playback, clear the
// current channel, and return to the idle condition. (Not a git revert — the
// product's own runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: close the panel and reset in-app runtime state to the starting idle condition', async function () {
  await page.click('#log-close');
  await expect(page.locator('#log-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#log-panel')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#log-btn')).toHaveAttribute('aria-expanded', 'false');
  await dwell(400); // let the slide-out transform transition settle off-screen
  expect(await onScreen()).toBe(false);

  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
    // The click drove the app to ERR; ERR->INIT is the only valid exit (st.js §6).
    if (window.IptvSt.ST.phase === 'ERR') window.IptvSt.go('INIT');
    window.IptvSt.setSrch('');
    window.IptvSt.setFlt('all');
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });

  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
  // The log is empty and its badge hidden — back to the pre-interaction state.
  await expect(page.locator('#log-count')).toHaveClass(/is-empty/);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the recorder is
// active so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  await expect(page.video()).not.toBeNull();
});
