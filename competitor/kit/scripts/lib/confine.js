"use strict";
/**
 * lib/confine.js - where reports may be written, and which "your side" file
 * cites count as verified.
 *
 * Output: only <repo>/competitor/<slug>/, with a validated slug, never through
 * a symbolic link, and with the real (resolved) folder still inside the repo.
 *
 * Path cites: repo-relative only. No absolute path, no drive letter, no ".."
 * segment, no .env file, and the file must exist inside the repo root (also
 * after resolving links). Anything else renders as "unverified".
 */

const fs = require("fs");
const path = require("path");
const { refuseSlug } = require("./slug");
const { hasUnsafeChar } = require("./guard");

class RefusedError extends Error {}

const OUT_FOLDER = "competitor";

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function strictlyInside(child, parent) {
  return inside(child, parent) && path.relative(parent, child) !== "";
}

function real(p) {
  try {
    return fs.realpathSync.native(p);
  } catch (e) {
    return path.resolve(p);
  }
}

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch (e) {
    return false;
  }
}

/** The output folder for a slug. Throws RefusedError when it would leave <repo>/competitor/. */
function outputDir(repoRoot, slug) {
  const why = refuseSlug(slug);
  if (why) throw new RefusedError(why);
  const base = path.resolve(repoRoot, OUT_FOLDER);
  const dir = path.resolve(base, slug);
  if (!strictlyInside(dir, base) || path.dirname(dir) !== base) {
    throw new RefusedError(`the output folder for "${slug}" would leave ${OUT_FOLDER}/`);
  }
  return dir;
}

/**
 * Creates <repo>/competitor/<slug>/ and returns the absolute paths to write.
 * Refuses symbolic links on the way and checks the real folder afterwards.
 */
function prepareOutput(repoRoot, slug, fileNames) {
  const root = path.resolve(repoRoot);
  const dir = outputDir(root, slug);
  const base = path.dirname(dir);
  for (const p of [base, dir]) {
    if (isLink(p)) throw new RefusedError(`${path.relative(root, p).split(path.sep).join("/")} is a symbolic link; reports are only written to a real folder`);
  }
  const files = fileNames.map((n) => {
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(n) || n.includes("..")) throw new RefusedError(`bad output file name: ${n}`);
    const f = path.join(dir, n);
    if (path.dirname(f) !== dir) throw new RefusedError(`bad output file name: ${n}`);
    if (isLink(f)) throw new RefusedError(`${OUT_FOLDER}/${slug}/${n} is a symbolic link; refusing to write through it`);
    return f;
  });
  fs.mkdirSync(dir, { recursive: true });
  if (!inside(real(dir), real(root))) throw new RefusedError(`${OUT_FOLDER}/${slug}/ resolves outside the repository`);
  return { dir, files };
}

/** "src/app.js:12", "src/app.js:3-9" and "README.md#pricing" cite the file part. */
function stripLocator(s) {
  return s.replace(/#.*$/, "").replace(/:\d+(?:-\d+)?$/, "");
}

/**
 * Judges one "your side" cite.
 * Returns { kind: "said" } | { kind: "file", text } | { kind: "unverified", text, reason }.
 */
function verifyCite(raw, repoRoot) {
  if (typeof raw !== "string" || !raw.trim()) return { kind: "unverified", text: "", reason: "no cite" };
  const text = raw.trim();
  if (/^you said$/i.test(text)) return { kind: "said" };
  const bad = (reason) => ({ kind: "unverified", text, reason });
  for (const ch of text) {
    if (ch !== " " && hasUnsafeChar(ch)) return bad("contains control characters");
  }
  if (/^[A-Za-z]:/.test(text)) return bad("a drive letter; cite a path relative to the repository");
  const p = stripLocator(text);
  if (!p) return bad("no file path");
  if (p.startsWith("/") || p.startsWith("\\") || path.isAbsolute(p) || path.win32.isAbsolute(p) || path.posix.isAbsolute(p)) {
    return bad("an absolute path; cite a path relative to the repository");
  }
  const segs = p.split(/[\\/]+/);
  if (segs.includes("..")) return bad('contains ".."; cite a path inside the repository');
  if (segs.some((s) => /^\.env(\..*)?$/i.test(s))) return bad("a secrets file; .env files are never read");
  const root = path.resolve(repoRoot);
  const abs = path.resolve(root, p);
  if (!inside(abs, root)) return bad("outside the repository");
  if (!fs.existsSync(abs)) return bad("no such file in the repository");
  if (!inside(real(abs), real(root))) return bad("links outside the repository");
  return { kind: "file", text: segs.filter((s) => s && s !== ".").join("/") };
}

module.exports = { RefusedError, OUT_FOLDER, inside, outputDir, prepareOutput, verifyCite, stripLocator };
