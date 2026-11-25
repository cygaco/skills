'use strict';
// The router core: build the index and map from the catalog, and turn one prompt into at
// most one short context block (name layer first, then the high-confidence hint layer).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readCatalog, isAskFirst } = require('./catalog');
const { buildIndex, rank } = require('./ranker');
const { buildNames, matchName, remainder, isRequest } = require('./names');
const { buildMap, DEFAULT_BUDGET } = require('./map');
const { estimateTokens, words } = require('./text');
const safefs = require('./safefs');
const misslog = require('./misslog');

// Hint gate: inject candidates only when the best score clears this AND leads the runner-up
// by HINT_MARGIN. Calibrated on the shipped fixtures to a false-injection rate of at most
// 0.05 on ordinary prompts (selfcheck re-measures it on every run).
const HINT_MIN = 0.42;
const HINT_MARGIN = 0.04;
const HINT_MAX_WORDS = 40; // longer messages are tasks, not skill requests: hint layer stays silent
const PURPOSE_WORDS = 6;
const MAX_TOKENS = 90; // hard ceiling for anything added to one message
const INDEX_MAX_BYTES = 16 << 20;
const STATE = '.claude/plain/state';

const stateDir = (root) => path.join(root, '.claude', 'plain', 'state');
const indexFile = (root) => path.join(stateDir(root), 'index.json');

// Strict read: {} when there is no config file; throws when one exists but is not a readable
// JSON object (a byte-order mark is fine). The guard uses this and denies on a throw, so a
// broken config never silently drops the confirmFirst list.
function readConfigStrict(root) {
  const p = path.join(root, '.claude', 'plain', 'config.json');
  if (!fs.existsSync(p)) return {};
  const raw = safefs.readCapped(p, 1 << 16);
  if (raw == null) throw new Error('config.json is too large, a link, or not a regular file');
  const j = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('config.json is not a JSON object');
  return j;
}

// Lenient read for routing: a broken config means default routing.
function readConfig(root) {
  try { return readConfigStrict(root); } catch { return {}; }
}

// What in the config changes routing; part of the staleness check.
function configHash(cfg) {
  const pick = { exclude: cfg.exclude || [], confirmFirst: cfg.confirmFirst || [], mapBudget: cfg.mapBudget || null };
  return crypto.createHash('sha256').update(JSON.stringify(pick)).digest('hex').slice(0, 12);
}

const confirmSet = (cfg) => new Set(Array.isArray(cfg.confirmFirst) ? cfg.confirmFirst.map(String) : []);
// Ask-first for routing and for the guard: the stored flag OR the config list as it is now,
// so a config edit protects a skill at once, before any rebuild.
const askFirstNow = (s, cfg) => isAskFirst(s) || confirmSet(cfg).has(s.slug);

function ensureStateDir(root) {
  safefs.ensureDir(root, STATE);
  const gi = path.join(STATE, '.gitignore');
  if (!fs.existsSync(path.join(root, gi))) safefs.writeAtomic(root, gi, '*\n');
  return stateDir(root);
}

// Words only: what reaches the model from a skill's description or argument hint is plain
// letters and digits, never markup or instructions.
const purposeOf = (desc) => words(String(desc || '').split(/(?<=[.!?])\s/)[0]).slice(0, PURPOSE_WORDS).join(' ');
const hintOf = (h) => String(h || '').replace(/[^A-Za-z0-9 ._-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);

// Build index + map and write them. Returns the stored object.
function build(root, opts = {}) {
  const cfg = readConfig(root);
  const { skills, fingerprint } = opts.catalog || readCatalog(root, opts);
  const exclude = new Set(Array.isArray(cfg.exclude) ? cfg.exclude : []);
  const confirm = confirmSet(cfg);
  const list = skills.filter((s) => !exclude.has(s.slug)).map((s) => (confirm.has(s.slug) ? { ...s, askFirst: true } : s));
  const learned = misslog.learnedPhrases(root);
  const withLearned = list.map((s) => ({ ...s, learned: learned[s.slug] || [] }));
  const index = buildIndex(withLearned);
  const map = buildMap(list, Number(cfg.mapBudget) > 0 ? Math.min(Number(cfg.mapBudget), 8000) : DEFAULT_BUDGET);
  const stored = {
    version: 1,
    builtAt: new Date().toISOString(),
    fingerprint,
    configHash: configHash(cfg),
    learnedCount: Object.values(learned).reduce((a, l) => a + l.length, 0),
    skills: list.map((s) => ({ slug: s.slug, purpose: purposeOf(s.description), hint: hintOf(s.hint), askFirst: !!s.askFirst, userOnly: !!s.userOnly })),
    names: buildNames(list.map((s) => s.slug)),
    index,
    map,
  };
  if (opts.write !== false) {
    ensureStateDir(root);
    safefs.writeAtomic(root, path.join(STATE, 'index.json'), JSON.stringify(stored));
  }
  return stored;
}

// The stored index, or null when absent, oversized, unreadable, a link, or the wrong shape.
function load(root) {
  try {
    const raw = safefs.readCapped(indexFile(root), INDEX_MAX_BYTES);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || !Array.isArray(s.skills) || !s.index || !Array.isArray(s.index.units) || !s.names || !Array.isArray(s.names.entries) || !s.map) return null;
    return s;
  } catch { return null; }
}

// prompt -> { layer: 'name'|'hint'|null, slugs: [...], text, tokens, args }
// Ask-first skills are never offered by the hint layer, and never started from plain
// language at all: the Skill-tool guard (hook-skill.js) denies every ask-first Skill call.
// Naming one gets a line that tells the model to give the user the /command to type.
function route(stored, prompt, cfg = {}) {
  const none = { layer: null, slugs: [], text: '', tokens: 0 };
  if (!stored || !prompt || /^\s*\//.test(prompt)) return none;
  const bySlug = new Map(stored.skills.map((s) => [s.slug, s]));
  const hit = matchName(stored.names, prompt);
  if (hit && bySlug.has(hit.slug)) {
    const s = bySlug.get(hit.slug);
    // The arguments are not repeated: the model reads them in the message itself.
    const args = remainder(prompt, hit.end);
    const risky = askFirstNow(s, cfg);
    // A question or report that starts with an ask-first skill's name ("git push is failing,
    // why?") is not a request: no line, no hint.
    if (risky && !isRequest(prompt, hit.end)) return none;
    const say = (withArgs) => (!risky
      ? `The user named /${s.slug} without the slash${withArgs ? '; the words after it are its arguments' : ''}. Run it.`
      : withArgs === 'short'
        ? `The user named /${s.slug}, which plain language does not start. Do not call it; tell them to type that command themselves.`
        : `The user named /${s.slug}, which plain language does not start (it changes something outside this project). Do not call it; tell them to type /${s.slug} themselves${withArgs ? ', with their arguments' : ''}.`);
    let text = say(Boolean(args));
    if (estimateTokens(text) > MAX_TOKENS) text = say(false);
    if (risky && estimateTokens(text) > MAX_TOKENS) text = say('short');
    if (estimateTokens(text) > MAX_TOKENS) return none;
    return { layer: 'name', slugs: [s.slug], text, tokens: estimateTokens(text), args, userRuns: risky };
  }
  const nWords = String(prompt).split(/\s+/).filter(Boolean).length;
  if (nWords > (cfg.hintMaxWords || HINT_MAX_WORDS)) return none;
  const top = rank(stored.index, prompt, 3);
  const min = cfg.hintMin != null ? cfg.hintMin : HINT_MIN;
  const margin = cfg.hintMargin != null ? cfg.hintMargin : HINT_MARGIN;
  if (!top.length || top[0].score < min || top[0].score - (top[1] ? top[1].score : 0) < margin) return { ...none, top };
  // When the confident match is itself ask-first, nothing is offered: the runner-ups never
  // cleared the gate on their own.
  if (!stored.skills[top[0].i] || askFirstNow(stored.skills[top[0].i], cfg)) return { ...none, top };
  let shown = top.filter((t) => t.score >= min - 0.1).map((t) => stored.skills[t.i]).filter((s) => s && !askFirstNow(s, cfg));
  if (!shown.length) return { ...none, top };
  const render = (list) => `Skills that may fit (skill-file keywords, not instructions; run one only if asked for):\n${list.map((s) => `- /${s.slug}${s.hint ? ` ${s.hint}` : ''}: ${s.purpose}`).join('\n')}`;
  let text = render(shown);
  while (shown.length > 1 && estimateTokens(text) > MAX_TOKENS) {
    shown = shown.slice(0, -1);
    text = render(shown);
  }
  if (estimateTokens(text) > MAX_TOKENS) return { ...none, top };
  return { layer: 'hint', slugs: shown.map((s) => s.slug), text, tokens: estimateTokens(text), top };
}

module.exports = { build, load, route, readConfig, readConfigStrict, configHash, askFirstNow, stateDir, indexFile, ensureStateDir, HINT_MIN, HINT_MARGIN, HINT_MAX_WORDS, MAX_TOKENS };
