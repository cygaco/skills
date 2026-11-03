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
 * rule, with allowed controls; slugs and output confinement; check and
 * check-url; a full brief in both formats; a hostile brief (escaping, dropped
 * rows, refused records, labels); bad drafts; missing and broken templates;
 * unexpected errors; the comparison with valid, missing, "..", absolute and
 * drive-letter path cites and "you said"; and every exit code.
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
const { BRIEF_FILES, COMPARE_FILES } = require("./lib/templates");
const { CEILING } = require("./lib/brief");

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
  check(`${prefix} md links are checked source records only`, links.length > 0 && links.every((h) => allowed.has(h)), () => links.filter((h) => !allowed.has(h)).join(" "));
  const bare = rest.replace(/\]\(\)/g, "");
  check(`${prefix} md has no other link syntax`, !/(^|[^\\])\]\(/m.test(bare) && !/(^|[^\\])\]\[/m.test(bare) && !/^ {0,3}\[[^\]\n]*\]:/m.test(bare));
  check(`${prefix} md has no raw HTML or angle autolink`, !rest.includes("<"));
  check(`${prefix} md has no bare URL or www autolink`, !/https?:\/\//i.test(rest) && !/\bwww\./i.test(rest));
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
  ];
  for (const [rule, url, frag] of refused) {
    const r = guard.checkUrl(url);
    check(`guard.refuses ${rule}`, !r.ok && String(r.reason).includes(frag), () => JSON.stringify(r));
  }
  check("guard.refuses an empty host", guard.refuseHost("") === "empty host" && guard.refuseHost("...") === "empty host");
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
  ];
  for (const [rule, url] of allowed) {
    const r = guard.checkUrl(url);
    check(`guard.allows ${rule}`, r.ok === true, () => JSON.stringify(r));
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
  let r = cli(["check", "--target", "Acme Notes"]);
  check("check.name prints the slug, exit 0", r.code === 0 && r.out.join("|") === "slug: acme-notes", () => JSON.stringify(r));
  r = cli(["check", "--target=https://www.Example.com/x"]);
  check("check.url prints slug and normalised url, exit 0", r.code === 0 && r.out.join("|") === "slug: example-com|url: https://www.example.com/x", () => JSON.stringify(r));
  r = cli(["check", "--target", "http://127.0.0.1/"]);
  check("check.refused url exits 2 with refused: reason", r.code === 2 && /^refused: IPv4 127/.test(r.out[0] || ""), () => JSON.stringify(r));
  r = cli(["check", "--target", "javascript:alert(1)"]);
  check("check.refused scheme exits 2", r.code === 2 && /^refused: scheme/.test(r.out[0] || ""));
  r = cli(["check", "--target", "CON"]);
  check("check.reserved slug exits 2", r.code === 2 && /reserved/.test(r.out[0] || ""));
  r = cli(["check", "--target", String.fromCharCode(0x65e5, 0x672c)]);
  check("check.name with no usable slug exits 2", r.code === 2 && /^refused: the slug is empty/.test(r.out[0] || ""));
  r = cli(["check", "--target", "a\u0007b"]);
  check("check.name with control characters exits 2", r.code === 2 && /control/.test(r.out[0] || ""));
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
  check("brief.full lists the refused-before-fetch record quietly as not fetched", /\| S8 \| http\\:\/\/192\.168\.1\.10\/admin \| landing \| refused \|/.test(md));
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
    ["target.name giving a reserved slug", { ...base, target: { name: "NUL" } }],
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

  // Unexpected errors: the write fails underneath the script.
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    fs.mkdirSync(path.join(repo, "competitor", "acme-notes", "acme-notes.competitor.md"), { recursive: true });
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    check("brief.unexpected error (output path is a folder) exits 1", r.code === 1 && r.err.some((l) => l.startsWith("error: unexpected failure")), () => JSON.stringify(r));
  }
  {
    const repo = makeRepo();
    putJson(repo, "draft.json", fixture("draft-full.json"));
    fs.writeFileSync(path.join(repo, "competitor"), "a file where the folder should be");
    const r = cli(["brief", "--draft", "draft.json"], { cwd: repo });
    check("brief.unexpected error (competitor is a file) exits 1", r.code === 1 && r.err.some((l) => l.startsWith("error: unexpected failure")), () => JSON.stringify(r));
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
  check("compare.their side without a fetched page is labelled inferred", /\| C3 \| Offline mode \| partial \| \*inferred, no source\* \|/.test(md) && /\| C4 \| Export \| no \| \*inferred, no source\* \|/.test(md));
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
}

// ---------------------------------------------------------------- run

function main() {
  console.log(`competitor kit selfcheck (kit: ${path.basename(path.dirname(KIT))}/${path.basename(KIT)})`);
  try {
    section("kit", checkKit);
    section("guard", checkGuard);
    section("slugs", checkSlugs);
    section("check", checkCheck);
    section("brief.full", checkBriefFull);
    section("brief.hostile", checkBriefHostile);
    section("brief.bad", checkBriefBad);
    section("templates", checkTemplates);
    section("links", checkLinks);
    section("compare", checkCompare);
    section("text", checkText);
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
