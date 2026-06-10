---
id: TASK-0004
adr: ADR-0001
evolution: 1
status: pending
attempts: 0
depends_on: [TASK-0001]
---

# TASK-0004 — UI CSS (client/app.css)

## Goal

`client/app.css` contains the complete dark broadcast-console stylesheet
faithfully implementing the design. All layout, colour tokens, typography,
component styles, and mobile responsive rules are present. No inline styles
exist anywhere in the HTML or JS.

## Acceptance criteria

- [ ] `client/app.css` exists.
- [ ] CSS custom properties on `:root` define all 8 design tokens:
      `--bg`, `--sur`, `--sur2`, `--ln`, `--tx`, `--dim`, `--acc`, `--live`
      with the exact hex values from the design spec.
- [ ] `body` / root container: `margin:0`, `background: var(--bg)`,
      `color: var(--tx)`, `height: 100vh`, `display: flex`,
      `flex-direction: column`, Space Grotesk font family.
- [ ] `.app-main` uses CSS grid: `grid-template-columns: 240px 1fr`.
- [ ] `.sidebar` styles: 240px width, `--sur` background, right border `--ln`,
      scrollable category list.
- [ ] `.content` styles: flex column, fills remaining space.
- [ ] `.player-card` styles: 16:9 aspect ratio, `max-height: 35vh`,
      `--sur2` background, `--ln` border, rounded corners.
- [ ] `.ch-grid` uses `grid-template-columns: repeat(auto-fill, minmax(148px, 1fr))`.
- [ ] `.ch-card` styles: `--sur2` background, `--ln` border, 8px radius,
      hover border `--acc`, cursor pointer.
- [ ] `.footer` styles: logged-in and logged-out variants; amber Connect button.
- [ ] Phase classes on `body`: `body.is-init`, `body.is-load`, `body.is-ready`,
      `body.is-play`, `body.is-srch`, `body.is-err` — each controlling
      visibility of phase-dependent sections.
- [ ] Mobile breakpoint `@media (max-width: 760px)`: sidebar becomes
      horizontal scroll strip (`flex-direction: row`, `overflow-x: auto`);
      `.sidebar-brand` and search input are hidden; player `max-height: 40vw`.
- [ ] IBM Plex Mono applied to `.ch-num` and mono label elements.

## Test requirements

- **Unit:** n/a — CSS file has no runnable logic.
- **UI:** Playwright visual check — load `http://localhost:3000` in INIT phase;
  verify `.app-main` is visible; verify `--bg` colour is applied to body;
  verify `.sidebar` is 240px wide on desktop viewport; verify sidebar becomes
  horizontal at 750px viewport width.
