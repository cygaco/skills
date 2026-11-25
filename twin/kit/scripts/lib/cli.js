'use strict';
/*
 * lib/cli.js: what every twin script shares on the command line.
 *
 *   - the io object: { cwd, selfDir, out, err, readStdin, now, env, homedir }. The real
 *     command line builds it from the process; scripts/check.js passes its own, with fake
 *     stdin, a sandbox cwd, captured output, an empty environment and a sandbox home
 *     folder, so it can call main(argv, io) in-process without touching your own files;
 *   - the root check: the repository root is the current folder, and it must be the
 *     folder whose .claude/twin/scripts/ holds the running script. .claude, .claude/twin
 *     and .claude/twin/scripts are each looked at with lstat first, top down, and a link
 *     or junction at any of them is a refusal, before anything is looked up through it;
 *   - strict flags: an unknown flag or a stray argument is a usage error (exit 2);
 *   - text input: one JSON object, from --file <inbox file> (Claude runs ledger.js inbox,
 *     which creates a new twin/inbox-<8 hex>.json and prints its path, then writes that
 *     file with its own file-writing tool) or from stdin, never the command line and never
 *     through a shell (templates/formats.md, "Input files"). A script reads an inbox file
 *     once and then deletes it, whether or not the input was valid, so each input is
 *     read against its own text and does not stay on disk. --file takes nothing else:
 *     any other path is refused by its text alone (exit 2), with no file-system call on
 *     it, so it is never looked at, read or deleted;
 *   - output: every line a script prints goes through the redactor here, once, so no
 *     message, label, path or echoed argument can print a secret or an email address.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Refusal, lstatOrNull, linkOnWay, normalizeText, stripBom, readFileChecked, inboxFileOf, removeInbox, realTwin } = require('./fsx');
const { redactKeeping, clip } = require('./redact');

const EXIT = { OK: 0, PROBLEMS: 1, REFUSED: 2, ASK: 3 };
const MAX_INPUT = 1024 * 1024;
const NOT_ROOT = "run this from your repository's root folder (the folder that holds .claude/twin/)";

function sleepMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) {
    /* best effort */
  }
}

// Reads all of stdin synchronously. Returns null when stdin is a terminal (no input).
function readStdinSync() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  const buf = Buffer.alloc(65536);
  let total = 0;
  let waits = 0;
  for (;;) {
    let n;
    try {
      n = fs.readSync(0, buf, 0, buf.length, null);
    } catch (e) {
      if (e.code === 'EAGAIN' && waits++ < 2000) {
        sleepMs(5);
        continue;
      }
      if (e.code === 'EOF' || e.code === 'EAGAIN') break;
      throw e;
    }
    if (n === 0) break;
    total += n;
    if (total > MAX_INPUT) throw new Refusal('the input is larger than 1 MB');
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function cliIo(selfDir) {
  return {
    cwd: process.cwd(),
    selfDir,
    out: (s) => process.stdout.write(`${s}\n`),
    err: (s) => process.stderr.write(`${s}\n`),
    readStdin: readStdinSync,
    now: () => new Date(),
    env: process.env,
    homedir: () => os.homedir(),
  };
}

// Fills in what a caller left out. An in-process caller passes stdin as a string. Every line
// printed through io.out or io.err is redacted here.
function normIo(io, selfDir) {
  const o = Object.assign({}, io || {});
  if (!o.cwd) o.cwd = process.cwd();
  if (!o.selfDir) o.selfDir = selfDir;
  const rawOut = typeof o.out === 'function' ? o.out : () => {};
  const rawErr = typeof o.err === 'function' ? o.err : () => {};
  // o.keep: literal strings (only the computed chat-history folder) that skip the long-run
  // rule, so the folder you are asked to confirm is shown in full.
  if (!Array.isArray(o.keep)) o.keep = [];
  o.out = (s) => rawOut(redactKeeping(String(s), o.keep));
  o.err = (s) => rawErr(redactKeeping(String(s), o.keep));
  if (typeof o.readStdin !== 'function') {
    const s = o.stdin;
    o.readStdin = () => (typeof s === 'string' ? s : null);
  }
  if (typeof o.now !== 'function') o.now = () => new Date();
  // An in-process caller gets an empty environment unless it passes one.
  if (!o.env || typeof o.env !== 'object') o.env = {};
  if (typeof o.homedir !== 'function') o.homedir = () => os.homedir();
  return o;
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// True when io.cwd/.claude/twin/scripts is the folder the running script lives in. The
// parts from io.cwd down to it are walked with lstat first (fsx.linkOnWay): a link there
// is a Refusal, and nothing is looked up through it.
function atRoot(io) {
  const scripts = path.join(io.cwd, '.claude', 'twin', 'scripts');
  let stop;
  try {
    stop = linkOnWay(io.cwd, scripts);
  } catch (e) {
    return false;
  }
  if (stop && stop.kind === 'link') {
    throw new Refusal(`${path.relative(path.resolve(io.cwd), stop.at).split(path.sep).join('/')} is a link; refusing to run through it (copy the kit to .claude/twin/ as a real folder)`);
  }
  if (stop) return false;
  try {
    const expected = fs.realpathSync.native(scripts);
    const actual = fs.realpathSync.native(io.selfDir);
    return samePath(expected, actual);
  } catch (e) {
    return false;
  }
}

/*
 * parseFlags(argv, spec) -> { flags, pos, error }
 *   spec.value: flags that take one value ('--file')
 *   spec.multi: flags that take a value and may repeat
 *   spec.bool:  flags without a value ('--apply')
 *   spec.maxPos: how many positional arguments are allowed (default 0)
 */
function parseFlags(argv, spec) {
  const flags = {};
  const pos = [];
  const value = new Set(spec.value || []);
  const multi = new Set(spec.multi || []);
  const bool = new Set(spec.bool || []);
  for (const m of multi) flags[m] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (value.has(a) || multi.has(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { flags, pos, error: `${a} needs a value` };
      if (multi.has(a)) flags[a].push(v);
      else if (Object.prototype.hasOwnProperty.call(flags, a)) return { flags, pos, error: `${a} given twice` };
      else flags[a] = v;
      i++;
    } else if (bool.has(a)) {
      flags[a] = true;
    } else if (a.startsWith('-')) {
      return { flags, pos, error: `unknown option: ${a}` };
    } else {
      pos.push(a);
    }
  }
  const maxPos = spec.maxPos || 0;
  if (pos.length > maxPos) return { flags, pos, error: `unexpected argument: ${tidyArg(pos[maxPos])} (text goes in a JSON file passed with --file, never on the command line)` };
  return { flags, pos, error: null };
}

// An argument for a message: redacted first, then cut to 40 characters (lib/redact.js clip).
function tidyArg(s) {
  return clip(String(s), 40);
}

function wantsHelp(argv) {
  return argv.includes('--help') || argv.includes('-h');
}

const INPUT_HINT = 'run node .claude/twin/scripts/ledger.js inbox, write the input as one JSON object to the inbox file it prints and pass --file with that path (see .claude/twin/templates/formats.md, "Input files")';

// Deletes an inbox file after a script read it (or refused it), so the text does not
// stay on disk. A failure is only a warning: the input itself was handled.
function dropInbox(io, root, abs, realDir) {
  try {
    removeInbox(root, abs, realDir);
  } catch (e) {
    // Fail closed: the one-time inbox file was read but could not be deleted, so its
    // plaintext input may still be on disk. Tell the caller to ask the user (next: ask)
    // and refuse (exit 2); never let a command go on to print next: act.
    io.out('next: ask');
    throw new Refusal(`twin/${path.basename(abs)} was read but could not be deleted (${e && e.message ? e.message : String(e)}); its plaintext input may still be on disk, so ask the user instead of acting, then remove the file by hand`);
  }
}


// An inbox file (twin/inbox-<8 hex>.json, fsx.inboxFileOf): twin/ must be a real folder
// inside the repository (else a refusal, and nothing is read or deleted). The file is
// read once through a checked descriptor, then deleted, whether or not its input was
// valid; a second read of the same path finds nothing.
function readInboxFile(io, root, fileFlag, abs) {
  const realDir = realTwin(root);
  try {
    const st = lstatOrNull(abs);
    if (!st) throw new Refusal(`--file not found: ${tidyArg(fileFlag)} (an inbox file is read once and then deleted; run node .claude/twin/scripts/ledger.js inbox for a new one)`);
    if (st.isSymbolicLink()) throw new Refusal(`--file is a link: ${tidyArg(fileFlag)}`);
    if (!st.isFile()) throw new Refusal(`--file is not a regular file: ${tidyArg(fileFlag)}`);
    return readFileChecked(abs, `--file ${tidyArg(fileFlag)}`, { max: MAX_INPUT, maxText: '1 MB' });
  } finally {
    dropInbox(io, root, abs, realDir);
  }
}

// The raw input for a command: --file <inbox file>, or stdin. The BOM is dropped. An
// inbox file is read once and deleted. Any other --file path is refused by its text
// (fsx.inboxFileOf compares names only), before any file-system call on it.
function readRawInput(io, root, fileFlag) {
  if (fileFlag !== undefined) {
    const inbox = inboxFileOf(root, fileFlag);
    if (!inbox) throw new Refusal(`--file takes only an inbox file, twin/inbox-<8 hex>.json, not ${tidyArg(fileFlag)}: ${INPUT_HINT}`);
    return stripBom(readInboxFile(io, root, fileFlag, inbox).toString('utf8'));
  }
  const t = io.readStdin();
  if (t === null || t === undefined) throw new Refusal(`no input: ${INPUT_HINT}`);
  if (Buffer.byteLength(t, 'utf8') > MAX_INPUT) throw new Refusal('the input is larger than 1 MB');
  return stripBom(t);
}

/*
 * readJsonInput(io, root, fileFlag, keys) -> the JSON object
 *   keys: the exact keys it must have, each a string (its line ends become LF);
 *   null: any one JSON object (setup.js answers checks its own keys).
 *   A missing key, an unknown key, a value that is not a string, or text that is not one
 *   JSON object is refused (exit 2), before anything is written.
 */
function readJsonInput(io, root, fileFlag, keys) {
  const text = readRawInput(io, root, fileFlag);
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Refusal(`the input is not valid JSON: ${INPUT_HINT}`);
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Refusal(`the input must be one JSON object: ${INPUT_HINT}`);
  if (!keys) return obj;
  const out = {};
  for (const k of Object.keys(obj)) if (!keys.includes(k)) throw new Refusal(`unknown key: ${tidyArg(k)} (the keys are ${keys.join(', ')})`);
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) throw new Refusal(`missing key: ${k} (the keys are ${keys.join(', ')})`);
    if (typeof obj[k] !== 'string') throw new Refusal(`${k} must be a string`);
    out[k] = normalizeText(obj[k]);
  }
  return out;
}

function isoNow(io) {
  return io.now().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Runs a command body and turns a Refusal (or any error) into exit 2.
function guarded(io, fn) {
  try {
    return fn();
  } catch (e) {
    if (e && e.refusal) {
      io.err(`refused: ${e.message}`);
      return EXIT.REFUSED;
    }
    io.err(`error: ${e && e.message ? e.message : String(e)}`);
    return EXIT.REFUSED;
  }
}

module.exports = {
  EXIT,
  MAX_INPUT,
  NOT_ROOT,
  cliIo,
  normIo,
  atRoot,
  parseFlags,
  wantsHelp,
  readJsonInput,
  readRawInput,
  INPUT_HINT,
  isoNow,
  guarded,
  tidyArg,
};
