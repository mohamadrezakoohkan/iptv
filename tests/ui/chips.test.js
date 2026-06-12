// ADR: ADR-0010
// UI tests — HLS/TS format chips + dual-engine error overlay for TASK-0023.
// Live TS playback is proven by integration tests in TASK-0024; here the
// mpegts global is stubbed where needed.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper: navigate, init EL registry + player video element
// ---------------------------------------------------------------------------
async function setup(page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    window.IptvPlay.mkPlay(document.getElementById('player-video'));
  });
}

// ---------------------------------------------------------------------------
// Baseline — chips rendered, enabled, neither active
// ---------------------------------------------------------------------------
test('HLS and TS chips are rendered in the content-head', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#chip-hls')).toBeVisible();
  await expect(page.locator('#chip-ts')).toBeVisible();
  await expect(page.locator('#chip-hls')).toHaveText('HLS');
  await expect(page.locator('#chip-ts')).toHaveText('TS');
});

test('chips are not rendered disabled', async function ({ page }) {
  await setup(page);
  // R-0001: baseline index.html chips carry no disabled attribute or class
  await expect(page.locator('#chip-hls')).not.toHaveAttribute('disabled');
  await expect(page.locator('#chip-ts')).not.toHaveAttribute('disabled');
  await expect(page.locator('#chip-hls')).not.toHaveClass(/disabled/);
  await expect(page.locator('#chip-ts')).not.toHaveClass(/disabled/);
});

test('neither chip is active before playback starts', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#chip-hls')).not.toHaveClass(/active/);
  await expect(page.locator('#chip-ts')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// Engine selection — chips reflect the engine in use
// ---------------------------------------------------------------------------
test('loading a .m3u8 url highlights the HLS chip only', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.go('PLAY');
    window.IptvPlay.loadPlay('http://stream.test/live.m3u8');
  });
  await expect(page.locator('#chip-hls')).toHaveClass(/active/);
  await expect(page.locator('#chip-ts')).not.toHaveClass(/active/);
});

test('loading a .ts url highlights the TS chip only', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.mpegts = {
      Events: { ERROR: 'tsError' },
      getFeatureList: function () { return { mseLivePlayback: true }; },
      createPlayer: function () {
        return {
          attachMediaElement: function () {},
          on:      function () {},
          load:    function () {},
          play:    function () { return Promise.resolve(); },
          destroy: function () {},
        };
      },
    };
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.go('PLAY');
    window.IptvPlay.loadPlay('http://stream.test/live/u/p/1.ts');
  });
  await expect(page.locator('#chip-ts')).toHaveClass(/active/);
  await expect(page.locator('#chip-hls')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// Demo mode — connect + select channel, HLS chip active
// ---------------------------------------------------------------------------
test('demo mode playback activates the HLS chip', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible();
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#chip-hls')).toHaveClass(/active/);
  await expect(page.locator('#chip-ts')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// Error overlay — unsupported MPEG-TS engine
// ---------------------------------------------------------------------------
test('unsupported mpegts shows the error overlay', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.mpegts = {
      Events: { ERROR: 'tsError' },
      getFeatureList: function () { return { mseLivePlayback: false }; },
      createPlayer: function () {},
    };
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'TS Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.go('PLAY');
    window.IptvPlay.loadPlay('http://stream.test/live/u/p/1.ts');
  });
  const err = page.locator('#player-err');
  await expect(err).toBeVisible();
  await expect(err).toHaveText('MPEG-TS not supported');
});

// ---------------------------------------------------------------------------
// Error overlay — fatal mpegts engine error mid-playback
// ---------------------------------------------------------------------------
test('fatal mpegts error shows the error overlay', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    let errCb = null;
    window.mpegts = {
      Events: { ERROR: 'tsError' },
      getFeatureList: function () { return { mseLivePlayback: true }; },
      createPlayer: function () {
        return {
          attachMediaElement: function () {},
          on:      function (evt, cb) { if (evt === 'tsError') errCb = cb; },
          load:    function () {},
          play:    function () { return Promise.resolve(); },
          destroy: function () {},
        };
      },
    };
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'TS Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.go('PLAY');
    window.IptvPlay.loadPlay('http://stream.test/live/u/p/1.ts');
    errCb('NetworkError', 'Exception');
  });
  const err = page.locator('#player-err');
  await expect(err).toBeVisible();
  await expect(err).toHaveText('Exception');
});

// ---------------------------------------------------------------------------
// mpegts.js library is loaded from CDN
// ---------------------------------------------------------------------------
test('window.mpegts is available on page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const ok = await page.evaluate(function () {
    return typeof window.mpegts !== 'undefined'
      && typeof window.mpegts.createPlayer === 'function'
      && typeof window.mpegts.getFeatureList === 'function';
  });
  expect(ok).toBe(true);
});
