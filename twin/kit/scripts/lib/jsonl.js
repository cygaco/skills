'use strict';
/*
 * lib/jsonl.js: read twin/ledger.jsonl line by line, and check every line.
 *
 * readJsonl(file) never skips a line silently: each line is either an entry
 * { line, obj } or a problem { line, reason }. checkLedger() adds the schema checks
 * of templates/formats.md ("Ledger lines"): the type, every field and its type, unique
 * ids, and outcomes that point at an earlier verdict.
 */

const path = require('path');
const { stripBom, lstatOrNull, readFileChecked } = require('./fsx');
const { clip, redact } = require('./redact');

const HEX8 = /^[0-9a-f]{8}$/;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PRECEDENT = /^(?:none|invalid|[0-9a-f]{8}(?:,[0-9a-f]{8})*)$/;
const VERDICTS = ['DECIDE', 'DIRECTIVE', 'ESCALATE'];
const OUTCOMES = ['overruled', 'answered'];

// The ledger is read through a checked descriptor (lib/fsx.js): a linked or hard-linked
// twin/ledger.jsonl is refused, never followed.
function readJsonl(file) {
  if (!lstatOrNull(file)) return { exists: false, entries: [], bad: [] };
  let text;
  try {
    text = readFileChecked(file, `twin/${path.basename(file)}`).toString('utf8');
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return { exists: false, entries: [], bad: [] };
    throw e;
  }
  text = stripBom(text);
  const raw = text.split('\n');
  if (raw.length && raw[raw.length - 1] === '') raw.pop();
  const entries = [];
  const bad = [];
  raw.forEach((l, i) => {
    const line = i + 1;
    const s = l.replace(/\r$/, '');
    if (!s.trim()) {
      bad.push({ line, reason: 'empty line' });
      return;
    }
    let obj;
    try {
      obj = JSON.parse(s);
    } catch (e) {
      bad.push({ line, reason: 'not valid JSON' });
      return;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      bad.push({ line, reason: 'not a JSON object' });
      return;
    }
    entries.push({ line, obj });
  });
  return { exists: true, entries, bad };
}

const isStr = (v) => typeof v === 'string';

function fieldProblems(o) {
  const out = [];
  const need = (name, ok, what) => {
    if (!Object.prototype.hasOwnProperty.call(o, name)) out.push(`missing field "${name}"`);
    else if (!ok(o[name])) out.push(`field "${name}" ${what}`);
  };
  if (o.type === 'verdict') {
    need('id', (v) => isStr(v) && HEX8.test(v), 'is not an 8-character lowercase hex id');
    need('ts', (v) => isStr(v) && TS.test(v), 'is not a UTC timestamp');
    need('question', isStr, 'is not a string');
    need('verdict', (v) => VERDICTS.includes(v), 'is not DECIDE, DIRECTIVE or ESCALATE');
    need('class', (v) => v === null || ['A', 'B', 'C'].includes(v), 'is not A, B, C or null');
    need('confidence', (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 1), 'is not a number from 0 to 1 or null');
    need('answer', isStr, 'is not a string');
    need('reasoning', isStr, 'is not a string');
    need('precedent', (v) => isStr(v) && PRECEDENT.test(v), 'is not none, invalid or a ledger id');
    need('parsed', (v) => typeof v === 'boolean', 'is not true or false');
    need('screen', (v) => isStr(v) && (v === 'pass' || /^ask-user: \S/.test(v)), 'is not pass or ask-user: <phrase>');
    if (o.parsed === false && o.verdict !== undefined && o.verdict !== 'ESCALATE') out.push('an unreadable reply must be stored as ESCALATE');
  } else if (o.type === 'outcome') {
    need('id', (v) => isStr(v) && HEX8.test(v), 'is not an 8-character lowercase hex id');
    need('ts', (v) => isStr(v) && TS.test(v), 'is not a UTC timestamp');
    need('of', (v) => isStr(v) && HEX8.test(v), 'is not an 8-character lowercase hex id');
    need('outcome', (v) => OUTCOMES.includes(v), 'is not overruled or answered');
    need('note', isStr, 'is not a string');
  }
  return out;
}

// Every problem in the ledger, as { line, reason }, in line order.
function checkLedger(read) {
  const problems = read.bad.slice();
  const firstLine = new Map();
  const verdictIds = new Set();
  for (const { line, obj } of read.entries) {
    if (obj.type !== 'verdict' && obj.type !== 'outcome') {
      // Redacted before it is quoted (JSON.stringify escapes quote marks, which would hide a
      // quoted value from the redactor) and before it is cut (lib/redact.js clip).
      problems.push({ line, reason: `unknown type ${clip(JSON.stringify(redact(String(obj.type))), 40)}` });
      continue;
    }
    const reasons = fieldProblems(obj);
    if (isStr(obj.id) && HEX8.test(obj.id)) {
      if (firstLine.has(obj.id)) reasons.push(`duplicate id ${obj.id} (first on line ${firstLine.get(obj.id)})`);
      else firstLine.set(obj.id, line);
    }
    if (obj.type === 'outcome' && isStr(obj.of) && HEX8.test(obj.of) && !verdictIds.has(obj.of)) {
      reasons.push(`outcome of unknown verdict ${obj.of}`);
    }
    if (obj.type === 'verdict' && isStr(obj.id) && HEX8.test(obj.id) && !reasons.length) verdictIds.add(obj.id);
    if (reasons.length) problems.push({ line, reason: reasons.join('; ') });
  }
  return problems.sort((a, b) => a.line - b.line);
}

// The good lines, indexed: verdicts in order, outcomes, the latest outcome per verdict.
function indexLedger(read) {
  const problems = checkLedger(read);
  const badLines = new Set(problems.map((p) => p.line));
  const verdicts = [];
  const byId = new Map();
  const outcomes = [];
  const latest = new Map();
  const allIds = new Set();
  for (const { line, obj } of read.entries) {
    if (isStr(obj.id)) allIds.add(obj.id);
    if (badLines.has(line)) continue;
    if (obj.type === 'verdict') {
      verdicts.push(obj);
      byId.set(obj.id, obj);
    } else if (obj.type === 'outcome') {
      outcomes.push(obj);
      latest.set(obj.of, obj);
    }
  }
  return { verdicts, byId, outcomes, latest, allIds, problems };
}

// followed / overruled / answered / unanswered, for one verdict.
function outcomeOf(index, v) {
  const o = index.latest.get(v.id);
  if (o) return o.outcome;
  return v.verdict === 'ESCALATE' ? 'unanswered' : 'followed';
}

module.exports = { HEX8, TS, readJsonl, checkLedger, indexLedger, outcomeOf };
