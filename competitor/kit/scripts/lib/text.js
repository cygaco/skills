"use strict";
/**
 * lib/text.js - output neutralisation. Every piece of draft text reaches a
 * report through one of these functions.
 *
 * HTML: htmlEscape on every text path and every attribute value.
 * Markdown: raw HTML is escaped (< becomes &lt;), every character that could
 * start a link, an image, a link reference, a raw autolink or a table break is
 * backslash-escaped, and the colon after a URL scheme word (http, https,
 * javascript, data, mailto, ...) plus the dot after "www" are escaped so draft
 * text never turns into a link. The only links in a report are made by
 * mdLink / the HTML link renderer, from URLs that passed the URL check.
 */

const { hasUnsafeChar } = require("./guard");

const MAX_TEXT = 4000;
const GAP_DASH = String.fromCharCode(0x2014); // the em dash used in [GAP ...] markers
const INFERRED = "inferred, no source";
const UNVERIFIED = "unverified";

/**
 * Draft value to one clean line of text: non-text becomes "", control,
 * zero-width and bidirectional characters are dropped, whitespace runs become
 * one space, and the result is capped.
 */
function cleanText(value, max) {
  let s;
  if (typeof value === "string") s = value;
  else if (typeof value === "number" && Number.isFinite(value)) s = String(value);
  else if (typeof value === "boolean") s = String(value);
  else return "";
  let out = "";
  for (const ch of s) {
    if (/\s/.test(ch)) out += " ";
    else if (!hasUnsafeChar(ch)) out += ch;
  }
  out = out.replace(/ +/g, " ").trim();
  const cap = max || MAX_TEXT;
  if (out.length > cap) out = `${out.slice(0, cap)}...`;
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

const SCHEME_WORDS = /\b(https?|ftps?|mailto|xmpp|javascript|vbscript|data|file|wss?|tel|sms|irc|blob)(:)/gi;

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
  s = s.replace(SCHEME_WORDS, "$1\\:");
  s = s.replace(/\b(www)\./gi, "$1\\.");
  if (lineStart) s = s.replace(/^([#>+=-])/, "\\$1").replace(/^(\d+)([.)])/, "$1\\$2");
  return s;
}

/** A URL as display text: credentials are masked, unsafe characters made visible. */
function shownUrl(value) {
  const s = typeof value === "string" ? value.trim() : "";
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
  for (const ch of String(value)) {
    if (ch !== " " && hasUnsafeChar(ch)) out += `<U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}>`;
    else out += ch;
  }
  return out.length > 300 ? `${out.slice(0, 300)}...` : out;
}

module.exports = {
  MAX_TEXT,
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
