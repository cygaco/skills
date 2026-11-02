"use strict";
/**
 * modules/deployment.js — last-mile PLATFORM / DEPLOYMENT adapter. Detect the
 * target, recommend a boring reliable host, plan env/build/CI/previews/
 * rollback/domain/smoke. Domain-DNS + app-store are human-approval gates. Pure;
 * conforms to lib/adapter-contract.js.
 */

const { recommendStack } = require("../lib/profiles");

// Is this a SELF-HOSTED deployment? Explicit when the profile says so, or
// inferred when the persistence is self-hosted (own server/DB) with no managed
// deploy target, i.e. you run your own infra and the managed
// (vercel/netlify/…) path would mis-route you.
function isSelfHosted(state, profile) {
  if (profile === "self-hosted") return true;
  const selfHostedDb =
    state && state.persistence && state.persistence.hostingModel === "self-hosted";
  const noManagedTarget = !(state && state.deploy && state.deploy.target);
  return !!(selfHostedDb && noManagedTarget);
}

function detect(state) {
  const d = (state && state.deploy) || {};
  return {
    status: d.target ? "present" : "absent",
    present: !!d.target,
    target: d.target || null,
    platform: (state && state.platform) || "unknown",
    evidence: d.evidence || [],
  };
}

function recommend(state, profile) {
  const existing = state && state.deploy && state.deploy.target;
  if (existing) {
    return { choice: `${existing} (keep existing)`, rationale: "Hosting already configured — add previews + rollback + a prod smoke test.", alternatives: [] };
  }
  const platform = (state && state.platform) || "web";
  if (platform === "mobile") {
    return { choice: "eas-build-submit", rationale: "Expo EAS is the boring path for RN build + store submission.", alternatives: ["eas", "native xcode/gradle pipelines"] };
  }
  if (platform === "desktop") {
    return { choice: "signed-builds + auto-update", rationale: "Code-sign + an update channel; host artifacts on a CDN/releases page.", alternatives: ["github releases", "self-hosted update server"] };
  }
  // Self-hosted web: own server + reverse proxy + TLS, not a managed host.
  if (isSelfHosted(state, profile)) {
    return {
      choice: "docker-compose on a VPS + reverse proxy + TLS",
      rationale:
        "Self-hosted: containerize, run behind a reverse proxy with automatic TLS, " +
        "manage with a process supervisor, and own your backups. Boring + reproducible " +
        "beats bespoke infra.",
      alternatives: [
        "systemd + nginx + certbot",
        "single-node k3s",
        "fly.io (managed-ish)",
        "render/railway (managed)",
      ],
    };
  }
  const stack = recommendStack(profile, state).stack;
  return {
    choice: stack.hosting,
    rationale: "Boring, reliable, preview-per-PR hosting beats clever infra for a launch.",
    alternatives: ["vercel", "netlify", "cloudflare", "render", "railway", "fly.io"],
  };
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  const platform = (state && state.platform) || "web";
  const mobile = platform === "mobile";
  const selfHosted = isSelfHosted(state, profile);
  const gates = ["domain-dns"];
  if (mobile) gates.push("app-store-submit");
  if (selfHosted) gates.push("server-provision");

  // Shared steps (every deploy). Self-hosted SWAPS the managed-host specifics
  // for the server-deploy specifics (provision/proxy/TLS/backups).
  const steps = [
    "Environment variables: enumerate prod env vars; set them in the host, never commit secrets.",
    "Build command: the production build (e.g. next build / eas build) runs clean in CI.",
    "CI checks: typecheck + lint + tests gate every deploy.",
  ];
  if (selfHosted) {
    steps.push(
      "Provision the server: stand up a VPS/host (a human-approval gate — paid infra you own + operate).",
      "Containerize: a Dockerfile + docker-compose (or a systemd unit) that runs the app + DB reproducibly.",
      "Reverse proxy + TLS: front the app with nginx/Caddy and automatic certificates (Let's Encrypt / Caddy).",
      "Secrets: inject via env/a secret store on the host — never committed, never baked into the image.",
      "Database backups + restore drill: scheduled backups AND a tested restore (a managed DB does this for you; self-hosted must own it).",
      "Low-downtime restart: a supervised restart/rollout that doesn't drop the live service.",
      "Production smoke test: after deploy, assert the live URL returns 200 + the core path works ('it builds' ≠ 'it serves').",
    );
  } else {
    steps.push(
      "Deploy previews: a preview URL per PR for review before prod.",
      mobile
        ? "Store readiness: icons, splash, store listing, privacy nutrition labels, screenshots; submit is a human-approval gate."
        : "Custom domain: configure DNS (a human-approval gate) + HTTPS.",
      "Rollback plan: a one-command/one-click revert to the previous good deploy.",
      "Production smoke test: after deploy, assert the live URL returns 200 + the core path works ('it builds' ≠ 'it serves').",
    );
  }

  const tests = [
    "build command exits 0 in CI",
    "production smoke: deployed URL returns HTTP 200",
  ];
  if (selfHosted) tests.push("database backup runs AND a restore is verified on a copy");
  else tests.push(mobile ? "EAS build produces an installable artifact" : "preview deploy succeeds for a PR");

  const risks = ["DNS/domain + app-store submission are irreversible-ish — both are human-approval gates."];
  if (selfHosted)
    risks.push("Self-hosted infra is yours to patch + secure + back up — no managed safety net; provisioning is a human-approval gate.");

  return {
    summary: selfHosted
      ? `Deployment: ${rec.choice} (self-hosted ${platform}). Own your server: containerize, reverse-proxy + TLS, and a tested backup/restore.`
      : `Deployment: ${rec.choice} (${platform}). Prefer boring + reliable: previews, a rollback plan, and a real production smoke test.`,
    steps,
    envVars: [],
    gates,
    tests,
    template: "launch-plan",
    risks,
  };
}

module.exports = { name: "deployment", title: "Platform & Deployment", detect, recommend, plan };
