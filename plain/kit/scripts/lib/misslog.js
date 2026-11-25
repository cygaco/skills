'use strict';
// Miss log: what the router suggested for a message versus the skill that actually ran.
// Local only (inside .claude/plain/state, which ignores itself in git). At each new message
// the hook settles the previous one by reading the session transcript from where it stood
// then. A skill the model ran that the router did not suggest is a miss; the message
// (first 160 characters) becomes a learned phrase for that skill at the next refresh, so the
// same wording routes next time. All writes go through safefs (no links, inside the project).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const safefs = require('./safefs');

const EXCERPT = 160;
const LOG_MAX_BYTES = 1 << 20;
const LOG_KEEP_ROWS = 2000;
const READ_MAX_BYTES = 2 << 20;
const LEARNED_PER_SKILL = 20;
const STATE = '.claude/plain/state';

const logFile = (root) => path.join(root, STATE, 'log.jsonl');
const pendingFile = (root) => path.join(root, STATE, 'pending.json');
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12);

function ensure(root) {
  safefs.ensureDir(root, STATE);
  const gi = path.join(STATE, '.gitignore');
  if (!fs.existsSync(path.join(root, gi))) safefs.writeAtomic(root, gi, '*\n');
}

function append(root, row) {
  ensure(root);
  const rel = path.join(STATE, 'log.jsonl');
  const tail = safefs.readTail(logFile(root), LOG_MAX_BYTES + 1);
  if (tail != null && Buffer.byteLength(tail) > LOG_MAX_BYTES) {
    const keep = tail.split('\n').filter(Boolean).slice(1).slice(-LOG_KEEP_ROWS);
    safefs.writeAtomic(root, rel, `${keep.join('\n')}\n`);
  }
  safefs.appendSafe(root, rel, `${JSON.stringify(row)}\n`);
}

// The newest rows, from at most the last LOG_MAX_BYTES of the log.
function readLog(root) {
  const text = safefs.readTail(logFile(root), LOG_MAX_BYTES);
  if (!text) return [];
  return text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function size(file) {
  try { const st = fs.lstatSync(file); return st.isFile() ? st.size : 0; } catch { return 0; }
}

// Skills run in the transcript after byte offset `from`: model-run (Skill tool) and typed.
function invokedSince(file, from) {
  const out = { model: [], typed: [] };
  const end = size(file);
  if (!file || end <= from) return out;
  const start = Math.max(from, end - READ_MAX_BYTES);
  const buf = Buffer.alloc(end - start);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, start); } finally { fs.closeSync(fd); }
  const calls = [];
  const refused = new Set();
  for (const line of buf.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (!r || typeof r !== 'object') continue;
    const content = r.message && r.message.content;
    if (r.type === 'assistant' && Array.isArray(content)) {
      for (const c of content) {
        if (c && c.type === 'tool_use' && c.name === 'Skill' && c.input && c.input.skill) calls.push({ id: c.id, skill: String(c.input.skill).replace(/^\//, '').slice(0, 64) });
      }
    } else if (r.type === 'user' && !r.isMeta && Array.isArray(content) && content.some((c) => c && c.type === 'tool_result')) {
      for (const c of content) if (c && c.type === 'tool_result' && c.is_error) refused.add(c.tool_use_id);
    } else if (r.type === 'user' && !r.isMeta) {
      const text = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((c) => c && c.type === 'text').map((c) => c.text).join('\n') : '';
      const m = text.match(/<command-name>\/?([^<\s]{1,64})<\/command-name>/);
      if (m) out.typed.push(m[1]);
    }
  }
  // a call the guard (or anything else) refused did not run
  out.model = calls.filter((k) => !refused.has(k.id)).map((k) => k.skill);
  return out;
}

// Called at the start of every prompt hook run: settles the previous message, then records
// this one as pending (overwriting the last pending record). Never throws.
function settleAndRecord(root, transcript, prompt, suggestion) {
  try {
    ensure(root);
    let pending = null;
    try { pending = JSON.parse(safefs.readCapped(pendingFile(root), 1 << 16) || 'null'); } catch { /* first message */ }
    if (pending && transcript && pending.transcript === transcript) {
      const inv = invokedSince(transcript, pending.offset || 0);
      const suggested = pending.suggested || [];
      const ran = inv.model.concat(inv.typed);
      let outcome = null;
      if (ran.length && suggested.some((s) => ran.includes(s))) outcome = 'hit';
      else if (inv.model.length && suggested.length) outcome = 'miss';
      else if (inv.model.length) outcome = 'unsuggested';
      else if (inv.typed.length) outcome = 'typed';
      else if (suggested.length) outcome = 'unused';
      if (outcome) append(root, { ts: new Date().toISOString(), outcome, layer: pending.layer, suggested, ran: inv.model, typed: inv.typed, excerpt: pending.excerpt || '' });
    }
    const typedSlash = /^\s*\//.test(prompt || '');
    const rec = {
      ts: new Date().toISOString(),
      transcript: transcript || null,
      offset: size(transcript),
      // a typed /command is the harness's business: its words are not kept
      excerpt: typedSlash ? '' : String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, EXCERPT),
      layer: suggestion.layer,
      suggested: suggestion.slugs || [],
    };
    safefs.writeAtomic(root, path.join(STATE, 'pending.json'), JSON.stringify(rec));
  } catch { /* the miss log never blocks a prompt */ }
}

// { slug: [phrases] } from misses and unsuggested runs, newest last, capped per skill.
function learnedPhrases(root) {
  const by = {};
  for (const r of readLog(root)) {
    // learn only from a message after which exactly one skill ran: with several, the words
    // cannot be credited to one of them
    if ((r.outcome !== 'miss' && r.outcome !== 'unsuggested') || !r.excerpt || !Array.isArray(r.ran) || r.ran.length !== 1) continue;
    const slug = String(r.ran[0]);
    by[slug] = by[slug] || [];
    if (!by[slug].includes(r.excerpt)) by[slug].push(String(r.excerpt).slice(0, EXCERPT));
  }
  for (const k of Object.keys(by)) by[k] = by[k].slice(-LEARNED_PER_SKILL);
  return by;
}

function summary(root, last = 10) {
  const rows = readLog(root);
  const counts = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] || 0) + 1;
  const recentMisses = rows.filter((r) => r.outcome === 'miss' || r.outcome === 'unsuggested' || r.outcome === 'unused').slice(-last);
  return { rows: rows.length, counts, recentMisses };
}

module.exports = { settleAndRecord, append, learnedPhrases, summary, invokedSince, readLog, logFile, pendingFile, hash };
