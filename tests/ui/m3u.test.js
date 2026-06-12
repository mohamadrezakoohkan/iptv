// ADR: ADR-0008, ADR-0020
// UI tests — M3U URL connect flow for TASK-0012 (explicit mode since TASK-0018)
// + flat M3U sidebar / intact Xtream sidebar for TASK-0042 (ADR-0020).

'use strict';

const { test, expect } = require('@playwright/test');

const M3U_URL = 'https://iptv-org.github.io/iptv/index.m3u';

// Multi-group M3U fixture — under ADR-0005 these distinct group-title values
// would each have become a sidebar category button; under ADR-0020 none do.
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

test('M3U source renders a FLAT sidebar — only All Channels, zero category buttons (ADR-0020)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const cnt = await page.evaluate(function (txt) {
    window.IptvUi.mkEL();
    const parsed = window.IptvApi.parsM3u(txt);
    window.IptvUi.rndSide(parsed.val.categories, parsed.val.channels, []);
    return { cats: parsed.val.categories.length, chs: parsed.val.channels.length };
  }, M3U_FIXTURE);
  expect(cnt.cats).toBe(0);
  expect(cnt.chs).toBe(3);
  // Exactly one sidebar button: All Channels. No favourites, no group buttons.
  await expect(page.locator('#grp-nav .cat-btn')).toHaveCount(1);
  const allBtn = page.locator('[data-cat="all"]');
  await expect(allBtn).toBeVisible();
  await expect(allBtn).toContainText('All Channels');
  // None of the noisy group-title strings became buttons.
  await expect(page.locator('#grp-nav')).not.toContainText('Classic;');
});

test('M3U source with favourites adds only the Favourites button (still flat) (ADR-0020)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.evaluate(function (txt) {
    window.IptvUi.mkEL();
    const parsed = window.IptvApi.parsM3u(txt);
    window.IptvUi.rndSide(parsed.val.categories, parsed.val.channels, [parsed.val.channels[0]]);
  }, M3U_FIXTURE);
  await expect(page.locator('#grp-nav .cat-btn')).toHaveCount(2);
  await expect(page.locator('[data-cat="all"]')).toBeVisible();
  await expect(page.locator('[data-cat="favs"]')).toContainText('Favourites');
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
