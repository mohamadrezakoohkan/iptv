// ADR: ADR-0039
// UI tests — in-player controls chrome (TASK-0086, specs/player-controls.md §1,
// §1a, §2, §5). On the running page the Fullscreen (#fs-btn) and PiP (#pip-btn)
// buttons render in the content-head alongside the format chip, are real
// keyboard-focusable <button>s carrying aria-pressed (present in the baseline,
// Rule R-0001), route clicks to the IptvCtrl toggles, reflect the actual
// fullscreen / PiP state through the state-sync callback (so a browser-initiated
// exit un-presses the button), and an unsupported control is hidden and not
// tab-reachable. Captures a screenshot of the controls on the player chrome.
//
// Headless Chromium cannot reliably enter real fullscreen / PiP without a user
// gesture, so state transitions are exercised by overriding the IptvCtrl
// predicates in the page and re-running rndCtrls — the SAME render path the
// browser state-change events drive — rather than forcing native fullscreen.

'use strict';

const { test, expect } = require('@playwright/test');

// Boot the page and wait for the controls chrome to be wired (mkEL has run).
async function boot(page) {
  await page.goto('http://localhost:3000');
  await page.locator('#fs-btn').waitFor({ state: 'attached', timeout: 6000 });
}

// ---------------------------------------------------------------------------
// Render + baseline — both buttons exist with aria-pressed present (R-0001)
// ---------------------------------------------------------------------------
test('both controls render in the content-head with aria-pressed in the baseline', async function ({ page }) {
  await boot(page);
  const fs  = page.locator('.content-head #fs-btn');
  const pip = page.locator('.content-head #pip-btn');
  await expect(fs).toHaveAttribute('aria-pressed', 'false');
  await expect(pip).toHaveAttribute('aria-pressed', 'false');
  // they sit alongside the format chip in the content-head cluster
  await expect(page.locator('.content-head #fmt-chip')).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// Keyboard focusable — a real <button> is reachable by focus()
// ---------------------------------------------------------------------------
test('the fullscreen button is keyboard-focusable', async function ({ page }) {
  await boot(page);
  // force support so the button is visible/enabled, then re-render
  await page.evaluate(function () {
    window.IptvCtrl.hasFs = function () { return true; };
    window.IptvUi.rndCtrls();
  });
  await page.locator('#fs-btn').focus();
  const focused = await page.evaluate(function () { return document.activeElement.id; });
  expect(focused).toBe('fs-btn');
});

// ---------------------------------------------------------------------------
// Click routes to the toggle — clicking #fs-btn calls IptvCtrl.toggleFs
// ---------------------------------------------------------------------------
test('clicking #fs-btn calls IptvCtrl.toggleFs and #pip-btn calls togglePip', async function ({ page }) {
  await boot(page);
  await page.evaluate(function () {
    window.IptvCtrl.hasFs  = function () { return true; };
    window.IptvCtrl.hasPip = function () { return true; };
    window.__calls = { fs: 0, pip: 0 };
    window.IptvCtrl.toggleFs  = function () { window.__calls.fs  += 1; };
    window.IptvCtrl.togglePip = function () { window.__calls.pip += 1; };
    window.IptvUi.rndCtrls();
  });
  await page.click('#fs-btn');
  await page.click('#pip-btn');
  const calls = await page.evaluate(function () { return window.__calls; });
  expect(calls.fs).toBe(1);
  expect(calls.pip).toBe(1);
});

// ---------------------------------------------------------------------------
// State sync — aria-pressed follows the ACTUAL state via the render path; a
// browser-initiated exit (isFs flips back to false) un-presses the button.
// ---------------------------------------------------------------------------
test('aria-pressed reflects fullscreen state and un-presses on exit', async function ({ page }) {
  await boot(page);
  // enter: isFs true → pressed
  await page.evaluate(function () {
    window.IptvCtrl.hasFs = function () { return true; };
    window.IptvCtrl.isFs  = function () { return true; };
    window.IptvUi.rndCtrls();
  });
  await expect(page.locator('#fs-btn')).toHaveAttribute('aria-pressed', 'true');
  // browser-initiated exit (e.g. Escape): isFs false → un-pressed
  await page.evaluate(function () {
    window.IptvCtrl.isFs = function () { return false; };
    window.IptvUi.rndCtrls();
  });
  await expect(page.locator('#fs-btn')).toHaveAttribute('aria-pressed', 'false');
});

// ---------------------------------------------------------------------------
// Feature-detect hide — an unsupported PiP control is hidden and not
// tab-reachable (it does not appear in the tab order).
// ---------------------------------------------------------------------------
test('an unsupported PiP control is hidden and not tab-reachable', async function ({ page }) {
  await boot(page);
  await page.evaluate(function () {
    window.IptvCtrl.hasFs  = function () { return true; };
    window.IptvCtrl.hasPip = function () { return false; };
    window.IptvUi.rndCtrls();
  });
  await expect(page.locator('#pip-btn')).toBeHidden();
  // a hidden control cannot take focus (removed from tab order)
  await page.locator('#pip-btn').focus().catch(function () {});
  const focused = await page.evaluate(function () { return document.activeElement.id; });
  expect(focused).not.toBe('pip-btn');
  // the supported control is still visible alongside
  await expect(page.locator('#fs-btn')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Screenshot — the controls on the player chrome (PR Test Results evidence)
// ---------------------------------------------------------------------------
test('capture the controls chrome screenshot', async function ({ page }) {
  await boot(page);
  await page.evaluate(function () {
    window.IptvCtrl.hasFs  = function () { return true; };
    window.IptvCtrl.hasPip = function () { return true; };
    window.IptvUi.rndCtrls();
  });
  await page.locator('#fs-btn').waitFor({ state: 'visible' });
  await page.locator('.content-head').screenshot({ path: 'test-results/task-0086-controls-chrome.png' });
});
