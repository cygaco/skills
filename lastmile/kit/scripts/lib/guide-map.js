"use strict";
/**
 * lib/guide-map.js — the finding → guide map for /lastmile.
 *
 * Every finding the kit writes (a REVIEW.md gap, a LAUNCH_PLAN.md task, an
 * approval gate) links the guide that explains it. This file is the one place
 * that decides which guide that is.
 *
 * Entries are kit-relative paths (the kit installs at .claude/lastmile/):
 *   guides/<FILE>.md        plain-language launch guides
 *   playbooks/<file>.md     default stacks, monetization, funnel, baseline
 *   knowledge/<domain>/...  deeper reference material
 *
 * Each guide carries its lead time (how long the outside world makes you wait)
 * and a slowClock flag: true when that lead time is measured in days or more,
 * so the work has to start today rather than when you reach it in the plan.
 *
 * The selfcheck proves every file named here exists in the kit, and that every
 * shipped guide except README.md and LAUNCH_FILM_GUIDE.md is reachable from at
 * least one map entry.
 */

// ── the guides ───────────────────────────────────────────────────────
// key → { file, lead_time, slowClock }
const GUIDES = {
  ADMIN_TOOLING: {
    file: "ADMIN_TOOLING_GUIDE.md",
    lead_time: "none",
    slowClock: false,
  },
  AI_COMPLIANCE: {
    file: "AI_COMPLIANCE_GUIDE.md",
    lead_time: "EU AI Act Art. 50 transparency applies from Aug 2 2026 — ship the disclosure/labeling WITH the AI feature, not after",
    slowClock: false,
  },
  ANALYTICS_TELEMETRY: {
    file: "ANALYTICS_TELEMETRY_GUIDE.md",
    lead_time: "none",
    slowClock: false,
  },
  API_LIMITS: {
    file: "API_LIMITS_GUIDE.md",
    lead_time: "3rd-party API usage TIERS rise gradually with account age + verified spend (days→months to high tiers); money alone won't unlock them — start climbing + request increases EARLY.",
    slowClock: true,
  },
  APP_STORE: {
    file: "APP_STORE_GUIDE.md",
    lead_time: "Apple App Review typically 24-48h; first-submit rejection is common — budget resubmission cycles. IAP/external-payment rules differ by region and are in active flux.",
    slowClock: true,
  },
  AUTH: {
    file: "AUTH_GUIDE.md",
    lead_time: "Google sensitive-scope OAuth verification: days-weeks (only if you request Gmail/Drive scope)",
    slowClock: true,
  },
  AUTH_RUNBOOK: {
    file: "AUTH_RUNBOOK.md",
    lead_time: "Custom Domain add-on purchase (by you, ~$10/mo) gates the custom auth domain; a Resend account (yours) gates live email",
    slowClock: false,
  },
  COMPLIANCE_TRIGGERS: {
    file: "COMPLIANCE_TRIGGERS_GUIDE.md",
    lead_time: "none (answer the trigger questions on DAY ZERO — each yes adds duties that are cheap at design time and expensive after launch)",
    slowClock: false,
  },
  DATA_REQUESTS: {
    file: "DATA_REQUESTS_GUIDE.md",
    lead_time: "none (but statutory clocks start the moment a request ARRIVES — build the queue + flows BEFORE launch)",
    slowClock: false,
  },
  DATABASE: {
    file: "DATABASE_GUIDE.md",
    lead_time: "none",
    slowClock: false,
  },
  DEPLOYMENT_INFRA: {
    file: "DEPLOYMENT_INFRA_GUIDE.md",
    lead_time: "domain/DNS, provider verification, production smoke tests, rollback setup, and app-store or mobile build pipelines can take hours-days; start before launch week",
    slowClock: true,
  },
  DEV_SETUP: {
    file: "DEV_SETUP_GUIDE.md",
    lead_time: "Apple ~2d payment+verify; Google Play identity review hours-days; Play 12-tester / 14-day closed test; D-U-N-S days-weeks",
    slowClock: true,
  },
  EMAIL: {
    file: "EMAIL_GUIDE.md",
    lead_time: "Sending-domain DNS (SPF/DKIM/DMARC) propagation + reputation warm-up: hours-days",
    slowClock: true,
  },
  GROWTH_LOOPS: {
    file: "GROWTH_LOOPS_GUIDE.md",
    lead_time: "none (review prompt ships at launch; build referrals only AFTER retention proves itself)",
    slowClock: false,
  },
  INCIDENT_RESPONSE: {
    file: "INCIDENT_RESPONSE_GUIDE.md",
    lead_time: "none (but the GDPR 72-hour clock starts at AWARENESS — write the runbook and collect the contacts BEFORE launch)",
    slowClock: false,
  },
  LEGAL: {
    file: "LEGAL_GUIDE.md",
    lead_time: "none (but STOP and hire a lawyer BEFORE launch for health/finance/children/biometric/regulated data, equity/fundraising, or AGPL anywhere in your dependency tree)",
    slowClock: false,
  },
  MINORS: {
    file: "MINORS_GUIDE.md",
    lead_time: "none (the audience decision is a day-zero fork: anything under-13 means a lawyer BEFORE you build, not before you launch)",
    slowClock: false,
  },
  ONBOARDING: {
    file: "ONBOARDING_GUIDE.md",
    lead_time: "none (but under-13 / teen audiences: STOP — COPPA/parental-consent design needs legal review before launch)",
    slowClock: false,
  },
  PAYMENTS: {
    file: "PAYMENTS_GUIDE.md",
    lead_time: "Stripe identity + bank verification before live payments: hours-days",
    slowClock: true,
  },
  PRIVACY_GDPR: {
    file: "PRIVACY_GDPR_GUIDE.md",
    lead_time: "none (but STOP and hire a lawyer BEFORE launch if you touch health/finance/children/biometrics/special-category data)",
    slowClock: false,
  },
  PUSH_NOTIFICATIONS: {
    file: "PUSH_NOTIFICATIONS_GUIDE.md",
    lead_time: "none",
    slowClock: false,
  },
  SECURITY: {
    file: "SECURITY_GUIDE.md",
    lead_time: "none",
    slowClock: false,
  },
  SUBSCRIPTION_CANCELLATION: {
    file: "SUBSCRIPTION_CANCELLATION_GUIDE.md",
    lead_time: "none (ship the cancel path WITH the subscribe path — ROSCA + state ARLs bind from the FIRST auto-renewing charge)",
    slowClock: false,
  },
  TESTING_ON_PC: {
    file: "TESTING_ON_PC_GUIDE.md",
    lead_time: "acquire/borrow a physical test device + create EAS/device-farm accounts EARLY; iOS verification needs a real iPhone you can borrow by launch week",
    slowClock: true,
  },
};

// Guides that ship but are deliberately not anchored to any finding.
const UNANCHORED_GUIDES = ["README.md", "LAUNCH_FILM_GUIDE.md"];

// ── playbooks + knowledge (kit-relative) ─────────────────────────────
const PLAYBOOKS = {
  ACCEPTANCE_CRITERIA: "playbooks/acceptance-criteria.md",
  CONVERSION_FUNNEL: "playbooks/conversion-funnel-playbook.md",
  DEFAULT_STACKS: "playbooks/default-stacks.md",
  MONETIZATION_PATTERNS: "playbooks/monetization-patterns.md",
  SECURITY_PRIVACY_BASELINE: "playbooks/security-privacy-baseline.md",
};

const KNOWLEDGE = {
  BAAS_DECISION_MATRIX: "knowledge/tech-stack-selection/BAAS_DECISION_MATRIX.md",
  AUTHENTICATION_AND_SESSION: "knowledge/security/AUTHENTICATION_AND_SESSION.md",
  SECRETS_AND_CONFIG: "knowledge/security/SECRETS_AND_CONFIG.md",
  CONSUMER_PROTECTION_AND_SUBSCRIPTIONS: "knowledge/compliance/CONSUMER_PROTECTION_AND_SUBSCRIPTIONS.md",
  PRIVACY_AND_DATA_COMPLIANCE: "knowledge/compliance/PRIVACY_AND_DATA_COMPLIANCE.md",
  APP_STORE_AND_PLATFORM_POLICY: "knowledge/compliance/APP_STORE_AND_PLATFORM_POLICY.md",
  CONVERSION_HIERARCHY: "knowledge/design/CONVERSION_HIERARCHY.md",
  PRE_PMF_ADMIN_SURFACE: "knowledge/admin-tooling/PRE_PMF_ADMIN_SURFACE.md",
  PMF_EVENT_VOCABULARY: "knowledge/product-telemetry/PMF_EVENT_VOCABULARY.md",
  ONBOARDING_ACTIVATION: "knowledge/growth-mechanics/ONBOARDING_ACTIVATION.md",
};

// ── entries ──────────────────────────────────────────────────────────
// An entry is a guide key (string, from GUIDES) or a kit-relative path of a
// playbook / knowledge file. resolve() turns either into one shape.
const MODULE_GUIDES = {
  database: ["DATABASE"],
  auth: ["AUTH", "AUTH_RUNBOOK", "ONBOARDING", "DATA_REQUESTS"],
  payments: ["PAYMENTS", "SUBSCRIPTION_CANCELLATION"],
  crm: ["EMAIL", "ADMIN_TOOLING"],
  website: ["ONBOARDING", PLAYBOOKS.CONVERSION_FUNNEL],
  deployment: ["DEPLOYMENT_INFRA"],
  security: ["SECURITY", "INCIDENT_RESPONSE"],
  analytics: ["ANALYTICS_TELEMETRY", "PUSH_NOTIFICATIONS", "GROWTH_LOOPS"],
};

// Extra guides for a module when the product is a mobile app.
const MODULE_MOBILE_GUIDES = {
  deployment: ["APP_STORE", "TESTING_ON_PC"],
  payments: ["APP_STORE"],
};

// "Go deeper" references shown once per module in LAUNCH_PLAN.md.
const MODULE_DEEPER = {
  database: [PLAYBOOKS.DEFAULT_STACKS, KNOWLEDGE.BAAS_DECISION_MATRIX],
  auth: [KNOWLEDGE.AUTHENTICATION_AND_SESSION],
  payments: [PLAYBOOKS.MONETIZATION_PATTERNS, KNOWLEDGE.CONSUMER_PROTECTION_AND_SUBSCRIPTIONS],
  crm: [KNOWLEDGE.PRE_PMF_ADMIN_SURFACE],
  website: [PLAYBOOKS.CONVERSION_FUNNEL, KNOWLEDGE.CONVERSION_HIERARCHY],
  deployment: [PLAYBOOKS.DEFAULT_STACKS],
  security: [PLAYBOOKS.SECURITY_PRIVACY_BASELINE, KNOWLEDGE.SECRETS_AND_CONFIG],
  analytics: [KNOWLEDGE.PMF_EVENT_VOCABULARY, KNOWLEDGE.ONBOARDING_ACTIVATION],
};

// Gate anchors (privacy, legal, app-store) and the eight approval gates.
const GATE_GUIDES = {
  "gate/privacy": ["PRIVACY_GDPR", KNOWLEDGE.PRIVACY_AND_DATA_COMPLIANCE],
  "gate/legal": ["LEGAL", "AI_COMPLIANCE"],
  "gate/app-store": ["APP_STORE", KNOWLEDGE.APP_STORE_AND_PLATFORM_POLICY],
};

const APPROVAL_GATE_GUIDES = {
  "stripe-live": ["PAYMENTS"],
  "prod-db-migration": ["DATABASE"],
  "domain-dns": ["DEPLOYMENT_INFRA", "EMAIL"],
  "server-provision": ["DEPLOYMENT_INFRA"],
  "app-store-submit": ["APP_STORE"],
  "email-real-users": ["EMAIL"],
  "collect-sensitive-data": ["PRIVACY_GDPR", "LEGAL"],
  "publish-legal-docs": ["LEGAL", "PRIVACY_GDPR", "AI_COMPLIANCE"],
};

// Day-zero guides: decisions and accounts that are cheap now and costly later.
const DAY_ZERO = ["DEV_SETUP", "API_LIMITS", "COMPLIANCE_TRIGGERS", "MINORS", "TESTING_ON_PC"];

// Score dimensions. Gaps are keyed by dimension, so every dimension has at
// least one guide.
const DIMENSION_GUIDES = {
  product: ["ONBOARDING", "DATABASE"],
  technical: ["DATABASE", "DEPLOYMENT_INFRA"],
  security: ["SECURITY", "AUTH"],
  privacy: ["PRIVACY_GDPR", "DATA_REQUESTS"],
  monetization: ["PAYMENTS", "SUBSCRIPTION_CANCELLATION"],
  funnel: ["ONBOARDING", PLAYBOOKS.CONVERSION_FUNNEL],
  deployment: ["DEPLOYMENT_INFRA"],
  analytics: ["ANALYTICS_TELEMETRY"],
  support: ["EMAIL", "ADMIN_TOOLING"],
};

// Gap-text hints, checked in order before the dimension defaults, so a gap
// links the most specific guide first.
const GAP_HINTS = [
  [/sensitive/i, ["LEGAL", "PRIVACY_GDPR"]],
  [/webhook/i, ["PAYMENTS", "SECURITY"]],
  [/\bauth\b|accounts unprotected/i, ["AUTH"]],
  [/deletion|export|portability/i, ["DATA_REQUESTS", "PRIVACY_GDPR"]],
  [/persistence|database/i, ["DATABASE"]],
  [/deploy|hosting/i, ["DEPLOYMENT_INFRA"]],
  [/pricing|landing/i, [PLAYBOOKS.CONVERSION_FUNNEL]],
  [/payment provider|checkout/i, ["PAYMENTS"]],
  [/email/i, ["EMAIL"]],
  [/analytics|unmeasured/i, ["ANALYTICS_TELEMETRY"]],
];

// Plan-task hints: a step whose text matches links this guide instead of the
// module's first guide. First match wins. The third field, when present,
// limits a hint to those modules.
const STEP_HINTS = [
  [/privacy-law|privacy law/i, "PRIVACY_GDPR"],
  [/delet|export|portab/i, "DATA_REQUESTS", ["database", "auth", "security"]],
  [/privacy policy|cookie\/tracking|tracking disclosure/i, "PRIVACY_GDPR"],
  [/terms of service|privacy\/terms/i, "LEGAL"],
  [/age-gate|under-13|coppa/i, "MINORS"],
  [/storekit|app store connect|play console|play billing|testflight|store readiness|store listing/i, "APP_STORE"],
  [/\badmin\b/i, "ADMIN_TOOLING"],
  [/refund|cancellation policy/i, "SUBSCRIPTION_CANCELLATION"],
  [/onboarding|activation/i, "ONBOARDING", ["website"]],
];

// ── slow clocks (LAUNCH_PLAN.md section 1) ───────────────────────────
// `when` is evaluated by plan.js against the detected state:
//   escalate | mobile | stripe | google-sensitive-scopes | web | email | ai-tool | always
// `gate` marks an item that itself crosses an approval gate.
const SLOW_CLOCKS = [
  {
    id: "legal-review",
    when: "escalate",
    task: "Legal/security review by a qualified person completed",
    lead: null,
    guide: "LEGAL",
  },
  {
    id: "apple-developer",
    when: "mobile",
    task: "Enroll in the Apple Developer Program: paid account + identity verification",
    lead: "about 2 days for payment + verification",
    guide: "DEV_SETUP",
  },
  {
    id: "google-play-developer",
    when: "mobile",
    task: "Create your Google Play Console developer account and pass its identity review",
    lead: "hours to days",
    guide: "DEV_SETUP",
  },
  {
    id: "play-closed-test",
    when: "mobile",
    task: "Start the Google Play closed test: 12 testers for 14 days before a new personal account can publish",
    lead: "14 days minimum once testers are in",
    guide: "DEV_SETUP",
  },
  {
    id: "duns",
    when: "mobile",
    task: "Get a D-U-N-S number, only if you publish as a company rather than as an individual",
    lead: "days to weeks",
    guide: "DEV_SETUP",
  },
  {
    id: "test-device",
    when: "mobile",
    task: "Get a physical test phone (borrow or buy) and create your EAS / device-farm accounts",
    lead: "until you have a device; iOS checks need a real iPhone by launch week",
    guide: "TESTING_ON_PC",
  },
  {
    id: "stripe-verification",
    when: "stripe",
    task: "Complete Stripe identity and bank verification: business details + payout bank account",
    lead: "hours to days",
    guide: "PAYMENTS",
  },
  {
    id: "google-oauth-verification",
    when: "google-sensitive-scopes",
    task: "Submit your Google OAuth consent screen for verification, because the app requests sensitive Google scopes",
    lead: "days to weeks",
    guide: "AUTH",
  },
  {
    id: "domain-purchase",
    when: "web",
    task: "Buy your domain, unless you already own one",
    lead: "minutes to buy; DNS and provider verification can take hours to days",
    guide: "DEPLOYMENT_INFRA",
  },
  {
    id: "email-sending-domain",
    when: "email",
    task: "Add your sending domain's email records (SPF, DKIM, DMARC) at your email provider and DNS host",
    lead: "hours to days for propagation + reputation warm-up",
    guide: "EMAIL",
    gate: "domain-dns",
  },
  {
    id: "api-usage-tiers",
    when: "ai-tool",
    task: "Raise your third-party API usage tier early (LLM or other paid APIs): tiers rise with account age and verified spend",
    lead: "days to months",
    guide: "API_LIMITS",
  },
  {
    id: "day-zero-compliance",
    when: "always",
    task: "Answer the day-zero compliance questions: who your users are (anyone under 18?), what data you collect, where your users live",
    lead: "none, but answer before you build further",
    guide: "COMPLIANCE_TRIGGERS",
    also: ["MINORS"],
  },
];

// ── resolution helpers ───────────────────────────────────────────────
function resolve(entry) {
  if (GUIDES[entry]) {
    const g = GUIDES[entry];
    return { key: entry, kind: "guide", file: g.file, path: `guides/${g.file}`, lead_time: g.lead_time, slowClock: g.slowClock };
  }
  const kind = entry.startsWith("playbooks/") ? "playbook" : entry.startsWith("knowledge/") ? "knowledge" : null;
  if (!kind) throw new Error(`guide-map: unknown entry "${entry}"`);
  return { key: entry, kind, file: entry.split("/").pop(), path: entry, lead_time: "none", slowClock: false };
}

function uniqueResolved(entries, max) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const r = resolve(e);
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    out.push(r);
    if (max && out.length >= max) break;
  }
  return out;
}

// Guides for one scored gap ({dim, gap}): hint matches first, then the
// dimension's defaults. At most 3.
function guidesForGap(g) {
  const entries = [];
  for (const [re, list] of GAP_HINTS) if (re.test(g.gap)) entries.push(...list);
  entries.push(...(DIMENSION_GUIDES[g.dim] || ["SECURITY"]));
  return uniqueResolved(entries, 3);
}

function guidesForModule(name, opts = {}) {
  const entries = [...(MODULE_GUIDES[name] || [])];
  if (opts.mobile && MODULE_MOBILE_GUIDES[name]) entries.push(...MODULE_MOBILE_GUIDES[name]);
  return uniqueResolved(entries);
}

function deeperForModule(name) {
  return uniqueResolved(MODULE_DEEPER[name] || []);
}

// The single guide a plan task links: the first step hint that matches, else
// the module's first guide (or its first mobile guide for store-only steps).
function guideForStep(moduleName, text, opts = {}) {
  for (const [re, key, only] of STEP_HINTS) {
    if (only && !only.includes(moduleName)) continue;
    if (re.test(text)) return resolve(key);
  }
  const list = guidesForModule(moduleName, opts);
  return list[0] || resolve("SECURITY");
}

function guidesForApprovalGate(id) {
  return uniqueResolved(APPROVAL_GATE_GUIDES[id] || ["LEGAL"]);
}

// Every distinct file the map can name (for the selfcheck existence check).
function allEntries() {
  const entries = [];
  for (const k of Object.keys(GUIDES)) entries.push(k);
  for (const list of Object.values(MODULE_GUIDES)) entries.push(...list);
  for (const list of Object.values(MODULE_MOBILE_GUIDES)) entries.push(...list);
  for (const list of Object.values(MODULE_DEEPER)) entries.push(...list);
  for (const list of Object.values(GATE_GUIDES)) entries.push(...list);
  for (const list of Object.values(APPROVAL_GATE_GUIDES)) entries.push(...list);
  for (const list of Object.values(DIMENSION_GUIDES)) entries.push(...list);
  for (const [, list] of GAP_HINTS) entries.push(...list);
  for (const [, key] of STEP_HINTS) entries.push(key);
  entries.push(...DAY_ZERO, ...Object.values(PLAYBOOKS), ...Object.values(KNOWLEDGE));
  for (const s of SLOW_CLOCKS) entries.push(s.guide, ...(s.also || []));
  return uniqueResolved(entries);
}

// Guide files reachable from at least one finding anchor (module, gate,
// day-zero, dimension). GUIDES itself is the catalogue, not an anchor.
function anchoredGuideFiles() {
  const entries = [];
  for (const list of Object.values(MODULE_GUIDES)) entries.push(...list);
  for (const list of Object.values(MODULE_MOBILE_GUIDES)) entries.push(...list);
  for (const list of Object.values(GATE_GUIDES)) entries.push(...list);
  for (const list of Object.values(APPROVAL_GATE_GUIDES)) entries.push(...list);
  for (const list of Object.values(DIMENSION_GUIDES)) entries.push(...list);
  entries.push(...DAY_ZERO);
  return new Set(uniqueResolved(entries).filter((r) => r.kind === "guide").map((r) => r.file));
}

module.exports = {
  GUIDES,
  UNANCHORED_GUIDES,
  PLAYBOOKS,
  KNOWLEDGE,
  MODULE_GUIDES,
  MODULE_MOBILE_GUIDES,
  MODULE_DEEPER,
  GATE_GUIDES,
  APPROVAL_GATE_GUIDES,
  DAY_ZERO,
  DIMENSION_GUIDES,
  GAP_HINTS,
  STEP_HINTS,
  SLOW_CLOCKS,
  resolve,
  guidesForGap,
  guidesForModule,
  deeperForModule,
  guideForStep,
  guidesForApprovalGate,
  allEntries,
  anchoredGuideFiles,
};
