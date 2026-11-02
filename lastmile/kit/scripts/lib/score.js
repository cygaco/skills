"use strict";
/**
 * lib/score.js — Launch-Readiness Score (0–100) across 9 dimensions, computed
 * from the detect.js state shape. Deterministic and honest: a dimension at 0
 * with a named gap is the point, not a failure to hide.
 *
 * Dimensions: product, technical, security, privacy, monetization, funnel,
 * deployment, analytics, support.
 *
 * Sensitive-data signals CAP privacy and security at 40 and add a gap that asks
 * for a legal/security review (state.sensitive.escalate). The score never
 * claims compliance.
 *
 * Only what the repo itself shows is scored. The presence or absence of any
 * planning document never moves a score or adds a gap.
 */

const DIMENSIONS = [
  "product",
  "technical",
  "security",
  "privacy",
  "monetization",
  "funnel",
  "deployment",
  "analytics",
  "support",
];

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreProduct(s, gaps) {
  // Weak repo proxy: a known framework + some persistence suggests a real core
  // loop exists. Adjust by judgment: repo state cannot prove product/market fit.
  let v = 30;
  if (s.framework && s.framework !== "unknown") v += 25;
  if (s.persistence.provider) v += 25;
  if (s.funnel.hasLanding) v += 10;
  if (s.account.deletionPath) v += 10;
  if (!s.persistence.provider) gaps.push({ dim: "product", gap: "no persistence — likely prototype-only state" });
  return clamp(v);
}

function scoreTechnical(s, gaps) {
  let v = 20;
  if (s.framework !== "unknown") v += 25;
  if (s.persistence.provider) v += 25;
  else gaps.push({ dim: "technical", gap: "no database/persistence layer detected" });
  if (s.deploy.target) v += 20;
  else gaps.push({ dim: "technical", gap: "no deployment config detected" });
  if (s.isNodeProject) v += 10;
  return clamp(v);
}

function scoreSecurity(s, gaps) {
  let v = 40;
  if (s.auth.provider) v += 20;
  else gaps.push({ dim: "security", gap: "no auth provider — accounts unprotected" });
  if (s.payments.provider) {
    if (s.payments.webhookVerified) v += 20;
    else gaps.push({ dim: "security", gap: "payment webhook signature NOT verified (forgeable events)" });
  } else {
    v += 10;
  }
  // secrets hygiene proxy: env example present, no obvious secret in tracked code
  if (s.envKeys.length) v += 10;
  if (s.sensitive.escalate) {
    v = Math.min(v, 40);
    gaps.push({ dim: "security", gap: `sensitive data (${s.sensitive.signals.join(", ")}) — security review required before launch` });
  }
  return clamp(v);
}

function scorePrivacy(s, gaps) {
  let v = 30;
  if (s.account.deletionPath) v += 30;
  else gaps.push({ dim: "privacy", gap: "no account deletion path (data-subject right)" });
  if (s.account.exportPath) v += 20;
  else gaps.push({ dim: "privacy", gap: "no data export path (portability)" });
  if (s.envKeys.length) v += 20; // proxy: configured env implies awareness; refined by the security module
  if (s.sensitive.escalate) {
    v = Math.min(v, 40);
    gaps.push({ dim: "privacy", gap: `sensitive category (${s.sensitive.signals.join(", ")}) — legal review required (COPPA/state-law applicability)` });
  }
  return clamp(v);
}

function scoreMonetization(s, gaps) {
  let v = 10;
  if (s.payments.provider) {
    v += 50;
    if (s.payments.webhookVerified) v += 25;
    else gaps.push({ dim: "monetization", gap: "checkout without verified webhooks → entitlements unreliable" });
    if (s.funnel.hasPricing) v += 15;
    else gaps.push({ dim: "monetization", gap: "no pricing page — checkout has no funnel entry" });
  } else {
    gaps.push({ dim: "monetization", gap: "no payment provider — product cannot take money" });
  }
  return clamp(v);
}

function scoreFunnel(s, gaps) {
  let v = 10;
  if (s.funnel.hasLanding) v += 45;
  else gaps.push({ dim: "funnel", gap: "no landing/homepage surface" });
  if (s.funnel.hasPricing) v += 30;
  else gaps.push({ dim: "funnel", gap: "no pricing surface" });
  if (s.analytics.provider) v += 15; // a funnel needs instrumentation
  return clamp(v);
}

function scoreDeployment(s, gaps) {
  let v = 15;
  if (s.deploy.target) v += 60;
  else gaps.push({ dim: "deployment", gap: "no hosting/deploy target configured" });
  if (s.platform !== "unknown") v += 25;
  return clamp(v);
}

function scoreAnalytics(s, gaps) {
  let v = 20;
  if (s.analytics.provider) v += 70;
  else gaps.push({ dim: "analytics", gap: "no analytics — funnel + activation are unmeasured" });
  return clamp(v);
}

function scoreSupport(s, gaps) {
  let v = 25;
  if (s.email.provider) v += 45;
  else gaps.push({ dim: "support", gap: "no transactional email — no onboarding/support/lifecycle channel" });
  if (s.account.deletionPath) v += 15;
  if (s.funnel.hasLanding) v += 15; // a public surface implies a contact/support route
  return clamp(v);
}

const SCORERS = {
  product: scoreProduct,
  technical: scoreTechnical,
  security: scoreSecurity,
  privacy: scorePrivacy,
  monetization: scoreMonetization,
  funnel: scoreFunnel,
  deployment: scoreDeployment,
  analytics: scoreAnalytics,
  support: scoreSupport,
};

/**
 * scoreReadiness(state) → { dimensions: {dim:0-100}, composite, gaps:[{dim,gap}], sensitiveEscalation }
 * composite = simple mean of the 9 dimensions (each equally weighted).
 */
function scoreReadiness(state) {
  const gaps = [];
  const dimensions = {};
  for (const dim of DIMENSIONS) {
    dimensions[dim] = SCORERS[dim](state, gaps);
  }
  const composite = clamp(
    DIMENSIONS.reduce((sum, d) => sum + dimensions[d], 0) / DIMENSIONS.length,
  );
  return {
    composite,
    dimensions,
    gaps,
    sensitiveEscalation: !!(state.sensitive && state.sensitive.escalate),
  };
}

module.exports = { scoreReadiness, DIMENSIONS, clamp };
