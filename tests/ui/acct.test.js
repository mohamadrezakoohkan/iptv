// ADR: ADR-0014
// UI tests — account nav button + right slide-in panel shell (TASK-0028):
// button visible top-right; click slides the panel in; close button, scrim,
// and Escape each hide it; the button is reachable + operable by keyboard.
//
// The panel is always in the DOM and toggled off-screen via a CSS transform,
// so open/closed state is asserted via the is-open class, aria-hidden, and the
// panel's on-screen x position — not Playwright visibility (a translated panel
// still counts as visible).

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

// onScreen — true when the panel's left edge sits inside the viewport
async function onScreen(page) {
  return page.evaluate(function () {
    const pnl = document.getElementById('acct-panel');
    const box = pnl.getBoundingClientRect();
    return box.left < window.innerWidth - 10;
  });
}

// ---------------------------------------------------------------------------
// Nav button — visible at the top-right
// ---------------------------------------------------------------------------
test('account button is visible in the content-head', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#acct-btn')).toBeVisible();
});

test('account button sits at the right edge of the content-head', async function ({ page }) {
  await setup(page);
  const right = await page.evaluate(function () {
    const btn  = document.getElementById('acct-btn').getBoundingClientRect();
    const head = document.querySelector('.content-head').getBoundingClientRect();
    return head.right - btn.right;
  });
  // within the head's horizontal padding (~20px)
  expect(right).toBeLessThan(40);
});

// ---------------------------------------------------------------------------
// Closed by default
// ---------------------------------------------------------------------------
test('panel is off-screen and aria-hidden on page load', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#acct-panel')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#acct-btn')).toHaveAttribute('aria-expanded', 'false');
  expect(await onScreen(page)).toBe(false);
});

// ---------------------------------------------------------------------------
// Open — clicking the button slides the panel in
// ---------------------------------------------------------------------------
test('clicking the account button slides the panel into view', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await expect(page.locator('#acct-scrim')).toHaveClass(/is-open/);
  await expect(page.locator('#acct-panel')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#acct-btn')).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(300); // let the transform transition settle
  expect(await onScreen(page)).toBe(true);
});

// ---------------------------------------------------------------------------
// Close — close button
// ---------------------------------------------------------------------------
test('clicking the close button hides the panel', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await page.click('#acct-close');
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#acct-panel')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#acct-btn')).toHaveAttribute('aria-expanded', 'false');
});

// ---------------------------------------------------------------------------
// Close — scrim
// ---------------------------------------------------------------------------
test('clicking the scrim hides the panel', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await page.click('#acct-scrim', { position: { x: 20, y: 20 } });
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#acct-scrim')).not.toHaveClass(/is-open/);
});

// ---------------------------------------------------------------------------
// Close — Escape
// ---------------------------------------------------------------------------
test('pressing Escape hides the panel', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#acct-panel')).toHaveAttribute('aria-hidden', 'true');
});

// ---------------------------------------------------------------------------
// Keyboard — the button is focusable and operable by keyboard
// ---------------------------------------------------------------------------
test('account button opens the panel when activated by keyboard', async function ({ page }) {
  await setup(page);
  await page.focus('#acct-btn');
  const focused = await page.evaluate(function () {
    return document.activeElement && document.activeElement.id === 'acct-btn';
  });
  expect(focused).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
});

// ---------------------------------------------------------------------------
// Account-store wiring (TASK-0029, ADR-0013)
// ---------------------------------------------------------------------------

// connectDemo — connect via the footer demo login and wait for the grid.
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Connect saves + activates an account; reload auto-reconnects it
// ---------------------------------------------------------------------------
test('successful connect saves an active account and reload auto-reconnects it', async function ({ page }) {
  await connectDemo(page);
  const stored = await page.evaluate(function () {
    const accts = JSON.parse(localStorage.getItem('iptv_accts'));
    return { len: accts.length, actId: localStorage.getItem('iptv_act'), firstId: accts[0].id };
  });
  expect(stored.len).toBe(1);
  expect(stored.actId).toBe(stored.firstId);
  // Reload — no footer interaction; the active account must reconnect itself
  await page.reload();
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Disconnect returns to the footer login while the account remains saved
// ---------------------------------------------------------------------------
test('disconnect shows the footer login but keeps the saved account', async function ({ page }) {
  await connectDemo(page);
  await page.click('#btn-disc');
  await page.locator('#footer-login').waitFor({ state: 'visible', timeout: 3000 });
  const after = await page.evaluate(function () {
    return { accts: JSON.parse(localStorage.getItem('iptv_accts')), act: localStorage.getItem('iptv_act') };
  });
  expect(after.accts.length).toBe(1);
  expect(after.act).toBeNull();
});
