// ADR: ADR-0003
// UI tests — localStorage persistence: favs, sel, creds (TASK-0010)

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
