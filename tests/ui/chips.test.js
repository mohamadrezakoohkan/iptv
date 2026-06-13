// ADR: ADR-0010, ADR-0012, ADR-0023, ADR-0025
// UI tests — contextual single format chip + dual-engine error overlay for
// TASK-0023 / TASK-0052. The single #fmt-chip replaces the old #chip-hls /
// #chip-ts pair (ADR-0025): hidden until a channel plays, labelled for the
// resolved engine. Live TS playback is proven by integration tests in
// TASK-0024; here the mpegts global is stubbed where needed.

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
// Baseline — single chip hidden until a channel plays (ADR-0025)
// ---------------------------------------------------------------------------
test('the single format chip is hidden in the content-head at idle', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#fmt-chip')).toBeHidden();
});

test('the chip is a focusable button, not disabled', async function ({ page }) {
  await setup(page);
  // R-0001: baseline index.html chip carries no disabled attribute or class
  await expect(page.locator('#fmt-chip')).not.toHaveAttribute('disabled');
  await expect(page.locator('#fmt-chip')).not.toHaveClass(/disabled/);
  await expect(page.locator('#fmt-chip')).toHaveJSProperty('tagName', 'BUTTON');
});

// ---------------------------------------------------------------------------
// Engine selection — the chip reflects the engine in use (ADR-0025)
// ---------------------------------------------------------------------------
test('loading a .m3u8 url shows the chip labelled HLS', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.go('PLAY');
    window.IptvUi.rndPhase();
    window.IptvPlay.loadPlay('http://stream.test/live.m3u8');
  });
  await expect(page.locator('#fmt-chip')).toBeVisible();
  await expect(page.locator('#fmt-chip')).toHaveText('HLS');
  await expect(page.locator('#fmt-chip')).toHaveClass(/active/);
});

test('loading a .ts url shows the chip labelled TS', async function ({ page }) {
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
    window.IptvUi.rndPhase();
    window.IptvPlay.loadPlay('http://stream.test/live/u/p/1.ts');
  });
  await expect(page.locator('#fmt-chip')).toBeVisible();
  await expect(page.locator('#fmt-chip')).toHaveText('TS');
  await expect(page.locator('#fmt-chip')).toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// Demo mode — connect + select channel, chip shows HLS
// ---------------------------------------------------------------------------
test('demo mode playback shows the HLS chip', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible();
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#fmt-chip')).toBeVisible();
  await expect(page.locator('#fmt-chip')).toHaveText('HLS');
});

// ---------------------------------------------------------------------------
// Error overlay — MSE-less AND the HLS fallback path cannot play (ADR-0012:
// with MSE missing the player now falls back to remuxed HLS, so the overlay
// appears only when hls.js and native HLS are both unavailable too)
// ---------------------------------------------------------------------------
test('unsupported mpegts shows the error overlay', async function ({ page }) {
  await setup(page);
  await page.evaluate(function () {
    window.mpegts = {
      Events: { ERROR: 'tsError' },
      getFeatureList: function () { return { mseLivePlayback: false }; },
      createPlayer: function () {},
    };
    window.Hls = { isSupported: function () { return false; } };
    document.getElementById('player-video').canPlayType = function () { return ''; };
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'TS Channel', url: '', img: '', cat: 'news', num: 1 });
    window.IptvSt.go('PLAY');
    window.IptvPlay.loadPlay('http://stream.test/live/u/p/1.ts');
  });
  const err = page.locator('#player-err');
  await expect(err).toBeVisible();
  // Stream-error placeholder (ADR-0023): friendly headline + the raw engine
  // token preserved as the dimmed secondary detail line.
  await expect(err).toContainText("This channel won't play");
  await expect(page.locator('#player-err .sig-detail')).toHaveText('MPEG-TS not supported');
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
  // Stream-error placeholder (ADR-0023): friendly headline + the raw engine
  // token ('Exception') preserved as the dimmed secondary detail line.
  await expect(err).toContainText("This channel won't play");
  await expect(page.locator('#player-err .sig-detail')).toHaveText('Exception');
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
