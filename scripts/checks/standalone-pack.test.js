#!/usr/bin/env node
'use strict';
/*
 * standalone-pack enforcer. `npm test` runs `--self-test`, then a normal run.
 *
 * HASH TIER TRANSFORM (J1)
 *   Applied to the WHOLE text of every scanned file, every file path, and every commit in
 *   the git log:
 *     1. Unicode NFKC normalisation
 *     2. lowercase
 *     3. split on /[^\p{L}\p{N}]+/u (anything that is not a letter or a digit)
 *     4. SHA-256 hex of every unigram, and of every adjacent bigram joined by one space
 *   A digest listed in forbidden-hashes.json is a hit, reported at the line of the first
 *   token of the match. Only digests and neutral labels are committed, never the words.
 *   Two nonsense canaries (one unigram, one bigram) sit plain in a declared fixture, so the
 *   self-test proves both paths RED in CI, where no local list exists.
 *
 * POPULATIONS
 *   (i)  Every repo file (`git ls-files -co --exclude-standard` at the root) and the git
 *        log (`git log --all`: author, committer and message): the shape, hash and personal
 *        tiers. Every repo file: slash-command closure (d2-command) and the fixture
 *        manifest. One exemption, by exact folder, printed on every run:
 *        scripts/checks/fixtures/ skips the shape and hash tiers only.
 *   (ii) Each pack (a top-level folder holding pack.json), installed into an empty temp
 *        project through pack.json.install: install, files-list, install-from, selfcheck,
 *        the static require and __dirname walk (require, dirname), link closure (d3-link).
 *
 * LOCAL LISTS (environment only; there is no default path)
 *   STANDALONE_PERSONAL_TOKENS   file, one token per line, case-insensitive substring match
 *   STANDALONE_INSTANCE_TOKENS   file, the plaintext source of the committed digests
 *   STANDALONE_REQUIRE_LOCAL=1   strict: both lists are mandatory and the cross-check runs
 *   KEEP_TMP=1                   keep the temp projects
 *   Output carries counts, labels and indexes only, never a listed token.
 *
 * USAGE   node scripts/checks/standalone-pack.test.js [--root <dir>] [--self-test]
 * EXIT    0 clean, 1 any failure, 2 usage error or unreadable pack.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { builtinModules } = require('module');

const HERE = __dirname;
const DEFAULT_ROOT = path.resolve(HERE, '..', '..');
const DIGEST_FILE = path.join(HERE, 'forbidden-hashes.json');
const FIXTURE_DIR = path.join(HERE, 'fixtures');
const FIXTURE_PREFIX = 'scripts/checks/fixtures/';
const FIXTURE_MANIFEST = FIXTURE_PREFIX + 'manifest.json';
const ENV_PERSONAL = 'STANDALONE_PERSONAL_TOKENS';
const ENV_INSTANCE = 'STANDALONE_INSTANCE_TOKENS';
const ENV_STRICT = 'STANDALONE_REQUIRE_LOCAL';
const KEEP_TMP = process.env.KEEP_TMP === '1';
const IS_WIN = process.platform === 'win32';
const PRINT_CAP = 40;
const SELFCHECK_TIMEOUT_MS = 10 * 60 * 1000;
const BUILTINS = new Set(builtinModules);
const USAGE = 'usage: node scripts/checks/standalone-pack.test.js [--root <dir>] [--self-test]';

// Shape tier: plain regexes, committed, run in CI. Each one is written so that its own
// source text does not match it (escaped slashes and dots, or a [-] class).
const SHAPES = [
  { label: 'paths-key', re: /paths\.[a-zA-Z]/ },
  { label: 'paths-json', re: /\.claude\/paths\.json/ },
  { label: 'hooks-lib', re: /scripts\/hooks\/lib/ },
  { label: 'tracker-file', re: /TRACKER\.md/ },
  { label: 'dispatch-wrapper', re: /dispatch-(?:claude|agent)/ },
  { label: 'registry-file', re: /role[-]registry/ },
  { label: 'hookpoint-file', re: /hook[-]points/ },
  // Absolute machine paths. A <placeholder> segment is exempt.
  { label: 'abs-path-windows', re: /[A-Za-z]:[\\/]Users[\\/](?!<)/ },
  { label: 'abs-path-mac', re: /\/Users\/[^/<\s]+\// },
  { label: 'abs-path-linux', re: /\/home\/[^/<\s]+\// },
  // Framework underscore folders: an underscore, a lowercase word and a slash, with no
  // slash, dot or word character just before the underscore.
  { label: 'underscore-dir', re: /(?<![/.\w])_[a-z][\w-]*\// },
  // Record id namespaces.
  { label: 'id-ed', re: /\bED-\d{2,}/ },
  { label: 'id-adr', re: /\bADR-\d{3,4}\b/ },
  { label: 'id-sprint', re: /\bS-[A-Z][A-Z0-9]*-\d{2}\b/ },
  { label: 'id-sp', re: /\bSP-\d{8}-\d{3}\b/ },
  { label: 'id-ri', re: /\bRI-\d{3}\b/ },
  { label: 'id-pc', re: /\bPC-\d{8}-\d{4}\b/ },
  { label: 'id-epic', re: /\bE-[A-Z]+(?:-[A-Z]+)*-\d{3}\b/ },
];

// Slash-command closure (d2-command). The lookbehind keeps scheme://user:pass@ out.
const D2_SOURCE = /(?<![\w/])\/[a-z][a-z0-9-]*:[a-z][a-z0-9:-]*/.source;

// ---------------------------------------------------------------- small helpers

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const toPosix = (p) => p.split(path.sep).join('/');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lineStarts(text) {
  const out = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) out.push(i + 1);
  return out;
}

function lineAt(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function lineOfText(text, needle, fromLine) {
  const lines = text.split('\n');
  for (let i = Math.max(0, (fromLine || 1) - 1); i < lines.length; i++) if (lines[i].includes(needle)) return i + 1;
  return 1;
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}

function walkFiles(dir, skipName) {
  const out = [];
  (function walk(abs, rel) {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (skipName && skipName(ent.name)) continue;
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(abs, ent.name), r);
      else if (ent.isFile()) out.push(r);
    }
  })(dir, '');
  return out.sort();
}

function copyTree(src, dest, onFile, rel) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    const r = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) copyTree(s, d, onFile, r);
    else if (ent.isFile()) {
      fs.copyFileSync(s, d);
      if (onFile) onFile(d, r);
    }
  }
}

function removeDir(p) {
  try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { /* best effort */ }
}

function pathKey(p) {
  const r = path.resolve(p);
  return IS_WIN ? r.toLowerCase() : r;
}

function realKey(p) {
  let r;
  try { r = fs.realpathSync.native(p); } catch (e) { r = p; }
  return pathKey(r);
}

function inside(p, root) {
  const rel = path.relative(root, p);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

function baseEnv() {
  const env = Object.assign({}, process.env);
  delete env[ENV_PERSONAL];
  delete env[ENV_INSTANCE];
  delete env[ENV_STRICT];
  return env;
}

// ---------------------------------------------------------------- git

let gitPresent = null;
function gitAvailable() {
  if (gitPresent === null) {
    const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
    gitPresent = r.status === 0;
  }
  return gitPresent;
}

function git(cwd, args, extra) {
  return spawnSync('git', args, Object.assign({ cwd, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 120000 }, extra || {}));
}

function isGitTop(root) {
  const r = git(root, ['rev-parse', '--show-toplevel']);
  return r.status === 0 && realKey(r.stdout.trim()) === realKey(root);
}

function listRepoFiles(root, top) {
  if (top) {
    const r = git(root, ['ls-files', '-co', '--exclude-standard', '-z']);
    if (r.status === 0) {
      return { via: 'git ls-files -co --exclude-standard', files: [...new Set(r.stdout.split('\0').filter(Boolean))].sort() };
    }
  }
  return { via: 'a filesystem walk (the root is not a git repo root)', files: walkFiles(root, (n) => n === '.git' || n === 'node_modules') };
}

function gitLogCommits(root) {
  const r = git(root, ['log', '--all', '--format=%x00%H%n%an%n%ae%n%cn%n%ce%n%B']);
  if (r.status !== 0) {
    const any = git(root, ['rev-list', '--all', '--max-count=1']);
    if (any.status === 0 && !any.stdout.trim()) return { commits: [] };
    return { error: String(r.stderr || 'git log failed').split('\n')[0] };
  }
  const commits = r.stdout.split('\0').filter((c) => c.trim()).map((c) => {
    const nl = c.indexOf('\n');
    return { sha: (nl < 0 ? c : c.slice(0, nl)).trim(), text: nl < 0 ? '' : c.slice(nl + 1) };
  });
  return { commits };
}

// ---------------------------------------------------------------- tiers

// J1 transform. Matching runs of letters and digits yields exactly the non-empty pieces of
// text.split(/[^\p{L}\p{N}]+/u), plus each piece's offset, which gives the line to report.
function j1Normalise(text) {
  return String(text).normalize('NFKC').toLowerCase();
}

function j1Split(text) {
  return j1Normalise(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const tokenDigestCache = new Map();
function j1Hits(text, digests) {
  const norm = j1Normalise(text);
  const starts = lineStarts(norm);
  const hits = [];
  const re = /[\p{L}\p{N}]+/gu;
  let prev = null;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const tok = m[0];
    const line = lineAt(starts, m.index);
    let h = tokenDigestCache.get(tok);
    if (h === undefined) {
      h = sha256(tok);
      if (tokenDigestCache.size < 500000) tokenDigestCache.set(tok, h);
    }
    const uni = digests.get(h);
    if (uni) hits.push({ line, label: uni });
    if (prev) {
      const bi = digests.get(sha256(`${prev.tok} ${tok}`));
      if (bi) hits.push({ line: prev.line, label: bi });
    }
    prev = { tok, line };
  }
  return hits;
}

function shapeHits(text) {
  const hits = [];
  text.split('\n').forEach((l, i) => {
    for (const s of SHAPES) if (s.re.test(l)) hits.push({ line: i + 1, label: s.label });
  });
  return hits;
}

function personalHits(text, tokens) {
  const hits = [];
  if (!tokens.length) return hits;
  j1Normalise(text).split('\n').forEach((l, i) => {
    tokens.forEach((t, k) => { if (l.includes(t)) hits.push({ line: i + 1, index: k + 1 }); });
  });
  return hits;
}

function d2Hits(text, allowed) {
  const hits = [];
  text.split('\n').forEach((l, i) => {
    const re = new RegExp(D2_SOURCE, 'g');
    let m;
    while ((m = re.exec(l)) !== null) {
      const cmd = m[0].replace(/[:-]+$/, '');
      if (!allowed.has(cmd)) hits.push({ line: i + 1, cmd });
    }
  });
  return hits;
}

// The canaries are nonsense words with committed digests, kept plain in one declared
// fixture. They prove the unigram and bigram paths RED; they match no instance entry.
const isCanary = (label) => label === 'canary' || label === 'canary-bigram';

function loadDigests() {
  const doc = JSON.parse(fs.readFileSync(DIGEST_FILE, 'utf8'));
  const map = new Map();
  for (const d of doc.digests || []) {
    if (!d || typeof d.label !== 'string' || !/^[0-9a-f]{64}$/.test(String(d.sha256))) throw new Error('a digest entry is malformed');
    map.set(d.sha256, d.label);
  }
  if (![...map.values()].includes('canary')) throw new Error('no digest is labelled canary');
  return map;
}

function readList(envName) {
  const p = process.env[envName];
  if (!p) return { state: 'absent', entries: [] };
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { return { state: 'unreadable', entries: [] }; }
  const entries = raw.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  return entries.length ? { state: 'loaded', entries } : { state: 'empty', entries };
}

// ---------------------------------------------------------------- output

function makeSafe(ctx, personalTokens, digests) {
  const variants = (p) => (p ? [p, p.split('\\').join('/')] : []);
  const home = os.homedir();
  const tmpRoot = os.tmpdir();
  return (value) => {
    let s = String(value);
    for (const t of ctx.temps) for (const v of variants(t)) s = s.split(v).join('<tmp>');
    for (const v of variants(tmpRoot)) s = s.split(v).join('<tmpdir>');
    for (const v of variants(home)) s = s.split(v).join('<home>');
    const low = j1Normalise(s);
    const k = personalTokens.findIndex((t) => low.includes(t));
    if (k >= 0) return `<withheld: contains personal-token #${k + 1}>`;
    if (j1Hits(s, digests).length) return '<withheld: contains a hashed token>';
    return s;
  };
}

function makeReporter(ctx, safe) {
  return {
    check(status, name, detail, fails) {
      const list = fails || [];
      console.log(`  ${status.padEnd(5)} ${name.padEnd(16)} ${detail}`);
      for (const f of list.slice(0, PRINT_CAP)) console.log(`${safe(f.where)}  ${f.check || name}  ${safe(f.what)}`);
      if (list.length > PRINT_CAP) console.log(`  ... ${list.length - PRINT_CAP} more ${name} failures not printed`);
      ctx.failures += list.length;
    },
    tail(text, n) {
      const lines = String(text).replace(/\s+$/, '').split(/\r?\n/).slice(-n);
      for (const l of lines) console.log(`    | ${safe(l)}`);
    },
  };
}

// ---------------------------------------------------------------- static JavaScript walk

const KEYWORDS_BEFORE_EXPRESSION = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const ID_START = /[A-Za-z_$\u0080-\uffff]/;
const ID_PART = /[A-Za-z0-9_$\u0080-\uffff]/;
const WS = /\s/;

function unescapeJs(s) {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g, (m, g) => {
    try {
      if (g.length > 1 && g[0] === 'u') return String.fromCodePoint(parseInt(g[1] === '{' ? g.slice(2, -1) : g.slice(1), 16));
      if (g.length === 3 && g[0] === 'x') return String.fromCharCode(parseInt(g.slice(1), 16));
    } catch (e) { return g; }
    const map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '', '\r\n': '' };
    return Object.prototype.hasOwnProperty.call(map, g) ? map[g] : g;
  });
}

// A lightweight tokenizer. It finds require(...) and join/resolve(...) calls at code
// positions only: never inside comments, strings, template text or regex literals. Each
// argument is classified as a literal, a literal prefix, __dirname, a nested path call, or
// dynamic. Nothing is executed.
function scanJs(src) {
  const len = src.length;
  const starts = lineStarts(src);
  const calls = [];
  let quiet = 0;
  const regexAllowed = (prev) => !(prev === 'id' || prev === 'num' || prev === 'str' || prev === ')' || prev === ']');

  function skipTrivia(j) {
    for (;;) {
      while (j < len && WS.test(src[j])) j++;
      if (src[j] === '/' && src[j + 1] === '/') { while (j < len && src[j] !== '\n') j++; continue; }
      if (src[j] === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2); j = e < 0 ? len : e + 2; continue; }
      return j;
    }
  }

  function skipString(j) {
    const q = src[j];
    j++;
    while (j < len) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === q) return j + 1;
      if (c === '\n') return j;
      j++;
    }
    return j;
  }

  function templateInterp(j) {
    j++;
    while (j < len) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return -1;
      if (c === '$' && src[j + 1] === '{') return j;
      j++;
    }
    return -1;
  }

  function skipTemplate(j) {
    j++;
    while (j < len) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return j + 1;
      if (c === '$' && src[j + 1] === '{') { j = scanCode(j + 2, true); continue; }
      j++;
    }
    return j;
  }

  // Returns the index after a regex literal, or j + 1 when the slash is a division.
  function skipRegex(j) {
    let k = j + 1;
    let inClass = false;
    while (k < len) {
      const c = src[k];
      if (c === '\\') { k += 2; continue; }
      if (c === '\n') return j + 1;
      if (inClass) { if (c === ']') inClass = false; } else if (c === '[') inClass = true;
      else if (c === '/') {
        k++;
        while (k < len && /[A-Za-z]/.test(src[k])) k++;
        return k;
      }
      k++;
    }
    return j + 1;
  }

  const readWord = (j) => { let k = j + 1; while (k < len && ID_PART.test(src[k])) k++; return k; };
  const skipNumber = (j) => { let k = j + 1; while (k < len && /[0-9A-Za-z_.]/.test(src[k])) k++; return k; };

  function parseArgs(p) {
    const args = [];
    let j = p + 1;
    let start = j;
    let depth = 0;
    let prev = '(';
    const push = (e) => { if (src.slice(start, e).trim()) args.push({ s: start, e }); };
    while (j < len) {
      const c = src[j];
      if (WS.test(c)) { j++; continue; }
      if (c === '/' && (src[j + 1] === '/' || src[j + 1] === '*')) { j = skipTrivia(j); continue; }
      if (c === '"' || c === "'") { j = skipString(j); prev = 'str'; continue; }
      if (c === '`') { j = skipTemplate(j); prev = 'str'; continue; }
      if (c === '/') {
        if (regexAllowed(prev)) { const k = skipRegex(j); prev = k === j + 1 ? '/' : 'str'; j = k; } else { j++; prev = '/'; }
        continue;
      }
      if (c === '(' || c === '[' || c === '{') { depth++; j++; prev = c; continue; }
      if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) { push(j); return args; }
        depth--; j++; prev = c; continue;
      }
      if (c === ',' && depth === 0) { push(j); j++; start = j; prev = ','; continue; }
      if (c >= '0' && c <= '9') { j = skipNumber(j); prev = 'num'; continue; }
      if (ID_START.test(c)) {
        const k = readWord(j);
        prev = KEYWORDS_BEFORE_EXPRESSION.has(src.slice(j, k)) ? 'kw' : 'id';
        j = k;
        continue;
      }
      prev = c;
      j++;
    }
    push(j);
    return args;
  }

  function classify(a) {
    const s = skipTrivia(a.s);
    let e = a.e;
    while (e > s && WS.test(src[e - 1])) e--;
    const text = src.slice(s, e);
    if (text === '__dirname') return { type: 'dirname' };
    const c = src[s];
    if (c === '"' || c === "'" || c === '`') {
      const interp = c === '`' ? templateInterp(s) : -1;
      if (interp >= 0) return { type: 'prefix', value: unescapeJs(src.slice(s + 1, interp)) };
      const end = c === '`' ? skipTemplate(s) : skipString(s);
      const value = unescapeJs(src.slice(s + 1, end - 1));
      if (end >= e) return { type: 'literal', value };
      return src[skipTrivia(end)] === '+' ? { type: 'prefix', value } : { type: 'dynamic' };
    }
    const m = /^(?:[A-Za-z_$][\w$]*\s*\.\s*)?(join|resolve)\s*\(/.exec(text);
    if (m) return { type: 'pathcall', word: m[1], args: parseArgs(s + m[0].length - 1).map(classify) };
    return { type: 'dynamic' };
  }

  function record(kind, word, at, paren) {
    quiet++;
    const args = parseArgs(paren).map(classify);
    quiet--;
    calls.push({ kind, word, line: lineAt(starts, at), args });
  }

  function scanCode(j, untilBrace) {
    let depth = 0;
    let prev = '';
    while (j < len) {
      const c = src[j];
      if (WS.test(c)) { j++; continue; }
      if (c === '/' && (src[j + 1] === '/' || src[j + 1] === '*')) { j = skipTrivia(j); continue; }
      if (c === '"' || c === "'") { j = skipString(j); prev = 'str'; continue; }
      if (c === '`') { j = skipTemplate(j); prev = 'str'; continue; }
      if (c === '/') {
        if (regexAllowed(prev)) { const k = skipRegex(j); prev = k === j + 1 ? '/' : 'str'; j = k; } else { j++; prev = '/'; }
        continue;
      }
      if (c === '{') { depth++; j++; prev = '{'; continue; }
      if (c === '}') {
        if (untilBrace && depth === 0) return j + 1;
        depth--; j++; prev = '}'; continue;
      }
      if (c >= '0' && c <= '9') { j = skipNumber(j); prev = 'num'; continue; }
      if (ID_START.test(c)) {
        const k = readWord(j);
        const word = src.slice(j, k);
        const member = prev === '.';
        if (!quiet && ((word === 'require' && !member) || word === 'join' || word === 'resolve')) {
          const p = skipTrivia(k);
          if (src[p] === '(') record(word === 'require' ? 'require' : 'join', word, j, p);
        }
        prev = !member && KEYWORDS_BEFORE_EXPRESSION.has(word) ? 'kw' : 'id';
        j = k;
        continue;
      }
      prev = c;
      j++;
    }
    return j;
  }

  let begin = 0;
  if (src.startsWith('#!')) { begin = src.indexOf('\n'); if (begin < 0) begin = len; }
  scanCode(begin, false);
  return calls;
}

const isRelSpec = (v) => v === '.' || v === '..' || v.startsWith('./') || v.startsWith('../');

function isBuiltin(v) {
  const bare = v.startsWith('node:') ? v.slice(5) : v;
  return BUILTINS.has(v) || BUILTINS.has(bare) || BUILTINS.has(`node:${bare}`);
}

function resolveModuleFile(target) {
  for (const cand of [target, `${target}.js`, `${target}.json`, `${target}.cjs`, `${target}.mjs`, path.join(target, 'index.js')]) {
    if (isFile(cand)) return cand;
  }
  return null;
}

function evalPathCall(pc, fileDir) {
  if (!pc.args.length || pc.args[0].type !== 'dirname') return null;
  const segs = [];
  let complete = true;
  for (const a of pc.args.slice(1)) {
    if (a.type !== 'literal') { complete = false; break; }
    segs.push(a.value);
  }
  const fn = pc.word === 'resolve' ? path.resolve : path.join;
  return { target: fn(fileDir, ...segs), complete, segs };
}

function judgeRequire(arg, fileDir, within) {
  if (!arg) return 'require() with no argument';
  if (arg.type === 'literal') {
    const v = arg.value;
    if (isBuiltin(v)) return null;
    if (!isRelSpec(v)) return `not a node builtin or a relative file in the pack: "${v}"`;
    const target = path.resolve(fileDir, v);
    const hit = resolveModuleFile(target);
    if (hit) return within(hit) ? null : `escapes the installed pack: "${v}"`;
    return within(target) ? `does not resolve to a file in the installed pack: "${v}"` : `escapes the installed pack: "${v}"`;
  }
  if (arg.type === 'prefix') {
    const v = arg.value;
    if (!isRelSpec(v)) return 'non-literal argument without a literal relative prefix';
    const dirPart = v.endsWith('/') ? v : v.includes('/') ? v.slice(0, v.lastIndexOf('/') + 1) : `${v}/`;
    const dir = path.resolve(fileDir, dirPart);
    if (!within(dir)) return `dynamic require prefix escapes the installed pack: "${v}"`;
    if (!isDir(dir)) return `dynamic require prefix is not a folder in the installed pack: "${v}"`;
    return null;
  }
  if (arg.type === 'pathcall') {
    const r = evalPathCall(arg, fileDir);
    if (!r) return 'non-literal argument without a literal relative prefix';
    if (r.complete) {
      const hit = resolveModuleFile(r.target);
      if (hit) return within(hit) ? null : 'escapes the installed pack: a __dirname path';
      return within(r.target) ? 'does not resolve to a file in the installed pack: a __dirname path' : 'escapes the installed pack: a __dirname path';
    }
    if (!within(r.target)) return 'dynamic require prefix escapes the installed pack: a __dirname path';
    if (!isDir(r.target)) return 'dynamic require prefix is not a folder in the installed pack: a __dirname path';
    return null;
  }
  return 'non-literal argument without a literal relative prefix';
}

// ---------------------------------------------------------------- Markdown links

function readLinkTarget(line, j) {
  while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
  if (line[j] === '<') {
    const e = line.indexOf('>', j + 1);
    return e < 0 ? null : line.slice(j + 1, e);
  }
  let depth = 0;
  const s = j;
  while (j < line.length) {
    const c = line[j];
    if (c === ' ' || c === '\t') break;
    if (c === '(') depth++;
    else if (c === ')') { if (depth === 0) break; depth--; }
    j++;
  }
  return j > s ? line.slice(s, j) : null;
}

function markdownLinks(text) {
  const out = [];
  let fence = null;
  text.split('\n').forEach((raw, i) => {
    if (fence) {
      // A fence closes only on a bare run of the same character, at least as long.
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(raw);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      return;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(raw);
    if (open) { fence = open[1]; return; }
    const line = raw.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (m) => ' '.repeat(m.length));
    let k = 0;
    while ((k = line.indexOf('](', k)) !== -1) {
      const t = readLinkTarget(line, k + 2);
      if (t !== null) out.push({ line: i + 1, target: t });
      k += 2;
    }
    const ref = /^ {0,3}\[(?!\^)[^\]]+\]:\s*(\S+)/.exec(line);
    if (ref) out.push({ line: i + 1, target: ref[1].replace(/^<|>$/g, '') });
  });
  return out;
}

// Returns undefined for a link that is not checked (external or anchor), '' when it
// resolves, or the reason it fails.
function judgeLink(target, baseDir, slashRoot, within) {
  let t = target.trim();
  if (!t || t.startsWith('#')) return undefined;
  if (/^(https?:|mailto:)/i.test(t)) return undefined;
  t = t.split('#')[0].split('?')[0];
  if (!t) return undefined;
  let dec = t;
  try { dec = decodeURIComponent(t); } catch (e) { /* keep the raw target */ }
  const abs = dec.startsWith('/') ? path.join(slashRoot, dec) : path.resolve(baseDir, dec);
  if (!within(abs)) return `points outside the installed pack: ${target}`;
  if (!fs.existsSync(abs)) return `target does not exist: ${target}`;
  if (!isFile(abs)) return `target is a folder, not a file: ${target}`;
  return '';
}

// ---------------------------------------------------------------- pack checks (population ii)

function normRel(p) {
  return String(p).replace(/^\.\//, '').replace(/\/+$/, '');
}

function safeRel(p) {
  if (!p || p.includes('\\') || path.isAbsolute(p) || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((seg) => seg && seg !== '.' && seg !== '..');
}

function discoverPacks(root) {
  const out = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === '.git' || ent.name === 'node_modules') continue;
    const pjFile = path.join(root, ent.name, 'pack.json');
    if (!isFile(pjFile)) continue;
    const p = { dirName: ent.name, packDir: path.join(root, ent.name), pjFile };
    try {
      p.text = fs.readFileSync(pjFile, 'utf8').replace(/^\uFEFF/, '');
      p.pj = JSON.parse(p.text);
      if (!p.pj || typeof p.pj !== 'object' || Array.isArray(p.pj)) throw new Error('not an object');
    } catch (e) {
      p.pj = null;
      p.unreadable = true;
    }
    out.push(p);
  }
  return out.sort((a, b) => (a.dirName < b.dirName ? -1 : a.dirName > b.dirName ? 1 : 0));
}

function checkPack(pack, report, ctx) {
  const { dirName, packDir, text, pj } = pack;
  const at = (rel, line) => `${dirName}/${rel}:${line}`;
  console.log(`pack ${dirName}:`);
  if (pack.unreadable) {
    report.check('FAIL', 'pack-json', 'unreadable or not a JSON object', [{ where: at('pack.json', 1), what: 'pack.json cannot be read as a JSON object' }]);
    ctx.fatal = true;
    return;
  }

  const isStrArr = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string');
  const schema = [];
  if (typeof pj.name !== 'string' || !pj.name) schema.push('name must be a non-empty string');
  if (!isStrArr(pj.commands)) schema.push('commands must be an array of strings');
  const installOk = Array.isArray(pj.install) && pj.install.length > 0 && pj.install.every((e) => e && typeof e.from === 'string' && typeof e.to === 'string');
  if (!installOk) schema.push('install must be a non-empty array of { from, to } strings');
  if (typeof pj.selfcheck !== 'string' || !pj.selfcheck.trim()) schema.push('selfcheck must be a command string');
  const filesOk = isStrArr(pj.files);
  if (!filesOk) schema.push('files must be an array of strings');
  report.check(schema.length ? 'FAIL' : 'ok', 'pack-json', schema.length ? `${schema.length} schema problems` : 'name, commands, install, selfcheck, files present', schema.map((w) => ({ where: at('pack.json', 1), what: w })));

  const installLine = lineOfText(text, '"install"');
  const fromLine = (from) => lineOfText(text, JSON.stringify(from), installLine);
  const filesLine = lineOfText(text, '"files"');

  // (f) files list equals the files on disk, excluding nothing.
  const disk = walkFiles(packDir);
  const diskSet = new Set(disk);
  const listed = filesOk ? pj.files.map(normRel) : [];
  const listedSet = new Set(listed);
  if (filesOk) {
    const fails = [];
    const seen = new Set();
    for (const f of listed) {
      if (!safeRel(f)) fails.push({ where: at('pack.json', filesLine), what: `not a clean pack-relative path: ${f}` });
      else if (seen.has(f)) fails.push({ where: at('pack.json', filesLine), what: `listed twice: ${f}` });
      seen.add(f);
    }
    for (const f of listed) if (safeRel(f) && !diskSet.has(f)) fails.push({ where: at('pack.json', filesLine), what: `listed but not on disk: ${f}` });
    for (const f of disk) if (!listedSet.has(f)) fails.push({ where: at('pack.json', filesLine), what: `on disk but not listed: ${f}` });
    report.check(fails.length ? 'FAIL' : 'ok', 'files-list', `${listed.length} listed, ${disk.length} on disk`, fails);
  } else {
    report.check('SKIP', 'files-list', 'files is not a string array (see pack-json)');
  }

  // install-from is within files (a folder from is satisfied by entries under it).
  if (installOk && filesOk) {
    const fails = [];
    for (const e of pj.install) {
      const from = normRel(e.from);
      const ok = listedSet.has(from) || listed.some((f) => f.startsWith(`${from}/`));
      if (!ok) fails.push({ where: at('pack.json', fromLine(e.from)), what: `not in files: ${from}` });
    }
    report.check(fails.length ? 'FAIL' : 'ok', 'install-from', `${pj.install.length} install entries checked against files`, fails);
  } else {
    report.check('SKIP', 'install-from', 'install or files is malformed (see pack-json)');
  }

  if (!installOk) {
    for (const name of ['install', 'selfcheck', 'require', 'dirname', 'd3-link']) report.check('SKIP', name, 'install is malformed (see pack-json)');
    return;
  }

  // 0. Install into an EMPTY temp project.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-pack-'));
  ctx.temps.push(tmp);
  let gitNote = 'git init';
  if (gitAvailable()) {
    if (git(tmp, ['init', '-q']).status !== 0) gitNote = 'git init failed';
  } else {
    gitNote = 'git absent, git init skipped';
  }
  const installed = new Map();
  const roots = [];
  const installFails = [];
  for (const e of pj.install) {
    const from = normRel(e.from);
    const to = normRel(e.to);
    const where = at('pack.json', fromLine(e.from));
    if (!safeRel(from) || !safeRel(to) || to === '.git' || to.startsWith('.git/') || to === '.pack-meta' || to.startsWith('.pack-meta/')) {
      installFails.push({ where, what: `unsafe install path: ${e.from} -> ${e.to}` });
      continue;
    }
    const src = path.join(packDir, from);
    const dest = path.join(tmp, to);
    if (!fs.existsSync(src)) {
      installFails.push({ where, what: `from not found in the pack: ${from}` });
      continue;
    }
    if (isDir(src)) {
      copyTree(src, dest, (d, r) => installed.set(d, `${from}/${r}`));
      roots.push({ abs: dest, dir: true });
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      installed.set(dest, from);
      roots.push({ abs: dest, dir: false });
    }
  }
  const meta = path.join(tmp, '.pack-meta');
  fs.mkdirSync(meta, { recursive: true });
  for (const f of ['README.md', 'pack.json']) if (isFile(path.join(packDir, f))) fs.copyFileSync(path.join(packDir, f), path.join(meta, f));
  report.check(installFails.length ? 'FAIL' : 'ok', 'install', `${pj.install.length} entries, ${installed.size} files copied into an empty temp project (${gitNote})`, installFails);

  const within = (p) => roots.some((r) => (r.dir ? inside(p, r.abs) : pathKey(p) === pathKey(r.abs)));

  // (b) selfcheck, from the temp project root.
  if (typeof pj.selfcheck === 'string' && pj.selfcheck.trim()) {
    const t0 = Date.now();
    const r = spawnSync(pj.selfcheck, { cwd: tmp, shell: true, encoding: 'utf8', env: baseEnv(), timeout: SELFCHECK_TIMEOUT_MS, maxBuffer: 1 << 26 });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const where = at('pack.json', lineOfText(text, '"selfcheck"'));
    if (r.error || r.status !== 0) {
      const why = r.error ? `did not complete (${r.error.code || 'error'})` : r.status === null ? `killed by ${r.signal}` : `exit ${r.status}`;
      report.check('FAIL', 'selfcheck', `${why} after ${secs}s; last 20 lines follow`, [{ where, what: why }]);
      report.tail(`${r.stdout || ''}${r.stderr || ''}`, 20);
    } else {
      report.check('ok', 'selfcheck', `exit 0 in ${secs}s`);
    }
  } else {
    report.check('SKIP', 'selfcheck', 'no selfcheck command (see pack-json)');
  }

  // (c) static require and __dirname walk.
  const jsFiles = [...installed.keys()].filter((f) => /\.(?:c|m)?js$/i.test(f)).sort();
  const reqFails = [];
  const dirFails = [];
  let requires = 0;
  let prefixed = 0;
  let joins = 0;
  for (const abs of jsFiles) {
    const rel = installed.get(abs);
    const fileDir = path.dirname(abs);
    let calls;
    try { calls = scanJs(fs.readFileSync(abs, 'utf8')); } catch (e) {
      reqFails.push({ where: at(rel, 1), what: 'could not be scanned' });
      continue;
    }
    for (const c of calls) {
      if (c.kind === 'require') {
        requires++;
        const a = c.args[0];
        if (a && (a.type === 'prefix' || (a.type === 'pathcall' && evalPathCall(a, fileDir) && !evalPathCall(a, fileDir).complete))) prefixed++;
        const why = judgeRequire(a, fileDir, within);
        if (why) reqFails.push({ where: at(rel, c.line), what: why });
      } else if (c.args.length && c.args[0].type === 'dirname') {
        joins++;
        const r = evalPathCall(c, fileDir);
        if (!within(r.target)) {
          const shown = ['__dirname'].concat(r.segs.map((s) => JSON.stringify(s))).join(', ');
          dirFails.push({ where: at(rel, c.line), what: `path.${c.word}(${shown}) climbs out of the installed pack` });
        }
      }
    }
  }
  report.check(reqFails.length ? 'FAIL' : 'ok', 'require', `${requires} requires in ${jsFiles.length} js files (${prefixed} with a literal relative prefix)`, reqFails);
  report.check(dirFails.length ? 'FAIL' : 'ok', 'dirname', `${joins} literal path.join/resolve(__dirname, ...) chains`, dirFails);

  // (e) link closure on installed Markdown, plus the pack README against the pack folder.
  const mdFiles = [...installed.keys()].filter((f) => /\.md$/i.test(f)).sort();
  const templates = mdFiles.filter((f) => /\.tmpl\.md$/i.test(f));
  const linkFails = [];
  let links = 0;
  let checkedFiles = 0;
  for (const abs of mdFiles) {
    if (/\.tmpl\.md$/i.test(abs)) continue;
    checkedFiles++;
    const rel = installed.get(abs);
    for (const l of markdownLinks(fs.readFileSync(abs, 'utf8'))) {
      const why = judgeLink(l.target, path.dirname(abs), tmp, within);
      if (why === undefined) continue;
      links++;
      if (why) linkFails.push({ where: at(rel, l.line), what: why });
    }
  }
  const readme = path.join(packDir, 'README.md');
  if (isFile(readme)) {
    checkedFiles++;
    for (const l of markdownLinks(fs.readFileSync(readme, 'utf8'))) {
      const why = judgeLink(l.target, packDir, packDir, (p) => inside(p, packDir));
      if (why === undefined) continue;
      links++;
      if (why) linkFails.push({ where: at('README.md', l.line), what: why.replace('installed pack', 'pack folder') });
    }
  }
  report.check(linkFails.length ? 'FAIL' : 'ok', 'd3-link', `${links} relative links in ${checkedFiles} files; ${templates.length} *.tmpl.md templates skipped (their links resolve where the rendered document is written); the pack README is checked against the pack folder`, linkFails);
}

// ---------------------------------------------------------------- fixture manifest

function checkFixtureManifest(root, files, report) {
  const under = files.filter((f) => f.startsWith(FIXTURE_PREFIX) && f !== FIXTURE_MANIFEST);
  const manifestAbs = path.join(root, FIXTURE_MANIFEST);
  if (!under.length && !isFile(manifestAbs)) {
    report.check('SKIP', 'fixture-manifest', `no ${FIXTURE_PREFIX} folder at this root`);
    return;
  }
  let text;
  let doc;
  try {
    text = fs.readFileSync(manifestAbs, 'utf8');
    doc = JSON.parse(text);
    if (!doc || !Array.isArray(doc.cases)) throw new Error('no cases');
  } catch (e) {
    report.check('FAIL', 'fixture-manifest', 'manifest missing or unreadable', [{ where: `${FIXTURE_MANIFEST}:1`, what: 'missing, unreadable, or has no cases array' }]);
    return;
  }
  const declared = new Map();
  for (const c of doc.cases) for (const f of (c && Array.isArray(c.files) ? c.files : [])) declared.set(FIXTURE_PREFIX + normRel(f), f);
  const fails = [];
  for (const f of under) if (!declared.has(f)) fails.push({ where: `${f}:1`, what: `not declared in ${FIXTURE_MANIFEST}` });
  for (const [full, raw] of declared) if (!isFile(path.join(root, full))) fails.push({ where: `${FIXTURE_MANIFEST}:${lineOfText(text, JSON.stringify(raw))}`, what: `declared but missing: ${raw}` });
  report.check(fails.length ? 'FAIL' : 'ok', 'fixture-manifest', `${under.length} fixture files, ${declared.size} declared in ${doc.cases.length} cases`, fails);
}

// ---------------------------------------------------------------- the run

function runEnforcer(rootArg) {
  const root = path.resolve(rootArg);
  if (!isDir(root)) {
    console.error('standalone-pack: --root is not a folder');
    console.error(USAGE);
    return 2;
  }
  let digests;
  try { digests = loadDigests(); } catch (e) {
    console.error(`standalone-pack: cannot load forbidden-hashes.json (${e.message})`);
    return 2;
  }
  const ctx = { temps: [], failures: 0, fatal: false };
  const strict = process.env[ENV_STRICT] === '1';
  const personal = readList(ENV_PERSONAL);
  const instance = readList(ENV_INSTANCE);
  const personalTokens = personal.state === 'loaded' ? personal.entries.map(j1Normalise) : [];
  const safe = makeSafe(ctx, personalTokens, digests);
  const report = makeReporter(ctx, safe);
  let packs = [];
  try {
    const gitOk = gitAvailable();
    const top = gitOk && isGitTop(root);
    console.log(`standalone-pack: root ${path.basename(root) || '.'}, git ${gitOk ? (top ? 'repo root' : 'present, root is not a repo root') : 'absent'}, strict ${strict ? 'on' : 'off'}`);
    console.log(`exempt: ${FIXTURE_PREFIX} (shape, hash)`);
    if (personal.state === 'absent' && instance.state === 'absent') {
      console.log('local tiers: absent (personal, instance cross-check), generic + hash tiers only');
    } else {
      const desc = (l, unit) => (l.state === 'loaded' ? `loaded (${l.entries.length} ${unit})` : l.state);
      console.log(`local tiers: personal list ${desc(personal, 'tokens')}, instance list ${desc(instance, 'entries')}`);
    }

    packs = discoverPacks(root);
    const allowed = new Set();
    for (const p of packs) if (p.pj && Array.isArray(p.pj.commands)) for (const c of p.pj.commands) if (typeof c === 'string') allowed.add(c);

    // Local lists and strict mode.
    const listFails = [];
    for (const [name, list] of [[ENV_PERSONAL, personal], [ENV_INSTANCE, instance]]) {
      if (list.state === 'loaded') continue;
      if (strict) listFails.push({ where: `env:${name}`, check: 'strict', what: `list ${list.state}; strict mode requires it` });
      else if (list.state !== 'absent') listFails.push({ where: `env:${name}`, check: 'local-list', what: `list ${list.state}; the variable is set, so the file must be readable and non-empty` });
    }
    if (strict) report.check(listFails.length ? 'FAIL' : 'ok', 'strict', `${2 - listFails.length} of 2 local lists loaded`, listFails);
    else report.check(listFails.length ? 'FAIL' : 'SKIP', listFails.length ? 'local-list' : 'strict', listFails.length ? 'a local list variable is set but unusable' : `off (set ${ENV_STRICT}=1 to require both local lists)`, listFails);

    // Population (i): every repo file.
    const pop = listRepoFiles(root, top);
    const fails = { shape: [], hash: [], personal: [], d2: [] };
    let scanned = 0;
    let binary = 0;
    let exempt = 0;
    let skipped = 0;
    for (const rel of pop.files) {
      const abs = path.join(root, rel);
      let st;
      try { st = fs.lstatSync(abs); } catch (e) { skipped++; continue; }
      if (!st.isFile()) { skipped++; continue; }
      const buf = fs.readFileSync(abs);
      if (buf.subarray(0, 8000).includes(0)) { binary++; continue; }
      const text = buf.toString('utf8');
      scanned++;
      const isExempt = rel.startsWith(FIXTURE_PREFIX);
      if (isExempt) exempt++;
      if (!isExempt) {
        for (const h of shapeHits(text)) fails.shape.push({ where: `${rel}:${h.line}`, what: h.label });
        for (const h of shapeHits(rel)) fails.shape.push({ where: `${rel}:0`, what: `${h.label} (in the file path)` });
        for (const h of j1Hits(text, digests)) fails.hash.push({ where: `${rel}:${h.line}`, what: h.label });
        for (const h of j1Hits(rel, digests)) fails.hash.push({ where: `${rel}:0`, what: `${h.label} (in the file path)` });
      }
      for (const h of personalHits(text, personalTokens)) fails.personal.push({ where: `${rel}:${h.line}`, what: `personal-token #${h.index}` });
      for (const h of personalHits(rel, personalTokens)) fails.personal.push({ where: `${rel}:0`, what: `personal-token #${h.index} (in the file path)` });
      for (const h of d2Hits(text, allowed)) fails.d2.push({ where: `${rel}:${h.line}`, what: `${h.cmd} is not in any pack.json commands` });
    }
    console.log(`repo population: ${pop.files.length} files via ${pop.via}; ${scanned} text files scanned (${exempt} exempt from shape and hash), ${binary} binary and ${skipped} other entries skipped`);
    const tierFiles = scanned - exempt;
    report.check(fails.shape.length ? 'FAIL' : 'ok', 'shape', `${fails.shape.length} hits in ${tierFiles} files (${SHAPES.length} patterns)`, fails.shape);
    report.check(fails.hash.length ? 'FAIL' : 'ok', 'hash', `${fails.hash.length} hits in ${tierFiles} files (${digests.size} digests, transform J1)`, fails.hash);
    if (personalTokens.length) report.check(fails.personal.length ? 'FAIL' : 'ok', 'personal', `${fails.personal.length} hits in ${scanned} files (${personalTokens.length} tokens)`, fails.personal);
    else report.check('SKIP', 'personal', `no personal list (env ${ENV_PERSONAL})`);
    report.check(fails.d2.length ? 'FAIL' : 'ok', 'd2-command', `${fails.d2.length} undeclared commands in ${scanned} files (allowed: ${[...allowed].sort().join(', ') || 'none'})`, fails.d2);

    // Check (g): the git log, with every tier.
    if (!top) {
      report.check('SKIP', 'git-log', gitOk ? 'the root is not a git repo root' : 'git absent');
    } else {
      const gl = gitLogCommits(root);
      if (gl.error) {
        report.check('FAIL', 'git-log', 'git log could not be read', [{ where: 'git-log', what: gl.error }]);
      } else {
        const gf = [];
        for (const c of gl.commits) {
          const where = `git-log:${c.sha.slice(0, 7)}`;
          for (const h of shapeHits(c.text)) gf.push({ where, check: 'shape', what: h.label });
          for (const h of j1Hits(c.text, digests)) gf.push({ where, check: 'hash', what: h.label });
          for (const h of personalHits(c.text, personalTokens)) gf.push({ where, check: 'personal', what: `personal-token #${h.index}` });
        }
        report.check(gf.length ? 'FAIL' : 'ok', 'git-log', `${gf.length} hits in ${gl.commits.length} commits (shape, hash${personalTokens.length ? ', personal' : ''})`, gf);
      }
    }

    checkFixtureManifest(root, pop.files, report);

    // Strict cross-check: the instance list and the committed digests agree both ways.
    if (instance.state === 'loaded') {
      const where = `env:${ENV_INSTANCE}`;
      const cf = [];
      const seen = new Set();
      instance.entries.forEach((entry, i) => {
        const toks = j1Split(entry);
        if (toks.length < 1 || toks.length > 2) {
          cf.push({ where, what: `entry #${i + 1} has ${toks.length} tokens; one or two are supported` });
          return;
        }
        const d = sha256(toks.join(' '));
        seen.add(d);
        if (!digests.has(d)) cf.push({ where, what: `entry #${i + 1} has no committed digest` });
      });
      for (const [d, label] of digests) if (!isCanary(label) && !seen.has(d)) cf.push({ where, what: `committed ${label} matches no instance entry` });
      report.check(cf.length ? 'FAIL' : 'ok', 'cross-check', `${instance.entries.length} instance entries against ${digests.size} committed digests (the canaries are excluded from the reverse check)`, cf);
    } else {
      report.check('SKIP', 'cross-check', `no instance list (env ${ENV_INSTANCE})`);
    }

    // Population (ii): each pack, installed.
    if (!packs.length) {
      report.check('FAIL', 'packs', 'zero packs found', [{ where: '(root)', what: 'zero packs found (a pack is a top-level folder holding pack.json)' }]);
    } else {
      report.check('ok', 'packs', `${packs.length} found: ${packs.map((p) => p.dirName).join(', ')}`);
    }
    for (const p of packs) checkPack(p, report, ctx);
  } finally {
    if (KEEP_TMP) {
      for (const t of ctx.temps) console.log(`kept temp project (KEEP_TMP=1): ${t}`);
    } else {
      for (const t of ctx.temps) removeDir(t);
    }
  }
  console.log(`standalone-pack: ${packs.length} packs, ${ctx.failures} failures`);
  if (ctx.fatal) return 2;
  return ctx.failures ? 1 : 0;
}

// ---------------------------------------------------------------- self-test

// Build steps for cases whose content must not sit in a committed file.
const BUILDERS = {
  'd2-command'(tmp) {
    fs.writeFileSync(path.join(tmp, 'NOTES.md'), `# Notes\nRun ${'/' + 'zz' + ':yy'} next.\n`);
  },
  'empty-install-folder'(tmp) {
    fs.mkdirSync(path.join(tmp, 'demo', 'kit', 'empty'), { recursive: true });
  },
  'git-log'(tmp, o) {
    if (!o.gitOk) return 'git absent';
    const msg = ['fixture: a commit message that leaks', `see ${['TRACK', 'ER.md'].join('')}`, `word ${o.canaryWord}`, 'contact zz-dummy-personal-zz', ''].join('\n');
    const id = ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false'];
    if (git(tmp, ['add', '-A']).status !== 0) throw new Error('git add failed');
    const r = git(tmp, id.concat(['commit', '-q', '-F', '-']), { input: msg });
    if (r.status !== 0) throw new Error('git commit failed');
    return null;
  },
  'fixture-manifest'(tmp) {
    const dir = path.join(tmp, 'scripts', 'checks', 'fixtures');
    fs.mkdirSync(path.join(dir, 'x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), ['{', '  "cases": [', '    { "case": "x", "files": [', '      "x/declared.md",', '      "x/gone.md"', '    ] }', '  ]', '}', ''].join('\n'));
    fs.writeFileSync(path.join(dir, 'x', 'declared.md'), '# declared\n');
    fs.writeFileSync(path.join(dir, 'x', 'stray.md'), '# not declared\n');
  },
  'zero-packs'(tmp) {
    removeDir(path.join(tmp, 'demo'));
  },
};

// Every check class the self-test must prove RED at least once.
const REQUIRED_RED = ['shape', 'hash', 'personal', 'd2-command', 'd3-link', 'require', 'dirname', 'selfcheck', 'install', 'files-list', 'install-from', 'git-log', 'strict', 'cross-check', 'fixture-manifest', 'packs', 'pack-json'];

function parseFailureLines(output) {
  const out = [];
  for (const l of output.split(/\r?\n/)) {
    const m = /^(\S+)  (\S+)  (.*)$/.exec(l);
    if (m) out.push({ at: m[1], check: m[2], what: m[3] });
  }
  return out;
}

function selfTest() {
  let manifest;
  let digests;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8'));
    digests = loadDigests();
  } catch (e) {
    console.error(`self-test: cannot load the fixture manifest or the digests (${e.message})`);
    return 2;
  }
  const canaryWord = ['zqx', 'canary', 'vok'].join('');
  const canaryPair = `${['zqx', 'canary'].join('')} ${'vok'}`;
  const problems = [];
  if (digests.get(sha256(canaryWord)) !== 'canary') problems.push('the canary digest is missing from forbidden-hashes.json');
  if (digests.get(sha256(canaryPair)) !== 'canary-bigram') problems.push('the canary-bigram digest is missing from forbidden-hashes.json');

  // The fixture folder and the manifest agree.
  const declared = new Set();
  for (const c of manifest.cases) for (const f of c.files || []) declared.add(f);
  for (const f of walkFiles(FIXTURE_DIR)) if (f !== 'manifest.json' && !declared.has(f)) problems.push(`fixture file not declared in the manifest: ${f}`);
  for (const f of declared) if (!isFile(path.join(FIXTURE_DIR, f))) problems.push(`declared fixture file is missing: ${f}`);

  const covered = new Set();
  for (const c of manifest.cases) for (const h of (c.expect && c.expect.hits) || []) covered.add(h.at.startsWith('git-log:') ? 'git-log' : h.check);
  for (const k of REQUIRED_RED) if (!covered.has(k)) problems.push(`no case proves the ${k} check RED`);
  if (!manifest.cases.some((c) => c.expect && c.expect.exit === 0)) problems.push('no GREEN control case');

  const gitOk = gitAvailable();
  const lists = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-selftest-lists-'));
  const dummyList = path.join(lists, 'personal.txt');
  const canaryList = path.join(lists, 'instance.txt');
  const trigramList = path.join(lists, 'instance-trigram.txt');
  fs.writeFileSync(dummyList, '# dummy personal list for the self-test\n\nzz-dummy-personal-zz\n');
  fs.writeFileSync(canaryList, `${canaryWord}\n`);
  fs.writeFileSync(trigramList, `${['zqx', 'canary', 'vok'].join(' ')}\n`);
  const controlDir = path.join(FIXTURE_DIR, manifest.control);

  console.log(`self-test: ${manifest.cases.length} cases from ${FIXTURE_MANIFEST} (git ${gitOk ? 'present' : 'absent'})`);
  let failed = 0;
  let skippedCases = 0;
  try {
    for (const c of manifest.cases) {
      const errs = [];
      let output = '';
      let status = null;
      let skip = null;
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `standalone-selftest-${c.case}-`));
      try {
        copyTree(controlDir, tmp);
        if (c.case !== manifest.control) {
          for (const f of c.files || []) {
            const prefix = `${c.case}/`;
            if (!f.startsWith(prefix)) throw new Error(`file ${f} is not under its case folder`);
            const dest = path.join(tmp, f.slice(prefix.length));
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(path.join(FIXTURE_DIR, f), dest);
          }
        }
        if (gitOk && git(tmp, ['init', '-q']).status !== 0) throw new Error('git init failed');
        if (c.build) {
          const b = BUILDERS[c.build];
          if (!b) throw new Error(`unknown build step: ${c.build}`);
          skip = b(tmp, { gitOk, canaryWord }) || null;
        }
        if (!skip) {
          const env = baseEnv();
          if (c.env && c.env.personal === 'dummy') env[ENV_PERSONAL] = dummyList;
          if (c.env && c.env.instance === 'canary-only') env[ENV_INSTANCE] = canaryList;
          if (c.env && c.env.instance === 'trigram') env[ENV_INSTANCE] = trigramList;
          if (c.env && c.env.strict) env[ENV_STRICT] = '1';
          const r = spawnSync(process.execPath, [__filename, '--root', tmp].concat(c.args || []), { env, encoding: 'utf8', timeout: SELFCHECK_TIMEOUT_MS, maxBuffer: 1 << 26 });
          output = `${r.stdout || ''}${r.stderr || ''}`;
          status = r.status;
        }
      } catch (e) {
        errs.push(`setup failed: ${e.message}`);
      } finally {
        if (!KEEP_TMP) removeDir(tmp);
      }
      const exp = c.expect || {};
      if (skip) {
        skippedCases++;
        console.log(`  SKIP  ${c.case.padEnd(26)} ${skip}`);
        continue;
      }
      const lines = parseFailureLines(output);
      if (!errs.length) {
        if (status !== exp.exit) errs.push(`exit ${status}, expected ${exp.exit}`);
        for (const h of exp.hits || []) {
          const atRe = new RegExp(`^${escapeRe(h.at).replace('<sha>', '[0-9a-f]{7,40}')}$`);
          if (!lines.some((f) => atRe.test(f.at) && f.check === h.check && (!h.what || f.what.includes(h.what)))) errs.push(`missing: ${h.at}  ${h.check}${h.what ? `  ${h.what}` : ''}`);
        }
        const allowedChecks = new Set((exp.hits || []).map((h) => h.check).concat(exp.also || []));
        const stray = [...new Set(lines.filter((f) => !allowedChecks.has(f.check)).map((f) => `${f.at}  ${f.check}`))];
        if (stray.length) errs.push(`unexpected failures: ${stray.slice(0, 5).join('; ')}`);
        for (const t of exp.text || []) if (!output.includes(t)) errs.push(`output lacks: ${t}`);
        for (const t of exp.notText || []) if (output.toLowerCase().includes(t.toLowerCase())) errs.push('output contains text it must not print');
      }
      if (errs.length) {
        failed++;
        console.log(`  FAIL  ${c.case.padEnd(26)} ${errs.join(' | ')}`);
        for (const l of output.replace(/\s+$/, '').split(/\r?\n/).slice(-30)) console.log(`    | ${l}`);
      } else if (exp.exit === 0) {
        console.log(`  ok    ${c.case.padEnd(26)} GREEN (exit 0, no failure lines)`);
      } else {
        const checks = [...new Set((exp.hits || []).map((h) => h.check))].join(', ') || 'usage';
        const where = (exp.hits || []).length ? (exp.hits || []).map((h) => h.at).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ') : 'n/a';
        console.log(`  ok    ${c.case.padEnd(26)} RED (exit ${status}) as expected: ${checks} at ${where}${(exp.hits || []).length > 3 ? ', ...' : ''}`);
      }
    }
  } finally {
    removeDir(lists);
  }
  for (const p of problems) console.log(`  FAIL  ${'manifest'.padEnd(26)} ${p}`);
  failed += problems.length;
  console.log(`self-test: ${manifest.cases.length} cases, ${skippedCases} skipped, ${failed} failures`);
  return failed ? 1 : 0;
}

// ---------------------------------------------------------------- entry

function parseArgv(argv) {
  const o = { root: DEFAULT_ROOT, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') o.selfTest = true;
    else if (a === '--root') {
      const v = argv[++i];
      if (!v) return { error: '--root needs a folder' };
      o.root = v;
    } else if (a.startsWith('--root=')) o.root = a.slice('--root='.length);
    else if (a === '--help' || a === '-h') return { help: true };
    else return { error: 'unknown argument' };
  }
  return o;
}

function main() {
  const o = parseArgv(process.argv.slice(2));
  if (o.help) { console.log(USAGE); return 0; }
  if (o.error) {
    console.error(`standalone-pack: ${o.error}`);
    console.error(USAGE);
    return 2;
  }
  return o.selfTest ? selfTest() : runEnforcer(o.root);
}

if (require.main === module) {
  let code;
  try { code = main(); } catch (e) {
    const home = os.homedir();
    const msg = String(e && e.stack ? e.stack : e);
    console.error(`standalone-pack: internal error: ${home ? msg.split(home).join('<home>') : msg}`);
    code = 1;
  }
  process.exitCode = code;
}
