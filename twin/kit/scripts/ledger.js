#!/usr/bin/env node
'use strict';
/*
 * ledger.js: record twin verdicts and what the user said, in twin/ledger.jsonl
 * (templates/formats.md, "Ledger lines" and "ledger.js").
 *
 *   node .claude/twin/scripts/ledger.js inbox
 *       create a new, empty inbox file and print its path, twin/inbox-<8 hex>.json
 *   node .claude/twin/scripts/ledger.js add --file <inbox file>
 *       {"question": "<the question, as asked>", "reply": "<the twin's reply, as returned>"}
 *   node .claude/twin/scripts/ledger.js outcome <id> overruled|answered --file <inbox file>
 *       {"note": "<what the user said, in their words>"}
 *   node .claude/twin/scripts/ledger.js recent [--n 20]
 *   node .claude/twin/scripts/ledger.js stats
 *   node .claude/twin/scripts/ledger.js check
 *
 * The input is one JSON object (templates/formats.md, "Input files"), from --file or
 * stdin; a missing key, an unknown key or a value that is not a string is refused
 * (exit 2) and nothing is written. --file takes only an inbox file, which a script reads
 * once and then deletes, whether or not the input was valid; any other --file path is
 * refused by its text (exit 2), never looked at, read or deleted.
 *
 * inbox refuses (exit 2) unless twin/ is a real folder inside the repository, and refuses
 * (exit 2, naming the file, no inbox file made) when one of the files the twin agent reads
 * there, twin/judgment.md, twin/policy.md, twin/stage.md or twin/ledger.jsonl, is there
 * but is a link, a junction, a folder or a file with more than one hard link, and likewise
 * when any entry directly in twin/, whatever its name, is a link, a junction or a folder
 * (or anything else that is not a regular file); each entry is looked at with lstat only,
 * so nothing in twin/ is followed or opened. It creates
 * a new, empty file with an unguessable name, twin/inbox-<8 random hex>.json, exclusively
 * (and without following a link where the system allows it), and prints
 * `inbox ready: twin/inbox-<hex>.json`. Each input gets its own file, so two consults at
 * once never read each other's text, and no link can be waiting at the new name.
 *
 * add screens the whole question and the whole reply (every field, PRECEDENT and any
 * text around the block), records every case, including the ones that ask, and prints
 * `next: act` (exit 0) only for a readable DECIDE or DIRECTIVE that passed the screen
 * and cites no precedent or only verdict ids already in the ledger (an empty item in
 * PRECEDENT, such as a doubled comma, makes it invalid). A readable ESCALATE
 * prints `next: ask-user (escalated)` (exit 0). Every other case exits 3.
 */

const path = require('path');
const crypto = require('crypto');
const { EXIT, NOT_ROOT, cliIo, normIo, atRoot, parseFlags, wantsHelp, readJsonInput, guarded, isoNow } = require('./lib/cli');
const { Refusal, appendLine, twinDir, newInbox } = require('./lib/fsx');
const { redact, clip } = require('./lib/redact');
const { screen } = require('./lib/redlines');
const { parse, citedPrecedents, answerOf, reasoningOf } = require('./lib/verdict');
const { HEX8, readJsonl, checkLedger, indexLedger, outcomeOf } = require('./lib/jsonl');

const USAGE = `usage: node .claude/twin/scripts/ledger.js <command>

  inbox                            create a new, empty inbox file and print its path,
                                     twin/inbox-<8 hex>.json (one per input)
  add --file <inbox file>          record a twin verdict; the file holds one JSON object:
                                     {"question": "...", "reply": "..."}
  outcome <id> overruled|answered --file <inbox file>
                                   record what the user said: {"note": "..."}
  recent [--n 20]                  the last n verdicts, with their outcome
  stats                            counts by verdict, class and outcome
  check                            check every line of twin/ledger.jsonl

Claude runs inbox, then writes the file it printed with its own file-writing tool, so no
text passes through a shell; the script reads that file once and deletes it. The same
JSON is also read from stdin, for your own scripting.
Run it from your repository's root folder.
Exit: 0 done, 1 bad ledger lines (line N: reason), 2 refused or usage error (nothing
written), 3 ask the user.`;

const QUESTION_MAX = 2000;
const TEXT_MAX = 1000;
const CUT = '[cut]';

function cap(s, max) {
  const t = String(s);
  if (t.length <= max) return t;
  let n = max - CUT.length;
  const c = t.charCodeAt(n - 1);
  if (c >= 0xd800 && c <= 0xdbff) n--;
  return t.slice(0, n) + CUT;
}

const store = (s, max) => cap(redact(s), max);

function ledgerFile(root) {
  return path.join(twinDir(root, false), 'ledger.jsonl');
}

function newId(taken) {
  for (;;) {
    const id = crypto.randomBytes(4).toString('hex');
    if (!taken.has(id)) return id;
  }
}

// ------------------------------------------------------------------ add

// input: { question, reply }, both strings (from readJsonInput).
function add(root, input, ts) {
  const file = ledgerFile(root);
  const question = String(input.question).trim();
  const reply = String(input.reply).trim();
  if (!question) throw new Refusal('the question is empty');
  const idx = indexLedger(readJsonl(file));
  const verdictIds = new Set(idx.verdicts.map((v) => v.id));

  const p = parse(reply);
  // Every word is screened: the whole question, then the whole reply (every field,
  // REASONING and PRECEDENT included, and any text around the block).
  const sq = screen(question);
  const sr = sq.ask ? null : screen(reply);
  const hit = sq.ask ? sq : sr && sr.ask ? sr : null;

  let precedent = 'none';
  let missing = null;
  if (p.ok && p.verdict !== 'ESCALATE') {
    const c = citedPrecedents(p.fields.PRECEDENT);
    // Any bad value makes the precedent invalid, an empty text included.
    if (c.bad !== null) {
      precedent = 'invalid';
      missing = c.bad;
    } else if (!c.none) {
      const absent = c.ids.find((id) => !verdictIds.has(id));
      if (absent) {
        precedent = 'invalid';
        missing = absent;
      } else precedent = c.ids.join(',');
    }
  }

  const id = newId(idx.allIds);
  const rec = {
    type: 'verdict',
    id,
    ts,
    question: store(question, QUESTION_MAX),
    verdict: p.ok ? p.verdict : 'ESCALATE',
    class: p.ok ? p.cls : null,
    confidence: p.ok ? p.confidence : null,
    answer: store(answerOf(p), TEXT_MAX),
    reasoning: store(p.ok ? reasoningOf(p) : `unreadable reply: ${p.reason}`, TEXT_MAX),
    precedent,
    parsed: p.ok,
    screen: hit ? `ask-user: ${redact(hit.term)}` : 'pass',
  };
  appendLine(root, file, JSON.stringify(rec));

  const lines = [`id ${id}`, `verdict ${rec.verdict} class ${rec.class || 'none'} confidence ${rec.confidence === null ? 'none' : rec.confidence.toFixed(2)}`];
  let code;
  if (!p.ok) {
    lines.push(`next: ask-user (unreadable reply: ${redact(p.reason)})`);
    code = EXIT.ASK;
  } else if (p.verdict === 'ESCALATE') {
    lines.push('next: ask-user (escalated)');
    code = EXIT.OK;
  } else if (hit) {
    lines.push(`next: ask-user (red-line screen: ${redact(hit.term)})`);
    code = EXIT.ASK;
  } else if (precedent === 'invalid') {
    lines.push(`next: ask-user (precedent ${redact(missing)} is not in the ledger)`);
    code = EXIT.ASK;
  } else {
    lines.push('next: act');
    code = EXIT.OK;
  }
  return { code, lines, record: rec };
}

// ------------------------------------------------------------------ outcome

function outcome(root, of, kind, note, ts) {
  if (!HEX8.test(of)) throw new Refusal(`not a verdict id: ${clip(String(of), 20)}`);
  if (kind !== 'overruled' && kind !== 'answered') throw new Refusal('the outcome is overruled or answered');
  const text = String(note).trim();
  if (!text) throw new Refusal('the note is empty: run ledger.js inbox, write {"note": "<what the user said>"} to the inbox file it prints and pass --file with that path');
  const file = ledgerFile(root);
  const idx = indexLedger(readJsonl(file));
  if (!idx.byId.has(of)) throw new Refusal(`${of} is not a verdict in twin/ledger.jsonl`);
  const id = newId(idx.allIds);
  const rec = { type: 'outcome', id, ts, of, outcome: kind, note: store(text, TEXT_MAX) };
  appendLine(root, file, JSON.stringify(rec));
  return { lines: [`id ${id} of ${of}`], record: rec };
}

// ------------------------------------------------------------------ reports

// Redacted first, then flattened and cut (lib/redact.js clip), so a value planted in the
// ledger cannot be cut into a shape the redactor no longer sees.
const flat = (s, n) => clip(String(s), n);

function warnings(idx) {
  return idx.problems.length ? [`warning: ${idx.problems.length} bad line${idx.problems.length === 1 ? '' : 's'} left out (run node .claude/twin/scripts/ledger.js check)`] : [];
}

function recent(root, n) {
  const idx = indexLedger(readJsonl(ledgerFile(root)));
  if (!idx.verdicts.length) return { lines: ['no verdicts yet'], warn: warnings(idx) };
  const lines = idx.verdicts.slice(-n).map((v) => {
    const conf = v.confidence === null ? '-' : v.confidence.toFixed(2);
    return `${v.id} ${v.ts.slice(0, 10)} ${v.verdict} ${v.class || '-'} ${conf} ${outcomeOf(idx, v)}${v.screen === 'pass' ? '' : ' (screen asked)'}: ${flat(v.question, 100)}`;
  });
  return { lines, warn: warnings(idx) };
}

function stats(root) {
  const idx = indexLedger(readJsonl(ledgerFile(root)));
  const V = idx.verdicts;
  const count = (f) => V.filter(f).length;
  const lines = [
    `verdicts ${V.length}: DECIDE ${count((v) => v.verdict === 'DECIDE')}, DIRECTIVE ${count((v) => v.verdict === 'DIRECTIVE')}, ESCALATE ${count((v) => v.verdict === 'ESCALATE')} (unreadable ${count((v) => !v.parsed)})`,
    `class: A ${count((v) => v.class === 'A')}, B ${count((v) => v.class === 'B')}, C ${count((v) => v.class === 'C')}, none ${count((v) => v.class === null)}`,
    `outcomes: overruled ${count((v) => outcomeOf(idx, v) === 'overruled')}, answered ${count((v) => outcomeOf(idx, v) === 'answered')}, followed ${count((v) => outcomeOf(idx, v) === 'followed')}, unanswered ${count((v) => outcomeOf(idx, v) === 'unanswered')}`,
    `screen asked: ${count((v) => v.screen !== 'pass')}; precedent invalid: ${count((v) => v.precedent === 'invalid')}`,
  ];
  return { lines, warn: warnings(idx) };
}

function check(root) {
  const file = path.join(root, 'twin', 'ledger.jsonl');
  twinDir(root, false);
  const read = readJsonl(file);
  if (!read.exists) return { code: EXIT.PROBLEMS, lines: ['twin/ledger.jsonl: not found (run node .claude/twin/scripts/setup.js init)'] };
  const problems = checkLedger(read);
  if (problems.length) return { code: EXIT.PROBLEMS, lines: problems.map((p) => `line ${p.line}: ${p.reason}`) };
  const v = read.entries.filter((e) => e.obj.type === 'verdict').length;
  return { code: EXIT.OK, lines: [`ok: ${read.entries.length} lines (${v} verdicts, ${read.entries.length - v} outcomes)`] };
}

// ------------------------------------------------------------------ command line

// Each command and the options it takes (the command text in commands/twin.md uses these).
const SPECS = { inbox: {}, add: { value: ['--file'] }, outcome: { value: ['--file'], maxPos: 2 }, recent: { value: ['--n'] }, stats: {}, check: {} };
// The keys of each JSON input (templates/formats.md, "Input files").
const ADD_KEYS = ['question', 'reply'];
const OUTCOME_KEYS = ['note'];

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
    if (cmd === 'outcome' && a.pos.length !== 2) {
      io.err('usage: ledger.js outcome <id> overruled|answered --file <inbox file> (holding {"note": "..."})');
      return EXIT.REFUSED;
    }
    let n = 20;
    if (cmd === 'recent' && a.flags['--n'] !== undefined) {
      n = Number(a.flags['--n']);
      if (!/^\d+$/.test(a.flags['--n']) || n < 1 || n > 1000) {
        io.err('usage: --n is a whole number from 1 to 1000');
        return EXIT.REFUSED;
      }
    }
    if (!atRoot(io)) {
      io.err(`refused: ${NOT_ROOT}`);
      return EXIT.REFUSED;
    }
    const root = io.cwd;
    if (cmd === 'inbox') {
      let made;
      try {
        made = newInbox(root);
      } catch (e) {
        // The inbox file could not be made safely (twin/ or a file the twin agent reads is
        // a link, a junction, a hard link or unreadable). Tell the caller to ask the user,
        // then let the refusal surface as exit 2; never fall through to act on a half-made
        // inbox, and never silently read a default list past a planted link.
        io.out('next: ask');
        throw e;
      }
      io.out(`inbox ready: ${made}`);
      return EXIT.OK;
    }
    if (cmd === 'add') {
      const r = add(root, readJsonInput(io, root, a.flags['--file'], ADD_KEYS), isoNow(io));
      for (const l of r.lines) io.out(l);
      return r.code;
    }
    if (cmd === 'outcome') {
      const r = outcome(root, a.pos[0], a.pos[1], readJsonInput(io, root, a.flags['--file'], OUTCOME_KEYS).note, isoNow(io));
      for (const l of r.lines) io.out(l);
      return EXIT.OK;
    }
    if (cmd === 'check') {
      const r = check(root);
      for (const l of r.lines) io.out(l);
      return r.code;
    }
    const r = cmd === 'recent' ? recent(root, n) : stats(root);
    for (const l of r.lines) io.out(l);
    for (const w of r.warn) io.err(w);
    return EXIT.OK;
  });
}

module.exports = { main, add, outcome, recent, stats, check, cap, SPECS, ADD_KEYS, OUTCOME_KEYS, USAGE };

if (require.main === module) process.exitCode = main(process.argv.slice(2), cliIo(__dirname));
