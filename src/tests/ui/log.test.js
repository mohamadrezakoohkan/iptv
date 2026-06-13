// ADR: ADR-0028
// UI tests — playback failure-log button + right slide-in panel shell
// (TASK-0058): the log button is visible in the content-head immediately
// beside the account button; clicking it slides the panel in; the close
// button, the scrim, and Escape each hide it; the button is reachable and
// operable by keyboard. (Rendering log rows + the count badge is TASK-0059;
// the interact-and-record demo arc is TASK-0060.)
//
// Like the account panel, the log panel is always in the DOM and toggled
// off-screen via a CSS transform, so open/closed state is asserted via the
// is-open class, aria-hidden, and the panel's on-screen x position — not
// Playwright visibility (a translated panel still counts as visible).

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

// onScreen — true when the log panel's left edge sits inside the viewport
async function onScreen(page) {
  return page.evaluate(function () {
    const pnl = document.getElementById('log-panel');
    const box = pnl.getBoundingClientRect();
    return box.left < window.innerWidth - 10;
  });
}

// ---------------------------------------------------------------------------
// Log button — visible in the top bar, beside the account button
// ---------------------------------------------------------------------------
test('log button is visible in the content-head', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#log-btn')).toBeVisible();
});

test('log button sits immediately before the account button at the right edge', async function ({ page }) {
  await setup(page);
  const geom = await page.evaluate(function () {
    const log  = document.getElementById('log-btn').getBoundingClientRect();
    const acct = document.getElementById('acct-btn').getBoundingClientRect();
    const head = document.querySelector('.content-head').getBoundingClientRect();
    return { logRight: log.right, acctLeft: acct.left, acctRight: acct.right, headRight: head.right };
  });
  // the log button precedes the account button horizontally …
  expect(geom.logRight).toBeLessThanOrEqual(geom.acctLeft + 1);
  // … and the pair sits at the right edge of the head (within its padding)
  expect(geom.headRight - geom.acctRight).toBeLessThan(40);
});

// ---------------------------------------------------------------------------
// Closed by default
// ---------------------------------------------------------------------------
test('log panel is off-screen and aria-hidden on page load', async function ({ page }) {
  await setup(page);
  await expect(page.locator('#log-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#log-panel')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#log-btn')).toHaveAttribute('aria-expanded', 'false');
  expect(await onScreen(page)).toBe(false);
});

// ---------------------------------------------------------------------------
// Open — clicking the button slides the panel in
// ---------------------------------------------------------------------------
test('clicking the log button slides the panel into view', async function ({ page }) {
  await setup(page);
  await page.click('#log-btn');
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
  await expect(page.locator('#log-scrim')).toHaveClass(/is-open/);
  await expect(page.locator('#log-panel')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#log-btn')).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(300); // let the transform transition settle
  expect(await onScreen(page)).toBe(true);
});

// ---------------------------------------------------------------------------
// Close — close button
// ---------------------------------------------------------------------------
test('clicking the close button hides the log panel', async function ({ page }) {
  await setup(page);
  await page.click('#log-btn');
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
  await page.click('#log-close');
  await expect(page.locator('#log-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#log-panel')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#log-btn')).toHaveAttribute('aria-expanded', 'false');
});

// ---------------------------------------------------------------------------
// Close — scrim
// ---------------------------------------------------------------------------
test('clicking the scrim hides the log panel', async function ({ page }) {
  await setup(page);
  await page.click('#log-btn');
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
  await page.click('#log-scrim', { position: { x: 20, y: 20 } });
  await expect(page.locator('#log-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#log-scrim')).not.toHaveClass(/is-open/);
});

// ---------------------------------------------------------------------------
// Close — Escape
// ---------------------------------------------------------------------------
test('pressing Escape hides the log panel', async function ({ page }) {
  await setup(page);
  await page.click('#log-btn');
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#log-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#log-panel')).toHaveAttribute('aria-hidden', 'true');
});

// ---------------------------------------------------------------------------
// Keyboard — the button is focusable and operable by keyboard
// ---------------------------------------------------------------------------
test('log button opens the panel when activated by keyboard', async function ({ page }) {
  await setup(page);
  await page.focus('#log-btn');
  const focused = await page.evaluate(function () {
    return document.activeElement && document.activeElement.id === 'log-btn';
  });
  expect(focused).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
});

// ---------------------------------------------------------------------------
// Independence — opening the log panel does not force the account panel closed
// (each is its own presentational toggle, ADR-0028). Driven through setLog so
// the assertion is about the toggles themselves, not the open account panel's
// full-viewport scrim (which legitimately intercepts a real top-bar click).
// ---------------------------------------------------------------------------
test('opening the log panel leaves an open account panel open', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await page.evaluate(function () { window.IptvUi.setLog(true); });
  await expect(page.locator('#log-panel')).toHaveClass(/is-open/);
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
});
