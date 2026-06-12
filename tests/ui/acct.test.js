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

// ---------------------------------------------------------------------------
// Panel contents after connect (TASK-0030, ADR-0014)
// ---------------------------------------------------------------------------

test('after a demo connect the panel shows the connected account name + server url', async function ({ page }) {
  await connectDemo(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-conn')).toContainText('Demo');
  await expect(page.locator('#acct-conn')).toContainText('demo');
  await expect(page.locator('#acct-conn .acct-conn-stat')).toHaveText('Connected');
});

test('the nav button label shows the active account name after connect', async function ({ page }) {
  await connectDemo(page);
  await expect(page.locator('#acct-label')).toHaveText('Demo');
});

test('the list shows one row marked active for the connected account', async function ({ page }) {
  await connectDemo(page);
  await page.click('#acct-btn');
  const rows = page.locator('#acct-list .acct-row');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('#acct-list .acct-row.is-active')).toHaveCount(1);
  await expect(page.locator('#acct-list .acct-row.is-active')).toContainText('Demo');
});

test('"Add account" closes the panel and reveals the footer login with the URL field focused', async function ({ page }) {
  await connectDemo(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  await page.click('#acct-add');
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
  await page.locator('#footer-login').waitFor({ state: 'visible', timeout: 3000 });
  const focused = await page.evaluate(function () {
    return document.activeElement && document.activeElement.id === 'f-url';
  });
  expect(focused).toBe(true);
});

test('removing the connected account returns to the footer login and empties the list', async function ({ page }) {
  await connectDemo(page);
  await page.click('#acct-btn');
  await page.click('#acct-list .acct-row.is-active [data-rm]');
  await page.locator('#footer-login').waitFor({ state: 'visible', timeout: 3000 });
  await expect(page.locator('#acct-list')).toContainText('No saved accounts');
  await expect(page.locator('#acct-label')).toHaveText('Account');
  const act = await page.evaluate(function () { return localStorage.getItem('iptv_act'); });
  expect(act).toBeNull();
});

// ---------------------------------------------------------------------------
// Community presets section (TASK-0032, ADR-0015/ADR-0016)
//
// The remote preset connect is not asserted here (offline-deterministic): the
// data round-trip is covered by the unit tier and the live iptv-org M3U fetch
// by the existing integration tier. These UI tests assert the section is the
// default catalog (present without any saved account), lists S.psts, carries
// no remove control, and that clicking the active preset is a no-op.
// ---------------------------------------------------------------------------

// pstCount — the number of curated presets exposed on window.S.
async function pstCount(page) {
  return page.evaluate(function () { return window.S.psts.length; });
}

test('the community playlists section is present with zero saved accounts', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  await expect(page.locator('#acct-list')).toContainText('No saved accounts');
  await expect(page.locator('#acct-panel')).toContainText('Community playlists');
  const n = await pstCount(page);
  await expect(page.locator('#acct-psts .acct-pst')).toHaveCount(n);
});

test('each preset row shows its name + url and has no remove control', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  const first = page.locator('#acct-psts .acct-pst').first();
  await expect(first.locator('.acct-row-name')).toContainText('iptv-org');
  await expect(first.locator('.acct-row-srv')).toContainText('https://iptv-org.github.io/iptv/');
  await expect(page.locator('#acct-psts [data-rm]')).toHaveCount(0);
  await expect(page.locator('#acct-psts .acct-row-rm')).toHaveCount(0);
});

test('the presets section sits below the saved list and above Add account', async function ({ page }) {
  await setup(page);
  await page.click('#acct-btn');
  const order = await page.evaluate(function () {
    const list = document.getElementById('acct-list').getBoundingClientRect().top;
    const psts = document.getElementById('acct-psts').getBoundingClientRect().top;
    const add  = document.getElementById('acct-add').getBoundingClientRect().top;
    return { list, psts, add };
  });
  expect(order.list).toBeLessThan(order.psts);
  expect(order.psts).toBeLessThan(order.add);
});

test('clicking the active preset is a no-op (it stays connected)', async function ({ page }) {
  // Seed an active M3U account whose url matches the first preset, then verify
  // clicking that preset row does not re-trigger a connect / drop the session.
  await page.goto('http://localhost:3000');
  const url = await page.evaluate(function () { return window.S.psts[0].url; });
  await page.evaluate(function (u) {
    const acct = { id: 'pst0', name: 'iptv-org', url: u, user: '', pass: '', m3u: true };
    localStorage.setItem('iptv_accts', JSON.stringify([acct]));
    localStorage.setItem('iptv_act', 'pst0');
  }, url);
  await page.reload();
  await page.evaluate(function () { window.IptvUi.mkEL(); window.IptvUi.rndAcct(); });
  await page.click('#acct-btn');
  const activeBefore = await page.locator('#acct-psts .acct-pst.is-active').count();
  expect(activeBefore).toBe(1);
  let connects = 0;
  await page.exposeFunction('onConnectCall', function () { connects += 1; });
  await page.evaluate(function () {
    const orig = window.IptvApi.connect;
    window.IptvApi.connect = function connect() { window.onConnectCall(); return orig.apply(null, arguments); };
  });
  await page.click('#acct-psts .acct-pst.is-active');
  await page.waitForTimeout(300);
  expect(connects).toBe(0);
});
