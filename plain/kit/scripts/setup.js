#!/usr/bin/env node
'use strict';
// /plain helper. Run from the project root.
//   node .claude/plain/scripts/setup.js status              -> JSON: installed or not, index, map
//   node .claude/plain/scripts/setup.js install             -> add the three hooks, build index + map
//   node .claude/plain/scripts/setup.js refresh             -> rebuild index + map (skills, learned phrases)
//   node .claude/plain/scripts/setup.js health              -> JSON: counts, map size, recent misses
//   node .claude/plain/scripts/setup.js test --file <path>  -> what the hooks would add for the message in <path>
//   node .claude/plain/scripts/setup.js uninstall           -> remove the three hooks (files stay)
// Options: --root <dir> (default: current folder), --settings shared|local (default local).
// The test phrase is read from a file, never from the command line, so no shell ever sees it.
const fs = require('fs');
const path = require('path');
const core = require('./lib/core.js');
const misslog = require('./lib/misslog.js');
const safefs = require('./lib/safefs.js');
const { readCatalog } = require('./lib/catalog.js');

const ENTRIES = {
  SessionStart: { matcher: '', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/plain/scripts/hook-session.js"', timeout: 10 }] },
  UserPromptSubmit: { hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/plain/scripts/hook-prompt.js"', timeout: 10 }] },
  // onFailure "block": when the guard itself fails (it crashes, times out or cannot start),
  // Claude Code blocks the Skill call instead of letting it through. Claude Code versions
  // that do not know the field ignore it. Only the guard carries it: the other two hooks
  // never block.
  PreToolUse: { matcher: 'Skill', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/plain/scripts/hook-skill.js"', timeout: 10, onFailure: 'block' }] },
};
// Ownership is the exact command string this version installs, nothing looser. Other fields
// (timeout, onFailure) do not decide ownership, so an entry without onFailure is still ours.
const OUR_COMMANDS = new Set(Object.values(ENTRIES).map((e) => e.hooks[0].command));
const ours = (h) => Boolean(h && h.type === 'command' && OUR_COMMANDS.has(h.command));
const GUARD_COMMAND = ENTRIES.PreToolUse.hooks[0].command;

// Our guard entries in these settings that lack onFailure "block" get it. Returns the count.
function upgradeGuard(j) {
  let n = 0;
  for (const g of (j.hooks && j.hooks.PreToolUse) || []) {
    if (!g || !Array.isArray(g.hooks)) continue;
    for (const h of g.hooks) {
      if (ours(h) && h.command === GUARD_COMMAND && h.onFailure !== 'block') { h.onFailure = 'block'; n++; }
    }
  }
  return n;
}

function args(argv) {
  const out = { cmd: argv[0] || 'status', rest: [], root: process.cwd(), settings: 'local', file: null };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
    else if (argv[i] === '--settings') out.settings = argv[++i];
    else if (argv[i] === '--file') out.file = argv[++i];
    else out.rest.push(argv[i]);
  }
  out.root = path.resolve(out.root);
  return out;
}

const settingsRel = (which) => path.join('.claude', which === 'shared' ? 'settings.json' : 'settings.local.json');

// Settings must be a JSON object whose "hooks" (if any) is an object of arrays. Anything else
// is left exactly as it is and the command stops.
function readSettings(root, rel) {
  const p = safefs.assertInside(root, rel, 'file');
  if (!fs.existsSync(p)) return {};
  const raw = safefs.readCapped(p, 4 << 20);
  if (raw == null) throw new Error(`${rel} is too large or not a regular file; not touching it`);
  const j = JSON.parse(raw);
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error(`${rel} is not a JSON object; not touching it`);
  if (j.hooks !== undefined) {
    if (!j.hooks || typeof j.hooks !== 'object' || Array.isArray(j.hooks)) throw new Error(`${rel} has a "hooks" value that is not an object; not touching it`);
    for (const ev of Object.keys(j.hooks)) {
      if (!Array.isArray(j.hooks[ev])) throw new Error(`${rel} has hooks.${ev} that is not a list; not touching it`);
    }
  }
  return j;
}

function hooksPresent(root) {
  const found = {};
  for (const which of ['local', 'shared']) {
    let j;
    try { j = readSettings(root, settingsRel(which)); } catch { continue; }
    for (const ev of Object.keys(ENTRIES)) {
      const groups = (j.hooks && j.hooks[ev]) || [];
      if (groups.some((g) => g && Array.isArray(g.hooks) && g.hooks.some(ours))) found[ev] = which;
    }
  }
  return found;
}

function install(root, which) {
  const rel = settingsRel(which);
  const j = readSettings(root, rel);
  safefs.ensureDir(root, '.claude');
  const p = path.join(root, rel);
  if (fs.existsSync(p) && !fs.existsSync(`${p}.before-plain`)) safefs.writeAtomic(root, `${rel}.before-plain`, fs.readFileSync(p));
  j.hooks = j.hooks || {};
  // a hook already present in EITHER settings file is not added again (it would run twice)
  const present = hooksPresent(root);
  let added = 0;
  for (const [ev, entry] of Object.entries(ENTRIES)) {
    const groups = j.hooks[ev] || [];
    if (!present[ev] && !groups.some((g) => g && Array.isArray(g.hooks) && g.hooks.some(ours))) {
      groups.push(JSON.parse(JSON.stringify(entry)));
      added++;
    }
    j.hooks[ev] = groups;
  }
  let updated = upgradeGuard(j);
  safefs.writeAtomic(root, rel, `${JSON.stringify(j, null, 2)}\n`);
  // the guard may sit in the other settings file: it gets the field there too
  const otherRel = settingsRel(which === 'shared' ? 'local' : 'shared');
  if (present.PreToolUse && fs.existsSync(path.join(root, otherRel))) {
    let o = {};
    try { o = readSettings(root, otherRel); } catch { o = {}; } // a file it cannot read is left as it is
    const n = upgradeGuard(o);
    if (n) {
      const op = path.join(root, otherRel);
      if (!fs.existsSync(`${op}.before-plain`)) safefs.writeAtomic(root, `${otherRel}.before-plain`, fs.readFileSync(op));
      safefs.writeAtomic(root, otherRel, `${JSON.stringify(o, null, 2)}\n`);
      updated += n;
    }
  }
  const stored = core.build(root);
  return { settings: rel, hooksAdded: added, hooksUpdated: updated, skills: stored.skills.length, mapTokens: stored.map.tokens };
}

function uninstall(root) {
  const removed = [];
  for (const which of ['local', 'shared']) {
    const rel = settingsRel(which);
    if (!fs.existsSync(path.join(root, rel))) continue;
    const j = readSettings(root, rel);
    if (!j.hooks) continue;
    let n = 0;
    for (const ev of Object.keys(ENTRIES)) {
      if (!j.hooks[ev]) continue;
      const kept = [];
      for (const g of j.hooks[ev]) {
        if (!g || !Array.isArray(g.hooks)) { kept.push(g); continue; }
        const hs = g.hooks.filter((h) => !ours(h));
        n += g.hooks.length - hs.length;
        if (hs.length) kept.push({ ...g, hooks: hs });
      }
      if (kept.length) j.hooks[ev] = kept;
      else delete j.hooks[ev];
    }
    if (!Object.keys(j.hooks).length) delete j.hooks;
    if (n) {
      safefs.writeAtomic(root, rel, `${JSON.stringify(j, null, 2)}\n`);
      removed.push({ settings: rel, hooks: n });
    }
  }
  return { removed, left: ['.claude/plain/', '.claude/commands/plain.md'], note: 'delete those two paths to remove the pack completely' };
}

function status(root) {
  const hooks = hooksPresent(root);
  const stored = core.load(root);
  const installed = Object.keys(ENTRIES).every((ev) => hooks[ev]);
  let fresh = null;
  if (stored) fresh = readCatalog(root).fingerprint === stored.fingerprint && stored.configHash === core.configHash(core.readConfig(root));
  return {
    state: installed ? 'installed' : Object.keys(hooks).length ? 'partly-installed' : 'not-installed',
    hooks,
    index: stored ? { skills: stored.skills.length, builtAt: stored.builtAt, fresh, learned: stored.learnedCount } : null,
    map: stored ? { tokens: stored.map.tokens, wordsPerSkill: stored.map.wordsPerSkill, withWords: stored.map.withWords, shown: stored.map.shown, total: stored.map.total, enabled: core.readConfig(root).map !== false } : null,
  };
}

function health(root) {
  const s = status(root);
  return { ...s, log: misslog.summary(root, 10) };
}

function test(root, phrase) {
  let stored = core.load(root);
  if (!stored) stored = core.build(root, { write: false });
  const r = core.route(stored, phrase, core.readConfig(root));
  const top = (r.top || require('./lib/ranker.js').rank(stored.index, phrase, 3)).map((t) => ({ skill: stored.skills[t.i].slug, score: +t.score.toFixed(3) }));
  return { layer: r.layer || 'none', skills: r.slugs, adds: r.text || '', tokens: r.tokens || 0, ranker: top, mapListsAll: stored.map.shown === stored.map.total, gate: { min: core.HINT_MIN, margin: core.HINT_MARGIN, maxWords: core.HINT_MAX_WORDS } };
}

function main() {
  const a = args(process.argv.slice(2));
  let out;
  switch (a.cmd) {
    case 'status': out = status(a.root); break;
    case 'install': out = install(a.root, a.settings === 'shared' ? 'shared' : 'local'); break;
    case 'refresh': { const s = core.build(a.root); out = { skills: s.skills.length, learned: s.learnedCount, mapTokens: s.map.tokens, wordsPerSkill: s.map.wordsPerSkill, withWords: s.map.withWords, shown: s.map.shown, total: s.map.total }; break; }
    case 'health': out = health(a.root); break;
    case 'test': {
      if (!a.file) throw new Error('test needs --file <path>: write the phrase to a file first');
      const raw = safefs.readCapped(path.resolve(a.root, a.file), 1 << 16);
      if (raw == null) throw new Error('the phrase file is missing, too large or not a regular file');
      out = test(a.root, raw.replace(/\r?\n$/, ''));
      break;
    }
    case 'uninstall': out = uninstall(a.root); break;
    default:
      process.stderr.write('usage: setup.js status|install|refresh|health|test --file <path>|uninstall [--root <dir>] [--settings shared|local]\n');
      process.exit(2);
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (e) {
    process.stderr.write(`plain: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { install, uninstall, status, health, test, hooksPresent, ENTRIES };
