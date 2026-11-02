#!/usr/bin/env node
"use strict";
/**
 * plan.js — /lastmile step 3: the launch-plan skeleton.
 *
 * Recomputes the repo state exactly as review.js does (it never parses
 * REVIEW.md), runs each module's plan(), and renders last-mile/LAUNCH_PLAN.md
 * from templates/launch-plan.tmpl.md:
 *
 *   ## 1. Start these today (slow clocks)   outside clocks, all 🔴
 *   ## 2. Tasks                             ordered checkboxes, 🔴 or 🤖, ⛔ on gates
 *   ## 3. Module detail                     summary, env vars, tests, risks
 *   ## 4. Approval gates ahead              every gate a task crosses
 *   ## Done when                            first paid transaction in live mode
 *
 * It never overwrites an existing plan unless --force is given.
 *
 * Usage:
 *   node .claude/lastmile/scripts/plan.js [--repo-root <dir>] [--profile <name>] [--out <file>] [--force] [--json]
 *
 * Exit: 0 written · 3 plan exists and --force not given (nothing written)
 *       2 bad usage · 1 unexpected error
 */

const fs = require("fs");
const path = require("path");
const { EXIT, parseArgs, resolveCommon, displayPath } = require("./lib/cli");
const { analyze } = require("./lib/analyze");
const render = require("./lib/render");
const guideMap = require("./lib/guide-map");
const { GATES, gateFor } = require("./lib/approval-gates");
const markers = require("./lib/task-markers");

const SPEC = {
  value: { "--repo-root": "repoRoot", "--profile": "profile", "--out": "out" },
  bool: { "--json": "json", "--force": "force" },
};
const DEFAULT_OUT = path.join("last-mile", "LAUNCH_PLAN.md");
const USAGE =
  "usage: node .claude/lastmile/scripts/plan.js [--repo-root <dir>] [--profile <name>] [--out <file>] [--force] [--json]";

// The go-live order of the approval gates, and the task text for a gate that
// no module step already carries.
const GO_LIVE_ORDER = [
  "publish-legal-docs",
  "collect-sensitive-data",
  "prod-db-migration",
  "server-provision",
  "domain-dns",
  "app-store-submit",
  "stripe-live",
  "email-real-users",
];
const GO_LIVE_TEXT = {
  "publish-legal-docs": "Publish the privacy policy and terms as final legal documents",
  "collect-sensitive-data": "Start collecting sensitive data from real users",
  "prod-db-migration": "Run the production database migration (after a verified backup and a dry run on a copy)",
  "server-provision": "Provision the production server / VPS (backup/restore plan, reverse proxy + TLS and hardening checklist ready)",
  "domain-dns": "Point your domain's DNS at production (with a rollback note)",
  "app-store-submit": "Submit the app to the App Store / Google Play",
  "stripe-live": "Switch payments to live mode (after test-mode checkout and webhook verification pass)",
  "email-real-users": "Send the first email to real users (tested template, unsubscribe honored)",
};
// Gates that stay blocked under the sensitive-data escalation.
const LEGAL_BLOCKED = new Set(["collect-sensitive-data", "publish-legal-docs"]);
const BLOCKED_SUFFIX = "(blocked until legal/security review)";

function kitLink(outFile, repoRoot, entry) {
  const target = path.join(repoRoot, ".claude", "lastmile", ...entry.path.split("/"));
  return `[${entry.file}](${render.relLink(outFile, target)})`;
}

function slowClockApplies(item, ctx) {
  switch (item.when) {
    case "escalate": return ctx.escalate;
    case "mobile": return ctx.mobile;
    case "stripe": return ctx.stripe;
    case "google-sensitive-scopes": return ctx.googleSensitiveScopes;
    case "web": return !ctx.mobile;
    case "email": return ctx.email;
    case "ai-tool": return ctx.profile === "ai-tool";
    case "always": return true;
    default: return false;
  }
}

function list(arr, empty) {
  return arr && arr.length ? arr.map((s) => `- ${s}`).join("\n") : `- ${empty}`;
}

/**
 * buildPlan(repoRoot, profile, outFile) → { data, content }
 * Pure apart from reading the repo and the template; writes nothing.
 */
function buildPlan(repoRoot, profile, outFile) {
  const a = analyze(repoRoot, profile);
  const { state, score, rec, detections } = a;
  const link = (entry) => kitLink(outFile, repoRoot, entry);
  const escalate = score.sensitiveEscalation;
  const mobile = state.platform === "mobile" || a.profile === "mobile-app";

  const modules = a.mods.map((m) => ({
    name: m.name,
    title: m.title,
    plan: m.plan(state, a.profile),
    rec: m.recommend(state, a.profile),
    det: detections.find((d) => d.name === m.name),
  }));
  const byName = Object.fromEntries(modules.map((m) => [m.name, m]));
  const stripe = (byName.payments.plan.gates || []).includes("stripe-live");

  const tasks = []; // { section, line, marker, gate }
  const crossed = new Set();
  function addTask(section, t) {
    const line = markers.formatTask(t);
    tasks.push({ section, line, marker: t.marker, gate: t.gate || null });
    if (t.gate) crossed.add(t.gate);
    return line;
  }
  function blockedSuffix(gate) {
    return escalate && gate && LEGAL_BLOCKED.has(gate) ? BLOCKED_SUFFIX : "";
  }

  // ── 1. slow clocks ──
  const ctx = {
    escalate,
    mobile,
    stripe,
    googleSensitiveScopes: !!(state.auth && state.auth.googleSensitiveScopes),
    email: !!byName.crm,
    profile: a.profile,
  };
  const s1 = [];
  for (const item of guideMap.SLOW_CLOCKS) {
    if (!slowClockApplies(item, ctx)) continue;
    const cls = markers.classifyTask(item.task, item.gate ? { gate: item.gate } : { human: true });
    const guides = [item.guide, ...(item.also || [])].map((k) => link(guideMap.resolve(k)));
    s1.push(
      addTask(1, {
        text: item.task + (item.lead ? ` (lead time: ${item.lead})` : ""),
        marker: cls.marker,
        gate: cls.gate,
        suffix: blockedSuffix(cls.gate),
        guideLinks: guides,
      }),
    );
  }

  // ── 2. tasks ──
  const s2 = [];
  const inlineGates = new Set();
  for (const m of modules) {
    const deeper = guideMap.deeperForModule(m.name).map(link);
    const label = m.name === "payments" && stripe ? `${m.title} (test mode)` : m.title;
    s2.push(`**${label}**${deeper.length ? ` — deeper: ${deeper.join(" · ")}` : ""}`, "");
    for (const step of m.plan.steps || []) {
      // The sensitive-data HARD STOP is section 1's legal/security review task.
      if (escalate && /^HARD STOP\b/.test(step)) continue;
      const cls = markers.classifyTask(step);
      if (cls.gate) inlineGates.add(cls.gate);
      s2.push(
        addTask(2, {
          text: step,
          marker: cls.marker,
          gate: cls.gate,
          suffix: blockedSuffix(cls.gate),
          guideLinks: [link(guideMap.guideForStep(m.name, step, { mobile }))],
        }),
      );
    }
    s2.push("");
  }
  const moduleGates = new Set(modules.flatMap((m) => m.plan.gates || []));
  const goLive = GO_LIVE_ORDER.filter((g) => moduleGates.has(g) && !inlineGates.has(g));
  if (goLive.length) {
    s2.push("**Go-live gates**", "");
    for (const g of goLive) {
      const cls = markers.classifyTask(GO_LIVE_TEXT[g], { gate: g });
      s2.push(
        addTask(2, {
          text: GO_LIVE_TEXT[g],
          marker: cls.marker,
          gate: cls.gate,
          suffix: blockedSuffix(g),
          guideLinks: guideMap.guidesForApprovalGate(g).slice(0, 2).map(link),
        }),
      );
    }
    s2.push("");
  }

  // ── 3. module detail ──
  const s3 = [];
  for (const m of modules) {
    const p = m.plan;
    s3.push(
      `### ${m.title}`,
      "",
      `**Status:** ${m.det ? m.det.status : "unknown"} · **Recommendation:** ${m.rec.choice} — ${m.rec.rationale}`,
      "",
      p.summary,
      "",
      `**Env vars:** ${p.envVars && p.envVars.length ? p.envVars.map((v) => `\`${v}\``).join(", ") : "none"}`,
      "",
      "**Tests**",
      list(p.tests, "none listed"),
      "",
      "**Risks**",
      list(p.risks, "none flagged"),
    );
    if (p.gates && p.gates.length) s3.push("", `**Approval gates:** ${p.gates.map((g) => `⛔ ${g}`).join(", ")}`);
    s3.push("");
  }

  // ── 4. approval gates ahead ──
  const gatesAhead = GO_LIVE_ORDER.filter((g) => crossed.has(g));
  const s4 = gatesAhead.map((id) => {
    const g = gateFor(id);
    const guides = guideMap.guidesForApprovalGate(id).map(link);
    return `- ⛔ **${id}** — ${g.action}. Why: ${g.why} Requires: ${g.requires}. — guide: ${guides.join(" · ")}`;
  });

  // ── done when ──
  const platformBilling = !stripe && (byName.payments.plan.gates || []).includes("app-store-submit");
  const doneLine = platformBilling
    ? "Your first paid transaction in live mode: a real customer completes a real App Store / Google Play purchase in the production app, and access is granted from the verified purchase state on your server."
    : "Your first paid transaction in live mode: a real customer pays, the payment shows in your payment provider's live mode, and access is granted from a verified webhook event.";
  const doneGates = gatesAhead.length ? gatesAhead.map((g) => `⛔ ${g}`).join(" → ") : "none detected";

  // ── assemble ──
  const human = tasks.filter((t) => t.marker === markers.HUMAN).length;
  const ai = tasks.length - human;
  const head = [];
  if (escalate) {
    head.push(
      `> ⛔ **STOP — SENSITIVE DATA DETECTED** (${state.sensitive.signals.join(", ")}). ` +
        "The first task below is a legal/security review by a qualified person. Until you confirm it happened, " +
        "`collect-sensitive-data` and `publish-legal-docs` stay blocked.",
      "",
    );
  }
  head.push(
    `**Launch-readiness at plan time:** ${score.composite}/100 (details in \`last-mile/REVIEW.md\`) · ` +
      `**Tasks:** ${tasks.length} (${human} for you, ${ai} for the AI) · **Approval gates ahead:** ${gatesAhead.length}`,
    "",
    `**Recommended stack:** ${Object.entries(rec.stack).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    "",
    `**Markers:** 🔴 YOU MUST DO THIS (only you can) · 🤖 AI CAN DO THIS · ⛔ approval gate (needs your explicit yes when it comes up)`,
  );

  const body = [
    ...head,
    "",
    "## 1. Start these today (slow clocks)",
    "",
    "These wait on the outside world (accounts, verifications, review queues, DNS). Start them now so they finish in parallel with the build.",
    "",
    ...s1,
    "",
    "## 2. Tasks",
    "",
    ...s2,
    "## 3. Module detail",
    "",
    ...s3,
    "## 4. Approval gates ahead",
    "",
    s4.length ? s4.join("\n") : "- none",
    "",
    "## Done when",
    "",
    doneLine,
    "",
    `Gates between here and there: ${doneGates}.`,
  ].join("\n");

  const content = render.fillTemplate("launch-plan", {
    title: "Launch Plan",
    generated_at: render.nowIso(),
    profile: a.profile,
    summary:
      `Launch-readiness ${score.composite}/100 at plan time; ${tasks.length} tasks (${human} for you); ` +
      `${gatesAhead.length} approval gate(s) ahead.` +
      (escalate ? " SENSITIVE DATA: legal/security review comes first." : ""),
    body,
  });

  const data = {
    schema: "lastmile/plan/v1",
    generated_at: render.nowIso(),
    profile: a.profile,
    composite: score.composite,
    escalate,
    slow_clocks: s1.length,
    tasks: tasks.length,
    human_tasks: human,
    ai_tasks: ai,
    gates: gatesAhead,
    modules: modules.map((m) => m.name),
    plan_path: outFile,
  };
  return { data, content };
}

function main(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) {
    process.stdout.write(USAGE + "\n");
    return EXIT.OK;
  }
  if (args.error) {
    process.stderr.write(`plan.js: ${args.error}\n${USAGE}\n`);
    return EXIT.USAGE;
  }
  const c = resolveCommon(args, DEFAULT_OUT);
  if (c.error) {
    process.stderr.write(`plan.js: ${c.error}\n${USAGE}\n`);
    return EXIT.USAGE;
  }
  if (fs.existsSync(c.outFile) && !args.force) {
    process.stderr.write(
      `plan.js: ${displayPath(c.outFile)} already exists — not overwritten (re-run with --force to replace it)\n`,
    );
    return EXIT.EXISTS;
  }
  const { data, content } = buildPlan(c.repoRoot, c.profile, c.outFile);
  render.writeFile(c.outFile, content);
  if (args.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else {
    process.stdout.write(
      [
        `lastmile plan: ${data.tasks} tasks (${data.human_tasks} for you, ${data.ai_tasks} for the AI), ${data.slow_clocks} to start today`,
        `approval gates ahead: ${data.gates.length ? data.gates.join(", ") : "none"}`,
        `sensitive-data escalation: ${data.escalate ? "YES — legal/security review is task 1" : "no"}`,
        `wrote: ${displayPath(c.outFile)}`,
      ].join("\n") + "\n",
    );
  }
  return EXIT.OK;
}

if (require.main === module) {
  let code;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`plan.js: error: ${String((e && e.message) || e).split("\n")[0]}\n`);
    code = EXIT.ERROR;
  }
  process.exitCode = code;
}

module.exports = { buildPlan, main, DEFAULT_OUT, SPEC, GO_LIVE_ORDER, GO_LIVE_TEXT, GATES, BLOCKED_SUFFIX };
