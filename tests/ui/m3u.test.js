// ADR: ADR-0008, ADR-0020
// UI tests — M3U URL connect flow for TASK-0012 (explicit mode since TASK-0018)
// + first-level M3U sidebar / intact Xtream sidebar for TASK-0042 (ADR-0020).

'use strict';

const { test, expect } = require('@playwright/test');

const M3U_URL = 'https://iptv-org.github.io/iptv/index.m3u';

// Multi-group M3U fixture — under ADR-0005 each distinct raw group-title became
// its own button; under ADR-0020 only the first-level segment is a category, so
// the three Classic;* variants collapse to a single "Classic" button.
const M3U_FIXTURE = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="a" group-title="Classic;Comedy;Public;Series",Channel A',
  'http://stream.example.com/a',
  '#EXTINF:-1 tvg-id="b" group-title="Classic;Series",Channel B',
  'http://stream.example.com/b',
  '#EXTINF:-1 tvg-id="c" group-title="Classic;Music",Channel C',
  'http://stream.example.com/c',
].join('\n');

test('connect with M3U URL shows either footer-conn or footer-err within 15s (no JS exception)', async function ({ page }) {
  const jsErrors = [];
  page.on('pageerror', function onErr(err) { jsErrors.push(err.message); });

  await page.goto('http://localhost:3000');

  await page.check('#mode-m3u');
  await page.fill('#f-url', M3U_URL);
  await page.click('#btn-conn');

  const connLoc = page.locator('#footer-conn');
  const errLoc  = page.locator('#footer-err');

  const settled = await Promise.race([
    connLoc.waitFor({ state: 'visible', timeout: 15000 }).then(function () { return 'conn'; }),
    errLoc.waitFor({ state: 'visible', timeout: 15000 }).then(function () { return 'err'; }),
  ]);

  if (settled === 'conn') {
    await expect(connLoc).toBeVisible();
  } else {
    const errText = await errLoc.textContent();
    expect(typeof errText).toBe('string');
    expect(errText.length).toBeGreaterThan(0);
  }

  expect(jsErrors).toEqual([]);
});

test('M3U source renders deduplicated first-level category buttons (ADR-0020)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const cnt = await page.evaluate(function (txt) {
    window.IptvUi.mkEL();
    const parsed = window.IptvApi.parsM3u(txt);
    window.IptvUi.rndSide(parsed.val.categories, parsed.val.channels, []);
    return { cats: parsed.val.categories.length, chs: parsed.val.channels.length };
  }, M3U_FIXTURE);
  // The three Classic;* variants collapse to one "Classic" category.
  expect(cnt.cats).toBe(1);
  expect(cnt.chs).toBe(3);
  // All Channels + the single first-level "Classic" button — two buttons total.
  await expect(page.locator('#grp-nav .cat-btn')).toHaveCount(2);
  const allBtn = page.locator('[data-cat="all"]');
  await expect(allBtn).toBeVisible();
  await expect(allBtn).toContainText('All Channels');
  const classicBtn = page.locator('[data-cat="Classic"]');
  await expect(classicBtn).toBeVisible();
  await expect(classicBtn).toContainText('Classic');
  // No semicolon-bearing raw group-title leaked into a button label.
  await expect(page.locator('#grp-nav')).not.toContainText('Classic;');
});

test('M3U source with favourites adds the Favourites button alongside first-level cats (ADR-0020)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function (txt) {
    window.IptvUi.mkEL();
    const parsed = window.IptvApi.parsM3u(txt);
    window.IptvUi.rndSide(parsed.val.categories, parsed.val.channels, [parsed.val.channels[0]]);
  }, M3U_FIXTURE);
  // All Channels + Favourites + one "Classic" first-level button — three total.
  await expect(page.locator('#grp-nav .cat-btn')).toHaveCount(3);
  await expect(page.locator('[data-cat="all"]')).toBeVisible();
  await expect(page.locator('[data-cat="favs"]')).toContainText('Favourites');
  await expect(page.locator('[data-cat="Classic"]')).toContainText('Classic');
});

test('Xtream / demo-shaped categories still render their category buttons', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function () {
    window.IptvUi.mkEL();
    const cats = [
      { category_id: 'news', category_name: 'News' },
      { category_id: 'sport', category_name: 'Sports' },
    ];
    const chs = [
      { id: '1', name: 'World News', cat: 'news', num: 1, img: '' },
      { id: '2', name: 'Football Hub', cat: 'sport', num: 2, img: '' },
    ];
    window.IptvUi.rndSide(cats, chs, []);
  });
  await expect(page.locator('[data-cat="all"]')).toBeVisible();
  await expect(page.locator('[data-cat="news"]')).toContainText('News');
  await expect(page.locator('[data-cat="sport"]')).toContainText('Sports');
});
