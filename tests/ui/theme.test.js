// ADR: ADR-0019
// UI tests — light-theme token override takes effect for TASK-0037. This task
// adds the data layer + the :root[data-theme="light"] CSS rule; the visible
// sun/moon toggle CONTROL is TASK-0038, so it is NOT asserted here. We verify
// (1) the baseline <html> ships with NO data-theme attribute (Rule R-0001:
// never assert an attribute that was never in the source), and (2) setting
// data-theme="light" on <html> recolours the page through the token override.

'use strict';

const { test, expect } = require('@playwright/test');

test('baseline <html> ships with no data-theme attribute (R-0001)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const attr = await page.evaluate(function () {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(attr).toBeNull();
});

test('default page background is the dark --bg token #0E1216', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const bg = await page.evaluate(function () {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  // rgb(14, 18, 22) is #0E1216 — the dark default with no data-theme set.
  expect(bg).toBe('rgb(14, 18, 22)');
});

test('data-theme="light" recolours background, surface, and text', async function ({ page }) {
  await page.goto('http://localhost:3000');

  const dark = await page.evaluate(function () {
    const body = window.getComputedStyle(document.body);
    const side = window.getComputedStyle(document.querySelector('.sidebar'));
    return { bg: body.backgroundColor, tx: body.color, sur: side.backgroundColor };
  });

  await page.evaluate(function () {
    document.documentElement.setAttribute('data-theme', 'light');
  });

  const light = await page.evaluate(function () {
    const body = window.getComputedStyle(document.body);
    const side = window.getComputedStyle(document.querySelector('.sidebar'));
    return { bg: body.backgroundColor, tx: body.color, sur: side.backgroundColor };
  });

  // The token override must change every one of these computed colours.
  expect(light.bg).not.toBe(dark.bg);
  expect(light.tx).not.toBe(dark.tx);
  expect(light.sur).not.toBe(dark.sur);

  // And the light background must be the new light --bg token (#F4F6F8).
  expect(light.bg).toBe('rgb(244, 246, 248)');
});

test('removing data-theme reverts to the dark default', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.evaluate(function () {
    document.documentElement.removeAttribute('data-theme');
  });
  const bg = await page.evaluate(function () {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  expect(bg).toBe('rgb(14, 18, 22)');
});

test('data-theme="dark" yields the same colours as no attribute', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  const bg = await page.evaluate(function () {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  expect(bg).toBe('rgb(14, 18, 22)');
});
