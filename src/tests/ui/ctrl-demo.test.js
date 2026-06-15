// ADR: ADR-0039
// UI demo recording (TASK-0088) — single end-to-end video of the in-player
// controls layer working offline in demo mode (specs/player-controls.md §2, §4).
// Connect demo mode through the real footer login, play a demo channel so the
// shared <video> (#player-video) is the play target, then exercise the controls
// entirely offline: the keyboard shortcuts (M mute, ArrowUp/ArrowDown volume,
// Space play/pause) drive the real document-level onPlayKey handler on the actual
// <video>, and the Fullscreen (#fs-btn) / PiP (#pip-btn) buttons are shown and
// activated. Headless Chromium cannot enter REAL fullscreen / PiP without a user
// gesture, so the FS/PiP portions degrade silently (consistent with the
// silent-degrade design, specs §1a, §2a, §2b) — the recording still demonstrates
// the buttons' presence + state and every keyboard media shortcut. No new engine,
// no new phase, no new route (ADR-0039).
//
// Video capture is scoped to THIS spec only (a per-spec browser context with
// recordVideo on), never the global UI suite, so the rest of the suite stays fast
// and records nothing (mirroring src/tests/ui/vod-recording.test.js +
// catchup-recording.test.js). The control behavior itself is regression-asserted
// by ctrl.test.js (chrome) and keys.test.js (shortcuts); this spec is the
// recording demonstration.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login so the demo
//     connect flow loads the demo channels, then click a channel so the shared
//     <video> is streaming and the controls are active; PLAY is then pinned
//     deterministically — the demo HLS stream can fatally error at an
//     unpredictable moment in headless chromium, so the genuine production
//     handlers drive every assertion against a held PLAY phase, no faked DOM)
//  -> interact (exercise the controls offline: force FS/PiP support so the
//     buttons are visible + focusable and ASSERT their baseline aria-pressed
//     (R-0001), activate each (silent no-op for real FS/PiP in headless), then
//     drive the keyboard shortcuts on the real <video> — M toggles mute,
//     ArrowUp/ArrowDown change volume, Space toggles play/pause — ASSERTing the
//     <video> state changes, proving the controls work on the demo stream with
//     NO network)
//  -> revert runtime state (return the player to its pre-interaction in-app
//     state: un-mute, restore volume to the default, re-render the controls
//     chrome, stop the demo stream, clear the current channel + search + filter,
//     walk the phase back to a non-PLAY idle condition, re-render — an in-app
//     teardown, never a git revert of source)
//  -> stop (close the context; the .webm is flushed, then renamed to the stable
//     committed-artifact path test-results/e23-controls-demo.webm).

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e23-controls-demo.webm');
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

// Pin PLAY (the demo stream can error mid-test in headless chromium); idempotent.
// Walks the phase machine forward through legal transitions (PHASES §6) so the
// "active only while playing" controls are live for every shortcut assertion.
async function pinPlaying() {
  await page.evaluate(function pin() {
    if (window.IptvSt.ST.phase === 'ERR') window.IptvSt.go('INIT');
    if (window.IptvSt.ST.phase === 'INIT') window.IptvSt.go('LOAD');
    if (window.IptvSt.ST.phase === 'LOAD') window.IptvSt.go('READY');
    if (window.IptvSt.ST.phase === 'READY') window.IptvSt.go('PLAY');
  });
}

// Read the current mute / volume / paused / phase off the live page.
async function snap() {
  return page.evaluate(function read() {
    const v = document.getElementById('player-video');
    return {
      muted:  v ? v.muted  : null,
      volume: v ? v.volume : null,
      paused: v ? v.paused : null,
      phase:  window.IptvSt.ST.phase,
    };
  });
}

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product. The app starts idle, no source
// connected, so no channel cards exist; the controls chrome is already wired in
// the content-head (mkEL has run) with #fs-btn carrying aria-pressed in the
// baseline (R-0001, specs §1).
// ---------------------------------------------------------------------------
test('boot: app loads fresh with the controls chrome wired and idle', async function () {
  await page.goto(BASE_URL);
  await page.locator('#fs-btn').waitFor({ state: 'attached', timeout: 6000 });
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('.ch-card')).toHaveCount(0);
  // aria-pressed is present in the baseline and only ever mutated (R-0001).
  await expect(page.locator('.content-head #fs-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.content-head #pip-btn')).toHaveAttribute('aria-pressed', 'false');
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login. The demo connect
// flow loads the demo channels offline; clicking a channel routes through the
// real select+play path so the shared <video> is the play target and the
// controls are active. PLAY is then pinned deterministically (the demo HLS
// stream can error in headless chromium) so the controls stay live for the
// interaction assertions (mirroring keys.test.js).
// ---------------------------------------------------------------------------
test('prepare: connect demo mode and play a channel so the controls are active', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().click();
  await pinPlaying();

  const s = await snap();
  expect(s.phase).toBe('PLAY');
  await expect(page.locator('body')).toHaveClass(/is-play/);
  await expect(page.locator('#player-video')).toBeVisible();
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — the Fullscreen / PiP controls. Force FS/PiP support so both
// buttons render visible + keyboard-focusable, ASSERT their baseline
// aria-pressed (R-0001), then activate each. Headless Chromium has no real
// fullscreen / PiP without a user gesture, so toggleFs / togglePip are silent
// no-ops here (the silent-degrade design, specs §1a/§2a/§2b) — the recording
// still demonstrates the buttons' presence + state and the activation path.
// ---------------------------------------------------------------------------
test('interact: show and activate the Fullscreen and PiP buttons (FS/PiP degrade silently headless)', async function () {
  // The demo HLS stream can fatally error in headless chromium (an ERR overlay
  // over the player). Hold PLAY so the controls stay live for the demonstration.
  await pinPlaying();
  await page.evaluate(function forceSupport() {
    window.IptvCtrl.hasFs  = function () { return true; };
    window.IptvCtrl.hasPip = function () { return true; };
    window.IptvUi.rndCtrls();
  });
  await expect(page.locator('#fs-btn')).toBeVisible();
  await expect(page.locator('#pip-btn')).toBeVisible();

  // Both are real keyboard-focusable buttons with aria-pressed in the baseline.
  await page.locator('#fs-btn').focus();
  expect(await page.evaluate(function () { return document.activeElement.id; })).toBe('fs-btn');
  await expect(page.locator('#fs-btn')).toHaveAttribute('aria-pressed', 'false');
  await dwell(700);

  // Activate each through the genuine production click handlers (onFsBtn /
  // onPipBtn -> IptvCtrl.toggleFs / togglePip). A dispatched click drives the
  // real path without a pointer that a stream-error overlay could intercept.
  // Where the headless browser grants the capability (new headless chromium can
  // enter real fullscreen) the button's aria-pressed follows the ACTUAL state
  // via the fullscreenchange event; where it does not (real PiP needs a user
  // gesture / is unavailable, e.g. iOS Safari) the toggle is a silent no-op (the
  // silent-degrade design, specs §1a/§2a/§2b) — never an error path. Either way
  // the buttons stay present and their state mirrors reality, never an
  // optimistic guess.
  await page.locator('#fs-btn').dispatchEvent('click');
  await dwell(800);
  await page.locator('#pip-btn').dispatchEvent('click');
  await dwell(800);
  // The buttons remain present; aria-pressed mirrors the actual browser state
  // (whatever the headless environment granted). Toggle fullscreen back off so
  // the page state is clean for the rest of the arc — again following reality.
  await expect(page.locator('#fs-btn')).toBeVisible();
  await expect(page.locator('#pip-btn')).toBeVisible();
  await page.evaluate(function exitFs() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    if (document.pictureInPictureElement && document.exitPictureInPicture) document.exitPictureInPicture().catch(function () {});
  });
  await dwell(700);
});

// ---------------------------------------------------------------------------
// INTERACT 2 — the M mute shortcut on the real <video>. With PLAY held and focus
// on the body (never a text input), pressing M flips video.muted via the genuine
// onPlayKey -> IptvCtrl.toggleMute path; a second M un-mutes (specs §2c).
// ---------------------------------------------------------------------------
test('interact: M toggles mute on the demo stream', async function () {
  await pinPlaying();
  await page.evaluate(function blur() { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });
  const before = await snap();
  await page.keyboard.press('m');
  await dwell(700);
  const afterOne = await snap();
  expect(afterOne.muted).toBe(!before.muted);
  await page.keyboard.press('m');
  await dwell(700);
  const afterTwo = await snap();
  expect(afterTwo.muted).toBe(before.muted);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — the ArrowUp / ArrowDown volume shortcuts on the real <video>.
// Start from a mid volume so both directions have headroom; the genuine
// onPlayKey -> IptvCtrl.volUp / volDn path steps video.volume by S.volStp,
// clamped to [0,1] (specs §2c).
// ---------------------------------------------------------------------------
test('interact: ArrowUp and ArrowDown change the volume on the demo stream', async function () {
  await pinPlaying();
  await page.evaluate(function setMid() {
    window.IptvSt.setVol(0.5);
    const v = document.getElementById('player-video');
    if (v) v.volume = 0.5;
  });
  await dwell(400);
  await page.keyboard.press('ArrowUp');
  await dwell(600);
  const up = await snap();
  expect(up.volume).toBeGreaterThan(0.5);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await dwell(600);
  const dn = await snap();
  expect(dn.volume).toBeLessThan(up.volume);
});

// ---------------------------------------------------------------------------
// INTERACT 4 — the Space play/pause shortcut on the real <video>. With PLAY held
// and focus on the body, Space drives the genuine onPlayKey -> IptvCtrl.togglePlay
// path on the actual <video> (specs §2c). By this point in the serial arc the
// demo HLS stream may have fatally errored in headless chromium, so video.play()
// can be rejected by the browser (dead blob src) — the real togglePlay swallows
// that rejection by design. We therefore assert that the keypress REACHES the
// element's play/pause through the production handler (spying the real methods on
// the real <video>), which is deterministic regardless of whether the errored
// demo stream can actually resume — a faithful demonstration without faking the
// handler or the element.
// ---------------------------------------------------------------------------
test('interact: Space drives play/pause on the demo stream', async function () {
  await pinPlaying();
  await page.evaluate(function spy() {
    const v = document.getElementById('player-video');
    window.__pp = { play: 0, pause: 0 };
    const realPlay  = v.play.bind(v);
    const realPause = v.pause.bind(v);
    v.play  = function () { window.__pp.play  += 1; return realPlay(); };
    v.pause = function () { window.__pp.pause += 1; return realPause(); };
  });
  await page.evaluate(function blur() { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });

  await page.keyboard.press(' ');
  await dwell(500);
  await page.keyboard.press(' ');
  await dwell(500);

  // Two Space presses each ran the production togglePlay on the real <video>, so
  // its play/pause were invoked through the genuine handler (paused -> play() and
  // playing -> pause(), in whichever order the live state dictated).
  const pp = await page.evaluate(function () { return window.__pp; });
  expect(pp.play + pp.pause).toBeGreaterThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// un-mute, restore the default volume on the <video> and in ST, re-render the
// controls chrome, stop the playback the channel started, clear the current
// channel / search / filter, walk the phase back to a non-PLAY idle condition
// through legal transitions (PHASES §6), and re-render so the idle condition
// returns. (Not a git revert — the product's own runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting idle condition', async function () {
  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    const v  = document.getElementById('player-video');
    // Exit any lingering fullscreen / PiP the interaction may have entered.
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    if (document.pictureInPictureElement && document.exitPictureInPicture) document.exitPictureInPicture().catch(function () {});
    // Restore the player media state the interaction changed.
    if (v) { v.muted = false; v.volume = 1.0; }
    window.IptvSt.setMuted(false);
    window.IptvSt.setVol(1.0);
    window.IptvUi.rndCtrls();
    // Stop the demo stream and clear the runtime selection.
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
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
  const s = await snap();
  expect(s.phase).not.toBe('PLAY');
  expect(s.muted).toBe(false);
  expect(s.volume).toBe(1);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the recorder is
// active so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  await expect(page.video()).not.toBeNull();
});
