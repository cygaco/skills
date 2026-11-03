#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";
/**
 * selfcheck.js - tests the /competitor kit offline.
 *
 *   node .claude/competitor/scripts/selfcheck.js        (from any folder)
 *
 * Prints one line per check (ok / FAIL / SKIP) and a summary, and exits 0 only
 * if nothing failed. Everything resolves from this file's folder. Reports are
 * rendered into temporary repositories under the system temp folder, which are
 * removed at the end.
 *
 * The kit never starts a process, so the command line is exercised in-process:
 * report.run(argv, io) is exactly what `node report.js ...` runs, with the
 * output captured and the exit code returned.
 *
 * Covers: no process or network module anywhere in the kit; every URL-check
 * rule, with allowed controls (special-use ranges, embedded IPv4, the length
 * cap, linear trailing-dot handling); slugs and output confinement; check and
 * check-url, by argument and by file (--target-file, --file: confinement,
 * size, line rules, the 200-URL cap); the prepared output folder (created,
 * idempotent, links and junctions refused); writes through a temporary file
 * (hard links replaced, non-regular targets refused, a folder swapped
 * mid-write refused); a full brief in both formats; a hostile brief (escaping,
 * dropped rows, refused records, labels); the records tables (refused, failed,
 * other); every scheme:// in Markdown neutralised; bad drafts, the 5 MB draft
 * cap and the read-time string cap; missing and broken templates; unexpected
 * errors; the comparison with valid, missing, "..", absolute and drive-letter
 * path cites and "you said", feature rows without a fetched source, and file
 * cites on openings, risks and next steps; and every exit code. Also: run files
 * that check refuses (links, junctions, folders and hard-linked files named
 * draft.json, compare.json, urls.txt or a report, and links and hard-linked
 * files under any other name in that folder); the list caps, the cites
 * cap, the nesting and value limits, all counted before parsing; and folder,
 * "." and link cites rendering as unverified. Also: link addresses in
 * Markdown, where an address that passed the URL check but holds | [ ] ( ) or
 * other Markdown is percent-encoded and stays one table cell (the brief and the
 * comparison, an image form, an angle-bracket and backtick form, a plain
 * ?a=1&b=2#x address that must still work); [GAP] marker words escaped; and a
 * structural check over every Markdown report the run rendered: each table row,
 * split at every unescaped "|", has as many cells as its header.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const SCRIPTS = __dirname;
const KIT = path.join(__dirname, "..");
const TEMPLATES = path.join(KIT, "templates");
const FIXTURES = path.join(__dirname, "fixtures");

const report = require("./report");
const guard = require("./lib/guard");
const slugLib = require("./lib/slug");
const text = require("./lib/text");
const confine = require("./lib/confine");
const draftLib = require("./lib/draft");
const { BRIEF_FILES, COMPARE_FILES } = require("./lib/templates");
const { CEILING } = require("./lib/brief");

const LINK_TYPE = process.platform === "win32" ? "junction" : "dir";

/** Creates a folder link (a junction on Windows). Returns false when this system cannot. */
function linkDir(target, at) {
  try {
    fs.symlinkSync(target, at, LINK_TYPE);
    return true;
  } catch (e) {
    return false;
  }
}

/** The text of one "### title" section of a Markdown report, up to the next heading. */
function mdSection(md, title) {
  const at = md.indexOf(`### ${title}\n`);
  if (at < 0) return null;
  const rest = md.slice(at + title.length + 5);
  const next = rest.search(/^#{2,3} /m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** True when the Markdown has a "://" whose colon is not backslash-escaped. */
const liveScheme = (md) => /(^|[^\\]):\/\//m.test(md);

// ---------------------------------------------------------------- reporting

let nOk = 0;
let nFail = 0;
let nSkip = 0;
function ok(name) {
  nOk++;
  console.log(`ok    ${name}`);
}
function fail(name, detail) {
  nFail++;
  console.log(`FAIL  ${name}${detail ? `: ${String(detail).slice(0, 400)}` : ""}`);
}
function skip(name, why) {
  nSkip++;
  console.log(`SKIP  ${name} (${why})`);
}
function check(name, cond, detail) {
  if (cond) ok(name);
  else fail(name, typeof detail === "function" ? detail() : detail);
}
function section(name, fn) {
  try {
    fn();
  } catch (e) {
    fail(`${name} (threw)`, e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e);
  }
}

// ---------------------------------------------------------------- helpers

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "competitor-selfcheck-"));

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else if (ent.isFile()) fs.copyFileSync(s, d);
  }
}

let repoCount = 0;
/** A fresh copy of the sample repository. */
function makeRepo() {
  repoCount++;
  const dir = path.join(TMP, `repo-${repoCount}`);
  copyDir(path.join(FIXTURES, "sample-repo"), dir);
  return dir;
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

function putJson(repo, rel, value) {
  const file = path.join(repo, ...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2), "utf8");
  return file;
}

/** Runs one report.js command in-process; returns { code, out, err }. */
function cli(argv, opts) {
  const out = [];
  const err = [];
  const push = (arr) => (s) => arr.push(...String(s).split("\n"));
  const code = report.run(argv, {
    out: push(out),
    err: push(err),
    cwd: (opts && opts.cwd) || TMP,
    templatesDir: opts && opts.templatesDir,
  });
  return { code, out, err };
}

const read = (repo, rel) => fs.readFileSync(path.join(repo, ...rel.split("/")), "utf8");
const exists = (repo, rel) => fs.existsSync(path.join(repo, ...rel.split("/")));

function walkJs(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJs(p));
    else if (/\.(c|m)?js$/.test(ent.name)) out.push(p);
  }
  return out;
}

function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** Every href in HTML output. */
function htmlHrefs(html) {
  const out = [];
  const re = /\shref="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(decodeEntities(m[1]));
  return out;
}

/** Every link destination in Markdown output, and the text left without them. */
function mdLinks(md) {
  const out = [];
  const re = /\]\(<([^>\n]*)>\)/g;
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[1].replace(/&amp;/g, "&"));
  return { links: out, rest: md.replace(re, "]()") };
}

// The characters a Markdown link address must not carry raw, because Markdown
// or a table could act on them. This is the rule written out again, apart from
// the kit's own code, so the check does not trust the code it checks.
const MD_ACTIVE = "|[]()<>`*_!\\\"'" + " ";

/** The Markdown address the kit must emit for a checked href ("&amp;" left decoded, as mdLinks returns it). */
function mdDest(href) {
  const v6 = /^https?:\/\/\[[0-9A-Fa-f:.]+\]/.exec(href);
  const head = v6 ? v6[0] : "";
  const enc = (c) => (MD_ACTIVE.includes(c) ? `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}` : c);
  return head + [...href.slice(head.length)].map(enc).join("");
}

const htmlAttr = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * The cells of one Markdown table row, split at every "|" not preceded by a
 * backslash, the way a table is split before its links are read. The pipes
 * that open and close the row do not make cells.
 */
function mdRowCells(line) {
  const cells = [""];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|" && line[i - 1] !== "\\") cells.push("");
    else cells[cells.length - 1] += line[i];
  }
  if (line.startsWith("|")) cells.shift();
  if (cells.length && line.endsWith("|") && line[line.length - 2] !== "\\") cells.pop();
  return cells;
}

/** Every table in the Markdown (a run of lines starting with "|"), and every row whose cell count is not its header's. */
function mdTableShape(md) {
  const lines = md.split("\n");
  let tables = 0;
  let rows = 0;
  const bad = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) continue;
    const start = i;
    while (i + 1 < lines.length && lines[i + 1].startsWith("|")) i++;
    tables++;
    const head = mdRowCells(lines[start]).length;
    if (!/^\|(?:-{3,}\|)+$/.test(lines[start + 1] || "")) bad.push(`line ${start + 2}: no separator row under the header`);
    for (let j = start + 1; j <= i; j++) {
      rows++;
      const n = mdRowCells(lines[j]).length;
      if (n !== head) bad.push(`line ${j + 1}: ${n} cells, the header has ${head}: ${lines[j].slice(0, 200)}`);
    }
  }
  return { tables, rows, bad };
}

/** The text after every "](" whose "]" is not escaped (an even run of backslashes before it), up to the end of the line. */
function mdLinkTargets(md) {
  const out = [];
  for (let i = md.indexOf("]("); i >= 0; i = md.indexOf("](", i + 1)) {
    let k = i - 1;
    while (k >= 0 && md[k] === "\\") k--;
    if ((i - 1 - k) % 2 === 0) out.push(md.slice(i + 2).split("\n")[0].slice(0, 300));
  }
  return out;
}

/** A link address that is inert: <http(s)://...> with nothing a table or Markdown can act on, then ")". */
const INERT_TARGET = /^<https?:\/\/(?:\[[0-9A-Fa-f:.]+\])?[^\s|[\]()<>`*_!\\"']*>\)/;

/** Table structure of one rendered Markdown file. */
function assertTables(prefix, md, minTables) {
  const shape = mdTableShape(md);
  check(`${prefix} md tables: every row has as many cells as its header (split on unescaped "|")`, shape.bad.length === 0 && shape.tables >= (minTables || 1),
    () => `${shape.tables} tables, ${shape.rows} rows; ${shape.bad.slice(0, 3).join(" / ")}`);
}

/** No live javascript link, no image, every link address inert, every table row whole. */
function assertMdInert(prefix, md) {
  const low = md.toLowerCase();
  check(`${prefix} md has no "](javascript:" and no "![" anywhere`, md.length > 0 && !low.includes("](javascript:") && !low.includes("](<javascript:") && !md.includes("!["),
    () => (md.match(/.{0,60}(\]\(<?javascript:|!\[).{0,60}/i) || [md ? "" : "(no Markdown rendered)"])[0]);
  const bad = mdLinkTargets(md).filter((t) => !INERT_TARGET.test(t));
  check(`${prefix} md: every link opens an http(s) address with nothing Markdown or a table can act on`, md.length > 0 && bad.length === 0, () => bad.slice(0, 3).join(" / "));
  assertTables(prefix, md);
}

/** The hrefs a report may contain: source-record URLs that pass the URL check. */
function allowedHrefs(draft) {
  const set = new Set();
  for (const r of draft.source_records || []) {
    const g = guard.checkUrl(r.url);
    if (g.ok) set.add(g.href);
  }
  return set;
}

/** Shared assertions on a rendered pair: only allowed links, nothing executable. */
function assertNeutral(prefix, md, html, allowed) {
  const hrefs = htmlHrefs(html);
  check(`${prefix} html hrefs are checked source records only`, hrefs.length > 0 && hrefs.every((h) => allowed.has(h)), () => hrefs.filter((h) => !allowed.has(h)).join(" "));
  check(`${prefix} html has no src attribute and no event handler`, !/<[^>]*\s(src|on[a-z]+)\s*=/i.test(html));
  check(`${prefix} html has no script, iframe, img, svg or object tag`, !/<(script|iframe|img|svg|object|embed|form|base|meta http-equiv="refresh")/i.test(html));
  check(`${prefix} html carries the content security policy`, html.includes("Content-Security-Policy") && html.includes("default-src 'none'"));
  const { links, rest } = mdLinks(md);
  const allowedMd = new Set([...allowed].map(mdDest));
  check(`${prefix} md links are checked source records only`, links.length > 0 && links.every((h) => allowedMd.has(h)), () => links.filter((h) => !allowedMd.has(h)).join(" "));
  assertTables(prefix, md);
  const bare = rest.replace(/\]\(\)/g, "");
  check(`${prefix} md has no other link syntax`, !/(^|[^\\])\]\(/m.test(bare) && !/(^|[^\\])\]\[/m.test(bare) && !/^ {0,3}\[[^\]\n]*\]:/m.test(bare));
  check(`${prefix} md has no raw HTML or angle autolink`, !rest.includes("<"));
  check(`${prefix} md has no bare URL or www autolink`, !/https?:\/\//i.test(rest) && !/\bwww\./i.test(rest));
  check(`${prefix} md has no unescaped "://" after any scheme`, !liveScheme(rest), () => (rest.match(/.{0,30}[^\\]:\/\/.{0,30}/) || [""])[0]);
  check(`${prefix} md has no javascript, data or other script scheme`, !/\b(javascript|vbscript|data|file|mailto):/i.test(rest));
  check(`${prefix} md has no unescaped email autolink`, !/[A-Za-z0-9._%+-]@[A-Za-z0-9-]+\./.test(rest));
}

// ---------------------------------------------------------------- 1. the kit itself

function checkKit() {
  const files = walkJs(KIT);
  const CP = "child" + "_process";
  const hits = files.filter((f) => fs.readFileSync(f, "utf8").includes(CP));
  check("kit.no-process-module (no file in the kit names it)", files.length >= 10 && hits.length === 0, () => hits.map((f) => path.relative(KIT, f)).join(", "));

  const NET = ["http", "https", "http2", "net", "dns", "tls", "dgram"];
  const netReq = new RegExp(`(?:require\\s*\\(\\s*|from\\s+|import\\s*\\(\\s*)(['"\`])(?:node:)?(?:${NET.join("|")})\\1`);
  const netGlobal = new RegExp(["\\bfetch\\s*\\(", "XMLHttp" + "Request", "\\bWeb" + "Socket\\b", "create" + "Require", "process\\.bind" + "ing", "internal" + "Binding"].join("|"));
  const netHits = files.filter((f) => {
    const src = fs.readFileSync(f, "utf8");
    return netReq.test(src) || netGlobal.test(src);
  });
  check("kit.no-network-module (http, https, http2, net, dns, tls, dgram, fetch, sockets)", netHits.length === 0, () => netHits.map((f) => path.relative(KIT, f)).join(", "));

  const ALLOWED = new Set(["fs", "path", "os", "assert", "crypto", "url", "util"]);
  const bad = [];
  const reqRe = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    let m;
    while ((m = reqRe.exec(src)) !== null) {
      const spec = m[2].replace(/^node:/, "");
      if (spec.startsWith(".")) {
        const target = path.resolve(path.dirname(f), m[2]);
        const resolved = [target, `${target}.js`, path.join(target, "index.js")].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!resolved || !confine.inside(resolved, KIT)) bad.push(`${path.relative(KIT, f)} -> ${m[2]}`);
      } else if (!ALLOWED.has(spec)) bad.push(`${path.relative(KIT, f)} -> ${m[2]}`);
    }
  }
  check("kit.requires-stay-in-kit (stdlib fs, path, os, assert, crypto, url, util, or a kit file)", bad.length === 0, () => bad.join(", "));

  const missing = [...new Set([...BRIEF_FILES, ...COMPARE_FILES, "draft.schema.md"])].filter((f) => !fs.existsSync(path.join(TEMPLATES, f)));
  check("kit.templates-present", missing.length === 0, () => missing.join(", "));
  check("kit.templates-resolve-from-the-script-folder", path.resolve(report.TEMPLATES_DIR) === path.resolve(TEMPLATES));
  const src = fs.readFileSync(path.join(SCRIPTS, "report.js"), "utf8");
  check("cli.wrapper-returns-run-exit-code", /process\.exitCode = run\(process\.argv\.slice\(2\)\)/.test(src));
}

// ---------------------------------------------------------------- 2. the URL check

function checkGuard() {
  const cp = (...codes) => String.fromCodePoint(...codes);
  const refused = [
    // [rule, url, reason fragment]
    ["scheme ftp", "ftp://example.com/", "scheme"],
    ["scheme javascript", "javascript:alert(1)", "scheme"],
    ["scheme data", "data:text/html,x", "scheme"],
    ["scheme file", "file:///etc/passwd", "scheme"],
    ["credentials user:pass", "https://user:pass@example.com/", "credentials"],
    ["credentials user only", "https://user@example.com/", "credentials"],
    ["credentials without slashes", "http:user:pw@example.com", "credentials"],
    ["no host (unparseable)", "http://", "not a valid"],
    ["whitespace inside", "https://exa mple.com/", "whitespace"],
    ["tab inside", "https://example.com/a\tb", "whitespace"],
    ["bidi control inside", `https://example.com/${cp(0x202e)}x`, "control"],
    ["localhost", "http://localhost/", "localhost"],
    ["localhost uppercase with trailing dot", "http://LOCALHOST./", "localhost"],
    ["*.localhost", "http://app.localhost/", "localhost"],
    ["localhost in circled letters (normalised)", `http://${cp(0x24db, 0x24de, 0x24d2, 0x24d0, 0x24db, 0x24d7, 0x24de, 0x24e2, 0x24e3)}/`, "localhost"],
    ["*.local", "http://printer.local/", "*.local"],
    ["*.internal", "http://db.internal/", "*.internal"],
    ["*.home.arpa", "http://nas.home.arpa/", "*.home.arpa"],
    ["*.lan", "http://router.lan/", "*.lan"],
    ["single-label host", "http://intranet/", "single-label"],
    ["IPv4 0/8", "http://0.1.2.3/", "0.0.0.0/8"],
    ["IPv4 0 shorthand", "http://0/", "0.0.0.0/8"],
    ["IPv4 10/8", "http://10.0.0.1/", "10.0.0.0/8"],
    ["IPv4 100.64/10 low", "http://100.64.0.1/", "100.64.0.0/10"],
    ["IPv4 100.64/10 high", "http://100.127.255.255/", "100.64.0.0/10"],
    ["IPv4 127/8", "http://127.0.0.1/", "127.0.0.0/8"],
    ["IPv4 169.254/16", "http://169.254.169.254/latest", "169.254.0.0/16"],
    ["IPv4 172.16/12 low", "http://172.16.0.1/", "172.16.0.0/12"],
    ["IPv4 172.16/12 high", "http://172.31.255.255/", "172.16.0.0/12"],
    ["IPv4 192.168/16", "http://192.168.1.1/", "192.168.0.0/16"],
    ["IPv4 224/4 low", "http://224.0.0.1/", "224.0.0.0/4"],
    ["IPv4 224/4 high", "http://239.255.255.255/", "224.0.0.0/4"],
    ["IPv4 240/4", "http://240.0.0.1/", "240.0.0.0/4"],
    ["IPv4 255.255.255.255", "http://255.255.255.255/", "broadcast"],
    ["IPv4 decimal form", "http://2130706433/", "127.0.0.0/8"],
    ["IPv4 hex form", "http://0x7f.1/", "127.0.0.0/8"],
    ["IPv4 octal form", "http://017700000001/", "127.0.0.0/8"],
    ["IPv4 short form", "http://127.1/", "127.0.0.0/8"],
    ["IPv4 percent-encoded", "http://%31%32%37.0.0.1/", "127.0.0.0/8"],
    ["IPv4 fullwidth digits", `http://${cp(0xff11, 0xff12, 0xff17)}.${cp(0xff10)}.${cp(0xff10)}.${cp(0xff11)}/`, "127.0.0.0/8"],
    ["IPv4 trailing dots", "http://127.0.0.1../", "127.0.0.0/8"],
    ["IPv6 ::", "http://[::]/", "unspecified"],
    ["IPv6 ::1", "http://[::1]/", "loopback"],
    ["IPv6 fe80::/10 low", "http://[fe80::1]/", "fe80::/10"],
    ["IPv6 fe80::/10 high", "http://[febf::1]/", "fe80::/10"],
    ["IPv6 fec0::/10 site-local", "http://[fec0::1]/", "fec0::/10"],
    ["IPv6 fc00::/7 low", "http://[fc00::1]/", "fc00::/7"],
    ["IPv6 fc00::/7 high", "http://[fdff::1]/", "fc00::/7"],
    ["IPv6 ff00::/8", "http://[ff02::1]/", "ff00::/8"],
    ["IPv4-mapped 127.0.0.1", "http://[::ffff:127.0.0.1]/", "IPv4-mapped"],
    ["IPv4-mapped hex form", "http://[::ffff:7f00:1]/", "IPv4-mapped"],
    ["IPv4-mapped 10/8", "http://[::ffff:10.0.0.1]/", "10.0.0.0/8"],
    ["IPv4-mapped 169.254/16", "http://[::ffff:169.254.169.254]/", "169.254.0.0/16"],
    ["IPv4-mapped long form", "http://[0:0:0:0:0:ffff:192.168.0.1]/", "192.168.0.0/16"],
    ["IPv4-compatible 127.0.0.1", "http://[::127.0.0.1]/", "IPv4-compatible"],
    ["IPv4-compatible 10/8", "http://[::10.0.0.1]/", "10.0.0.0/8"],
    ["NAT64 embedding", "http://[64:ff9b::127.0.0.1]/", "NAT64"],
    ["6to4 embedding", "http://[2002:a9fe:a9fe::]/", "6to4"],
    // Special-use IPv4 and IPv6 ranges.
    ["special-use IPv4 192.0.0.0/24", "http://192.0.0.8/", "192.0.0.0/24"],
    ["special-use IPv4 192.0.2.0/24", "http://192.0.2.1/", "192.0.2.0/24"],
    ["special-use IPv4 192.88.99.0/24", "http://192.88.99.1/", "192.88.99.0/24"],
    ["special-use IPv4 198.18.0.0/15 low", "http://198.18.0.1/", "198.18.0.0/15"],
    ["special-use IPv4 198.18.0.0/15 high", "http://198.19.255.255/", "198.18.0.0/15"],
    ["special-use IPv4 198.51.100.0/24", "http://198.51.100.1/", "198.51.100.0/24"],
    ["special-use IPv4 203.0.113.0/24", "http://203.0.113.1/", "203.0.113.0/24"],
    ["special-use IPv6 2001:db8::/32", "http://[2001:db8::1]/", "2001:db8::/32"],
    ["special-use IPv4-mapped 192.0.2.1", "http://[::ffff:192.0.2.1]/", "192.0.2.0/24"],
    ["special-use IPv4-compatible 198.51.100.1", "http://[::198.51.100.1]/", "198.51.100.0/24"],
    ["NAT64 hex form of 127.0.0.1", "http://[64:ff9b::7f00:1]/", "NAT64"],
    ["special-use NAT64 form of 192.0.2.1", "http://[64:ff9b::c000:201]/", "NAT64 IPv6 form of 192.0.2.1"],
    ["special-use 6to4 form of 203.0.113.1", "http://[2002:cb00:7101::]/", "6to4 IPv6 form of 203.0.113.1"],
    ["special-use 6to4 form of 198.18.0.1", "http://[2002:c612:1::]/", "198.18.0.0/15"],
  ];
  for (const [rule, url, frag] of refused) {
    const r = guard.checkUrl(url);
    check(`guard.refuses ${rule}`, !r.ok && String(r.reason).includes(frag), () => JSON.stringify(r));
  }
  check("guard.refuses an empty host", guard.refuseHost("") === "empty host" && guard.refuseHost("...") === "empty host");

  // Length cap and linear trailing-dot handling.
  const atCap = `https://example.com/${"a".repeat(guard.MAX_URL - 20)}`;
  const overCap = `${atCap}a`;
  let r = guard.checkUrl(overCap);
  check("guard.refuses a URL over 2048 characters (URL too long)", !r.ok && /URL too long/.test(r.reason), () => JSON.stringify(r).slice(0, 200));
  check("guard.allows a URL of exactly 2048 characters", atCap.length === 2048 && guard.checkUrl(atCap).ok === true);
  r = guard.checkUrl(`https://example.com/${"x".repeat(5000000)}`);
  check("guard.refuses a 5,000,000-character URL as too long", !r.ok && /URL too long/.test(r.reason));
  let t0 = Date.now();
  const why = guard.refuseHost(`${".".repeat(200000)}a`);
  let ms = Date.now() - t0;
  check(`guard.a host of 200,000 dots and a letter is judged at once (${ms} ms)`, typeof why === "string" && ms < 500, () => `${why} after ${ms} ms`);
  const trim = typeof guard.trimTrailingDots === "function" ? guard.trimTrailingDots : null;
  t0 = Date.now();
  const trimmed = trim ? trim(`${"a.".repeat(5)}${".".repeat(1000000)}`) : null;
  const dotsBefore = trim ? trim(`${".".repeat(1000000)}a`) : null;
  ms = Date.now() - t0;
  check(`guard.trailing dots are trimmed in one linear pass (1,000,000 dots: ${ms} ms)`, trimmed === "a.a.a.a.a" && dotsBefore && dotsBefore.length === 1000001 && ms < 500, () => (trim ? `${ms} ms` : "no linear trim function"));
  const allowed = [
    ["normal https URL", "https://www.example.com/pricing"],
    ["public IPv4 8.8.8.8", "http://8.8.8.8/"],
    ["public IPv4 1.0.0.1", "http://1.0.0.1/"],
    ["public IPv6", "https://[2606:4700:4700::1111]/"],
    ["IPv4-mapped public address", "http://[::ffff:8.8.8.8]/"],
    ["just below 100.64/10", "http://100.63.255.255/"],
    ["just above 100.64/10", "http://100.128.0.1/"],
    ["just below 172.16/12", "http://172.15.255.255/"],
    ["just above 172.16/12", "http://172.32.0.1/"],
    ["next to 192.168/16", "http://192.169.0.1/"],
    ["just below 224/4", "http://223.255.255.255/"],
    ["port, query and fragment", "https://example.com:8443/a?b=1#c"],
    ["just below 192.0.0.0/24", "http://191.255.255.255/"],
    ["next to 192.0.2.0/24", "http://192.0.3.1/"],
    ["next to 192.88.99.0/24", "http://192.88.98.1/"],
    ["just below 198.18/15", "http://198.17.255.255/"],
    ["just above 198.18/15", "http://198.20.0.1/"],
    ["next to 198.51.100.0/24", "http://198.51.101.1/"],
    ["next to 203.0.113.0/24", "http://203.0.114.1/"],
    ["next to 2001:db8::/32", "http://[2001:db9::1]/"],
    ["NAT64 form of a public address", "http://[64:ff9b::808:808]/"],
  ];
  for (const [rule, url] of allowed) {
    const res = guard.checkUrl(url);
    check(`guard.allows ${rule}`, res.ok === true, () => JSON.stringify(res));
  }
  check("guard.normalises before judging", guard.checkUrl("HTTPS://WWW.Example.COM:443/x").href === "https://www.example.com/x");
  check("guard.cite match ignores fragment, case and trailing slash", guard.citeKey("https://Example.com/pricing/#plans") === guard.citeKey("https://example.com/pricing"));
}

// ---------------------------------------------------------------- 3. slugs and confinement

function checkSlugs() {
  check("slug.normalises a name", slugLib.normalizeSlug("Acme Notes!") === "acme-notes");
  check("slug.strips accents", slugLib.normalizeSlug("Caf" + String.fromCharCode(0xe9) + " D" + String.fromCharCode(0xe9) + "j" + String.fromCharCode(0xe0)) === "cafe-deja");
  check("slug.caps the length at 64", slugLib.normalizeSlug("x".repeat(90)).length === 64 && slugLib.normalizeSlug("ab-".repeat(30)).length <= 64 && !slugLib.normalizeSlug("ab-".repeat(30)).endsWith("-"));
  for (const r of ["con", "prn", "aux", "nul", "com1", "com9", "lpt1", "lpt9"]) {
    check(`slug.refuses the reserved name ${r}`, /reserved/.test(slugLib.refuseSlug(r) || ""));
  }
  check("slug.allows near-misses of reserved names (com10, console, nul1x)", !slugLib.refuseSlug("com10") && !slugLib.refuseSlug("console") && !slugLib.refuseSlug("nul1x"));
  for (const [what, s] of [["..", ".."], ["../ segment", "../evil"], ["absolute path", "/abs"], ["backslash path", "a\\b"], ["drive letter", "C:evil"], ["dot", "a.b"], ["uppercase", "Acme"], ["leading hyphen", "-a"], ["empty", ""], ["65 characters", "a".repeat(65)]]) {
    check(`slug.refuses ${what}`, Boolean(slugLib.refuseSlug(s)));
  }
  const root = path.join(TMP, "confine-root");
  fs.mkdirSync(root, { recursive: true });
  for (const [what, s] of [["..", ".."], ["../ escape", "../evil"], ["absolute path", path.join(TMP, "elsewhere")], ["drive letter", "C:evil"], ["nested path", "a/b"]]) {
    let threw = false;
    try {
      confine.outputDir(root, s);
    } catch (e) {
      threw = e instanceof confine.RefusedError;
    }
    check(`confine.output refuses ${what}`, threw);
  }
  check("confine.output stays under <repo>/competitor/<slug>/", confine.outputDir(root, "acme-notes") === path.join(path.resolve(root), "competitor", "acme-notes"));
}

// ---------------------------------------------------------------- 4. check and check-url

function checkCheck() {
  const repo = makeRepo();
  const at = { cwd: repo };
  let r = cli(["check", "--target", "Acme Notes"], at);
  check("check.name prints the slug and the prepared folder, exit 0", r.code === 0 && r.out.join("|") === "slug: acme-notes|dir: competitor/acme-notes/", () => JSON.stringify(r));
  r = cli(["check", "--target=https://www.Example.com/x"], at);
  check("check.url prints slug, normalised url and folder, exit 0", r.code === 0 && r.out.join("|") === "slug: example-com|url: https://www.example.com/x|dir: competitor/example-com/", () => JSON.stringify(r));
  const fresh = makeRepo();
  r = cli(["check", "--target", "http://127.0.0.1/"], { cwd: fresh });
  check("check.refused url exits 2 with refused: reason, and prepares no folder", r.code === 2 && /^refused: IPv4 127/.test(r.out[0] || "") && !exists(fresh, "competitor"), () => JSON.stringify(r));
  r = cli(["check", "--target", "javascript:alert(1)"], at);
  check("check.refused scheme exits 2", r.code === 2 && /^refused: scheme/.test(r.out[0] || ""));
  r = cli(["check", "--target", "CON"], at);
  check("check.reserved slug exits 2", r.code === 2 && /reserved/.test(r.out[0] || ""));
  r = cli(["check", "--target", String.fromCharCode(0x65e5, 0x672c)], at);
  check("check.name with no usable slug exits 2", r.code === 2 && /^refused: the slug is empty/.test(r.out[0] || ""));
  r = cli(["check", "--target", "a\u0007b"], at);
  check("check.name with control characters exits 2", r.code === 2 && /control/.test(r.out[0] || ""));
  r = cli(["check", "--target", "x".repeat(301)], at);
  check("check.a target over 300 characters is refused, exit 2", r.code === 2 && /^refused: the target is longer than 300 characters/.test(r.out[0] || ""), () => JSON.stringify(r.out));
  for (const [what, argv] of [
    ["no target", ["check"]],
    ["target without a value", ["check", "--target"]],
    ["unknown flag", ["check", "--target", "x", "--bogus", "1"]],
    ["extra argument", ["check", "--target", "x", "extra"]],
    ["no subcommand", []],
    ["unknown subcommand", ["fetch", "x"]],
  ]) {
    r = cli(argv);
    check(`cli.usage error exits 2 (${what})`, r.code === 2 && r.err.some((l) => l.startsWith("usage error:")) && r.out.length === 0, () => JSON.stringify(r));
  }
  r = cli(["--help"]);
  check("cli.help exits 0", r.code === 0 && r.out.join("\n").includes("check-url"));

  const urls = ["https://www.example.com/", "http://127.1/", "javascript:alert(1)", "https://user:pw@example.com/", "https://docs.example.com/start"];
  r = cli(["check-url", ...urls]);
  const want = [
    "ok https://www.example.com/",
    "refused http://127.1/: IPv4 127.0.0.0/8 (loopback)",
    "refused javascript:alert(1): scheme must be http or https, not javascript",
    "refused https://***@example.com/: contains credentials (user:pass@)",
    "ok https://docs.example.com/start",
  ];
  check("check-url.mixed list prints one right line per URL and exits 2", r.code === 2 && r.out.join("\n") === want.join("\n"), () => JSON.stringify(r.out));
  check("check-url.never prints a password", !r.out.join("\n").includes("pw@"));
  r = cli(["check-url", "https://www.example.com/", "http://8.8.8.8/"]);
  check("check-url.all ok exits 0", r.code === 0 && r.out.length === 2 && r.out.every((l) => l.startsWith("ok ")));
  r = cli(["check-url"]);
  check("check-url.no URL is a usage error, exit 2", r.code === 2 && r.err.some((l) => l.startsWith("usage error:")));
  r = cli(["check-url", `https://example.com/${"a".repeat(3000)}`]);
  check("check-url.a URL over 2048 characters is refused as too long", r.code === 2 && /^refused https:\/\/example\.com\/a+\.\.\.: URL too long/.test(r.out[0] || ""), () => JSON.stringify(r.out).slice(0, 300));
}

// ---------------------------------------------------------------- 4b. input files: check --target-file, check-url --file

function checkInputFiles() {
  const repo = makeRepo();
  const at = { cwd: repo };
  const outsideDir = path.join(TMP, `outside-input-${repoCount}`);
  fs.mkdirSync(outsideDir, { recursive: true });
  const outsideFile = path.join(outsideDir, "urls.txt");
  fs.writeFileSync(outsideFile, "https://www.example.com/\n");

  // check-url --file
  putJson(repo, "competitor/acme-notes/urls.txt", [
    "# links found on the pricing page",
    "",
    "  https://www.example.com/  ",
    "https://evil.example/$(whoami)",
    "http://127.0.0.1/",
    "   ",
    "https://docs.example.com/start",
  ].join("\n"));
  let r = cli(["check-url", "--file", "competitor/acme-notes/urls.txt"], at);
  const want = [
    "ok https://www.example.com/",
    "ok https://evil.example/$(whoami)",
    "refused http://127.0.0.1/: IPv4 127.0.0.0/8 (loopback)",
    "ok https://docs.example.com/start",
  ];
  check("file-input.check-url --file checks one URL per line, skipping blank and # lines (exit 2: one refused)", r.code === 2 && r.out.join("\n") === want.join("\n"), () => JSON.stringify(r));
  check("file-input.a $(...) in a URL read from the file is printed as plain data", r.out.includes("ok https://evil.example/$(whoami)"));
  putJson(repo, "competitor/acme-notes/ok.txt", "https://www.example.com/\r\nhttps://docs.example.com/start\r\n");
  r = cli(["check-url", "--file=competitor/acme-notes/ok.txt"], at);
  check("file-input.check-url --file with only ok URLs exits 0 (CRLF lines)", r.code === 0 && r.out.length === 2 && r.out.every((l) => l.startsWith("ok ")), () => JSON.stringify(r));
  const many = Array.from({ length: 205 }, (_, i) => `https://www.example.com/p${i + 1}`);
  putJson(repo, "competitor/acme-notes/many.txt", many.join("\n"));
  r = cli(["check-url", "--file", "competitor/acme-notes/many.txt"], at);
  check("file-input.check-url --file checks at most 200 URLs and refuses the rest unchecked", r.code === 2 && r.out.length === 205 && r.out.slice(0, 200).every((l) => l.startsWith("ok ")) &&
    r.out.slice(200).every((l) => l.startsWith("refused ") && l.includes("not checked")) && r.out[200].startsWith("refused https://www.example.com/p201: not checked"), () => JSON.stringify(r.out.slice(198)));
  r = cli(["check-url", "--file", outsideFile], at);
  check("file-input.check-url --file outside the repository is refused, exit 2", r.code === 2 && r.out.length === 1 && /^refused: --file must name a file inside this repository/.test(r.out[0] || ""), () => JSON.stringify(r));
  r = cli(["check-url", "--file", path.join("..", path.basename(outsideDir), "urls.txt")], at);
  check("file-input.check-url --file that climbs out with .. is refused, exit 2", r.code === 2 && /^refused: --file must name a file inside this repository/.test(r.out[0] || ""), () => JSON.stringify(r));
  if (linkDir(outsideDir, path.join(repo, "linked-out"))) {
    r = cli(["check-url", "--file", "linked-out/urls.txt"], at);
    check("file-input.check-url --file through a link that leaves the repository is refused", r.code === 2 && /^refused: --file must name a file inside this repository/.test(r.out[0] || ""), () => JSON.stringify(r));
  } else skip("file-input.check-url --file through a link that leaves the repository is refused", "cannot create a link here");
  putJson(repo, "competitor/acme-notes/big.txt", `https://www.example.com/\n${"#".repeat(70 * 1024)}\n`);
  r = cli(["check-url", "--file", "competitor/acme-notes/big.txt"], at);
  check("file-input.check-url --file over 64 KB is refused, exit 2", r.code === 2 && /^refused: --file is larger than 64 KB/.test(r.out[0] || ""), () => JSON.stringify(r));
  r = cli(["check-url", "--file", "competitor/acme-notes/none.txt"], at);
  check("file-input.check-url --file that does not exist is refused, exit 2", r.code === 2 && /^refused: --file: no such file/.test(r.out[0] || ""), () => JSON.stringify(r));
  r = cli(["check-url", "--file", "competitor"], at);
  check("file-input.check-url --file naming a folder is refused, exit 2", r.code === 2 && /^refused: --file/.test(r.out[0] || ""), () => JSON.stringify(r));
  r = cli(["check-url", "--file", "competitor/acme-notes/ok.txt", "https://www.example.com/"], at);
  check("file-input.check-url with --file and URLs together is a usage error", r.code === 2 && r.err.some((l) => l.startsWith("usage error:")) && r.out.length === 0);

  // check --target-file
  putJson(repo, "target.txt", "\n\n  Acme Notes  \nsecond line is ignored\n");
  r = cli(["check", "--target-file", "target.txt"], at);
  check("file-input.check --target-file reads the first non-blank line", r.code === 0 && r.out.join("|") === "slug: acme-notes|dir: competitor/acme-notes/", () => JSON.stringify(r));
  putJson(repo, "target-url.txt", "https://www.Example.com/$(whoami)\n");
  r = cli(["check", "--target-file", "target-url.txt"], at);
  check("file-input.check --target-file with a URL prints slug, url and folder; $(...) stays data", r.code === 0 && r.out.join("|") === "slug: example-com|url: https://www.example.com/$(whoami)|dir: competitor/example-com/", () => JSON.stringify(r));
  putJson(repo, "long-target.txt", `${"x".repeat(301)}\n`);
  r = cli(["check", "--target-file", "long-target.txt"], at);
  check("file-input.check --target-file with a target over 300 characters is refused, exit 2", r.code === 2 && /^refused: the target is longer than 300 characters/.test(r.out[0] || ""), () => JSON.stringify(r));
  r = cli(["check", "--target-file", outsideFile], at);
  check("file-input.check --target-file outside the repository is refused, exit 2", r.code === 2 && /^refused: --target-file must name a file inside this repository/.test(r.out[0] || ""), () => JSON.stringify(r));
  putJson(repo, "big-target.txt", `Acme\n${" ".repeat(70 * 1024)}`);
  r = cli(["check", "--target-file", "big-target.txt"], at);
  check("file-input.check --target-file over 64 KB is refused, exit 2", r.code === 2 && /^refused: --target-file is larger than 64 KB/.test(r.out[0] || ""), () => JSON.stringify(r));
  putJson(repo, "blank-target.txt", "\n   \n");
  r = cli(["check", "--target-file", "blank-target.txt"], at);
  check("file-input.check --target-file with no target line is a usage error", r.code === 2 && r.err.some((l) => l.startsWith("usage error:")) && r.out.length === 0, () => JSON.stringify(r));
  r = cli(["check", "--target", "Acme", "--target-file", "target.txt"], at);
  check("file-input.check with --target and --target-file together is a usage error", r.code === 2 && r.err.some((l) => l.startsWith("usage error:")) && r.out.length === 0);
}

// ---------------------------------------------------------------- 4c. the prepared output folder

function checkDirPrep() {
  const repo = makeRepo();
  let r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
  const st = (rel) => fs.lstatSync(path.join(repo, ...rel.split("/")));
  check("dir.check creates competitor/ and competitor/<slug>/ as real folders and prints dir:", r.code === 0 && r.out.includes("dir: competitor/acme-notes/") &&
    st("competitor").isDirectory() && !st("competitor").isSymbolicLink() && st("competitor/acme-notes").isDirectory() && !st("competitor/acme-notes").isSymbolicLink(), () => JSON.stringify(r));
  r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
  check("dir.check on an already prepared folder exits 0 again", r.code === 0 && r.out.includes("dir: competitor/acme-notes/"));

  const outside = path.join(TMP, `dir-outside-${repoCount}`);
  fs.mkdirSync(outside, { recursive: true });
  const repo2 = makeRepo();
  fs.mkdirSync(path.join(repo2, "competitor"));
  if (linkDir(outside, path.join(repo2, "competitor", "acme-notes"))) {
    r = cli(["check", "--target", "Acme Notes"], { cwd: repo2 });
    check("dir.check refuses a linked competitor/<slug> (exit 2, no slug printed)", r.code === 2 && r.out.length === 1 && /^refused: competitor\/acme-notes\/ is a symbolic link or junction/.test(r.out[0] || "") && fs.readdirSync(outside).length === 0, () => JSON.stringify(r));
    putJson(repo2, "draft.json", fixture("draft-full.json"));
    r = cli(["brief", "--draft", "draft.json"], { cwd: repo2 });
    check("dir.brief refuses a linked competitor/<slug> too (exit 2, nothing written outside)", r.code === 2 && /^refused: competitor\/acme-notes\/ is a symbolic link or junction/.test(r.out[0] || "") && fs.readdirSync(outside).length === 0, () => JSON.stringify(r));
  } else skip("dir.check refuses a linked competitor/<slug>", "cannot create a link here");
  const repo3 = makeRepo();
  if (linkDir(outside, path.join(repo3, "competitor"))) {
    r = cli(["check", "--target", "Acme Notes"], { cwd: repo3 });
    check("dir.check refuses a linked competitor/ folder (exit 2, nothing created outside)", r.code === 2 && /^refused: competitor\/ is a symbolic link or junction/.test(r.out[0] || "") && fs.readdirSync(outside).length === 0, () => JSON.stringify(r));
  } else skip("dir.check refuses a linked competitor/ folder", "cannot create a link here");
  const repo4 = makeRepo();
  fs.writeFileSync(path.join(repo4, "competitor"), "a file where the folder should be");
  r = cli(["check", "--target", "Acme Notes"], { cwd: repo4 });
  check("dir.check refuses when competitor is a file, not a folder", r.code === 2 && /^refused: competitor\/ is not a folder/.test(r.out[0] || ""), () => JSON.stringify(r));
  const repo5 = makeRepo();
  fs.mkdirSync(path.join(repo5, "competitor"));
  fs.writeFileSync(path.join(repo5, "competitor", "acme-notes"), "a file where the folder should be");
  r = cli(["check", "--target", "Acme Notes"], { cwd: repo5 });
  check("dir.check refuses when competitor/<slug> is a file, not a folder", r.code === 2 && /^refused: competitor\/acme-notes\/ is not a folder/.test(r.out[0] || ""), () => JSON.stringify(r));
}

// ---------------------------------------------------------------- 5. the brief

const BRIEF_TITLES = ["Product identity", "Jobs to be done", "Features", "Voice of customer", "Gaps", "Opportunities", "Source attribution log"];

function checkBriefFull() {
  const repo = makeRepo();
  const draft = fixture("draft-full.json");
  putJson(repo, "competitor/acme-notes/draft.json", draft);
  const r = cli(["brief", "--draft", "competitor/acme-notes/draft.json"], { cwd: repo });
  check("brief.full exits 0 with the repo root defaulting to the working folder", r.code === 0, () => JSON.stringify(r));
  check("brief.full prints at most 6 lines", r.out.length >= 4 && r.out.length <= 6, () => JSON.stringify(r.out));
  check("brief.full names both files", r.out[0] === "wrote competitor/acme-notes/acme-notes.competitor.md" && r.out[1] === "wrote competitor/acme-notes/acme-notes.competitor.html", () => JSON.stringify(r.out));
  check("brief.full reports 0 dropped, 0 refused, 0 gaps", r.out.includes("rows dropped: 0") && r.out.includes("records refused: 0") && r.out.includes("gaps: 0 [GAP] markers"), () => JSON.stringify(r.out));
  check("brief.full writes nothing to stderr", r.err.length === 0, () => r.err.join(" | "));
  const md = read(repo, "competitor/acme-notes/acme-notes.competitor.md");
  const html = read(repo, "competitor/acme-notes/acme-notes.competitor.html");
  check("brief.full md and html written", md.length > 500 && html.length > 1000);
  check("brief.full has no [GAP in any filled section (md, html)", !md.includes("[GAP") && !html.includes("[GAP"));
  check("brief.full has every section title (md, html)", BRIEF_TITLES.every((t) => md.includes(t) && html.includes(t)));
  check("brief.full attribution log carries the ceiling sentence verbatim (md, html)", md.includes(CEILING) && html.includes(CEILING) && CEILING === "every quote cites a page this session fetched; the engine cannot prove the quote is on that page.");
  check("brief.full renders every feature and quote row", ["F1", "F2", "F3", "F4", "Q1", "Q2", "Q3"].every((id) => md.includes(`| ${id} |`)));
  check("brief.full has no inferred label when every row is sourced", !md.includes("inferred, no source*") && r.out.includes("inferred, no source: 0 rows"));
  const refusedTable = mdSection(md, "Refused by the URL check (not fetched)") || "";
  check("brief.full lists the refused-before-fetch record quietly under its own heading", /\| S8 \| http\\:\/\/192\.168\.1\.10\/admin \| landing \| refused \|/.test(refusedTable), () => refusedTable);
  assertNeutral("brief.full", md, html, allowedHrefs(draft));

  const elsewhere = path.join(TMP, "elsewhere-cwd");
  fs.mkdirSync(elsewhere, { recursive: true });
  const r2 = cli(["brief", "--draft", path.join(repo, "competitor", "acme-notes", "draft.json"), "--repo-root", repo], { cwd: elsewhere });
  check("brief.--repo-root writes under that root, not the working folder", r2.code === 0 && !fs.existsSync(path.join(elsewhere, "competitor")) && exists(repo, "competitor/acme-notes/acme-notes.competitor.md"));
}

function checkBriefHostile() {
  const repo = makeRepo();
  const draft = fixture("draft-hostile.json");
  putJson(repo, "competitor/hostile-co/draft.json", draft);
  const r = cli(["brief", "--draft", "competitor/hostile-co/draft.json"], { cwd: repo });
  check("brief.hostile exits 0", r.code === 0, () => JSON.stringify(r));
  const refusedLines = r.err.filter((l) => l.startsWith("REFUSED SOURCE RECORD "));
  check("brief.hostile logs each refused record loudly on stderr", refusedLines.length === 4 &&
    refusedLines[0] === "REFUSED SOURCE RECORD http://127.0.0.1/admin: IPv4 127.0.0.0/8 (loopback)" &&
    refusedLines[1].startsWith("REFUSED SOURCE RECORD javascript:alert(1): scheme") &&
    refusedLines[2].includes("169.254.169.254") &&
    refusedLines[3].startsWith("REFUSED SOURCE RECORD https://***@www.example.com/: contains credentials"), () => JSON.stringify(r.err));
  check("brief.hostile does not flag a record refused before fetch", !r.err.some((l) => l.includes("data:text")));
  check("brief.hostile prints the counts", r.out.includes("gaps: 1 [GAP] marker") && r.out.includes("inferred, no source: 4 rows") &&
    r.out.some((l) => l.startsWith("rows dropped: 4")) && r.out.some((l) => l.startsWith("records refused: 4")), () => JSON.stringify(r.out));
  const md = read(repo, "competitor/hostile-co/hostile-co.competitor.md");
  const html = read(repo, "competitor/hostile-co/hostile-co.competitor.html");
  assertNeutral("brief.hostile", md, html, allowedHrefs(draft));
  check("brief.hostile allows only the two clean ok records as links", new Set(htmlHrefs(html)).size === 2 && htmlHrefs(html).every((h) => h === "https://www.example.com/" || h === "https://reviews.example.org/hostile"));
  check("brief.hostile never prints a password", !md.includes("secret") && !html.includes("secret") && !r.err.join("").includes("secret"));
  check("brief.hostile escapes raw HTML in md", md.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && md.includes("&lt;svg onload=alert(1)&gt;"));
  check("brief.hostile escapes raw HTML in html", html.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && html.includes("&lt;svg onload=alert(1)&gt;") && !/<(script|svg|iframe|img)/i.test(html));
  check("brief.hostile neutralises Markdown links and images in draft text", md.includes("\\[x\\](data\\:text") && md.includes("!\\[pixel\\](https\\://evil.example/p.png)"));
  check("brief.hostile does not expand template placeholders in draft text", md.includes("{{sections}}") && (md.match(/^## 01 /gm) || []).length === 1);
  check("brief.hostile keeps a heading marker in a cell as text", md.includes("| G2 | \\# Heading injection"));
  check("brief.hostile escapes table pipes in draft text", md.includes("\\| col \\| break"));
  check("brief.hostile drops features and quotes without a valid cite, and logs them", ["F1 (Sync)", "F3 (Export)", "Q2 (", "Q3 ("].every((s) => md.includes(`| ${s}`)) && !md.includes("| F1 | Sync") && md.includes("| F2 |"));
  check("brief.hostile labels unsourced jobs, gaps and opportunities", /- \*\*J1\..*\*inferred, no source\*/.test(md) && /- \*\*J2\..*\*inferred, no source\*/.test(md) && /\| G1 \|.*\| \*inferred, no source\* \|/.test(md) && /- \*\*O1\.\*\*.*\*inferred, no source\*/.test(md));
  check("brief.hostile treats an opportunity built on a sourced row as sourced", /- \*\*O2\.\*\* Build on search \(builds on F2\)$/m.test(md));
  check("brief.hostile ignores a cite to a missing row and logs it", md.includes("| O2 | G9 | not a kept row of this brief |"));
  check("brief.hostile shows a [GAP] for an identity without a first-party cite", md.includes("[GAP — identity — no fetched page from the product's own site is cited") && !md.includes("click me"));
  check("brief.hostile lists refused records in the attribution log, not as links", md.includes("### Refused source records") && md.includes("| S2 | http\\://127.0.0.1/admin | ok |") && html.includes("Refused source records"));
  check("brief.hostile marks unknown enums unrated", md.includes("| unrated | unrated |") && md.includes("| G2 | \\# Heading injection &lt;svg onload=alert(1)&gt; | unrated |"));
}

/** The records tables: refused before any fetch, fetch failed, and other statuses, each under its own heading. */
function checkRecordTables() {
  const repo = makeRepo();
  const draft = fixture("draft-full.json");
  draft.source_records = draft.source_records.concat([
    { url: "https://reviews.example.net/acme", source_class: "review", status: "failed", failure_reason: "HTTP 403 Forbidden", retrieved_at: "2026-11-01T09:12:00Z" },
    { url: "https://www.example.com/about", source_class: "product", status: "ok", retrieved_at: "2026-11-01T09:20:00Z" },
    { url: "https://www.example.com/blog", source_class: "product", status: "skipped", retrieved_at: "2026-11-01T09:21:00Z" },
  ]);
  putJson(repo, "competitor/acme-notes/draft.json", draft);
  const r = cli(["brief", "--draft", "competitor/acme-notes/draft.json"], { cwd: repo });
  const md = read(repo, "competitor/acme-notes/acme-notes.competitor.md");
  const html = read(repo, "competitor/acme-notes/acme-notes.competitor.html");
  const failed = mdSection(md, "Fetch failed") || "";
  const refusedFirst = mdSection(md, "Refused by the URL check (not fetched)") || "";
  const other = mdSection(md, "Other records (status missing or not recognised)") || "";
  check("records.failed fetches (HTTP 403, 404) sit under Fetch failed, not with refused records", r.code === 0 && failed.includes("| S7 |") && failed.includes("| S9 |") && failed.includes("HTTP 403 Forbidden") && !failed.includes("| S8 |"), () => failed || md.slice(-1500));
  check("records.refused-before-fetch records sit under Refused by the URL check (not fetched)", refusedFirst.includes("| S8 |") && !refusedFirst.includes("| S7 |") && !refusedFirst.includes("| S9 |"), () => refusedFirst);
  check("records.an unknown status sits under its own heading", other.includes("| S11 |") && other.includes("unknown (skipped)"), () => other);
  check("records.no mixed Not fetched heading remains (md, html)", !md.includes("### Not fetched") && html.includes("<h3>Fetch failed</h3>") && html.includes("<h3>Refused by the URL check (not fetched)</h3>"));
  check("records.a record without a length shows a blank Length cell", /\| S10 \| \[[^\]]+\]\(<https:\/\/www\.example\.com\/about>\) \| product \| +\| 2026-11-01T09:20:00Z \|/.test(md), () => (md.match(/\| S10 \|.*$/m) || [""])[0]);
  assertNeutral("records", md, html, allowedHrefs(draft));
}

/** Every scheme:// in draft text is neutralised in Markdown, whatever precedes it. */
function checkMdSchemes() {
  const repo = makeRepo();
  const draft = {
    generated_at: "2026-11-01T09:30:00Z",
    target: { slug: "x-co", name: "X Co xhttp://127.0.0.1/" },
    source_records: [],
    jtbds: [{ job: "see xhttp://127.0.0.1/ and xftp://evil.example/", why: "Ahttps://evil.example/x _http://evil.example" }],
    gaps: [{ gap: "1http://evil.example/ x://evil.example/ a.b+c://evil.example/ xwww.evil.example" }],
    opportunities: [{ opportunity: "javascript\\://x and xmailto:someone" }],
  };
  putJson(repo, "competitor/x-co/draft.json", draft);
  const r = cli(["brief", "--draft", "competitor/x-co/draft.json"], { cwd: repo });
  const md = read(repo, "competitor/x-co/x-co.competitor.md");
  check("md.brief with no sources renders, exit 0", r.code === 0, () => JSON.stringify(r));
  check("md.no scheme:// in draft text stays live, whatever precedes it (xhttp, xftp, Ahttps, _http, 1http, x://)", !liveScheme(md), () => (md.match(/.{0,30}[^\\]:\/\/.{0,30}/) || [""])[0]);
  check("md.the report holds no link at all when no source passed the URL check", !/\]\(/.test(md.replace(/\\\]\(/g, "")) && !/\bhref=/.test(read(repo, "competitor/x-co/x-co.competitor.html")));
  check("md.a www. inside a word is neutralised too", md.includes("xwww\\.evil") && !/(^|[^\\])www\./i.test(md.replace(/www\\\./gi, "")), () => (md.match(/.{0,20}www.{0,20}/i) || [""])[0]);
  assertTables("md.brief with no sources", md);
}

function checkBriefBad() {
  const base = fixture("draft-full.json");
  const variants = [
    ["not JSON", "{ this is not json"],
    ["a JSON list", "[]"],
    ["no generated_at", { ...base, generated_at: undefined }],
    ["generated_at without a time zone", { ...base, generated_at: "2026-11-01T09:30:00" }],
    ["generated_at that is not a date", { ...base, generated_at: "yesterday" }],
    ["no target", { ...base, target: undefined }],
    ["target with no name or url", { ...base, target: { resolved_via: "x" } }],
    ["target.slug with ..", { ...base, target: { ...base.target, slug: "../evil" } }],
    ["target.slug absolute", { ...base, target: { ...base.target, slug: "/abs" } }],
    ["target.slug with a drive letter", { ...base, target: { ...base.target, slug: "C:evil" } }],
    ["target.slug reserved", { ...base, target: { ...base.target, slug: "con" } }],
    ["target without a slug", { ...base, target: { name: "Acme Notes", url: "https://www.example.com/" } }],
    ["target.slug that is empty", { ...base, target: { ...base.target, slug: "" } }],
    ["features that is not a list", { ...base, features: { name: "x" } }],
    ["a source record that is not an object", { ...base, source_records: ["https://www.example.com/"] }],
    ["product_identity that is not an object", { ...base, product_identity: "text" }],
  ];
  variants.forEach(([what, value], i) => {
    const repo = makeRepo();
    putJson(repo, `bad-${i}.json`, value);
    const r = cli(["brief", "--draft", `bad-${i}.json`], { cwd: repo });
    check(`brief.bad draft exits 2 and writes nothing (${what})`, r.code === 2 && r.err.some((l) => l.startsWith("bad draft:")) && !fs.existsSync(path.join(repo, "competitor")), () => JSON.stringify(r));
  });
  const repo = makeRepo();
  let r = cli(["brief", "--draft", "missing.json"], { cwd: repo });
  check("brief.missing draft file exits 2", r.code === 2 && r.err.some((l) => l.startsWith("bad draft:")));
  r = cli(["brief"], { cwd: repo });
  check("brief.no --draft is a usage error, exit 2", r.code === 2 && r.err.some((l) => l.startsWith("usage error:")));
  putJson(repo, "d.json", base);
  r = cli(["brief", "--draft", "d.json", "--repo-root", "no-such-folder"], { cwd: repo });
  check("brief.--repo-root that does not exist exits 2", r.code === 2 && r.err.some((l) => l.includes("--repo-root")));
  r = cli(["brief", "--draft", "d.json", "--out", "x"], { cwd: repo });
  check("brief.unknown flag exits 2", r.code === 2);
  putJson(repo, "noslug.json", { ...base, target: { name: "Acme Notes" } });
  r = cli(["brief", "--draft", "noslug.json"], { cwd: repo });
  check("schema.target.slug is required and the error says to copy it from check", r.code === 2 && r.err.some((l) => /target\.slug is required: copy the slug that report\.js check printed/.test(l)), () => JSON.stringify(r));
}

/** Size limits: the 5 MB draft cap, the read-time string cap, and caps on the cut values. */
function checkLimits() {
  const base = fixture("draft-full.json");
  const repo = makeRepo();
  putJson(repo, "big.json", { ...base, jtbds: [{ job: "Big", why: "x".repeat(5.5 * 1024 * 1024) }] });
  let r = cli(["brief", "--draft", "big.json"], { cwd: repo });
  check("limits.a draft file over 5 MB is refused (exit 2, nothing written)", r.code === 2 && r.err.some((l) => l.startsWith("bad draft:") && l.includes("larger than 5 MB")) && !exists(repo, "competitor"), () => JSON.stringify(r).slice(0, 300));
  putJson(repo, "cmp-big.json", { generated_at: "2026-11-03T10:00:00Z", positioning: ["y".repeat(5.5 * 1024 * 1024)] });
  putJson(repo, "d.json", base);
  r = cli(["compare", "--draft", "cmp-big.json", "--brief", "d.json"], { cwd: repo });
  check("limits.a compare.json over 5 MB is refused too (exit 2)", r.code === 2 && r.err.some((l) => l.includes("larger than 5 MB")), () => JSON.stringify(r).slice(0, 300));

  putJson(repo, "clamp.json", { ...base, note: "n".repeat(100000), nested: [{ deep: [{ deeper: "z".repeat(50000) }] }] });
  const doc = draftLib.readJsonFile(path.join(repo, "clamp.json"), "draft");
  check("limits.every string is cut to 8192 characters when the draft is read, nested ones too", doc.note.length === text.MAX_FIELD + 1 && doc.nested[0].deep[0].deeper.length === text.MAX_FIELD + 1 && doc.target.name === base.target.name, () => `${doc.note.length} ${doc.nested[0].deep[0].deeper.length}`);
  check("limits.cleanText cuts its input to 8192 characters before reading it", text.cleanText(`a${" ".repeat(9000)}b`) === "a..." && text.cleanText("w".repeat(4000)) === "w".repeat(4000), () => text.cleanText(`a${" ".repeat(9000)}b`).slice(0, 40));
  check("limits.printable reads only what it can show", text.printable("p".repeat(1000000)) === `${"p".repeat(300)}...`);
  check("limits.a path cite over 1024 characters is unverified without being read", /longer than 1024/.test(confine.verifyCite(`${"a/".repeat(1000)}x`, repo).reason || ""));

  // A cut value can never pass a check its full text would fail.
  const sneaky = JSON.parse(JSON.stringify(base));
  sneaky.source_records.push({ url: `https://www.example.com/pricing${" ".repeat(9000)}x`, source_class: "product", status: "ok", retrieved_at: "2026-11-01T09:30:00Z" });
  sneaky.source_records.push({ url: "https://www.example.com/team", source_class: "product", status: `ok${" ".repeat(9000)}x`, retrieved_at: "2026-11-01T09:30:00Z" });
  sneaky.features.push({ name: "Team page", description: "cited to a record whose status was cut", complexity: "S", coreness: 1, evidence_url: "https://www.example.com/team" });
  putJson(repo, "competitor/acme-notes/draft.json", sneaky);
  r = cli(["brief", "--draft", "competitor/acme-notes/draft.json"], { cwd: repo });
  const md = read(repo, "competitor/acme-notes/acme-notes.competitor.md");
  check("limits.a cut URL never passes the URL check (logged as a refused record)", r.code === 0 && r.err.some((l) => l.startsWith("REFUSED SOURCE RECORD https://www.example.com/pricing") && l.endsWith("URL too long (more than 2048 characters)")), () => JSON.stringify(r.err).slice(0, 400));
  check("limits.a cut status never reads as ok (the feature citing it is dropped)", md.includes("| F5 (Team page) | evidence\\_url: its source record S10 has status unknown"), () => (md.match(/\| F5 .*$/m) || ["(no F5 row)"])[0]);

  // A huge field inside the 5 MB cap renders, capped at 4,000 characters.
  const huge = JSON.parse(JSON.stringify(base));
  huge.gaps[0].gap = "q".repeat(4 * 1024 * 1024);
  putJson(repo, "competitor/acme-notes/draft.json", huge);
  const t0 = Date.now();
  r = cli(["brief", "--draft", "competitor/acme-notes/draft.json"], { cwd: repo });
  const ms = Date.now() - t0;
  const md2 = read(repo, "competitor/acme-notes/acme-notes.competitor.md");
  const html2 = read(repo, "competitor/acme-notes/acme-notes.competitor.html");
  check(`limits.a 4 MB text field renders capped at 4,000 characters (${ms} ms)`, r.code === 0 && md2.includes(`${"q".repeat(4000)}...`) && !md2.includes("q".repeat(4001)) && !html2.includes("q".repeat(4001)), () => JSON.stringify(r).slice(0, 300));
}

// ---------------------------------------------------------------- 6. templates and unexpected errors

function templateCopy(mutate) {
  const dir = path.join(TMP, `templates-${Math.random().toString(36).slice(2)}`);
  copyDir(TEMPLATES, dir);
  mutate(dir);
  return dir;
}

function checkTemplates() {
  for (const name of BRIEF_FILES) {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    const dir = templateCopy((d) => fs.unlinkSync(path.join(d, name)));
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo, templatesDir: dir });
    check(`template.missing ${name} exits 1 with no output`, r.code === 1 && r.out.length === 0 && r.err.some((l) => l.includes(`template missing: templates/${name}`)) && !fs.existsSync(path.join(repo, "competitor")), () => JSON.stringify(r));
  }
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    putJson(repo, "compare.json", fixture("compare-full.json"));
    const dir = templateCopy((d) => fs.unlinkSync(path.join(d, "compare.html.tmpl")));
    const r = cli(["compare", "--draft", "compare.json", "--brief", "draft.json"], { cwd: repo, templatesDir: dir });
    check("template.missing compare.html.tmpl exits 1 with no output", r.code === 1 && r.out.length === 0 && r.err.some((l) => l.includes("template missing")) && !fs.existsSync(path.join(repo, "competitor")), () => JSON.stringify(r));
  }
  const broken = [
    ["sections.json with an unknown section", (d) => {
      const f = path.join(d, "sections.json");
      const doc = JSON.parse(fs.readFileSync(f, "utf8"));
      doc.sections.push({ id: "pricing", title: "Pricing" });
      fs.writeFileSync(f, JSON.stringify(doc));
    }],
    ["sections.json missing a section", (d) => {
      const f = path.join(d, "sections.json");
      const doc = JSON.parse(fs.readFileSync(f, "utf8"));
      doc.sections = doc.sections.filter((s) => s.id !== "voc");
      fs.writeFileSync(f, JSON.stringify(doc));
    }],
    ["a default that is not a [GAP] marker", (d) => {
      const f = path.join(d, "section-defaults.json");
      const doc = JSON.parse(fs.readFileSync(f, "utf8"));
      doc.brief.features = "Probably has a mobile app.";
      fs.writeFileSync(f, JSON.stringify(doc));
    }],
    ["an md template without a sections placeholder", (d) => fs.writeFileSync(path.join(d, "brief.md.tmpl"), "# {{title}}\n")],
    ["sections.json that is not JSON", (d) => fs.writeFileSync(path.join(d, "sections.json"), "{")],
  ];
  for (const [what, mutate] of broken) {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo, templatesDir: templateCopy(mutate) });
    check(`template.broken (${what}) exits 1 with no output`, r.code === 1 && r.out.length === 0 && r.err.some((l) => l.includes("template unreadable")) && !fs.existsSync(path.join(repo, "competitor")), () => JSON.stringify(r));
  }

  // Output paths that are not what they should be are refused before anything is written.
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    fs.mkdirSync(path.join(repo, "competitor", "acme-notes", "acme-notes.competitor.md"), { recursive: true });
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    check("write.an output path that is a folder is refused (exit 2, the other file not written either)", r.code === 2 &&
      /^refused: competitor\/acme-notes\/acme-notes\.competitor\.md exists and is not a regular file/.test(r.out[0] || "") && !exists(repo, "competitor/acme-notes/acme-notes.competitor.html"), () => JSON.stringify(r));
  }
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    fs.writeFileSync(path.join(repo, "competitor"), "a file where the folder should be");
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    check("dir.brief refuses when competitor is a file (exit 2)", r.code === 2 && /^refused: competitor\/ is not a folder/.test(r.out[0] || ""), () => JSON.stringify(r));
  }
  // An unexpected error: the output stream fails underneath the script.
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    const err = [];
    const code = report.run(["brief", "--draft", "draft.json"], {
      out: () => {
        throw new Error("the output stream is closed");
      },
      err: (s) => err.push(...String(s).split("\n")),
      cwd: repo,
    });
    check("brief.unexpected error (the output stream fails) exits 1", code === 1 && err.some((l) => l.startsWith("error: unexpected failure (the output stream is closed)")), () => JSON.stringify(err));
  }
}

// ---------------------------------------------------------------- 6b. writes: temporary file + rename, re-checked folders

function checkWrites() {
  // A pre-existing output hard-linked to a file outside the repository.
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    fs.mkdirSync(path.join(repo, "competitor", "acme-notes"), { recursive: true });
    const external = path.join(TMP, `external-${repoCount}.txt`);
    const before = "EXTERNAL FILE - must not change\n";
    fs.writeFileSync(external, before);
    const target = path.join(repo, "competitor", "acme-notes", "acme-notes.competitor.md");
    let linked = true;
    try {
      fs.linkSync(external, target);
    } catch (e) {
      linked = false;
      skip("write.a hard-linked output is replaced and the external file is unchanged", `cannot create a hard link here: ${e.code || e.message}`);
    }
    if (linked) {
      const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
      check("write.a hard-linked output is replaced and the external file is unchanged", r.code === 0 && fs.readFileSync(external, "utf8") === before &&
        read(repo, "competitor/acme-notes/acme-notes.competitor.md").includes("Acme Notes - competitor brief") && fs.statSync(target).nlink === 1 && fs.statSync(external).nlink === 1, () => JSON.stringify(r));
    }
    const left = fs.readdirSync(path.join(repo, "competitor", "acme-notes")).filter((n) => n.endsWith(".tmp"));
    check("write.leaves no temporary file behind", left.length === 0, () => left.join(", "));
  }
  // An output name that is a link (a junction on Windows) is refused, never written through.
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    fs.mkdirSync(path.join(repo, "competitor", "acme-notes"), { recursive: true });
    const outside = path.join(TMP, `write-outside-${repoCount}`);
    fs.mkdirSync(outside, { recursive: true });
    if (linkDir(outside, path.join(repo, "competitor", "acme-notes", "acme-notes.competitor.html"))) {
      const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
      check("write.an output name that is a link is refused (exit 2, nothing written)", r.code === 2 && /acme-notes\.competitor\.html exists and is not a regular file/.test(r.out[0] || "") &&
        fs.readdirSync(outside).length === 0 && !exists(repo, "competitor/acme-notes/acme-notes.competitor.md"), () => JSON.stringify(r));
    } else skip("write.an output name that is a link is refused", "cannot create a link here");
  }
  if (typeof confine.prepareDir !== "function" || typeof confine.writeOutputs !== "function") {
    fail("race.a folder swapped for a link before the rename is refused and nothing lands outside", "this kit has no checked write path to test");
    fail("race.without a swap the write lands and leaves no temporary file", "this kit has no checked write path to test");
    return;
  }
  // The folder is swapped for a link between the checks and the rename.
  {
    const repo = makeRepo();
    const prep = confine.prepareDir(repo, "acme-notes");
    const outside = path.join(TMP, `race-outside-${repoCount}`);
    fs.mkdirSync(outside, { recursive: true });
    let swapped = false;
    let caught = null;
    try {
      confine.writeOutputs(prep, ["acme-notes.competitor.md"], ["swapped\n"], {
        beforeRename: () => {
          fs.renameSync(prep.dir, path.join(repo, "competitor", "moved-away"));
          swapped = linkDir(outside, prep.dir);
        },
      });
    } catch (e) {
      caught = e;
    }
    if (!swapped) skip("race.a folder swapped for a link before the rename is refused", "cannot create a link here");
    else {
      check("race.a folder swapped for a link before the rename is refused and nothing lands outside", caught instanceof confine.RefusedError && /changed while the report was being written/.test(caught.message) && fs.readdirSync(outside).length === 0,
        () => (caught ? caught.message : "no error"));
    }
  }
  // The same check, with no swap: the temporary file is renamed into place.
  {
    const repo = makeRepo();
    const prep = confine.prepareDir(repo, "acme-notes");
    const files = confine.writeOutputs(prep, ["acme-notes.compare.md"], ["plain\n"]);
    check("race.without a swap the write lands and leaves no temporary file", fs.readFileSync(files[0], "utf8") === "plain\n" && fs.readdirSync(prep.dir).length === 1);
  }
}

function checkLinks() {
  const repo = makeRepo();
  putJson(repo, "draft.json", fixture("draft-full.json"));
  const outside = path.join(TMP, `outside-${repoCount}`);
  fs.mkdirSync(outside, { recursive: true });
  try {
    fs.symlinkSync(outside, path.join(repo, "competitor"), process.platform === "win32" ? "junction" : "dir");
  } catch (e) {
    skip("confine.refuses to write through a linked competitor folder", `cannot create a link here: ${e.code || e.message}`);
    return;
  }
  const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
  check("confine.refuses to write through a linked competitor folder (exit 2, nothing written)", r.code === 2 && /^refused: /.test(r.out[0] || "") && fs.readdirSync(outside).length === 0, () => JSON.stringify(r));
}

// ---------------------------------------------------------------- 7. the comparison

function checkCompare() {
  const repo = makeRepo();
  const draft = fixture("draft-full.json");
  putJson(repo, "competitor/acme-notes/draft.json", draft);
  putJson(repo, "competitor/acme-notes/compare.json", fixture("compare-full.json"));
  const r = cli(["compare", "--draft", "competitor/acme-notes/compare.json", "--brief", "competitor/acme-notes/draft.json"], { cwd: repo });
  check("compare.full exits 0", r.code === 0, () => JSON.stringify(r));
  check("compare.full prints at most 6 lines", r.out.length <= 6 && r.out.length >= 4, () => JSON.stringify(r.out));
  check("compare.full names both files", r.out[0] === "wrote competitor/acme-notes/acme-notes.compare.md" && r.out[1] === "wrote competitor/acme-notes/acme-notes.compare.html", () => JSON.stringify(r.out));
  check("compare.full prints the brief's date", r.out.includes("brief: dated 2026-11-01 (2 days before this comparison)"), () => JSON.stringify(r.out));
  check("compare.full counts your-side cites", r.out.includes("your-side cites: 4 files verified, 3 you said, 5 unverified"), () => JSON.stringify(r.out));
  const md = read(repo, "competitor/acme-notes/acme-notes.compare.md");
  const html = read(repo, "competitor/acme-notes/acme-notes.compare.html");
  check("compare.full states the brief's generated_at date (md, html)", md.includes("Compared against the brief dated 2026-11-01 (generated\\_at 2026-11-01T09:30:00Z)") && html.includes("Compared against the brief dated 2026-11-01 (generated_at 2026-11-01T09:30:00Z)"));
  check("compare.cite valid file renders as a file", md.includes("| C1 | Quick capture | yes | [S3](<https://www.example.com/features>) | yes | file `src/editor.ts` |"));
  check("compare.cite with an anchor checks the file part", md.includes("| C7 | Templates |") && /\| C7 \|.*\| file `README\.md` \|/.test(md));
  check("compare.cite you said renders differently from a file", md.includes("| C2 | Team spaces | yes | [S2](<https://www.example.com/pricing>) | no | *you said* |") && html.includes('class="cite cite-said"') && html.includes('class="cite cite-file"'));
  check("compare.cite missing file is unverified", /\| C3 \|.*\*\*unverified\*\* docs\/offline\.md \(no such file in the repository\)/.test(md));
  check("compare.cite .. path is unverified", /\| C4 \|.*\*\*unverified\*\* \.\.\/outside\.txt \(contains/.test(md));
  check("compare.cite absolute path is unverified", /\| C5 \|.*\*\*unverified\*\* \/etc\/passwd \(an absolute path/.test(md));
  check("compare.cite drive letter is unverified", /\| C6 \|.*\*\*unverified\*\* C:.*\(a drive letter/.test(md));
  check("compare.cite .env file is unverified", /\*\*Y4\.\*\* Has secret settings\. \*\*unverified\*\* \.env \(a secrets file/.test(md));
  check("compare.cite unverified shows in html with its label", (html.match(/label label-unverified/g) || []).length === 5);
  check("compare.their status without a fetched page shows no source, not the claim", /\| C3 \| Offline mode \| — \(no source\) \| — \| partial \|/.test(md) && /\| C4 \| Export \| — \(no source\) \| — \| yes \|/.test(md), () => (md.match(/\| C[34] \|.*$/gm) || []).join(" / "));
  check("compare.full counts the two dropped competitor statuses", r.out.some((l) => l.startsWith("rows dropped: 2")), () => JSON.stringify(r.out));
  check("compare.opening without a cite is labelled inferred", /\*\*P3\.\*\* A guess with nothing behind it\. \*inferred, no source\*/.test(md));
  check("compare.unanswered questions are listed", md.includes("*not answered* What budget and team size do you have?"));
  check("compare.next steps are marked advice only", md.includes("Advice only."));
  check("compare.unverified cites are listed under Sources", md.includes("### Unverified your-side cites"));
  assertNeutral("compare.full", md, html, allowedHrefs(draft));

  const repo2 = makeRepo();
  putJson(repo2, "draft.json", draft);
  putJson(repo2, "bad.json", "nope");
  let r2 = cli(["compare", "--draft", "bad.json", "--brief", "draft.json"], { cwd: repo2 });
  check("compare.bad compare.json exits 2", r2.code === 2 && r2.err.some((l) => l.startsWith("bad draft:")) && !fs.existsSync(path.join(repo2, "competitor")));
  putJson(repo2, "nodate.json", { features: [] });
  r2 = cli(["compare", "--draft", "nodate.json", "--brief", "draft.json"], { cwd: repo2 });
  check("compare.compare.json without generated_at exits 2", r2.code === 2 && r2.err.some((l) => l.includes("generated_at")));
  putJson(repo2, "badprice.json", { generated_at: "2026-11-03T10:00:00Z", pricing: ["x"] });
  r2 = cli(["compare", "--draft", "badprice.json", "--brief", "draft.json"], { cwd: repo2 });
  check("compare.pricing that is not an object exits 2", r2.code === 2);
  r2 = cli(["compare", "--draft", "nodate.json"], { cwd: repo2 });
  check("compare.no --brief is a usage error, exit 2", r2.code === 2 && r2.err.some((l) => l.startsWith("usage error:")));
  putJson(repo2, "hostile.json", fixture("draft-hostile.json"));
  putJson(repo2, "min.json", { generated_at: "2026-11-02T10:00:00Z" });
  r2 = cli(["compare", "--draft", "min.json", "--brief", "hostile.json"], { cwd: repo2 });
  check("compare.against a brief with refused records logs them loudly and still renders", r2.code === 0 && r2.err.filter((l) => l.startsWith("REFUSED SOURCE RECORD")).length === 4 && r2.out.some((l) => l.startsWith("records refused: 4")), () => JSON.stringify(r2));
  const minMd = read(repo2, "competitor/hostile-co/hostile-co.compare.md");
  check("compare.empty sections show [GAP] markers", (minMd.match(/\[GAP — /g) || []).length === 8);
  assertTables("compare.against the hostile brief", minMd);
}

/** Feature rows without a fetched source, and file cites on openings, risks and next steps. */
function checkCompareSourcing() {
  const repo = makeRepo();
  const draft = fixture("draft-full.json");
  const cmp = {
    generated_at: "2026-11-03T10:00:00Z",
    features: [
      { name: "Has a source", them: { status: "yes", evidence_url: "https://www.example.com/features" }, you: { status: "no", cite: "you said" } },
      { name: "No evidence", them: { status: "yes" }, you: { status: "yes", cite: "src/editor.ts" } },
      { name: "Not text", them: { status: "yes", evidence_url: ["https://www.example.com/"] }, you: { status: "partial", cite: "you said" } },
      { name: "Refused URL", them: { status: "no", evidence_url: "http://169.254.169.254/latest" }, you: { status: "yes", cite: "README.md" } },
      { name: "Not fetched", them: { status: "partial", evidence_url: "https://never-fetched.example.com/" }, you: { status: "no", cite: "you said" } },
      { name: "Failed record", them: { status: "yes", evidence_url: "https://www.example.com/changelog" }, you: { status: "no", cite: "you said" } },
    ],
    openings: [{ opening: "Setup is documented in your README.", cites: ["README.md#install"] }],
    risks: [
      { risk: "Your editor has no tests.", cites: ["src/editor.ts:1"] },
      { risk: "Mixed cites.", cites: ["F1", "https://www.example.com/pricing", "package.json"] },
      { risk: "Cites a file that is not there.", cites: ["src/missing.ts"] },
      { risk: "Cites a path that climbs out.", cites: ["../outside.txt"] },
      { risk: "Cites a refused URL.", cites: ["http://127.0.0.1/x"] },
    ],
    next_steps: ["Plain advice.", { text: "Add tests for the editor.", cites: ["src/editor.ts"] }],
  };
  putJson(repo, "competitor/acme-notes/draft.json", draft);
  putJson(repo, "competitor/acme-notes/compare.json", cmp);
  const r = cli(["compare", "--draft", "competitor/acme-notes/compare.json", "--brief", "competitor/acme-notes/draft.json"], { cwd: repo });
  const md = read(repo, "competitor/acme-notes/acme-notes.compare.md");
  const html = read(repo, "competitor/acme-notes/acme-notes.compare.html");
  check("compare-src.renders, exit 0", r.code === 0, () => JSON.stringify(r));
  check("compare-src.a feature with a fetched source shows its status", md.includes("| C1 | Has a source | yes | [S3](<https://www.example.com/features>) | no | *you said* |"));
  const noSource = [2, 3, 4, 5, 6].filter((n) => new RegExp(`\\| C${n} \\| [^|]+ \\| — \\(no source\\) \\| — \\| `).test(md));
  check("compare-src.missing, non-text, refused, unfetched and failed evidence never show the claimed status", noSource.length === 5 && html.includes("<td>C2</td><td>No evidence</td><td>— (no source)</td>"), () => `rows with no source: ${noSource.join(",")}`);
  check("compare-src.the user's side is kept on those rows", md.includes("| C2 | No evidence | — (no source) | — | yes | file `src/editor.ts` |") && md.includes("| C4 | Refused URL | — (no source) | — | yes | file `README.md` |"));
  const dropped = mdSection(md, "Dropped rows") || "";
  check("compare-src.each dropped status is logged under Dropped rows with the reason", (dropped.match(/\), their status \|/g) || []).length === 5 &&
    /\| C4 \(Refused URL\), their status \| evidence\\_url http\\:\/\/169\.254\.169\.254\/latest: refused by the URL check/.test(dropped) && /\| C3 \(Not text\), their status \| evidence\\_url \(a list\) is not text \|/.test(dropped), () => dropped);
  check("compare-src.stdout counts the dropped statuses", r.out.some((l) => l.startsWith("rows dropped: 5")), () => JSON.stringify(r.out));
  check("compare-src.a risk citing a repo file renders a verified file cite", /^- \*\*R1\.\*\* Your editor has no tests\. file `src\/editor\.ts`$/m.test(md), () => (md.match(/^- \*\*R1\..*$/m) || [""])[0]);
  check("compare-src.an opening citing a repo file renders a verified file cite", /^- \*\*P1\.\*\* Setup is documented in your README\. file `README\.md`$/m.test(md), () => (md.match(/^- \*\*P1\..*$/m) || [""])[0]);
  check("compare-src.a risk may mix a row id, a fetched page and a file", /^- \*\*R2\.\*\* Mixed cites\. \(builds on F1\) \(sources: \[S2\]\(<https:\/\/www\.example\.com\/pricing>\)\) file `package\.json`$/m.test(md), () => (md.match(/^- \*\*R2\..*$/m) || [""])[0]);
  check("compare-src.a missing or climbing path cite is unverified, not inferred", /^- \*\*R3\.\*\* .* \*\*unverified\*\* src\/missing\.ts \(no such file in the repository\)$/m.test(md) && /^- \*\*R4\.\*\* .* \*\*unverified\*\* \.\.\/outside\.txt \(contains/m.test(md));
  const pathRows = (md.match(/^- \*\*(R[1-4]|P1)\..*$/gm) || []).join("\n");
  const ignored = mdSection(md, "Ignored cites") || "";
  check("compare-src.no path cite renders inferred, no source or refused by the URL check", !pathRows.includes("inferred, no source") && !/\| (R[1-4]|P1) \|/.test(ignored), () => `${pathRows}\n${ignored}`);
  check("compare-src.a refused URL cite on a risk is still refused and the risk inferred", /^- \*\*R5\.\*\* Cites a refused URL\. \*inferred, no source\*$/m.test(md) && /\| R5 \| http\\:\/\/127\.0\.0\.1\/x \| refused by the URL check/.test(ignored), () => ignored);
  check("compare-src.a next step may cite a file; a plain one gets no label", /^2\. Add tests for the editor\. file `src\/editor\.ts`$/m.test(md) && /^1\. Plain advice\.$/m.test(md), () => (md.match(/^[12]\. .*$/gm) || []).join(" / "));
  check("compare-src.stdout counts the file cites on risks, openings and next steps", r.out.includes("your-side cites: 6 files verified, 4 you said, 2 unverified"), () => JSON.stringify(r.out));
  assertNeutral("compare-src", md, html, allowedHrefs(draft));
}

// ---------------------------------------------------------------- 8. neutraliser units

function checkText() {
  const payloads = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "[click](javascript:alert(1))",
    "![x](https://evil.example/p.png)",
    "[ref]: https://evil.example",
    "<https://evil.example>",
    "see https://evil.example and www.evil.example",
    "JavaScript:alert(1) DATA:text/html,x vbscript:x",
    "mail someone@evil.example",
    "a | b | c",
    "&lt;script&gt; &#106;avascript:",
  ];
  for (const p of payloads) {
    const m = text.mdText(p, true);
    const clean = !m.includes("<") && !/(^|[^\\])\[/.test(m) && !/https?:\/\//i.test(m) && !/(javascript|data|vbscript):/i.test(m) && !/(^|[^\\])\|/.test(m) && !/(^|[^\\])@/.test(m) && !/&#[0-9]/.test(m);
    check(`text.md neutralises ${JSON.stringify(p).slice(0, 40)}`, clean, () => m);
    const h = text.htmlText(p);
    check(`text.html escapes ${JSON.stringify(p).slice(0, 40)}`, !/[<>"']/.test(h), () => h);
  }
  check("text.md keeps typed entities literal", text.mdText("&lt;script&gt; &#106;").includes("&amp;lt;script&amp;gt;") && text.mdText("&#106;").includes("&amp;#106;"));
  check("text.md link refuses a non-http(s) href", !text.mdLink("x", "javascript:alert(1)").includes("](") && !text.mdLink("x", "data:text/html,x").includes("]("));
  check("text.html link refuses a non-http(s) href", !text.htmlLink("x", "javascript:alert(1)").includes("href"));
  check("text.html link escapes the attribute", text.htmlLink("S1", "https://example.com/a'b").includes("href=\"https://example.com/a&#39;b\""));
  check("text.shown URL masks credentials", text.shownUrl("https://user:pw@example.com/x") === "https://***@example.com/x");
  check("text.clean drops control and bidi characters", text.cleanText(`a${String.fromCharCode(0x202e)}b${String.fromCharCode(7)}c\nd`) === "abc d");

  // Every "://" is neutralised whatever comes before it; word-boundary schemes stay covered.
  const glued = ["see xhttp://127.0.0.1/ now", "xftp://evil.example/", "Ahttps://evil.example/x", "_http://evil.example", "1http://evil.example", "x://evil.example", "a.b+c://evil.example", "http://a http://b"];
  for (const p of glued) {
    const m = text.mdText(p, true);
    check(`text.md neutralises a glued scheme ${JSON.stringify(p)}`, !liveScheme(m), () => m);
  }
  check("text.md escapes each colon once", text.mdText("https://evil.example") === "https\\://evil.example" && text.mdText("xhttp://e") === "xhttp\\://e", () => `${text.mdText("https://evil.example")} ${text.mdText("xhttp://e")}`);
  check("text.md leaves ordinary colons alone", text.mdText("Ratio 3:1, time 09:30") === "Ratio 3:1, time 09:30");
}

// ---------------------------------------------------------------- run files that are links

/** Links `at` to a file (a symbolic link) or, where this system cannot, to a folder (a junction). Returns the kind made, or "". */
function linkAny(fileTarget, dirTarget, at) {
  try {
    fs.symlinkSync(fileTarget, at, "file");
    return "symbolic link";
  } catch (e) {
    return linkDir(dirTarget, at) ? (process.platform === "win32" ? "junction" : "folder link") : "";
  }
}

const RUN_FILES = ["draft.json", "compare.json", "urls.txt", "acme-notes.competitor.md", "acme-notes.competitor.html", "acme-notes.compare.md", "acme-notes.compare.html"];

function checkRunFiles() {
  if (typeof confine.runFileNames === "function") {
    check("runfiles.the kit judges exactly the seven run files", JSON.stringify(confine.runFileNames("acme-notes")) === JSON.stringify(RUN_FILES), () => JSON.stringify(confine.runFileNames("acme-notes")));
  } else fail("runfiles.the kit judges exactly the seven run files", "confine has no list of run files");

  for (const name of RUN_FILES) {
    const repo = makeRepo();
    const folder = path.join(repo, "competitor", "acme-notes");
    fs.mkdirSync(folder, { recursive: true });
    const outFile = path.join(TMP, `runfile-ext-${repoCount}.txt`);
    const outDir = path.join(TMP, `runfile-ext-dir-${repoCount}`);
    fs.writeFileSync(outFile, "EXTERNAL\n");
    fs.mkdirSync(outDir, { recursive: true });
    const at = path.join(folder, name);
    const kind = linkAny(outFile, outDir, at);
    if (!kind) {
      skip(`runfiles.check refuses a link at competitor/acme-notes/${name}`, "cannot create a link here");
      continue;
    }
    const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
    let still = false;
    try {
      still = fs.lstatSync(at).isSymbolicLink();
    } catch (e) {
      still = false;
    }
    check(`runfiles.check refuses a ${kind} at competitor/acme-notes/${name} (exit 2, names it, asks to delete it, removes nothing)`,
      r.code === 2 && r.out.length === 1 && (r.out[0] || "").startsWith(`refused: competitor/acme-notes/${name} is a symbolic link or junction`) && /delete it/.test(r.out[0] || "") &&
        still && fs.readFileSync(outFile, "utf8") === "EXTERNAL\n" && fs.readdirSync(outDir).length === 0,
      () => JSON.stringify(r));
  }

  {
    const repo = makeRepo();
    const at = path.join(repo, "competitor", "acme-notes", "draft.json");
    fs.mkdirSync(at, { recursive: true });
    const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
    check("runfiles.check refuses a folder named draft.json (not a regular file; exit 2, nothing removed)",
      r.code === 2 && /^refused: competitor\/acme-notes\/draft\.json exists and is not a regular file/.test(r.out[0] || "") && fs.statSync(at).isDirectory(), () => JSON.stringify(r));
  }

  for (const name of ["draft.json", "compare.json", "urls.txt", "acme-notes.competitor.html"]) {
    const repo = makeRepo();
    const folder = path.join(repo, "competitor", "acme-notes");
    fs.mkdirSync(folder, { recursive: true });
    const ext = path.join(TMP, `hard-ext-${repoCount}.txt`);
    fs.writeFileSync(ext, "EXTERNAL\n");
    const at = path.join(folder, name);
    try {
      fs.linkSync(ext, at);
    } catch (e) {
      skip(`runfiles.check refuses a hard-linked ${name}`, `cannot create a hard link here: ${e.code || e.message}`);
      continue;
    }
    const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
    check(`runfiles.check refuses a hard-linked ${name} (2 links; exit 2, names it, removes nothing)`,
      r.code === 2 && r.out.length === 1 && (r.out[0] || "").startsWith(`refused: competitor/acme-notes/${name} has 2 hard links`) && /delete it/.test(r.out[0] || "") &&
        fs.existsSync(at) && fs.statSync(ext).nlink === 2 && fs.readFileSync(ext, "utf8") === "EXTERNAL\n",
      () => JSON.stringify(r));
  }

  // A second URL list has another name (check-url reads at most 200 URLs a file), so every other entry is judged too.
  {
    const repo = makeRepo();
    const folder = path.join(repo, "competitor", "acme-notes");
    fs.mkdirSync(folder, { recursive: true });
    const outFile = path.join(TMP, `runfile-other-${repoCount}.txt`);
    const outDir = path.join(TMP, `runfile-other-dir-${repoCount}`);
    fs.writeFileSync(outFile, "EXTERNAL\n");
    fs.mkdirSync(outDir, { recursive: true });
    const at = path.join(folder, "urls-2.txt");
    const kind = linkAny(outFile, outDir, at);
    if (!kind) skip("runfiles.check refuses a link under another name (urls-2.txt)", "cannot create a link here");
    else {
      const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
      let still = false;
      try {
        still = fs.lstatSync(at).isSymbolicLink();
      } catch (e) {
        still = false;
      }
      check(`runfiles.check refuses a ${kind} under another name, competitor/acme-notes/urls-2.txt (exit 2, names it, removes nothing)`,
        r.code === 2 && r.out.length === 1 && (r.out[0] || "").startsWith("refused: competitor/acme-notes/urls-2.txt is a symbolic link or junction") && /delete it/.test(r.out[0] || "") &&
          still && fs.readFileSync(outFile, "utf8") === "EXTERNAL\n" && fs.readdirSync(outDir).length === 0,
        () => JSON.stringify(r));
    }
  }
  {
    const repo = makeRepo();
    const folder = path.join(repo, "competitor", "acme-notes");
    fs.mkdirSync(folder, { recursive: true });
    const ext = path.join(TMP, `hard-other-${repoCount}.txt`);
    fs.writeFileSync(ext, "EXTERNAL\n");
    const at = path.join(folder, "urls-2.txt");
    let made = true;
    try {
      fs.linkSync(ext, at);
    } catch (e) {
      made = false;
      skip("runfiles.check refuses a hard-linked file under another name (urls-2.txt)", `cannot create a hard link here: ${e.code || e.message}`);
    }
    if (made) {
      const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
      check("runfiles.check refuses a hard-linked file under another name, competitor/acme-notes/urls-2.txt (exit 2, names it, removes nothing)",
        r.code === 2 && r.out.length === 1 && (r.out[0] || "").startsWith("refused: competitor/acme-notes/urls-2.txt has 2 hard links") && /delete it/.test(r.out[0] || "") &&
          fs.existsSync(at) && fs.statSync(ext).nlink === 2 && fs.readFileSync(ext, "utf8") === "EXTERNAL\n",
        () => JSON.stringify(r));
    }
  }
  {
    const repo = makeRepo();
    putJson(repo, "competitor/acme-notes/urls-2.txt", "https://www.example.com/a\n");
    putJson(repo, "competitor/acme-notes/notes/kept.md", "a plain file in a plain folder\n");
    const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
    check("runfiles.check accepts plain files and plain folders under other names (urls-2.txt, notes/)", r.code === 0 && r.out.includes("dir: competitor/acme-notes/"), () => JSON.stringify(r));
  }

  {
    const repo = makeRepo();
    for (const name of RUN_FILES) putJson(repo, `competitor/acme-notes/${name}`, "from an earlier run\n");
    const r = cli(["check", "--target", "Acme Notes"], { cwd: repo });
    check("runfiles.check accepts an earlier run's files when each is a plain file with one link", r.code === 0 && r.out.includes("dir: competitor/acme-notes/"), () => JSON.stringify(r));
  }
}

// ---------------------------------------------------------------- counts and nesting

function checkCounts() {
  const base = fixture("draft-full.json");
  const okRec = (i) => ({ url: `https://www.example.com/p${i}`, source_class: "product", status: "ok", retrieved_at: "2026-11-01T09:30:00Z" });
  const runBrief = (doc) => {
    const repo = makeRepo();
    putJson(repo, "draft.json", doc);
    const t0 = Date.now();
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    return { ...r, ms: Date.now() - t0, wrote: exists(repo, "competitor") };
  };
  const runCompare = (cmp, briefDoc) => {
    const repo = makeRepo();
    putJson(repo, "d.json", briefDoc || base);
    putJson(repo, "c.json", cmp);
    const r = cli(["compare", "--draft", "c.json", "--brief", "d.json"], { cwd: repo });
    return { ...r, wrote: exists(repo, "competitor") };
  };
  const refused = (r, phrase) => r.code === 2 && !r.wrote && r.err.some((l) => l.startsWith("bad draft:") && l.includes(phrase));
  const shown = (r) => JSON.stringify({ code: r.code, out: r.out.slice(0, 3), err: r.err.slice(0, 3) }).slice(0, 400);

  let r = runBrief({ ...base, source_records: Array.from({ length: 600 }, (_, i) => okRec(i)) });
  check("counts.a draft with 600 source_records is refused (exit 2, too many source_records, nothing written)", refused(r, "too many source_records (more than 500)"), () => shown(r));

  // A million tiny records in about 3 MB: inside the byte cap, refused by the count before parsing.
  {
    const repo = makeRepo();
    const head = JSON.stringify({ ...base, source_records: [] });
    const raw = head.replace('"source_records":[]', `"source_records":[${"{},".repeat(999999)}{}]`);
    fs.writeFileSync(path.join(repo, "draft.json"), raw);
    const t0 = Date.now();
    const rr = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    const ms = Date.now() - t0;
    check(`counts.1,000,000 tiny source_records (${Math.round(raw.length / 1e5) / 10} MB) are refused before any record is built (${ms} ms)`,
      rr.code === 2 && rr.err.length === 1 && rr.err[0].includes("too many source_records") && ms < 2000 && !exists(repo, "competitor"), () => `${ms} ms ${shown(rr)}`);
  }

  for (const key of ["features", "voc", "jtbds", "gaps", "opportunities"]) {
    const row = JSON.parse(JSON.stringify(base[key][0]));
    r = runBrief({ ...base, [key]: Array.from({ length: 201 }, () => row) });
    check(`counts.a draft with 201 ${key} is refused (exit 2, too many ${key})`, refused(r, `too many ${key} (more than 200)`), () => shown(r));
  }

  // Exactly at every cap still renders.
  {
    const atCap = JSON.parse(JSON.stringify(base));
    atCap.source_records = [...base.source_records, ...Array.from({ length: 500 - base.source_records.length }, (_, i) => okRec(i))];
    for (const key of ["features", "voc", "jtbds", "gaps", "opportunities"]) atCap[key] = Array.from({ length: 200 }, () => JSON.parse(JSON.stringify(base[key][0])));
    atCap.jtbds[0].cites = Array.from({ length: 50 }, (_, i) => `https://www.example.com/p${i}`);
    atCap.product_identity.cites = Array.from({ length: 50 }, () => "https://www.example.com/");
    r = runBrief(atCap);
    check(`counts.a draft exactly at every cap renders (500 records, 200 of each row list, 50 cites; ${r.ms} ms)`, r.code === 0 && r.wrote, () => shown(r));
  }

  const cites51 = Array.from({ length: 51 }, () => "https://www.example.com/");
  {
    const d = JSON.parse(JSON.stringify(base));
    d.jtbds[0].cites = cites51;
    r = runBrief(d);
    check("counts.a row with 51 cites is refused, naming where (jtbds[0].cites)", refused(r, "too many cites in jtbds[0].cites (more than 50)"), () => shown(r));
    const d2 = JSON.parse(JSON.stringify(base));
    d2.product_identity.cites = cites51;
    r = runBrief(d2);
    check("counts.product_identity with 51 cites is refused", refused(r, "too many cites in product_identity.cites"), () => shown(r));
  }

  const cmpBase = fixture("compare-full.json");
  for (const key of ["features", "your_side", "openings", "risks", "next_steps", "positioning", "jobs_overlap", "unanswered"]) {
    const item = JSON.parse(JSON.stringify(cmpBase[key][0]));
    r = runCompare({ ...cmpBase, [key]: Array.from({ length: 201 }, () => item) });
    check(`counts.a compare.json with 201 ${key} is refused (exit 2, too many ${key})`, refused(r, `too many ${key} (more than 200)`), () => shown(r));
  }
  {
    const c = JSON.parse(JSON.stringify(cmpBase));
    c.risks[0].cites = cites51;
    r = runCompare(c);
    check("counts.a compare risk with 51 cites is refused (risks[0].cites)", refused(r, "too many cites in risks[0].cites"), () => shown(r));
    const c2 = JSON.parse(JSON.stringify(cmpBase));
    c2.pricing.them.cites = cites51;
    r = runCompare(c2);
    check("counts.compare pricing with 51 cites is refused (pricing.them.cites)", refused(r, "too many cites in pricing.them.cites"), () => shown(r));
  }

  // Nesting: refused past 32 levels, wherever it is, before it is parsed or walked.
  const nest = (depth) => {
    let v = "leaf";
    for (let k = 0; k < depth; k++) v = [v];
    return v;
  };
  r = runBrief({ ...base, extra: nest(99) });
  check("counts.a 100-deep nested draft is refused (exit 2, nested more than 32 levels)", refused(r, "nested more than 32 levels deep"), () => shown(r));
  {
    const d = JSON.parse(JSON.stringify(base));
    d.jtbds[0].cites = nest(40);
    r = runBrief(d);
    check("counts.deep nesting inside a cites list is refused too", refused(r, "nested more than 32 levels deep"), () => shown(r));
  }
  r = runBrief({ ...base, extra: nest(31) });
  check("counts.exactly 32 levels is accepted", r.code === 0, () => shown(r));
  r = runBrief({ ...base, extra: nest(32) });
  check("counts.33 levels is refused", refused(r, "nested more than 32 levels deep"), () => shown(r));
  r = runCompare({ ...cmpBase, extra: nest(99) });
  check("counts.a 100-deep nested compare.json is refused", refused(r, "nested more than 32 levels deep"), () => shown(r));

  // The count reads JSON as JSON.parse does: brackets in text, escaped quotes and escaped keys.
  {
    const d = JSON.parse(JSON.stringify(base));
    d.gaps[0].gap = `${"[{".repeat(100)} say \\"[[[\\" ${'"'}[{`;
    d.jtbds[0].why = `${",".repeat(5000)}`;
    r = runBrief(d);
    check("counts.brackets, commas and escaped quotes inside text do not count as nesting or items", r.code === 0, () => shown(r));
    const raw = JSON.stringify({ ...base, source_records: [] }).replace('"source_records":[]', `"source\\u005frecords":${JSON.stringify(Array.from({ length: 600 }, (_, i) => okRec(i)))}`);
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, "draft.json"), raw);
    const rr = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    check("counts.an escaped key (source\\u005frecords) is counted as source_records", rr.code === 2 && rr.err.some((l) => l.includes("too many source_records")), () => shown(rr));
  }

  // Lists the renderer never reads are capped too, and so is the total.
  r = runBrief({ ...base, extra: Array.from({ length: 501 }, () => 1) });
  check("counts.any other list over 500 items is refused", refused(r, "too many items in the list extra (more than 500)"), () => shown(r));
  {
    const wide = {};
    for (let k = 0; k < 600; k++) wide[`k${k}`] = Array.from({ length: 450 }, () => 0);
    r = runBrief({ ...base, extra: wide });
    check("counts.a draft holding more than 250,000 values is refused", refused(r, "more than 250000 values"), () => shown(r));
  }

  // Documents handed in already parsed meet the same caps.
  {
    let caught = null;
    try {
      draftLib.analyzeDraft({ ...base, source_records: Array.from({ length: 600 }, (_, i) => okRec(i)) }, "draft");
    } catch (e) {
      caught = e;
    }
    check("counts.analyzeDraft refuses 600 source_records in a parsed document too", caught instanceof draftLib.DraftError && /too many source_records/.test(caught.message), () => (caught ? caught.message : "no error"));
  }
}

// ---------------------------------------------------------------- folder and link cites

function checkDirCites() {
  const repo = makeRepo();
  for (const c of [".", "./", "src", "src/", "./src", "src/.", ".#top", "src:12"]) {
    const got = confine.verifyCite(c, repo);
    check(`dircite.a cite of ${JSON.stringify(c)} (a folder) is unverified`, got.kind === "unverified" && /folder/.test(got.reason || ""), () => JSON.stringify(got));
  }
  if (linkDir(path.join(repo, "src"), path.join(repo, "srclink"))) {
    const got = confine.verifyCite("srclink", repo);
    check("dircite.a cite of a folder link inside the repository is unverified", got.kind === "unverified" && /link/.test(got.reason || ""), () => JSON.stringify(got));
  } else skip("dircite.a cite of a folder link is unverified", "cannot create a link here");
  let fileLink = false;
  try {
    fs.symlinkSync(path.join(repo, "README.md"), path.join(repo, "readme-link.md"), "file");
    fileLink = true;
  } catch (e) {
    skip("dircite.a cite of a file link inside the repository is unverified", `cannot create a file link here: ${e.code || e.message}`);
  }
  if (fileLink) {
    const got = confine.verifyCite("readme-link.md", repo);
    check("dircite.a cite of a file link inside the repository is unverified", got.kind === "unverified" && /link/.test(got.reason || ""), () => JSON.stringify(got));
  }
  const reg = confine.verifyCite("src/editor.ts:3", repo);
  const miss = confine.verifyCite("src/none.ts", repo);
  check("dircite.a regular file still verifies; a missing one is still unverified", reg.kind === "file" && reg.text === "src/editor.ts" && miss.kind === "unverified" && /no such file/.test(miss.reason), () => JSON.stringify([reg, miss]));

  // Rendered: "." and a folder show as unverified in the comparison.
  const cmp = {
    generated_at: "2026-11-03T10:00:00Z",
    features: [{ name: "Quick capture", them: { status: "yes", evidence_url: "https://www.example.com/features" }, you: { status: "yes", cite: "." } }],
    your_side: [{ fact: "The whole repository.", cite: "." }, { fact: "The source folder.", cite: "src" }, { fact: "The editor.", cite: "src/editor.ts" }],
    risks: [{ risk: "Cites a folder.", cites: ["src/"] }],
  };
  putJson(repo, "competitor/acme-notes/draft.json", fixture("draft-full.json"));
  putJson(repo, "competitor/acme-notes/compare.json", cmp);
  const r = cli(["compare", "--draft", "competitor/acme-notes/compare.json", "--brief", "competitor/acme-notes/draft.json"], { cwd: repo });
  const md = r.code === 0 ? read(repo, "competitor/acme-notes/acme-notes.compare.md") : "";
  check("dircite.a cite of \".\" renders unverified (md row, your side, counts)",
    r.code === 0 && /\| C1 \| Quick capture \|.*\| \*\*unverified\*\* \. \(a folder, not a file/.test(md) && /\*\*Y1\.\*\* The whole repository\. \*\*unverified\*\* \. \(a folder/.test(md) &&
      /\*\*Y2\.\*\* The source folder\. \*\*unverified\*\* src \(a folder/.test(md) && /\*\*R1\.\*\* Cites a folder\. \*\*unverified\*\* src\/ \(a folder/.test(md) &&
      r.out.includes("your-side cites: 1 file verified, 0 you said, 4 unverified"),
    () => `${JSON.stringify(r.out)} ${(md.match(/^.*(C1|Y1|Y2|R1)\b.*$/gm) || []).join(" / ")}`);
}

// ---------------------------------------------------------------- link addresses in Markdown tables

// Addresses that pass the URL check and still carry Markdown: "|" ends a table
// cell before links are read, so a raw address would break out of its cell.
const HOSTILE_HREFS = {
  attack: "https://example.com/|[x](javascript:alert(1))|",
  image: "https://example.com/|![x](https://attacker.example/p.png)|",
  angle: "https://example.com/a|<b>|`c`|",
};
const HREF_FAILED = "https://example.com/failed|[y](javascript:alert(2))|";
const HREF_QUERY_TICK = "https://example.com/q?x=|`y`|";
const HREF_PLAIN = "https://www.example.com/search?a=1&b=2#x";

/** draft-full.json plus an ok record at `url` (S9) that the target, feature F5 and quote Q4 cite, and a failed record (S10). */
function hrefDraft(url) {
  const draft = fixture("draft-full.json");
  draft.target = { ...draft.target, url };
  draft.source_records.push(
    { url, source_class: "review", status: "ok", length: 1200, retrieved_at: "2026-11-01T09:11:00Z" },
    { url: HREF_FAILED, source_class: "review", status: "failed", failure_reason: "HTTP 500", retrieved_at: "2026-11-01T09:12:00Z" },
  );
  draft.features.push({ name: "Shared links", description: "Cited to the address under test.", complexity: "S", coreness: 2, evidence_url: url });
  draft.voc.push({ quote: "Links stay in their cell.", sentiment: "positive", source_url: url, retrieved: "2026-11-01" });
  return draft;
}

/** A comparison whose feature C1, an opening and the pricing cite `url`. */
function hrefCompare(url) {
  return {
    generated_at: "2026-11-03T10:00:00Z",
    features: [{ name: "Shared links", them: { status: "yes", evidence_url: url }, you: { status: "no", cite: "you said" } }],
    openings: [{ opening: "Links that stay in their cell.", cites: [url] }],
    risks: [{ risk: "Built on their quote.", cites: ["Q4"] }],
    pricing: { them: { summary: "Per seat.", cites: [url] }, you: { summary: "Free.", cite: "you said" } },
  };
}

/** Renders the brief and then the comparison in a fresh repository. */
function hrefRender(url) {
  const repo = makeRepo();
  putJson(repo, "competitor/acme-notes/draft.json", hrefDraft(url));
  putJson(repo, "competitor/acme-notes/compare.json", hrefCompare(url));
  const rb = cli(["brief", "--draft", "competitor/acme-notes/draft.json"], { cwd: repo });
  const rc = cli(["compare", "--draft", "competitor/acme-notes/compare.json", "--brief", "competitor/acme-notes/draft.json"], { cwd: repo });
  const get = (r, rel) => (r.code === 0 && exists(repo, rel) ? read(repo, rel) : "");
  return {
    rb,
    rc,
    briefMd: get(rb, "competitor/acme-notes/acme-notes.competitor.md"),
    briefHtml: get(rb, "competitor/acme-notes/acme-notes.competitor.html"),
    cmpMd: get(rc, "competitor/acme-notes/acme-notes.compare.md"),
    cmpHtml: get(rc, "competitor/acme-notes/acme-notes.compare.html"),
  };
}

/** The trimmed cells of the table row that starts "| <id> |", or []. */
function rowCells(md, id) {
  const line = md.split("\n").find((l) => l.startsWith(`| ${id} |`));
  return line ? mdRowCells(line).map((c) => c.trim()) : [];
}

/** The address inside a "[S1](<...>)" link, or "" when the text is not one. */
const destOf = (link, label) => (link.startsWith(`[${label}](<`) && link.endsWith(">)") ? link.slice(label.length + 4, -2).replace(/&amp;/g, "&") : "");

/** new URL(s), or null when it does not parse. */
function parsedUrl(s) {
  try {
    return new URL(s);
  } catch (e) {
    return null;
  }
}

function checkMdHrefs() {
  for (const [tag, raw] of Object.entries(HOSTILE_HREFS)) {
    const href = guard.checkUrl(raw).href;
    const allowed = allowedHrefs(hrefDraft(raw));
    const link = `[S9](<${mdDest(href)}>)`;
    const out = hrefRender(raw);
    const f5 = rowCells(out.briefMd, "F5");
    const q4 = rowCells(out.briefMd, "Q4");
    check(`mdhref.${tag} brief exits 0; feature F5 and quote Q4 cite S9 as one whole link cell`, out.rb.code === 0 && f5.length === 6 && f5[5] === link && q4.length === 5 && q4[3] === link,
      () => JSON.stringify({ code: out.rb.code, f5, q4 }));
    assertMdInert(`mdhref.${tag} brief`, out.briefMd);
    check(`mdhref.${tag} brief html keeps the checked address, attribute-escaped, and links checked records only`,
      out.briefHtml.includes(`href="${htmlAttr(href)}"`) && htmlHrefs(out.briefHtml).every((h) => allowed.has(h)) && !/href="\s*javascript:/i.test(out.briefHtml),
      () => htmlHrefs(out.briefHtml).filter((h) => !allowed.has(h)).join(" "));
    const c1 = rowCells(out.cmpMd, "C1");
    check(`mdhref.${tag} compare exits 0; feature C1's evidence is one whole link cell`, out.rc.code === 0 && c1.length === 6 && c1[3] === link, () => JSON.stringify({ code: out.rc.code, c1 }));
    assertMdInert(`mdhref.${tag} compare`, out.cmpMd);
    check(`mdhref.${tag} compare html keeps the checked address, attribute-escaped, and links checked records only`,
      out.cmpHtml.includes(`href="${htmlAttr(href)}"`) && htmlHrefs(out.cmpHtml).every((h) => allowed.has(h)) && !/href="\s*javascript:/i.test(out.cmpHtml),
      () => htmlHrefs(out.cmpHtml).filter((h) => !allowed.has(h)).join(" "));
  }

  // A backtick the URL parser leaves in the query: such an address is shown as text, never as a link.
  {
    const href = guard.checkUrl(HREF_QUERY_TICK).href;
    const out = hrefRender(HREF_QUERY_TICK);
    const f5 = rowCells(out.briefMd, "F5");
    const c1 = rowCells(out.cmpMd, "C1");
    check("mdhref.tick-in-query an address with a backtick left in its query is shown as text, never a link (brief, compare, html)",
      out.rb.code === 0 && out.rc.code === 0 && f5[5] === "S9" && c1[3] === "S9" && !out.briefMd.includes("](<https://example.com/q") && !out.cmpMd.includes("](<https://example.com/q") &&
        !htmlHrefs(out.briefHtml).includes(href) && !htmlHrefs(out.cmpHtml).includes(href),
      () => JSON.stringify({ f5, c1 }));
    assertMdInert("mdhref.tick-in-query brief", out.briefMd);
    assertMdInert("mdhref.tick-in-query compare", out.cmpMd);
  }

  // A plain address with a query and a fragment stays a working link to the same page.
  {
    const out = hrefRender(HREF_PLAIN);
    const want = "[S9](<https://www.example.com/search?a=1&b=2#x>)";
    const f5 = rowCells(out.briefMd, "F5");
    const c1 = rowCells(out.cmpMd, "C1");
    const back = parsedUrl(destOf(f5[5] || "", "S9"));
    const attr = 'href="https://www.example.com/search?a=1&amp;b=2#x"';
    check("mdhref.plain an address with ?a=1&b=2#x still renders as a working link to the same target (md brief, md compare, html)",
      out.rb.code === 0 && out.rc.code === 0 && f5[5] === want && c1[3] === want && back !== null && back.href === HREF_PLAIN && out.briefHtml.includes(attr) && out.cmpHtml.includes(attr),
      () => JSON.stringify({ f5: f5[5], c1: c1[3] }));
    assertMdInert("mdhref.plain brief", out.briefMd);
  }

  // The link renderer on its own.
  const attackLink = text.mdLink("S1", HOSTILE_HREFS.attack);
  check("mdhref.unit text.mdLink percent-encodes the attack address", attackLink === "[S1](<https://example.com/%7C%5Bx%5D%28javascript:alert%281%29%29%7C>)", () => attackLink);
  const pathLink = text.mdLink("S1", "https://example.com/a|b[c]d(e)f*g_h!i'j");
  check("mdhref.unit text.mdLink percent-encodes | [ ] ( ) * _ ! ' in a path", pathLink === "[S1](<https://example.com/a%7Cb%5Bc%5Dd%28e%29f%2Ag%5Fh%21i%27j>)", () => pathLink);
  // A kit without mdHref fails this check instead of throwing.
  const mdHrefOf = (h) => (typeof text.mdHref === "function" ? text.mdHref(h) : h);
  const refusedChars = mdHrefOf("https://example.com/<>`\\\" x");
  check("mdhref.unit text.mdHref also encodes < > ` \\ \" and space (refused before a link is made, encoded all the same)", refusedChars === "https://example.com/%3C%3E%60%5C%22%20x", () => refusedChars);
  const v6 = text.mdLink("S1", "https://[2001:4860::8888]:8443/a|b");
  const v6url = parsedUrl(destOf(v6, "S1"));
  check("mdhref.unit an IPv6 host keeps its brackets and the address still parses", v6 === "[S1](<https://[2001:4860::8888]:8443/a%7Cb>)" && v6url !== null && v6url.hostname === "[2001:4860::8888]", () => v6);
  const host = text.mdLink("S1", "https://a_b.example.com/x(y)");
  const hostUrl = parsedUrl(destOf(host, "S1"));
  check("mdhref.unit characters in a host name are encoded too, and the URL parser reads back the same host", host === "[S1](<https://a%5Fb.example.com/x%28y%29>)" && hostUrl !== null && hostUrl.hostname === "a_b.example.com", () => host);
  const pct = text.mdLink("S1", "https://example.com/a%7Cb%25");
  check("mdhref.unit text.mdLink leaves % alone", pct === "[S1](<https://example.com/a%7Cb%25>)", () => pct);
  {
    const a = parsedUrl(destOf(attackLink, "S1"));
    const b = new URL(HOSTILE_HREFS.attack);
    check("mdhref.unit the encoded attack address decodes to the same host, path, query and fragment",
      a !== null && a.host === b.host && decodeURIComponent(a.pathname) === decodeURIComponent(b.pathname) && a.search === b.search && a.hash === b.hash, () => attackLink);
  }

  // A [GAP] marker reaches Markdown escaped like any other text.
  {
    const repo = makeRepo();
    const draft = fixture("draft-full.json");
    draft.features = [];
    putJson(repo, "draft.json", draft);
    const marker = "[GAP — features — a *b* | c_d `e` !x]";
    const dir = templateCopy((d) => {
      const f = path.join(d, "section-defaults.json");
      const doc = JSON.parse(fs.readFileSync(f, "utf8"));
      doc.brief.features = marker;
      fs.writeFileSync(f, JSON.stringify(doc));
    });
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo, templatesDir: dir });
    const md = r.code === 0 ? read(repo, "competitor/acme-notes/acme-notes.competitor.md") : "";
    const html = r.code === 0 ? read(repo, "competitor/acme-notes/acme-notes.competitor.html") : "";
    check("mdhref.sink a [GAP] marker keeps its shape and its words are escaped in md like any text (html escaped as before)",
      md.includes("[GAP — features — a \\*b\\* \\| c\\_d \\`e\\` !x]") && html.includes('<span class="gap-marker">[GAP — features — a *b* | c_d `e` !x]</span>') && r.out.includes("gaps: 1 [GAP] marker"),
      () => `${JSON.stringify(r)} ${(md.match(/^.*\[GAP.*$/m) || [""])[0]}`);
  }
}

/** Every Markdown report this run rendered, anywhere under the temp folder (links and junctions are not followed). */
function renderedReports(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) renderedReports(p, out);
    else if (ent.isFile() && /\.(competitor|compare)\.md$/.test(ent.name)) out.push(p);
  }
  return out;
}

/** The structural check over every Markdown file the self-check rendered, hostile and full fixtures included. */
function checkAllTables() {
  const files = renderedReports(TMP, []);
  let tables = 0;
  let withTables = 0;
  const bad = [];
  for (const f of files) {
    const shape = mdTableShape(fs.readFileSync(f, "utf8"));
    tables += shape.tables;
    if (shape.tables) withTables++;
    for (const b of shape.bad) bad.push(`${path.relative(TMP, f)} ${b}`);
  }
  check(`mdtables.every Markdown report this selfcheck rendered keeps every table row whole (${files.length} files, ${withTables} with tables, ${tables} tables)`,
    withTables >= 20 && bad.length === 0, () => `${bad.length} bad rows: ${bad.slice(0, 3).join(" / ")}`);
}

// ---------------------------------------------------------------- run

function main() {
  console.log(`competitor kit selfcheck (kit: ${path.basename(path.dirname(KIT))}/${path.basename(KIT)})`);
  try {
    section("kit", checkKit);
    section("guard", checkGuard);
    section("slugs", checkSlugs);
    section("check", checkCheck);
    section("input files", checkInputFiles);
    section("output folder", checkDirPrep);
    section("brief.full", checkBriefFull);
    section("brief.hostile", checkBriefHostile);
    section("records", checkRecordTables);
    section("md schemes", checkMdSchemes);
    section("brief.bad", checkBriefBad);
    section("limits", checkLimits);
    section("templates", checkTemplates);
    section("writes", checkWrites);
    section("links", checkLinks);
    section("compare", checkCompare);
    section("compare sourcing", checkCompareSourcing);
    section("text", checkText);
    section("run files", checkRunFiles);
    section("counts", checkCounts);
    section("folder cites", checkDirCites);
    section("md link addresses", checkMdHrefs);
    section("md tables", checkAllTables);
  } finally {
    try {
      fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3 });
    } catch (e) {
      console.log(`note: could not remove the temp folder (${e.code || e.message})`);
    }
  }
  const cleaned = !fs.existsSync(TMP);
  check("selfcheck.temp folder removed", cleaned);
  console.log(`selfcheck: ${nOk} ok, ${nFail} failed, ${nSkip} skipped`);
  return nFail ? 1 : 0;
}

process.exitCode = main();
