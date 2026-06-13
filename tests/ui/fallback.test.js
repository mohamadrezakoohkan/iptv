// ADR: ADR-0012, ADR-0023
// UI tests — MSE-less TS→remuxed-HLS fallback for TASK-0026.
// window.mpegts feature flags are stubbed to emulate an MSE-less browser
// (iOS Safari); window.Hls is stubbed to capture the URL handed to the HLS
// path without issuing live network requests. Real remux playback is proven
// by the integration tier (tests/int).

'use strict';

const { test, expect } = require('@playwright/test');

const RAW_TS = 'http://stream.test/live/u/p/1.ts';

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
// Helper: stub an MSE-less mpegts + a recording Hls, play a TS channel
// ---------------------------------------------------------------------------
async function playMseless(page) {
  return page.evaluate(function (raw) {
    window.mpegts = {
      Events: { ERROR: 'tsError' },
      getFeatureList: function () { return { mseLivePlayback: false }; },
      createPlayer: function () { throw new Error('must not be called without MSE'); },
    };
    const calls = [];
    function HlsCtor() {
      this.loadSource  = function (u) { calls.push(u); };
      this.attachMedia = function () {};
      this.on          = function () {};
      this.destroy     = function () {};
    }
    HlsCtor.isSupported = function () { return true; };
    HlsCtor.Events      = { MANIFEST_PARSED: 'm', ERROR: 'e' };
    window.Hls = HlsCtor;
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'TS Channel', url: raw, img: '', cat: 'news', num: 1 });
    window.IptvSt.go('PLAY');
    const res = window.IptvPlay.loadPlay(raw);
    return { res, calls };
  }, RAW_TS);
}

// ---------------------------------------------------------------------------
// MSE-less: TS channel falls back to /api/hls — no error overlay
// ---------------------------------------------------------------------------
test('MSE-less TS playback shows no "MPEG-TS not supported" overlay', async function ({ page }) {
  await setup(page);
  const out = await playMseless(page);
  expect(out.res).toEqual({ ok: true, val: null });
  await expect(page.locator('#player-err')).not.toBeVisible();
});

test('MSE-less TS playback hands the /api/hls remux URL to the HLS engine', async function ({ page }) {
  await setup(page);
  const out = await playMseless(page);
  expect(out.calls).toEqual(['/api/hls?url=' + encodeURIComponent(RAW_TS)]);
  expect(out.calls[0]).not.toContain('/api/xtream');
});

test('MSE-less TS fallback highlights the HLS chip, not the TS chip', async function ({ page }) {
  await setup(page);
  await playMseless(page);
  await expect(page.locator('#chip-hls')).toHaveClass(/active/);
  await expect(page.locator('#chip-ts')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// MSE-capable: behavior unchanged from E5 — TS chip, mpegts engine
// ---------------------------------------------------------------------------
test('MSE-capable TS playback still highlights the TS chip', async function ({ page }) {
  await setup(page);
  await page.evaluate(function (raw) {
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
    window.IptvPlay.loadPlay(raw);
  }, RAW_TS);
  await expect(page.locator('#chip-ts')).toHaveClass(/active/);
  await expect(page.locator('#chip-hls')).not.toHaveClass(/active/);
  await expect(page.locator('#player-err')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Double failure: fallback HLS path itself cannot play → overlay appears
// ---------------------------------------------------------------------------
test('overlay appears only when the fallback HLS path cannot play', async function ({ page }) {
  await setup(page);
  await page.evaluate(function (raw) {
    window.mpegts = {
      Events: { ERROR: 'tsError' },
      getFeatureList: function () { return { mseLivePlayback: false }; },
      createPlayer: function () {},
    };
    window.Hls = { isSupported: function () { return false; } };
    document.getElementById('player-video').canPlayType = function () { return ''; };
    window.IptvSt.go('LOAD');
    window.IptvSt.go('READY');
    window.IptvSt.setCur({ id: '1', name: 'TS Channel', url: raw, img: '', cat: 'news', num: 1 });
    window.IptvSt.go('PLAY');
    window.IptvPlay.loadPlay(raw);
  }, RAW_TS);
  const err = page.locator('#player-err');
  await expect(err).toBeVisible();
  // Stream-error placeholder (ADR-0023): friendly headline + the raw engine
  // token preserved as the dimmed secondary detail line.
  await expect(err).toContainText("This channel won't play");
  await expect(page.locator('#player-err .sig-detail')).toHaveText('MPEG-TS not supported');
});

// ---------------------------------------------------------------------------
// Demo / .m3u8 channels — untouched by the fallback
// ---------------------------------------------------------------------------
test('demo mode HLS playback is unchanged — HLS chip, no error overlay', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible();
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#chip-hls')).toHaveClass(/active/);
  await expect(page.locator('#chip-ts')).not.toHaveClass(/active/);
  await expect(page.locator('#player-err')).not.toBeVisible();
});
