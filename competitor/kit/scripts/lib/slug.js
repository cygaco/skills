"use strict";
/**
 * lib/slug.js - the folder name a competitor's files live under.
 *
 * A slug matches ^[a-z0-9][a-z0-9-]{0,63}$ (so it can never hold a dot, a
 * slash, a backslash, a colon or "..") and is never a Windows reserved device
 * name (con, prn, aux, nul, com1-com9, lpt1-lpt9).
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_SLUG = 64;
const MAX_NAME_LEN = 200;
const RESERVED = new Set(["con", "prn", "aux", "nul"]);
for (let i = 1; i <= 9; i++) {
  RESERVED.add(`com${i}`);
  RESERVED.add(`lpt${i}`);
}

/** Lowercase, strip accents, collapse everything else to single hyphens, cap at 64. */
function normalizeSlug(input) {
  if (input == null) return "";
  return String(input)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
}

/** Returns null when the slug is valid, or the reason it is refused. */
function refuseSlug(slug) {
  if (typeof slug !== "string" || !slug) return "the slug is empty (use a name with letters or digits)";
  if (!SLUG_RE.test(slug)) {
    return `the slug "${slug.slice(0, 80)}" must be 1-64 characters of a-z, 0-9 and "-", starting with a letter or digit`;
  }
  if (RESERVED.has(slug)) return `the slug "${slug}" is a reserved device name on Windows`;
  return null;
}

/** Checks a product name typed by the user. Returns null or a reason. */
function refuseName(name) {
  if (typeof name !== "string") return "the name must be text";
  const t = name.trim();
  if (!t) return "the name is empty";
  if (t.length > MAX_NAME_LEN) return `the name is longer than ${MAX_NAME_LEN} characters`;
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if ((c < 0x20 && c !== 0x09) || c === 0x7f) return "the name contains control characters";
  }
  return null;
}

/** The slug for a URL: its host without a leading "www.". */
function slugFromHost(hostname) {
  return normalizeSlug(String(hostname || "").replace(/^www\./i, ""));
}

module.exports = { SLUG_RE, RESERVED, MAX_NAME_LEN, normalizeSlug, refuseSlug, refuseName, slugFromHost };
