'use strict';
/*
 * lib/transcripts.js: read this project's Claude Code chat history, for mine.js
 * --transcripts (templates/formats.md, "mine.js"). Read-only.
 *
 * historyLocation(root, env, home) -> { folder, why }; historyFolder(...) -> folder
 *   folder is <config>/projects/<encoded root>. <config> is env.CLAUDE_CONFIG_DIR when it
 *   is set, otherwise <home>/.claude. It must be a local absolute path, judged by its
 *   text alone: a network share (\\host\share, //host/share), a device path (\\?\, \\.\)
 *   or a path that is not absolute is refused (why says so) without any file-system
 *   call. Otherwise the folder is <config> as given (tidied as text by path.resolve, so
 *   --where shows the path as given); no part of it is ever resolved, through a link or
 *   otherwise. <encoded root> is the real path of the root with every character that is
 *   not an ASCII letter or digit replaced by '-'. There is no other way to name a folder,
 *   and no other folder is ever searched.
 *
 * folderRefusal(folder) -> null, or { why, link }
 *   Before anything else looks at the folder, each part of its path from the top of the
 *   file system down to the folder (every folder above <config>, <config>,
 *   <config>/projects, the folder) is looked at with lstat, one at a time, top down
 *   (lib/fsx.js linkOnWay), and a link or junction at any of them is a refusal: nothing
 *   is ever looked up, listed or opened through it. A folder path that is not a local
 *   absolute path is refused by its text, with no file-system call. --where and
 *   --transcripts both use it.
 *
 * readHistory(root, folder) -> what the folder holds, and the candidates
 *   It refuses a folder that folderRefusal refuses. A permission error on the folder or
 *   the parts above it is a refusal too (not read), never a crash. It lists the folder
 *   one entry at a time (opendir) and looks at most at 20,000 entries; it reads the
 *   folder's own *.jsonl files: regular files directly in that folder (not its
 *   subfolders), skipping any entry that is a link,
 *   has more than one hard link or cannot be looked at, each through a descriptor that
 *   must point at the file it looked at. It reads at most 2,000 files and 256 MB in all,
 *   and says so if it stops early. One JSON object per line; lines and files it cannot
 *   read are tolerated. A line is a candidate only when it is text you typed in this
 *   repository: type "user"; not a side conversation (isSidechain), a system line
 *   (isMeta), a compacted summary or a transcript-only line; no tool output (a
 *   tool_result block, or a toolUseResult field); a cwd that is an absolute local path
 *   and, compared as text, exactly this root (its path or its real path, both worked out
 *   once; letter case ignored on Windows only). The cwd is never looked up on disk:
 *   network shares (\\host\share, //host/share), device paths (\\?\, \\.\) and relative
 *   paths are skipped as they are. A line without a cwd is skipped, and since two roots
 *   can encode to the same folder name, this check decides, not the folder. Then: text
 *   only (a string, or the text blocks); not a command wrapper (text starting with a <
 *   tag) and not a system reminder; a valid timestamp; and a correction or preference
 *   opener within its first 120 characters.
 *   Each candidate is redacted whole before its line breaks and control characters are
 *   tidied, and only then cut to 400 characters, and only the 60
 *   most recent are held (by timestamp, then file and line order), so memory stays
 *   bounded. Each is numbered as `chat <YYYY-MM-DD> #<n>`.
 *
 * Nothing here writes a file. mine.js prints the excerpts and writes only counts and
 * references to twin/evidence.md.
 */

const fs = require('fs');
const path = require('path');
const { Refusal, lstatOrNull, linkOnWay, realpathOrNull, readFileChecked } = require('./fsx');
const { redact, excerpt } = require('./redact');

const MAX_KEPT = 60;
const EXCERPT_MAX = 400;
const OPENER_WINDOW = 120;
const HEAD_MAX = 4096;
const FILE_MAX_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 2000;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_ENTRIES = 20000;

const isPermission = (e) => Boolean(e && (e.code === 'EACCES' || e.code === 'EPERM'));

// Non-ASCII characters are built from their code points, so this file stays ASCII.
const RSQ = String.fromCharCode(0x2019); // the curly apostrophe
const APOS = `['${RSQ}]`;
const L = '\\p{L}\\p{N}';
const B = `(?<![${L}_])`;
const E = `(?![${L}_])`;
const S = `[^${L}]+`;

// Words a correction or a stated preference usually opens with.
const OPENERS = [
  'no',
  'nope',
  `don${APOS}?t`,
  `do${S}not`,
  'stop',
  'instead',
  'wrong',
  'incorrect',
  'actually',
  `not${S}what${S}i`,
  `not${S}like${S}that`,
  `that${APOS}?s${S}not`,
  `that${S}is${S}not`,
  `why${S}did${S}you`,
  'undo',
  'revert',
  `i${S}said`,
  `i${S}asked`,
  `i${S}told${S}you`,
  `i${S}meant`,
  `i${S}prefer`,
  `i${APOS}d${S}prefer`,
  `i${S}would${S}prefer`,
  `i${S}want`,
  `i${APOS}d${S}rather`,
  `i${S}would${S}rather`,
  'always',
  'never',
  `from${S}now${S}on`,
  `going${S}forward`,
];
const OPENER = new RegExp(`${B}(?:${OPENERS.join('|')})${E}`, 'iu');

const WRAPPER = /^<[A-Za-z!/?]/;
const REMINDER = /<\/?system-reminder\b/i;
const SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

function encodeRoot(realRoot) {
  return String(realRoot).replace(/[^A-Za-z0-9]/g, '-');
}

// What kind of path p is when it is not a local absolute path, judged by its text alone
// (no file-system call), or null when it is one.
function pathShape(p) {
  if (localAbsolute(p)) return null;
  const s = typeof p === 'string' ? p : '';
  if (/^[\\/]{2}[?.][\\/]/.test(s)) return 'a device path';
  if (/^[\\/]{2}/.test(s)) return 'a network share';
  return 'not an absolute local path';
}

function historyLocation(root, env, home) {
  const e = env && typeof env === 'object' ? env : {};
  let config;
  let why = null;
  if (typeof e.CLAUDE_CONFIG_DIR === 'string' && e.CLAUDE_CONFIG_DIR !== '') {
    config = e.CLAUDE_CONFIG_DIR;
    const shape = pathShape(config);
    if (shape) why = `CLAUDE_CONFIG_DIR is ${shape}`;
  } else {
    if (!home) throw new Refusal('cannot tell where your home folder is; set CLAUDE_CONFIG_DIR to your Claude Code config folder');
    const shape = pathShape(String(home));
    if (shape) why = `your home folder is ${shape}`;
    config = path.join(String(home), '.claude');
  }
  const encoded = encodeRoot(fs.realpathSync(root));
  // A refused config is joined as text only, for the printout; nothing looks at it.
  if (why) return { folder: path.join(config, 'projects', encoded), why };
  // The path as given, tidied as text only: nothing in it is looked up here (folderRefusal
  // walks it top down with lstat before anything looks at it).
  return { folder: path.join(path.resolve(config), 'projects', encoded), why: null };
}

function historyFolder(root, env, home) {
  return historyLocation(root, env, home).folder;
}

// Why a history folder must not be read, or null: { why, link }. Its path is not a local
// absolute path (by its text, nothing looked at), or a part of it, from the top of the
// file system down to the folder, is a link or a junction (each part looked at with lstat,
// top down, so nothing is ever looked at through a link) (link: true); or looking at them
// was not allowed (link: false).
function folderRefusal(folder) {
  const shape = pathShape(folder);
  if (shape) return { why: `its path is ${shape}`, link: true };
  const abs = path.resolve(folder);
  const projects = path.dirname(abs);
  const config = path.dirname(projects);
  try {
    const stop = linkOnWay(path.parse(abs).root, abs);
    if (!stop || stop.kind !== 'link') return null;
    const at = path.resolve(stop.at);
    const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
    if (same(at, abs)) return { why: 'it is a link', link: true };
    if (same(at, projects)) return { why: 'its projects folder is a link', link: true };
    if (same(at, config)) return { why: 'it sits under a link (its config folder is a link)', link: true };
    return { why: 'it sits under a link (a folder above its config folder is a link)', link: true };
  } catch (e) {
    if (isPermission(e)) return { why: `permission denied (${e.code})`, link: false };
    throw e;
  }
}

// The reason alone, or null (for tests).
function linkedFolder(folder) {
  const r = folderRefusal(folder);
  return r ? r.why : null;
}

// True when the folder exists and is a real folder. Only for a folder folderRefusal
// passed: it is looked at with lstat, never followed.
function isFolder(p) {
  try {
    const st = fs.lstatSync(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch (e) {
    return false;
  }
}

// The real path of the projects folder, or null when it may not be looked up: its path is
// not a local absolute path, or a part of it, from the top of the file system down, is a
// link or is missing (each part looked at with lstat, top down, before the lookup).
function realProjectsOrNull(projectsDir) {
  if (!projectsDir || pathShape(projectsDir)) return null;
  try {
    const abs = path.resolve(projectsDir);
    if (linkOnWay(path.parse(abs).root, abs)) return null;
    return realpathOrNull(abs);
  } catch (e) {
    return null;
  }
}

const keyOf = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));

// True when p is an absolute local path, judged as text only: a drive-letter path on
// Windows, a /path elsewhere. Network shares (\\host\share, //host/share), device paths
// (\\?\, \\.\), relative and drive-relative paths are not.
function localAbsolute(p) {
  if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0')) return false;
  if (/^[\\/]{2}/.test(p)) return false;
  if (process.platform === 'win32') return /^[A-Za-z]:[\\/]/.test(p);
  return p.startsWith('/');
}

// True when a line's cwd is exactly the root, compared as text (path.resolve tidies it
// without touching the disk) against the root's path and its real path, both worked out
// once. A line's cwd is never looked up on disk, so it cannot make the reader touch a
// network share or any other place.
function cwdMatcher(root) {
  const keys = new Set([keyOf(root), keyOf(fs.realpathSync(root))]);
  return (cwd) => localAbsolute(cwd) && keys.has(keyOf(cwd));
}

// The text you typed in a user line, or null (tool output, no text, an unknown shape).
function typedText(obj) {
  const msg = obj.message;
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
  if (msg.role !== undefined && msg.role !== 'user') return null;
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return null;
  const parts = [];
  for (const b of c) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'tool_result') return null;
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
  }
  return parts.length ? parts.join('\n') : null;
}

const tidy = (s) => String(s).replace(/\r\n?/g, '\n').replace(SEPARATORS, '\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ');

// Keeps the n largest items of a stream, by (ms, then arrival order), in ascending order.
function keepNewest(list, item, n) {
  let i = list.length;
  while (i > 0 && list[i - 1].ms > item.ms) i--;
  list.splice(i, 0, item);
  if (list.length > n) list.shift();
}

// The folder could not be read (a link, or a permission error): a refusal, never a crash.
function refuse(res, r) {
  res.reason = 'refused';
  res.refused = r.why;
  res.linkRefusal = r.link;
  return res;
}

// limits: { files, bytes, entries } (a test passes small ones; the command line
// never does).
function readHistory(root, folder, limits) {
  const maxFiles = limits && limits.files ? limits.files : MAX_FILES;
  const maxBytes = limits && limits.bytes ? limits.bytes : MAX_TOTAL_BYTES;
  const maxEntries = limits && limits.entries ? limits.entries : MAX_ENTRIES;
  const res = {
    folder,
    found: false,
    reason: null,
    refused: null,
    linkRefusal: false,
    files: 0,
    unreadableFiles: 0,
    skippedLinks: 0,
    stoppedAtFiles: false,
    stoppedAtBytes: false,
    stoppedAtEntries: false,
    entriesLimit: maxEntries,
    lines: 0,
    unrecognised: 0,
    typed: 0,
    candidates: 0,
    items: [],
  };
  const refusal = folderRefusal(folder);
  if (refusal) return refuse(res, refusal);
  let st;
  try {
    st = lstatOrNull(folder);
  } catch (e) {
    if (isPermission(e)) return refuse(res, { why: `permission denied (${e.code})`, link: false });
    throw e;
  }
  if (!st) {
    res.reason = 'absent';
    return res;
  }
  if (!st.isDirectory()) {
    res.reason = 'not a folder';
    return res;
  }
  // One entry at a time, at most maxEntries of them, so a huge folder costs little.
  const names = [];
  let dir;
  try {
    dir = fs.opendirSync(folder);
  } catch (e) {
    if (isPermission(e)) return refuse(res, { why: `permission denied (${e.code})`, link: false });
    res.reason = 'unreadable';
    return res;
  }
  try {
    let scanned = 0;
    for (;;) {
      if (scanned >= maxEntries) {
        res.stoppedAtEntries = true;
        break;
      }
      const d = dir.readSync();
      if (d === null) break;
      scanned++;
      if (!d.name.toLowerCase().endsWith('.jsonl')) continue;
      if (d.isSymbolicLink()) res.skippedLinks++;
      else if (d.isFile()) names.push(d.name);
    }
  } catch (e) {
    if (isPermission(e)) return refuse(res, { why: `permission denied (${e.code})`, link: false });
    res.reason = 'unreadable';
    return res;
  } finally {
    try {
      dir.closeSync();
    } catch (e) {
      /* already closed */
    }
  }
  names.sort();
  const matches = cwdMatcher(root);
  const top = [];
  let recognised = 0;
  let total = 0;
  for (let fileIndex = 0; fileIndex < names.length; fileIndex++) {
    if (res.files >= maxFiles) {
      res.stoppedAtFiles = true;
      break;
    }
    const abs = path.join(folder, names[fileIndex]);
    let ls;
    try {
      ls = lstatOrNull(abs);
    } catch (e) {
      // An entry it may not look at is skipped and counted, like any unreadable file.
      res.unreadableFiles++;
      continue;
    }
    if (!ls || !ls.isFile() || ls.nlink > 1) {
      // A link, or a hard link, put there after the folder was listed: never followed.
      if (ls && (ls.isSymbolicLink() || ls.nlink > 1)) res.skippedLinks++;
      else res.unreadableFiles++;
      continue;
    }
    if (ls.size > FILE_MAX_BYTES) {
      res.unreadableFiles++;
      continue;
    }
    if (total + ls.size > maxBytes) {
      res.stoppedAtBytes = true;
      break;
    }
    let text;
    try {
      const buf = readFileChecked(abs, names[fileIndex], { max: FILE_MAX_BYTES });
      total += buf.length;
      text = buf.toString('utf8');
    } catch (e) {
      if (e && e.refusal) res.skippedLinks++;
      else res.unreadableFiles++;
      continue;
    }
    res.files++;
    text.split('\n').forEach((raw, lineIndex) => {
      const line = raw.replace(/\r$/, '');
      if (!line.trim()) return;
      res.lines++;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        res.unrecognised++;
        return;
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || typeof obj.type !== 'string') {
        res.unrecognised++;
        return;
      }
      recognised++;
      if (obj.type !== 'user') return;
      if (obj.isSidechain === true || obj.isMeta === true || obj.isCompactSummary === true || obj.isVisibleInTranscriptOnly === true) return;
      if (obj.toolUseResult !== undefined) return;
      // The cwd must be present and be exactly this root.
      if (!matches(obj.cwd)) return;
      const typed = typedText(obj);
      if (typed === null || REMINDER.test(typed)) return;
      // Only the start is looked at to decide; a line that is not a candidate costs little.
      const head = tidy(typed.slice(0, HEAD_MAX)).trim();
      if (!head || WRAPPER.test(head)) return;
      const ms = typeof obj.timestamp === 'string' ? Date.parse(obj.timestamp) : NaN;
      if (Number.isNaN(ms)) return;
      res.typed++;
      if (!OPENER.test(head.slice(0, OPENER_WINDOW))) return;
      res.candidates++;
      // A candidate is redacted whole before it is tidied (a control character turned into
      // a space would split a secret), and only then cut to 400 characters (excerpt,
      // which redacts the tidied text again).
      keepNewest(top, { ms, text: excerpt(tidy(redact(typed)), EXCERPT_MAX) }, MAX_KEPT);
    });
  }
  if (!recognised) {
    res.reason = names.length ? 'no line it recognises' : 'no .jsonl files';
    return res;
  }
  res.found = true;
  res.items = top.map((x, i) => {
    const date = new Date(x.ms).toISOString().slice(0, 10);
    return { ref: `chat ${date} #${i + 1}`, date, n: i + 1, text: x.text };
  });
  return res;
}

module.exports = { historyFolder, historyLocation, pathShape, realProjectsOrNull, encodeRoot, isFolder, linkedFolder, folderRefusal, localAbsolute, cwdMatcher, readHistory, typedText, OPENER, MAX_KEPT, EXCERPT_MAX, OPENER_WINDOW, MAX_FILES, MAX_TOTAL_BYTES, MAX_ENTRIES };
