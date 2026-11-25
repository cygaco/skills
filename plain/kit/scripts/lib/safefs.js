'use strict';
// File writes that stay inside the project. Every write goes through here: no path component
// from the project root to the target may be a symbolic link or junction, the parent must
// resolve inside the project, and replacements are written to a fresh temporary file and
// renamed over the target (a rename replaces a link itself, never what it points to).
const fs = require('fs');
const path = require('path');

class UnsafePath extends Error {}

function lstatOrNull(p) {
  try { return fs.lstatSync(p); } catch { return null; }
}

// Throws UnsafePath when any existing component of root/rel is a link, or the target exists
// and is not a regular file (dirs: not a directory).
function assertInside(root, rel, kind = 'file') {
  const rootReal = fs.realpathSync(root);
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    const st = lstatOrNull(cur);
    if (!st) continue;
    if (st.isSymbolicLink()) throw new UnsafePath(`${path.relative(root, cur)} is a link; not writing through it`);
    const last = i === parts.length - 1;
    if (!last && !st.isDirectory()) throw new UnsafePath(`${path.relative(root, cur)} is not a folder`);
    if (last && kind === 'file' && !st.isFile()) throw new UnsafePath(`${path.relative(root, cur)} is not a regular file`);
    if (last && kind === 'dir' && !st.isDirectory()) throw new UnsafePath(`${path.relative(root, cur)} is not a folder`);
  }
  const parent = path.dirname(path.join(root, rel));
  if (fs.existsSync(parent)) {
    const real = fs.realpathSync(parent);
    const rel2 = path.relative(rootReal, real);
    if (rel2.startsWith('..') || path.isAbsolute(rel2)) throw new UnsafePath(`${path.relative(root, parent)} resolves outside the project`);
  }
  return path.join(root, rel);
}

function ensureDir(root, rel) {
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    const sub = parts.slice(0, i).join('/');
    const p = assertInside(root, sub, 'dir');
    if (!lstatOrNull(p)) fs.mkdirSync(p);
  }
  return path.join(root, rel);
}

// Same file? (device + inode; NTFS reports stable file ids through Node.)
const same = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;

// The checks run again right before the commit step, and the temporary file must still be
// the one this call created, so a swap of a folder for a link during the write is refused.
// A process on the same machine that races these few calls on purpose is outside what a
// local add-on can stop (the README says so).
function writeAtomic(root, rel, data) {
  const target = assertInside(root, rel, 'file');
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, 'wx');
  let made;
  try {
    fs.writeSync(fd, typeof data === 'string' ? data : Buffer.from(data));
    made = fs.fstatSync(fd);
  } finally { fs.closeSync(fd); }
  try {
    assertInside(root, rel, 'file');
    if (!same(lstatOrNull(tmp), made)) throw new UnsafePath('the temporary file changed during the write');
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* already gone */ }
    throw e;
  }
  return target;
}

// Append only to the regular file that was checked: the open handle must be that file.
function appendSafe(root, rel, data) {
  const target = assertInside(root, rel, 'file');
  const before = lstatOrNull(target);
  const fd = fs.openSync(target, 'a');
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || (before && !same(before, st))) throw new UnsafePath(`${rel} changed while opening it`);
    assertInside(root, rel, 'file');
    fs.writeSync(fd, data);
  } finally { fs.closeSync(fd); }
  return target;
}

// Reads at most `max` bytes from the END of a regular, non-link file; null when absent/unsafe.
function readTail(file, max) {
  const st = lstatOrNull(file);
  if (!st || !st.isFile()) return null;
  const start = Math.max(0, st.size - max);
  const buf = Buffer.alloc(st.size - start);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, start); } finally { fs.closeSync(fd); }
  return buf.toString('utf8');
}

// Whole-file read capped at `max` bytes (null when larger, absent, a link or not a file).
function readCapped(file, max) {
  const st = lstatOrNull(file);
  if (!st || !st.isFile() || st.size > max) return null;
  return fs.readFileSync(file, 'utf8');
}

// Remove root/rel when it is a regular file or a link (a link is removed itself, never what it
// points to). Every parent component is checked first, so nothing outside the project goes.
function removeSafe(root, rel) {
  const parent = path.dirname(rel);
  if (parent && parent !== '.') {
    const pAbs = path.join(root, parent);
    if (!lstatOrNull(pAbs)) return false;
    assertInside(root, parent, 'dir');
  }
  const target = path.join(root, rel);
  const st = lstatOrNull(target);
  if (!st) return false;
  if (!st.isFile() && !st.isSymbolicLink()) throw new UnsafePath(`${rel} is not a file`);
  fs.unlinkSync(target);
  return true;
}

module.exports = { assertInside, ensureDir, writeAtomic, appendSafe, removeSafe, readTail, readCapped, UnsafePath };
