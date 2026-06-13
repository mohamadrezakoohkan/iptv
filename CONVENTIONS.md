# CONVENTIONS MANIFEST — IPTV Node.js + Vanilla JS
# Version: 1.0 | Machine-readable first. LLM agents MUST follow every rule.
# Violation = build error. Human readability is secondary.

---

## §1 TOKENS TABLE
All permitted abbreviations. No new short forms coined outside this table.
Implement agents MUST NOT invent abbreviations. If a concept is absent, request a token addition.

| Long form              | Token  | Max chars | Scope              |
|------------------------|--------|-----------|--------------------|
| channel                | ch     | 2         | var, prop          |
| channels               | chs    | 3         | var, prop          |
| stream                 | strm   | 4         | var, prop          |
| streams                | strms  | 5         | var, prop          |
| playlist               | pl     | 2         | var, prop          |
| playlists              | pls    | 3         | var, prop          |
| preset                 | pst    | 3         | var, prop, module  |
| presets                | psts   | 4         | var, prop          |
| program                | prg    | 3         | var, prop          |
| programs               | prgs   | 4         | var, prop          |
| group                  | grp    | 3         | var, prop          |
| groups                 | grps   | 4         | var, prop          |
| electronic prog guide  | epg    | 3         | var, prop, module  |
| server                 | srv    | 3         | module, var        |
| router                 | rtr    | 3         | module, var        |
| request                | req    | 3         | var, param         |
| response               | res    | 3         | var, param         |
| config                 | cfg    | 3         | module, var        |
| state                  | st     | 2         | module, var        |
| element                | el     | 2         | var, prop          |
| elements               | els    | 3         | var                |
| callback               | cb     | 2         | param              |
| error                  | err    | 3         | var, param         |
| event                  | evt    | 3         | var, param         |
| events                 | evts   | 4         | var                |
| message                | msg    | 3         | var, prop          |
| index (numeric)        | idx    | 3         | var                |
| count                  | cnt    | 3         | var, prop          |
| length                 | len    | 3         | var                |
| source                 | src    | 3         | var, prop          |
| destination            | dst    | 3         | var, prop          |
| temporary              | tmp    | 3         | var                |
| value                  | val    | 3         | var, param         |
| identifier             | id     | 2         | var, prop          |
| timestamp (unix ms)    | ts     | 2         | var, prop          |
| duration               | dur    | 3         | var, prop          |
| position               | pos    | 3         | var, prop          |
| volume                 | vol    | 3         | var, prop          |
| category               | cat    | 3         | var, prop          |
| account                | acct   | 4         | var, prop, module  |
| accounts               | accts  | 5         | var, prop          |
| panel                  | pnl    | 3         | var, prop          |
| metadata               | meta   | 4         | var, prop          |
| image                  | img    | 3         | var, prop          |
| icon                   | ico    | 3         | var, prop          |
| button                 | btn    | 3         | var, prop          |
| input                  | inp    | 3         | var, prop          |
| navigation             | nav    | 3         | module, var        |
| player                 | play   | 4         | module, var        |
| loader                 | load   | 4         | module, var        |
| parser                 | pars   | 4         | module             |
| render                 | rnd    | 3         | module, fn prefix  |
| search                 | srch   | 4         | var, module        |
| filter                 | flt    | 3         | var                |
| sort                   | srt    | 3         | var                |
| page                   | pg     | 2         | var                |
| limit                  | lim    | 3         | var                |
| offset                 | off    | 3         | var                |
| total                  | tot    | 3         | var, prop          |
| result                 | res    | 3         | var (non-http)     |
| options                | opts   | 4         | param              |
| current                | cur    | 3         | var, prop          |
| previous               | prev   | 4         | var, prop          |
| next                   | nxt    | 3         | var, prop          |
| data (loop-local only) | d      | 1         | loop var only      |
| key (loop-local only)  | k      | 1         | loop var only      |
| index (loop i)         | i      | 1         | loop var only      |

---

## §2 IDENTIFIERS

```
RULE-ID-1: Variable names: lowercase, max 4 chars, from TOKENS TABLE only.
RULE-ID-2: Module filenames: lowercase, max 6 chars (no extension), from TOKENS TABLE only.
RULE-ID-3: Function names: <verb><Token> — e.g. getCh, setVol, parsePl, rndList.
           Verb must be one of: get set load rnd on go mk has is run add rm upd.
RULE-ID-4: @typedef names: PascalCase ONLY — Ch, Strm, Pl, Prg, Epg, Grp, Api, Cfg.
RULE-ID-5: DOM id/class attributes: kebab-case, unconstrained length (human UX concern).
RULE-ID-6: FORBIDDEN: camelCase vars, PascalCase vars/fns/modules,
           _prefix, $prefix, Hungarian notation (strName, bFlag, nCount).
RULE-ID-7: Constants that are not in CFG/S: SCREAMING_SNAKE only if truly file-global
           and invariant (e.g. PHASES map). Zero tolerance for scattered magic literals.
```

---

## §3 FILE + MODULE MAP

```
iptv/
  src/
    server/
      srv.js    — express entry; mounts rtr; owns server ST
      rtr.js    — all HTTP routes; no business logic
      pl.js     — M3U playlist fetch + parse → Ch[]
      epg.js    — XMLTV EPG fetch + parse → Prg[]
      cfg.js    — server CFG object (single source of truth for server layer)

    client/
      main.js   — DOMContentLoaded entry; initialises all modules; no logic
      st.js     — ST (state object) + go() state machine; only file that writes ST
      play.js   — video player wrapper
      ui.js     — all DOM rnd* functions; owns EL registry
      nav.js    — keyboard + pointer navigation
      srch.js   — search + filter logic (pure)
      cfg.js    — client S config object

  docs/specs/ — living specs (CORE_FLOW managed)
  docs/adrs/  — architecture decisions (CORE_FLOW managed)
  tasks/      — work units (CORE_FLOW managed)
```

Rule: no file may import from a sibling layer (src/server/* cannot import src/client/* and vice versa).
Rule: rtr.js is the only server file that handles req/res. pl.js, epg.js are pure data modules.

---

## §4 CONFIG OBJECTS

One config object per layer. All constants live there. No magic literals elsewhere.

### Server layer — CFG (cfg.js)
```js
const CFG = {
  port:    3000,
  plUrl:   '',        // M3U source URL
  epgUrl:  '',        // XMLTV source URL
  cacheMs: 3600000,   // playlist + EPG TTL
  maxChs:  5000,      // hard cap on parsed channels
  maxPrgs: 500,       // max EPG entries per channel
  timeout: 10000,     // HTTP fetch timeout ms
};
```

### Client layer — S (cfg.js)
```js
const S = {
  base:    '/api',    // API base path
  pgSz:    50,        // channels per page
  volStp:  0.1,       // volume increment
  skpSec:  10,        // seek step in seconds
  debMs:   200,       // debounce delay ms
  retries: 3,         // fetch retry count
};
```

Rules:
- CFG and S are the only objects with > 4-char property names (they are config dictionaries).
- No module reads process.env directly except cfg.js. cfg.js maps env → CFG.
- S is frozen after main.js init: Object.freeze(S).

---

## §5 STATE OBJECTS

One flat state object per layer. Declared and fully initialized at top of file.
No property may be added after declaration. Max depth: 2.

### Server state — ST (srv.js top)
```js
const ST = {
  chs:    [],      // Ch[]
  grps:   [],      // string[]
  epg:    {},      // { [chId]: Prg[] }  — depth-2 max, Prg[] is flat
  ready:  false,
  err:    null,    // string | null
  ts:     0,       // last loaded unix ms
};
```

### Client state — ST (st.js top)
```js
const ST = {
  phase:  'INIT',  // state machine phase — see §6
  chs:    [],      // Ch[]
  grps:   [],      // string[]
  cur:    null,    // Ch | null — active channel
  pos:    0,       // channel list scroll index
  srch:   '',      // search query string
  flt:    '',      // active group filter value
  vol:    1.0,     // 0.0–1.0
  muted:  false,
  err:    null,    // string | null
  ts:     0,       // last action unix ms
};
```

Rules:
- All reads of ST are allowed anywhere.
- All writes to ST (except ST.phase) go through setter functions in st.js.
- ST.phase is written exclusively by go() — see §6.
- No spread/assign that adds new keys: `Object.assign(ST, x)` is forbidden if x has keys not in ST.

---

## §6 STATE MACHINE

No boolean flags for control flow. Phase is the single source of behavioral truth.

```js
// Valid transitions — declared once, never mutated
const PHASES = {
  INIT:  ['LOAD'],
  LOAD:  ['READY', 'ERR'],
  READY: ['PLAY', 'SRCH', 'ERR'],
  PLAY:  ['READY', 'ERR'],
  SRCH:  ['READY'],
  ERR:   ['INIT'],
};

// Only writer of ST.phase
function go(next) {
  const ok = PHASES[ST.phase];
  if (!ok || !ok.includes(next)) throw new Error(`bad: ${ST.phase}->${next}`);
  ST.phase = next;
}
```

Rules:
- `go()` lives in st.js. No other file writes ST.phase.
- Every behavioral branch (`if`/`switch` on app behavior) MUST read ST.phase, not a boolean flag.
- Phase names are SCREAMING_SNAKE strings: INIT LOAD READY PLAY SRCH ERR.

---

## §7 DATA SCHEMAS

Type + default + validation colocated. One *_DEF object per type.

```js
/** @typedef {{ id:string, name:string, grp:string, url:string, img:string, cat:string, num:number }} Ch */
const CH_DEF = {
  id:   { t: 'string', req: true,  def: ''      },
  name: { t: 'string', req: true,  def: ''      },
  grp:  { t: 'string', req: false, def: 'Other' },
  url:  { t: 'string', req: true,  def: ''      },
  img:  { t: 'string', req: false, def: ''      },
  cat:  { t: 'string', req: false, def: ''      },
  num:  { t: 'number', req: false, def: 0       },
};

/** @typedef {{ chId:string, title:string, start:number, stop:number, desc:string, cat:string }} Prg */
const PRG_DEF = {
  chId:  { t: 'string', req: true,  def: '' },
  title: { t: 'string', req: true,  def: '' },
  start: { t: 'number', req: true,  def: 0  },  // unix ms
  stop:  { t: 'number', req: true,  def: 0  },  // unix ms
  desc:  { t: 'string', req: false, def: '' },
  cat:   { t: 'string', req: false, def: '' },
};

/** @typedef {{ src:string, ts:number, chs:Ch[], grps:string[] }} Pl */
const PL_DEF = {
  src:  { t: 'string', req: true, def: ''  },
  ts:   { t: 'number', req: true, def: 0   },
  chs:  { t: 'array',  req: true, def: []  },
  grps: { t: 'array',  req: true, def: []  },
};
```

Rules:
- Exact field names match API JSON keys (§8). No aliasing, no mapping layer.
- *_DEF objects are the authoritative schema. parsers coerce incoming data to match *_DEF.
- Unknown fields from external APIs are dropped during parse, never stored in ST.

---

## §8 API CONTRACT (exact field names)

```
GET /api/pl
  Response 200: { chs: Ch[], grps: string[], ts: number }
  Response 500: { err: string }

GET /api/epg?chId=<id>&date=<YYYY-MM-DD>
  Response 200: { prgs: Prg[] }
  Response 500: { err: string }

GET /api/srch?q=<query>&grp=<group>&pg=<number>
  Response 200: { chs: Ch[], tot: number, pg: number }
  Response 500: { err: string }
```

Rules:
- All responses are JSON. No HTML error pages.
- Field names in API responses match *_DEF property names exactly.
- Error responses always use `{ err: string }` — no `message`, no `error`.

---

## §9 FUNCTION CONVENTIONS

```
RULE-FN-1: All functions are pure unless they carry a recognized side-effect prefix:
  get*   — pure, returns value, no side effects
  set*   — writes to ST only (via st.js exports)
  load*  — async, fetches external data, returns Result<T>
  rnd*   — renders to DOM (side-effect); lives in ui.js only
  on*    — event handler; one per event; calls go*() or set*()
  go*    — triggers a state machine transition; calls go() then side effects
  mk*    — constructs and returns a typed plain object (no side effects)
  has*   — pure predicate, returns boolean
  is*    — pure predicate on ST.phase or type check

RULE-FN-2: Max function body: 20 lines.
RULE-FN-3: Max parameters: 2. Third+ must be merged into a single opts object.
RULE-FN-4: Async functions return Result type, never throw:
  { ok: true,  val: T }   — success
  { ok: false, err: string }  — failure
  Callers check .ok before using .val.
RULE-FN-5: No anonymous functions assigned to variables — use named function declarations.
RULE-FN-6: No nested function definitions (functions inside functions).
```

---

## §10 DOM CONVENTIONS (client only)

```js
// ui.js — element registry, initialized once
const EL = {
  list:   null,   // channel list container
  play:   null,   // video element
  srch:   null,   // search input
  info:   null,   // now-playing info bar
  err:    null,   // error banner
  nav:    null,   // group nav bar
};

// Initialized in main.js DOMContentLoaded
function mkEL() {
  EL.list  = document.getElementById('ch-list');
  EL.play  = document.getElementById('player');
  EL.srch  = document.getElementById('search');
  EL.info  = document.getElementById('now-info');
  EL.err   = document.getElementById('err-bar');
  EL.nav   = document.getElementById('grp-nav');
}
```

Rules:
- No inline styles. All visual state via CSS class toggling.
- CSS phase classes mirror state machine: `is-init`, `is-load`, `is-ready`, `is-play`, `is-srch`, `is-err`.
- Applied to `document.body` by rndPhase() on every go() call.
- No direct DOM writes outside rnd* functions in ui.js.
- No `document.querySelector` outside ui.js initialization.
- EL properties are never reassigned after mkEL() runs.

---

## §11 ERROR HANDLING

```
RULE-ERR-1: Validate only at system boundaries: API route handlers (server) and fetch responses (client).
RULE-ERR-2: Internal functions trust their callers — no defensive null checks on ST properties.
RULE-ERR-3: On any load* failure: return { ok: false, err: string }, call go('ERR'), set ST.err.
RULE-ERR-4: No try/catch except inside load* functions.
RULE-ERR-5: Server route handlers: catch async errors, respond { err: string }, log to stderr.
```

---

## §12 MODULE DEPENDENCY ORDER

```
server:  cfg.js → pl.js → epg.js → rtr.js → srv.js
client:  cfg.js → st.js → srch.js → play.js → ui.js → nav.js → main.js
```

No circular imports. Lower modules never import higher ones.

---

## §13 PROHIBITED PATTERNS

These patterns are unconditionally forbidden. Any occurrence is a build error.

```
class       — no class definitions anywhere
new Foo()   — no constructor calls (except built-ins: Date, Map, Set, Error)
this        — no this references
prototype   — no prototype manipulation
extends     — no inheritance
instanceof  — no instanceof checks (use isType() guards instead)
.bind(      — no .bind(); use closures
arguments   — no arguments object; use rest params ...args
var         — no var declarations; use const or let
==          — no loose equality; always ===
!!          — no double-bang coercion; use Boolean()
undefined checks via typeof — use ?? or explicit null init
_.          — no lodash; no utility libraries
jQuery      — no jQuery; no DOM libraries
fetch polyfill — target environments with native fetch only
```
