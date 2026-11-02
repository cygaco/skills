"use strict";
/**
 * lib/analyze.js — the shared state computation for review.js and plan.js:
 * detect → the 8 module detect()s → the 9-dimension score → profile
 * inference. plan.js recomputes it the same way review.js does; it never
 * parses REVIEW.md.
 */

const { detectRepoState } = require("./detect");
const { scoreReadiness } = require("./score");
const { recommendStack } = require("./profiles");

// Plan order: data, accounts, payments (test mode), funnel, analytics,
// lifecycle email, security pass, deploy. The go-live gates come after.
const MODULE_NAMES = ["database", "auth", "payments", "website", "analytics", "crm", "security", "deployment"];

function loadModules() {
  return MODULE_NAMES.map((n) => require(`../modules/${n}`));
}

/**
 * analyze(repoRoot, profile) → {
 *   state, score, rec, profile, mods, detections:[{name,title,status,evidence,...}]
 * }
 */
function analyze(repoRoot, profile) {
  const state = detectRepoState(repoRoot);
  const score = scoreReadiness(state);
  const rec = recommendStack(profile, state);
  const mods = loadModules();
  const detections = mods.map((m) => ({ name: m.name, title: m.title, ...m.detect(state) }));
  return { state, score, rec, profile: rec.profile, mods, detections };
}

module.exports = { analyze, loadModules, MODULE_NAMES };
