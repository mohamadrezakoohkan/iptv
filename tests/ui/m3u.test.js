// ADR: ADR-0005
// UI tests — M3U URL connect flow for TASK-0012

'use strict';

const { test, expect } = require('@playwright/test');

const M3U_URL = 'https://iptv-org.github.io/iptv/index.m3u';

test('connect with M3U URL shows either footer-conn or footer-err within 15s (no JS exception)', async function ({ page }) {
  const jsErrors = [];
  page.on('pageerror', function onErr(err) { jsErrors.push(err.message); });

  await page.goto('http://localhost:3000');

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
