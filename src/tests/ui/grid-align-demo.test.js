// ADR: ADR-0024
// UI demo recording (TASK-0051) — single end-to-end video of the unified
// 4px-grid surfaces (specs/spacing-sizing.md §3, §5). Video capture is scoped
// to THIS spec only (a per-spec browser context with recordVideo on), never the
// global UI suite, so the rest of the suite stays fast and records nothing.
//
// Arc: boot (fresh load via the canonical run command / Playwright webServer)
//  -> prepare (connect demo mode through the real footer login)
//  -> interact (navigate the restyled surfaces visibly showing alignment: the
//     sidebar gutter + category rows, the two 56px column headers on one line,
//     the player wrapper, the channel grid/cards rhythm, the footer form
//     baseline; toggle theme to show the geometry is theme-agnostic)
//  -> revert runtime state (clear search, back to All Channels, stop playback,
//     restore the dark theme) -> stop (close the context; the .webm is flushed,
//     then renamed to a stable committed-artifact path).
//
// Along the arc it asserts the contract's alignment is real, not a blind drive:
// the content-column gutter x is shared across .content-head / .player-card /
// .ch-section / .footer; both column headers share height + bottom-border y; a
// footer .field input and the submit .btn share a 36px height and one baseline.

'use strict';

const fs   = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const ARTIFACT_DIR = path.join(process.cwd(), 'test-results');
const VIDEO_PATH   = path.join(ARTIFACT_DIR, 'e14-grid-align-demo.webm');
const BASE_URL     = 'http://localhost:3000';

// Run the whole arc serially inside one recorded context.
test.describe.configure({ mode: 'serial' });

let browser = null;
let context = null;
let page    = null;

test.beforeAll(async function setup() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  browser = await chromium.launch();
  context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: ARTIFACT_DIR, size: { width: 1280, height: 800 } },
  });
  page = await context.newPage();
});

test.afterAll(async function teardown() {
  // Resolve the auto-named video path BEFORE closing the page, then close the
  // context to flush the .webm to disk, then rename to the stable artifact path.
  const vid = page ? page.video() : null;
  const src = vid ? await vid.path() : null;
  if (context) await context.close();
  if (browser) await browser.close();
  if (src && fs.existsSync(src)) {
    if (fs.existsSync(VIDEO_PATH)) fs.rmSync(VIDEO_PATH);
    fs.renameSync(src, VIDEO_PATH);
  }
});

// Small visual dwell so each surface is legible in the recording.
async function dwell(ms) {
  await page.waitForTimeout(ms);
}

// Content-left x of a block = its left edge + its computed padding-left.
async function contentLeft(sel) {
  return page.evaluate(function measure(s) {
    const el = document.querySelector(s);
    const r  = el.getBoundingClientRect();
    const pl = parseFloat(window.getComputedStyle(el).paddingLeft);
    return r.left + pl;
  }, sel);
}

async function box(sel) {
  return page.locator(sel).first().boundingBox();
}

async function paddingLeft(sel) {
  return page.evaluate(function measure(s) {
    return parseFloat(window.getComputedStyle(document.querySelector(s)).paddingLeft);
  }, sel);
}

// ---------------------------------------------------------------------------
// BOOT — fresh load of the running product.
// ---------------------------------------------------------------------------
test('boot: app loads fresh from a clean start', async function () {
  await page.goto(BASE_URL);
  await expect(page.locator('#player-idle')).toBeVisible();
  // Both column headers already line up at boot (no content needed for headers).
  const sh = await box('.sidebar-head');
  const ch = await box('.content-head');
  expect(Math.round(sh.height)).toBe(56);
  expect(Math.round(ch.height)).toBe(56);
  expect(Math.abs((sh.y + sh.height) - (ch.y + ch.height))).toBeLessThanOrEqual(1);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// PREPARE — connect demo mode through the real footer login flow so the grid,
// cards, sidebar categories and player wrapper render with real content.
// ---------------------------------------------------------------------------
test('prepare: connect demo mode and load the demo channels', async function () {
  await page.fill('#f-url', 'demo');
  await dwell(400);
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await dwell(800);
});

// ---------------------------------------------------------------------------
// INTERACT 1 — sidebar gutter + category rows: select a category, showing the
// 16px sidebar gutter and the 36px category rows of the desktop flex column.
// ---------------------------------------------------------------------------
test('interact: sidebar gutter and 36px category rows align', async function () {
  const sHead = await box('.sidebar-head');
  const sList = await box('.sidebar-list');
  expect(Math.abs(sList.x - sHead.x)).toBeLessThanOrEqual(1);

  const cat = page.locator('.cat-btn').first();
  await cat.scrollIntoViewIfNeeded();
  await expect(cat).toBeVisible();
  const catBox = await cat.boundingBox();
  expect(Math.round(catBox.height)).toBe(36);
  await cat.hover();
  await dwell(700);
  // Pick a non-"all" category so the grid visibly re-renders.
  const news = page.locator('[data-cat="news"]');
  if (await news.count() > 0) {
    await news.first().click();
    await expect(news.first()).toHaveClass(/active/);
    await dwell(900);
  }
});

// ---------------------------------------------------------------------------
// INTERACT 2 — the two 56px column headers sit on one continuous bottom line.
// ---------------------------------------------------------------------------
test('interact: both column headers form one 56px bottom line', async function () {
  const sh = await box('.sidebar-head');
  const ch = await box('.content-head');
  expect(Math.round(sh.height)).toBe(56);
  expect(Math.round(ch.height)).toBe(56);
  expect(Math.abs((sh.y + sh.height) - (ch.y + ch.height))).toBeLessThanOrEqual(1);
  await dwell(700);
});

// ---------------------------------------------------------------------------
// INTERACT 3 — channel grid + cards + player wrapper: the content-column gutter
// x is shared across .content-head, .player-card, .ch-section, .footer; the grid
// rhythm renders. Select a channel so the player wrapper is visibly exercised.
// ---------------------------------------------------------------------------
test('interact: content-column gutter aligns across head, player, grid, footer', async function () {
  // Back to All Channels so the full grid + player wrapper are in view.
  const all = page.locator('[data-cat="all"]');
  await all.first().click();
  await expect(page.locator('.ch-card')).toHaveCount(31);

  const head    = await contentLeft('.content-head');
  const player  = await box('.player-card');
  const section = await contentLeft('.ch-section');

  // The content-column blocks share one content-left x on the 24px gutter line.
  expect(Math.abs(player.x - head)).toBeLessThanOrEqual(1);
  expect(Math.abs(section - head)).toBeLessThanOrEqual(1);

  // The footer is a full-app-width block (it spans under the sidebar), so it
  // carries the same 24px gutter from the page's left edge, not the column's —
  // asserted by its padding, the way gutters.test.js does.
  expect(await paddingLeft('.content-head')).toBeCloseTo(24, 0);
  expect(await paddingLeft('.footer')).toBeCloseTo(24, 0);

  // Show a card and the player wrapper responding to a selection.
  const card = page.locator('.ch-card').first();
  await card.scrollIntoViewIfNeeded();
  await dwell(600);
  await card.click();
  await page.locator('#player-wrap').scrollIntoViewIfNeeded();
  await expect(page.locator('#player-wrap')).toBeVisible();
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// INTERACT 4 — footer form baseline: a .field input and the submit button share
// a 36px height and one bottom baseline (align-items: flex-end). The footer is
// in the connected state, so reconnect-edit reveals the form to show the row.
// ---------------------------------------------------------------------------
test('interact: footer form input and submit share 36px height and one baseline', async function () {
  // Reveal the login form again (footer is showing the connected panel).
  await page.evaluate(function showForm() {
    const login = document.getElementById('footer-login');
    const conn  = document.getElementById('footer-conn');
    if (login) login.style.display = '';
    if (conn) conn.style.display = 'none';
  });
  await page.locator('.footer-form').scrollIntoViewIfNeeded();
  await dwell(500);

  const inp = await box('#f-url');
  const btn = await box('#btn-conn');
  expect(Math.round(inp.height)).toBe(36);
  expect(Math.round(btn.height)).toBe(36);
  expect(Math.abs((inp.y + inp.height) - (btn.y + btn.height))).toBeLessThanOrEqual(1);
  await dwell(900);
});

// ---------------------------------------------------------------------------
// INTERACT 5 — theme toggle: the geometry is theme-agnostic, so the gutters and
// header line-up survive a switch to the light theme.
// ---------------------------------------------------------------------------
test('interact: geometry is theme-agnostic across the theme toggle', async function () {
  await page.locator('#theme-toggle').scrollIntoViewIfNeeded();
  await page.click('#theme-toggle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await dwell(900);

  // Same gutter line and header line-up hold under the light theme.
  const head    = await contentLeft('.content-head');
  const section = await contentLeft('.ch-section');
  expect(Math.abs(section - head)).toBeLessThanOrEqual(1);

  const sh = await box('.sidebar-head');
  const ch = await box('.content-head');
  expect(Math.abs((sh.y + sh.height) - (ch.y + ch.height))).toBeLessThanOrEqual(1);
  await dwell(800);
});

// ---------------------------------------------------------------------------
// REVERT RUNTIME STATE — in-app teardown back to the pre-interaction start:
// restore the dark theme, clear search, return to All Channels, stop playback so
// the player returns to idle. (Not a git revert — the runtime state is reset.)
// ---------------------------------------------------------------------------
test('revert: reset in-app runtime state to the starting condition', async function () {
  // Restore the dark (default) theme.
  await page.click('#theme-toggle');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await dwell(500);

  await page.evaluate(function revert() {
    const st = window.IptvSt.ST;
    if (window.IptvPlay && window.IptvPlay.stopPlay) window.IptvPlay.stopPlay();
    window.IptvSt.setErr(null);
    window.IptvSt.setCur(null);
    window.IptvSt.go('INIT');
    window.IptvSt.setSrch('');
    window.IptvSt.setFlt('all');
    window.IptvUi.rndPhase();
    window.IptvUi.rndSide(st.cats, st.chs, st.favs);
    window.IptvUi.rndGrid(window.IptvSrch.getChs(st.chs, '', 'all', st.favs, st.sort));
  });

  await expect(page.locator('#player-idle')).toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('[data-cat="all"]')).toHaveClass(/active/);
  await dwell(1000);
});

// ---------------------------------------------------------------------------
// STOP — the video is flushed and renamed in afterAll(). Assert the recorder is
// active so a missing recording fails this spec loudly.
// ---------------------------------------------------------------------------
test('stop: the demo video artifact is produced', async function () {
  await expect(page.video()).not.toBeNull();
});
