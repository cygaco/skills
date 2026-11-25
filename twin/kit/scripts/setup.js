#!/usr/bin/env node
'use strict';
/*
 * setup.js: create the twin/ files, write the first-run answers, add the CLAUDE.md
 * consult rule, report where setup stands, and record that it finished. Formats:
 * templates/formats.md ("setup.js").
 *
 *   node .claude/twin/scripts/setup.js init
 *   node .claude/twin/scripts/setup.js answers --file <inbox file>   (one JSON object)
 *   node .claude/twin/scripts/setup.js rule [--apply]
 *   node .claude/twin/scripts/setup.js status
 *   node .claude/twin/scripts/setup.js complete
 *
 * Every file it reads inside the repository (the templates in .claude/twin/templates/,
 * the twin/ files, CLAUDE.md) is reached by a walk down from the root with lstat, one
 * folder at a time (lib/fsx.js linkOnWay), and a link or junction on the way is a
 * refusal: nothing is looked up, read or listed through it.
 *
 * init redacts the whole text of every file it creates from the templates. rule --apply
 * redacts the whole block it inserts into CLAUDE.md, so the block written is the rule
 * that `rule` prints; text already in CLAUDE.md is left as it is. answers reads
 * an inbox file (ledger.js inbox makes one; --file takes no other path) once and deletes
 * it, and it redacts the whole rewritten twin/stage.md and twin/policy.md, not only the
 * new values.
 *
 * status prints `state: not-initialized | incomplete | ready` and `next: <step>` first.
 * The state is ready only when the Integration changelog of twin/judgment.md has a
 * visible `- <UTC timestamp> setup complete` line: text inside an HTML comment or a
 * code fence does not count. complete writes that line once, by rewriting the whole of
 * twin/judgment.md, redacted. So answers and complete keep the text of a file they rewrite
 * except where redaction changes it; they do not keep its bytes (line ends become \n, a
 * byte-order mark is dropped, and the file ends with one line end).
 */

const path = require('path');
const { EXIT, NOT_ROOT, cliIo, normIo, atRoot, parseFlags, wantsHelp, readJsonInput, guarded, isoNow } = require('./lib/cli');
const { Refusal, lstatOrNull, readTextOrNull, readFileChecked, createFile, atomicWrite, appendText, twinDir, assertSafeTarget, stripBom } = require('./lib/fsx');
const { redact } = require('./lib/redact');
const { mask, visibleSection, findHeading, sectionRange, insertionPoint, flatLine, escapeLine, dropTrailingNewlines } = require('./lib/md');
const { STAGE_TOKENS, HEADINGS, STAGE_LINE, SPEND_LINE, RULE_START, RULE_END, SETUP_COMPLETE, INBOX_IGNORE } = require('./lib/formats');
const { readJsonl, indexLedger } = require('./lib/jsonl');
const { parseProposals } = require('./proposals');

const USAGE = `usage: node .claude/twin/scripts/setup.js <command>

  init             create twin/ and its files from the templates; never overwrites a file
  answers          write the first-run answers into twin/stage.md and twin/policy.md
                   (one JSON object in --file <inbox file>, or on stdin; every
                   key optional)
  rule             print the consult rule for CLAUDE.md
  rule --apply     write the rule into CLAUDE.md between its two marker lines
  status           print state: and next: (where setup stands), then the stage, ledger
                   counts, pending proposals, outcomes since the last review and the rule
  complete         record in twin/judgment.md that setup finished (once)

Run it from your repository's root folder.
Exit: 0 done, 1 problems found, 2 refused or usage error, 3 ask the user.
Every refusal check runs before the first write, so a refusal writes nothing. The one
exception is init or answers stopping part way (exit 2 on a file-system error such as a
full disk, or on a file or folder swapped while it runs): the files it wrote before that
stay; run the same command again.`;

// twin/ file name -> template file name (null: an empty file)
const INIT_FILES = [
  ['policy.md', 'policy.md'],
  ['stage.md', 'stage.md'],
  ['judgment.md', 'judgment.md'],
  ['proposals.md', 'proposals.md'],
  ['ledger.jsonl', null],
  ['.gitignore', 'gitignore.txt'],
];

const TEXT_MAX = 300;
const LIST_MAX = { priorities: 5, avoid: 10, extra_red_lines: 10 };
const ANSWER_KEYS = ['project', 'stage', 'audience', 'win', 'priorities', 'avoid', 'spend_limit', 'extra_red_lines'];
const STAGE_SECTION = { project: '## What this project is', audience: '## Who it is for', win: '## A win right now', priorities: '## Priorities (ranked)', avoid: '## Avoid right now' };

// The installed templates, reached from the root (the root check has walked .claude,
// .claude/twin and .claude/twin/scripts with lstat and found no link there).
const templatesDir = (root) => path.join(root, '.claude', 'twin', 'templates');

// ------------------------------------------------------------------ init

function init(root, tplDir) {
  const contents = new Map();
  for (const [name, tpl] of INIT_FILES) {
    if (tpl === null) {
      contents.set(name, '');
      continue;
    }
    const t = readTextOrNull(path.join(tplDir, tpl), `.claude/twin/templates/${tpl}`, root);
    if (t === null) throw new Refusal(`template missing: .claude/twin/templates/${tpl} (copy the pack's kit/ folder to .claude/twin/ again)`);
    // The whole text is redacted before it is written, as every other script write is,
    // so a secret or an email address planted in an installed template never reaches twin/.
    contents.set(name, redact(t));
  }
  const twinAbs = path.join(root, 'twin');
  const st = lstatOrNull(twinAbs);
  if (st && st.isSymbolicLink()) throw new Refusal('twin is a symlink; refusing to write through it (make twin/ a real folder)');
  if (st && !st.isDirectory()) throw new Refusal('twin exists and is not a folder');
  // Every check that can refuse runs here, before the first write (twin/ made or a file
  // written), so a refusal leaves the repository as it was. Each file is planned: created
  // when it does not exist, kept when it does, and twin/.gitignore repaired when it exists
  // without a canonical line. An existing twin/.gitignore is read here, through a checked
  // descriptor: a link, a junction, a folder or a hard link there is refused before any
  // other file is created.
  const plan = [];
  for (const [name] of INIT_FILES) {
    const abs = path.join(twinAbs, name);
    if (!lstatOrNull(abs)) {
      assertSafeTarget(root, abs);
      plan.push({ name, abs, op: 'create' });
      continue;
    }
    // A planted empty or wrong twin/.gitignore is repaired, not kept, so the one-time
    // inbox files are always git-ignored (the INBOX_IGNORE line from lib/formats.js). The
    // repair is APPEND-ONLY: it adds only the canonical ignore lines that are missing, so
    // a user's own rules already in the file survive byte for byte (a whole-file rewrite
    // would drop them).
    if (name === '.gitignore') {
      const cur = readTextOrNull(abs, 'twin/.gitignore', root);
      const have = new Set((cur === null ? '' : cur).split('\n').map((l) => l.trim()));
      const missing = contents.get('.gitignore').split('\n').map((l) => l.trim()).filter((l) => l && !have.has(l));
      if (missing.length) {
        assertSafeTarget(root, abs);
        plan.push({ name, abs, op: 'repair', text: `${missing.join('\n')}\n` });
        continue;
      }
    }
    plan.push({ name, abs, op: 'keep' });
  }
  twinDir(root, true);
  const lines = [];
  for (const p of plan) {
    if (p.op === 'create') {
      createFile(root, p.abs, contents.get(p.name));
      lines.push(`created twin/${p.name}`);
    } else if (p.op === 'repair') {
      appendText(root, p.abs, p.text);
      lines.push('repaired twin/.gitignore');
    } else lines.push(`kept twin/${p.name}`);
  }

  return lines;
}

// ------------------------------------------------------------------ answers

function cleanText(s) {
  // Redacted before the one-line tidy (a control character or line break turned into a
  // space would split a secret) and again after it, escaped last (lib/md.js escapeLine).
  return escapeLine(redact(flatLine(redact(s))));
}

function validateAnswers(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Refusal('the answers must be one JSON object');
  for (const k of Object.keys(obj)) if (!ANSWER_KEYS.includes(k)) throw new Refusal(`unknown key: ${k}`);
  const out = {};
  for (const k of ['project', 'audience', 'win']) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (typeof v !== 'string' || !v.trim()) throw new Refusal(`${k}: must be a non-empty string`);
    if (v.trim().length > TEXT_MAX) throw new Refusal(`${k}: longer than ${TEXT_MAX} characters`);
    out[k] = cleanText(v);
  }
  if ('stage' in obj) {
    const v = typeof obj.stage === 'string' ? obj.stage.trim().toLowerCase() : obj.stage;
    if (!STAGE_TOKENS.includes(v)) throw new Refusal(`stage: must be one of ${STAGE_TOKENS.join(', ')}`);
    out.stage = v;
  }
  if ('spend_limit' in obj) {
    const v = obj.spend_limit;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10000) throw new Refusal('spend_limit: must be a number of dollars from 0 to 10,000');
    if (Math.round(v * 100) / 100 !== v) throw new Refusal('spend_limit: at most two decimals');
    out.spend_limit = v;
  }
  for (const k of Object.keys(LIST_MAX)) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (!Array.isArray(v)) throw new Refusal(`${k}: must be a list of strings`);
    if (v.length > LIST_MAX[k]) throw new Refusal(`${k}: at most ${LIST_MAX[k]} items`);
    out[k] = v.map((item, i) => {
      if (typeof item !== 'string' || !item.trim()) throw new Refusal(`${k}[${i}]: must be a non-empty string`);
      if (item.trim().length > TEXT_MAX) throw new Refusal(`${k}[${i}]: longer than ${TEXT_MAX} characters`);
      return cleanText(item);
    });
  }
  return out;
}

// Trailing newlines are dropped by index (lib/md.js), so a long run of them is cheap.
const toLines = (text) => dropTrailingNewlines(text).split('\n');
const fromLines = (lines) => `${dropTrailingNewlines(lines.join('\n'))}\n`;

function replaceSection(lines, heading, body, file) {
  const m = mask(lines);
  const h = findHeading(lines, heading, m);
  if (h < 0) throw new Refusal(`${file} has no "${heading}" heading`);
  const [s, e] = sectionRange(lines, h, m);
  const tail = e < lines.length ? [''] : [];
  lines.splice(s, e - s, '', ...body, ...tail);
}

function findLine(lines, re) {
  const m = mask(lines);
  for (let i = 0; i < lines.length; i++) if (!m[i] && re.test(lines[i])) return i;
  return -1;
}

const dupKey = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function formatDollars(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function answers(root, obj) {
  const a = validateAnswers(obj);
  twinDir(root, false);
  const stageAbs = path.join(root, 'twin', 'stage.md');
  const policyAbs = path.join(root, 'twin', 'policy.md');
  const report = [];

  const stageKeys = ['stage', 'project', 'audience', 'win', 'priorities', 'avoid'].filter((k) => k in a);
  let stageText = null;
  if (stageKeys.length) {
    const t = readTextOrNull(stageAbs, 'twin/stage.md', root);
    if (t === null) throw new Refusal('twin/stage.md not found: run node .claude/twin/scripts/setup.js init first');
    const lines = toLines(t);
    if ('stage' in a) {
      const i = findLine(lines, STAGE_LINE);
      if (i < 0) throw new Refusal('twin/stage.md has no "**Stage:**" line');
      lines[i] = `**Stage:** ${a.stage}`;
    }
    for (const k of ['project', 'audience', 'win']) if (k in a) replaceSection(lines, STAGE_SECTION[k], [a[k]], 'twin/stage.md');
    if ('priorities' in a) replaceSection(lines, STAGE_SECTION.priorities, a.priorities.map((p, i) => `${i + 1}. ${p}`), 'twin/stage.md');
    if ('avoid' in a) replaceSection(lines, STAGE_SECTION.avoid, a.avoid.map((p) => `- ${p}`), 'twin/stage.md');
    // The whole rewritten file is redacted, not only the new values, so text already in
    // it (yours, or planted) never survives a rewrite unredacted.
    stageText = redact(fromLines(lines));
    assertSafeTarget(root, stageAbs);
    report.push(`updated twin/stage.md: ${stageKeys.join(', ')}`);
  }

  let policyText = null;
  if ('spend_limit' in a || 'extra_red_lines' in a) {
    const t = readTextOrNull(policyAbs, 'twin/policy.md', root);
    if (t === null) throw new Refusal('twin/policy.md not found: run node .claude/twin/scripts/setup.js init first');
    const lines = toLines(t);
    const parts = [];
    if ('spend_limit' in a) {
      const i = findLine(lines, SPEND_LINE);
      if (i < 0) throw new Refusal('twin/policy.md has no "**Spend limit:** $<number>" line');
      const rest = SPEND_LINE.exec(lines[i])[2];
      lines[i] = `**Spend limit:** $${formatDollars(a.spend_limit)}${rest}`;
      parts.push(`spend limit $${formatDollars(a.spend_limit)}`);
    }
    if ('extra_red_lines' in a) {
      const m = mask(lines);
      const h = findHeading(lines, '### Your extra red lines', m);
      if (h < 0) throw new Refusal('twin/policy.md has no "### Your extra red lines" heading');
      const [s, e] = sectionRange(lines, h, m);
      const have = new Set();
      for (let i = s; i < e; i++) {
        const b = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
        if (b && !m[i]) have.add(dupKey(b[1]));
      }
      const add = [];
      let skipped = 0;
      for (const item of a.extra_red_lines) {
        const k = dupKey(item);
        if (have.has(k)) {
          skipped++;
          continue;
        }
        have.add(k);
        add.push(`- ${item}`);
      }
      if (add.length) {
        const at = insertionPoint(lines, h, m);
        const afterBullet = at - 1 > h && !m[at - 1] && /^\s*[-*]\s/.test(lines[at - 1]);
        const block = afterBullet ? add.slice() : ['', ...add];
        if (at < lines.length && lines[at].trim()) block.push('');
        lines.splice(at, 0, ...block);
      }
      parts.push(`${add.length} extra red line${add.length === 1 ? '' : 's'} added, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped`);
    }
    policyText = redact(fromLines(lines));
    assertSafeTarget(root, policyAbs);
    report.push(`updated twin/policy.md: ${parts.join(', ')}`);
  }

  if (stageText !== null) atomicWrite(root, stageAbs, stageText);
  if (policyText !== null) atomicWrite(root, policyAbs, policyText);
  if (!report.length) report.push('nothing to write: the answers were empty');
  return report;
}

// ------------------------------------------------------------------ rule

// The rule, redacted: `rule` prints it and `rule --apply` writes it, the same text.
function ruleLine(tplDir, root) {
  const t = readTextOrNull(path.join(tplDir, 'consult-rule.md'), '.claude/twin/templates/consult-rule.md', root);
  if (t === null) throw new Refusal('template missing: .claude/twin/templates/consult-rule.md');
  const line = t.trim();
  if (!line || line.includes('\n')) throw new Refusal('templates/consult-rule.md must hold exactly one line');
  return redact(line);
}

// The block rule --apply inserts, marker lines included, redacted whole before it is
// written; the line between the markers, as written. A redaction that would touch a
// marker line is refused (nothing is written).
function ruleBlockLine(line) {
  const block = `${RULE_START}\n${line}\n${RULE_END}`;
  const parts = redact(block).split('\n');
  if (parts.length !== 3 || parts[0] !== RULE_START || parts[2] !== RULE_END) throw new Refusal('templates/consult-rule.md would change the marker lines when redacted; fix the template first');
  return parts[1];
}

function applyRule(root, ruleText) {
  const line = ruleBlockLine(ruleText);
  const abs = path.join(root, 'CLAUDE.md');
  const st = lstatOrNull(abs);
  if (st && st.isSymbolicLink()) throw new Refusal('CLAUDE.md is a symlink; refusing to write through it');
  assertSafeTarget(root, abs);
  if (!st) {
    atomicWrite(root, abs, `${RULE_START}\n${line}\n${RULE_END}\n`, { raw: true });
    return ['created CLAUDE.md with the twin consult rule'];
  }
  // Work on the raw text so every byte outside the block (BOM, line ends) stays as it is.
  // It is read through a checked descriptor (a link or hard link is refused).
  const text = readFileChecked(abs, 'CLAUDE.md', { base: root }).toString('utf8');
  const spans = [];
  const re = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let x;
  while ((x = re.exec(text)) && !(x[0] === '' && x.index >= text.length)) {
    spans.push({ start: x.index, body: stripBom(x[1]), eol: x[2], next: x.index + x[0].length });
    if (!x[2]) break;
  }
  const starts = spans.filter((s) => s.body.trim() === RULE_START);
  const ends = spans.filter((s) => s.body.trim() === RULE_END);
  if (starts.length > 1 || ends.length > 1) throw new Refusal('CLAUDE.md has more than one twin consult rule block; remove the extra one first');
  if (starts.length !== ends.length || (starts.length && ends[0].start < starts[0].start)) {
    throw new Refusal('CLAUDE.md has a broken twin consult rule block (one marker line without the other); fix it first');
  }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  let out;
  let what;
  if (starts.length) {
    const s = starts[0];
    const e = ends[0];
    const eol = s.eol || nl;
    const inner = text.slice(s.next, e.start);
    if (inner === `${line}${eol}`) return ['the twin consult rule in CLAUDE.md is already up to date'];
    out = `${text.slice(0, s.next - s.eol.length)}${eol}${line}${eol}${text.slice(e.start)}`;
    what = 'updated the twin consult rule in CLAUDE.md';
  } else {
    // End the existing text with a line end, then one blank line, before the block.
    const endsWithEol = (s) => /(?:\r\n|\n|\r)$/.test(s);
    const dropEol = (s) => s.replace(/(?:\r\n|\n|\r)$/, '');
    let t = text;
    if (stripBom(t).trim().length) {
      if (!endsWithEol(t)) t += nl;
      if (!endsWithEol(dropEol(t))) t += nl;
    }
    out = `${t}${RULE_START}${nl}${line}${nl}${RULE_END}${nl}`;
    what = 'added the twin consult rule to the end of CLAUDE.md';
  }
  atomicWrite(root, abs, out, { raw: true });
  return [what];
}

// ------------------------------------------------------------------ status

function stageToken(text) {
  if (text === null) return 'not set';
  const lines = toLines(text);
  const i = findLine(lines, STAGE_LINE);
  if (i < 0) return 'not set';
  const v = STAGE_LINE.exec(lines[i])[1].trim();
  return STAGE_TOKENS.includes(v) ? v : 'not set';
}

const CHANGELOG = '## Integration changelog';

// The visible lines of the Integration changelog (HTML comments and fences removed), or null.
function changelogLines(judgmentText) {
  if (judgmentText === null) return null;
  return visibleSection(toLines(judgmentText), CHANGELOG);
}

// The newest date or timestamp written in the Integration changelog (the last review, or
// the end of setup), as ms, or null.
function lastReview(judgmentText) {
  const lines = changelogLines(judgmentText);
  if (!lines) return null;
  let best = null;
  const re = /\b(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?Z?)?\b/g;
  for (const line of lines) {
    let x;
    while ((x = re.exec(line))) {
      const ms = Date.parse(`${x[1]}T${x[2] ? (x[2].length === 5 ? `${x[2]}:00` : x[2]) : '00:00:00'}Z`);
      if (!Number.isNaN(ms) && (best === null || ms > best)) best = ms;
    }
  }
  return best;
}

// The one line that marks setup as finished, exactly as complete writes it.
const COMPLETE_LINE = new RegExp(`^-[ \\t]+\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z[ \\t]+${SETUP_COMPLETE}[ \\t]*$`);

function setupCompleted(judgmentText) {
  const lines = changelogLines(judgmentText);
  return Boolean(lines && lines.some((l) => COMPLETE_LINE.test(l.trim())));
}

// { state, next } as formats.md ("setup.js") lists them, checked in that order.
function stateOf(root) {
  const twinAbs = path.join(root, 'twin');
  if (!lstatOrNull(twinAbs)) return { state: 'not-initialized', next: 'init' };
  twinDir(root, false); // refuses a symlinked twin, and a twin that is a file
  if (!lstatOrNull(path.join(twinAbs, 'policy.md')) || !lstatOrNull(path.join(twinAbs, 'judgment.md'))) return { state: 'not-initialized', next: 'init' };
  if (setupCompleted(readTextOrNull(path.join(twinAbs, 'judgment.md'), 'twin/judgment.md', root))) return { state: 'ready', next: 'learn' };
  const stage = stageToken(readTextOrNull(path.join(twinAbs, 'stage.md'), 'twin/stage.md', root));
  return { state: 'incomplete', next: stage === 'not set' ? 'questions' : 'confirm' };
}

// ------------------------------------------------------------------ complete

function complete(root, ts) {
  const s = stateOf(root);
  if (s.state === 'not-initialized') throw new Refusal('the twin is not set up yet: run node .claude/twin/scripts/setup.js init first');
  if (s.state === 'ready') return ['already complete'];
  const abs = path.join(root, 'twin', 'judgment.md');
  const lines = toLines(readTextOrNull(abs, 'twin/judgment.md', root));
  const m = mask(lines);
  const h = findHeading(lines, CHANGELOG, m);
  if (h < 0) throw new Refusal(`twin/judgment.md has no "${CHANGELOG}" heading`);
  const at = insertionPoint(lines, h, m);
  const afterBullet = at - 1 > h && !m[at - 1] && /^\s*[-*]\s/.test(lines[at - 1]);
  const block = afterBullet ? [] : [''];
  block.push(`- ${ts} ${SETUP_COMPLETE}`);
  if (at < lines.length && lines[at].trim()) block.push('');
  lines.splice(at, 0, ...block);
  // Every write to twin/judgment.md is redacted whole (formats.md), this one too.
  const text = redact(fromLines(lines));
  // The line must be visible where status looks for it, or status would never see it.
  if (!setupCompleted(text)) throw new Refusal('the Integration changelog of twin/judgment.md is inside an unclosed HTML comment or code fence; fix that first');
  atomicWrite(root, abs, text);
  return ['setup complete: recorded in twin/judgment.md'];
}

// true, false, or null when CLAUDE.md cannot be read safely (a link or a hard link).
function hasRule(root) {
  let t;
  try {
    t = readTextOrNull(path.join(root, 'CLAUDE.md'), 'CLAUDE.md', root);
  } catch (e) {
    if (e && e.refusal) return null;
    throw e;
  }
  if (t === null) return false;
  const lines = t.split('\n').map((l) => l.trim());
  const s = lines.indexOf(RULE_START);
  const e = lines.indexOf(RULE_END);
  return s >= 0 && e > s;
}

function status(root) {
  const twinAbs = path.join(root, 'twin');
  const s = stateOf(root);
  const out = [`state: ${s.state}`, `next: ${s.next}`];
  if (s.state === 'not-initialized') {
    out.push('not set up yet: run /twin to set it up (or node .claude/twin/scripts/setup.js init)');
    return out;
  }
  out.push(`stage: ${stageToken(readTextOrNull(path.join(twinAbs, 'stage.md'), 'twin/stage.md', root))}`);
  const read = readJsonl(path.join(twinAbs, 'ledger.jsonl'));
  const idx = indexLedger(read);
  const by = (list, key, names) => names.map((n) => `${n} ${list.filter((x) => x[key] === n).length}`).join(', ');
  out.push(`verdicts: ${idx.verdicts.length} (${by(idx.verdicts, 'verdict', ['DECIDE', 'DIRECTIVE', 'ESCALATE'])})`);
  out.push(`outcomes: ${idx.outcomes.length} (${by(idx.outcomes, 'outcome', ['overruled', 'answered'])})`);
  if (idx.problems.length) out.push(`ledger problems: ${idx.problems.length} bad line${idx.problems.length === 1 ? '' : 's'} (run node .claude/twin/scripts/ledger.js check)`);
  const pt = readTextOrNull(path.join(twinAbs, 'proposals.md'), 'twin/proposals.md', root);
  if (pt === null) out.push('pending proposals: 0 (twin/proposals.md not found)');
  else {
    const p = parseProposals(pt);
    out.push(`pending proposals: ${p.blocks.length}${p.problems.length ? ' (malformed: run node .claude/twin/scripts/proposals.js list)' : ''}`);
  }
  const since = lastReview(readTextOrNull(path.join(twinAbs, 'judgment.md'), 'twin/judgment.md', root));
  const n = idx.outcomes.filter((o) => since === null || Date.parse(o.ts) > since).length;
  out.push(`outcomes since last review: ${n}`);
  const rule = hasRule(root);
  out.push(`rule in CLAUDE.md: ${rule === null ? 'unknown (CLAUDE.md is a link or has more than one hard link; it was not read)' : rule ? 'yes' : 'no'}`);
  return out;
}

// ------------------------------------------------------------------ command line

// Each command and the options it takes (the command text in commands/twin.md uses these).
const SPECS = { init: {}, answers: { value: ['--file'] }, rule: { bool: ['--apply'] }, status: {}, complete: {} };

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
    const tplDir = templatesDir(root);
    let lines;
    if (cmd === 'init') lines = init(root, tplDir);
    else if (cmd === 'answers') {
      lines = answers(root, readJsonInput(io, root, a.flags['--file'], null));
    } else if (cmd === 'rule') {
      const line = ruleLine(tplDir, root);
      lines = a.flags['--apply'] ? applyRule(root, line) : [line];
    } else if (cmd === 'complete') lines = complete(root, isoNow(io));
    else lines = status(root);
    for (const l of lines) io.out(l);
    return EXIT.OK;
  });
}

module.exports = {
  main,
  init,
  answers,
  validateAnswers,
  ruleLine,
  applyRule,
  status,
  stateOf,
  complete,
  setupCompleted,
  stageToken,
  lastReview,
  hasRule,
  INIT_FILES,
  SPECS,
  USAGE,
};

if (require.main === module) process.exitCode = main(process.argv.slice(2), cliIo(__dirname));
