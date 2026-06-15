// ADR: ADR-0038
// UI demo recording (TASK-0083) — single end-to-end video of the VOD browse +
// on-demand play arc: connect demo mode (which synthesizes one offline-playable
// VOD movie, specs/vod-library.md §6), switch the Live | Movies | Series content
// toggle to Movies, browse the synthesized movie poster card, and play it
// through the EXISTING dual-engine player via the EXISTING select+play path (no
// new engine, no new phase, no new route — specs/vod-library.md §5a, §5c, §6,
// ADR-0038). Video capture is scoped to THIS spec only (a per-spec browser
// context with recordVideo on), never the global UI suite, so the rest of the
// suite stays fast and records nothing (mirroring src/tests/ui/epg-demo.test.js,
// reminders-demo.test.js, catchup-recording.test.js). The browse + play behavior
// itself is regression-asserted by vod-demo.test.js + vod.test.js; this spec is
// the recording demonstration.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login so the demo
//     connect flow loads the demo live channels AND synthesizes the one offline
//     VOD movie — "Demo Movie", id demo-vod-1, ADR-0038 §6 — surfacing the
//     Movies tab in the content toggle)
//  -> interact (use the content toggle to switch to MOVIES — rndMode2 re-renders
//     the sidebar/grid from the movie set — ASSERT the Movies tab is active and
//     the synthesized movie poster card is shown, then select it and ASSERT it
//     plays through the normal player — READY->PLAY, body.is-play, #now-info
//     shows the movie, the player video is shown — proving on-demand VOD playback
//     works through the existing select+play path)
//  -> revert runtime state (stop playback, switch the toggle back to Live, clear
//     the current item + search + filter, re-render so the live grid returns to
//     the pre-interaction idle condition — an in-app teardown, never a git revert)
//  -> stop (close the context; the .webm is flushed, then renamed to the stable
//     committed-artifact path test-results/e22-vod-demo.webm).
//
// The whole arc drives PRODUCTION code only (the real footer demo connect builds
// the demo channels + synthesizes the offline movie, rndToggle reveals the Movies
// option, onToggle/goMode switches modes and re-renders via rndMode2, onGridClick
// routes the [data-id] movie card to the real goPlay select+play path, the demo
// movie's url is a public HLS test stream played as-is). It ASSERTS the
// demonstrated behavior along the way so the recording is a real demonstration,
// not a blind drive — reusing copy / structure from specs/vod-library.md.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e22-vod-demo.webm');
const BASE_URL     = 'http://localhost:3000';

// The synthesized offline demo movie (specs/vod-library.md §6, asserted in
// vod.test.js TASK-0082): id demo-vod-1, name "Demo Movie", url is a public HLS
// test stream so playback works with NO live Xtream portal.
const DEMO_MOV_ID   = 'demo-vod-1';
const DEMO_MOV_NAME = 'Demo Movie';

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
// BOOT — fresh load of the running product. The app starts idle, no source
// connected, so no cards exist and the content toggle shows only Live (Movies
// and Series are contextual — hidden until a source has VOD, ADR-0038 §5a).
// ---------------------------------------------------------------------------
test('boot: app loads fresh with only the Live toggle option', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('.ch-card')).toHaveCount(0);
  await expect(page.locator('#content-toggle [data-mode="live"]')).toBeVisible();
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toBeHidden();
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login. The demo connect
// flow loads the demo live channels AND synthesizes the one offline-playable VOD
// movie (specs/vod-library.md §6), then rndToggle reveals the Movies option in
// the content toggle. Series stays hidden (the demo synthesizes no series).
// ---------------------------------------------------------------------------
test('prepare: connect demo mode so the synthesized VOD movie surfaces the Movies tab', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });

  // The best-effort demo VOD synthesis fills one movie, then rndVod reveals Movies.
  await page.locator('#content-toggle [data-mode="movies"]').waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toBeVisible();
  await expect(page.locator('#content-toggle [data-mode="series"]')).toBeHidden();
  // Default mode is live: Live is active and the live grid is showing.
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveClass(/active/);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — switch the content toggle to Movies. onToggle -> goMode flips the
// active mode and rndMode2 re-renders the sidebar/grid from the movie set
// (rndSide/rndGrid/getChs reused unchanged — a Vod item is Ch-compatible). The
// synthesized movie poster card is browsed: exactly one movie card shows, named
// "Demo Movie", carrying no live-only affordances (NOW/NEXT, Remind, Replay)
// because the VOD id has no EPG entries (specs/vod-library.md §5a, §5c).
// ---------------------------------------------------------------------------
test('interact: switching to Movies browses the synthesized movie poster card', async function () {
  await page.click('#content-toggle [data-mode="movies"]');

  // Movies becomes the active, aria-pressed option; Live releases (R-0001 —
  // aria-pressed is present in the baseline and only flipped between values).
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toHaveClass(/active/);
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveAttribute('aria-pressed', 'false');

  // The grid re-renders from the movie set: the one synthesized demo movie card.
  const card = page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(1);
  await expect(card.locator('.ch-name')).toHaveText(DEMO_MOV_NAME);
  // VOD cards carry no live-only affordances.
  await expect(card.locator('.ch-nn')).toHaveCount(0);
  await expect(card.locator('[data-rem]')).toHaveCount(0);
  await expect(card.locator('[data-replay]')).toHaveCount(0);
  await dwell(1400);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — play the synthesized VOD movie. onGridClick routes the [data-id]
// movie card click to the real goPlay, which drives the EXISTING select+play path
// (setCur -> saveSt('sel') -> go('PLAY') when READY -> rndHead -> loadPlay(url))
// — exactly like a live card click. The movie plays through the normal
// dual-engine player: the app enters PLAY, body gains is-play, #now-info shows
// the movie, and the player video is shown. The demo movie's url is a public HLS
// test stream, so on-demand playback works with no live Xtream portal
// (specs/vod-library.md §5c, §6).
// ---------------------------------------------------------------------------
test('interact: selecting the synthesized movie plays it through the existing player', async function () {
  const card = page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]');
  await card.click();

  // The existing select+play path ran: READY -> PLAY. The movie plays through the
  // normal player surface — body gains is-play, the player video is shown over the
  // idle placeholder, and #now-info names the on-demand item (rndHead reads ST.cur,
  // set by goPlay's setCur).
  await expect(page.locator('body')).toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText(DEMO_MOV_NAME);
  await expect(page.locator('#player-video')).toBeVisible();
  await expect(page.locator('#player-idle')).toBeHidden();
  await dwell(1800);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// stop the playback the movie started, switch the content toggle back to Live,
// clear the current item / search / filter, re-render so the live grid returns,
// and reach the idle condition. (Not a git revert — the product's own runtime
// state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting Live / idle condition', async function () {
  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
    // Walk the phase back to a non-PLAY idle condition through legal transitions
    // (PHASES §6): PLAY -> READY (idle player overlay), or ERR -> INIT.
    if (window.IptvSt.ST.phase === 'PLAY') window.IptvSt.go('READY');
    if (window.IptvSt.ST.phase === 'ERR')  window.IptvSt.go('INIT');
    window.IptvSt.setSrch('');
    window.IptvSt.setFlt('all');
    // Switch the content toggle back to Live (in-app reset of the render-mode
    // flag) and re-render the sidebar/grid from the live set.
    window.IptvUi.setCMode('live');
    window.IptvUi.rndToggle();
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });

  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
  // The toggle is back on Live and the live grid is showing again.
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]')).toHaveCount(0);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the recorder is
// active so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  await expect(page.video()).not.toBeNull();
});
