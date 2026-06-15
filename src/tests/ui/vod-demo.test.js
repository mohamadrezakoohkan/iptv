// ADR: ADR-0038
// UI tests — the OFFLINE demo path surfaces a playable VOD movie so the VOD
// feature is demonstrable with NO live network (specs/vod-library.md §6,
// TASK-0083). Boots demo mode through the real footer login (offline — the demo
// connect synthesizes one VOD movie, "Demo Movie" / demo-vod-1, whose url is a
// public HLS test stream), then asserts, against the real running app, the
// behavior the demo recording (vod-recording.test.js) demonstrates — so it is
// regression-guarded independent of the recording:
//   - the content toggle's Movies tab surfaces in demo mode (Series does not —
//     the demo synthesizes no series),
//   - switching to Movies browses exactly the one synthesized movie poster card,
//   - selecting the movie plays it through the EXISTING select+play path
//     (READY -> PLAY, body.is-play, #now-info shows the movie) with the movie's
//     on-demand url handed UNCHANGED to the player (so getEng resolves the same
//     engine the live path uses — no new engine, no new phase, no new route).
// A loadPlay spy records the played url so the headless run makes no real media
// load while still proving the exact url reaches the player.

'use strict';

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

// The synthesized offline demo movie (specs/vod-library.md §6).
const DEMO_MOV_ID   = 'demo-vod-1';
const DEMO_MOV_NAME = 'Demo Movie';
// The public HLS test stream the demo movie points at (same family the demo
// channels use), so on-demand playback works with NO live Xtream portal.
const DEMO_MOV_URL  = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

// Boot demo mode through the real footer login so the running app is fully wired
// (production handlers, IptvSt/IptvPlay/IptvVod/IptvUi all live), offline.
async function bootDemo(page) {
  await page.goto(BASE_URL);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // The best-effort demo VOD synthesis fills one movie, then rndVod reveals Movies.
  await page.locator('#content-toggle [data-mode="movies"]').waitFor({ state: 'visible', timeout: 5000 });
}

// Install a loadPlay spy on the running page (records URLs, no real media load).
async function spyPlay(page) {
  await page.evaluate(function run() {
    window.__played = [];
    window.IptvPlay.loadPlay = function spyLoad(url) { window.__played.push(url); };
  });
}

test('the demo path surfaces the Movies tab but not Series (offline, no live network)', async function ({ page }) {
  await bootDemo(page);
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toBeVisible();
  await expect(page.locator('#content-toggle [data-mode="series"]')).toBeHidden();
  // Default mode is Live until the user switches.
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveClass(/active/);
});

test('switching to Movies in demo mode browses the one synthesized movie card', async function ({ page }) {
  await bootDemo(page);
  await page.click('#content-toggle [data-mode="movies"]');
  await expect(page.locator('#content-toggle [data-mode="movies"]')).toHaveClass(/active/);

  const card = page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(1);
  await expect(card.locator('.ch-name')).toHaveText(DEMO_MOV_NAME);
  // The VOD card carries no live-only affordances (its id has no EPG entries).
  await expect(card.locator('[data-rem]')).toHaveCount(0);
  await expect(card.locator('[data-replay]')).toHaveCount(0);
});

test('selecting the demo movie plays it offline through the existing player', async function ({ page }) {
  await bootDemo(page);
  await spyPlay(page);

  await page.click('#content-toggle [data-mode="movies"]');
  const card = page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();

  // The EXISTING select+play arc ran: READY -> PLAY, the player is active, and the
  // now-info bar shows the on-demand item's name.
  await expect(page.locator('body')).toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText(DEMO_MOV_NAME);
  await expect(page.locator('#player-video')).toBeVisible();
  await expect(page.locator('#player-idle')).toBeHidden();

  // Exactly the movie's on-demand url was played, UNCHANGED — so loadPlay -> getEng
  // selects the same engine the live path uses (no new engine / phase / route).
  const played = await page.evaluate(function get() { return window.__played; });
  expect(played.length).toBe(1);
  expect(played[0]).toBe(DEMO_MOV_URL);
});

test('switching back to Live in demo mode restores the live channel grid', async function ({ page }) {
  await bootDemo(page);
  const liveCount = await page.locator('.ch-card').count();

  await page.click('#content-toggle [data-mode="movies"]');
  await expect(page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]')).toBeVisible();
  await expect(page.locator('.ch-card')).toHaveCount(1);

  await page.click('#content-toggle [data-mode="live"]');
  await expect(page.locator('#content-toggle [data-mode="live"]')).toHaveClass(/active/);
  await expect(page.locator('.ch-card')).toHaveCount(liveCount);
  await expect(page.locator('.ch-card[data-id="' + DEMO_MOV_ID + '"]')).toHaveCount(0);
});
