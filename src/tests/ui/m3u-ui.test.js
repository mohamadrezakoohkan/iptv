// ADR: ADR-0008
// UI tests — footer login-mode selector (explicit choice, no auto-detect) for TASK-0018

'use strict';

const { test, expect } = require('@playwright/test');

const M3U8_URL = 'https://example.com/list.m3u8';
const HINT_XTR = 'Type "demo" to try a sample playlist.';
const HINT_M3U = 'Paste an .m3u / .m3u8 playlist URL — no login needed.';

// ---------------------------------------------------------------------------
// Default state — selector visible, xtream active, credential fields shown
// ---------------------------------------------------------------------------
test('mode selector is visible with xtream active by default', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await expect(page.locator('#login-mode')).toBeVisible();
  await expect(page.locator('#mode-xtream')).toBeChecked();
  await expect(page.locator('#mode-m3u')).not.toBeChecked();
});

test('credential fields are visible by default', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await expect(page.locator('.field-user')).toBeVisible();
  await expect(page.locator('.field-pass')).toBeVisible();
  await expect(page.locator('#footer-hint')).toHaveText(HINT_XTR);
});

// ---------------------------------------------------------------------------
// Mode switching — class, field visibility, hint text
// ---------------------------------------------------------------------------
test('selecting "Playlist URL only" hides credential fields and swaps the hint', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.check('#mode-m3u');
  await expect(page.locator('.field-user')).not.toBeVisible();
  await expect(page.locator('.field-pass')).not.toBeVisible();
  await expect(page.locator('#footer-hint')).toHaveText(HINT_M3U);
});

test('selecting "Username & Password" again restores fields and hint', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.check('#mode-m3u');
  await expect(page.locator('.field-user')).not.toBeVisible();
  await page.check('#mode-xtream');
  await expect(page.locator('.field-user')).toBeVisible();
  await expect(page.locator('.field-pass')).toBeVisible();
  await expect(page.locator('#footer-hint')).toHaveText(HINT_XTR);
});

// ---------------------------------------------------------------------------
// No auto-detection — URL shape never drives the mode
// ---------------------------------------------------------------------------
test('typing a .m3u8 URL in xtream mode leaves credential fields visible', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', M3U8_URL);
  await expect(page.locator('.field-user')).toBeVisible();
  await expect(page.locator('.field-pass')).toBeVisible();
  await expect(page.locator('#footer-hint')).toHaveText(HINT_XTR);
  await expect(page.locator('#mode-xtream')).toBeChecked();
});

// ---------------------------------------------------------------------------
// Demo connect succeeds in both modes
// ---------------------------------------------------------------------------
test('connecting with "demo" succeeds in xtream mode', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible({ timeout: 3000 });
});

test('connecting with "demo" succeeds in m3u mode', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.check('#mode-m3u');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Keyboard accessibility — radio group operable with arrow keys
// ---------------------------------------------------------------------------
test('mode selector is operable via keyboard arrows', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.focus('#mode-xtream');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#mode-m3u')).toBeChecked();
  await expect(page.locator('.field-user')).not.toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#mode-xtream')).toBeChecked();
  await expect(page.locator('.field-user')).toBeVisible();
});
