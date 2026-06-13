// ADR: ADR-0019
// UI tests — sun/moon theme toggle CONTROL (TASK-0038): visible top-right in
// the content-head; clicking it switches the theme and visibly recolours the
// page (computed tokens change); the sun/moon state reflects the active theme;
// the choice persists across a reload; and the toggle coexists with the
// account button (both present, no overlap, independent activation).
//
// Per Rule R-0001: the baseline <html> ships with NO data-theme attribute, so
// the first toggle is asserted to ADD data-theme="light" and the second to
// REMOVE it — never to restore an attribute the source never had. The toggle's
// baseline aria-checked is "false" (verified before asserting it flips).

'use strict';

const { test, expect } = require('@playwright/test');

async function bgOf(page, sel) {
  return page.evaluate(function (s) {
    return window.getComputedStyle(document.querySelector(s)).backgroundColor;
  }, sel);
}

// ---------------------------------------------------------------------------
// Visible, top-right, coexists with the account button
// ---------------------------------------------------------------------------
test('theme toggle is visible in the content-head', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await expect(page.locator('#theme-toggle')).toBeVisible();
});

test('toggle and account button both sit in the top-right without overlap', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await expect(page.locator('#theme-toggle')).toBeVisible();
  await expect(page.locator('#acct-btn')).toBeVisible();
  const geom = await page.evaluate(function () {
    const t = document.getElementById('theme-toggle').getBoundingClientRect();
    const a = document.getElementById('acct-btn').getBoundingClientRect();
    const h = document.querySelector('.content-head').getBoundingClientRect();
    return { t, a, headRight: h.right };
  });
  // the toggle is left of the account button (no overlap)
  expect(geom.t.right).toBeLessThanOrEqual(geom.a.left + 1);
  // both are in the right portion of the head: the account button hugs the
  // right edge, and the toggle sits a small gap immediately to its left
  // (within the account button's max-width + gap).
  expect(geom.headRight - geom.a.right).toBeLessThan(40);
  expect(geom.a.left - geom.t.right).toBeLessThan(20);
});

// ---------------------------------------------------------------------------
// Baseline (R-0001) — no data-theme, aria-checked="false"
// ---------------------------------------------------------------------------
test('baseline <html> has no data-theme and toggle aria-checked is "false"', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const state = await page.evaluate(function () {
    return {
      attr:    document.documentElement.getAttribute('data-theme'),
      checked: document.getElementById('theme-toggle').getAttribute('aria-checked'),
    };
  });
  expect(state.attr).toBeNull();
  expect(state.checked).toBe('false');
});

// ---------------------------------------------------------------------------
// Click switches the theme and visibly recolours the page
// ---------------------------------------------------------------------------
test('clicking the toggle switches theme and recolours the page', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const darkBody = await bgOf(page, 'body');
  const darkSide = await bgOf(page, '.sidebar');

  await page.click('#theme-toggle');

  const attr = await page.evaluate(function () {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(attr).toBe('light');

  const lightBody = await bgOf(page, 'body');
  const lightSide = await bgOf(page, '.sidebar');
  expect(lightBody).not.toBe(darkBody);
  expect(lightSide).not.toBe(darkSide);
  // the light --bg token is #F4F6F8
  expect(lightBody).toBe('rgb(244, 246, 248)');
});

// ---------------------------------------------------------------------------
// Sun/moon visual state reflects the active theme
// ---------------------------------------------------------------------------
test('toggle visual state reflects the active theme', async function ({ page }) {
  await page.goto('http://localhost:3000');
  // dark default: no is-light class, aria-checked false, moon shown / sun hidden
  let st = await page.evaluate(function () {
    const t = document.getElementById('theme-toggle');
    return {
      isLight: t.classList.contains('is-light'),
      checked: t.getAttribute('aria-checked'),
      sun:     window.getComputedStyle(t.querySelector('.thm-sun')).display,
      moon:    window.getComputedStyle(t.querySelector('.thm-moon')).display,
    };
  });
  expect(st.isLight).toBe(false);
  expect(st.checked).toBe('false');
  expect(st.sun).toBe('none');
  expect(st.moon).not.toBe('none');

  await page.click('#theme-toggle');

  st = await page.evaluate(function () {
    const t = document.getElementById('theme-toggle');
    return {
      isLight: t.classList.contains('is-light'),
      checked: t.getAttribute('aria-checked'),
      sun:     window.getComputedStyle(t.querySelector('.thm-sun')).display,
      moon:    window.getComputedStyle(t.querySelector('.thm-moon')).display,
    };
  });
  expect(st.isLight).toBe(true);
  expect(st.checked).toBe('true');
  expect(st.sun).not.toBe('none');
  expect(st.moon).toBe('none');
});

// ---------------------------------------------------------------------------
// A second click reverts to dark and REMOVES the attribute (R-0001)
// ---------------------------------------------------------------------------
test('a second click reverts to dark and removes data-theme', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.click('#theme-toggle');
  await page.click('#theme-toggle');
  const state = await page.evaluate(function () {
    return {
      attr:    document.documentElement.getAttribute('data-theme'),
      bg:      window.getComputedStyle(document.body).backgroundColor,
      checked: document.getElementById('theme-toggle').getAttribute('aria-checked'),
    };
  });
  expect(state.attr).toBeNull();
  expect(state.bg).toBe('rgb(14, 18, 22)');
  expect(state.checked).toBe('false');
});

// ---------------------------------------------------------------------------
// Choice persists across a reload
// ---------------------------------------------------------------------------
test('chosen light theme persists across a page reload', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.click('#theme-toggle');
  expect(await bgOf(page, 'body')).toBe('rgb(244, 246, 248)');

  await page.reload();
  await expect(page.locator('#theme-toggle')).toBeVisible();
  const after = await page.evaluate(function () {
    return {
      attr:    document.documentElement.getAttribute('data-theme'),
      bg:      window.getComputedStyle(document.body).backgroundColor,
      isLight: document.getElementById('theme-toggle').classList.contains('is-light'),
      stored:  window.localStorage.getItem('iptv_theme'),
    };
  });
  expect(after.attr).toBe('light');
  expect(after.bg).toBe('rgb(244, 246, 248)');
  expect(after.isLight).toBe(true);
  expect(after.stored).toBe('light');
});

// ---------------------------------------------------------------------------
// Independent activation: toggling theme does not open the account panel
// ---------------------------------------------------------------------------
test('clicking the toggle does not open the account panel', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.click('#theme-toggle');
  await expect(page.locator('#acct-panel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#acct-panel')).toHaveAttribute('aria-hidden', 'true');
  // and opening the account panel does not change the theme
  await page.click('#acct-btn');
  await expect(page.locator('#acct-panel')).toHaveClass(/is-open/);
  const attr = await page.evaluate(function () {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(attr).toBe('light');
});

// ---------------------------------------------------------------------------
// Keyboard-activatable two-state switch
// ---------------------------------------------------------------------------
test('toggle is keyboard-focusable and activates via Enter', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.locator('#theme-toggle').focus();
  await expect(page.locator('#theme-toggle')).toBeFocused();
  await page.keyboard.press('Enter');
  const attr = await page.evaluate(function () {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(attr).toBe('light');
});

// ---------------------------------------------------------------------------
// Screenshots — light + dark for the PR Test Results block
// ---------------------------------------------------------------------------
test('capture dark and light theme screenshots', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'test-results/theme-dark.png' });
  await page.click('#theme-toggle');
  await expect(page.locator('#theme-toggle')).toHaveClass(/is-light/);
  await page.screenshot({ path: 'test-results/theme-light.png' });
});
