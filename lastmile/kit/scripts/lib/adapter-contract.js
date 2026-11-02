"use strict";
/**
 * lib/adapter-contract.js — the contract every last-mile MODULE ADAPTER must
 * satisfy, plus validateAdapter() so the selfcheck can assert conformance.
 * Keep it stable.
 *
 * An adapter lives at scripts/modules/<name>.js and exports:
 *
 *   module.exports = {
 *     name: "<database|auth|payments|crm|website|deployment|security|analytics>",
 *     title: "Human Title",
 *     // detect(state) → { status, present, evidence:[...] }
 *     //   status is one of "present" | "partial" | "absent"
 *     detect(state) { ... },
 *     // recommend(state, profile) → { choice, rationale, alternatives:[...] }
 *     recommend(state, profile) { ... },
 *     // plan(state, profile) → {
 *     //   summary, steps:[...], envVars:[...], gates:[<approval-gate-id>...],
 *     //   tests:[...], template: "<template-basename>", risks:[...]
 *     // }
 *     plan(state, profile) { ... },
 *   };
 *
 * detect/recommend/plan are PURE: they read `state` (from detect.js) and return
 * plain objects. No file writes, no network. Rendering and writing the output
 * documents is the job of review.js and plan.js, not the adapter's.
 */

const { GATE_IDS } = require("./approval-gates");

const REQUIRED_FNS = ["detect", "recommend", "plan"];
const REQUIRED_META = ["name", "title"];
const DETECT_STATUSES = ["present", "partial", "absent"];

// A minimal synthetic state for shape validation (no real repo needed).
function sampleState() {
  return {
    schema: "lastmile/state/v1",
    repoRoot: ".",
    isNodeProject: true,
    framework: "nextjs",
    platform: "web",
    persistence: { provider: null, evidence: [] },
    auth: { provider: null, googleSensitiveScopes: false, evidence: [] },
    payments: { provider: null, webhookVerified: false, evidence: [] },
    analytics: { provider: null, evidence: [] },
    deploy: { target: null, evidence: [] },
    email: { provider: null },
    funnel: { hasLanding: false, hasPricing: false, evidence: [] },
    account: { deletionPath: false, exportPath: false, evidence: [] },
    sensitive: { signals: [], escalate: false },
    envKeys: [],
  };
}

/**
 * validateAdapter(mod) → { ok, errors:[...] }
 * Structural + behavioral check: required meta/fns exist and return the
 * documented shapes when invoked on a sample state.
 */
function validateAdapter(mod) {
  const errors = [];
  if (!mod || typeof mod !== "object") {
    return { ok: false, errors: ["adapter is not an object"] };
  }
  for (const m of REQUIRED_META) {
    if (!mod[m] || typeof mod[m] !== "string") errors.push(`missing/!string meta: ${m}`);
  }
  for (const fn of REQUIRED_FNS) {
    if (typeof mod[fn] !== "function") errors.push(`missing fn: ${fn}`);
  }
  if (errors.length) return { ok: false, errors };

  const st = sampleState();
  try {
    const d = mod.detect(st);
    if (!d || !DETECT_STATUSES.includes(d.status)) errors.push(`detect().status must be one of ${DETECT_STATUSES.join("|")}`);
    if (d && !Array.isArray(d.evidence)) errors.push("detect().evidence must be an array");
  } catch (e) {
    errors.push(`detect() threw: ${e.message}`);
  }
  try {
    const r = mod.recommend(st, "web-saas");
    if (!r || typeof r.choice !== "string") errors.push("recommend().choice must be a string");
    if (r && !Array.isArray(r.alternatives)) errors.push("recommend().alternatives must be an array");
  } catch (e) {
    errors.push(`recommend() threw: ${e.message}`);
  }
  try {
    const p = mod.plan(st, "web-saas");
    if (!p || typeof p.summary !== "string") errors.push("plan().summary must be a string");
    if (p && !Array.isArray(p.steps)) errors.push("plan().steps must be an array");
    if (p && !Array.isArray(p.envVars)) errors.push("plan().envVars must be an array");
    if (p && !Array.isArray(p.gates)) errors.push("plan().gates must be an array");
    else if (p) {
      for (const g of p.gates)
        if (!GATE_IDS.includes(g)) errors.push("plan().gates has unregistered gate id: " + g);
    }
    if (p && !Array.isArray(p.tests)) errors.push("plan().tests must be an array");
    if (p && !Array.isArray(p.risks)) errors.push("plan().risks must be an array");
    if (p && typeof p.template !== "string") errors.push("plan().template must be a string (template basename)");
  } catch (e) {
    errors.push(`plan() threw: ${e.message}`);
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  validateAdapter,
  sampleState,
  REQUIRED_FNS,
  REQUIRED_META,
  DETECT_STATUSES,
};
