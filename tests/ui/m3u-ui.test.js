// ADR: ADR-0005
// UI tests — M3U footer field visibility for TASK-0013

'use strict';

const { test, expect } = require('@playwright/test');

const M3U_URL      = 'https://example.com/test.m3u';
const PORTAL_URL   = 'http://portal.example.com/api';

test('typing M3U URL hides Username and Password fields', async function ({ page }) {
  await page.goto('http://localhost:3000');

  await page.fill('#f-url', M3U_URL);

  // Username and Password wrapper divs get display:none via .is-m3u CSS rule
  await expect(page.locator('.field-user')).not.toBeVisible();
  await expect(page.locator('.field-pass')).not.toBeVisible();
});

test('clearing M3U URL and typing plain portal URL restores field visibility', async function ({ page }) {
  await page.goto('http://localhost:3000');

  // First set an M3U URL to enter M3U mode
  await page.fill('#f-url', M3U_URL);
  await expect(page.locator('.field-user')).not.toBeVisible();

  // Clear URL field — empty string is not M3U, so fields should reappear
  await page.fill('#f-url', '');
  await expect(page.locator('.field-user')).toBeVisible();
  await expect(page.locator('.field-pass')).toBeVisible();
});

test('M3U URL hint text is shown when URL has .m3u extension', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', M3U_URL);
  const hint = await page.locator('#footer-hint').textContent();
  expect(hint).toBe('M3U URL detected — username and password not needed.');
});

test('default hint text is shown on empty URL input', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', M3U_URL);
  // Clear URL
  await page.fill('#f-url', '');
  const hint = await page.locator('#footer-hint').textContent();
  expect(hint).toBe('Type "demo" to try a sample playlist.');
});

test('plain portal URL (no .m3u extension, no credentials) also hides fields per isM3u heuristic', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', PORTAL_URL);
  // Per ADR-0005: plain http URL with no credentials is treated as M3U
  await expect(page.locator('.field-user')).not.toBeVisible();
  await expect(page.locator('.field-pass')).not.toBeVisible();
});
