// ADR: ADR-0001
// UI tests — Sidebar + search component for TASK-0005
// Note: tests that require demo connect (footer form wiring) are deferred
// to TASK-0008/TASK-0009. This file tests sidebar structure only.

'use strict';

const { test, expect } = require('@playwright/test');

test('sidebar element is visible on page load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
});

test('sidebar search input is present and accepts text', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const inp = page.locator('#search');
  await expect(inp).toBeVisible();
  await inp.fill('test');
  await expect(inp).toHaveValue('test');
});

test('sidebar-list container (#grp-nav) is present in DOM', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const nav = page.locator('#grp-nav');
  await expect(nav).toBeAttached();
});

test('sidebar brand name is visible', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const brand = page.locator('.brand-name');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveText('IPTV');
});

test('IptvUi is exposed on window after scripts load', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const hasUi = await page.evaluate(function () {
    return typeof window.IptvUi !== 'undefined'
      && typeof window.IptvUi.rndSide === 'function'
      && typeof window.IptvUi.rndGrid === 'function';
  });
  expect(hasUi).toBe(true);
});

test('IptvSrch.getChs is exposed on window and is a function', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const hasSrch = await page.evaluate(function () {
    return typeof window.IptvSrch !== 'undefined'
      && typeof window.IptvSrch.getChs === 'function';
  });
  expect(hasSrch).toBe(true);
});

test('rndSide renders All Channels button into #grp-nav', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    const cats = [{ id: 'news', name: 'News' }, { id: 'sports', name: 'Sports' }];
    const chs  = [
      { id: '1', name: 'World News', cat: 'news', num: 1, img: '' },
      { id: '2', name: 'Football Hub', cat: 'sports', num: 2, img: '' },
    ];
    window.IptvUi.rndSide(cats, chs, []);
  });
  const allBtn = page.locator('[data-cat="all"]');
  await expect(allBtn).toBeVisible();
  await expect(allBtn).toContainText('All Channels');
});

test('rndSide active button matches ST.flt (default "all")', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    const cats = [{ id: 'news', name: 'News' }];
    const chs  = [{ id: '1', name: 'World News', cat: 'news', num: 1, img: '' }];
    window.IptvUi.rndSide(cats, chs, []);
  });
  const allBtn = page.locator('[data-cat="all"]');
  await expect(allBtn).toHaveClass(/active/);
});

test('rndSide renders category button with badge count', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    const cats = [{ id: 'news', name: 'News' }];
    const chs  = [
      { id: '1', name: 'World News', cat: 'news', num: 1, img: '' },
      { id: '2', name: 'Headlines', cat: 'news', num: 2, img: '' },
    ];
    window.IptvUi.rndSide(cats, chs, []);
  });
  const newsBtn = page.locator('[data-cat="news"]');
  await expect(newsBtn).toBeVisible();
  await expect(newsBtn.locator('.cat-count')).toContainText('2');
});

test('clicking category button updates active class', async function ({ page }) {
  await page.goto('http://localhost:3000');
  // Init EL first, then render sidebar
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    const cats = [{ id: 'news', name: 'News' }, { id: 'sports', name: 'Sports' }];
    const chs  = [
      { id: '1', name: 'World News', cat: 'news', num: 1, img: '' },
      { id: '2', name: 'Football Hub', cat: 'sports', num: 2, img: '' },
    ];
    window.IptvSt.setChs(chs, cats, 'demo', 'demo');
    window.IptvUi.rndSide(cats, chs, []);
  });
  const newsBtn = page.locator('[data-cat="news"]');
  await newsBtn.click();
  await expect(newsBtn).toHaveClass(/active/);
});
