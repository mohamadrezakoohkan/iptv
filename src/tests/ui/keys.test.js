// ADR: ADR-0039
// UI tests — player keyboard shortcuts (TASK-0087, specs/player-controls.md
// §2c). On the running page, in demo playback (ST.phase === 'PLAY'), the
// document-level onPlayKey handler maps M → mute toggle, ArrowUp/ArrowDown →
// volume, Space → play/pause, delegating to IptvCtrl on the resolved <video>.
// It must NOT fire when the user is typing in the search input, must NOT fire
// before a stream is playing, and must NEVER intercept Escape (the onAcctKey
// panel-close handler stays the sole Escape owner).
//
// Headless Chromium cannot reliably enter real fullscreen / PiP without a user
// gesture, so the media actions (mute / volume / play-pause) — which operate on
// the actual <video> — are exercised here; F / P delegate through the same
// onPlayKey path the unit tests cover against a mocked IptvCtrl. The demo HLS
// stream can fatally error at an unpredictable moment in headless chromium, so
// the PLAY phase is held deterministically (pinPlaying) while the genuine
// production handler (onPlayKey) drives every assertion — no faked DOM.

'use strict';

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

// Connect demo mode through the real footer login and click a channel so the
// shared <video> is the play target, then hold PLAY deterministically.
async function prepare(page) {
  await page.goto(BASE_URL);
  await page.locator('#fs-btn').waitFor({ state: 'attached', timeout: 6000 });
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().click();
}

// Pin PLAY (the demo stream can error mid-test in headless chromium); idempotent.
async function pinPlaying(page) {
  await page.evaluate(function pin() {
    if (window.IptvSt.ST.phase === 'ERR') window.IptvSt.go('INIT');
    if (window.IptvSt.ST.phase === 'INIT') window.IptvSt.go('LOAD');
    if (window.IptvSt.ST.phase === 'LOAD') window.IptvSt.go('READY');
    if (window.IptvSt.ST.phase === 'READY') window.IptvSt.go('PLAY');
  });
}

// Force a non-PLAY phase (READY) so the "active only while playing" guard is
// exercised on the running page.
async function pinReady(page) {
  await page.evaluate(function pin() {
    if (window.IptvSt.ST.phase === 'PLAY') window.IptvSt.go('READY');
    if (window.IptvSt.ST.phase === 'ERR') { window.IptvSt.go('INIT'); window.IptvSt.go('LOAD'); window.IptvSt.go('READY'); }
  });
}

// Read the current mute / volume / phase off the live page.
async function snap(page) {
  return page.evaluate(function read() {
    const v = document.getElementById('player-video');
    return { muted: v ? v.muted : null, volume: v ? v.volume : null, phase: window.IptvSt.ST.phase };
  });
}

// ---------------------------------------------------------------------------
// M toggles mute (in PLAY, body focused) — and again un-mutes.
// ---------------------------------------------------------------------------
test('M toggles mute on the <video> while playing', async function ({ page }) {
  await prepare(page);
  await pinPlaying(page);
  // ensure focus is on the body, never a text input
  await page.evaluate(function blur() { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });
  const before = await snap(page);
  await page.keyboard.press('m');
  const afterOne = await snap(page);
  expect(afterOne.muted).toBe(!before.muted);
  await page.keyboard.press('m');
  const afterTwo = await snap(page);
  expect(afterTwo.muted).toBe(before.muted);
});

// ---------------------------------------------------------------------------
// ArrowUp / ArrowDown change the volume while playing.
// ---------------------------------------------------------------------------
test('ArrowUp and ArrowDown change the volume while playing', async function ({ page }) {
  await prepare(page);
  await pinPlaying(page);
  // start from a mid volume so both directions have headroom
  await page.evaluate(function setMid() {
    window.IptvSt.setVol(0.5);
    const v = document.getElementById('player-video');
    if (v) v.volume = 0.5;
  });
  await page.keyboard.press('ArrowUp');
  const up = await snap(page);
  expect(up.volume).toBeGreaterThan(0.5);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const dn = await snap(page);
  expect(dn.volume).toBeLessThan(up.volume);
});

// ---------------------------------------------------------------------------
// Space toggles play / pause while playing.
// ---------------------------------------------------------------------------
test('Space toggles play/pause on the <video> while playing', async function ({ page }) {
  await prepare(page);
  await pinPlaying(page);
  await page.evaluate(function blur() { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });
  const before = await page.evaluate(function paused() {
    const v = document.getElementById('player-video');
    return v ? v.paused : null;
  });
  await page.keyboard.press(' ');
  // play()/pause() flips paused; allow the microtask to settle
  await page.waitForTimeout(150);
  const after = await page.evaluate(function paused() {
    const v = document.getElementById('player-video');
    return v ? v.paused : null;
  });
  expect(after).toBe(!before);
});

// ---------------------------------------------------------------------------
// Typing in the search input does NOT trigger shortcuts (no hijack).
// ---------------------------------------------------------------------------
test('typing M in the search input does not toggle mute', async function ({ page }) {
  await prepare(page);
  await pinPlaying(page);
  const before = await snap(page);
  await page.locator('#search').focus();
  await page.locator('#search').type('movie');   // contains an 'm'
  const after = await snap(page);
  expect(after.muted).toBe(before.muted);
  // the keystrokes landed in the input, not the player
  await expect(page.locator('#search')).toHaveValue('movie');
});

// ---------------------------------------------------------------------------
// A shortcut does nothing before a stream is playing (active only in PLAY).
// ---------------------------------------------------------------------------
test('M does nothing when not playing (phase READY)', async function ({ page }) {
  await prepare(page);
  await pinReady(page);
  await page.evaluate(function blur() { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });
  const before = await snap(page);
  expect(before.phase).not.toBe('PLAY');
  await page.keyboard.press('m');
  const after = await snap(page);
  expect(after.muted).toBe(before.muted);
});

// ---------------------------------------------------------------------------
// Escape collision-safety — Escape still closes an open panel and is NOT a
// player shortcut (onPlayKey never touches it).
// ---------------------------------------------------------------------------
test('Escape still closes an open account panel while playing (collision-safe)', async function ({ page }) {
  await prepare(page);
  await pinPlaying(page);
  // open the account panel
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
});
