// ADR: ADR-0004
// UI tests — Player component idle/play/error DOM state for TASK-0007.
// Full live-stream playback is not testable in headless Playwright without
// a real stream — tests verify DOM state transitions only.

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

test('player-err overlay shows the error message text', async function ({ page }) {
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
  await expect(err).toHaveText('bufferStalledError');
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
