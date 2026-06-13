// ADR: ADR-0024
// UI tests — control heights, footer baseline, secondary-control sizing, the
// 28x28 star hit box, 36px category rows, and the one global focus ring
// (TASK-0050, spacing-sizing.md rules 3 + 7 + 8 + 10). In demo mode (so cards,
// chips and category rows render) the running page measures: a .field input and
// the connect button both 36px tall with equal bounding-box bottoms (one
// baseline); a .fmt-chip 28px tall; a .ch-fav 28x28; a .cat-btn 36px tall; and
// tabbing to a control yields the single global 2px solid accent outline at 1px
// offset. Captures task-0050-footer-baseline.png to the run-artifacts dir.

'use strict';

const { test, expect } = require('@playwright/test');

// Connect demo mode through the real footer login flow, then wait for the grid.
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

async function box(page, sel) {
  return page.locator(sel).first().boundingBox();
}

// The accent colour resolved on the running page (theme-dependent token).
async function accentRgb(page) {
  return page.evaluate(function read() {
    const cs = window.getComputedStyle(document.documentElement);
    return cs.getPropertyValue('--acc').trim();
  });
}

test('the portal input and connect button are both 36px and share one baseline', async function ({ page }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000');

  const inp = await box(page, '#f-url');
  const btn = await box(page, '#btn-conn');

  expect(Math.round(inp.height)).toBe(36);
  expect(Math.round(btn.height)).toBe(36);

  // align-items: flex-end → the input row and the submit button bottoms align.
  const inpBottom = inp.y + inp.height;
  const btnBottom = btn.y + btn.height;
  expect(Math.abs(inpBottom - btnBottom)).toBeLessThanOrEqual(1);

  await page.locator('.footer-form').screenshot({ path: 'test-results/task-0050-footer-baseline.png' });
});

test('the login-mode segmented control is 36px tall (primary control)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const lm = await box(page, '.login-mode');
  expect(Math.round(lm.height)).toBe(36);
});

test('a format chip is 28px tall (secondary control)', async function ({ page }) {
  await page.goto('http://localhost:3000');
  const chip = await box(page, '.fmt-chip');
  expect(Math.round(chip.height)).toBe(28);
});

test('a favourite-star control has a real 28x28 hit box', async function ({ page }) {
  await connectDemo(page);
  const fav = await box(page, '.ch-fav');
  expect(Math.round(fav.width)).toBe(28);
  expect(Math.round(fav.height)).toBe(28);
});

test('a category row is 36px tall in the desktop flex column', async function ({ page }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await connectDemo(page);
  const cat = await box(page, '.cat-btn');
  expect(Math.round(cat.height)).toBe(36);
});

test('tabbing to a control yields the single global focus ring (2px solid accent, 1px offset)', async function ({ page }) {
  await page.goto('http://localhost:3000');

  // Real keyboard tabbing sets the browser's keyboard-focus heuristic, so
  // :focus-visible (and thus the single global ring) matches. Tab forward until
  // a focusable control owns focus and carries the outline.
  let ring = null;
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    ring = await page.evaluate(function read() {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        width: cs.outlineWidth,
        style: cs.outlineStyle,
        color: cs.outlineColor,
        offset: cs.outlineOffset,
      };
    });
    if (ring && ring.style === 'solid' && ring.width === '2px') break;
  }

  expect(ring).not.toBeNull();
  expect(ring.style).toBe('solid');
  expect(ring.width).toBe('2px');
  expect(ring.offset).toBe('1px');

  // The colour resolves to the accent token (compare hue, format-agnostic).
  const acc = await accentRgb(page);
  const norm = await page.evaluate(function conv(hex) {
    const c = document.createElement('span');
    c.style.color = hex;
    document.body.appendChild(c);
    const rgb = window.getComputedStyle(c).color;
    c.remove();
    return rgb;
  }, acc);
  expect(ring.color).toBe(norm);
});
