// ADR: ADR-0001
// UI tests — CSS layout verification for TASK-0004

'use strict';

const { test, expect } = require('@playwright/test');

test('app-main is visible', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const appMain = page.locator('.app-main');
  await expect(appMain).toBeVisible();
});

test('body background matches --bg token #0E1216', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const bg = await page.evaluate(function () {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  // rgb(14, 18, 22) is #0E1216
  expect(bg).toBe('rgb(14, 18, 22)');
});

test('sidebar is ~240px wide on 1280px viewport', async function ({ page }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000');
  const sidebar = page.locator('.sidebar');
  const box = await sidebar.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(238);
  expect(box.width).toBeLessThanOrEqual(242);
});

test('sidebar is horizontal strip on 750px viewport', async function ({ page }) {
  await page.setViewportSize({ width: 750, height: 600 });
  await page.goto('http://localhost:3000');
  const sidebar = page.locator('.sidebar');
  const flexDir = await sidebar.evaluate(function (el) {
    return window.getComputedStyle(el).flexDirection;
  });
  expect(flexDir).toBe('row');
});
