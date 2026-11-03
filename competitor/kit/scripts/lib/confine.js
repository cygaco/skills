"use strict";
/**
 * lib/confine.js - where reports may be written, which files the scripts may
 * read, and which "your side" file cites count as verified.
 *
 * Output folder: <repo>/competitor/<slug>/ with a validated slug. Both
 * competitor/ and competitor/<slug>/ must be real folders: each is created when
 * absent, and refused when it is a symbolic link or junction, is not a folder,
 * or resolves outside the repository's real path. `report.js check` prepares
 * the folder; brief and compare prepare it again before they write.
 *
 * Run files: after preparing the folder, `check` also judges the files a run
 * writes there (draft.json, compare.json and urls.txt, written with Claude's
 * own file tool, and the four reports). Any of them that already exists and is
 * a symbolic link, a junction, a folder, a device, or a regular file with more
 * than one hard link is refused by name: a file tool would write through it to
 * a file elsewhere. A run may also write more URL lists under other names
 * (check-url reads at most 200 URLs a file), so every other entry of the folder
 * is judged too: a symbolic link, a junction, a device, or a regular file with
 * more than one hard link is refused by name; plain files and plain folders are
 * left alone. Nothing is removed; the message asks the user to delete it.
 *
 * Writes: every output goes to a new temporary file in the checked folder
 * (opened with "wx", so it never reuses an existing name or link), which is then
 * renamed over the target. A pre-existing output that is a hard link to a file
 * elsewhere is replaced, never written through. A target that exists and is not
 * a regular file is refused. Right before each rename both folders are checked
 * again, so a folder swapped for a link mid-write is refused. A local process
 * that can write to the repository and swaps a folder in the instant between
 * that check and the rename is not covered: Node offers no open-by-handle
 * rename.
 *
 * Input files (check --target-file, check-url --file): the path must resolve,
 * links included, to a regular file inside the working folder, of at most
 * 64 KB.
 *
 * Path cites: repo-relative only. No absolute path, no drive letter, no ".."
 * segment, no .env file, and the path must name a regular file inside the repo
 * root (also after resolving links in the folders on the way). A folder
 * (including "."), a symbolic link or junction, a device and a missing path
 * render as "unverified".
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { refuseSlug } = require("./slug");
const { hasUnsafeChar } = require("./guard");
const { printable } = require("./text");

class RefusedError extends Error {}

const OUT_FOLDER = "competitor";
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_CITE = 1024;

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function strictlyInside(child, parent) {
  return inside(child, parent) && path.relative(parent, child) !== "";
}

function samePath(a, b) {
  const x = path.resolve(a);
  const y = path.resolve(b);
  return process.platform === "win32" ? x.toLowerCase() === y.toLowerCase() : x === y;
}

function real(p) {
  try {
    return fs.realpathSync.native(p);
  } catch (e) {
    return path.resolve(p);
  }
}

/** The real path, or null when it cannot be resolved. */
function realOrNull(p) {
  try {
    return fs.realpathSync.native(p);
  } catch (e) {
    return null;
  }
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
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

/** Judges one folder on the way: a real folder, not a link, inside the repo. Returns its real path. */
function judgeDir(p, rootReal, shown) {
  const st = lstatOrNull(p);
  if (!st) throw new RefusedError(`${shown} is missing`);
  if (st.isSymbolicLink()) throw new RefusedError(`${shown} is a symbolic link or junction; reports are only written to a real folder inside the repository`);
  if (!st.isDirectory()) throw new RefusedError(`${shown} is not a folder`);
  const r = realOrNull(p);
  if (!r) throw new RefusedError(`${shown} cannot be resolved`);
  if (!strictlyInside(r, rootReal)) throw new RefusedError(`${shown} resolves outside the repository`);
  return r;
}

/** Creates one folder when it is absent (never through a link), then judges it. */
function ensureDir(p, rootReal, shown) {
  if (!lstatOrNull(p)) {
    try {
      fs.mkdirSync(p);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  return judgeDir(p, rootReal, shown);
}

/**
 * Makes sure <repo>/competitor/ and <repo>/competitor/<slug>/ exist as real
 * folders inside the repository's real path, creating them when absent.
 * Throws RefusedError for a link, a non-folder or a folder that resolves
 * outside. Returns what writeOutputs needs to check the folders again.
 */
function prepareDir(repoRoot, slug) {
  const root = path.resolve(repoRoot);
  const rootReal = realOrNull(root);
  if (!rootReal) throw new RefusedError("the repository folder cannot be resolved");
  const dir = outputDir(root, slug);
  const base = path.dirname(dir);
  const rel = `${OUT_FOLDER}/${slug}/`;
  const baseReal = ensureDir(base, rootReal, `${OUT_FOLDER}/`);
  if (!samePath(path.dirname(baseReal), rootReal)) throw new RefusedError(`${OUT_FOLDER}/ resolves outside the repository`);
  const dirReal = ensureDir(dir, rootReal, rel);
  if (!samePath(path.dirname(dirReal), baseReal)) throw new RefusedError(`${rel} resolves outside ${OUT_FOLDER}/`);
  return { root, rootReal, base, dir, baseReal, dirReal, slug, rel };
}

/** The files a run writes into competitor/<slug>/: Claude's three, then the four reports. */
function runFileNames(slug) {
  return ["draft.json", "compare.json", "urls.txt", `${slug}.competitor.md`, `${slug}.competitor.html`, `${slug}.compare.md`, `${slug}.compare.html`];
}

/** lstat of one entry of the prepared folder, or null when it is gone. */
function lstatEntry(prep, name, shown) {
  try {
    return fs.lstatSync(path.join(prep.dir, name));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw new RefusedError(`${shown} cannot be inspected (${e.code || "error"}); delete it, then run check again`);
  }
}

function refuseLinked(st, shown) {
  if (st.isSymbolicLink()) {
    throw new RefusedError(`${shown} is a symbolic link or junction, so writing it would change a file elsewhere; delete it, then run check again (nothing was removed)`);
  }
  if (st.isFile() && st.nlink > 1) {
    throw new RefusedError(`${shown} has ${st.nlink} hard links, so writing it would change a file elsewhere too; delete it, then run check again (nothing was removed)`);
  }
}

/**
 * Refuses (RefusedError, naming the file) when a run file already exists in
 * the prepared folder and is not a plain regular file with a single link, or
 * when any other entry of the folder is a link, a device or a file with more
 * than one hard link (a URL list may have another name than urls.txt).
 * Removes nothing. `check` calls this right after prepareDir.
 */
function refuseRunFileLinks(prep) {
  const names = runFileNames(prep.slug);
  for (const name of names) {
    const shown = `${prep.rel}${name}`;
    const st = lstatEntry(prep, name, shown);
    if (!st) continue;
    refuseLinked(st, shown);
    if (!st.isFile()) {
      throw new RefusedError(`${shown} exists and is not a regular file (a folder or a device); delete it, then run check again (nothing was removed)`);
    }
  }
  let entries;
  try {
    entries = fs.readdirSync(prep.dir);
  } catch (e) {
    throw new RefusedError(`${prep.rel} cannot be listed (${e.code || "error"})`);
  }
  for (const name of entries.sort()) {
    if (names.includes(name)) continue;
    const shown = `${prep.rel}${printable(name)}`;
    const st = lstatEntry(prep, name, shown);
    if (!st) continue;
    refuseLinked(st, shown);
    if (!st.isFile() && !st.isDirectory()) {
      throw new RefusedError(`${shown} is a device or another special file, not a regular file or a folder; delete it, then run check again (nothing was removed)`);
    }
  }
}

/** Checks both folders again: still real folders, still where they were. */
function recheckDir(prep) {
  const again = (p, was, shown) => {
    let r;
    try {
      r = judgeDir(p, prep.rootReal, shown);
    } catch (e) {
      if (e instanceof RefusedError) throw new RefusedError(`${e.message} (it changed while the report was being written)`);
      throw e;
    }
    if (!samePath(r, was)) throw new RefusedError(`${shown} moved while the report was being written`);
  };
  again(prep.base, prep.baseReal, `${OUT_FOLDER}/`);
  again(prep.dir, prep.dirReal, prep.rel);
}

function refuseNonRegular(target, shown) {
  const st = lstatOrNull(target);
  if (st && !st.isFile()) throw new RefusedError(`${shown} exists and is not a regular file (a link, a folder or a device); move it away first`);
}

function checkName(n, prep) {
  if (typeof n !== "string" || !/^[a-z0-9][a-z0-9.-]*$/.test(n) || n.includes("..")) throw new RefusedError(`bad output file name: ${n}`);
  const f = path.join(prep.dir, n);
  if (path.dirname(f) !== prep.dir) throw new RefusedError(`bad output file name: ${n}`);
  return f;
}

/** A new temporary file next to the target, opened exclusively. */
function openTemp(dir, name) {
  for (let k = 0; k < 8; k++) {
    const p = path.join(dir, `.${name}.${crypto.randomBytes(8).toString("hex")}.tmp`);
    try {
      return { fd: fs.openSync(p, "wx", 0o644), p };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  throw new Error("could not create a temporary file in the output folder");
}

function writeAll(fd, text) {
  const buf = Buffer.from(text, "utf8");
  let off = 0;
  while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
}

/**
 * Writes each content string to <prep.dir>/<name> through a temporary file and
 * a rename. Every target is judged before anything is written. `opts.beforeRename`
 * (used by the self-check only) runs after a temporary file is written and
 * before the folders are checked again. Returns the absolute paths written.
 */
function writeOutputs(prep, names, contents, opts) {
  const targets = names.map((n) => checkName(n, prep));
  targets.forEach((t, i) => refuseNonRegular(t, `${prep.rel}${names[i]}`));
  targets.forEach((target, i) => {
    const tmp = openTemp(prep.dir, names[i]);
    let open = true;
    try {
      writeAll(tmp.fd, contents[i]);
      fs.closeSync(tmp.fd);
      open = false;
      if (opts && typeof opts.beforeRename === "function") opts.beforeRename(i, tmp.p);
      recheckDir(prep);
      refuseNonRegular(target, `${prep.rel}${names[i]}`);
      fs.renameSync(tmp.p, target);
    } catch (e) {
      if (open) {
        try {
          fs.closeSync(tmp.fd);
        } catch (e2) {
          // already closed
        }
      }
      try {
        fs.unlinkSync(tmp.p);
      } catch (e3) {
        // gone already, or the folder moved away
      }
      throw e;
    }
  });
  return targets;
}

/**
 * Reads a regular file of at most maxBytes, never more than maxBytes + 1 bytes
 * of it. Returns { ok: true, buf } or { ok: false, why: "missing" | "not-file" | "too-big" | "unreadable" }.
 */
function readCapped(file, maxBytes) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
  } catch (e) {
    return { ok: false, why: e.code === "ENOENT" ? "missing" : e.code === "EISDIR" ? "not-file" : "unreadable" };
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return { ok: false, why: "not-file" };
    if (st.size > maxBytes) return { ok: false, why: "too-big" };
    const chunks = [];
    const chunk = Buffer.alloc(65536);
    let total = 0;
    for (;;) {
      const n = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (n === 0) break;
      total += n;
      if (total > maxBytes) return { ok: false, why: "too-big" };
      chunks.push(Buffer.from(chunk.subarray(0, n)));
    }
    return { ok: true, buf: Buffer.concat(chunks, total) };
  } catch (e) {
    return { ok: false, why: "unreadable" };
  } finally {
    try {
      fs.closeSync(fd);
    } catch (e) {
      // nothing to do
    }
  }
}

/**
 * Reads an input file named on the command line. It must resolve (links
 * included) to a regular file inside the working folder, of at most 64 KB.
 * Returns its text; throws RefusedError otherwise.
 */
function readInputFile(cwd, given, flag) {
  const rootReal = realOrNull(path.resolve(cwd));
  if (!rootReal) throw new RefusedError(`${flag}: the working folder cannot be resolved`);
  const r = realOrNull(path.resolve(cwd, given));
  if (!r) throw new RefusedError(`${flag}: no such file`);
  if (!strictlyInside(r, rootReal)) throw new RefusedError(`${flag} must name a file inside this repository (the working folder)`);
  const got = readCapped(r, MAX_INPUT_BYTES);
  if (!got.ok) {
    if (got.why === "too-big") throw new RefusedError(`${flag} is larger than 64 KB`);
    if (got.why === "not-file") throw new RefusedError(`${flag} is not a regular file`);
    throw new RefusedError(`${flag}: the file cannot be read`);
  }
  let text = got.buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/** "src/app.js:12", "src/app.js:3-9" and "README.md#pricing" cite the file part. */
function stripLocator(s) {
  return s.replace(/#.*$/, "").replace(/:\d+(?:-\d+)?$/, "");
}

/**
 * Judges one cite into the user's repository.
 * Returns { kind: "said" } | { kind: "file", text } | { kind: "unverified", text, reason }.
 */
function verifyCite(raw, repoRoot) {
  if (typeof raw !== "string" || !raw.trim()) return { kind: "unverified", text: "", reason: "no cite" };
  if (raw.length > MAX_CITE) return { kind: "unverified", text: `${raw.slice(0, 60)}...`, reason: `longer than ${MAX_CITE} characters` };
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
  let st = null;
  try {
    st = fs.lstatSync(abs);
  } catch (e) {
    st = null;
  }
  if (!st) return bad("no such file in the repository");
  if (st.isSymbolicLink()) return bad("a symbolic link or junction; cite the file itself");
  if (st.isDirectory()) return bad("a folder, not a file; cite a file inside it");
  if (!st.isFile()) return bad("not a regular file");
  if (!inside(real(abs), real(root))) return bad("links outside the repository");
  return { kind: "file", text: segs.filter((s) => s && s !== ".").join("/") };
}

module.exports = {
  RefusedError,
  OUT_FOLDER,
  MAX_INPUT_BYTES,
  MAX_CITE,
  inside,
  outputDir,
  prepareDir,
  runFileNames,
  refuseRunFileLinks,
  recheckDir,
  writeOutputs,
  readCapped,
  readInputFile,
  verifyCite,
  stripLocator,
};
