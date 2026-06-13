// ADR: ADR-0024
// UI tests — column gutters + both 56px headers on one line (TASK-0048,
// spacing-sizing.md rules 2 + 5). On a 1280px viewport the content-column
// blocks (.content-head, .player-card, .ch-section content, .footer) share one
// content-left x (24px gutter), the sidebar blocks share one block-left x
// (16px gutter), and both column headers measure 56px tall with bottom borders
// on the same y. At a 750px viewport the content gutter narrows to 16px.
// Captures task-0048-gutters.png to the run-artifacts dir.

'use strict';

const { test, expect } = require('@playwright/test');

// Content-left x of a block = its left edge + its computed padding-left.
async function contentLeft(page, sel) {
  return page.evaluate(function measure(s) {
    const el = document.querySelector(s);
    const r  = el.getBoundingClientRect();
    const pl = parseFloat(window.getComputedStyle(el).paddingLeft);
    return r.left + pl;
  }, sel);
}

// Plain left edge of a block (no padding offset).
async function leftX(page, sel) {
  return page.evaluate(function measure(s) {
    return document.querySelector(s).getBoundingClientRect().left;
  }, sel);
}

async function paddingLeft(page, sel) {
  return page.evaluate(function measure(s) {
    return parseFloat(window.getComputedStyle(document.querySelector(s)).paddingLeft);
  }, sel);
}

async function box(page, sel) {
  return page.locator(sel).boundingBox();
}

test('content column blocks share one content-left x (24px gutter)', async function ({ page }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000');

  const head    = await contentLeft(page, '.content-head');
  const player  = await leftX(page, '.player-card'); // card sits at wrap's content-left
  const section = await contentLeft(page, '.ch-section');

  // Within the content column, content-left edges line up on the 24px gutter
  // line (sub-pixel tolerance). The footer is a full-app-width block, so it
  // carries the same 24px gutter but from the page's left edge — asserted by
  // its padding below, not by absolute-x equality with the column blocks.
  expect(Math.abs(player - head)).toBeLessThanOrEqual(1);
  expect(Math.abs(section - head)).toBeLessThanOrEqual(1);

  // The gutter is exactly 24px on every content block (incl. the footer).
  expect(await paddingLeft(page, '.content-head')).toBeCloseTo(24, 0);
  expect(await paddingLeft(page, '.player-wrap')).toBeCloseTo(24, 0);
  expect(await paddingLeft(page, '.ch-section')).toBeCloseTo(24, 0);
  expect(await paddingLeft(page, '.footer')).toBeCloseTo(24, 0);
});

test('sidebar column blocks share one left x (16px gutter)', async function ({ page }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000');

  const head   = await leftX(page, '.sidebar-head');
  const search = await leftX(page, '.sidebar-search');
  const list   = await leftX(page, '.sidebar-list');

  expect(Math.abs(search - head)).toBeLessThanOrEqual(1);
  expect(Math.abs(list - head)).toBeLessThanOrEqual(1);

  expect(await paddingLeft(page, '.sidebar-head')).toBeCloseTo(16, 0);
  expect(await paddingLeft(page, '.sidebar-search')).toBeCloseTo(16, 0);
  expect(await paddingLeft(page, '.sidebar-list')).toBeCloseTo(16, 0);
});

test('both column headers are 56px tall with bottom borders on one line', async function ({ page }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000');

  const sh = await box(page, '.sidebar-head');
  const ch = await box(page, '.content-head');

  expect(Math.round(sh.height)).toBe(56);
  expect(Math.round(ch.height)).toBe(56);
  expect(Math.round(sh.height)).toBe(Math.round(ch.height));

  // Bottom borders sit at the same y (sub-pixel tolerance).
  const shBottom = sh.y + sh.height;
  const chBottom = ch.y + ch.height;
  expect(Math.abs(shBottom - chBottom)).toBeLessThanOrEqual(1);

  await page.screenshot({ path: 'test-results/task-0048-gutters.png' });
});

test('content gutter narrows to 16px at the 750px viewport', async function ({ page }) {
  await page.setViewportSize({ width: 750, height: 600 });
  await page.goto('http://localhost:3000');

  expect(await paddingLeft(page, '.content-head')).toBeCloseTo(16, 0);
  expect(await paddingLeft(page, '.player-wrap')).toBeCloseTo(16, 0);
  expect(await paddingLeft(page, '.ch-section')).toBeCloseTo(16, 0);
  expect(await paddingLeft(page, '.footer')).toBeCloseTo(16, 0);
});
