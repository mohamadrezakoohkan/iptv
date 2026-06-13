---
status: current
---

# Empty & No-Signal States

## Purpose

The IPTV console has several moments where there is **nothing to show**: the
player has no stream, a stream failed, or a channel list rendered no rows. Today
those moments are terse and undifferentiated — the player shows a bare "NO
SIGNAL", a failed stream shows a raw engine error token, and every empty list
shows the same `No channels found.` regardless of *why* it is empty. This spec
refines those existing placeholder states so each one tells the user **what
happened** and **what to do next**, using the affordances the app already has.

This is a presentation refinement of existing states, not a new feature and not
a redesign of the surrounding screens. All copy reads the existing CSS tokens
(`specs/iptv-player.md` §2) so it recolours automatically under either theme.

The two families are deliberately distinct:

- **No signal** — the player has no playable output (idle, or a stream error).
- **No content** — a channel list rendered zero rows (empty source, empty
  category, no favourites yet, or no search matches).

---

## 1. Empty-state model

Every empty/no-signal placeholder is described by the same small shape, so the
states are consistent and individually testable:

```
/** @typedef {{ icon, title, body, action? }} EmptyState
 *  icon   — which placeholder glyph to show (e.g. 'antenna', 'search', 'list')
 *  title  — short headline (1 line)
 *  body   — one helpful sentence of guidance
 *  action — optional { label, kind } affordance the user can act on
 */
```

`action.kind` is one of a fixed set of in-app affordances that already exist:

| `kind`         | Effect when activated                                          |
|----------------|---------------------------------------------------------------|
| `clear-search` | clears the search input and re-renders the grid               |
| `view-all`     | sets the active category to "All Channels" and re-renders     |
| `retry`        | re-attempts playback of the current channel                   |
| `connect`      | focuses the footer login (the "no session" guidance affordance)|

An empty state with no sensible next action omits `action` and renders guidance
only. Resolving which `EmptyState` applies is a **pure function** of the current
state (source channel count, active category, search query, favourites, player
phase) so it is unit-testable without the DOM.

---

## 2. No-content (channel-grid) states

The channel grid (`specs/iptv-player.md` §5c) currently renders
`<p class="ch-empty">No channels found.</p>` for every empty case. It is
replaced by a structured placeholder (`.ch-empty` block: icon + title + body +
optional action button) whose content is chosen by the pure resolver in §1 from
the **reason** the grid is empty:

| Situation (in priority order)                    | icon     | title                  | body (guidance)                                                  | action                       |
|--------------------------------------------------|----------|------------------------|------------------------------------------------------------------|------------------------------|
| Active **search** query, no matches              | `search` | "No matches"           | No channels match "<query>". Try a different search.             | `clear-search` — "Clear search" |
| **Favourites** filter active, no favourites yet  | `star`   | "No favourites yet"    | Tap the star on any channel to add it here.                      | `view-all` — "Browse all channels" |
| A specific **category** filter, no channels in it| `list`   | "Nothing in this category" | This category has no channels right now.                     | `view-all` — "Browse all channels" |
| Source connected but has **zero channels**       | `list`   | "No channels"          | This playlist returned no channels. Try another source.          | (none)                       |

- The `<query>` token in the search case is the user's literal query text, HTML-
  escaped.
- Priority: a search query takes precedence over the category filter (search is
  the most specific reason the user just acted on); the favourites/category/zero
  cases are mutually exclusive by which filter is active and whether the source
  has any channels at all.
- The grid count label (`#ch-count`) is unaffected by this spec.
- The action button is keyboard-focusable, has a discernible accessible label,
  and triggers exactly its `kind` effect (§1) — clearing search, or switching to
  "All Channels" — through the existing handlers.

---

## 3. No-signal (player) states

The player card (`specs/iptv-player.md` §5b) has two no-output states; both are
refined to the §1 model while keeping the existing markup hooks
(`#player-idle`, `#player-err`) and the existing show/hide logic in `rndPlayer`.

### 3a. Idle ("no signal")

Shown when no channel is selected. Today: antenna icon + "NO SIGNAL".

Refined: antenna icon + a clearer headline and one line of guidance that adapts
to whether a session exists:

| Session state              | title       | body (guidance)                                  | action                         |
|----------------------------|-------------|--------------------------------------------------|--------------------------------|
| Connected, channels loaded | "No signal" | Pick a channel from the grid to start watching.  | (none)                         |
| No session (INIT)          | "No signal" | Connect a playlist below to start watching.      | `connect` — "Connect a source" |

The literal token "NO SIGNAL" remains present (as the visible title, case is a
presentation choice) so existing identity is preserved; the guidance line and
optional action are the additions.

### 3b. Stream error

Shown when playback fails (phase ERR with a current channel). Today: the raw
engine detail string (e.g. `mediaError`, `MPEG-TS not supported`) is dumped into
`#player-err`.

Refined: a human-readable error placeholder — an alert/warning icon, a fixed
headline ("This channel won't play"), a one-line plain-language explanation, and
a **Retry** affordance:

- The headline is constant; the explanation is a friendly sentence ("The stream
  could not be loaded. It may be offline or temporarily unavailable."), not the
  raw engine token.
- The raw engine detail is preserved for diagnostics but de-emphasised (small,
  dimmed, secondary line) — it is not the primary message.
- `action: retry` — a "Retry" button that re-attempts playback of the current
  channel through the existing play path. Retry is keyboard-focusable with a
  discernible label.
- The error placeholder still surfaces error text as visible text, never
  console-only (`specs/iptv-player.md` §12).

---

## 4. Accessibility

- Each empty/no-signal placeholder is exposed so assistive tech announces it:
  the container carries `role="status"` (polite) for content/idle placeholders
  and `role="alert"` for the stream-error placeholder.
- Placeholder icons are decorative (`aria-hidden="true"`); the title + body carry
  the meaning.
- Every action button is keyboard-focusable and has a discernible accessible
  name, consistent with `specs/iptv-player.md` §12.

---

## 5. Out of scope

- No new state-machine phases (`specs/iptv-player.md` §11 is unchanged); these
  are presentational refinements of existing INIT/READY/ERR rendering.
- No change to how channels are fetched, parsed, sorted, or filtered.
- No redesign of the sidebar, footer, account panel, or surrounding layout.
</content>
</invoke>
