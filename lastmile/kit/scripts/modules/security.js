"use strict";
/**
 * modules/security.js — last-mile SECURITY + PRIVACY adapter. Practical baseline
 * for U.S. 13+ consumer apps (NOT a legal guarantee). Composite detector across
 * auth/webhooks/deletion + sensitive-data signals. Sensitive data forces a HARD
 * STOP escalation. Pure; conforms to lib/adapter-contract.js.
 */

function detect(state) {
  const issues = [];
  if (!(state.auth && state.auth.provider)) issues.push("no-auth");
  if (state.payments && state.payments.provider && !state.payments.webhookVerified) issues.push("webhook-unverified");
  if (!(state.account && state.account.deletionPath)) issues.push("no-deletion-path");
  const escalate = !!(state.sensitive && state.sensitive.escalate);
  if (escalate) issues.push("sensitive-data");
  const status = escalate ? "absent" : issues.length === 0 ? "present" : "partial";
  return {
    status,
    present: issues.length === 0,
    escalate,
    signals: (state.sensitive && state.sensitive.signals) || [],
    issues,
    evidence: issues.map((i) => `gap:${i}`),
  };
}

function recommend(/* state, profile */) {
  return {
    choice: "compliance-by-default baseline (U.S. 13+) + escalation gates",
    rationale: "Implement the practical baseline now; route sensitive categories to legal/security review. Never claim blanket legal compliance.",
    alternatives: ["baseline only", "baseline + SOC2 path (later, if enterprise)"],
  };
}

function plan(state, profile) {
  const d = detect(state);
  const steps = [];
  if (d.escalate) {
    steps.push(
      `HARD STOP — sensitive data detected (${d.signals.join(", ")}). Escalate to legal/security review BEFORE any launch-readiness claim. Do not proceed past this gate autonomously.`,
    );
  }
  steps.push(
    "Secrets scanning: no secrets in the repo; rotate anything ever committed; secrets live in host env.",
    "Env-var hygiene: .env.example documents keys; real values only in .env.local + host.",
    "Auth/session checks: protected routes reject unauthenticated requests server-side.",
    "Rate limiting: on auth, payment, and write endpoints (abuse + cost control).",
    "Input validation: validate + sanitize all external input (zod/valibot or equivalent) at the boundary.",
    "Dependency audit: npm audit / osv clean of known-exploitable highs before launch.",
    "Webhook signature verification: verify provider webhooks (Stripe constructEvent) — never trust unsigned events.",
    "Access-control tests: a user cannot read/modify another user's data (IDOR).",
    "Data deletion path: self-serve account deletion that removes/anonymizes data.",
    "Data export/portability: user can export their data.",
    "Privacy policy: required (what you collect, why, retention, contact). Draft now; publishing as FINAL is a human-approval gate.",
    "Terms of service: required for paid + public products.",
    "Cookie/tracking disclosure: disclose analytics/tracking; consent where applicable.",
    "Age-gate / no-under-13: do not knowingly collect from under-13 (COPPA) unless built + reviewed for it.",
    "U.S. state privacy-law applicability: check CA/CO/VA/CT/etc. thresholds; honor deletion + opt-out baseline.",
  );
  const gates = ["publish-legal-docs"];
  if (d.escalate) gates.unshift("collect-sensitive-data");
  return {
    summary: `Security & privacy: compliance-by-default baseline (U.S. 13+).${d.escalate ? " ⚠ SENSITIVE DATA — legal/security escalation required before launch." : ""} Not a legal guarantee.`,
    steps,
    envVars: [],
    gates,
    tests: [
      "access-control: user A cannot read user B's records (IDOR)",
      "secrets scan finds no committed secrets",
      "unauthenticated request to a protected route is rejected",
      state.payments && state.payments.provider ? "webhook signature verification rejects a forged event" : "rate limit returns 429 past threshold",
    ],
    template: "launch-plan",
    risks: d.escalate
      ? [`Sensitive category (${d.signals.join(", ")}): COPPA/HIPAA/financial/biometric obligations may apply — DO NOT claim launch-ready without review.`]
      : ["Privacy/terms are legal commitments — publish as final only after your own (or counsel's) review."],
  };
}

module.exports = { name: "security", title: "Security & Privacy", detect, recommend, plan };
