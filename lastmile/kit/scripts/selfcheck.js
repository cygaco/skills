#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";
/**
 * selfcheck.js — tests the /lastmile kit itself.
 *
 *   node .claude/lastmile/scripts/selfcheck.js        (from any directory)
 *
 * Prints one line per check (ok / FAIL / SKIP) and a summary. Exits 0 only if
 * nothing FAILed. Everything resolves from this file's folder; fixture repos are
 * materialized under os.tmpdir() and removed afterwards.
 *
 * Covers: detection on every fixture, the 9-dimension score, the scored gap of
 * each of the 7 holdouts, planning documents never changing a score, the
 * adapter contract, the 8 approval gates, gate coverage, argument validation,
 * review.js and plan.js as real child processes (installed into each fixture),
 * the sensitive-data stop, the no-overwrite rule, a missing template failing
 * loudly, the guide map, and that every require stays inside the kit.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { spawnSync } = require("child_process");

const SCRIPTS = __dirname;
const KIT = path.join(__dirname, "..");

const { CASES, HOLDOUTS, materialize, cleanup, getByPath, caseByName } = require("./fixtures");
const { detectRepoState } = require("./lib/detect");
const { scoreReadiness, DIMENSIONS } = require("./lib/score");
const { recommendStack, PROFILES } = require("./lib/profiles");
const { validateAdapter, sampleState } = require("./lib/adapter-contract");
const { GATES, GATE_IDS } = require("./lib/approval-gates");
const { parseArgs } = require("./lib/cli");
const { MODULE_NAMES } = require("./lib/analyze");
const guideMap = require("./lib/guide-map");
const markers = require("./lib/task-markers");
const review = require("./review");
const plan = require("./plan");

// ── reporting ────────────────────────────────────────────────────────
let nOk = 0;
let nFail = 0;
let nSkip = 0;
function ok(name) { nOk++; console.log(`ok    ${name}`); }
function fail(name, detail) {
  nFail++;
  console.log(`FAIL  ${name}${detail ? `: ${String(detail).slice(0, 400)}` : ""}`);
}
function skip(name, reason) { nSkip++; console.log(`SKIP  ${name} (${reason})`); }
function check(name, cond, detail) {
  if (cond) ok(name);
  else fail(name, typeof detail === "function" ? detail() : detail);
}
function guard(name, fn) {
  try {
    fn();
  } catch (e) {
    fail(name, `threw: ${e && e.message}`);
  }
}

// ── helpers ──────────────────────────────────────────────────────────
const TEMP_DIRS = [];
function fixtureDir(name) {
  const d = materialize(caseByName(name));
  TEMP_DIRS.push(d);
  return d;
}
function tempDir(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `lastmile-${label}-`));
  TEMP_DIRS.push(d);
  return d;
}

// Install the kit the way the README says: kit/ → <repo>/.claude/lastmile/
// (the scripts and templates are what the drivers need to run).
function installKit(repo) {
  const dest = path.join(repo, ".claude", "lastmile");
  fs.cpSync(SCRIPTS, path.join(dest, "scripts"), { recursive: true });
  fs.cpSync(path.join(KIT, "templates"), path.join(dest, "templates"), { recursive: true });
  return dest;
}

function run(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function lineCount(s) {
  return s.split("\n").filter((l) => l.trim()).length;
}

function sections(md) {
  const out = {};
  const parts = md.split(/^## /m);
  for (const p of parts.slice(1)) {
    const nl = p.indexOf("\n");
    out[p.slice(0, nl).trim()] = p.slice(nl + 1);
  }
  return out;
}

function taskLines(md) {
  return md.split("\n").filter((l) => l.startsWith("- [ ] ") || l.startsWith("- [x] "));
}

// Output hygiene shared by REVIEW.md and LAUNCH_PLAN.md (and stdout).
const SLASH_COMMAND_RE = /(?<![\w/])\/[a-z][a-z0-9-]*:[a-z][a-z0-9:-]*/;
// The decoy planning documents addDecoys() writes. The regex is built from
// their basenames (".md" dropped), so a mention with or without the
// extension counts: no output may name them.
const DECOY_DOC_NAMES = ["PLANNING_NOTES.md", "STACK_DECISIONS.md"];
const DECOY_DOC_RE = new RegExp(DECOY_DOC_NAMES.map((n) => path.basename(n, ".md").replace(/\W/g, "\\$&")).join("|"), "i");
function hygiene(label, text, repoDir) {
  const problems = [];
  if (/template fallback/i.test(text)) problems.push('contains "template fallback"');
  const slash = SLASH_COMMAND_RE.exec(text);
  if (slash) problems.push(`contains a slash command ${slash[0]}`);
  if (/\{\{\w+\}\}/.test(text)) problems.push("contains an unfilled {{placeholder}}");
  const decoy = DECOY_DOC_RE.exec(text);
  if (decoy) problems.push(`names a decoy planning document (${decoy[0]})`);
  if (repoDir && text.includes(repoDir)) problems.push("contains the absolute repo path");
  check(`${label}: output hygiene (no fallback text, no slash command, no placeholder, no decoy planning document, no absolute path)`, problems.length === 0, problems.join("; "));
}

// Neutral planning documents a repo happens to contain: unchecked boxes and a
// declared tech stack that differs from the default recommendation. They never
// change the score and never add a gap, and no output names them.
function addDecoys(repo) {
  fs.writeFileSync(
    path.join(repo, DECOY_DOC_NAMES[0]),
    [
      "# Planning notes",
      "",
      "- [ ] stripe-verify - Stripe identity verification (monetization)",
      "- [ ] privacy-page - Publish a privacy page before launch",
      "- [x] domain - Buy the domain",
      "",
    ].join("\n"),
    "utf8",
  );
  const dir = path.join(repo, "docs", "planning");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, DECOY_DOC_NAMES[1]),
    [
      "# Acme - Stack decisions",
      "",
      "## Tech stack",
      "Tech stack: Next.js, Supabase, Clerk, Paddle, Vercel, PostHog.",
      "",
      "| Layer | Choice | Why |",
      "| --- | --- | --- |",
      "| Framework | Next.js | the team knows it |",
      "| Database | Supabase | hosted Postgres |",
      "| Authentication | Clerk | quickest sign-in setup |",
      "| Payments | Paddle | merchant of record |",
      "| Hosting | Vercel | preview deploys |",
      "| Analytics | PostHog | product analytics |",
      "",
    ].join("\n"),
    "utf8",
  );
}

// ── 1. detection on every fixture ────────────────────────────────────
function testDetect() {
  console.log("\n# detect: every fixture");
  for (const c of CASES) {
    guard(`detect ${c.name}`, () => {
      const st = detectRepoState(fixtureDir(c.name));
      const misses = [];
      for (const e of c.expect) {
        const v = getByPath(st, e.path);
        if (v !== e.equals) misses.push(`${e.path}=${JSON.stringify(v)} (want ${JSON.stringify(e.equals)})`);
      }
      check(`detect ${c.name}: gap detected (${c.why})`, misses.length === 0, misses.join(", "));
    });
  }
  guard("detect: installed kit is not scanned", () => {
    const d = fixtureDir("no-auth");
    installKit(d);
    const st = detectRepoState(d);
    check(
      "detect: a kit installed under .claude/lastmile/ does not change detection (no false sensitive/webhook/pricing hits)",
      st.sensitive.escalate === false && st.funnel.hasPricing === false && st.account.deletionPath === false,
      () => JSON.stringify({ sensitive: st.sensitive, funnel: st.funnel, account: st.account }),
    );
  });
}

// ── 2. score ─────────────────────────────────────────────────────────
function testScore() {
  console.log("\n# score");
  guard("score", () => {
    const s = scoreReadiness(detectRepoState(fixtureDir("sensitive-data-redflag")));
    check("score: 9 dimensions + numeric composite", Object.keys(s.dimensions).length === 9 && DIMENSIONS.length === 9 && typeof s.composite === "number", JSON.stringify(s.dimensions));
    check(
      "score: sensitive data caps privacy + security at 40 or less and sets the escalation",
      s.sensitiveEscalation && s.dimensions.privacy <= 40 && s.dimensions.security <= 40,
      `privacy=${s.dimensions.privacy} security=${s.dimensions.security} esc=${s.sensitiveEscalation}`,
    );
  });
}

// ── 3. the 7 holdouts: scored gap text names each defect ─────────────
const HOLDOUT_PREDICATES = [
  ["no-auth", (s) => s.gaps.some((g) => g.dim === "security" && /auth/i.test(g.gap))],
  ["auth-no-payments", (s) => s.gaps.some((g) => g.dim === "monetization")],
  ["stripe-no-webhook-verify", (s) => s.gaps.some((g) => /webhook/i.test(g.gap))],
  ["db-no-deletion-path", (s) => s.gaps.some((g) => g.dim === "privacy" && /deletion/i.test(g.gap))],
  ["no-funnel", (s) => s.gaps.some((g) => g.dim === "funnel")],
  ["mobile-appstore", (s) => s.gaps.some((g) => g.dim === "monetization")],
  ["sensitive-data-redflag", (s) => s.sensitiveEscalation && s.gaps.some((g) => /sensitive/i.test(g.gap))],
];
function testHoldoutGaps() {
  console.log("\n# holdouts: scored gap names the defect (all 7)");
  check("holdouts: the 7 named cases are defined", HOLDOUTS.length === 7 && HOLDOUT_PREDICATES.every(([n], i) => HOLDOUTS[i] === n));
  for (const [name, pred] of HOLDOUT_PREDICATES) {
    guard(`holdout ${name}`, () => {
      const s = scoreReadiness(detectRepoState(fixtureDir(name)));
      check(`holdout ${name}: scored gap names the defect`, pred(s), JSON.stringify(s.gaps));
    });
  }
}

// ── 4. planning documents never change a score or add a gap ──────────
function testPlanningDocsChangeNothing() {
  console.log("\n# planning documents in the repo change nothing");
  for (const c of CASES) {
    guard(`planning documents ${c.name}`, () => {
      const d = fixtureDir(c.name);
      const out = path.join(d, "last-mile", "X.md");
      const before = {
        score: JSON.stringify(scoreReadiness(detectRepoState(d))),
        rec: JSON.stringify(recommendStack(null, detectRepoState(d))),
        review: review.buildReview(d, null, out).content,
        plan: plan.buildPlan(d, null, out).content,
      };
      addDecoys(d);
      const s2 = scoreReadiness(detectRepoState(d));
      const after = {
        score: JSON.stringify(s2),
        rec: JSON.stringify(recommendStack(null, detectRepoState(d))),
        review: review.buildReview(d, null, out).content,
        plan: plan.buildPlan(d, null, out).content,
      };
      const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
      check(`${c.name}: score, gaps, stack, review and plan identical with or without planning documents in the repo`, changed.length === 0, `changed: ${changed.join(", ")}`);
      const named = s2.gaps.filter((g) => DECOY_DOC_RE.test(g.gap));
      check(`${c.name}: no gap text names a planning document`, named.length === 0, JSON.stringify(named));
    });
  }
}

// ── 5. adapters ──────────────────────────────────────────────────────
function testAdapters() {
  console.log("\n# adapter contract + behavior");
  let bad = 0;
  for (const n of MODULE_NAMES) {
    const r = validateAdapter(require(`./modules/${n}`));
    if (!r.ok) { bad++; fail(`adapter ${n} contract`, r.errors.join("; ")); }
  }
  check("all 8 adapters conform to the contract", bad === 0 && MODULE_NAMES.length === 8);

  const badAdapter = {
    name: "x", title: "X",
    detect: () => ({ status: "absent", evidence: [] }),
    recommend: () => ({ choice: "y", alternatives: [] }),
    plan: () => ({ summary: "s", steps: [], envVars: [], gates: [], template: "launch-plan" }),
  };
  const neg = validateAdapter(badAdapter);
  check("validateAdapter rejects an adapter missing plan().tests/risks", !neg.ok && neg.errors.some((e) => /tests/.test(e)) && neg.errors.some((e) => /risks/.test(e)), JSON.stringify(neg));

  guard("payments behavior", () => {
    const ps = require("./modules/payments").detect(detectRepoState(fixtureDir("stripe-no-webhook-verify")));
    check("payments adapter: flags Stripe-without-verified-webhook as partial", ps.present && ps.webhookVerified === false && ps.status === "partial", JSON.stringify(ps));
  });
  guard("security behavior", () => {
    const sec = require("./modules/security").detect(detectRepoState(fixtureDir("sensitive-data-redflag")));
    check("security adapter: escalates + status absent on sensitive data", sec.escalate && sec.status === "absent", JSON.stringify(sec));
  });

  const templates = new Set();
  for (const n of MODULE_NAMES) templates.add(require(`./modules/${n}`).plan(sampleState(), "web-saas").template);
  const missing = [...templates].filter((t) => !fs.existsSync(path.join(KIT, "templates", `${t}.tmpl.md`)));
  check("every module plan().template names a template that ships in templates/", missing.length === 0, missing.join(", "));

  guard("analytics activation helper", () => {
    const a = require("./modules/analytics");
    const base = { predicate: "created a first project", provenance: "inferred-from-repo", confidence: 0.6, derivedFrom: "app/projects/new" };
    const confirmed = a.confirmOrReviseActivationDefinition(base);
    const events = [];
    a.confirmOrReviseActivationDefinition(base, { emit: (n, p) => events.push([n, p]), revision: { predicate: "invited a colleague" } });
    let threw = false;
    try { a.confirmOrReviseActivationDefinition({ ...base, predicate: "TODO" }); } catch { threw = true; }
    check(
      "analytics: activation definition confirms, emits activation_definition_change on revision, rejects a placeholder",
      confirmed.lastmileConfirmed === true && events.length === 1 && events[0][0] === "activation_definition_change" &&
        events[0][1].changedFields.includes("predicate") && threw,
      JSON.stringify(events),
    );
  });
}

// ── 6. approval gates ────────────────────────────────────────────────
const EXPECTED_GATES = [
  "stripe-live",
  "prod-db-migration",
  "domain-dns",
  "server-provision",
  "app-store-submit",
  "email-real-users",
  "collect-sensitive-data",
  "publish-legal-docs",
];
function testGates() {
  console.log("\n# approval gates");
  check("gate registry: exactly the 8 gate ids", JSON.stringify(GATE_IDS) === JSON.stringify(EXPECTED_GATES), JSON.stringify(GATE_IDS));
  check("gate registry: every gate has action, why and requires text", GATES.every((g) => [g.action, g.why, g.requires].every((x) => typeof x === "string" && x.length > 10)));

  const states = [
    sampleState(),
    Object.assign(sampleState(), { platform: "mobile" }),
    Object.assign(sampleState(), { sensitive: { signals: ["health"], escalate: true } }),
  ];
  let bad = 0;
  for (const n of MODULE_NAMES) {
    const mod = require(`./modules/${n}`);
    for (const st of states) {
      for (const g of mod.plan(st, "web-saas").gates || []) {
        if (!GATE_IDS.includes(g)) { bad++; fail(`module ${n} gate "${g}"`, "not in the approval-gate registry"); }
      }
    }
  }
  check("all module plan().gates are registry ids (sample/mobile/sensitive states)", bad === 0);

  const base = sampleState();
  const sensitive = Object.assign(sampleState(), { sensitive: { signals: ["health"], escalate: true } });
  const mobile = Object.assign(sampleState(), { platform: "mobile" });
  const selfHosted = Object.assign(sampleState(), { persistence: { provider: "postgres", hostingModel: "self-hosted", evidence: [] } });
  const G = (n, st, prof) => require(`./modules/${n}`).plan(st, prof || "web-saas").gates || [];
  const cov = [
    ["prod-db-migration", G("database", base)],
    ["stripe-live", G("payments", base)],
    ["app-store-submit", G("payments", mobile, "mobile-app")],
    ["email-real-users", G("crm", base)],
    ["domain-dns", G("deployment", base)],
    ["app-store-submit", G("deployment", mobile, "mobile-app")],
    ["server-provision", G("deployment", selfHosted, "self-hosted")],
    ["publish-legal-docs", G("security", base)],
    ["collect-sensitive-data", G("security", sensitive)],
  ];
  for (const [gate, gates] of cov) check(`gate "${gate}" surfaces on its triggering state`, gates.includes(gate), `got ${JSON.stringify(gates)}`);
  const secSteps = require("./modules/security").plan(sensitive, "web-saas").steps;
  check("security.plan() emits the HARD STOP step on sensitive data", secSteps.some((s) => /HARD STOP/i.test(s)), JSON.stringify(secSteps.slice(0, 1)));
  check("mobile payments do not surface stripe-live for platform billing", !G("payments", mobile, "mobile-app").includes("stripe-live"));
}

// ── 7. argument validation ───────────────────────────────────────────
function testArgs() {
  console.log("\n# argument validation");
  const P = (spec, extra) => parseArgs(extra, spec);
  check("parseArgs rejects an unknown flag (--jsno typo)", !!P(review.SPEC, ["--jsno"]).error);
  check("parseArgs rejects a flag-looking value (--out --json)", !!P(review.SPEC, ["--out", "--json"]).error);
  check("parseArgs rejects a value flag with no value (--repo-root)", !!P(review.SPEC, ["--repo-root"]).error);
  check("parseArgs rejects a stray positional argument", !!P(review.SPEC, ["extra"]).error);
  const good = P(plan.SPEC, ["--profile", "web-saas", "--force", "--json", "--out", "x.md"]);
  check("parseArgs accepts a valid mix", !good.error && good.profile === "web-saas" && good.force && good.json && good.out === "x.md", JSON.stringify(good));
  check("profiles: the --profile list has the 9 profiles", PROFILES.length === 9 && PROFILES.includes("web-saas") && PROFILES.includes("unknown"));

  const d = fixtureDir("no-auth");
  for (const [script, label] of [[path.join(SCRIPTS, "review.js"), "review.js"], [path.join(SCRIPTS, "plan.js"), "plan.js"]]) {
    const r1 = run(script, ["--repo-root", d, "--profile", "nope"], d);
    check(`${label}: unknown --profile exits 2 and writes nothing`, r1.status === 2 && !fs.existsSync(path.join(d, "last-mile")), `exit=${r1.status} ${r1.stderr}`);
    const r2 = run(script, ["--repo-root", d, "--frobnicate"], d);
    check(`${label}: unknown flag exits 2 and writes nothing`, r2.status === 2 && !fs.existsSync(path.join(d, "last-mile")), `exit=${r2.status} ${r2.stderr}`);
    const r3 = run(script, ["--repo-root", path.join(d, "does-not-exist")], d);
    check(`${label}: a missing --repo-root exits 2`, r3.status === 2, `exit=${r3.status}`);
  }

  guard("in-process review/plan data", () => {
    const repo = fixtureDir("auth-no-payments");
    const out = path.join(repo, "last-mile", "X.md");
    const rv = review.buildReview(repo, null, out).data;
    check("review: returns a numeric score + 8 module detections", typeof rv.composite === "number" && rv.detections.length === 8, JSON.stringify(rv).slice(0, 200));
    const pl = plan.buildPlan(repo, null, out).data;
    check("plan: returns gates + 8 module plans", Array.isArray(pl.gates) && pl.modules.length === 8, JSON.stringify(pl).slice(0, 200));
    check("plan: surfaces the stripe-live approval gate", pl.gates.includes("stripe-live"), JSON.stringify(pl.gates));
  });
}

// ── 8. review.js as a real child process, installed in each fixture ──
const REVIEW_EXPECT = {
  "no-auth": [/no auth provider/],
  "auth-no-payments": [/no payment provider/],
  "stripe-no-webhook-verify": [/payment webhook signature NOT verified/],
  "db-no-deletion-path": [/no account deletion path/],
  "no-funnel": [/no landing\/homepage surface/, /no pricing surface/],
  "mobile-appstore": [/no payment provider/, /profile: `mobile-app`/],
  "sensitive-data-redflag": [/STOP — SENSITIVE DATA DETECTED/, /sensitive data \(health\)/],
  "self-hosted-postgres": [/Launch-Readiness Score: \d+\/100/],
};
function testReviewCli() {
  console.log("\n# review.js (child process, kit installed in the fixture)");
  for (const c of CASES) {
    guard(`review.js ${c.name}`, () => {
      const d = fixtureDir(c.name);
      installKit(d);
      const r = run(path.join(d, ".claude", "lastmile", "scripts", "review.js"), [], d);
      const file = path.join(d, "last-mile", "REVIEW.md");
      check(`review.js ${c.name}: exits 0 and writes last-mile/REVIEW.md`, r.status === 0 && fs.existsSync(file), `exit=${r.status} ${r.stderr}`);
      if (!fs.existsSync(file)) return;
      const md = fs.readFileSync(file, "utf8");
      check(`review.js ${c.name}: stdout is at most 6 lines`, lineCount(r.stdout) <= 6, r.stdout);
      const miss = (REVIEW_EXPECT[c.name] || []).filter((re) => !re.test(md));
      check(`review.js ${c.name}: expected finding present in REVIEW.md`, miss.length === 0, miss.map(String).join(", "));
      const scoreAt = md.indexOf("## Launch-Readiness Score:");
      const afterScore = md.slice(scoreAt).split("\n").filter((l) => l.trim())[1] || "";
      if (c.name === "sensitive-data-redflag") {
        check("review.js sensitive: STOP banner sits directly under the score and names the signal + legal/security review", /^> ⛔ \*\*STOP — SENSITIVE DATA DETECTED\*\* \(health\)/.test(afterScore) && /legal and security review/.test(afterScore), afterScore);
      } else {
        check(`review.js ${c.name}: no STOP banner without sensitive data`, !/STOP — SENSITIVE DATA/.test(md));
      }
      const gapLines = md.split("\n").filter((l) => /^- \*\*\w+\*\* — /.test(l));
      check(
        `review.js ${c.name}: every gap is one bullet with its dimension and guide links into ../.claude/lastmile/`,
        gapLines.length > 0 && gapLines.every((l) => / — guide: \[[^\]]+\]\(\.\.\/\.claude\/lastmile\/(guides|playbooks|knowledge)\//.test(l)),
        gapLines.find((l) => !/ — guide: /.test(l)),
      );
      check(`review.js ${c.name}: ends with the detector-pass note`, /detector pass/.test(md) && /Reviewer notes/.test(md));
      hygiene(`review.js ${c.name}`, md + r.stdout + r.stderr, d);
    });
  }
  guard("review.js --json", () => {
    const d = fixtureDir("stripe-no-webhook-verify");
    const r = run(path.join(SCRIPTS, "review.js"), ["--repo-root", d, "--json"], d);
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { j = null; }
    check(
      "review.js --json: prints the data object (composite, dimensions, gaps with guide files, escalate, profile, detections, review_path)",
      r.status === 0 && j && typeof j.composite === "number" && Object.keys(j.dimensions).length === 9 &&
        j.gaps.length > 0 && j.gaps.every((g) => Array.isArray(g.guides) && g.guides.length > 0) &&
        j.escalate === false && j.profile === "web-saas" && j.detections.length === 8 && fs.existsSync(j.review_path),
      r.stdout.slice(0, 300) + r.stderr,
    );
  });
}

// ── 9. plan.js as a real child process ───────────────────────────────
const MODULE_TITLES = MODULE_NAMES.map((n) => require(`./modules/${n}`).title);
function checkPlanFile(label, md, opts) {
  const sec = sections(md);
  const order = ["1. Start these today (slow clocks)", "2. Tasks", "3. Module detail", "4. Approval gates ahead", "Done when"];
  const idx = order.map((h) => md.indexOf(`## ${h}`));
  check(`${label}: sections 1-4 and "Done when" present in order`, idx.every((i) => i >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), JSON.stringify(idx));
  const s1Tasks = taskLines(sec[order[0]] || "");
  check(`${label}: slow-clock section has tasks, all 🔴`, s1Tasks.length > 0 && s1Tasks.every((l) => l.includes(markers.HUMAN)), s1Tasks.join("\n"));
  const all = taskLines(md);
  const badMarker = all.filter((l) => markers.markerCount(l) !== 1);
  check(`${label}: every task line has exactly one of 🔴 or 🤖`, all.length > 0 && badMarker.length === 0, badMarker.slice(0, 3).join("\n"));
  const gateLines = all.filter((l) => l.includes(markers.GATE));
  const badGate = gateLines.filter((l) => {
    const m = new RegExp(`${markers.GATE} ([a-z-]+) `).exec(l);
    return !l.includes(markers.HUMAN) || !m || !GATE_IDS.includes(m[1]);
  });
  check(`${label}: every ⛔ task carries 🔴 and a registered gate id`, badGate.length === 0, badGate.slice(0, 3).join("\n"));
  const missingGates = opts.gates.filter((g) => !all.some((l) => l.includes(`${markers.GATE} ${g} `)));
  check(`${label}: every gate the plan crosses has a ⛔ task`, missingGates.length === 0, missingGates.join(", "));
  const s4 = sec[order[3]] || "";
  const s4Missing = opts.gates.filter((g) => !s4.includes(`**${g}**`) || !new RegExp(`\\*\\*${g}\\*\\*[^\\n]*Requires: `).test(s4));
  check(`${label}: "Approval gates ahead" lists each crossed gate with its requires text`, s4Missing.length === 0, s4Missing.join(", "));
  const s2 = sec[order[1]] || "";
  const pos = MODULE_TITLES.map((t) => s2.indexOf(`**${t}`));
  check(`${label}: tasks run database, auth, payments, website, analytics, crm, security, deployment, then go-live`, pos.every((p) => p >= 0) && pos.every((v, i) => i === 0 || v > pos[i - 1]) && (s2.indexOf("**Go-live gates**") === -1 || s2.indexOf("**Go-live gates**") > pos[pos.length - 1]), JSON.stringify(pos));
  const s3 = sec[order[2]] || "";
  const blocks = {};
  for (const b of s3.split(/^### /m).slice(1)) {
    const nl = b.indexOf("\n");
    blocks[b.slice(0, nl).trim()] = b.slice(nl + 1).trim();
  }
  const emptyMods = MODULE_TITLES.filter((t) => !blocks[t] || blocks[t].length < 40);
  check(`${label}: "Module detail" has a non-empty ### section for every module`, emptyMods.length === 0, emptyMods.join(", "));
  check(`${label}: "Done when" names the first paid transaction in live mode`, /first paid transaction in live mode/.test(sec["Done when"] || ""));
  const guideless = all.filter((l) => !/ — guide: \[[^\]]+\]\(\.\.\/\.claude\/lastmile\//.test(l));
  check(`${label}: every task links its guide`, guideless.length === 0, guideless.slice(0, 2).join("\n"));
}

function testPlanCli() {
  console.log("\n# plan.js (child process)");
  for (const name of [...HOLDOUTS, "self-hosted-postgres"]) {
    guard(`plan.js ${name}`, () => {
      const d = fixtureDir(name);
      installKit(d);
      const script = path.join(d, ".claude", "lastmile", "scripts", "plan.js");
      const r = run(script, [], d);
      const file = path.join(d, "last-mile", "LAUNCH_PLAN.md");
      check(`plan.js ${name}: exits 0 and writes last-mile/LAUNCH_PLAN.md`, r.status === 0 && fs.existsSync(file), `exit=${r.status} ${r.stderr}`);
      if (!fs.existsSync(file)) return;
      const md = fs.readFileSync(file, "utf8");
      check(`plan.js ${name}: stdout is at most 6 lines`, lineCount(r.stdout) <= 6, r.stdout);
      const data = plan.buildPlan(d, null, file).data;
      checkPlanFile(`plan.js ${name}`, md, { gates: data.gates });
      hygiene(`plan.js ${name}`, md + r.stdout + r.stderr, d);
      const s1 = sections(md)["1. Start these today (slow clocks)"] || "";
      if (name === "mobile-appstore") {
        const need = [/Apple Developer/, /Google Play Console developer account/, /14 days/, /D-U-N-S/];
        check("plan.js mobile: slow clocks include Apple, Google Play, the 14-day closed test and D-U-N-S", need.every((re) => re.test(s1)), s1);
      }
      if (name === "stripe-no-webhook-verify") {
        check("plan.js stripe: slow clocks include Stripe identity and bank verification", /Stripe identity and bank verification/.test(s1), s1);
        check("plan.js stripe: payments run in test mode before the stripe-live gate", /\*\*Payments & Monetization \(test mode\)\*\*/.test(md) && /⛔ stripe-live /.test(md));
      }
      if (name === "no-auth") {
        check("plan.js web: slow clocks include the domain purchase and the sending-domain records behind ⛔ domain-dns", /Buy your domain/.test(s1) && /🔴 ⛔ domain-dns Add your sending domain's email records \(SPF, DKIM, DMARC\)/.test(s1), s1);
        check("plan.js: no blocked-until-review markers without sensitive data", !/blocked until legal\/security review/.test(md) && !/Legal\/security review by a qualified person/.test(md));
      }
      if (name === "sensitive-data-redflag") {
        const first = taskLines(s1)[0] || "";
        check(
          "plan.js sensitive: the FIRST slow-clock task is the legal/security review by a qualified person",
          /^- \[ \] 🔴 Legal\/security review by a qualified person completed — guide: \[LEGAL_GUIDE\.md\]\([^)]*LEGAL_GUIDE\.md\)$/.test(first),
          first,
        );
        const lines = taskLines(md);
        const csd = lines.filter((l) => l.includes("⛔ collect-sensitive-data "));
        const pld = lines.filter((l) => l.includes("⛔ publish-legal-docs "));
        check(
          "plan.js sensitive: collect-sensitive-data and publish-legal-docs tasks say (blocked until legal/security review)",
          csd.length > 0 && pld.length > 0 && [...csd, ...pld].every((l) => l.includes(plan.BLOCKED_SUFFIX)),
          [...csd, ...pld].join("\n"),
        );
        check("plan.js sensitive: a STOP banner sits at the top, before section 1", /STOP — SENSITIVE DATA DETECTED/.test(md.slice(0, md.indexOf("## 1."))));
      }
      if (name === "no-funnel") {
        // the no-overwrite rule
        const before = fs.readFileSync(file);
        const again = run(script, [], d);
        const after = fs.readFileSync(file);
        check("plan.js: a second run without --force exits 3, prints one line and leaves the file byte-identical", again.status === 3 && Buffer.compare(before, after) === 0 && lineCount(again.stdout + again.stderr) === 1, `exit=${again.status} ${again.stderr}`);
        const forced = run(script, ["--force"], d);
        check("plan.js --force replaces the existing plan (exit 0)", forced.status === 0, `exit=${forced.status} ${forced.stderr}`);
      }
    });
  }
}

// ── 10. a missing template fails loudly ──────────────────────────────
function testMissingTemplate() {
  console.log("\n# missing template");
  const kitCopy = tempDir("notemplates");
  fs.cpSync(SCRIPTS, path.join(kitCopy, "scripts"), { recursive: true }); // scripts only, no templates/
  const repo = fixtureDir("no-auth");
  for (const s of ["review.js", "plan.js"]) {
    const out = path.join(repo, "last-mile", `${s}.md`);
    const r = run(path.join(kitCopy, "scripts", s), ["--repo-root", repo, "--out", out], repo);
    check(
      `${s}: a missing template exits 1 with a one-line "template missing" message and writes nothing`,
      r.status === 1 && /template missing/.test(r.stderr) && lineCount(r.stderr) === 1 && !fs.existsSync(out) && !/fallback/i.test(r.stdout + r.stderr),
      `exit=${r.status} ${r.stderr}`,
    );
  }
}

// ── 11. the guide map ────────────────────────────────────────────────
function testGuideMap() {
  console.log("\n# guide map");
  for (const n of MODULE_NAMES) check(`guide-map: module ${n} has at least one guide`, guideMap.guidesForModule(n).length > 0);
  const mob = guideMap.guidesForModule("deployment", { mobile: true }).map((r) => r.key);
  check("guide-map: mobile deployment adds APP_STORE and TESTING_ON_PC", mob.includes("APP_STORE") && mob.includes("TESTING_ON_PC"), mob.join(", "));
  for (const g of ["gate/privacy", "gate/legal", "gate/app-store"]) check(`guide-map: ${g} has guides`, (guideMap.GATE_GUIDES[g] || []).length > 0);
  for (const g of GATE_IDS) check(`guide-map: approval gate ${g} has a guide`, guideMap.guidesForApprovalGate(g).length > 0);
  check("guide-map: day-zero = DEV_SETUP, API_LIMITS, COMPLIANCE_TRIGGERS, MINORS, TESTING_ON_PC", JSON.stringify(guideMap.DAY_ZERO) === JSON.stringify(["DEV_SETUP", "API_LIMITS", "COMPLIANCE_TRIGGERS", "MINORS", "TESTING_ON_PC"]));
  for (const d of DIMENSIONS) check(`guide-map: dimension ${d} has at least one guide`, guideMap.guidesForGap({ dim: d, gap: "" }).length > 0);
  const badEntries = Object.entries(guideMap.GUIDES).filter(([, g]) => typeof g.lead_time !== "string" || !g.lead_time || typeof g.slowClock !== "boolean" || !/\.md$/.test(g.file));
  check("guide-map: every guide entry has a file name, lead_time text and a slowClock flag", badEntries.length === 0, badEntries.map(([k]) => k).join(", "));
  const badSlow = Object.entries(guideMap.GUIDES).filter(([, g]) => g.slowClock && !/\b(day|days|week|weeks|month|months|\d+-\d+h|\d+d)\b|days?-|weeks?\b/i.test(g.lead_time));
  check("guide-map: every slowClock guide's lead time is measured in days or more", badSlow.length === 0, badSlow.map(([k]) => k).join(", "));
  const anchored = guideMap.anchoredGuideFiles();
  const unanchored = Object.values(guideMap.GUIDES).map((g) => g.file).filter((f) => !anchored.has(f));
  check("guide-map: every catalogued guide is reachable from a module, gate, day-zero or dimension entry", unanchored.length === 0, unanchored.join(", "));
  check("guide-map: the catalogue holds 24 anchored guides (26 shipped minus README and LAUNCH_FILM)", Object.keys(guideMap.GUIDES).length === 24);
  const badSlowClockItems = guideMap.SLOW_CLOCKS.filter((s) => !guideMap.GUIDES[s.guide] || (s.gate && !GATE_IDS.includes(s.gate)));
  check("guide-map: every slow-clock item names a known guide (and a registered gate where it crosses one)", badSlowClockItems.length === 0, badSlowClockItems.map((s) => s.id).join(", "));

  // Files named by the map exist in the kit. Before the content folders are
  // copied in (source pack folder), each missing folder is a SKIP, not a pass.
  const entries = guideMap.allEntries();
  const groups = {};
  for (const e of entries) {
    const top = e.path.split("/")[0];
    (groups[top] = groups[top] || []).push(e.path);
  }
  for (const [top, files] of Object.entries(groups)) {
    const dir = path.join(KIT, top);
    if (!fs.existsSync(dir)) {
      skip(`guide-map: ${files.length} file(s) named in kit/${top}`, `kit/${top} not present`);
      continue;
    }
    const missing = files.filter((f) => !fs.existsSync(path.join(KIT, ...f.split("/"))));
    check(`guide-map: all ${files.length} file(s) named in kit/${top} exist`, missing.length === 0, `missing: ${missing.join(", ")}`);
  }
  const guidesDir = path.join(KIT, "guides");
  if (!fs.existsSync(guidesDir)) {
    skip("guide-map: every shipped guide except README and LAUNCH_FILM is reachable", "kit/guides not present");
  } else {
    const shipped = fs.readdirSync(guidesDir).filter((f) => f.endsWith(".md") && !guideMap.UNANCHORED_GUIDES.includes(f));
    const notReached = shipped.filter((f) => !anchored.has(f));
    check(`guide-map: every shipped guide except README and LAUNCH_FILM is reachable (${shipped.length} checked)`, notReached.length === 0, notReached.join(", "));
  }
}

// ── 12. task markers ─────────────────────────────────────────────────
function testTaskMarkers() {
  console.log("\n# task markers");
  const cases = [
    ["Provision the server: stand up a VPS/host", markers.HUMAN, "server-provision"],
    ["Custom domain: configure DNS (a human-approval gate) + HTTPS.", markers.HUMAN, "domain-dns"],
    ["Migrations: adopt a migration tool (production migration is a human-approval gate).", markers.AI, null],
    ["Privacy policy: Draft now; publishing as FINAL is a human-approval gate.", markers.AI, null],
    ["Create your Stripe account", markers.HUMAN, null],
    ["Complete identity verification with your bank", markers.HUMAN, null],
    ["Buy the domain", markers.HUMAN, null],
    ["Get a lawyer review of the terms", markers.HUMAN, null],
    ["Approve the launch copy", markers.HUMAN, null],
    ["Submit the app to the App Store", markers.HUMAN, "app-store-submit"],
    ["Switch payments to live mode", markers.HUMAN, "stripe-live"],
    ["Rate limiting: on auth, payment, and write endpoints", markers.AI, null],
  ];
  const wrong = cases.filter(([t, m, g]) => {
    const c = markers.classifyTask(t);
    return c.marker !== m || c.gate !== g;
  });
  check("task-markers: the explicit keyword rules classify 🔴/🤖 and gates as documented", wrong.length === 0, wrong.map(([t]) => t).join(" | "));
}

// ── 13. every require stays inside the kit ───────────────────────────
function walkJs(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJs(full));
    else if (ent.name.endsWith(".js")) out.push(full);
  }
  return out;
}
function insideKit(abs) {
  const rel = path.relative(KIT, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
function testRequires() {
  console.log("\n# requires stay inside the kit");
  const builtins = new Set(Module.builtinModules);
  const problems = [];
  const callRe = new RegExp("\\brequire" + "\\(\\s*([^)]*?)\\s*\\)", "g");
  const dirRe = new RegExp("path\\.(?:join|resolve)\\(\\s*__dirname\\s*((?:,\\s*[^,)]+)*)\\)", "g");
  for (const file of walkJs(SCRIPTS)) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(KIT, file).split(path.sep).join("/");
    let m;
    callRe.lastIndex = 0;
    while ((m = callRe.exec(src))) {
      const arg = m[1];
      const lit = /^(['"])([^'"]+)\1$/.exec(arg);
      const tpl = /^`([^`$]*)\$\{[^`]*`$/.exec(arg);
      if (lit) {
        const name = lit[2];
        if (builtins.has(name.replace(/^node:/, ""))) continue;
        if (!name.startsWith("./") && !name.startsWith("../")) { problems.push(`${rel}: non-stdlib package "${name}"`); continue; }
        const base = path.resolve(path.dirname(file), name);
        const hit = [base, `${base}.js`, path.join(base, "index.js")].find((p) => fs.existsSync(p));
        if (!hit || !insideKit(hit)) problems.push(`${rel}: "${name}" does not resolve inside the kit`);
      } else if (tpl) {
        const prefix = tpl[1];
        if (!prefix.startsWith("./") && !prefix.startsWith("../")) problems.push(`${rel}: dynamic load without a relative prefix`);
        else if (!insideKit(path.resolve(path.dirname(file), prefix))) problems.push(`${rel}: dynamic load climbs out of the kit`);
      } else {
        problems.push(`${rel}: non-literal load argument ${arg}`);
      }
    }
    dirRe.lastIndex = 0;
    while ((m = dirRe.exec(src))) {
      const segs = (m[1] || "").split(",").map((s) => s.trim()).filter(Boolean);
      const literal = [];
      for (const s of segs) {
        const q = /^(['"])([^'"]*)\1$/.exec(s);
        if (!q) break;
        literal.push(q[2]);
      }
      if (!insideKit(path.resolve(path.dirname(file), ...literal))) problems.push(`${rel}: a __dirname path climbs out of the kit`);
    }
  }
  check("every load is stdlib or a file inside the kit; no __dirname path climbs out of it", problems.length === 0, problems.join("; "));
}

// ── main ─────────────────────────────────────────────────────────────
function main() {
  console.log("lastmile selfcheck");
  const steps = [
    testDetect,
    testScore,
    testHoldoutGaps,
    testPlanningDocsChangeNothing,
    testAdapters,
    testGates,
    testArgs,
    testReviewCli,
    testPlanCli,
    testMissingTemplate,
    testGuideMap,
    testTaskMarkers,
    testRequires,
  ];
  try {
    for (const step of steps) guard(step.name, step);
  } finally {
    for (const d of TEMP_DIRS) {
      try { cleanup(d); } catch (e) { fail("cleanup", e.message); }
    }
  }
  const leftover = TEMP_DIRS.filter((d) => fs.existsSync(d));
  check("fixtures: every temp folder was removed", leftover.length === 0, leftover.join(", "));
  console.log(`\nlastmile selfcheck: ${nOk} ok, ${nFail} FAIL, ${nSkip} SKIP`);
  return nFail === 0 ? 0 : 1;
}

process.exitCode = main();
