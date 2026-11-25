#!/usr/bin/env node
'use strict';
/*
 * check.js: a short offline check of the installed twin pack.
 *
 *   node .claude/twin/scripts/check.js        (from your repository's root folder)
 *
 * It checks that every installed file is there and that every script loads, runs setup
 * init and one verdict end to end, and runs one case for each of these safety behaviors:
 * the inbox step refuses an agent file it cannot trust; proposals.js apply decides what an
 * earlier run did only from what apply itself wrote, and keeps a proposal pending until its
 * whole apply is done; setup.js init refuses before its first write; a replaced file keeps
 * its permission bits, and its temporary copy is never more readable than the file; and
 * formats.md says what those behaviors leave on disk.
 *
 * It writes nothing in your repository and reads nothing of yours: every case runs in a
 * sandbox folder under the system temp folder (a fake repository root with a copy of
 * .claude/twin/), deleted at the end. The scripts are driven in-process through their
 * main(argv, io), with an empty environment and a sandbox home folder. It starts no other
 * program and makes no network connection.
 *
 * Prints `ok <case>`, `FAIL <case>: <why>` or `SKIP <case>: <why>` per case, then
 * `<n> ok / <f> FAIL` (and ` / <s> SKIP` when a case could not run on this system).
 * Exit 1 if any case fails.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const KIT = path.join(__dirname, '..');
const TEMPLATES = path.join(__dirname, '..', 'templates');
const AGENT = path.join(__dirname, '..', '..', 'agents', 'twin.md');
const COMMAND = path.join(__dirname, '..', '..', 'commands', 'twin.md');
// Where an INSTALLED path is on disk: the agent file, the command file, or a file of the kit.
const installedPath = (rel) => (rel === 'agents/twin.md' ? AGENT : rel === 'commands/twin.md' ? COMMAND : path.join(KIT, ...rel.split('/').slice(1)));

// Every file the pack installs, relative to .claude/ (pack.json "files", as installed).
const INSTALLED = [
  'agents/twin.md',
  'commands/twin.md',
  'twin/consult.md',
  'twin/package.json',
  'twin/scripts/check.js',
  'twin/scripts/ledger.js',
  'twin/scripts/lib/cli.js',
  'twin/scripts/lib/formats.js',
  'twin/scripts/lib/fsx.js',
  'twin/scripts/lib/jsonl.js',
  'twin/scripts/lib/md.js',
  'twin/scripts/lib/redact.js',
  'twin/scripts/lib/redlines.js',
  'twin/scripts/lib/transcripts.js',
  'twin/scripts/lib/verdict.js',
  'twin/scripts/mine.js',
  'twin/scripts/proposals.js',
  'twin/scripts/setup.js',
  'twin/scripts/verdict.js',
  'twin/templates/consult-rule.md',
  'twin/templates/formats.md',
  'twin/templates/gitignore.txt',
  'twin/templates/judgment.md',
  'twin/templates/policy.md',
  'twin/templates/proposals.md',
  'twin/templates/stage.md',
];
const SCRIPTS = ['setup', 'ledger', 'verdict', 'mine', 'proposals', 'lib/cli', 'lib/formats', 'lib/fsx', 'lib/jsonl', 'lib/md', 'lib/redact', 'lib/redlines', 'lib/transcripts', 'lib/verdict'];

// ------------------------------------------------------------------ reporting

let nOk = 0;
let nFail = 0;
let nSkip = 0;
class Skip extends Error {}
const flat = (s) => String(s).replace(/\s+/g, ' ').slice(0, 400);
function must(cond, why) {
  if (!cond) throw new Error(why || 'condition not met');
}
function test(name, fn) {
  try {
    fn();
    nOk++;
    console.log(`ok ${name}`);
  } catch (e) {
    if (e instanceof Skip) {
      nSkip++;
      console.log(`SKIP ${name}: ${flat(e.message)}`);
    } else {
      nFail++;
      console.log(`FAIL ${name}: ${flat(e && e.message ? e.message : e)}`);
    }
  }
}

// ------------------------------------------------------------------ sandboxes

const SANDBOXES = [];
const START_MS = Date.parse('2026-03-01T10:00:00Z');
const at = (minutes) => () => new Date(START_MS + minutes * 60000);
const read = (p) => fs.readFileSync(p, 'utf8');
const tw = (root, name) => path.join(root, 'twin', name);
const errno = (code) => Object.assign(new Error(`${code} (made by the check)`), { code });

function tempDir(label) {
  const d = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), `twin-check-${label}-`));
  SANDBOXES.push(d);
  return d;
}

// A fake repository root with the installed kit copied in.
function sandbox(label) {
  const root = tempDir(label);
  fs.cpSync(KIT, path.join(root, '.claude', 'twin'), { recursive: true });
  return root;
}

let HOME = null;
const home = () => HOME || (HOME = tempDir('home'));

let mods = null;
function run(name, root, argv, stdin, now) {
  const out = [];
  const err = [];
  const io = { cwd: root, selfDir: path.join(root, '.claude', 'twin', 'scripts'), stdin, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)), now: now || at(0), env: {}, homedir: home };
  const code = mods[name].main(argv, io);
  return { code, out, text: out.join('\n'), all: out.concat(err).join('\n') };
}

function initRoot(label) {
  const root = sandbox(label);
  const r = run('setup', root, ['init']);
  must(r.code === 0, `init exit ${r.code}: ${r.all}`);
  return root;
}

const inboxFiles = (root) => fs.readdirSync(path.join(root, 'twin')).filter((f) => /^inbox-[0-9a-f]{8}\.json$/.test(f));

// ------------------------------------------------------------------ the install

function installCases() {
  test('install: every file the pack installs is in .claude/', () => {
    const missing = INSTALLED.filter((rel) => !fs.existsSync(installedPath(rel)));
    must(!missing.length, `missing: ${missing.join(', ')} (copy the pack again: agent/twin.md to .claude/agents/, command/twin.md to .claude/commands/, kit/ to .claude/twin/)`);
  });
  test('install: every script loads', () => {
    const loaded = {};
    const bad = [];
    for (const s of SCRIPTS) {
      try {
        loaded[s] = require(`./${s}`);
      } catch (e) {
        bad.push(`${s}.js (${e && e.message ? e.message : e})`);
      }
    }
    must(!bad.length, `did not load: ${bad.join('; ')}`);
    mods = loaded;
  });
}

// ------------------------------------------------------------------ end to end

function endToEndCases() {
  test('run: setup init creates the twin/ files, and one verdict is recorded with next: act', () => {
    const root = initRoot('e2e');
    for (const f of ['policy.md', 'stage.md', 'judgment.md', 'proposals.md', 'ledger.jsonl', '.gitignore']) must(fs.existsSync(tw(root, f)), `init did not create twin/${f}`);
    const inbox = run('ledger', root, ['inbox']);
    const m = /^inbox ready: (twin\/inbox-[0-9a-f]{8}\.json)$/m.exec(inbox.text);
    must(inbox.code === 0 && m, `ledger.js inbox: exit ${inbox.code}: ${inbox.all}`);
    const reply = ['DECISION: DECIDE', 'CLASS: A', 'CONFIDENCE: 0.82', 'ANSWER: Call it formatDate.', 'REASONING: Internal name, easy to undo.', 'PRECEDENT: none'].join('\n');
    fs.writeFileSync(path.join(root, ...m[1].split('/')), JSON.stringify({ question: 'Should the internal date-formatting helper be called formatDate or toDisplayDate?', reply }));
    const r = run('ledger', root, ['add', '--file', m[1]]);
    must(r.code === 0 && r.out[r.out.length - 1] === 'next: act', `ledger.js add: exit ${r.code}: ${r.all}`);
    const lines = read(tw(root, 'ledger.jsonl')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
    must(lines.length === 1 && lines[0].verdict === 'DECIDE', `the ledger holds ${lines.length} lines`);
    must(!inboxFiles(root).length, 'the inbox file was not deleted after it was read');
  });
}

// ------------------------------------------------------------------ safety behaviors

function inboxCases() {
  const plantAgent = (root, text) => {
    fs.mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'agents', 'twin.md'), text);
  };
  const refuses = (root, re) => {
    const r = run('ledger', root, ['inbox']);
    must(r.code === 2 && r.out.includes('next: ask'), `exit ${r.code}: ${r.all}`);
    must(re.test(r.all), `the refusal does not say what to fix: ${r.all}`);
    must(!inboxFiles(root).length, 'an inbox file was made');
  };
  test('inbox: a regular file at .claude/agents is refused (exit 2, next: ask), and no inbox file is made', () => {
    const root = initRoot('agents-file');
    fs.writeFileSync(path.join(root, '.claude', 'agents'), '# not a folder\n');
    refuses(root, /\.claude\/agents is not a folder/);
  });
  test('inbox: an agent file without its "On every call, read these first" section is refused (exit 2, next: ask), and no inbox file is made', () => {
    const root = initRoot('agent-no-section');
    plantAgent(root, '# twin agent\n\nSome text, and no read list.\n');
    refuses(root, /On every call, read these first/);
  });
  test('inbox: an agent file whose read-list section names no file is refused (exit 2, next: ask), and no inbox file is made', () => {
    const root = initRoot('agent-empty-section');
    plantAgent(root, '# twin agent\n\n## On every call, read these first\n\nRead them on every call.\n\n## Rules\n');
    refuses(root, /reinstall the pack, or restore that section/);
  });
  test('inbox: the installed agent file passes the inbox step (exit 0, one inbox file)', () => {
    const root = initRoot('agent-installed');
    plantAgent(root, read(AGENT));
    const r = run('ledger', root, ['inbox']);
    must(r.code === 0 && inboxFiles(root).length === 1, `exit ${r.code}: ${r.all}`);
  });
}

function proposalCases() {
  const PROPOSAL = '# Proposals for your twin\n\n### P-001 - Name helpers by what they return\nkind: heuristic\nconfidence: high\nevidence: ledger 1a2b3c4d\nchange: Name helpers by what they return.\n';
  const count = (s, re) => (s.match(re) || []).length;
  const archive = (root) => (fs.existsSync(tw(root, 'proposals-archive.md')) ? read(tw(root, 'proposals-archive.md')) : '');
  const heuristics = (root) => count(read(tw(root, 'judgment.md')), /^### H-\d{3} /gm);
  // The P-001 archive entry, and whether its last lines are the decision: and date: lines.
  const entryComplete = (root) => {
    const a = archive(root);
    const i = a.search(/^### P-001 /m);
    if (i < 0) return false;
    const rest = a.slice(i);
    const nl = rest.indexOf('\n') + 1;
    const next = nl ? rest.slice(nl).search(/^#{1,6} /m) : -1;
    const body = (next < 0 ? rest : rest.slice(0, nl + next)).split('\n').filter((l) => l.trim());
    return body.length >= 3 && /^decision: \S/.test(body[body.length - 2]) && /^date: \d{4}-\d{2}-\d{2}T[0-9:]+Z$/.test(body[body.length - 1]);
  };

  test('proposals: a mention of P-001 in prose in the Integration changelog does not count as applied (apply applies it)', () => {
    const root = initRoot('changelog-prose');
    fs.writeFileSync(tw(root, 'proposals.md'), PROPOSAL);
    fs.appendFileSync(tw(root, 'judgment.md'), '\n- 2026-02-27 looked at P-001 by hand; not applied yet\n');
    const r = run('proposals', root, ['apply', '--accept', 'P-001']);
    must(r.code === 0 && r.out.includes('P-001 applied'), `exit ${r.code}: ${r.all}`);
    must(heuristics(root) === 1, `expected one heuristic in judgment.md, got ${heuristics(root)}`);
  });
  test('proposals: a write cut short after part of the archive entry, then a retry, leaves one complete archive entry and applies once', () => {
    const root = initRoot('archive-cut-write');
    fs.writeFileSync(tw(root, 'proposals.md'), PROPOSAL);
    const savedOpen = fs.openSync;
    const savedWrite = fs.writeSync;
    const fds = new Set();
    let cut = false;
    fs.openSync = (p, ...a) => {
      const fd = savedOpen.call(fs, p, ...a);
      if (path.basename(String(p)).includes('proposals-archive.md')) fds.add(fd);
      return fd;
    };
    fs.writeSync = (fd, buf, ...a) => {
      if (!cut && fds.has(fd) && Buffer.isBuffer(buf)) {
        // The bytes up to the end of the entry's heading line are written, then the write fails.
        const s = buf.toString('utf8');
        const h = s.indexOf('### P-001');
        cut = true;
        savedWrite.call(fs, fd, buf, 0, h < 0 ? Math.floor(buf.length / 2) : Buffer.byteLength(s.slice(0, s.indexOf('\n', h) + 1)));
        throw errno('EIO');
      }
      return savedWrite.call(fs, fd, buf, ...a);
    };
    let first;
    try {
      first = run('proposals', root, ['apply', '--accept', 'P-001']);
    } finally {
      fs.openSync = savedOpen;
      fs.writeSync = savedWrite;
    }
    must(cut && first.code === 2, `the first apply did not stop on the cut write: exit ${first.code}: ${first.all}`);
    const retry = run('proposals', root, ['apply', '--accept', 'P-001'], undefined, at(10));
    must(retry.code === 0 && retry.out.includes('P-001 applied'), `the retry did not apply: exit ${retry.code}: ${retry.all}`);
    must(count(archive(root), /^### P-001 /gm) === 1 && entryComplete(root), `the archive does not hold one complete P-001 entry: ${flat(archive(root).slice(-300))}`);
    must(heuristics(root) === 1, `expected one heuristic, got ${heuristics(root)}`);
  });
  test('proposals: an archive entry cut short (a heading and one field) is replaced by one complete entry when apply runs', () => {
    const root = initRoot('archive-cut-file');
    fs.writeFileSync(tw(root, 'proposals.md'), PROPOSAL);
    fs.writeFileSync(tw(root, 'proposals-archive.md'), '# Processed twin proposals\n\n### P-001 - Name helpers by what they return\nkind: heuristic\n');
    const r = run('proposals', root, ['apply', '--accept', 'P-001']);
    must(r.code === 0 && r.out.includes('P-001 applied'), `exit ${r.code}: ${r.all}`);
    must(count(archive(root), /^### P-001 /gm) === 1 && entryComplete(root), `the archive does not hold one complete P-001 entry: ${flat(archive(root).slice(-300))}`);
  });
  test('proposals: a proposal archived by a run that stopped before its judgment write stays pending through another apply, and a retry applies it once', () => {
    const root = initRoot('archived-pending');
    fs.writeFileSync(tw(root, 'proposals.md'), `${PROPOSAL}\n### P-002 - Keep helpers small\nkind: heuristic\nconfidence: high\nevidence: ledger 5e6f7a8b\nchange: Keep helpers small.\n`);
    const pending = (id) => new RegExp(`^### ${id} `, 'm').test(read(tw(root, 'proposals.md')));
    const changeOf = (s) => count(read(tw(root, 'judgment.md')), new RegExp(`^- ${s}$`, 'gm'));
    const savedRename = fs.renameSync;
    let failed = false;
    fs.renameSync = (from, to, ...a) => {
      if (!failed && path.basename(String(to)) === 'judgment.md') { failed = true; throw errno('EIO'); }
      return savedRename.call(fs, from, to, ...a);
    };
    let first;
    try {
      first = run('proposals', root, ['apply', '--accept', 'P-001']);
    } finally {
      fs.renameSync = savedRename;
    }
    must(failed && first.code === 2 && entryComplete(root), `the first apply did not stop after its archive write: exit ${first.code}: ${first.all}`);
    const other = run('proposals', root, ['apply', '--accept', 'P-002'], undefined, at(5));
    must(other.code === 0 && other.out.includes('P-002 applied'), `apply of P-002: exit ${other.code}: ${other.all}`);
    must(pending('P-001'), 'P-001 left twin/proposals.md while its change was not in judgment.md');
    must(changeOf('Name helpers by what they return\\.') === 0, 'P-001 was applied by the apply of P-002');
    const retry = run('proposals', root, ['apply', '--accept', 'P-001'], undefined, at(10));
    must(retry.code === 0 && retry.out.includes('P-001 applied'), `the retry did not apply P-001: exit ${retry.code}: ${retry.all}`);
    must(changeOf('Name helpers by what they return\\.') === 1 && changeOf('Keep helpers small\\.') === 1, `expected each change once: P-001 ${changeOf('Name helpers by what they return\\.')}, P-002 ${changeOf('Keep helpers small\\.')}`);
    must(!pending('P-001') && !pending('P-002'), 'a proposal is still pending after it was applied');
  });
}

function setupCases() {
  test('setup: init refuses before writing anything when twin/.gitignore is a hard link (exit 2, no other twin/ file made)', () => {
    const root = sandbox('init-hardlink');
    fs.mkdirSync(path.join(root, 'twin'));
    const outside = path.join(tempDir('init-hardlink-target'), 'gi');
    fs.writeFileSync(outside, '*.log\n');
    fs.linkSync(outside, tw(root, '.gitignore'));
    const r = run('setup', root, ['init']);
    must(r.code === 2 && /\.gitignore/.test(r.all), `exit ${r.code}: ${r.all}`);
    const left = fs.readdirSync(path.join(root, 'twin'));
    must(left.length === 1 && left[0] === '.gitignore', `init wrote before refusing: ${left.join(', ')}`);
  });
  test('setup: answers keeps the permission bits of the twin/stage.md it replaces (0600 stays 0600)', () => {
    if (process.platform === 'win32') throw new Skip('this system has no POSIX permission bits');
    const root = initRoot('mode');
    fs.chmodSync(tw(root, 'stage.md'), 0o600);
    const r = run('setup', root, ['answers'], JSON.stringify({ stage: 'launch' }));
    must(r.code === 0, `exit ${r.code}: ${r.all}`);
    const mode = fs.statSync(tw(root, 'stage.md')).mode & 0o777;
    must(mode === 0o600, `twin/stage.md came back ${mode.toString(8)}`);
  });
  test('setup: replacing a 0600 twin/stage.md never creates its temporary copy readable by group or others', () => {
    if (process.platform === 'win32') throw new Skip('this system has no POSIX permission bits');
    const root = initRoot('temp-mode');
    fs.chmodSync(tw(root, 'stage.md'), 0o600);
    const savedOpen = fs.openSync;
    const modes = [];
    fs.openSync = (p, flags, mode, ...a) => {
      const fd = savedOpen.call(fs, p, flags, mode, ...a);
      if (/^\.stage\.md\.[0-9a-f]+\.tmp$/.test(path.basename(String(p)))) modes.push({ asked: mode, made: fs.fstatSync(fd).mode & 0o777 });
      return fd;
    };
    let r;
    try {
      r = run('setup', root, ['answers'], JSON.stringify({ stage: 'launch' }));
    } finally {
      fs.openSync = savedOpen;
    }
    must(r.code === 0 && modes.length === 1, `exit ${r.code}, ${modes.length} temporary files seen: ${r.all}`);
    must((modes[0].asked & 0o077) === 0 && (modes[0].made & 0o077) === 0, `the temporary copy was created with mode ${modes[0].made.toString(8)} (asked ${Number(modes[0].asked).toString(8)})`);
  });
}

function docCases() {
  const md = read(path.join(TEMPLATES, 'formats.md')).replace(/\r\n?/g, '\n');
  const one = md.replace(/\s+/g, ' ');
  test('docs: formats.md says the inbox step reads .claude/agents/twin.md and uses the shipped read list only when that file does not exist', () => {
    const input = one.slice(one.indexOf('## Input files'), one.indexOf('## Verdict reply'));
    must(/It also reads `\.claude\/agents\/twin\.md`/.test(input), 'Input files does not say the inbox step reads .claude/agents/twin.md');
    must(/Only when `\.claude\/agents\/twin\.md` does not exist/.test(input), 'Input files does not say when the shipped read list is used');
  });
  test('docs: formats.md says answers and complete rewrite the whole file and redact it', () => {
    const row = (cmd) => md.split('\n').find((l) => l.startsWith(`| \`${cmd}\` |`)) || '';
    must(/rewritten whole and redacted whole/.test(row('answers')), 'the answers row does not say the file is rewritten and redacted whole');
    must(/rewrites the whole file and redacts it whole/.test(row('complete')), 'the complete row does not say the file is rewritten and redacted whole');
  });
  test('docs: formats.md says what an exit 2 leaves on disk, naming the commands that can stop part way', () => {
    must(!/\|\s*2\s*\|[^\n]*nothing was written/.test(md), 'the exit-code table says exit 2 means nothing was written');
    const s = one.slice(one.indexOf('What exit 2 leaves behind'), one.indexOf('## Input files'));
    for (const cmd of ['`setup.js init`', '`setup.js answers`', '`proposals.js apply`']) must(s.includes(cmd), `it does not name ${cmd}`);
  });
}

// ------------------------------------------------------------------ the run

function main() {
  installCases();
  if (mods) {
    for (const g of [endToEndCases, inboxCases, proposalCases, setupCases]) {
      try {
        g();
      } catch (e) {
        test(`${g.name}: the group ran to the end`, () => { throw e; });
      }
    }
  }
  docCases();
  for (const d of SANDBOXES) {
    try {
      fs.rmSync(d, { recursive: true, force: true, maxRetries: 3 });
    } catch (e) {
      /* best effort */
    }
  }
  console.log(`${nOk} ok / ${nFail} FAIL${nSkip ? ` / ${nSkip} SKIP` : ''}`);
  return nFail ? 1 : 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { INSTALLED };
