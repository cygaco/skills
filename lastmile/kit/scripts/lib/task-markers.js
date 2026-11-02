"use strict";
/**
 * lib/task-markers.js — the ONE place that decides whether a LAUNCH_PLAN.md
 * task is 🔴 (only you can do it) or 🤖 (the AI can do it), and whether it
 * crosses an approval gate (⛔ <gate-id>).
 *
 * Module plan().steps are plain strings. They are classified here with an
 * explicit, ordered keyword list, never by guesswork scattered through the
 * scripts. Rules, in order:
 *
 *   1. GATE_ACTIONS — the step IS a gated action (provision a server, configure
 *      DNS, switch to live mode, submit to a store, ...). Result: 🔴 + ⛔ gate.
 *      A step that only MENTIONS a gate ("production migration is a
 *      human-approval gate") is preparation work and is not matched here.
 *   2. HUMAN_ONLY — the step needs a person: create/verify an account,
 *      identity or bank verification, buy a domain, legal or lawyer review,
 *      approve. Result: 🔴.
 *   3. Everything else: 🤖.
 */

const { GATE_IDS } = require("./approval-gates");

const HUMAN = "🔴";
const AI = "🤖";
const GATE = "⛔";

const GATE_ACTIONS = [
  ["server-provision", /\bprovision\b[^.;]{0,20}\b(server|vps|host)\b/i],
  ["domain-dns", /\bconfigure dns\b|\b(change|update|add|point)\b[^.;]{0,30}\bdns( records?)?\b/i],
  ["stripe-live", /\b(switch|go|flip)\b[^.;]{0,30}\blive mode\b/i],
  ["prod-db-migration", /\brun\b[^.;]{0,30}\bproduction (database )?migration\b/i],
  ["app-store-submit", /\bsubmit\b[^.;]{0,30}\b(app store|google play|play store|an app store)\b/i],
  ["email-real-users", /\bsend\b[^.;]{0,40}\breal users\b/i],
  ["collect-sensitive-data", /\b(start )?collect(ing)? sensitive data\b/i],
  ["publish-legal-docs", /\bpublish\b[^.;]{0,40}\b(privacy policy|terms)\b[^.;]{0,40}\bfinal\b/i],
];

const HUMAN_ONLY = [
  ["account", /\b(create|open|register|enrol?l in|enrol?l|sign up for)\b[^.;]{0,40}\b(account|developer program)s?\b/i],
  ["verification", /\b(identity|bank)\b[^.;]{0,20}\bverification\b|\bverify (your )?(identity|bank)\b/i],
  ["domain-purchase", /\b(buy|purchase)\b[^.;]{0,30}\bdomain\b/i],
  ["legal-review", /\b(lawyer|attorney|counsel|legal review|legal\/security review|human\/legal confirmation)\b/i],
  ["approve", /^(?:[^:]{1,40}:\s*)?approve\b/i],
];

/**
 * classifyTask(text, opts) → { marker, gate, signal }
 *   opts.gate:  force a gate id (a dedicated go-live gate task, or a slow-clock
 *               item that itself changes DNS).
 *   opts.human: force 🔴 (the curated slow-clock items: outside accounts,
 *               verifications and waiting periods only you can start).
 */
function classifyTask(text, opts = {}) {
  if (opts.gate) {
    if (!GATE_IDS.includes(opts.gate)) throw new Error(`task-markers: unknown gate "${opts.gate}"`);
    return { marker: HUMAN, gate: opts.gate, signal: `gate:${opts.gate}` };
  }
  if (opts.human) return { marker: HUMAN, gate: null, signal: "slow-clock" };
  for (const [gate, re] of GATE_ACTIONS) {
    if (re.test(text)) return { marker: HUMAN, gate, signal: `gate:${gate}` };
  }
  for (const [signal, re] of HUMAN_ONLY) {
    if (re.test(text)) return { marker: HUMAN, gate: null, signal };
  }
  return { marker: AI, gate: null, signal: "ai" };
}

/**
 * formatTask({ text, marker, gate, suffix, guideLinks }) → one checkbox line:
 *   - [ ] <marker> [⛔ <gate-id> ]<text>[ <suffix>] — guide: <links>
 */
function formatTask(t) {
  const gate = t.gate ? `${GATE} ${t.gate} ` : "";
  const suffix = t.suffix ? ` ${t.suffix}` : "";
  const guide = t.guideLinks && t.guideLinks.length ? ` — guide: ${t.guideLinks.join(" · ")}` : "";
  return `- [ ] ${t.marker} ${gate}${t.text}${suffix}${guide}`;
}

// Count the 🔴/🤖 markers on a line (the selfcheck requires exactly one per task).
function markerCount(line) {
  return line.split(HUMAN).length - 1 + (line.split(AI).length - 1);
}

module.exports = { HUMAN, AI, GATE, GATE_ACTIONS, HUMAN_ONLY, classifyTask, formatTask, markerCount };
