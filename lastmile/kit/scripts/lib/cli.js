"use strict";
/**
 * lib/cli.js — strict argument parsing shared by review.js and plan.js.
 *
 * Unknown flags, value flags with a missing or flag-looking value, and stray
 * positional arguments are all rejected (exit 2) BEFORE any file is read or
 * written: a typo such as `--jsno` or `--out --json` must never silently do the
 * wrong thing.
 */

const fs = require("fs");
const path = require("path");
const { PROFILES } = require("./profiles");

const EXIT = { OK: 0, ERROR: 1, USAGE: 2, EXISTS: 3 };

/**
 * parseArgs(argv, spec) → { values..., error }
 *   argv: process.argv.slice(2)
 *   spec: { value: { "--flag": "key" }, bool: { "--flag": "key" } }
 */
function parseArgs(argv, spec) {
  const out = { error: null, help: false };
  for (const key of Object.values(spec.value || {})) out[key] = null;
  for (const key of Object.values(spec.bool || {})) out[key] = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (spec.value && Object.prototype.hasOwnProperty.call(spec.value, a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        out.error = `flag ${a} requires a value`;
        return out;
      }
      out[spec.value[a]] = v;
      i++;
    } else if (spec.bool && Object.prototype.hasOwnProperty.call(spec.bool, a)) {
      out[spec.bool[a]] = true;
    } else {
      out.error = `unknown argument: ${a}`;
      return out;
    }
  }
  return out;
}

/**
 * resolveCommon(args, defaultOutRel) → { repoRoot, profile, outFile, error }
 * The user's repo root comes only from --repo-root or the current directory.
 */
function resolveCommon(args, defaultOutRel) {
  const repoRoot = path.resolve(args.repoRoot || process.cwd());
  let isDir = false;
  try {
    isDir = fs.statSync(repoRoot).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) return { error: `repo root is not a directory: ${args.repoRoot || "."}` };
  if (args.profile && !PROFILES.includes(args.profile)) {
    return { error: `unknown --profile "${args.profile}" (one of: ${PROFILES.join(", ")})` };
  }
  const outFile = args.out ? path.resolve(args.out) : path.join(repoRoot, defaultOutRel);
  return { repoRoot, profile: args.profile || null, outFile, error: null };
}

// A short display path: relative to the current directory when inside it.
function displayPath(abs) {
  const rel = path.relative(process.cwd(), abs);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.split(path.sep).join("/");
  return abs;
}

module.exports = { EXIT, parseArgs, resolveCommon, displayPath };
