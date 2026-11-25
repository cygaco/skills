#!/usr/bin/env node
'use strict';
/*
 * proposals.js: list, number and apply the proposals in twin/proposals.md
 * (templates/formats.md, "Proposal blocks" and "proposals.js").
 *
 *   node .claude/twin/scripts/proposals.js list
 *   node .claude/twin/scripts/proposals.js next-id
 *   node .claude/twin/scripts/proposals.js apply --accept P-001,P-004 --reject P-002
 *
 * apply validates everything before it writes anything. For each accepted proposal it
 * decides APPLY, FLAG or REFUSE.
 *   REFUSE: a confidence change for a red-line domain, any confidence above 0.95, any
 *     change to the Default (no data) row, and a change that touches the red-line floor
 *     (below) and also says the twin may decide it or skip asking.
 *   FLAG (recorded under Flagged for you, or Policy gaps for kind policy, never applied):
 *     kinds policy and stage; and any proposal whose title or any field (evidence:
 *     included) matches the red-line screen, mentions CLAUDE.md, or mentions what users
 *     see, get or are promised (the two floor items only the agent can judge).
 * Order of writes: the archive first, then twin/judgment.md, then twin/proposals.md, each
 * one whole-file atomic write. Every write is redacted whole: all of the rewritten archive,
 * twin/judgment.md and twin/proposals.md (not only the fields it adds). A run that stops part
 * way leaves its earlier writes in place; running the same apply again finishes the rest,
 * judging what is done only from a complete archive entry and from the changelog line
 * apply itself writes.
 *
 * A field runs from its NAME: line to the next field line or heading, continuation lines
 * included, fenced blocks and HTML comments too. U+2028, U+2029 and U+0085 are line
 * breaks before a heading or a field line (elsewhere they stay in the text, in the same
 * field), and invisible or control characters in a NAME: line do not stop it being a
 * field line, so neither can turn a quote: line into a continuation of the evidence.
 * The heading parse is linear in the length of the line. A proposal's quote: (your
 * words) lands in twin/judgment.md with it, and is screened with it. A proposal whose
 * evidence: cites
 * chat history never carries its quote anywhere: apply drops the whole quote field
 * (continuation lines included) from what lands in judgment.md and from the archive, and
 * prints "quote dropped (chat evidence)" on that proposal's line. Its evidence keeps
 * nothing but references: on the first line of evidence: that mentions chat, only the
 * field name and the references are kept (each comma-separated part that is exactly
 * ledger <8 hex>, notes twin/notes.md:<n> or chat <YYYY-MM-DD> #<n>, and from the first
 * other part that mentions chat, the chat reference alone: chat, then its date and #<n>
 * if they follow); all other text on that line, and every line of evidence: after it, up
 * to the next field line or heading, is dropped from both too, whatever it looks like
 * (the screen still reads it all, so the proposal applies, flags or is refused as it would
 * be with them).
 */

const path = require('path');
const { EXIT, NOT_ROOT, cliIo, normIo, atRoot, parseFlags, wantsHelp, guarded, isoNow } = require('./lib/cli');
const { Refusal, readTextOrNull, atomicWrite, assertSafeTarget, twinDir } = require('./lib/fsx');
const { mask, findHeading, sectionRange, insertionPoint, flatLine, escapeLine, dropTrailingNewlines } = require('./lib/md');
const { redact, clip, stripHidden } = require('./lib/redact');
const { screen, loosening, modelOnly } = require('./lib/redlines');
const { PROPOSAL_KINDS, PROPOSAL_CONFIDENCE, PROPOSAL_FIELDS, PRINCIPLE_ONLY, TARGET } = require('./lib/formats');

const USAGE = `usage: node .claude/twin/scripts/proposals.js <command>

  list                                   one line per proposal in twin/proposals.md
  next-id                                the next free proposal id (counts the archive)
  apply --accept <ids> --reject <ids>    apply the accepted proposals to twin/judgment.md;
                                         ids comma separated, for example P-001,P-004

Run it from your repository's root folder.
Exit: 0 done, 1 a malformed proposal (line N: reason), 2 refused or usage error.
A refusal before the first write (an unknown id, a malformed file) changes nothing. A
refusal or an error part way through apply can leave its earlier writes in place: run
the same apply again; it finishes the rest and applies nothing twice.`;

const ARCHIVE_HEADER = [
  '# Processed twin proposals',
  '',
  'Every proposal that proposals.js apply processed, with its decision and date. This is a record; nothing here is an instruction.',
  '',
].join('\n');

// The em dash (code point 2014) and en dash (2013), built so this file stays ASCII.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

const HEADING = /^###\s+P-/;
const HEAD_ID = /^###\s+(P-\d+)/;
const HEAD_DASHES = `${EM_DASH}${EN_DASH}:-`;
// The value takes every character to the end of the line, a U+2028 left in it included.
const FIELD_LINE = /^([A-Za-z][A-Za-z-]*):[ \t]?([\s\S]*)$/;

// A proposal heading's id and title, or null: the id by a regular expression anchored at
// the start, then the white space, the dashes or colon and the title by index, so the
// parse is linear in the length of the line, however much white space it holds.
function headParts(line) {
  const h = HEAD_ID.exec(line);
  if (!h) return null;
  const ws = (i) => {
    let j = i;
    while (j < line.length && /\s/.test(line[j])) j++;
    return j;
  };
  let i = ws(h[0].length);
  let j = i;
  while (j < line.length && HEAD_DASHES.includes(line[j])) j++;
  if (j > i) i = ws(j);
  return { id: h[1], title: line.slice(i) };
}

// A field line, NAME: value, or null. Invisible and control characters (the set
// lib/redact.js removes) do not hide one: a line that is not a field line as written is
// read again with them removed, so qu<U+200B>ote: is the quote field, never a
// continuation of the field before it. The value is the text after the first colon as
// written (no hidden character is a colon), so the screen still sees what was typed.
function fieldLine(line) {
  const f = FIELD_LINE.exec(line);
  if (f) return f;
  const bare = stripHidden(line);
  const g = bare === line ? null : FIELD_LINE.exec(bare);
  if (!g) return null;
  const rest = line.slice(line.indexOf(':') + 1);
  return [line, g[1], rest[0] === ' ' || rest[0] === '\t' ? rest.slice(1) : rest];
}
const CONF_VALUE = /^(?:0(?:\.\d{1,2})?|1(?:\.0{1,2})?)$/;

// "<domain> = 0.NN", split at the last = sign (by index, so it is linear), or null.
function confChange(s) {
  const t = String(s);
  const i = t.lastIndexOf('=');
  if (i < 0) return null;
  const domain = t.slice(0, i).trim();
  const value = t.slice(i + 1).trim();
  if (!domain || !CONF_VALUE.test(value)) return null;
  return { domain, value };
}
// Any mention of chat in the evidence (chat <YYYY-MM-DD> #<n>, or looser) counts as chat
// evidence, so a quote from chat history is dropped even when the reference is malformed.
// It is looked for in the evidence as written and again with the invisible and control
// characters removed (the same set lib/redact.js removes), so ch<U+200B>at counts too.
const CHAT_REF = /\bchat\b/i;
const citesChat = (evidence) => CHAT_REF.test(evidence) || CHAT_REF.test(stripHidden(evidence));
// The chat reference itself, as kept from a part of the line that says more: chat, then
// its date and #<n> if they follow. Each optional part starts with white space and then a
// digit or #, so the match is linear.
const CHAT_TOKEN = /\bchat\b(?:[ \t]+\d{4}-\d{2}-\d{2})?(?:[ \t]+#\d+)?/i;
// A part of an evidence line that is exactly one reference, and so carries no other text.
const EXACT_REF = /^(?:ledger [0-9a-f]{8}|notes twin\/notes\.md:\d+|chat \d{4}-\d{2}-\d{2} #\d+)$/i;
// What is kept of the evidence line that mentions chat: its comma-separated parts that are
// exactly a reference, and the chat reference alone from the first other part that
// mentions chat; nothing else. Each part is read with the invisible and control
// characters removed (so ch<U+200B>at is kept as chat), and as written.
function keptRefs(line) {
  const kept = [];
  let token = false;
  for (const piece of String(line).split(',')) {
    const bare = stripHidden(piece).trim();
    if (EXACT_REF.test(bare)) {
      kept.push(bare);
      continue;
    }
    if (token) continue;
    const t = CHAT_TOKEN.exec(bare) || CHAT_TOKEN.exec(piece);
    if (t) {
      kept.push(t[0]);
      token = true;
    }
  }
  return kept.length ? kept.join(', ') : 'chat';
}
const QUOTE_DROPPED = 'quote dropped (chat evidence)';

// Trailing newlines are dropped by index (lib/md.js), so a long run of them is cheap.
const toLines = (text) => dropTrailingNewlines(text).split('\n');
const fromLines = (lines) => `${dropTrailingNewlines(lines.join('\n'))}\n`;
// The proposal files' lines. U+2028, U+2029 and U+0085 are line breaks too, before
// anything is parsed: wherever the text after one starts a heading or a field line
// (NAME:, read as fieldLine reads it), it starts a new line there, so no heading or field
// line, the quote: line included, can hide behind one. Anywhere else the character stays
// in the text where it is, so the words on both sides stay in the same field (the same
// field a reader sees them in), and a value split by one (a secret, a chat reference) is
// redacted or recognised whole. One pass over the text, each part looked at once.
const BREAK_CHARS = [0x2028, 0x2029, 0x85].map((n) => String.fromCharCode(n));
const startsLine = (s) => /^#{1,6}\s/.test(s) || /^[A-Za-z][A-Za-z-]*:/.test(s) || /^[A-Za-z][A-Za-z-]*:/.test(stripHidden(s));
function proposalLines(text) {
  const out = [];
  for (const line of toLines(String(text).replace(/\r\n?/g, '\n'))) {
    let cur = '';
    let from = 0;
    for (let i = 0; i <= line.length; i++) {
      if (i < line.length && !BREAK_CHARS.includes(line[i])) continue;
      const part = line.slice(from, i);
      if (from === 0) cur = part;
      else if (startsLine(part)) {
        out.push(cur);
        cur = part;
      } else cur += line[from - 1] + part;
      from = i + 1;
    }
    out.push(cur);
  }
  return out;
}

// ------------------------------------------------------------------ parse

function parseProposals(text) {
  const lines = text === '' ? [] : proposalLines(text);
  const m = mask(lines);
  const problems = [];
  const blocks = [];
  let first = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!m[i] && HEADING.test(lines[i])) {
      first = i;
      break;
    }
  }
  const header = first < 0 ? lines.slice() : lines.slice(0, first);
  if (first < 0) return { header, blocks, problems };

  let cur = null;
  let last = null; // the field the next continuation line belongs to
  const close = () => {
    if (!cur) return;
    let end = cur.end;
    while (end > cur.line && !lines[end - 1].trim()) end--;
    cur.raw = lines.slice(cur.line - 1, end);
    blocks.push(cur);
  };
  for (let i = first; i < lines.length; i++) {
    const n = i + 1;
    const line = lines[i];
    if (m[i]) {
      // A fenced block or an HTML comment after a field line belongs to that field.
      if (cur) cur.end = n;
      if (cur && last) {
        last.endLine = n;
        last.parts.push({ line: n, text: line.trim() });
      }
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      close();
      cur = null;
      last = null;
      const h = headParts(line);
      if (!h || !line.startsWith('### ')) {
        problems.push({ line: n, reason: `not a proposal heading (### P-NNN ${EM_DASH} title)` });
        continue;
      }
      cur = { id: h.id, title: h.title.trim(), line: n, end: n, fields: {} };
      if (!/^P-\d{3}$/.test(h.id)) problems.push({ line: n, reason: `bad id ${h.id}: P- and three digits` });
      if (!cur.title) problems.push({ line: n, reason: 'missing title' });
      continue;
    }
    if (!cur) continue;
    cur.end = n;
    if (!line.trim()) continue;
    const f = fieldLine(line);
    if (f) {
      const name = f[1].toLowerCase();
      if (!PROPOSAL_FIELDS.includes(name)) {
        problems.push({ line: n, reason: `unknown field "${f[1]}"` });
        last = null;
        continue;
      }
      if (cur.fields[name]) {
        problems.push({ line: n, reason: `field ${name} appears twice` });
        last = null;
        continue;
      }
      // parts: the field's lines, its NAME: line first, each with its line number.
      cur.fields[name] = { value: f[2].trim(), line: n, endLine: n, parts: [{ line: n, text: f[2].trim() }] };
      last = cur.fields[name];
      continue;
    }
    if (last) {
      last.endLine = n;
      last.parts.push({ line: n, text: line.trim() });
    } else problems.push({ line: n, reason: 'text that is not a field line' });

  }
  close();

  // A field value is the join of its parts (its NAME: line and every continuation line),
  // built once here, so the join is linear in the
  // field's size, not quadratic (a change field of N continuation lines stays O(N)).
  for (const b of blocks) {
    for (const name of Object.keys(b.fields)) {
      const fld = b.fields[name];
      fld.value = fld.parts.map((p) => p.text).filter((t) => t !== '').join(' ');
    }
  }

  const seen = new Map();

  for (const b of blocks) {
    if (seen.has(b.id)) problems.push({ line: b.line, reason: `duplicate id ${b.id} (first on line ${seen.get(b.id)})` });
    else seen.set(b.id, b.line);
    const F = b.fields;
    for (const req of ['kind', 'confidence', 'evidence', 'change']) {
      if (!F[req] || !F[req].value) problems.push({ line: F[req] ? F[req].line : b.line, reason: `${b.id}: missing ${req}:` });
    }
    const kind = F.kind && F.kind.value.toLowerCase();
    if (F.kind && F.kind.value && !PROPOSAL_KINDS.includes(kind)) problems.push({ line: F.kind.line, reason: `${b.id}: unknown kind "${clip(F.kind.value, 40)}"` });
    if (F.confidence && F.confidence.value && !PROPOSAL_CONFIDENCE.includes(F.confidence.value.toLowerCase())) {
      problems.push({ line: F.confidence.line, reason: `${b.id}: unknown confidence "${clip(F.confidence.value, 40)}" (high, medium or low)` });
    }
    if (F.quote && F.quote.value.length > 200) problems.push({ line: F.quote.line, reason: `${b.id}: quote is over 200 characters` });
    if (kind && kind !== 'principle') {
      for (const p of PRINCIPLE_ONLY) if (F[p]) problems.push({ line: F[p].line, reason: `${b.id}: ${p}: is only for kind principle` });
    }
    if (kind === 'confidence' && F.change && F.change.value && !confChange(F.change.value)) {
      problems.push({ line: F.change.line, reason: `${b.id}: a confidence change must read "<domain> = 0.NN"` });
    }
    b.kind = kind;
    b.get = (name) => (F[name] ? F[name].value : '');
    // Evidence from chat history: the quote never lands in judgment.md or the archive.
    b.chat = citesChat(b.get('evidence'));
    b.dropQuote = b.chat && Boolean(F.quote && F.quote.value);
    b.quote = b.dropQuote ? '' : b.get('quote');
    // Chat evidence keeps nothing but references: on the first line of evidence: that
    // mentions chat, only the field name (on the NAME: line) and the references on it
    // (keptRefs) are kept, and every line after it (fenced blocks and HTML comments
    // included), up to the next field line or heading, is dropped from what lands in
    // judgment.md and from the archive, whatever it looks like. b.evidence is the evidence
    // that lands; b.get('evidence') stays whole, so the screen in decide() still sees it all.
    const drop = b.dropQuote ? [[F.quote.line, F.quote.endLine]] : [];
    const swap = new Map(); // line number -> the archive line written in its place
    b.evidence = b.get('evidence');
    if (b.chat && F.evidence) {
      const parts = F.evidence.parts;
      const j = Math.max(0, parts.findIndex((p) => citesChat(p.text)));
      const refs = keptRefs(parts[j].text);
      b.evidence = [...parts.slice(0, j).map((p) => p.text), refs].reduce((v, t) => `${v} ${t}`.trim(), '');
      const raw = b.raw[parts[j].line - b.line];
      swap.set(parts[j].line, j === 0 ? `${raw.slice(0, raw.indexOf(':') + 1)} ${refs}` : `${/^[ \t]*/.exec(raw)[0]}${refs}`);
      if (j + 1 < parts.length) drop.push([parts[j + 1].line, F.evidence.endLine]);
    }
    b.archiveRaw = drop.length || swap.size
      ? b.raw.map((l, i) => (swap.has(b.line + i) ? swap.get(b.line + i) : l)).filter((_, i) => !drop.some(([from, to]) => b.line + i >= from && b.line + i <= to))
      : b.raw;
  }
  problems.sort((a, b) => a.line - b.line);
  return { header, blocks, problems };
}

function headingIds(text) {
  if (text === null) return [];
  const lines = proposalLines(text);
  const m = mask(lines);
  const ids = [];
  lines.forEach((l, i) => {
    const x = /^###\s+(P-\d{3})\b/.exec(l);
    if (x && !m[i]) ids.push(x[1]);
  });
  return ids;
}

// ------------------------------------------------------------------ the archive

// The two lines apply writes last in every archive entry, in this order.
const ENTRY_DECISION = /^decision: \S/;
const ENTRY_DATE = /^date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// The entries of twin/proposals-archive.md, as { id, from, to, complete } over its lines:
// an entry runs from its ### P-NNN heading to the next heading (fenced blocks and HTML
// comments masked). It is complete only when its last non-blank line is the date: line
// apply writes last, right after the decision: line, so an entry cut short (its heading
// and some of its lines, and no date: line after its decision: line) never counts as
// archived.
function archiveEntries(lines) {
  const m = mask(lines);
  const out = [];
  let cur = null;
  const close = (end) => {
    if (!cur) return;
    cur.to = end;
    const body = [];
    for (let i = cur.from + 1; i < end; i++) if (!m[i] && lines[i].trim()) body.push(lines[i]);
    cur.complete = body.length >= 2 && ENTRY_DATE.test(body[body.length - 1]) && ENTRY_DECISION.test(body[body.length - 2]);
    out.push(cur);
    cur = null;
  };
  for (let i = 0; i < lines.length; i++) {
    if (m[i] || !/^#{1,6}\s/.test(lines[i])) continue;
    close(i);
    const x = /^###\s+(P-\d{3})\b/.exec(lines[i]);
    if (x) cur = { id: x[1], from: i };
  }
  close(lines.length);
  return out;
}

// The ids with a complete archive entry.
function archivedIds(text) {
  if (text === null) return new Set();
  return new Set(archiveEntries(text.split('\n')).filter((e) => e.complete).map((e) => e.id));
}

// The archive text with every incomplete entry for one of ids taken out, so apply writes
// that id's entry again, whole, in its place.
function dropIncomplete(text, ids) {
  const lines = text.split('\n');
  const drop = archiveEntries(lines).filter((e) => !e.complete && ids.has(e.id));
  if (!drop.length) return text;
  return lines.filter((_, i) => !drop.some((e) => i >= e.from && i < e.to)).join('\n');
}

// ------------------------------------------------------------------ the changelog

// The Integration changelog line apply writes, exactly: a UTC timestamp, then the four
// counts in this order, each with its ids in parentheses when it is not 0.
const PART = (name) => `${name} (\\d+)(?: \\((P-\\d{3}(?:, P-\\d{3})*)\\))?`;
const CHANGELOG_LINE = new RegExp(`^- \\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z ${['applied', 'flagged', 'refused', 'rejected'].map(PART).join(', ')}$`);

// The ids a changelog line written by apply names, or [] for any other line (prose that
// mentions an id included). Each count must match its list of ids.
function changelogIds(line) {
  const x = CHANGELOG_LINE.exec(line);
  if (!x) return [];
  const ids = [];
  for (let k = 0; k < 4; k++) {
    const n = Number(x[1 + 2 * k]);
    const list = x[2 + 2 * k] ? x[2 + 2 * k].split(', ') : [];
    if (n !== list.length) return [];
    ids.push(...list);
  }
  return ids;
}

// ------------------------------------------------------------------ files

function files(root) {
  const dir = path.join(root, 'twin');
  return {
    proposals: path.join(dir, 'proposals.md'),
    archive: path.join(dir, 'proposals-archive.md'),
    judgment: path.join(dir, 'judgment.md'),
  };
}

function readProposals(root) {
  twinDir(root, false);
  const f = files(root);
  const text = readTextOrNull(f.proposals, 'twin/proposals.md', root);
  if (text === null) throw new Refusal('twin/proposals.md not found: run node .claude/twin/scripts/setup.js init first');
  return { text, parsed: parseProposals(text) };
}

function list(root) {
  const { parsed } = readProposals(root);
  if (parsed.problems.length) return { code: EXIT.PROBLEMS, lines: parsed.problems.map((p) => `line ${p.line}: ${p.reason}`) };
  if (!parsed.blocks.length) return { code: EXIT.OK, lines: ['no pending proposals'] };
  return { code: EXIT.OK, lines: parsed.blocks.map((b) => `${b.id} ${b.kind} ${b.get('confidence').toLowerCase()} ${clean(b.title)}`) };
}

function nextId(root) {
  twinDir(root, false);
  const f = files(root);
  let max = 0;
  for (const id of headingIds(readTextOrNull(f.proposals, 'twin/proposals.md', root)).concat(headingIds(readTextOrNull(f.archive, 'twin/proposals-archive.md', root)))) max = Math.max(max, Number(id.slice(2)));
  const j = readTextOrNull(f.judgment, 'twin/judgment.md', root);
  if (j !== null) for (const x of j.matchAll(/\bP-(\d{3})\b/g)) max = Math.max(max, Number(x[1]));
  if (max >= 999) throw new Refusal('no free proposal id left (P-999 is taken)');
  return `P-${String(max + 1).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ decide

const domainKey = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// REFUSE (with a reason), FLAG (with a reason, for the floor), or APPLY, for one
// accepted block.
function decide(b) {
  // Every field is checked, the title, evidence: and the quote (even one that is dropped)
  // included, whether or not it lands in judgment.md.
  const applied = [b.title, ...PROPOSAL_FIELDS.map((name) => b.get(name))].join('\n');
  if (b.kind === 'confidence') {
    const c = confChange(b.get('change'));
    const value = Number(c.value);
    const s = screen(c.domain);
    if (s.ask) return { action: 'refuse', reason: `a confidence change for a red-line domain (${s.term})` };
    const mo = modelOnly(c.domain);
    if (mo) return { action: 'refuse', reason: `a confidence change for a red-line domain (${mo.term})` };
    if (/^default\b/.test(c.domain.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim())) return { action: 'refuse', reason: 'the Default (no data) row is never changed' };
    if (Math.round(value * 100) > 95) return { action: 'refuse', reason: `confidence ${c.value} is above 0.95` };
  }
  const s = screen(applied);
  const mo = modelOnly(applied);
  const loose = loosening(applied);
  if (s.ask && loose) return { action: 'refuse', reason: `it would let the twin decide a red-line topic (${s.term}; "${loose}")` };
  if (mo && loose) return { action: 'refuse', reason: `it would let the twin decide a red-line topic (${mo.term}; "${loose}")` };
  if (b.kind === 'policy' || b.kind === 'stage') return { action: 'flag' };
  // A proposal that touches the floor at all is never applied, whatever it says.
  if (s.ask && !(mo && s.group === 'hidden-characters')) return { action: 'flag', floor: `red-line screen: ${s.term}` };
  if (mo) return { action: 'flag', floor: `${mo.why}: ${mo.term}` };
  return { action: 'apply' };
}

// ------------------------------------------------------------------ judgment.md edits

// Redacted before the one-line tidy (a control character or line break turned into a space
// would split a secret) and again after it, escaped last: an escape put into a value (&lt;
// for an HTML comment marker) can never cut a secret into a shape the redactor no longer sees.
const clean = (s) => escapeLine(redact(flatLine(redact(s))));
const cell = (s) => clean(s).replace(/\|/g, '\\|');

// Your words as they land: one line, redacted, without the quote marks you may have
// typed around them (straight or curly, built from code points to keep this file ASCII).
const QUOTE_MARKS = `"'${[0x2018, 0x2019, 0x201c, 0x201d].map((n) => String.fromCharCode(n)).join('')}`;
const AROUND = new RegExp(`^[${QUOTE_MARKS}]+|[${QUOTE_MARKS}]+$`, 'g');
function yourWords(b) {
  const q = clean(b.quote).replace(AROUND, '').trim();
  return q ? `"${q}"` : '';
}

function sectionAt(lines, heading) {
  const m = mask(lines);
  const h = findHeading(lines, heading, m);
  if (h < 0) throw new Refusal(`twin/judgment.md has no "${heading}" heading`);
  return { m, h };
}

function insertLines(lines, heading, add, gap) {
  const { m, h } = sectionAt(lines, heading);
  const at = insertionPoint(lines, h, m);
  const afterBullet = at - 1 > h && !m[at - 1] && /^\s*[-*]\s/.test(lines[at - 1]);
  const block = gap || !afterBullet ? ['', ...add] : add.slice();
  if (at < lines.length && lines[at].trim()) block.push('');
  lines.splice(at, 0, ...block);
}

function splitRow(line) {
  const cells = [];
  let cur = '';
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '\\|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function tableRows(lines, heading) {
  const { m, h } = sectionAt(lines, heading);
  const [s, e] = sectionRange(lines, h, m);
  const rows = [];
  for (let i = s; i < e; i++) if (!m[i] && /^\s*\|/.test(lines[i])) rows.push(i);
  return { h, rows };
}

function addRow(lines, heading, row, header) {
  const { rows } = tableRows(lines, heading);
  if (rows.length) {
    lines.splice(rows[rows.length - 1] + 1, 0, row);
    return;
  }
  insertLines(lines, heading, [header, `|${header.split('|').slice(1, -1).map(() => '---').join('|')}|`, row], true);
}

function upsertConfidence(lines, domain, row) {
  const { rows } = tableRows(lines, '## Confidence table');
  for (const i of rows) {
    const first = splitRow(lines[i])[0];
    if (domainKey(first.replace(/\\\|/g, '|')) === domainKey(domain)) {
      lines[i] = row;
      return 'replaced';
    }
  }
  addRow(lines, '## Confidence table', row, '| Domain | Confidence | Basis |');
  return 'added';
}

function applyToJudgment(lines, b, date) {
  const ev = clean(b.evidence);
  const source = `${b.id}, ${date}, evidence: ${ev}`;
  const change = clean(b.get('change'));
  const q = yourWords(b);
  const inline = q ? `; your words: ${q}` : '';
  const inCell = q ? `; your words: ${q.replace(/\|/g, '\\|')}` : '';
  switch (b.kind) {
    case 'principle':
      insertLines(lines, TARGET.principle, [
        `### ${clean(b.title)}`,
        `- WHAT: ${change}`,
        `- WHY: ${clean(b.get('why')) || '(not given)'}`,
        `- GENERALIZE: ${clean(b.get('generalize')) || '(not given)'}`,
        `- EXAMPLE: ${clean(b.get('example')) || '(not given)'}`,
        ...(q ? [`- YOUR WORDS: ${q}`] : []),
        `- Source: ${source}`,
      ], true);
      break;
    case 'heuristic': {
      let max = 0;
      for (const l of lines) {
        const x = /^###\s+H-(\d{3})\b/.exec(l);
        if (x) max = Math.max(max, Number(x[1]));
      }
      const hid = `H-${String(max + 1).padStart(3, '0')}`;
      insertLines(lines, TARGET.heuristic, [`### ${hid} ${EM_DASH} ${clean(b.title)}`, `- ${change}`, ...(q ? [`- Your words: ${q}`] : []), `- Source: ${source}`], true);
      break;
    }
    case 'pattern':
      addRow(lines, TARGET.pattern, `| ${b.id} | ${cell(b.get('change'))} | ${cell(b.evidence)}${inCell}; added ${date} | ${cell(b.get('confidence').toLowerCase())} |`, '| ID | Pattern | Evidence | Confidence |');
      break;
    case 'anti-pattern':
      insertLines(lines, TARGET['anti-pattern'], [`- ${date} ${b.id}: ${change} (evidence: ${ev}${inline})`], false);
      break;
    case 'correction':
      insertLines(lines, TARGET.correction, [`- ${date} ${b.id}: ${change} (evidence: ${ev}${inline})`], false);
      break;
    case 'confidence': {
      const c = confChange(b.get('change'));
      upsertConfidence(lines, c.domain, `| ${cell(c.domain)} | ${c.value} | ${b.id}, ${date}: ${cell(b.evidence)}${inCell} |`);
      break;
    }
    default:
      throw new Error(`cannot apply kind ${b.kind}`);
  }
}

// The file a flagged proposal would be edited into by hand.
function flagFile(b) {
  if (b.kind === 'policy') return 'twin/policy.md';
  if (b.kind === 'stage') return 'twin/stage.md';
  return 'twin/judgment.md';
}

// policy -> Policy gaps; stage, and anything flagged for the floor -> Flagged for you.
function flagInJudgment(lines, b, date, floor) {
  const q = yourWords(b);
  const why = floor ? ` (it touches the red-line floor: ${clean(floor)})` : '';
  const heading = b.kind === 'policy' ? TARGET.policy : TARGET.stage;
  insertLines(lines, heading, [`- ${date} ${b.id} not applied${why}: edit ${flagFile(b)} yourself if you agree: ${clean(b.get('change'))} (evidence: ${clean(b.evidence)}${q ? `; your words: ${q}` : ''})`], false);
}

// ------------------------------------------------------------------ apply

function parseIds(v, flag) {
  if (v === undefined) return [];
  const ids = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Refusal(`${flag} needs at least one id`);
  for (const id of ids) if (!/^P-\d{3}$/.test(id)) throw new Refusal(`${flag}: not a proposal id: ${clip(id, 20)}`);
  return ids;
}

function apply(root, accept, reject, opts) {
  const o = opts || {};
  const trace = Array.isArray(o.trace) ? o.trace : null;
  const now = o.ts || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const date = now.slice(0, 10);
  if (!accept.length && !reject.length) throw new Refusal('give --accept <ids> and/or --reject <ids>');
  const both = accept.filter((id) => reject.includes(id));
  if (both.length) throw new Refusal(`${both[0]} is in both --accept and --reject`);

  const { text, parsed } = readProposals(root);
  if (parsed.problems.length) {
    throw new Refusal(`twin/proposals.md is malformed; nothing changed:\n${parsed.problems.map((p) => `line ${p.line}: ${p.reason}`).join('\n')}`);
  }
  const f = files(root);
  const archiveText = readTextOrNull(f.archive, 'twin/proposals-archive.md', root);
  // Only a complete entry counts as archived (archiveEntries): an entry cut short is
  // written again, whole, in its place.
  const archived = archivedIds(archiveText);
  const byId = new Map(parsed.blocks.map((b) => [b.id, b]));
  const mentioned = accept.concat(reject);
  for (const id of mentioned) if (!byId.has(id) && !archived.has(id)) throw new Refusal(`unknown proposal id ${id}; nothing changed`);

  const jt = readTextOrNull(f.judgment, 'twin/judgment.md', root);
  if (jt === null) throw new Refusal('twin/judgment.md not found: run node .claude/twin/scripts/setup.js init first');
  const jlines = toLines(jt);
  // Per-step completion, read from what is already on disk, so a retry after a late-step
  // failure resumes the remaining writes only and never applies a step twice. The three
  // writes happen in a fixed order: the archive first, then twin/judgment.md (the per-id
  // edits AND the Integration changelog line, together in one atomic write), then the
  // proposals.md clear. So an id with a complete archive entry had its archive step done,
  // and an id named in a changelog line that apply wrote (the exact line format,
  // changelogIds) had its judgment step done (edit and log land in the same write). Any
  // other mention of an id in the changelog, in prose or in a hand-written line, does not
  // count. A retry skips the archive entry for an archived id, and skips the judgment edit
  // and the changelog entry for a logged id, so no id is archived, applied or logged a
  // second time; only the still-missing steps run.
  const logged = new Set();
  {
    const m = mask(jlines);
    const h = findHeading(jlines, '## Integration changelog', m);
    if (h >= 0) {
      const [s, e] = sectionRange(jlines, h, m);
      for (let i = s; i < e; i++) if (!m[i]) for (const id of changelogIds(jlines[i])) logged.add(id);
    }
  }
  const out = [];
  const done = []; // { b, decision, logged }
  const counts = { applied: [], flagged: [], refused: [], rejected: [] };
  const say = (b, line) => out.push(b.dropQuote ? `${line}; ${QUOTE_DROPPED}` : line);
  for (const b of parsed.blocks) {
    if (!mentioned.includes(b.id)) {
      out.push(`${b.id} kept`);
      continue;
    }
    // isLogged: a previous (unfinished) run already wrote this id's judgment step, so the
    // edit and the changelog entry are already there; do not add them again on this retry.
    const isLogged = logged.has(b.id);
    if (reject.includes(b.id)) {
      done.push({ b, decision: 'rejected', logged: isLogged });
      if (!isLogged) counts.rejected.push(b.id);
      say(b, `${b.id} rejected`);
      continue;
    }
    const d = decide(b);
    if (d.action === 'refuse') {
      done.push({ b, decision: `refused: ${d.reason}`, logged: isLogged });
      if (!isLogged) counts.refused.push(b.id);
      say(b, `${b.id} refused: ${d.reason}`);
    } else if (d.action === 'flag') {
      if (!isLogged) flagInJudgment(jlines, b, date, d.floor);
      done.push({ b, decision: d.floor ? `flagged: ${d.floor}` : 'flagged', logged: isLogged });
      if (!isLogged) counts.flagged.push(b.id);
      say(b, `${b.id} flagged: not applied${d.floor ? ` (${d.floor})` : ''}; edit ${flagFile(b)} yourself if you agree`);
    } else {
      if (!isLogged) applyToJudgment(jlines, b, date);
      done.push({ b, decision: 'applied', logged: isLogged });
      if (!isLogged) counts.applied.push(b.id);
      say(b, `${b.id} applied`);
    }
  }
  for (const id of mentioned) if (!byId.has(id)) out.push(`${id} already processed`);
  if (!done.length) return out;

  // Only ids whose judgment step did not already complete go into a changelog line, and the
  // line (and the whole judgment write) is made only when there is at least one such id;
  // otherwise the judgment write is skipped (it was already made in the earlier run).
  const fresh = done.filter((x) => !x.logged);
  if (fresh.length) {
    const part = (name) => `${name} ${counts[name].length}${counts[name].length ? ` (${counts[name].join(', ')})` : ''}`;
    insertLines(jlines, '## Integration changelog', [`- ${now} ${['applied', 'flagged', 'refused', 'rejected'].map(part).join(', ')}`], false);
  }

  // A proposal leaves twin/proposals.md only when its whole apply is done: processed in
  // this run (its archive entry and its judgment write come before this write), or, from an
  // earlier run, both a complete archive entry and an apply changelog line naming it. Every
  // decision (applied, flagged, refused, rejected) gets both. One that was archived but never
  // logged stays pending, so a retry completes it.
  const processed = new Set(done.map((x) => x.b.id));
  const pending = parsed.blocks.filter((b) => !processed.has(b.id) && !(archived.has(b.id) && logged.has(b.id)));
  const header = parsed.header.slice();
  while (header.length && !header[header.length - 1].trim()) header.pop();
  // Both rewritten files are redacted whole, so text that was already in them (yours, or
  // planted) is redacted too, not only the new fields.
  const newProposals = redact(fromLines([...header, ...pending.flatMap((b) => ['', ...b.raw])]));
  const newJudgment = redact(fromLines(jlines));
  // The archive takes only the ids an earlier (unfinished) run did not already archive
  // completely, so a retry never writes a second entry for the same id. Each entry ends
  // with its decision: and date: lines, the date: line last (archiveEntries). The whole
  // archive is written in one atomic write (temp file, then rename), so an entry is never
  // left cut short by this write; an incomplete entry already in the file for one of these
  // ids (dropIncomplete) is replaced by the whole one. The archive is redacted whole, like
  // every other write.
  const toArchive = done.filter((x) => !archived.has(x.b.id));
  const archiveAdd = toArchive.map((x) => `${x.b.archiveRaw.join('\n')}\n${x.b.dropQuote ? `note: ${QUOTE_DROPPED}\n` : ''}decision: ${x.decision}\ndate: ${now}\n`).join('\n');
  const kept = archiveText === null ? '' : dropTrailingNewlines(dropIncomplete(archiveText, new Set(toArchive.map((x) => x.b.id))));
  const archiveOut = redact(`${kept.trim() ? kept : dropTrailingNewlines(ARCHIVE_HEADER)}\n\n${archiveAdd}`);

  // Every target is checked before the first write.
  for (const p of [f.archive, f.judgment, f.proposals]) assertSafeTarget(root, p);

  if (toArchive.length) {
    atomicWrite(root, f.archive, archiveOut);
    if (trace) trace.push('archive');
  }
  if (fresh.length) {
    atomicWrite(root, f.judgment, newJudgment);
    if (trace) trace.push('judgment');
  }
  if (newProposals !== text) {
    atomicWrite(root, f.proposals, newProposals);
    if (trace) trace.push('proposals');
  }
  return out;
}

// ------------------------------------------------------------------ command line

// Each command and the options it takes (the command text in commands/twin.md uses these).
const SPECS = { list: {}, 'next-id': {}, apply: { value: ['--accept', '--reject'] } };

function main(argv, ioIn) {
  const io = normIo(ioIn, __dirname);
  return guarded(io, () => {
    if (wantsHelp(argv)) {
      io.out(USAGE);
      return EXIT.OK;
    }
    const cmd = argv[0];
    const specs = SPECS;
    if (!cmd || !Object.prototype.hasOwnProperty.call(specs, cmd)) {
      io.err(cmd ? `unknown command: ${cmd}` : 'no command given');
      io.err(USAGE);
      return EXIT.REFUSED;
    }
    const a = parseFlags(argv.slice(1), specs[cmd]);
    if (a.error) {
      io.err(`usage: ${a.error}`);
      return EXIT.REFUSED;
    }
    if (!atRoot(io)) {
      io.err(`refused: ${NOT_ROOT}`);
      return EXIT.REFUSED;
    }
    const root = io.cwd;
    if (cmd === 'list') {
      const r = list(root);
      for (const l of r.lines) io.out(l);
      return r.code;
    }
    if (cmd === 'next-id') {
      io.out(nextId(root));
      return EXIT.OK;
    }
    const lines = apply(root, parseIds(a.flags['--accept'], '--accept'), parseIds(a.flags['--reject'], '--reject'), { ts: isoNow(io), trace: io.trace });
    for (const l of lines) io.out(l);
    return EXIT.OK;
  });
}

module.exports = { main, parseProposals, list, nextId, decide, apply, SPECS, QUOTE_DROPPED, USAGE };

if (require.main === module) process.exitCode = main(process.argv.slice(2), cliIo(__dirname));
