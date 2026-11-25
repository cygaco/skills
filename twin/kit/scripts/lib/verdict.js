'use strict';
/*
 * lib/verdict.js: read a twin reply as a verdict (templates/formats.md, "Verdict reply").
 *
 * parse(text) -> { ok, verdict, fields, reason, confidence, cls }
 *   Fails closed (ok false, with the reason) when: there is no DECISION line; there is
 *   more than one block; a field appears twice; the verdict is unknown; a NAME: line
 *   (a name in capitals, then a colon) sits before the DECISION line; a field name is
 *   not in that verdict's list; a required field is missing or empty; CLASS or
 *   CONFIDENCE is not a valid value; DECIDE has CLASS C; DECIDE is below 0.70;
 *   DIRECTIVE is below 0.75.
 *
 * Fence lines (``` or ~~~, with or without a language) are ignored anywhere. Other text
 * before the DECISION line is ignored by the parser (ledger.js still screens the whole
 * reply). A field value continues on the following lines until the next NAME: line, so
 * text after the block becomes part of the last field.
 *
 * Every pattern here is linear in the length of the line, so a hostile reply up to the
 * 1 MB input limit cannot stall the parser.
 */

const { normalizeText } = require('./fsx');
const { clip } = require('./redact');

const FIELDS = {
  DECIDE: ['DECISION', 'CLASS', 'CONFIDENCE', 'ANSWER', 'REASONING', 'PRECEDENT'],
  DIRECTIVE: ['DECISION', 'CONFIDENCE', 'ACTION', 'REASONING', 'PRECEDENT', 'TRIGGER'],
  ESCALATE: ['DECISION', 'CLASS', 'CONFIDENCE', 'REASON', 'RECOMMENDATION', 'SUGGESTED_QUESTION'],
};
const MIN_CENTS = { DECIDE: 70, DIRECTIVE: 75, ESCALATE: 0 };
const CLASSES = { DECIDE: ['A', 'B'], ESCALATE: ['A', 'B', 'C'] };

// A fence line: the run of backticks or tildes cannot give back a character (the
// lookahead), so a long run is read once.
const FENCE = /^\s{0,3}(?:`{3,}(?!`)|~{3,}(?!~))[^`]*$/;
// A NAME: line: optional bold markers, a name in capitals, a colon.
const NAME_LINE = /^\s*\**([A-Z][A-Z0-9_]*)\**\s*:\**\s?(.*)$/;
const CONFIDENCE = /^(?:0(?:\.\d{1,2})?|1(?:\.0{1,2})?)$/;

// A value quoted in a reason: redacted first, then cut to 40 characters (lib/redact.js
// clip), so a cut can never leave part of a secret in a shape the redactor misses.
function short(s) {
  return clip(String(s), 40);
}

function fail(reason) {
  return { ok: false, verdict: null, fields: null, reason, confidence: null, cls: null };
}

function parse(text) {
  const lines = normalizeText(text === undefined || text === null ? '' : text).split('\n');
  const entries = [];
  let decisions = 0;
  let cur = null;
  for (const line of lines) {
    if (FENCE.test(line)) continue;
    const m = NAME_LINE.exec(line);
    if (m) {
      if (m[1] === 'DECISION') decisions++;
      if (!decisions) return fail(`a ${short(m[1])}: line outside the block (before the DECISION line)`);
      cur = { name: m[1], lines: [m[2]] };
      entries.push(cur);
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  if (!decisions) return fail('no DECISION line');
  if (decisions > 1) return fail('more than one block');

  const fields = {};
  for (const e of entries) {
    if (Object.prototype.hasOwnProperty.call(fields, e.name)) return fail(`field ${e.name} appears twice`);
    fields[e.name] = e.lines.join('\n').replace(/\*\*$/, '').trim();
  }
  const verdict = fields.DECISION.toUpperCase();
  if (!FIELDS[verdict]) return fail(`unknown verdict: ${short(fields.DECISION) || '(empty)'}`);
  for (const e of entries) {
    if (!FIELDS[verdict].includes(e.name)) return fail(`field ${short(e.name)} is not one of the ${verdict} fields`);
  }

  const normalized = {};
  for (const name of FIELDS[verdict]) {
    if (!Object.prototype.hasOwnProperty.call(fields, name)) return fail(`missing field: ${name}`);
    if (!fields[name]) return fail(`empty field: ${name}`);
    normalized[name] = fields[name];
  }
  normalized.DECISION = verdict;

  let cls = null;
  if (CLASSES[verdict]) {
    cls = normalized.CLASS.toUpperCase();
    if (verdict === 'DECIDE' && cls === 'C') return fail('DECIDE with CLASS C');
    if (!CLASSES[verdict].includes(cls)) return fail(`unknown CLASS: ${short(normalized.CLASS)}`);
    normalized.CLASS = cls;
  }

  if (!CONFIDENCE.test(normalized.CONFIDENCE)) return fail(`CONFIDENCE is not a number from 0 to 1 with up to two decimals: ${short(normalized.CONFIDENCE)}`);
  const confidence = Number(normalized.CONFIDENCE);
  const cents = Math.round(confidence * 100);
  if (cents < MIN_CENTS[verdict]) return fail(`${verdict} below 0.${MIN_CENTS[verdict]} (${normalized.CONFIDENCE})`);

  return { ok: true, verdict, fields: normalized, reason: null, confidence, cls };
}

// Backticks trimmed from both ends, by index (a regex anchored at the end would rescan
// a long run of backticks once per position).
function trimTicks(s) {
  let a = 0;
  let b = s.length;
  while (a < b && s.charCodeAt(a) === 0x60) a++;
  while (b > a && s.charCodeAt(b - 1) === 0x60) b--;
  return s.slice(a, b);
}

// What the PRECEDENT field cites: none, a list of ids, or something else (bad).
// `none` alone (or `none.`, or inside one pair of backticks) is none. Otherwise the value
// is split into items on commas, semicolons and white space first, before anything is
// trimmed from an item, and each item must be exactly 8 lowercase hex characters,
// optionally inside ONE pair of backticks. Anything else (an empty code span, a lone
// backtick, other text) makes the whole field bad, and so does an empty item: a leading
// or trailing comma or semicolon, or two of them with only white space between. bad is
// null only when the field is valid; otherwise it is a non-empty text to quote, never an
// empty string. One pass by index, so a long value costs little.
const EMPTY_ITEM = '(an empty item)';
const ID_ITEM = /^(?:[0-9a-f]{8}|`[0-9a-f]{8}`)$/;
const NONE = /^`?none\.?`?$/i;
const isSpace = (c) => (c <= 0x20 ? c === 0x20 || (c >= 0x09 && c <= 0x0d) : /\s/.test(String.fromCharCode(c)));
function precedentItems(v) {
  const items = [];
  let start = -1;
  let marks = 0;
  for (let i = 0; i <= v.length; i++) {
    const c = i < v.length ? v.charCodeAt(i) : -1;
    const mark = c === 0x2c || c === 0x3b;
    if (c >= 0 && !mark && !isSpace(c)) {
      if (start < 0) {
        if (marks > 1 || (marks && !items.length)) return null;
        start = i;
        marks = 0;
      }
      continue;
    }
    if (start >= 0) {
      items.push(v.slice(start, i));
      start = -1;
    }
    if (mark) marks++;
  }
  return marks ? null : items;
}
function citedPrecedents(value) {
  const v = String(value === undefined || value === null ? '' : value).trim();
  if (NONE.test(v) && (v.charCodeAt(0) === 0x60) === (v.charCodeAt(v.length - 1) === 0x60)) return { none: true, ids: [], bad: null };
  const items = precedentItems(v);
  if (!items || !items.length) return { none: false, ids: [], bad: EMPTY_ITEM };
  const ids = [];
  for (const item of items) {
    if (!ID_ITEM.test(item)) return { none: false, ids, bad: short(item) || EMPTY_ITEM };
    ids.push(item.charCodeAt(0) === 0x60 ? item.slice(1, -1) : item);
  }
  return { none: false, ids, bad: null };
}

// The field the ledger stores as "answer", and the one it stores as "reasoning".
function answerOf(p) {
  if (!p.ok) return '';
  return p.verdict === 'DECIDE' ? p.fields.ANSWER : p.verdict === 'DIRECTIVE' ? p.fields.ACTION : p.fields.RECOMMENDATION;
}

function reasoningOf(p) {
  if (!p.ok) return '';
  return p.verdict === 'ESCALATE' ? p.fields.REASON : p.fields.REASONING;
}

module.exports = { FIELDS, parse, citedPrecedents, answerOf, reasoningOf, trimTicks };
