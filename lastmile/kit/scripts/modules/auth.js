"use strict";
/**
 * modules/auth.js — last-mile AUTH / ACCOUNTS adapter. Detect auth, recommend a
 * managed default, and plan the full account lifecycle (incl. deletion — a
 * privacy + trust requirement). Roles only if needed. Pure; conforms to
 * lib/adapter-contract.js.
 */

const { recommendStack } = require("../lib/profiles");

const ENV_BY_PROVIDER = {
  clerk: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  authjs: ["AUTH_SECRET", "AUTH_URL"],
  firebase: ["FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN"],
  custom: ["AUTH_SECRET", "SESSION_SECRET"],
};

function detect(state) {
  const a = (state && state.auth) || {};
  return {
    status: a.provider ? "present" : "absent",
    present: !!a.provider,
    provider: a.provider || null,
    evidence: a.evidence || [],
  };
}

function recommend(state, profile) {
  const existing = state && state.auth && state.auth.provider;
  if (existing && existing !== "custom") {
    return {
      choice: `${existing} (keep existing)`,
      rationale: "Managed auth already wired — extend it (deletion, profile, admin) rather than swap providers.",
      alternatives: [],
    };
  }
  if (existing === "custom") {
    return {
      choice: "custom (review)",
      rationale: "Custom auth detected — audit session handling + password storage; migrate to a managed provider unless there is a named reason to keep it.",
      alternatives: ["clerk", "supabase", "authjs"],
    };
  }
  const stack = recommendStack(profile, state).stack;
  return {
    choice: stack.auth,
    rationale: "Managed auth removes the highest-risk DIY surface (sessions, password storage, OAuth). Custom only when justified.",
    alternatives: ["clerk", "supabase", "authjs", "firebase"],
  };
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  const provider = (state && state.auth && state.auth.provider) || "clerk";
  const envVars = ENV_BY_PROVIDER[provider] || ENV_BY_PROVIDER.clerk;
  const sensitive = !!(state && state.sensitive && state.sensitive.escalate);
  return {
    summary: `Auth: ${rec.choice}. Cover the full account lifecycle incl. self-serve deletion (privacy + trust), not just login.`,
    steps: [
      "Email/password + at least one OAuth provider (Google/Apple/GitHub per audience).",
      "Magic links (passwordless) where the provider supports it — lowers signup friction.",
      "Password reset + email verification flows.",
      "Session handling: secure, httpOnly cookies; sensible expiry + refresh.",
      "Account deletion: self-serve delete that removes/anonymizes user data (ties to the privacy deletion path).",
      "User profile: editable display name/email; avatar optional.",
      "Admin access: a guarded admin surface; never a shared password.",
      "Role/permission model: ONLY if the product needs it — do not add RBAC speculatively.",
    ],
    envVars,
    gates: sensitive ? ["collect-sensitive-data"] : [],
    tests: [
      "signup → verify → login → logout round-trip",
      "password reset issues + consumes a token",
      "account deletion removes the user + associated data",
      "protected route rejects an unauthenticated request",
    ],
    template: "launch-plan",
    risks: provider === "custom" ? ["custom auth — session/password handling must be security-reviewed"] : [],
  };
}

module.exports = { name: "auth", title: "Auth & Accounts", detect, recommend, plan };
