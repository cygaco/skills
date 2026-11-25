'use strict';
// Catalog reader: every skill Claude Code would list for this project, read from disk.
// Locations: the project's .claude/commands and .claude/skills, the same two under the
// user's home .claude folder, and the commands/skills of enabled plugins. Reads only
// frontmatter and the first lines of each file; never runs anything.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SELF = 'plain';
const SLUG_OK = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,63}$/;
const MAX_SKILLS = 2000;
// Ask-first: a skill that may change something outside the working copy. The router never
// suggests one and the map lists it as "the user runs it". A skill is ask-first when its own
// frontmatter says so (confirm-first: true, ask-first: true or disable-model-invocation:
// true) OR its name or description contains one of these words in any -s, -es, -ed, -ing
// form (e-dropping "deleting", doubled "shipped" included). The list is closed and
// best-effort: it over-includes (a "release notes" skill counts) and misses wording outside
// it (for example "land", "upload", "remove").
const ASK_FIRST_WORDS = ['push', 'deploy', 'release', 'publish', 'merge', 'ship', 'delete', 'drop', 'destroy', 'wipe', 'purge', 'revoke', 'rotate', 'force', 'send', 'email', 'blast', 'production', 'prod', 'spend', 'purchase', 'buy', 'pay', 'payment', 'charge', 'refund', 'invoice', 'billing', 'subscribe'];
function inflections(w) {
  const out = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`]);
  if (w.endsWith('e')) out.add(`${w.slice(0, -1)}ing`);
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(w)) { const d = w + w.slice(-1); out.add(`${d}ed`); out.add(`${d}ing`); out.add(`${d}er`); }
  return [...out];
}
const ASK_FIRST_FORMS = [...new Set(ASK_FIRST_WORDS.flatMap(inflections))].sort((a, b) => b.length - a.length);
const RISKY = new RegExp(`\\b(?:${ASK_FIRST_FORMS.join('|')})\\b`, 'i');

function readFrontmatter(raw) {
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // a byte-order mark before the frontmatter
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = {};
  if (!m) return { fm, body: raw };
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) {
      key = kv[1].toLowerCase();
      fm[key] = kv[2].trim();
    } else if (key && /^\s+\S/.test(line)) {
      fm[key] = `${fm[key]} ${line.trim()}`.trim();
    }
  }
  for (const k of Object.keys(fm)) {
    let v = fm[k];
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    if (v === '>' || v === '|' || v === '>-' || v === '|-') v = '';
    fm[k] = v.replace(/^[>|]-?\s+/, '');
  }
  return { fm, body: raw.slice(m[0].length) };
}

const truthy = (v) => /^(true|yes|1)$/i.test(String(v || '').trim());

function firstParagraph(body) {
  const lines = String(body).split(/\r?\n/).map((l) => l.trim());
  const text = lines.filter((l) => l && !l.startsWith('#') && !l.startsWith('```')).slice(0, 3).join(' ');
  return text.slice(0, 200);
}

function toSkill(slug, file, raw, origin) {
  const { fm, body } = readFrontmatter(raw);
  const fullDescription = fm.description || firstParagraph(body) || '';
  const description = fullDescription.slice(0, 400);
  // disable-model-invocation: the model may not start it; the map lists it as "user runs it".
  const userOnly = truthy(fm['disable-model-invocation']);
  // the risk test reads the FULL name, description and when_to_use, not the routing copy
  const askFirst = userOnly || truthy(fm['confirm-first']) || truthy(fm['ask-first']) || RISKY.test(`${slug.replace(/[:\-_.]/g, ' ')} ${fullDescription} ${fm.when_to_use || fm['when-to-use'] || ''}`);
  return {
    slug,
    description,
    whenToUse: (fm.when_to_use || fm['when-to-use'] || '').slice(0, 300),
    hint: (fm['argument-hint'] || '').slice(0, 40),
    userOnly,
    askFirst,
    origin,
    file,
  };
}

function walkMd(dir, rel, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, rel ? `${rel}/${e.name}` : e.name, out);
    else if ((e.isFile() || e.isSymbolicLink()) && e.name.toLowerCase().endsWith('.md')) out.push({ file: p, rel: rel ? `${rel}/${e.name.slice(0, -3)}` : e.name.slice(0, -3) });
  }
  return out;
}

function readSafe(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.slice(0, n).toString('utf8');
  } catch { return null; }
}

// commands dir: <dir>/a/b.md -> "a:b"; skills dir: <dir>/<name>/SKILL.md -> frontmatter name or <name>.
function fromDirs(base, prefix, origin, out) {
  for (const f of walkMd(path.join(base, 'commands'), '', [])) {
    const slug = (prefix ? `${prefix}:` : '') + f.rel.split('/').join(':');
    out.push({ slug, file: f.file, origin });
  }
  let ents = [];
  try { ents = fs.readdirSync(path.join(base, 'skills'), { withFileTypes: true }); } catch { /* none */ }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    const file = path.join(base, 'skills', e.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    out.push({ slug: null, dirName: e.name, prefix, file, origin });
  }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function pluginBases(root, home) {
  const out = [];
  const installed = readJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  if (!installed || typeof installed.plugins !== 'object') return out;
  const enabled = {};
  for (const s of [path.join(home, '.claude', 'settings.json'), path.join(root, '.claude', 'settings.json'), path.join(root, '.claude', 'settings.local.json')]) {
    const j = readJson(s);
    if (j && j.enabledPlugins && typeof j.enabledPlugins === 'object') Object.assign(enabled, j.enabledPlugins);
  }
  const rootKey = path.resolve(root).toLowerCase();
  for (const [id, list] of Object.entries(installed.plugins)) {
    if (enabled[id] === false || (Object.keys(enabled).length && enabled[id] !== true)) continue;
    for (const inst of Array.isArray(list) ? list : []) {
      if (!inst || !inst.installPath) continue;
      if (inst.scope === 'project' || inst.scope === 'local') {
        if (!inst.projectPath || path.resolve(inst.projectPath).toLowerCase() !== rootKey) continue;
      }
      out.push({ base: inst.installPath, prefix: id.split('@')[0] });
      break;
    }
  }
  return out;
}

// Returns { skills: [...], fingerprint }. Project skills shadow user skills of the same name.
function readCatalog(root, opts = {}) {
  const home = opts.home || process.env.PLAIN_HOME || os.homedir();
  const found = [];
  fromDirs(path.join(root, '.claude'), '', 'project', found);
  if (!opts.projectOnly) {
    fromDirs(path.join(home, '.claude'), '', 'user', found);
    for (const p of pluginBases(root, home)) fromDirs(p.base, p.prefix, 'plugin', found);
  }
  const seen = new Set();
  const skills = [];
  const unreadable = [];
  const fp = crypto.createHash('sha256');
  // `only`: one name, matched exactly or as the part after a plugin prefix ("mirror" also
  // finds "acme:mirror")
  const matches = (s) => !opts.only || s.toLowerCase() === opts.only || s.toLowerCase().endsWith(`:${opts.only}`);
  for (const f of found) {
    if (f.slug && !matches(f.slug)) continue; // skip the read
    let st;
    let raw = null;
    try { st = fs.statSync(f.file); raw = readSafe(f.file); } catch { raw = null; }
    if (raw == null) {
      if (opts.only && (f.slug ? matches(f.slug) : String(f.dirName || '').toLowerCase() === opts.only.split(':').pop())) unreadable.push(f.file);
      continue;
    }
    let slug = f.slug;
    if (!slug) {
      const { fm } = readFrontmatter(raw);
      slug = (f.prefix ? `${f.prefix}:` : '') + (fm.name || f.dirName);
    }
    // Names reach the model's context, so only plain skill identifiers are routed; anything
    // else (spaces, markup, over 64 characters) is left to the harness's own listing.
    // Case-insensitive: two skills that differ only in case are one name to a speaker.
    if (slug === SELF || seen.has(slug.toLowerCase()) || !SLUG_OK.test(slug)) continue;
    if (!opts.noCap && skills.length >= MAX_SKILLS) break;
    if (!matches(slug)) continue;
    seen.add(slug.toLowerCase());
    fp.update(`${slug}\0${st.size}\0${Math.floor(st.mtimeMs)}\n`);
    skills.push(toSkill(slug, f.file, raw, f.origin));
  }
  skills.sort((a, b) => a.slug.localeCompare(b.slug));
  return { skills, fingerprint: fp.digest('hex').slice(0, 16), unreadable };
}

// The one ask-first test. The map, the hint layer, the name layer and the Skill-tool guard
// all call this, so they can never disagree about which skills the user must type themselves.
const isAskFirst = (s) => Boolean(s && (s.askFirst || s.userOnly));

// For the guard: is this exact skill ask-first, judged from disk right now (no index, no cap,
// no exclude list)? A name not found anywhere is judged by its own words.
// A skill file that exists but cannot be read counts as ask-first (the guard cannot tell).
// An unprefixed name that matches plugin skills is ask-first if any of them is.
function askFirstLive(root, slug) {
  const want = String(slug || '').toLowerCase();
  const cat = readCatalog(root, { noCap: true, only: want });
  if (cat.unreadable.length) return { found: true, askFirst: true, unreadable: true, skill: null };
  const exact = cat.skills.find((s) => s.slug.toLowerCase() === want);
  if (exact) return { found: true, askFirst: isAskFirst(exact), skill: exact };
  if (cat.skills.length) return { found: true, askFirst: cat.skills.some(isAskFirst), skill: cat.skills[0] };
  return { found: false, askFirst: RISKY.test(want.replace(/[:\-_.]/g, ' ')), skill: null };
}

module.exports = { readCatalog, readFrontmatter, isAskFirst, askFirstLive, RISKY, ASK_FIRST_WORDS, ASK_FIRST_FORMS, SELF };
