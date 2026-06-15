// ADR: ADR-0034
// UI demo recording (TASK-0071) — single end-to-end video of the program-reminder
// arc: set a Remind toggle on an upcoming program, let it FIRE into an in-app
// toast (with a best-effort, permission-gated browser Notification fired in the
// mocked-granted branch), jump to the reminded channel via the toast's Watch
// action, and clear the reminder individually (specs/reminders.md §3–§6, §8,
// ADR-0033 toggle + ADR-0034 firing surface). Video capture is scoped to THIS
// spec only (a per-spec browser context with recordVideo on), never the global
// UI suite, so the rest of the suite stays fast and records nothing (mirroring
// src/tests/ui/epg-demo.test.js + log-demo.test.js).
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (a mocked-granted Notification is installed before page scripts so
//     the best-effort granted branch is exercised without a real OS prompt, then
//     demo mode is connected through the real footer login so the demo connect
//     flow generates the synthetic in-memory guide and re-renders the grid, so
//     each card shows a NOW/NEXT line whose NEXT carries a Remind toggle)
//  -> interact (focus + keyboard-activate the NEXT Remind toggle and ASSERT
//     aria-pressed flips to "true" WITHOUT playing or expanding; let that
//     reminder FIRE through the exact firing path the timer uses
//     (window.IptvUi.fireRem) and ASSERT the in-app toast appears in the aria-live
//     region carrying the program title, a Watch/Jump action, and a dismiss
//     control, and that the mocked-granted Notification fired; activate the
//     toast's Watch action and ASSERT the reminded channel plays (READY->PLAY,
//     #now-info shows the channel) and the toast dismisses; then clear the
//     reminder individually via its toggle and ASSERT aria-pressed flips back to
//     "false")
//  -> revert runtime state (clear any stored reminders, stop playback, clear the
//     current channel + search + filter, return to the pre-interaction idle
//     condition — an in-app teardown, never a git revert)
//  -> stop (close the context; the .webm is flushed, then renamed to a stable
//     committed-artifact path).
//
// The whole arc drives PRODUCTION code only (the real footer demo connect, the
// real Remind toggle handler, the real fireRem firing surface the timer calls,
// the real toast Watch select+play path) and ASSERTS the demonstrated behavior
// along the way, so the recording is a real demonstration, not a blind drive —
// reusing copy / structure from specs/reminders.md §3–§6.

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

// chId + start of the first card's NEXT (upcoming) program — the program the
// Remind toggle marks — captured in PREPARE and reused by the firing steps.
let remChId  = null;
let remStart = 0;
let chName   = '';

test.beforeAll(async function setup() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  browser = await chromium.launch();
  context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: ARTIFACT_DIR, size: { width: 1280, height: 800 } },
  });
  // Install a granted Notification stub BEFORE the page scripts load, capturing
  // every construction on window.__notes so the best-effort granted branch is
  // observable without a real OS prompt (mirrors reminders.test.js connectDemoNoted).
  await context.addInitScript(function stubNote() {
    window.__notes = [];
    function StubNote(title, opts) { window.__notes.push({ title, opts }); }
    StubNote.permission = 'granted';
    StubNote.requestPermission = function requestPermission() { return Promise.resolve('granted'); };
    window.Notification = StubNote;
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
// yet, so no cards, no now/next lines, no Remind toggles, no toasts.
// ---------------------------------------------------------------------------
test('boot: app loads fresh from a clean start with no guide yet', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('.ch-card')).toHaveCount(0);
  await expect(page.locator('.ch-rem')).toHaveCount(0);
  await expect(page.locator('#rem-toasts .rem-toast')).toHaveCount(0);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login. The demo connect
// flow loads the demo channels AND generates the synthetic in-memory guide
// spanning Date.now(), then re-renders the grid so each card carries a NOW/NEXT
// line (with a Remind toggle on the upcoming NEXT program). Capture the NEXT
// program's identity for the firing steps.
// ---------------------------------------------------------------------------
test('prepare: connect demo mode so channels + the synthetic guide render', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().locator('.ch-nn').waitFor({ state: 'visible', timeout: 5000 });

  const card = page.locator('.ch-card').first();
  const rem  = card.locator('.ch-nn .ch-rem');
  await expect(rem).toHaveCount(1);

  // Resolve the upcoming program's identity from the toggle (chId|start).
  const key = await rem.getAttribute('data-rem');
  const cut = key.lastIndexOf('|');
  remChId  = key.slice(0, cut);
  remStart = Number(key.slice(cut + 1));
  chName   = (await card.locator('.ch-name').textContent()).trim();
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — focus + keyboard-activate the NEXT Remind toggle on the upcoming
// program. aria-pressed flips to "true" and the label flips to the clear form;
// playback never starts and the card does not expand (the toggle never bubbles
// to select/play — specs/reminders.md §3–§4).
// ---------------------------------------------------------------------------
test('interact: set a Remind on the upcoming program — aria-pressed flips true', async function () {
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
});

// ---------------------------------------------------------------------------
// INTERACT 2 — the reminder FIRES. Drive the exact firing path the client timer
// uses on a newly-due reminder (window.IptvUi.fireRem, ADR-0034 §5; the timer in
// main.js calls fire(due[i]) for each due reminder). The in-app toast appears in
// the aria-live region carrying the program title, a Watch/Jump action, and a
// dismiss control; the best-effort permission-gated Notification fires in the
// mocked-granted branch (observable on window.__notes), no real OS prompt.
// ---------------------------------------------------------------------------
test('interact: the reminder FIRES into an in-app toast + a granted Notification', async function () {
  await page.evaluate(function fire(r) {
    window.IptvUi.fireRem({ chId: r.chId, start: r.start, title: r.title });
  }, { chId: remChId, start: remStart, title: 'World News 24 — Headlines' });

  const toast = page.locator('#rem-toasts .rem-toast');
  await expect(toast).toHaveCount(1);
  await expect(toast.locator('.rem-toast-title')).toHaveText('World News 24 — Headlines');
  await expect(toast.locator('.rem-toast-watch')).toHaveCount(1);
  await expect(toast.locator('.rem-toast-close')).toHaveCount(1);
  // The toast is announced to assistive tech via the aria-live region (§8).
  await expect(page.locator('#rem-toasts')).toHaveAttribute('aria-live', 'polite');

  // The best-effort granted Notification branch was exercised (mocked, no prompt).
  const noteCount = await page.evaluate(function notes() { return window.__notes.length; });
  expect(noteCount).toBe(1);
  await dwell(1500);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — JUMP. Activate the toast's Watch/Jump action: it resolves the Ch
// from ST.chs by chId and reuses the EXISTING select+play path (setCur +
// saveSt('sel') + go('PLAY')), exactly like a card click (ADR-0034 §6,
// specs/reminders.md §6). The reminded channel plays (READY->PLAY, #now-info
// shows the channel) and the toast dismisses.
// ---------------------------------------------------------------------------
test('interact: the toast Watch action jumps to + plays the reminded channel', async function () {
  const toast = page.locator('#rem-toasts .rem-toast');
  await expect(toast).toHaveCount(1);

  await toast.locator('.rem-toast-watch').click();
  await expect(page.locator('body')).toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText(chName);
  await expect(page.locator('#rem-toasts .rem-toast')).toHaveCount(0);
  await dwell(1500);
});

// ---------------------------------------------------------------------------
// INTERACT 4 — clear the reminder INDIVIDUALLY. The reminder set in INTERACT 1 is
// still stored (firing the toast directly does not touch the toggle DOM), so the
// NEXT toggle still reads set (aria-pressed "true"). Clearing an individual
// reminder is the same toggle pressed in its set state (specs/reminders.md §4):
// pressing it once removes that one reminder and flips aria-pressed back to
// "false" with the label flipping back to the set form.
// ---------------------------------------------------------------------------
test('interact: clearing a reminder individually flips aria-pressed back to false', async function () {
  const rem = page.locator('.ch-card').first().locator('.ch-nn .ch-rem');
  await rem.scrollIntoViewIfNeeded();
  // The reminder set earlier is still on (the toggle reflects the live store).
  await expect(rem).toHaveAttribute('aria-pressed', 'true');
  await rem.focus();
  await dwell(700);

  // Press once: the individual reminder clears, aria-pressed flips to "false".
  await rem.press('Enter');
  await expect(rem).toHaveAttribute('aria-pressed', 'false');
  await expect(rem).toHaveAttribute('aria-label', /^Remind me when /);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// clear any stored reminders, stop the playback the jump started, clear the
// current channel / search / filter, and return to the idle condition (an in-app
// teardown, never a git revert).
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
  await expect(page.locator('#rem-toasts .rem-toast')).toHaveCount(0);
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
