// ADR: ADR-0024
// UI tests — the twelve 4px-grid geometry tokens (TASK-0047) resolve to their
// contracted px values on document.documentElement in the running page, and
// switching to the light theme leaves every geometry token unchanged (they are
// theme-agnostic). Page-renders-without-error smoke stays green.

'use strict';

const { test, expect } = require('@playwright/test');

// The twelve declared tokens of the contract → their contracted px values.
const TOKENS = {
  '--s1': '4px',
  '--s2': '8px',
  '--s3': '12px',
  '--s4': '16px',
  '--s5': '20px',
  '--s6': '24px',
  '--gut': '24px',
  '--sgut': '16px',
  '--ctl': '36px',
  '--hd': '56px',
  '--r1': '6px',
  '--r2': '8px',
};

function readTokens(names) {
  const cs = window.getComputedStyle(document.documentElement);
  const out = {};
  names.forEach(function nm(n) { out[n] = cs.getPropertyValue(n).trim(); });
  return out;
}

test('every geometry token resolves to its contracted px value', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const got = await page.evaluate(readTokens, Object.keys(TOKENS));
  Object.keys(TOKENS).forEach(function chk(tok) {
    expect(got[tok]).toBe(TOKENS[tok]);
  });
});

test('switching to the light theme leaves every geometry token unchanged', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const names = Object.keys(TOKENS);

  const dark = await page.evaluate(readTokens, names);

  await page.evaluate(function () {
    document.documentElement.setAttribute('data-theme', 'light');
  });

  const light = await page.evaluate(readTokens, names);

  names.forEach(function chk(tok) {
    expect(light[tok]).toBe(dark[tok]);
    expect(light[tok]).toBe(TOKENS[tok]);
  });
});

test('page renders the app shell without error', async function ({ page }) {
  const errs = [];
  page.on('pageerror', function onErr(e) { errs.push(String(e)); });
  await page.goto('http://localhost:3000');
  await expect(page.locator('.app-main')).toBeVisible();
  expect(errs).toEqual([]);
});
