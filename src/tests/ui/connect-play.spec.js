// ADR: ADR-0041
// UI e2e — TASK-0091: the browser proof of the single-connection fan-out gate.
// Connecting to an Xtream-shaped portal whose user_info.max_connections is "1"
// must list channels AND let a live channel start playback WITHOUT the
// post-connect EPG/VOD fan-out firing — that fan-out is exactly what starved the
// single allowed connection / 404'd the live stream before the gate (ADR-0041,
// reproduced in the real browser against the real portal). The same spec records
// the run's demo (this run changes user-interactable behavior, CORE_FLOW §3).
//
// HERMETIC — no live network. The real personal portal is in cooldown and must
// never be touched (cf. live.test.js, which DOES hit the real portal and is NOT
// what this spec does). Instead, page.route intercepts the app's `/api/xtream?url=`
// proxy endpoint and decides which Xtream action is being requested by decoding
// the inner `url=` param, answering every request with deterministic fixtures:
//   - no-action player_api.php (auth/info) -> user_info.max_connections "1" (or
//     "2" in the control case), auth 1, allowed_output_formats ["ts"];
//   - get_live_categories / get_live_streams -> a small Xtream-shaped channel list
//     so the grid renders clickable cards;
//   - the proxied live `.../live/<u>/<p>/<id>.ts` -> a small static 200 body, so
//     the player's stream fetch IS satisfied (playback proceeds, not starved) —
//     the point is that the request IS ISSUED, not that the codec decodes headless;
//   - get_simple_data_table / get_vod_* / get_series* -> RECORDED so the test can
//     assert the count is ZERO on the single-connection portal (the gate working);
//     if one slips through it is answered 200-empty so the run still completes, but
//     the recorded-count assertion is what proves the fix.
//
// The whole arc drives PRODUCTION code only (the real footer login runs the real
// connect path -> loadXtream reads max_connections -> the gate skips runXtEpg /
// runXtVod when maxConns === 1; onGridClick routes the live card click to the
// real goPlay select+play path -> loadPlay -> the dual-engine player issues the
// proxied live-stream request). It ASSERTS the demonstrated behavior so the
// recording is a real demonstration, not a blind drive.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e24-single-conn-fanout-demo.webm');
const BASE_URL     = 'http://localhost:3000';

// Xtream-shaped portal the footer form connects to (never reached — page.route
// intercepts the proxy before any byte leaves the browser).
const PORTAL = 'http://portal.example.test:8080';
const USR    = 'demo-user';
const PSS    = 'demo-pass';

// A small Xtream-shaped channel list: 2 categories, 3 live streams.
const XT_CATS = [
  { category_id: '1', category_name: 'News' },
  { category_id: '2', category_name: 'Sports' },
];
const XT_STREAMS = [
  { stream_id: 101, name: 'World News 24', category_id: '1', num: 1, stream_icon: '', tv_archive: 0 },
  { stream_id: 102, name: 'Daily Headlines', category_id: '1', num: 2, stream_icon: '', tv_archive: 0 },
  { stream_id: 201, name: 'Sports Arena HD', category_id: '2', num: 3, stream_icon: '', tv_archive: 0 },
];

// ---------------------------------------------------------------------------
// Build the no-action player_api.php auth/info payload for a given capacity.
// ---------------------------------------------------------------------------
function authPayload(maxConns) {
  return {
    user_info: {
      auth: 1,
      status: 'Active',
      max_connections: String(maxConns),
      active_cons: '0',
      allowed_output_formats: ['ts'],
    },
    server_info: { url: 'portal.example.test', port: '8080', https_port: '8080', server_protocol: 'http' },
  };
}

// ---------------------------------------------------------------------------
// Classify the inner Xtream request from the decoded `url=` proxy param.
// Returns one of: 'auth' | 'live-cats' | 'live-streams' | 'epg' | 'vod' |
// 'stream' | 'other'. The classification mirrors api.js's URL builders.
// ---------------------------------------------------------------------------
function classify(reqUrl) {
  const q = reqUrl.indexOf('url=');
  const inner = q === -1 ? '' : decodeURIComponent(reqUrl.slice(q + 4));
  if (inner.indexOf('/live/') !== -1) return 'stream';
  if (inner.indexOf('action=get_simple_data_table') !== -1) return 'epg';
  if (inner.indexOf('action=get_vod_') !== -1) return 'vod';
  if (inner.indexOf('action=get_series') !== -1) return 'vod';
  if (inner.indexOf('action=get_live_categories') !== -1) return 'live-cats';
  if (inner.indexOf('action=get_live_streams') !== -1) return 'live-streams';
  if (inner.indexOf('player_api.php') !== -1 && inner.indexOf('action=') === -1) return 'auth';
  return 'other';
}

// ---------------------------------------------------------------------------
// Install the hermetic Xtream-shaped proxy mock on a page. Records the count of
// fan-out requests (EPG short-data-table + VOD/series) and live-stream requests
// into the shared `seen` object so the test can assert the gate's effect.
// opts: { maxConns: number, seen: { epg, vod, stream } }
// ---------------------------------------------------------------------------
async function mockPortal(page, opts) {
  const seen = opts.seen;
  await page.route('**/api/xtream*', async function onRoute(route) {
    const kind = classify(route.request().url());
    if (kind === 'auth') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authPayload(opts.maxConns)) });
      return;
    }
    if (kind === 'live-cats') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(XT_CATS) });
      return;
    }
    if (kind === 'live-streams') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(XT_STREAMS) });
      return;
    }
    if (kind === 'epg') {
      // The fan-out the gate must suppress on a single-connection portal. Count
      // it, then answer 200-empty so a slip-through never hangs the run — the
      // recorded count (asserted == 0) is what proves the gate.
      seen.epg += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ epg_listings: [] }) });
      return;
    }
    if (kind === 'vod') {
      seen.vod += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }
    if (kind === 'stream') {
      // The proxied live `.ts` request the player issues. Its presence proves
      // playback proceeds (not starved); a small static body satisfies the fetch.
      seen.stream += 1;
      await route.fulfill({ status: 200, contentType: 'video/mp2t', body: 'TS' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

// ---------------------------------------------------------------------------
// Drive the real footer Xtream login. page.fill dispatches the input event that
// enables #btn-conn (disabled until #f-url is non-empty, ui.js rndConn).
// ---------------------------------------------------------------------------
async function connect(page) {
  await page.addInitScript(function clearStore() { window.localStorage.clear(); });
  await page.goto(BASE_URL);
  await page.check('#mode-xtream');
  await page.fill('#f-url', PORTAL);
  await page.fill('#f-user', USR);
  await page.fill('#f-pass', PSS);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 10000 });
}

// ===========================================================================
// PART A — hermetic regression assertions (fresh per-test page).
// ===========================================================================

test.describe('single-connection portal: fan-out gated, live playback not starved', function () {
  test('connecting to a max_connections:1 portal lists channels', async function ({ page }) {
    const seen = { epg: 0, vod: 0, stream: 0 };
    await mockPortal(page, { maxConns: 1, seen });
    await connect(page);

    // The grid populated: categories in the sidebar + channel cards in the grid.
    await expect(page.locator('#footer-conn')).toContainText(USR);
    expect(await page.locator('#grp-nav .cat-btn').count()).toBeGreaterThan(2);
    await expect(page.locator('.ch-card')).toHaveCount(XT_STREAMS.length);
    await expect(page.locator('.ch-card[data-id="101"] .ch-name')).toHaveText('World News 24');
  });

  test('the single-connection gate suppresses the EPG/VOD/series fan-out', async function ({ page }) {
    const seen = { epg: 0, vod: 0, stream: 0 };
    await mockPortal(page, { maxConns: 1, seen });
    await connect(page);

    // goEpg / goVod are best-effort + non-blocking; give the (gated-off) fan-out
    // ample time to NOT fire, then assert nothing was requested.
    await page.waitForTimeout(2000);
    expect(seen.epg).toBe(0);
    expect(seen.vod).toBe(0);
  });

  test('selecting a live channel issues the proxied stream request (playback not starved)', async function ({ page }) {
    const seen = { epg: 0, vod: 0, stream: 0 };
    await mockPortal(page, { maxConns: 1, seen });
    await connect(page);

    await page.locator('.ch-card[data-id="101"]').click();
    // The live card click drove the real select+play path: READY -> PLAY, the
    // body carries is-play, the TS engine is selected (allowed_output_formats
    // ["ts"] -> .ts url), and the proxied live-stream request was issued.
    await expect(page.locator('body')).toHaveClass(/is-play/);
    await expect(page.locator('#fmt-chip')).toHaveText('TS');
    await expect.poll(function streamSeen() { return seen.stream; }, { timeout: 10000 }).toBeGreaterThan(0);
    // The fan-out still never fired across the whole connect+play arc.
    expect(seen.epg).toBe(0);
    expect(seen.vod).toBe(0);
  });
});

// ===========================================================================
// PART B — control case: a multi-connection portal DOES run the fan-out, so the
// gate is proven conditional (not a blanket disable).
// ===========================================================================

test.describe('control: multi-connection portal runs the fan-out', function () {
  test('connecting to a max_connections:4 portal fires the EPG fan-out', async function ({ page }) {
    const seen = { epg: 0, vod: 0, stream: 0 };
    await mockPortal(page, { maxConns: 4, seen });
    await connect(page);

    // On a multi-connection portal the bulk EPG fan-out runs (runXtEpg issues
    // per-channel get_simple_data_table). Poll until at least one fired.
    await expect.poll(function epgSeen() { return seen.epg; }, { timeout: 10000 }).toBeGreaterThan(0);
  });
});

// ===========================================================================
// PART C — demo recording (CORE_FLOW §3). One end-to-end video of the fixed
// behavior: boot -> prepare (connect the single-connection portal) -> interact
// (see channels, play a live channel) -> revert runtime state (in-app
// Disconnect back to the NO SIGNAL idle state) -> stop. Capture is scoped to
// THIS context only (recordVideo on a per-spec browser context), like the other
// *-demo / *-recording specs.
// ===========================================================================

test.describe('demo recording: single-connection connect -> play -> disconnect', function () {
  test.describe.configure({ mode: 'serial' });

  let browser = null;
  let context = null;
  let page    = null;
  const seen  = { epg: 0, vod: 0, stream: 0 };

  test.beforeAll(async function setup() {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    browser = await chromium.launch();
    context = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: ARTIFACT_DIR, size: { width: 1280, height: 800 } },
    });
    page = await context.newPage();
    await mockPortal(page, { maxConns: 1, seen });
  });

  test.afterAll(async function teardown() {
    // Resolve the auto-named video path BEFORE closing the page, then close the
    // context to flush the .webm, then rename to the stable artifact path.
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

  // -------------------------------------------------------------------------
  // BOOT — fresh load of the running product. Idle, no source connected, so no
  // cards exist and the player shows its NO SIGNAL idle placeholder.
  // -------------------------------------------------------------------------
  test('boot: app loads fresh, idle, no channels', async function () {
    await page.addInitScript(function clearStore() { window.localStorage.clear(); });
    await page.goto(BASE_URL);
    await expect(page.locator('#player-idle')).toBeVisible();
    await expect(page.locator('.ch-card')).toHaveCount(0);
    await dwell(900);
  });

  // -------------------------------------------------------------------------
  // PREPARE — open/use the connect form: choose Xtream mode and enter the
  // single-connection Xtream-shaped portal credentials.
  // -------------------------------------------------------------------------
  test('prepare: enter the single-connection portal in the footer form', async function () {
    await page.check('#mode-xtream');
    await page.fill('#f-url', PORTAL);
    await page.fill('#f-user', USR);
    await page.fill('#f-pass', PSS);
    await dwell(700);
  });

  // -------------------------------------------------------------------------
  // INTERACT — connect (the gate suppresses the fan-out), see the channel grid,
  // then click a live channel so it plays through the existing player. This is
  // the behavior the run fixes: live playback is not starved on a 1-connection
  // portal because the fan-out never fired.
  // -------------------------------------------------------------------------
  test('interact: connect, see channels, play a live channel', async function () {
    await page.click('#btn-conn');
    await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('.ch-card')).toHaveCount(XT_STREAMS.length);
    await dwell(1000);

    await page.locator('.ch-card[data-id="101"]').click();
    await expect(page.locator('body')).toHaveClass(/is-play/);
    await expect(page.locator('#fmt-chip')).toHaveText('TS');
    await expect(page.locator('#player-video')).toBeVisible();
    await expect(page.locator('#player-idle')).toBeHidden();
    // The proxied live-stream request was issued; the fan-out never fired.
    await expect.poll(function streamSeen() { return seen.stream; }, { timeout: 10000 }).toBeGreaterThan(0);
    expect(seen.epg).toBe(0);
    expect(seen.vod).toBe(0);
    await dwell(1800);
  });

  // -------------------------------------------------------------------------
  // REVERT RUNTIME STATE — in-app Disconnect (the footer control), returning to
  // the pre-connect NO SIGNAL idle state. Not a git revert — the product's own
  // runtime state is reset through its UI.
  // -------------------------------------------------------------------------
  test('revert: disconnect back to the idle NO SIGNAL state', async function () {
    await page.click('#btn-disc');
    await page.locator('#footer-login').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.locator('#player-idle')).toBeVisible();
    await expect(page.locator('.ch-card')).toHaveCount(0);
    await dwell(1000);
  });

  // -------------------------------------------------------------------------
  // STOP — the video is flushed + renamed in afterAll(). Assert the recorder is
  // active so a missing recording fails this spec loudly.
  // -------------------------------------------------------------------------
  test('stop: the demo video artifact is produced', async function () {
    await expect(page.video()).not.toBeNull();
  });
});
