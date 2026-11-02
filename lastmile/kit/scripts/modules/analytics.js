"use strict";
/**
 * modules/analytics.js — last-mile ANALYTICS / INSTRUMENTATION adapter.
 *
 * A small core lifecycle vocabulary comes first (signup → activation → checkout).
 * Provider and funnel events are layered on top as enrichment; the plan never
 * installs a second tracker next to one that already exists, and never renames
 * events the product already emits. Pure; conforms to lib/adapter-contract.js.
 */

const { recommendStack } = require("../lib/profiles");

const CORE_EVENTS = [
  "signup",
  "onboarding_complete",
  "activation",
  "core_action",
  "retention_return",
  "checkout",
];

const ENRICHMENT_EVENTS = [
  "visit_landing_page",
  "click_primary_cta",
  "start_checkout",
  "complete_payment",
  "subscription_change",
  "experiment_exposure",
  "activation_definition_change",
];

const REQUIRED_EVENTS = CORE_EVENTS;

const ENV_BY_PROVIDER = {
  posthog: ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],
  plausible: [],
  vercel: [],
  ga4: ["NEXT_PUBLIC_GA_ID"],
};

// Where an activation definition came from. "inferred-from-repo" = read off
// the code; "named-by-you" = you stated it; "revised-at-lastmile" = changed
// during the /lastmile run.
const VALID_ACTIVATION_PROVENANCE = new Set([
  "inferred-from-repo",
  "named-by-you",
  "revised-at-lastmile",
]);

const ACTIVATION_CHANGE_FIELDS = ["predicate", "provenance", "confidence", "derivedFrom"];

function isUnresolvedActivationValue(value) {
  return (
    typeof value !== "string" ||
    !value.trim() ||
    /\{\{[^}]+\}\}|TODO|TBD|PLACEHOLDER|FIXME|your activation/i.test(value)
  );
}

function activationDefinitionErrors(definition) {
  const errors = [];
  if (!definition || typeof definition !== "object") {
    return ["activation definition is required"];
  }
  if (isUnresolvedActivationValue(definition.predicate)) {
    errors.push("predicate must be resolved");
  }
  if (isUnresolvedActivationValue(definition.derivedFrom)) {
    errors.push("derivedFrom must be resolved");
  }
  if (
    isUnresolvedActivationValue(definition.provenance) ||
    !VALID_ACTIVATION_PROVENANCE.has(definition.provenance)
  ) {
    errors.push("provenance must be one of the known activation sources");
  }
  if (
    typeof definition.confidence !== "number" ||
    !Number.isFinite(definition.confidence) ||
    definition.confidence < 0 ||
    definition.confidence > 1
  ) {
    errors.push("confidence must be numeric between 0 and 1");
  }
  return errors;
}

function assertValidActivationDefinition(definition) {
  const errors = activationDefinitionErrors(definition);
  if (errors.length) {
    throw new Error(`invalid activation definition: ${errors.join("; ")}`);
  }
}

function activationChangeProps(current, next, changedFields) {
  return {
    oldPredicate: current.predicate,
    newPredicate: next.predicate,
    oldProvenance: current.provenance,
    newProvenance: next.provenance,
    oldConfidence: current.confidence,
    newConfidence: next.confidence,
    oldDerivedFrom: current.derivedFrom,
    newDerivedFrom: next.derivedFrom,
    changedFields,
  };
}

function detect(state) {
  const a = (state && state.analytics) || {};
  return {
    status: a.provider ? "present" : "absent",
    present: !!a.provider,
    provider: a.provider || null,
    evidence: a.evidence || [],
  };
}

function recommend(state, profile) {
  const existing = state && state.analytics && state.analytics.provider;
  if (existing) {
    return {
      choice: `${existing} (keep existing)`,
      rationale:
        "Analytics wired - add the core lifecycle events to it without renaming events the product already sends.",
      alternatives: [],
    };
  }
  const stack = recommendStack(profile, state).stack;
  return {
    choice: stack.analytics,
    rationale:
      "PostHog for product+funnel analytics; one tracker, with the core lifecycle events as its base vocabulary.",
    alternatives: ["posthog", "plausible", "vercel-analytics", "ga4"],
  };
}

// Confirm the current activation definition, or apply a revision to it. A
// revision that changes any tracked field emits activation_definition_change
// through opts.emit, so the change itself is measurable.
function confirmOrReviseActivationDefinition(current, opts = {}) {
  const emit = typeof opts.emit === "function" ? opts.emit : () => {};
  const revision = opts.revision || null;
  if (!revision) {
    const next = {
      ...current,
      lastmileConfirmed: true,
    };
    assertValidActivationDefinition(next);
    return next;
  }

  const next = {
    ...current,
    ...revision,
    provenance: revision.provenance || "revised-at-lastmile",
    confidence: revision.confidence == null ? current.confidence : revision.confidence,
    lastmileConfirmed: true,
  };

  assertValidActivationDefinition(next);

  const changedFields = ACTIVATION_CHANGE_FIELDS.filter((field) => next[field] !== current[field]);
  if (changedFields.length) {
    emit("activation_definition_change", activationChangeProps(current, next, changedFields));
  }

  return next;
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  const provider = (state && state.analytics && state.analytics.provider) || "posthog";
  return {
    summary: `Analytics: ${rec.choice}. Confirm what "activated" means for your product and instrument the core lifecycle events first.`,
    steps: [
      "Instrument the core lifecycle events through one track() helper: " + CORE_EVENTS.join(", ") + ".",
      "Confirm or revise the activation definition (the moment a user first gets value); emit activation_definition_change when it is revised.",
      "Layer enrichment events for traffic, funnel, payment, subscription, and experiments: " + ENRICHMENT_EVENTS.join(", ") + ".",
      "Build the funnel view from core + enrichment events: visit -> CTA -> signup -> onboarding -> activation -> checkout -> payment.",
      "Success metrics: pick a North Star (e.g. weekly activated users) + funnel conversion targets.",
      "Kill/continue criteria: define up front what result would stop vs. continue the bet.",
      "Privacy: disclose tracking; prefer cookieless/aggregate where possible (ties to security module).",
    ],
    envVars: ENV_BY_PROVIDER[provider] || ENV_BY_PROVIDER.posthog,
    gates: [],
    tests: [
      "signup fires on account creation through track()",
      "activation fires only with the confirmed activation definition",
      "complete_payment is emitted as enrichment from the verified payment webhook",
    ],
    template: "launch-plan",
    risks: ["Unmeasured funnels make launch decisions guesswork - instrument before, not after, launch."],
    coreEvents: CORE_EVENTS,
    enrichmentEvents: ENRICHMENT_EVENTS,
    requiredEvents: REQUIRED_EVENTS,
  };
}

module.exports = {
  name: "analytics",
  title: "Analytics & Instrumentation",
  detect,
  recommend,
  plan,
  confirmOrReviseActivationDefinition,
  activationDefinitionErrors,
  CORE_EVENTS,
  ENRICHMENT_EVENTS,
  REQUIRED_EVENTS,
};
