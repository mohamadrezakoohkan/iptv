---
id: TASK-0004
adr: ADR-0001
evolution: 1
status: done
attempts: 1
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

## Implementation notes

Files created:
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/client/app.css` — complete design CSS
  verbatim from spec, plus `/* ADR: ADR-0001 */` header and the phase body classes at the bottom.
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/tests/ui/css.test.js` — 4 Playwright tests
  covering: .app-main visibility, body background (#0E1216 = rgb(14,18,22)), sidebar ~240px on 1280px
  viewport, sidebar flex-direction:row on 750px viewport.

Files updated:
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/index.html` — replaced placeholder HTML with
  full app shell structure (`.app > .app-main > .sidebar + .content > .footer`), added Google Fonts CDN
  preconnect + link for Space Grotesk and IBM Plex Mono, added `<link rel="stylesheet" href="/app.css">`.
  CSS path uses `/app.css` (not `client/app.css`) because `express.static` serves the `client/` directory
  at the root URL path — `client/app.css` would 404, `/app.css` returns 200.
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/playwright.config.js` — added `webServer`
  block: `command: 'node server/srv.js', port: 3000, reuseExistingServer: true`.
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/adrs/ADR-0001-client-stack.md` — added
  `client/app.css` to `governs:` list.

Non-obvious: the initial CSS path in index.html was set to `client/app.css` which 404s because Express
serves the client/ directory at `/`, not at `/client/`. Caught during the first test run and corrected
to `/app.css` before the tests passed.
