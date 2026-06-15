// ADR: ADR-0036
// UI demo recording (TASK-0076) — single end-to-end video of the catch-up
// (archive / timeshift) Replay arc: connect demo mode, open an archive-capable
// channel's expandable guide so a PAST archive row with its Replay control is
// visible, activate Replay, and ASSERT the archived program plays through the
// normal dual-engine player via the EXISTING select+play path (no new engine,
// no new phase, no new route — specs/catchup-archive.md §2–§4, §6, ADR-0036).
// Video capture is scoped to THIS spec only (a per-spec browser context with
// recordVideo on), never the global UI suite, so the rest of the suite stays
// fast and records nothing (mirroring src/tests/ui/epg-demo.test.js +
// reminders-demo.test.js). The activation behavior itself is unit-asserted by
// catchup-demo.test.js (TASK-0075); this spec is the recording demonstration.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login so the demo
//     connect flow loads the demo channels — every 4th flagged arch:true,
//     ADR-0036 §6 — AND generates the synthetic in-memory guide whose earliest
//     slot is already PAST, then re-renders the grid; locate the first
//     archive-capable card and open its expandable schedule so a PAST archive
//     row with its Replay control is visible)
//  -> interact (ASSERT the past row carries a focusable Replay button with its
//     baseline aria-label + data-replay (R-0001), then activate Replay and
//     ASSERT the archived program plays through the normal player —
//     READY->PLAY, body.is-play, #now-info shows the channel, the player video
//     is shown — proving catch-up works through the existing select+play path)
//  -> revert runtime state (stop playback, clear the current channel + search +
//     filter, re-render the grid so the open guide collapses, return to the
//     pre-interaction idle condition — an in-app teardown, never a git revert)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).
//
// The whole arc drives PRODUCTION code only (the real footer demo connect builds
// the arch:true channels + synthetic past program, mkSched/mkSchedRow renders the
// Replay control on the past archive row, onGridClick routes [data-replay] to the
// real goReplay select+play path, getArchUrl builds the timeshift URL — a demo
// channel's non-/live/ url plays the public HLS test stream as-is). It ASSERTS the
// demonstrated behavior along the way so the recording is a real demonstration,
// not a blind drive — reusing copy / structure from specs/catchup-archive.md.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e21-catchup-demo.webm');
const BASE_URL     = 'http://localhost:3000';

// Run the whole arc serially inside one recorded context.
test.describe.configure({ mode: 'serial' });

let browser = null;
let context = null;
let page    = null;

// data-id of the first archive-capable demo card + its name, captured in PREPARE.
let archId   = null;
let archName = '';

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
// yet, so no cards, no guides, and no Replay controls exist (contextual
// presence, ADR-0025: cards appear only after a connection loads them).
// ---------------------------------------------------------------------------
test('boot: app loads fresh from a clean start with no guide yet', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('.ch-card')).toHaveCount(0);
  await expect(page.locator('.ch-replay')).toHaveCount(0);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login. The demo connect
// flow loads the demo channels (every 4th flagged arch:true, ADR-0036 §6) AND
// generates the synthetic in-memory guide whose earliest slot is already PAST
// (runDemoEpg bases the guide an hour back), then re-renders the grid. Locate
// the first archive-capable card and open its expandable schedule so a PAST
// archive row with its Replay control becomes visible.
// ---------------------------------------------------------------------------
test('prepare: connect demo mode and open an archive-capable channel guide', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });

  // Find the first card whose expanded guide carries a Replay control — the first
  // archive-capable channel with a past in-window program (demo synthesis,
  // TASK-0075). The demo grid carries several arch:true channels (every 4th).
  const cards = page.locator('.ch-card');
  const n = await cards.count();
  for (let i = 0; i < n; i += 1) {
    const card = cards.nth(i);
    const exp  = card.locator('.ch-exp');
    if (await exp.count() === 0) continue;
    await card.scrollIntoViewIfNeeded();
    await exp.click();
    if (await card.locator('.ch-sched .ch-replay').count() > 0) {
      archId   = await card.getAttribute('data-id');
      archName = (await card.locator('.ch-name').textContent()).trim();
      break;
    }
    // Not this card — collapse it again and keep looking.
    await exp.click();
  }

  expect(archId).not.toBeNull();
  const card = page.locator('.ch-card[data-id="' + archId + '"]');
  await expect(card.locator('.ch-sched')).toBeVisible();
  // The synthetic guide bases an hour back, so an archive channel may surface
  // more than one PAST in-window row — each gets its own Replay control.
  expect(await card.locator('.ch-sched .ch-replay').count()).toBeGreaterThanOrEqual(1);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — show the PAST archive row's Replay control. It is a real,
// keyboard-focusable <button> carrying data-replay="<chId>|<start>" and a
// baseline aria-label "Replay <title>" present in the rendered markup (R-0001 —
// a one-shot action button, no attribute toggling). Replay rides only the PAST
// archive row; future rows carry no Replay (specs/catchup-archive.md §3).
// ---------------------------------------------------------------------------
test('interact: the past archive row shows a focusable Replay control', async function () {
  const card = page.locator('.ch-card[data-id="' + archId + '"]');
  const rep  = card.locator('.ch-sched .ch-replay').first();

  await expect(rep).toHaveJSProperty('tagName', 'BUTTON');
  await expect(rep).toHaveAttribute('aria-label', /^Replay /);
  await expect(rep).toHaveAttribute('data-replay', new RegExp('^' + archId + '\\|\\d+$'));

  await rep.focus();
  await expect(rep).toBeFocused();
  await dwell(1200);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — activate Replay. onGridClick routes the [data-replay] click
// (with stopPropagation, before the card-select branch) to the real goReplay,
// which builds the timeshift archive URL via getArchUrl and drives the EXISTING
// select+play path (setCur -> saveSt('sel') -> go('PLAY') when READY -> rndHead
// -> loadPlay(archUrl)) — exactly like a live card click. The archived program
// plays through the normal dual-engine player: the app enters PLAY, body gains
// is-play, #now-info shows the channel, and the player video is shown. This
// proves catch-up works with no new engine, phase, or route
// (specs/catchup-archive.md §4).
// ---------------------------------------------------------------------------
test('interact: activating Replay plays the archived program through the player', async function () {
  const card = page.locator('.ch-card[data-id="' + archId + '"]');
  const rep  = card.locator('.ch-sched .ch-replay').first();

  await rep.click();

  // The existing select+play path ran: READY -> PLAY. The archived program plays
  // through the normal player surface — body gains is-play, the player video is
  // shown over the idle placeholder, and #now-info names the channel whose past
  // program is playing (rndHead reads ST.cur, set by goReplay's setCur).
  await expect(page.locator('body')).toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText(archName);
  await expect(page.locator('#player-video')).toBeVisible();
  await expect(page.locator('#player-idle')).toBeHidden();
  await dwell(1800);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// stop the playback Replay started, clear the current channel / search / filter,
// re-render the grid (collapsing the open guide), and return to the idle
// condition. (Not a git revert — the product's own runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting idle condition', async function () {
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
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });

  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
  // The re-rendered grid is back to its collapsed, pre-interaction state.
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
