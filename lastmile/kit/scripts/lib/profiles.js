"use strict";
/**
 * lib/profiles.js — the 9 product profiles and their "easy-default" stacks,
 * plus recommendStack(), which respects an existing stack rather than forcing a
 * rewrite. The "do not overbuild" rule lives here: defaults are the minimum
 * monetizable + trustworthy + supportable path.
 *
 * PROFILES is also the `--profile` validator for review.js and plan.js.
 */

const PROFILES = [
  "web-saas",
  "mobile-app",
  "desktop-app",
  "ai-tool",
  "marketplace",
  "content-community",
  "internal-external",
  "self-hosted",
  "unknown",
];

// The simpler-MVP default (used for unknown / when in doubt).
const SIMPLE_MVP = {
  db: "supabase",
  auth: "supabase",
  payments: "stripe-checkout",
  hosting: "vercel",
  analytics: "plausible",
  email: "resend",
};

const DEFAULT_STACKS = {
  "web-saas": {
    db: "supabase-or-neon",
    auth: "clerk-or-supabase",
    payments: "stripe",
    hosting: "vercel",
    analytics: "posthog-or-plausible",
    email: "resend-or-loops",
  },
  "mobile-app": {
    db: "supabase",
    auth: "supabase",
    payments: "stripe-where-supported-else-iap",
    hosting: "eas-build-submit",
    analytics: "posthog",
    email: "resend",
  },
  "desktop-app": {
    db: "sqlite-or-turso",
    auth: "license-keys-or-supabase",
    payments: "stripe-or-license",
    hosting: "signed-builds-auto-update",
    analytics: "posthog",
    email: "resend",
  },
  "ai-tool": {
    db: "supabase",
    auth: "clerk-or-supabase",
    payments: "stripe-usage-or-credit",
    hosting: "vercel",
    analytics: "posthog",
    email: "resend",
  },
  marketplace: {
    db: "postgres-neon",
    auth: "clerk-or-supabase",
    payments: "stripe-connect",
    hosting: "vercel",
    analytics: "posthog",
    email: "resend",
  },
  "content-community": {
    db: "supabase",
    auth: "supabase",
    payments: "stripe-subscription",
    hosting: "vercel",
    analytics: "plausible",
    email: "loops",
  },
  "internal-external": {
    db: "keep-existing",
    auth: "add-auth-boundary",
    payments: "stripe",
    hosting: "keep-existing-or-vercel",
    analytics: "posthog",
    email: "resend",
  },
  // Self-hosted: you run your own server + DB (not a managed backend).
  // Boring, reproducible, self-operated path: containerized behind a reverse
  // proxy with automatic TLS; self-hostable analytics; bring-your-own auth.
  "self-hosted": {
    db: "postgres-self-hosted",
    auth: "authjs-or-custom",
    payments: "stripe",
    hosting: "docker-compose-on-vps",
    analytics: "plausible-self-hosted-or-posthog",
    email: "resend",
  },
  unknown: SIMPLE_MVP,
};

// Map a detected framework/platform to the most likely profile when no
// --profile is given. Conservative: returns "unknown" if it can't tell.
function inferProfile(state) {
  if (!state) return "unknown";
  if (state.platform === "mobile") return "mobile-app";
  if (state.platform === "desktop") return "desktop-app";
  // Self-hosted: the persistence is self-hosted (own server/DB) AND there is no
  // managed deploy target, i.e. you run your own infra, so the managed web-saas
  // default would mis-route you. Conservative: only when the capability signal
  // is explicit; otherwise fall through to the web default.
  const selfHostedDb =
    state.persistence && state.persistence.hostingModel === "self-hosted";
  const noManagedTarget = !(state.deploy && state.deploy.target);
  if (selfHostedDb && noManagedTarget &&
      (state.framework === "nextjs" || state.platform === "web" || state.platform === "unknown")) {
    return "self-hosted";
  }
  if (state.framework === "nextjs" || state.platform === "web") {
    return "web-saas";
  }
  return "unknown";
}

/**
 * recommendStack(profile, state) → { profile, stack, kept, rationale, assumptions }
 * Respects an existing stack: if the repo already has a db/auth/payments
 * provider, recommend KEEPING it (don't force a rewrite) and note it under `kept`.
 */
function recommendStack(profile, state) {
  const p = PROFILES.includes(profile) ? profile : inferProfile(state);
  const base = DEFAULT_STACKS[p] || SIMPLE_MVP;
  const stack = Object.assign({}, base);
  const kept = [];
  const assumptions = [];

  if (state) {
    if (state.persistence && state.persistence.provider) {
      stack.db = state.persistence.provider + " (existing)";
      kept.push(`db:${state.persistence.provider}`);
    }
    if (state.auth && state.auth.provider) {
      stack.auth = state.auth.provider + " (existing)";
      kept.push(`auth:${state.auth.provider}`);
    }
    if (state.payments && state.payments.provider) {
      stack.payments = state.payments.provider + " (existing)";
      kept.push(`payments:${state.payments.provider}`);
    }
    if (state.deploy && state.deploy.target) {
      stack.hosting = state.deploy.target + " (existing)";
      kept.push(`hosting:${state.deploy.target}`);
    }
    if (state.analytics && state.analytics.provider) {
      stack.analytics = state.analytics.provider + " (existing)";
      kept.push(`analytics:${state.analytics.provider}`);
    }
    if (state.email && state.email.provider) {
      stack.email = state.email.provider + " (existing)";
      kept.push(`email:${state.email.provider}`);
    }
  }

  if (!profile || !PROFILES.includes(profile)) {
    assumptions.push(`profile inferred as "${p}" from repo state (no --profile given)`);
  }

  const rationale =
    `Profile "${p}": shortest safe path to paid launch. ` +
    `Defaults bias to easy setup, strong docs, low ops. ` +
    (kept.length ? `Keeping existing: ${kept.join(", ")}.` : "Greenfield last-mile stack.");

  return { profile: p, stack, kept, rationale, assumptions };
}

module.exports = { PROFILES, DEFAULT_STACKS, SIMPLE_MVP, inferProfile, recommendStack };
