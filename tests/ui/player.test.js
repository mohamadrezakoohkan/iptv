// ADR: ADR-0004, ADR-0023
// UI tests — Player component idle/play/error DOM state for TASK-0007, plus the
// guided no-signal idle + stream-error placeholders with retry (TASK-0045).
// Full live-stream playback is not testable in headless Playwright without
// a real stream — tests verify DOM state + placeholder rendering only.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper: navigate and initialise EL registry
// ---------------------------------------------------------------------------
async function setup(page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
  });
}

// ---------------------------------------------------------------------------
// Initial idle state — before any channel is selected
// ---------------------------------------------------------------------------
test('player-idle overlay is visible on page load', async function ({ page }) {
  await setup(page);
  const idle = page.locator('#player-idle');
  await expect(idle).toBeVisible();
});

test('player-card has class player-idle before any channel is selected', async function ({ page }) {
  await setup(page);
  const card = page.locator('#player-card');
  await expect(card).toHaveClass(/player-idle/);
});

test('video element is hidden before any channel is selected', async function ({ page }) {
  await setup(page);
  const vid = page.locator('#player-video');
  await expect(vid).toBeHidden();
});

test('player-err overlay is hidden in idle state', async function ({ page }) {
  await setup(page);
  const err = page.locator('#player-err');
  await expect(err).toBeHidden();
});

// ---------------------------------------------------------------------------
// PLAY phase — rndPhase() hides idle, shows video
// ---------------------------------------------------------------------------
test('rndPhase() in PLAY phase hides player-idle', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.go('PLAY');
    window.IptvUi.rndPhase();
  });
  const idle = page.locator('#player-idle');
  await expect(idle).toBeHidden();
});

test('rndPhase() in PLAY phase shows video element', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.go('PLAY');
    window.IptvUi.rndPhase();
  });
  const vid = page.locator('#player-video');
  await expect(vid).toBeVisible();
});

test('rndPhase() in PLAY phase removes player-idle class from player-card', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.go('PLAY');
    window.IptvUi.rndPhase();
  });
  const card = page.locator('#player-card');
  await expect(card).not.toHaveClass(/player-idle/);
});

// ---------------------------------------------------------------------------
// ERR phase with cur set — player-err overlay visible
// ---------------------------------------------------------------------------
test('rndPhase() in ERR phase with cur set shows player-err overlay', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'Test Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.setErr('bufferStalledError');
    window.IptvSt.go('ERR');
    window.IptvUi.rndPhase();
  });
  const err = page.locator('#player-err');
  await expect(err).toBeVisible();
});

test('player-err overlay keeps the raw engine token as a dimmed detail line', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'Test Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.setErr('bufferStalledError');
    window.IptvSt.go('ERR');
    window.IptvUi.rndPhase();
  });
  const detail = page.locator('#player-err .sig-detail');
  await expect(detail).toHaveText('bufferStalledError');
});

// ---------------------------------------------------------------------------
// Idle placeholder guidance (TASK-0045, specs/empty-states.md §3a)
// ---------------------------------------------------------------------------
test('idle placeholder shows the "NO SIGNAL" title and a guidance line', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () { window.IptvUi.rndPhase(); });
  const idle = page.locator('#player-idle');
  await expect(idle).toContainText('NO SIGNAL');
  await expect(idle).toContainText('to start watching');
});

test('idle placeholder offers a Connect a source action with no session', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () { window.IptvUi.rndPhase(); });
  const connect = page.locator('#player-idle button[data-sig-act="connect"]');
  await expect(connect).toBeVisible();
  await expect(connect).toHaveText('Connect a source');
  await connect.focus();
  await expect(connect).toBeFocused();
});

// ---------------------------------------------------------------------------
// Stream-error placeholder + Retry (TASK-0045, specs/empty-states.md §3b)
// ---------------------------------------------------------------------------
test('stream-error placeholder shows the human-readable headline and a focusable Retry button', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'Test Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.setErr('MPEG-TS not supported');
    window.IptvSt.go('ERR');
    window.IptvUi.rndPhase();
  });
  const err = page.locator('#player-err');
  await expect(err).toContainText("This channel won't play");
  await expect(err).toContainText('The stream could not be loaded');
  // the friendly body is NOT the raw engine token; the raw token survives only
  // in the dimmed secondary detail line (specs/empty-states.md §3b).
  await expect(page.locator('#player-err .sig-body')).not.toContainText('MPEG-TS not supported');
  await expect(page.locator('#player-err .sig-detail')).toHaveText('MPEG-TS not supported');
  const retry = page.locator('#player-err button[data-sig-act="retry"]');
  await expect(retry).toBeVisible();
  await expect(retry).toHaveText('Retry');
  await retry.focus();
  await expect(retry).toBeFocused();
});

test('player-idle carries role=status and player-err carries role=alert', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#player-idle')).toHaveAttribute('role', 'status');
  await expect(page.locator('#player-err')).toHaveAttribute('role', 'alert');
});

// ---------------------------------------------------------------------------
// Screenshots of each player placeholder for the PR Test Results block
// ---------------------------------------------------------------------------
test('capture idle and stream-error player placeholders', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () { window.IptvUi.rndPhase(); });
  await page.locator('#player-card').screenshot({ path: 'test-results/task-0045-player-idle.png' });
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'Test Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.setErr('mediaError');
    window.IptvSt.go('ERR');
    window.IptvUi.rndPhase();
  });
  await page.locator('#player-card').screenshot({ path: 'test-results/task-0045-player-error.png' });
});

// ---------------------------------------------------------------------------
// ERR phase with cur = null — player-err overlay remains hidden
// ---------------------------------------------------------------------------
test('rndPhase() in ERR phase with cur null keeps player-err hidden', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('ERR');
    window.IptvSt.setErr('networkError');
    window.IptvUi.rndPhase();
  });
  const err = page.locator('#player-err');
  await expect(err).toBeHidden();
});

// ---------------------------------------------------------------------------
// window.IptvPlay is exported
// ---------------------------------------------------------------------------
test('window.IptvPlay is exported with mkPlay, loadPlay, stopPlay', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const ok = await page.evaluate(function () {
    return (
      typeof window.IptvPlay !== 'undefined' &&
      typeof window.IptvPlay.mkPlay    === 'function' &&
      typeof window.IptvPlay.loadPlay  === 'function' &&
      typeof window.IptvPlay.stopPlay  === 'function'
    );
  });
  expect(ok).toBe(true);
});
