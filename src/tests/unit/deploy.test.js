// ADR: ADR-0027
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const ROOT       = join(__dir, '../../..');

const FLY    = readFileSync(join(ROOT, 'fly.toml'), 'utf8');
const DOCKER = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
const IGNORE = readFileSync(join(ROOT, '.dockerignore'), 'utf8');
const PKG    = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Tiny inline readers — no TOML dependency (ADR-0027).
// ---------------------------------------------------------------------------

/** First quoted (single or double) value of `key = '...'` anywhere in src. */
function flyStr(src, key) {
  const m = src.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*['"]([^'"]*)['"]`));
  return m ? m[1] : null;
}

/** First bare numeric value of `key = 123` anywhere in src. */
function flyNum(src, key) {
  const m = src.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*([0-9]+)\\b`));
  return m ? Number(m[1]) : null;
}

/** True if a key assignment is present at all (any value). */
function hasKey(src, key) {
  return new RegExp(`(?:^|\\n)\\s*${key}\\s*=`).test(src);
}

/** Non-comment, non-blank lines of a .dockerignore, trimmed. */
function ignoreLines(src) {
  return src
    .split('\n')
    .map(function (ln) { return ln.trim(); })
    .filter(function (ln) { return ln.length > 0 && !ln.startsWith('#'); });
}

// ---------------------------------------------------------------------------
// App name
// ---------------------------------------------------------------------------
describe('fly.toml app name', function () {
  it("app == 'teeatr'", function () {
    expect(flyStr(FLY, 'app')).toBe('teeatr');
  });
});

// ---------------------------------------------------------------------------
// Port coherence: internal_port == [env] PORT == Dockerfile EXPOSE
// ---------------------------------------------------------------------------
describe('port coherence', function () {
  it('internal_port, [env] PORT, and EXPOSE are all the same number', function () {
    const internal = flyNum(FLY, 'internal_port');
    const envPort  = Number(flyStr(FLY, 'PORT'));
    const exposeM  = DOCKER.match(/(?:^|\n)\s*EXPOSE\s+([0-9]+)/);
    const expose   = exposeM ? Number(exposeM[1]) : null;

    expect(internal).not.toBeNull();
    expect(Number.isNaN(envPort)).toBe(false);
    expect(expose).not.toBeNull();

    expect(internal).toBe(envPort);
    expect(expose).toBe(envPort);
  });

  it('the bound port equals them (server reads PORT, so PORT is what it binds)', function () {
    // src/server/cfg.js: port = Number(process.env.PORT) || 3000.
    // With [env] PORT set, the bound port is exactly that PORT value.
    const envPort  = Number(flyStr(FLY, 'PORT'));
    const internal = flyNum(FLY, 'internal_port');
    const bound    = envPort || 3000;
    expect(bound).toBe(internal);
  });
});

// ---------------------------------------------------------------------------
// Single memory directive in [[vm]]
// ---------------------------------------------------------------------------
describe('fly.toml [[vm]] memory', function () {
  it('declares exactly one of memory / memory_mb', function () {
    const hasMemory   = hasKey(FLY, 'memory');
    const hasMemoryMb = hasKey(FLY, 'memory_mb');
    expect(hasMemory).toBe(true);
    expect(hasMemoryMb).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Start command: Dockerfile CMD runs the package start script
// ---------------------------------------------------------------------------
describe('Dockerfile start command', function () {
  it("CMD invokes the package.json start script (npm run start / npm start)", function () {
    const cmdM = DOCKER.match(/(?:^|\n)\s*CMD\s+(.+)/);
    expect(cmdM).not.toBeNull();
    const cmd = cmdM[1];
    const runsStart =
      /["']npm["']\s*,\s*["']run["']\s*,\s*["']start["']/.test(cmd) ||
      /["']npm["']\s*,\s*["']start["']/.test(cmd) ||
      /npm\s+run\s+start/.test(cmd) ||
      /npm\s+start/.test(cmd);
    expect(runsStart).toBe(true);
  });

  it("package.json start runs node src/server/srv.js", function () {
    expect(PKG.scripts.start).toBe('node src/server/srv.js');
  });
});

// ---------------------------------------------------------------------------
// .dockerignore: slim and secret-free, but keeps the runtime files
// ---------------------------------------------------------------------------
describe('.dockerignore', function () {
  const lines = ignoreLines(IGNORE);
  const excludes = function (pat) { return lines.includes(pat); };

  it('excludes node_modules', function () {
    expect(lines.some(function (l) { return l.replace(/\/$/, '') === 'node_modules'; })).toBe(true);
  });

  it('excludes .env.secrets', function () {
    expect(excludes('.env.secrets')).toBe(true);
  });

  it('does NOT exclude src/client, src/server, src/index.html, or package files', function () {
    const kept = ['src/client', 'src/server', 'src/index.html', 'package.json', 'package-lock.json'];
    kept.forEach(function (path) {
      lines.forEach(function (ln) {
        const bare = ln.replace(/\/$/, '');
        expect(bare).not.toBe(path);
        expect(bare).not.toBe('src');
        expect(bare).not.toBe('src/');
      });
      expect(excludes(path)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Health check on /
// ---------------------------------------------------------------------------
describe('fly.toml health check', function () {
  it("declares an http_service health check against path '/'", function () {
    const hasChecksBlock = /\[\[http_service\.checks\]\]/.test(FLY);
    expect(hasChecksBlock).toBe(true);
    expect(flyStr(FLY, 'path')).toBe('/');
  });
});
