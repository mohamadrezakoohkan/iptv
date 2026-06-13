// ADR: ADR-0001
// UI tests — Footer: login form + demo connect + disconnect flow for TASK-0008

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper — navigate and initialise EL registry
// ---------------------------------------------------------------------------
async function setup(page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
  });
}

// ---------------------------------------------------------------------------
// Initial state — login form visible, connected bar hidden
// ---------------------------------------------------------------------------
test('footer-login section is visible on page load', async function ({ page }) {
  await setup(page);
  const login = page.locator('#footer-login');
  await expect(login).toBeVisible();
});

test('footer-conn section is hidden on page load', async function ({ page }) {
  await setup(page);
  const conn = page.locator('#footer-conn');
  await expect(conn).toBeHidden();
});

test('Connect button is initially disabled', async function ({ page }) {
  await setup(page);
  const btn = page.locator('#btn-conn');
  await expect(btn).toBeDisabled();
});

test('hint text is visible on page load', async function ({ page }) {
  await setup(page);
  const hint = page.locator('#footer-hint');
  await expect(hint).toBeVisible();
});

// ---------------------------------------------------------------------------
// URL input → button enable
// ---------------------------------------------------------------------------
test('Connect button enables when URL input is non-empty', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  const btn = page.locator('#btn-conn');
  await expect(btn).toBeEnabled();
});

test('Connect button disables when URL input is cleared', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.fill('#f-url', '');
  const btn = page.locator('#btn-conn');
  await expect(btn).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Demo connect flow — full E2E
// ---------------------------------------------------------------------------
test('clicking Connect with "demo" shows footer-conn after load', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  const conn = page.locator('#footer-conn');
  await expect(conn).toBeVisible({ timeout: 3000 });
});

test('footer-login is hidden after successful demo connect', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  const login = page.locator('#footer-login');
  await expect(login).toBeHidden();
});

test('conn-text contains "demo" after demo connect', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  const ctxt = page.locator('#conn-text');
  await expect(ctxt).toContainText('demo');
});

test('conn-text contains "31 channels" after demo connect', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  const ctxt = page.locator('#conn-text');
  await expect(ctxt).toContainText('31 channels');
});

// ---------------------------------------------------------------------------
// Disconnect flow
// ---------------------------------------------------------------------------
test('clicking Disconnect shows login form again', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  await page.click('#btn-disc');
  const login = page.locator('#footer-login');
  await expect(login).toBeVisible();
});

test('clicking Disconnect hides footer-conn', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  await page.click('#btn-disc');
  const conn = page.locator('#footer-conn');
  await expect(conn).toBeHidden();
});

test('URL input is cleared after disconnect', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  await page.click('#btn-disc');
  const url = page.locator('#f-url');
  await expect(url).toHaveValue('');
});
