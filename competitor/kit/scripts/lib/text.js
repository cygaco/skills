"use strict";
/**
 * lib/text.js - output neutralisation. Every piece of draft text reaches a
 * report through one of these functions.
 *
 * HTML: htmlEscape on every text path and every attribute value.
 * Markdown: raw HTML is escaped (< becomes &lt;), every character that could
 * start a link, an image, a link reference, a raw autolink or a table break is
 * backslash-escaped, and every colon that starts "://" (whatever comes before
 * it, so xhttp:// and xftp:// too) or follows a URL scheme word (http, https,
 * javascript, data, mailto, ...) is escaped, as is the dot after "www", so
 * draft text never turns into a link. The only links in a report are made by
 * mdLink / the HTML link renderer, from URLs that passed the URL check.
 *
 * Size: a string is cut to MAX_FIELD characters before any per-character work,
 * and shown text is capped at MAX_TEXT characters.
 */

const { hasUnsafeChar } = require("./guard");

const MAX_TEXT = 4000;
const MAX_FIELD = 8192;
const GAP_DASH = String.fromCharCode(0x2014); // the em dash used in [GAP ...] markers
const INFERRED = "inferred, no source";
const UNVERIFIED = "unverified";

/** The first n UTF-16 units of s, never ending on half a surrogate pair. */
function clip(s, n) {
  if (s.length <= n) return s;
  const t = s.slice(0, n);
  const last = t.charCodeAt(t.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? t.slice(0, -1) : t;
}

/**
 * Draft value to one clean line of text: non-text becomes "", control,
 * zero-width and bidirectional characters are dropped, whitespace runs become
 * one space, and the result is capped. The input is cut to MAX_FIELD first.
 */
function cleanText(value, max) {
  let s;
  if (typeof value === "string") s = value;
  else if (typeof value === "number" && Number.isFinite(value)) s = String(value);
  else if (typeof value === "boolean") s = String(value);
  else return "";
  const cut = s.length > MAX_FIELD;
  if (cut) s = clip(s, MAX_FIELD);
  let out = "";
  for (const ch of s) {
    if (/\s/.test(ch)) out += " ";
    else if (!hasUnsafeChar(ch)) out += ch;
  }
  out = out.replace(/ +/g, " ").trim();
  const cap = max || MAX_TEXT;
  if (out.length > cap) out = `${out.slice(0, cap)}...`;
  else if (cut && out) out = `${out}...`;
  return out;
}

// Ported unchanged from the original generator.
function htmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlText(value) {
  return htmlEscape(cleanText(value));
}

// A scheme word just before a colon. Tested only on the 10 characters before
// each colon, never on the whole text.
const SCHEME_BEFORE = /(?:https?|ftps?|mailto|xmpp|javascript|vbscript|data|file|wss?|tel|sms|irc|blob)$/i;

/** Escapes every colon that starts "://" or ends a scheme word, whatever precedes it. */
function escapeSchemeColons(s) {
  return s.replace(/:/g, (m, at) => (s.startsWith("//", at + 1) || SCHEME_BEFORE.test(s.slice(Math.max(0, at - 10), at)) ? "\\:" : ":"));
}

/**
 * Draft value to Markdown inline text that renders literally and links nowhere.
 * With lineStart, a leading heading, quote, list or rule marker is escaped too.
 */
function mdText(value, lineStart) {
  let s = cleanText(value);
  if (!s) return "";
  s = s.replace(/&(?=#?[A-Za-z0-9]+;)/g, "&amp;");
  s = s.replace(/[\\`*_~[\]|$@]/g, "\\$&");
  s = s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = escapeSchemeColons(s);
  s = s.replace(/(www)\./gi, "$1\\.");
  if (lineStart) s = s.replace(/^([#>+=-])/, "\\$1").replace(/^(\d+)([.)])/, "$1\\$2");
  return s;
}

// The most a shown URL is read: the largest input any path can hand it (a
// --file is at most 64 KB; draft strings are cut to MAX_FIELD when read).
const MAX_SHOWN_INPUT = 65536;

/** A URL as display text: credentials are masked, unsafe characters made visible. */
function shownUrl(value) {
  const s = typeof value === "string" ? clip(value, MAX_SHOWN_INPUT).trim() : "";
  return printable(s.replace(/^([a-z][a-z0-9+.-]*:[\\/]*)[^@/?#\\]*@/i, "$1***@"));
}

/** True for an href this module will emit: a normalised http(s) URL with nothing to break out with. */
function safeHref(href) {
  return typeof href === "string" && /^https?:\/\/[^\s<>"`\\]+$/.test(href) && !hasUnsafeChar(href);
}

/** A Markdown link. The label is engine text; the href must already have passed the URL check. */
function mdLink(label, href) {
  if (!safeHref(href)) return mdText(label);
  return `[${mdText(label)}](<${href.replace(/&(?=#?[A-Za-z0-9]+;)/g, "&amp;")}>)`;
}

function htmlLink(label, href) {
  if (!safeHref(href)) return htmlText(label);
  return `<a href="${htmlEscape(href)}" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">${htmlText(label)}</a>`;
}

/** A Markdown code span for a verified file path; falls back to plain text when it cannot be fenced safely. */
function mdCode(value) {
  const s = cleanText(value);
  if (!s || /[`|]/.test(s)) return mdText(s);
  return `\`${s}\``;
}

function gapMarker(area, reason) {
  return `[GAP ${GAP_DASH} ${area} ${GAP_DASH} ${reason}]`;
}

const GAP_RE = /\[GAP\s/g;

/** Template-supplied [GAP ...] text must be one plain line in the marker shape. */
function isGapText(s) {
  return typeof s === "string" && /^\[GAP [^\]\n\r<>()]*\]$/.test(s);
}

/** Text for terminal output: unsafe characters are shown as <U+XXXX>. */
function printable(value) {
  let out = "";
  // Only the first 300 characters survive the cap below, so read no more
  // than that plus a margin that still triggers the "..." mark.
  for (const ch of clip(String(value), 302)) {
    if (ch !== " " && hasUnsafeChar(ch)) out += `<U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}>`;
    else out += ch;
  }
  return out.length > 300 ? `${out.slice(0, 300)}...` : out;
}

module.exports = {
  MAX_TEXT,
  MAX_FIELD,
  clip,
  GAP_DASH,
  GAP_RE,
  INFERRED,
  UNVERIFIED,
  cleanText,
  htmlEscape,
  htmlText,
  mdText,
  mdLink,
  htmlLink,
  mdCode,
  safeHref,
  gapMarker,
  isGapText,
  printable,
  shownUrl,
};
