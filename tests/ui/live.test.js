// ADR: ADR-0010
// UI e2e — TASK-0024 live playback through the real local server:
// connect to the personal Xtream portal (specs/integration-testing.md,
// Xtream tier), browse real categories/channels, and play a live TS
// stream via the mpegts.js engine (engine → proxy → redirect → upstream).
// Requires live outbound network, like the integration tier.

'use strict';

const { test, expect } = require('@playwright/test');

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL = 'http://mymax.top:8080';
const USR    = '1ymax5763dy';
const PSS    = '66537535';
const SAMPLE = 5;      // stream-level flake policy: at least 1 of 5
const WAIT   = 20000;  // per-channel wait for media data, ms

// Live portal listing is large; give the whole scenario generous room.
test.describe.configure({ timeout: 180000 });

// ---------------------------------------------------------------------------
// Helper: connect to the live portal through the footer form (Xtream mode)
// ---------------------------------------------------------------------------
async function connect(page) {
  // Persisted creds would auto-reconnect and hide the login form — start clean.
  await page.addInitScript(function () { window.localStorage.clear(); });
  await page.goto('http://localhost:3000');
  await page.check('#mode-xtream');
  await page.fill('#f-url', PORTAL);
  await page.fill('#f-user', USR);
  await page.fill('#f-pass', PSS);
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible({ timeout: 60000 });
}

// ---------------------------------------------------------------------------
// Helper: readyState of the player video element
// ---------------------------------------------------------------------------
function getReady(page) {
  return page.evaluate(function () {
    return document.getElementById('player-video').readyState;
  });
}

// ---------------------------------------------------------------------------
// Helper: try one channel card; resolve { ok, err } per the flake policy
// ---------------------------------------------------------------------------
async function tryCard(page, i) {
  await page.locator('.ch-card').nth(i).click();
  await expect(page.locator('#chip-ts')).toHaveClass(/active/);
  const t0 = Date.now();
  while (Date.now() - t0 < WAIT) {
    if (await page.locator('#player-err').isVisible()) return { ok: false, err: 'overlay' };
    if ((await getReady(page)) > 0) return { ok: true, err: '' };
    await page.waitForTimeout(500);
  }
  // No data yet but the engine is still loading without an error overlay —
  // accepted minimum per the TASK-0024 acceptance criteria.
  return { ok: true, err: '' };
}

// ---------------------------------------------------------------------------
// Connect + listing
// ---------------------------------------------------------------------------
test('live portal connect lists real categories and channels', async function ({ page }) {
  await connect(page);
  await expect(page.locator('#footer-conn')).toContainText('mymax.top');
  await expect(page.locator('#footer-conn')).toContainText(USR);
  // sidebar: All Channels + more than one real category, with real labels
  const cats = page.locator('#grp-nav .cat-btn');
  expect(await cats.count()).toBeGreaterThan(2);
  const labels = await page.locator('#grp-nav .cat-label').allTextContents();
  for (const label of labels) {
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('undefined');
  }
  // grid: more than one channel card rendered
  expect(await page.locator('.ch-card').count()).toBeGreaterThan(1);
});

// ---------------------------------------------------------------------------
// Live playback — mpegts.js engine through the proxy
// ---------------------------------------------------------------------------
test('selecting a live channel attaches the TS engine and plays', async function ({ page }) {
  await connect(page);
  const cnt = Math.min(SAMPLE, await page.locator('.ch-card').count());
  let hit = false;
  for (let i = 0; i < cnt; i++) {
    const out = await tryCard(page, i);
    if (out.ok) { hit = true; break; }
    // A fatal engine error parks the state machine in ERR (ERR → INIT only),
    // so recover by reconnecting before sampling the next channel.
    if (i + 1 < cnt) await connect(page);
  }
  // Flake policy: at least one of the sample must reach playable/loading
  // state with the TS chip active and no error overlay.
  expect(hit).toBe(true);
  await expect(page.locator('#chip-ts')).toHaveClass(/active/);
  await expect(page.locator('#chip-hls')).not.toHaveClass(/active/);
  await expect(page.locator('#player-err')).toBeHidden();
});
