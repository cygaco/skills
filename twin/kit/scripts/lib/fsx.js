'use strict';
/*
 * lib/fsx.js: confinement, safe reads and safe writes for the twin scripts.
 *
 * Every write goes to a path inside the repository root, never through a link (a linked
 * folder on the way, or a linked target) and never through a hard link (a target with
 * more than one link). Text is written as UTF-8 without a BOM, with \n line ends.
 *
 *   - Paths (linkOnWay): a path is walked top down, one part at a time, with lstat, and
 *     the walk stops at the first part that is a link or a junction, so nothing is ever
 *     looked up, listed or opened through a link on the way. A file inside the repository
 *     is walked from the root down; the chat-history folder (lib/transcripts.js) from the
 *     top of the file system down.
 *   - Reads (readFileChecked, readTextOrNull): given the root (opts.base, or base), each
 *     folder from the root down to the file is walked first, and a link there is a
 *     refusal. Then the file is looked at (it must be a regular file, not a link, with
 *     one hard link), then opened through a descriptor, without following a link where
 *     the system allows it, and the descriptor must point at the same file (device and
 *     inode) that was looked at.
 *   - Whole-file writes (atomicWrite): a temp file is created next to the target, inside
 *     the same folder, exclusively; the folder's real path is checked again just before
 *     the temp file is created and again just before it is renamed into place. When the
 *     target exists, the temp file is created with its permission bits (not on Windows).
 *   - Appends (appendText, appendLine): the file is opened once, its identity checked as
 *     for a read, and the text written through that descriptor.
 *   - Inbox files (newInbox, inboxFileOf, removeInbox): twin/ must be a real folder
 *     inside the repository, and each file the twin agent reads there (TWIN_READS:
 *     judgment.md, policy.md, stage.md, ledger.jsonl) absent or a regular file, not a
 *     link, with one hard link; and every entry in twin/, whatever its name, a regular
 *     file (no link, junction or folder), each looked at with lstat only. Each input gets its own new file, twin/inbox-<8 random hex>.json, created
 *     empty and exclusively, so no link can be waiting at its path.
 *     A script reads it once through a checked descriptor and then deletes it by its
 *     name (which never touches what a link points to), only while twin/ is still the
 *     same real folder.
 *
 * Limit (stated in templates/formats.md): a program running as you that swaps a folder
 * or a file while a script runs can still redirect a read or a write in the moment
 * between the last check and the open, most easily on Windows, where Node cannot refuse
 * a link when it opens a file. Such a program could equally edit the kit itself.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { INBOX_IGNORE } = require('./formats');

const C = fs.constants;
// O_NOFOLLOW where the system has it (not on Windows); 0 otherwise.
const NOFOLLOW = typeof C.O_NOFOLLOW === 'number' ? C.O_NOFOLLOW : 0;

class Refusal extends Error {
  constructor(message) {
    super(message);
    this.refusal = true;
  }
}

/*
 * For tests only: a function called at the moments between a check and the
 * operation it protects ('open', 'write', 'rename', 'create', 'append', and
 * 'inbox-create' before an inbox file is made), so a
 * test can swap a file or a folder there and prove the next check notices. Nothing
 * on the command line can set it.
 */
let raceHook = null;
function setRaceHook(fn) {
  raceHook = typeof fn === 'function' ? fn : null;
}
function race(stage, abs) {
  if (raceHook) raceHook(stage, abs);
}

function inside(root, p) {
  const rel = path.relative(path.resolve(root), path.resolve(p));
  if (rel === '') return true;
  if (path.isAbsolute(rel)) return false;
  return rel !== '..' && !rel.startsWith('..' + path.sep);
}

function realpathOrNull(p) {
  try {
    return fs.realpathSync.native(p);
  } catch (e) {
    return null;
  }
}

function samePath(a, b) {
  return process.platform === 'win32' ? String(a).toLowerCase() === String(b).toLowerCase() : a === b;
}

// True when p exists and its real path is inside the real path of root.
function realInside(root, p) {
  const r = realpathOrNull(root);
  const q = realpathOrNull(p);
  return Boolean(r && q && inside(r, q));
}

function lstatOrNull(p, big) {
  try {
    return big ? fs.lstatSync(p, { bigint: true }) : fs.lstatSync(p);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}

function show(root, abs) {
  const rel = path.relative(root, abs);
  return rel ? rel.split(path.sep).join('/') : '.';
}

/*
 * The first part of abs, below base, that stops a walk down from base, or null. Each part
 * (abs itself included) is looked at with lstat, one at a time, top down, and nothing is
 * looked at below a part that is a link or a junction, is missing, or (above abs) is not
 * a folder: { at, kind: 'link' | 'missing' | 'not-folder' }. null: every part is there, no
 * part is a link, and every part above abs is a folder. base itself is not looked at;
 * abs must be base or inside it, compared as text (a Refusal otherwise). Errors other
 * than a missing part (a permission error) are thrown as they are.
 */
function linkOnWay(base, abs) {
  const b = path.resolve(base);
  const a = path.resolve(abs);
  if (!inside(b, a)) throw new Refusal(`${a} is not inside ${b}`);
  const rel = path.relative(b, a);
  if (!rel) return null;
  const parts = rel.split(path.sep);
  let cur = b;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    const st = lstatOrNull(cur);
    if (!st) return { at: cur, kind: 'missing' };
    if (st.isSymbolicLink()) return { at: cur, kind: 'link' };
    if (i < parts.length - 1 && !st.isDirectory()) return { at: cur, kind: 'not-folder' };
  }
  return null;
}

// The folders from base down to the folder that holds abs, walked with linkOnWay: a link
// there is a Refusal; true when they are all real folders, false when one is missing or
// is not a folder (so abs cannot exist). abs itself is left to the caller's own lstat.
function foldersOnWay(base, abs, label) {
  const stop = linkOnWay(base, path.dirname(path.resolve(abs)));
  if (!stop) return true;
  if (stop.kind === 'link') throw new Refusal(`${show(path.resolve(base), stop.at)} is a link; refusing to look through it (${label || path.basename(abs)} sits under it)`);
  return false;
}

// Drops a leading byte-order mark (code point FEFF).
function stripBom(s) {
  const t = String(s);
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

function normalizeText(s) {
  return stripBom(s).replace(/\r\n?/g, '\n');
}

const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;

function closeQuietly(fd) {
  try {
    fs.closeSync(fd);
  } catch (e) {
    /* already closed */
  }
}

/*
 * Opens abs (flags from fs.constants) and checks it is the file it looked at: a regular
 * file, not a link, with one hard link, the same device and inode before and after the
 * open. A file that does not exist yet is created only with O_EXCL, so the open cannot
 * follow a link planted in the meantime. Returns the descriptor.
 */
function openChecked(abs, flags, label) {
  const what = label || path.basename(abs);
  const before = lstatOrNull(abs, true);
  if (before) {
    if (before.isSymbolicLink()) throw new Refusal(`${what} is a link; refusing to follow it`);
    if (!before.isFile()) throw new Refusal(`${what} is not a regular file`);
    if (before.nlink > 1n) throw new Refusal(`${what} has more than one hard link; refusing to use it`);
  } else if (!(flags & C.O_CREAT)) {
    const e = new Error(`${what} not found`);
    e.code = 'ENOENT';
    throw e;
  }
  race('open', abs);
  const f = before ? flags & ~C.O_CREAT & ~C.O_EXCL : flags | C.O_CREAT | C.O_EXCL;
  let fd;
  try {
    fd = fs.openSync(abs, f | NOFOLLOW, 0o666);
  } catch (e) {
    if (e.code === 'ELOOP' || e.code === 'EMLINK') throw new Refusal(`${what} is a link; refusing to follow it`);
    if (e.code === 'EEXIST') throw new Refusal(`${what} appeared while it was being created; nothing was written`);
    throw e;
  }
  try {
    const st = fs.fstatSync(fd, { bigint: true });
    if (!st.isFile()) throw new Refusal(`${what} is not a regular file`);
    if (st.nlink > 1n) throw new Refusal(`${what} has more than one hard link; refusing to use it`);
    if (before && !sameFile(before, st)) throw new Refusal(`${what} changed while it was being opened; refusing to use it`);
    return fd;
  } catch (e) {
    closeQuietly(fd);
    throw e;
  }
}

/*
 * Reads a whole file through a checked descriptor. Returns a Buffer. opts.max: refuse
 * a file larger than this many bytes (checked on the open descriptor). opts.base: the
 * root the file is inside; every folder from it down to the file is walked first
 * (foldersOnWay), and a link there is a Refusal.
 */
function readFileChecked(abs, label, opts) {
  const o = opts || {};
  if (o.base !== undefined && !foldersOnWay(o.base, abs, label)) {
    const e = new Error(`${label || path.basename(abs)} not found`);
    e.code = 'ENOENT';
    throw e;
  }
  const fd = openChecked(abs, C.O_RDONLY, label);
  try {
    if (o.max !== undefined) {
      const st = fs.fstatSync(fd);
      if (st.size > o.max) throw new Refusal(`${label || path.basename(abs)} is larger than ${o.maxText || `${o.max} bytes`}`);
    }
    return fs.readFileSync(fd);
  } finally {
    closeQuietly(fd);
  }
}

// The file's text (BOM dropped, \n line ends), or null when it does not exist. base: the
// root the file is inside; every folder from it down to the file is walked first, and a
// link there is a Refusal (nothing is looked at through it).
function readTextOrNull(abs, label, base) {
  if (base !== undefined && !foldersOnWay(base, abs, label)) return null;
  if (!lstatOrNull(abs)) return null;
  try {
    return normalizeText(readFileChecked(abs, label).toString('utf8'));
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}

// Throws a Refusal unless writing abs is safe: inside root, no linked folder on the way
// down from root, and the target (if it exists) a regular file with one link.
function assertSafeTarget(root, abs) {
  const r = path.resolve(root);
  const a = path.resolve(abs);
  if (a === r || !inside(r, a)) throw new Refusal(`refusing to write outside the repository: ${a}`);
  const parts = path.relative(r, a).split(path.sep);
  let cur = r;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = path.join(cur, parts[i]);
    const st = lstatOrNull(cur);
    if (!st) break;
    if (st.isSymbolicLink()) throw new Refusal(`${show(r, cur)} is a symlink; refusing to write through it`);
    if (!st.isDirectory()) throw new Refusal(`${show(r, cur)} is not a folder`);
  }
  const st = lstatOrNull(a);
  if (st) {
    if (st.isSymbolicLink()) throw new Refusal(`${show(r, a)} is a symlink; refusing to write through it`);
    if (!st.isFile()) throw new Refusal(`${show(r, a)} is not a regular file`);
    if (st.nlink > 1) throw new Refusal(`${show(r, a)} has more than one hard link; refusing to write through it`);
  }
}

// The real path of the folder abs is written into, which must sit inside the real root.
function realFolderOf(root, abs) {
  const dir = path.dirname(path.resolve(abs));
  const real = realpathOrNull(dir);
  const realRoot = realpathOrNull(root);
  if (!real || !realRoot || !inside(realRoot, real)) throw new Refusal(`${show(root, dir)} is not a folder inside the repository`);
  return real;
}

// Checked again just before a temp file is created, renamed or a file opened: the folder
// on the way is still no link, and still the same real folder.
function recheck(root, abs, realDir) {
  assertSafeTarget(root, abs);
  const now = realpathOrNull(path.dirname(path.resolve(abs)));
  if (!now || !samePath(now, realDir)) throw new Refusal(`${show(root, path.dirname(path.resolve(abs)))} changed while writing; refusing to write through it`);
}

function sleepMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) {
    /* best effort */
  }
}

function renameWithRetry(from, to) {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      const busy = e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'EBUSY';
      if (!busy || i >= 10) throw e;
      sleepMs(25);
    }
  }
}

function writeAll(fd, buf) {
  let off = 0;
  while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
}

// The permission bits a replacement gets before it is renamed over abs: those of abs when
// it is a regular file (so a 0600 file stays 0600), or null when abs does not exist yet or
// on Windows, where a file has no POSIX permission bits to keep (its ACL is not copied).
function keptMode(abs) {
  if (process.platform === 'win32') return null;
  const st = lstatOrNull(abs);
  return st && st.isFile() ? st.mode & 0o777 : null;
}

// Whole-file write: temp file in the same folder, then rename. opts.raw keeps the
// text byte for byte (used for CLAUDE.md, whose line ends are the user's). When abs
// exists, the temp file is created with its permission bits (keptMode), so the temp copy is
// never readable by more accounts than the file it replaces, and set to exactly those bits
// after the write (the umask can only have removed some at the create).
function atomicWrite(root, abs, text, opts) {
  assertSafeTarget(root, abs);
  const data = Buffer.from(opts && opts.raw ? String(text) : normalizeText(text), 'utf8');
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  const realDir = realFolderOf(root, abs);
  race('write', abs);
  recheck(root, abs, realDir);
  const tmp = path.join(dir, `.${path.basename(abs)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  let created = false;
  try {
    const mode = keptMode(abs);
    const fd = fs.openSync(tmp, C.O_WRONLY | C.O_CREAT | C.O_EXCL | NOFOLLOW, mode === null ? 0o666 : mode);
    created = true;
    try {
      writeAll(fd, data);
      if (mode !== null) fs.fchmodSync(fd, mode);
    } finally {
      closeQuietly(fd);
    }
    race('rename', abs);
    recheck(root, abs, realDir);
    renameWithRetry(tmp, abs);
  } catch (e) {
    if (created) {
      try {
        fs.unlinkSync(tmp);
      } catch (e2) {
        /* already gone, or the folder moved */
      }
    }
    throw e;
  }
}

// Create a new file; fails if it already exists.
function createFile(root, abs, text) {
  assertSafeTarget(root, abs);
  const realDir = realFolderOf(root, abs);
  race('create', abs);
  recheck(root, abs, realDir);
  let fd;
  try {
    fd = fs.openSync(abs, C.O_WRONLY | C.O_CREAT | C.O_EXCL | NOFOLLOW, 0o666);
  } catch (e) {
    if (e.code === 'EEXIST') throw new Refusal(`${show(root, abs)} already exists`);
    throw e;
  }
  try {
    writeAll(fd, Buffer.from(normalizeText(text), 'utf8'));
  } finally {
    closeQuietly(fd);
  }
}

// Append one line. A file whose last byte is not \n gets a \n first. One open.
function appendLine(root, abs, line) {
  const s = String(line);
  let e = s.length;
  while (e > 0 && s.charCodeAt(e - 1) === 10) e--;
  appendText(root, abs, `${s.slice(0, e)}\n`);
}

function appendText(root, abs, text) {
  assertSafeTarget(root, abs);
  const realDir = realFolderOf(root, abs);
  race('append', abs);
  recheck(root, abs, realDir);
  const fd = openChecked(abs, C.O_RDWR | C.O_APPEND | C.O_CREAT, show(root, abs));
  try {
    const st = fs.fstatSync(fd);
    let prefix = '';
    if (st.size > 0) {
      const b = Buffer.alloc(1);
      fs.readSync(fd, b, 0, 1, st.size - 1);
      if (b[0] !== 0x0a) prefix = '\n';
    }
    writeAll(fd, Buffer.from(prefix + normalizeText(text), 'utf8'));
  } finally {
    closeQuietly(fd);
  }
}

// ------------------------------------------------------------------ inbox files

// One inbox file per input: twin/inbox-<8 random hex>.json (templates/formats.md, "Input
// files").
const INBOX_NAME = /^inbox-[0-9a-f]{8}\.json$/;

// The real path of twin/, which must be a real folder (not a link) whose real path sits
// inside the real root; a Refusal otherwise.
function realTwin(root) {
  const r = path.resolve(root);
  const dir = path.join(r, 'twin');
  const st = lstatOrNull(dir);
  if (!st) throw new Refusal('twin/ not found: run node .claude/twin/scripts/setup.js init first');
  if (st.isSymbolicLink()) throw new Refusal('twin is a link; refusing to use it (make twin/ a real folder)');
  if (!st.isDirectory()) throw new Refusal('twin exists and is not a folder');
  const real = realpathOrNull(dir);
  const realRoot = realpathOrNull(r);
  if (!real || !realRoot || !inside(realRoot, real) || samePath(real, realRoot)) throw new Refusal('twin/ is not a real folder inside the repository');
  return real;
}

// The absolute path of the inbox file a --file value names, or null: a name
// inbox-<8 lowercase hex>.json directly in twin/ of root, compared as text (nothing is
// looked up). Any other --file path is refused (lib/cli.js), on this text alone.
function inboxFileOf(root, given) {
  const abs = path.resolve(root, String(given));
  if (!samePath(path.dirname(abs), path.join(path.resolve(root), 'twin'))) return null;
  return INBOX_NAME.test(path.basename(abs)) ? abs : null;
}

// The files in twin/ the twin agent is told to read on every call (agent/twin.md, "On
// every call, read these first"). The inbox step checks each of them, so the agent's own
// reads never go through a link.
const TWIN_READS = ['judgment.md', 'policy.md', 'stage.md', 'ledger.jsonl'];

// A Refusal naming the first of TWIN_READS that is there but is not a regular file with
// one hard link (a link, a junction, a folder or a hard link). Each is looked at with
// lstat only, so nothing is followed, listed or opened; an absent file is fine.
function checkTwinReads(root) {
  const dir = path.join(path.resolve(root), 'twin');
  for (const name of TWIN_READS) {
    const st = lstatOrNull(path.join(dir, name));
    if (!st) continue;
    const why = st.isSymbolicLink() ? 'is a link or a junction' : !st.isFile() ? 'is not a regular file' : st.nlink > 1 ? 'has more than one hard link' : null;
    if (why) throw new Refusal(`twin/${name} ${why}; refusing to make an inbox file, because the twin agent reads twin/${name} (make it a regular file with one hard link)`);
  }
}

// A name from a folder listing as it is printed: printable ASCII as it is, any other
// character as \uXXXX, so a name can never add a line or hide in the output.
const shownName = (name) => String(name).replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// A Refusal naming the first entry directly in twin/ (sorted by name) that is not a
// regular file: a link, a junction, a folder (or a device or pipe), whatever its name.
// The twin agent can read or search anything in twin/, so nothing in it may lead
// through a link or into a folder. twin/ itself is listed (realTwin has already checked
// it is a real folder), and each entry is looked at with lstat only: nothing in it is
// followed, listed or opened. No script makes a folder inside twin/, so none is allowed.
// (The hard-link check is for the files the agent reads, checkTwinReads.)
function checkTwinEntries(root) {
  const dir = path.join(path.resolve(root), 'twin');
  for (const name of fs.readdirSync(dir).sort()) {
    const st = lstatOrNull(path.join(dir, name));
    if (!st) continue;
    const why = st.isSymbolicLink() ? 'is a link or a junction' : st.isDirectory() ? 'is a folder' : !st.isFile() ? 'is not a regular file' : null;
    if (why) throw new Refusal(`twin/${shownName(name)} ${why}; refusing to make an inbox file, because the twin agent can read anything in twin/ (keep only regular files in twin/, no link, junction or folder)`);
  }
}

// The files the twin agent is told to read on every call, DERIVED from the installed
// agent file (.claude/agents/twin.md, "On every call, read these first"), as repo-relative
// POSIX paths. The root CLAUDE.md is one of them, so a link planted there is refused by the
// inbox step too, not only links inside twin/. The built-in default below (the files the
// agent ships with) is used only when the agent file does not exist (agentReads); an agent
// file that is there but has no read list in that section is a Refusal.
const DEFAULT_AGENT_READS = ['twin/judgment.md', 'twin/policy.md', 'twin/stage.md', 'CLAUDE.md', 'twin/ledger.jsonl'];
const READS_HEADING = '## On every call, read these first';
const NO_READS = `.claude/agents/twin.md has no "${READS_HEADING}" section with a numbered list of files; refusing to make an inbox file (reinstall the pack, or restore that section)`;

function deriveAgentReads(agentText) {
  if (agentText === null || agentText === undefined) return DEFAULT_AGENT_READS.slice();
  const lines = String(agentText).replace(/\r\n?/g, '\n').split('\n');
  let i = lines.findIndex((l) => /^##\s+On every call, read these first\b/i.test(l.trim()));
  if (i < 0) throw new Refusal(NO_READS);
  const out = [];
  for (i++; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s/.test(l)) break;
    if (!/^\s*\d+\.\s/.test(l)) continue;
    const b = /`([^`]+)`/.exec(l);
    if (!b) continue;
    const p = b[1].trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!p || /\s/.test(p) || p.indexOf('..') >= 0) continue;
    if (out.indexOf(p) < 0) out.push(p);
  }
  if (!out.length) throw new Refusal(NO_READS);
  if (!out.some((p) => p.toLowerCase() === 'claude.md')) out.push('CLAUDE.md');
  return out;
}

// The read list the inbox step guards, derived from the installed agent file under root.
// The built-in default is used only when the agent file is truly absent: .claude and
// .claude/agents each absent or a real folder, and the file itself not found (ENOENT).
// Everything else is a Refusal (or the error itself), so newInbox halts (exit 2) instead
// of reading the default list: .claude or .claude/agents a link, a junction or anything
// that is not a folder (a regular file there gives ENOTDIR, never "absent"); the agent file
// a link, a junction, a hard link, unreadable or not a regular file; or an agent file with
// no read list in its "On every call, read these first" section (deriveAgentReads).
function agentReads(root) {
  const r = path.resolve(root);
  let dir = r;
  for (const part of ['.claude', 'agents']) {
    dir = path.join(dir, part);
    let st;
    try {
      st = fs.lstatSync(dir);
    } catch (e) {
      if (e.code === 'ENOENT') return DEFAULT_AGENT_READS.slice();
      throw e;
    }
    const rel = show(r, dir);
    if (st.isSymbolicLink()) throw new Refusal(`${rel} is a link or a junction; refusing to make an inbox file, because the inbox step reads .claude/agents/twin.md under it (make ${rel} a real folder)`);
    if (!st.isDirectory()) throw new Refusal(`${rel} is not a folder; refusing to make an inbox file, because the inbox step reads .claude/agents/twin.md under it (make ${rel} a folder that holds the agent file, or move it away)`);
  }
  const abs = path.join(dir, 'twin.md');
  try {
    fs.lstatSync(abs);
  } catch (e) {
    if (e.code === 'ENOENT') return DEFAULT_AGENT_READS.slice();
    throw e;
  }
  return deriveAgentReads(normalizeText(readFileChecked(abs, '.claude/agents/twin.md').toString('utf8')));
}

// A Refusal when a path the twin agent reads is there but is not a regular file with one
// hard link (a link, a junction, a folder or a hard link), or sits under a link. Each part
// is looked at with lstat only, so nothing is followed, listed or opened; an absent file
// (CLAUDE.md "if there is one") is fine. The same link / hard-link guard the twin/ reads
// use, over the whole derived read list, so a planted link in the root CLAUDE.md (to a
// file outside the repository, or a UNC/network share) is refused, never followed.
function guardAgentRead(root, rel) {
  const r = path.resolve(root);
  const abs = path.join(r, ...rel.split('/'));
  const stop = linkOnWay(r, path.dirname(abs));
  if (stop && stop.kind === 'link') {
    throw new Refusal(`${show(r, stop.at)} is a link or a junction; refusing to make an inbox file, because the twin agent reads ${rel} under it`);
  }
  const st = lstatOrNull(abs);
  if (!st) return;
  const why = st.isSymbolicLink() ? 'is a link or a junction' : st.isDirectory() ? 'is a folder' : !st.isFile() ? 'is not a regular file' : st.nlink > 1 ? 'has more than one hard link' : null;
  if (why) throw new Refusal(`${rel} ${why}; refusing to make an inbox file, because the twin agent reads ${rel} (make it a regular file with one hard link, never a link to a file outside the repository)`);
}

function checkAgentReads(root) {
  for (const rel of agentReads(root)) guardAgentRead(root, rel);
}

// A Refusal unless twin/.gitignore ignores the one-time inbox files (the INBOX_IGNORE line
// from lib/formats.js GITIGNORE) BEFORE any inbox file is made, so a planted empty or wrong
// twin/.gitignore cannot let an inbox file be committed in plaintext.
function checkInboxIgnored(root) {
  const abs = path.join(path.resolve(root), 'twin', '.gitignore');
  const text = readTextOrNull(abs, 'twin/.gitignore', path.resolve(root));
  const ignored = text !== null && text.split('\n').some((l) => l.trim() === INBOX_IGNORE);
  if (!ignored) {
    throw new Refusal(`twin/.gitignore does not ignore ${INBOX_IGNORE}; refusing to make an inbox file that could be committed in plaintext (run node .claude/twin/scripts/setup.js init to create or repair twin/.gitignore)`);
  }
}

/*
 * Creates a new inbox file, twin/inbox-<8 random hex>.json: empty, regular, created
 * exclusively (O_EXCL, and O_NOFOLLOW where the system has it), mode 0600. twin/ must be
 * a real folder (not a link) whose real path is inside the root, each file the twin
 * agent reads there (TWIN_READS) absent or a regular file with one hard link, and every
 * entry in it a regular file (checkTwinEntries: no link, junction or folder, whatever its
 * name), checked before and again just before the create. Nothing that already exists is
 * touched: a file or a link already at the new name (it cannot be guessed) makes it
 * refuse, never follow. Returns the path to print, twin/inbox-<hex>.json.
 */
function newInbox(root) {
  const realDir = realTwin(root);
  checkTwinReads(root);
  checkTwinEntries(root);
  checkAgentReads(root);
  checkInboxIgnored(root);
  const name = `inbox-${crypto.randomBytes(4).toString('hex')}.json`;
  const abs = path.join(path.resolve(root), 'twin', name);
  race('inbox-create', abs);
  const now = realTwin(root);
  if (!samePath(now, realDir)) throw new Refusal('twin/ changed while the inbox file was being made; refusing to write through it');
  checkTwinReads(root);
  checkTwinEntries(root);
  checkAgentReads(root);
  let fd;
  try {
    fd = fs.openSync(abs, C.O_WRONLY | C.O_CREAT | C.O_EXCL | NOFOLLOW, 0o600);
  } catch (e) {
    if (e.code === 'EEXIST' || e.code === 'ELOOP') throw new Refusal(`twin/${name} appeared while it was being made; nothing was written`);
    throw e;
  }
  try {
    const st = fs.fstatSync(fd, { bigint: true });
    if (!st.isFile() || st.nlink > 1n) throw new Refusal(`twin/${name} is not a plain file`);
  } finally {
    closeQuietly(fd);
  }
  return `twin/${name}`;
}

/*
 * Deletes an inbox file by its name once a script has read it (or refused it): a link
 * there loses only its name, never what it points to. Only while twin/ is still the
 * same real folder it was when the read began (realDir); a real folder at the name is
 * left alone. Returns true when something was deleted.
 */
function removeInbox(root, abs, realDir) {
  const now = realTwin(root);
  if (!samePath(now, realDir)) throw new Refusal('twin/ changed while the inbox file was being read; it was not deleted');
  const st = lstatOrNull(abs);
  if (!st) return false;
  if (st.isDirectory() && !st.isSymbolicLink()) throw new Refusal(`twin/${path.basename(abs)} is a folder; it was not deleted`);
  try {
    fs.unlinkSync(abs);
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
  return true;
}

// The user's twin/ folder. Refuses a linked twin and a twin that is a file.
function twinDir(root, create) {
  const dir = path.join(root, 'twin');
  const st = lstatOrNull(dir);
  if (st) {
    if (st.isSymbolicLink()) throw new Refusal('twin is a symlink; refusing to use it (make it a real folder)');
    if (!st.isDirectory()) throw new Refusal('twin exists and is not a folder');
    return dir;
  }
  if (!create) throw new Refusal('twin/ not found: run node .claude/twin/scripts/setup.js init first');
  fs.mkdirSync(dir);
  return dir;
}

module.exports = {
  Refusal,
  inside,
  realInside,
  realpathOrNull,
  samePath,
  lstatOrNull,
  linkOnWay,
  foldersOnWay,
  stripBom,
  normalizeText,
  openChecked,
  readFileChecked,
  readTextOrNull,
  assertSafeTarget,
  atomicWrite,
  createFile,
  appendLine,
  appendText,
  twinDir,
  realTwin,
  inboxFileOf,
  checkTwinReads,
  checkTwinEntries,
  TWIN_READS,
  newInbox,
  deriveAgentReads,
  agentReads,
  checkAgentReads,
  checkInboxIgnored,
  removeInbox,
  INBOX_NAME,
  show,
  setRaceHook,
  NOFOLLOW,
};
