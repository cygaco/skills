#!/usr/bin/env node
"use strict";
/**
 * review.js — /lastmile step 1: the launch-readiness review.
 *
 * Runs detect → the 8 module detect()s → the 9-dimension score → profile
 * inference, then renders last-mile/REVIEW.md from templates/review.tmpl.md.
 * Every gap links the guide that explains it.
 *
 * Usage:
 *   node .claude/lastmile/scripts/review.js [--repo-root <dir>] [--profile <name>] [--out <file>] [--json]
 *
 *   --repo-root  the repo to review (default: the current directory)
 *   --profile    one of the profiles in lib/profiles.js (default: inferred)
 *   --out        output file (default: <repo-root>/last-mile/REVIEW.md)
 *   --json       print the review data as JSON instead of the summary lines
 *
 * Exit: 0 written · 2 bad usage (unknown flag, unknown profile) · 1 unexpected error
 */

const path = require("path");
const { EXIT, parseArgs, resolveCommon, displayPath } = require("./lib/cli");
const { analyze } = require("./lib/analyze");
const render = require("./lib/render");
const guideMap = require("./lib/guide-map");

const SPEC = {
  value: { "--repo-root": "repoRoot", "--profile": "profile", "--out": "out" },
  bool: { "--json": "json" },
};
const DEFAULT_OUT = path.join("last-mile", "REVIEW.md");
const USAGE =
  "usage: node .claude/lastmile/scripts/review.js [--repo-root <dir>] [--profile <name>] [--out <file>] [--json]";

// A Markdown link from the output file to a kit file, as installed at
// <repo-root>/.claude/lastmile/<entry.path>.
function kitLink(outFile, repoRoot, entry) {
  const target = path.join(repoRoot, ".claude", "lastmile", ...entry.path.split("/"));
  return `[${entry.file}](${render.relLink(outFile, target)})`;
}

function cell(s) {
  return String(s).replace(/\|/g, "\\|");
}

function stopBanner(signals, links) {
  return (
    `> ⛔ **STOP — SENSITIVE DATA DETECTED** (${signals.join(", ") || "sensitive"}). ` +
    "Launching with this kind of data needs a legal and security review by a qualified person BEFORE launch. " +
    "Do that review first: the launch plan starts with it as a 🔴 task and keeps sensitive-data collection " +
    `and publishing legal documents blocked until you confirm it happened. — guide: ${links.join(" · ")}`
  );
}

/**
 * buildReview(repoRoot, profile, outFile) → { data, content }
 * Pure apart from reading the repo and the template; writes nothing.
 */
function buildReview(repoRoot, profile, outFile) {
  const a = analyze(repoRoot, profile);
  const { state, score, rec, detections } = a;
  const link = (entry) => kitLink(outFile, repoRoot, entry);

  const gaps = score.gaps.map((g) => ({ dim: g.dim, gap: g.gap, guides: guideMap.guidesForGap(g) }));
  const assumptions = [
    ...rec.assumptions,
    "Detection reads package.json, a few config files, env-var names (never values) and up to 400 source files. It cannot see other repos, hosted dashboards or anything outside this folder.",
    "The product score is a repo proxy: nothing here proves product/market fit.",
  ];

  const dimRows = Object.entries(score.dimensions)
    .map(([d, v]) => `| ${d} | ${v}/100 |`)
    .join("\n");
  const detRows = detections
    .map((m) => `| ${cell(m.title)} | ${m.status} | ${cell((m.evidence || []).join("; ") || "—")} |`)
    .join("\n");
  const gapLines = gaps.length
    ? gaps.map((g) => `- **${g.dim}** — ${g.gap} — guide: ${g.guides.map(link).join(" · ")}`).join("\n")
    : "- (no gaps detected — verify by hand before you trust this)";

  const parts = [`## Launch-Readiness Score: ${score.composite}/100`];
  if (score.sensitiveEscalation) {
    const legal = ["LEGAL", "PRIVACY_GDPR"].map((k) => link(guideMap.resolve(k)));
    parts.push("", stopBanner(state.sensitive.signals, legal));
  }
  parts.push(
    "",
    "### Dimensions",
    "",
    "| Dimension | Score |",
    "|---|---|",
    dimRows,
    "",
    "### Module readiness",
    "",
    "| Module | Status | Evidence |",
    "|---|---|---|",
    detRows,
    "",
    "### Gaps — shortest safe path to a paid launch",
    "",
    gapLines,
    "",
    "### Assumptions",
    "",
    assumptions.map((x) => `- ${x}`).join("\n"),
  );

  const content = render.fillTemplate("review", {
    title: "Launch-Readiness Review",
    generated_at: render.nowIso(),
    profile: a.profile,
    summary:
      `Launch-readiness ${score.composite}/100, ${gaps.length} gap(s)` +
      (score.sensitiveEscalation ? " — SENSITIVE DATA: legal/security review required before launch." : "."),
    body: parts.join("\n"),
  });

  const data = {
    schema: "lastmile/review/v1",
    generated_at: render.nowIso(),
    profile: a.profile,
    composite: score.composite,
    dimensions: score.dimensions,
    gaps: gaps.map((g) => ({ dim: g.dim, gap: g.gap, guides: g.guides.map((r) => r.path) })),
    escalate: score.sensitiveEscalation,
    signals: state.sensitive.signals,
    detections: detections.map((d) => ({ name: d.name, title: d.title, status: d.status, evidence: d.evidence || [] })),
    assumptions,
    review_path: outFile,
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
    process.stderr.write(`review.js: ${args.error}\n${USAGE}\n`);
    return EXIT.USAGE;
  }
  const c = resolveCommon(args, DEFAULT_OUT);
  if (c.error) {
    process.stderr.write(`review.js: ${c.error}\n${USAGE}\n`);
    return EXIT.USAGE;
  }
  const { data, content } = buildReview(c.repoRoot, c.profile, c.outFile);
  render.writeFile(c.outFile, content);
  if (args.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else {
    process.stdout.write(
      [
        `lastmile review: launch-readiness ${data.composite}/100 (profile: ${data.profile})`,
        `gaps: ${data.gaps.length}`,
        `sensitive-data escalation: ${data.escalate ? `YES (${data.signals.join(", ")}) — legal/security review before launch` : "no"}`,
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
    process.stderr.write(`review.js: error: ${String((e && e.message) || e).split("\n")[0]}\n`);
    code = EXIT.ERROR;
  }
  process.exitCode = code;
}

module.exports = { buildReview, main, DEFAULT_OUT, SPEC };
