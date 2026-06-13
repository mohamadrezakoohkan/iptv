// ADR: ADR-0003, ADR-0008, ADR-0013
// UI tests — localStorage persistence: favs + sel (TASK-0010), persisted login
// mode + stored-mode reconnect (TASK-0019), and the accounts-store
// connect/reconnect/disconnect wiring (TASK-0029, ADR-0013). The single
// iptv_creds record is gone: a successful connect saves + activates an account
// in iptv_accts / iptv_act, reload reconnects the active account, and
// disconnect clears the active id while the saved account remains.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper — connect with demo and wait until channel grid is visible
// ---------------------------------------------------------------------------
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Test 1 — star a channel → refresh → fav-on class persists
// ---------------------------------------------------------------------------
test('starred channel retains fav-on class after page refresh', async function ({ page }) {
  await connectDemo(page);
  // Click the first star to add to favourites
  const star = page.locator('.ch-fav').first();
  await star.click();
  await expect(star).toHaveClass(/\bon\b/);
  // Reload page — auto-reconnect should run using the active account
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // First star should still have 'on' class
  const starAfter = page.locator('.ch-fav').first();
  await expect(starAfter).toHaveClass(/\bon\b/);
});

// ---------------------------------------------------------------------------
// Test 2 — click a channel card → refresh → that channel has ch-active class
// ---------------------------------------------------------------------------
test('clicked channel card retains ch-active class after page refresh', async function ({ page }) {
  await connectDemo(page);
  // Get the id of the second card before clicking so we can find it after reload
  const secondCard = page.locator('.ch-card').nth(1);
  const chId = await secondCard.getAttribute('data-id');
  await secondCard.click();
  // Allow phase to settle then reload
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // Channel with the same data-id should have ch-active class
  const restored = page.locator('.ch-card[data-id="' + chId + '"]');
  await expect(restored).toHaveClass(/ch-active/);
});

// ---------------------------------------------------------------------------
// Test 3 — disconnect clears the active id but keeps the saved account
// ---------------------------------------------------------------------------
test('disconnect clears iptv_act but preserves the saved iptv_accts', async function ({ page }) {
  await connectDemo(page);
  // After connect: the demo account is saved and active.
  const before = await page.evaluate(function () {
    return { accts: localStorage.getItem('iptv_accts'), act: localStorage.getItem('iptv_act') };
  });
  expect(before.accts).not.toBeNull();
  expect(before.act).not.toBeNull();
  // iptv_creds is gone for good
  const credsBefore = await page.evaluate(function () { return localStorage.getItem('iptv_creds'); });
  expect(credsBefore).toBeNull();
  // Disconnect
  await page.click('#btn-disc');
  await page.locator('#footer-login').waitFor({ state: 'visible', timeout: 3000 });
  const after = await page.evaluate(function () {
    return { accts: localStorage.getItem('iptv_accts'), act: localStorage.getItem('iptv_act') };
  });
  // Active id cleared, saved account remains
  expect(after.act).toBeNull();
  expect(after.accts).not.toBeNull();
  expect(JSON.parse(after.accts).length).toBe(1);
});

// ---------------------------------------------------------------------------
// Mocked M3U playlist body served by the route-mocked proxy (no live network)
// ---------------------------------------------------------------------------
const M3U_BODY = '#EXTM3U\n'
  + '#EXTINF:-1 tvg-id="alpha" group-title="News",Alpha TV\n'
  + 'http://example.com/alpha.m3u8\n'
  + '#EXTINF:-1 tvg-id="beta" group-title="Sports",Beta Sport\n'
  + 'http://example.com/beta.m3u8\n';

// ---------------------------------------------------------------------------
// Test 4 — demo connect saves m3u:false account; reload restores the session
// ---------------------------------------------------------------------------
test('demo connect saves an m3u:false account and reload restores the session', async function ({ page }) {
  await connectDemo(page);
  const accts = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem('iptv_accts'));
  });
  expect(accts.length).toBe(1);
  expect(accts[0].m3u).toBe(false);
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 5 — a seeded m3u:true active account reconnects through the M3U path
// (user/pass non-empty so only the stored flag can route to M3U)
// ---------------------------------------------------------------------------
test('seeded m3u:true active account reconnects through the M3U path on reload', async function ({ page }) {
  const reqUrls = [];
  await page.route('**/api/xtream*', async function onRoute(route) {
    reqUrls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'audio/x-mpegurl', body: M3U_BODY });
  });
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    const acct = { id: '1', name: 'tv', url: 'http://example.com/tv', user: 'u', pass: 'p', m3u: true };
    localStorage.setItem('iptv_accts', JSON.stringify([acct]));
    localStorage.setItem('iptv_act', '1');
  });
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await expect(page.locator('.ch-card')).toHaveCount(2);
  await expect(page.locator('.ch-name').first()).toHaveText('Alpha TV');
  // Exactly the playlist URL was proxied — never the Xtream player_api.php
  expect(reqUrls.length).toBe(1);
  expect(reqUrls[0]).toContain(encodeURIComponent('http://example.com/tv'));
  expect(reqUrls[0]).not.toContain('player_api.php');
});

// ---------------------------------------------------------------------------
// Test 6 — legacy iptv_creds migrates to the accounts store on load and
// reconnects the migrated active account through the M3U path
// ---------------------------------------------------------------------------
test('legacy iptv_creds migrates to the accounts store and reconnects on reload', async function ({ page }) {
  const reqUrls = [];
  await page.route('**/api/xtream*', async function onRoute(route) {
    reqUrls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'audio/x-mpegurl', body: M3U_BODY });
  });
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    localStorage.setItem('iptv_creds', JSON.stringify({ url: 'http://example.com/legacy-list', user: '', pass: '' }));
  });
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await expect(page.locator('.ch-card')).toHaveCount(2);
  // Migration: iptv_creds removed, accounts store written, M3U path used
  const migrated = await page.evaluate(function () {
    return { creds: localStorage.getItem('iptv_creds'), accts: localStorage.getItem('iptv_accts'), act: localStorage.getItem('iptv_act') };
  });
  expect(migrated.creds).toBeNull();
  expect(JSON.parse(migrated.accts).length).toBe(1);
  expect(migrated.act).not.toBeNull();
  expect(reqUrls.length).toBe(1);
  expect(reqUrls[0]).toContain(encodeURIComponent('http://example.com/legacy-list'));
  expect(reqUrls[0]).not.toContain('player_api.php');
});
