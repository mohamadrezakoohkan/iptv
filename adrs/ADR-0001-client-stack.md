---
id: ADR-0001
title: Client stack — vanilla JS + state machine (no React)
date: 2026-06-11
evolution: 1
status: accepted
governs:
  - client/api.js
  - client/main.js
  - client/st.js
  - client/ui.js
  - client/nav.js
  - client/srch.js
  - client/cfg.js
  - index.html
---

# ADR-0001 — Client stack — vanilla JS + state machine (no React)

## Context

The design prototype (`IPTV Player.html`) references React 18 + Babel
standalone + JSX via CDN, using functional components (PascalCase names),
hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), and camelCase hook
variables throughout `client/app.jsx`.

CONVENTIONS.md is a binding constraint on this project (it is committed to
`main` with the heading "Machine-readable first. LLM agents MUST follow every
rule. Violation = build error."). It explicitly forbids:

- `class`, `new Foo()`, `this`, `prototype`, `extends`, `instanceof` (§13)
- camelCase variable names (RULE-ID-6)
- PascalCase variable/function/module names (RULE-ID-6)
- Any utility library outside the built-in standard library (§13)

React functional components require PascalCase names (e.g. `function App()`)
and React hook calls produce camelCase local variables (e.g.
`const [selectedChannel, setSelectedChannel] = useState(null)`). JSX
desugars to `React.createElement(ComponentName, ...)` which silently couples
every component to the React global.

Two paths were considered:

**Option A — React 18 + Babel CDN with CONVENTIONS.md exception.**
Add a paragraph to CONVENTIONS.md exempting React-specific identifier rules
(PascalCase components, camelCase hook vars, React API calls). This preserves
the design prototype's code almost verbatim but introduces a permanent
carve-out that weakens the whole conventions document and creates a two-tier
naming regime (React files vs non-React files).

**Option B — Vanilla JS + state machine, no React.**
Translate the design's UI behaviour into CONVENTIONS.md-compliant plain DOM
manipulation. React hooks are replaced by: (1) the CONVENTIONS.md §6 state
machine (`go()` + `PHASES`) for phase transitions, (2) setter functions in
`st.js` that mutate the flat `ST` object, and (3) `rnd*` functions in `ui.js`
that re-render affected DOM sections when called after a state mutation.
This yields no naming-rule conflicts, no CDN framework dependency, and aligns
with the already-defined module map (CONVENTIONS.md §3).

## Decision

**Option B — vanilla JS + DOM + state machine.** No React, no Babel, no JSX.

The client is implemented as plain ES2020 modules served directly by the
Express server. Every design feature is preserved at the behaviour level:
sidebar category list, channel grid, channel cards with logo / number /
favourite star, player with idle + active + error states, footer login form
and connected status bar. The implementation language changes from React
components to CONVENTIONS.md-conformant `rnd*` functions in `ui.js`; the
state management changes from hooks to the `ST` + `go()` pattern.

The design's `client/api.js` IIFE is accepted largely as-is (it already uses
`var` and standard JS — CONVENTIONS.md compliance will be corrected in
TASK-0002 but the public interface `window.IptvApi` is preserved).

## Consequences

**Easier:**
- Full CONVENTIONS.md compliance; no rule carve-outs.
- No CDN framework payload; faster initial load.
- No transpiler (Babel standalone); browser receives plain JS.
- Module load order is explicit (`<script src="">` or native ESM).
- State is inspectable as a plain object in the browser console.

**Harder:**
- Re-rendering logic must be written explicitly (`rnd*` functions) rather
  than being handled by React's reconciler. Care is needed to update only the
  affected DOM regions on each state change.
- Fine-grained reactivity (e.g. updating a single card's star without
  re-rendering the whole grid) requires explicit element references in `EL`
  (CONVENTIONS.md §10).

**Ruled out:**
- Any use of React, Preact, Vue, Svelte, or any component framework.
- Babel standalone or any in-browser transpiler.
- JSX syntax anywhere in the client.

## Tasks derived

- TASK-0001 — Project scaffolding (package.json, server entry, static serving)
- TASK-0003 — Client state machine (st.js)
- TASK-0004 — UI CSS (client/app.css)
- TASK-0005 — Sidebar + search UI
- TASK-0006 — Channel grid + channel card UI
- TASK-0007 — Player component
- TASK-0008 — Footer (login form + connected status)
- TASK-0009 — App root entry point (index.html + client/main.js)

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0001` near the top.
