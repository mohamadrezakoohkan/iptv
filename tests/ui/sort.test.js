// ADR: ADR-0017
// UI tests — channel sort logic regression (TASK-0033). The sort CONTROL is
// TASK-0035; this file only proves the new required `sort` argument did not
// break any getChs call site: the real demo-connect path (onOk -> real getChs)
// must still render the grid in the default num-ascending order, and the
// exported SORTS list + getChs signature must be live in the real bundle.

'use strict';

const { test, expect } = require('@playwright/test');

async function setup(page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
  });
}

// ---------------------------------------------------------------------------
// Exported sort surface is present in the real loaded modules
// ---------------------------------------------------------------------------
test('window.IptvSrch.SORTS is the four tokens in order', async function ({ page }) {
  await setup(page);
  const ids = await page.evaluate(function () {
    return window.IptvSrch.SORTS.map(function id(o) { return o.id; });
  });
  expect(ids).toEqual(['num-asc', 'name-asc', 'name-desc', 'fav-first']);
});

test('ST.sort defaults to num-asc in the real state module', async function ({ page }) {
  await setup(page);
  const sort = await page.evaluate(function () { return window.IptvSt.ST.sort; });
  expect(sort).toBe('num-asc');
});

// ---------------------------------------------------------------------------
// Full demo connect — real onOk -> real getChs(...,sort). Default order must
// be unchanged (num ascending: 001, 002, 003, ...) and produce all 31 cards.
// ---------------------------------------------------------------------------
test('demo connect renders the grid in default num-ascending order (no half-migration)', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  const cards = page.locator('.ch-card');
  await expect(cards).toHaveCount(31);
  const nums = await page.locator('.ch-card .ch-num').allTextContents();
  expect(nums[0]).toBe('001');
  expect(nums[1]).toBe('002');
  expect(nums[2]).toBe('003');
  // strictly ascending across the whole grid
  const asInt = nums.map(function toN(s) { return parseInt(s, 10); });
  const sorted = asInt.slice().sort(function cmp(a, b) { return a - b; });
  expect(asInt).toEqual(sorted);
});

// ---------------------------------------------------------------------------
// Search after connect (onSrch -> debounced fireSrch -> real getChs) still
// renders matching cards in num-ascending order at the default sort — proves
// the fireSrch call site was migrated with the new sort argument.
// ---------------------------------------------------------------------------
test('search after connect keeps default num-ascending order', async function ({ page }) {
  await setup(page);
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 3000 });
  // type a query that matches several channels across numbers ("24", "HD"…)
  await page.fill('#search', 'a');
  // wait for the debounced re-render to settle and produce matches
  await expect.poll(async function cnt() {
    return await page.locator('.ch-card').count();
  }, { timeout: 3000 }).toBeGreaterThan(0);
  const nums = await page.locator('.ch-card .ch-num').allTextContents();
  const asInt = nums.map(function toN(s) { return parseInt(s, 10); });
  const sorted = asInt.slice().sort(function cmp(a, b) { return a - b; });
  expect(asInt).toEqual(sorted);
});
