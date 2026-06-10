---
id: TASK-0009
adr: ADR-0001
evolution: 1
status: pending
attempts: 0
depends_on: [TASK-0002, TASK-0003, TASK-0004, TASK-0005, TASK-0006, TASK-0007, TASK-0008]
---

# TASK-0009 — App root entry point (index.html + client/main.js + client/cfg.js)

## Goal

`index.html` is the single HTML entry point served at `/`. It loads all CDN
scripts (hls.js, Google Fonts), the CSS, and the client JS modules in the
correct dependency order (CONVENTIONS.md §12). `client/main.js` runs on
`DOMContentLoaded`, initialises all modules, wires `EL`, and boots the state
machine. `client/cfg.js` declares and freezes the `S` config object with all
client constants including localStorage keys.

## Acceptance criteria

- [ ] `index.html` exists at the project root and carries an HTML comment
      `<!-- ADR: ADR-0001 -->`.
- [ ] `index.html` `<head>` loads: Space Grotesk + IBM Plex Mono (Google Fonts
      CDN), `client/app.css`.
- [ ] `index.html` `<body>` contains the full static HTML scaffold for:
      header bar, `#app-main` with `#sidebar` and `#content`, `#footer`.
      Inline SVG for the antenna idle icon inside `#player-idle`.
- [ ] `index.html` loads scripts in this order: `hls.js` CDN, `client/cfg.js`,
      `client/api.js`, `client/st.js`, `client/srch.js`, `client/play.js`,
      `client/ui.js`, `client/nav.js`, `client/main.js`.
- [ ] `client/cfg.js` carries `// ADR: ADR-0001, ADR-0003`; declares `const S`
      with at minimum: `base`, `pgSz`, `volStp`, `skpSec`, `debMs`, `retries`,
      `credsKey`, `selKey`, `favsKey`; calls `Object.freeze(S)`.
- [ ] `client/main.js` carries `// ADR: ADR-0001`; is wrapped in
      `document.addEventListener('DOMContentLoaded', ...)` (one level only —
      no nested functions); calls `mkEL()`, `mkPlay(EL.play)`, `onPhase(rndPhase)`.
- [ ] `client/main.js` calls `loadSt()` and, if stored credentials exist,
      calls `IptvApi.connect(creds.url, creds.user, creds.pass)` with auto-
      reconnect logic (go LOAD → READY or ERR).
- [ ] Running `node server/srv.js` and opening `http://localhost:3000` renders
      a complete dark IPTV console with all sections visible (header, sidebar,
      player idle state, empty grid, footer login form).
- [ ] `npx vitest run` passes (all existing unit tests green).
- [ ] `npx playwright test` passes (all existing UI tests green).

## Test requirements

- **Unit:** `client/cfg.js` — verify `S` is frozen after module load; verify
  `S.credsKey === 'iptv_creds'` etc.
- **UI:** Playwright — full smoke test: load `http://localhost:3000`; verify
  page title is "IPTV player"; verify `#sidebar` visible; verify `#player-idle`
  visible; verify footer login form visible; verify no JS console errors on
  load.
