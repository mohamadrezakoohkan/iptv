// ADR: ADR-0003, ADR-0008
// UI tests — localStorage persistence: favs, sel, creds (TASK-0010)
// + persisted login mode and stored-mode reconnect (TASK-0019)

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
  // Reload page — auto-reconnect should run using stored creds
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
// Test 3 — disconnect → iptv_creds is not in localStorage
// ---------------------------------------------------------------------------
test('disconnect removes iptv_creds from localStorage', async function ({ page }) {
  await connectDemo(page);
  // Verify creds are stored after connect
  const credsBefore = await page.evaluate(function () {
    return localStorage.getItem('iptv_creds');
  });
  expect(credsBefore).not.toBeNull();
  // Disconnect
  await page.click('#btn-disc');
  await page.locator('#footer-login').waitFor({ state: 'visible', timeout: 3000 });
  // Verify creds are gone
  const credsAfter = await page.evaluate(function () {
    return localStorage.getItem('iptv_creds');
  });
  expect(credsAfter).toBeNull();
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
// Test 4 — demo connect stores m3u:false; reload restores the session
// ---------------------------------------------------------------------------
test('demo connect stores m3u:false in iptv_creds and reload restores session', async function ({ page }) {
  await connectDemo(page);
  const creds = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem('iptv_creds'));
  });
  expect(creds.m3u).toBe(false);
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 5 — seeded m3u:true creds reconnect through the M3U proxy path
// (user/pass non-empty so only the stored flag can route to M3U)
// ---------------------------------------------------------------------------
test('stored m3u:true creds reconnect through the M3U path on reload', async function ({ page }) {
  const reqUrls = [];
  await page.route('**/api/xtream*', async function onRoute(route) {
    reqUrls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'audio/x-mpegurl', body: M3U_BODY });
  });
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    localStorage.setItem('iptv_creds', JSON.stringify({ url: 'http://example.com/tv', user: 'u', pass: 'p', m3u: true }));
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
// Test 6 — legacy credential-less creds (no m3u key) migrate to the M3U path
// ---------------------------------------------------------------------------
test('legacy credential-less creds reconnect through the M3U path on reload', async function ({ page }) {
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
  expect(reqUrls.length).toBe(1);
  expect(reqUrls[0]).toContain(encodeURIComponent('http://example.com/legacy-list'));
  expect(reqUrls[0]).not.toContain('player_api.php');
});
