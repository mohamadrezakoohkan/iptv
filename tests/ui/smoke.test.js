// ADR: ADR-0001
// UI tests — full smoke test for TASK-0009: entry point + page structure

'use strict';

const { test, expect } = require('@playwright/test');

test('page title is "IPTV player"', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle('IPTV player');
});

test('#sidebar is visible on page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const sidebar = page.locator('#sidebar');
  await expect(sidebar).toBeVisible();
});

test('#player-idle is visible on page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const idle = page.locator('#player-idle');
  await expect(idle).toBeVisible();
});

test('#footer-login is visible on page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const login = page.locator('#footer-login');
  await expect(login).toBeVisible();
});

test('no uncaught JS errors on page load', async function ({ page }) {
  const errs = [];
  page.on('pageerror', function onErr(err) { errs.push(err.message); });
  await page.goto('http://localhost:3000');
  // Allow scripts to settle
  await page.waitForLoadState('networkidle');
  expect(errs).toEqual([]);
});

test('window.S is exposed and frozen after page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const frozen = await page.evaluate(function () {
    return typeof window.S !== 'undefined' && Object.isFrozen(window.S);
  });
  expect(frozen).toBe(true);
});

test('window.IptvNav is exposed after page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const ok = await page.evaluate(function () {
    return typeof window.IptvNav !== 'undefined';
  });
  expect(ok).toBe(true);
});
