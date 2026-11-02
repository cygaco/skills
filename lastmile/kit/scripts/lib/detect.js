"use strict";
/**
 * lib/detect.js — evidence-based repo-state detection for /lastmile.
 *
 * Reads package.json dependencies, a few config files, env-var NAMES (never
 * values) and a bounded scan of source files to infer where the product stands
 * on its last mile. Fail-safe: any read error degrades to "unknown"/null; it
 * never throws.
 *
 * This is the single state producer. score.js consumes its output, the eight
 * module adapters consume it, and the selfcheck fixtures exercise it. The
 * returned shape is the contract: keep it stable.
 */

const fs = require("fs");
const path = require("path");

// ── bounded source scan ──────────────────────────────────────────────
// `.claude` is skipped so the installed kit (`.claude/lastmile/`) never scans
// its own source: its regexes and examples would otherwise look like product
// code (sensitive-data words, webhook calls, pricing routes).
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".claude",
  "coverage",
  ".vercel",
]);
const SOURCE_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const MAX_SCAN_FILES = 400;

function* walk(rootAbs) {
  const stack = [rootAbs];
  let count = 0;
  while (stack.length && count < MAX_SCAN_FILES) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && SOURCE_EXT.has(path.extname(ent.name))) {
        count++;
        yield full;
        if (count >= MAX_SCAN_FILES) return;
      }
    }
  }
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function allDeps(pkg) {
  if (!pkg) return {};
  return Object.assign(
    {},
    pkg.dependencies || {},
    pkg.devDependencies || {},
    pkg.peerDependencies || {},
  );
}

function hasAny(deps, names) {
  return names.find((n) => Object.prototype.hasOwnProperty.call(deps, n)) || null;
}

function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

// Strip comments so detection matches real code, not mentions in comments
// (e.g. a `// no stripe.webhooks.constructEvent here` comment must NOT count as
// webhook verification). `(?<!:)` keeps `https://` intact.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(?<!:)\/\/[^\n]*/g, "");
}

// Scan source for a set of regexes; return the first matching {pattern,file} or null.
function sourceMatch(repoRoot, regexes) {
  for (const file of walk(repoRoot)) {
    let content;
    try {
      content = stripComments(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    for (const re of regexes) {
      if (re.test(content)) {
        return { pattern: re.source, file: path.relative(repoRoot, file).split(path.sep).join("/") };
      }
    }
  }
  return null;
}

// Collect env-var NAMES (not values) from .env* files.
function envKeyNames(repoRoot) {
  const names = new Set();
  for (const f of [".env", ".env.local", ".env.example", ".env.sample"]) {
    const p = path.join(repoRoot, f);
    if (!fs.existsSync(p)) continue;
    let raw;
    try {
      raw = fs.readFileSync(p, "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
      if (m) names.add(m[1]);
    }
  }
  return Array.from(names);
}

// ── framework / platform ─────────────────────────────────────────────
function detectFramework(deps) {
  if (deps.next) return "nextjs";
  if (deps.expo || deps["react-native"]) return "expo";
  if (deps.electron) return "electron";
  if (deps.react || deps.vue || deps.svelte) return "spa";
  if (Object.keys(deps).length) return "node";
  return "unknown";
}

function detectPlatform(framework, deploy) {
  if (framework === "expo") return "mobile";
  if (framework === "electron") return "desktop";
  if (framework === "nextjs" || framework === "spa") return "web";
  if (deploy && deploy.target) return "web";
  return "unknown";
}

// ── persistence / auth / payments / analytics / deploy / email ───────
// Provider -> hosting-model CAPABILITY. "managed" = a hosted database you do
// NOT run yourself (Supabase/Firebase/Turso). "self-hosted" = a database you
// run yourself (Postgres/Mongo, an embedded SQLite file, or an ORM like
// Prisma/Drizzle pointed at your own DB). Capability is INFERRED from the
// provider class: the hosting model (not just the provider name) is what
// drives the self-hosted profile and the server-deploy steps.
const MANAGED_PROVIDERS = new Set(["supabase", "firebase", "turso"]);
const SELF_HOSTED_PROVIDERS = new Set([
  "postgres",
  "mongo",
  "sqlite",
  "prisma",
  "drizzle",
]);

function detectPersistence(deps, repoRoot) {
  const evidence = [];
  let provider = null;
  const supa = hasAny(deps, ["@supabase/supabase-js"]);
  const fb = hasAny(deps, ["firebase", "firebase-admin"]);
  const prisma = hasAny(deps, ["prisma", "@prisma/client"]);
  const drizzle = hasAny(deps, ["drizzle-orm"]);
  const pg = hasAny(deps, ["pg", "postgres"]);
  const sqlite = hasAny(deps, ["better-sqlite3", "@libsql/client"]);
  const mongo = hasAny(deps, ["mongoose", "mongodb"]);
  if (supa) { provider = "supabase"; evidence.push("dep:@supabase/supabase-js"); }
  else if (fb) { provider = "firebase"; evidence.push("dep:firebase"); }
  else if (prisma) { provider = "prisma"; evidence.push(`dep:${prisma}`); }
  else if (drizzle) { provider = "drizzle"; evidence.push("dep:drizzle-orm"); }
  else if (sqlite) { provider = hasAny(deps, ["@libsql/client"]) ? "turso" : "sqlite"; evidence.push("dep:sqlite/turso"); }
  else if (pg) { provider = "postgres"; evidence.push(`dep:${pg}`); }
  else if (mongo) { provider = "mongo"; evidence.push(`dep:${mongo}`); }
  if (fileExists(repoRoot, "prisma/schema.prisma")) evidence.push("file:prisma/schema.prisma");

  // Capability classification. Provider class is the primary signal; a
  // docker-compose/Dockerfile is a cheap corroborating self-hosted signal (you
  // are packaging your own runtime), which can also tip an otherwise
  // managed/unknown stack toward self-hosted infra.
  let hostingModel = null;
  if (provider && MANAGED_PROVIDERS.has(provider)) hostingModel = "managed";
  else if (provider && SELF_HOSTED_PROVIDERS.has(provider)) hostingModel = "self-hosted";
  const dockerized =
    fileExists(repoRoot, "docker-compose.yml") ||
    fileExists(repoRoot, "docker-compose.yaml") ||
    fileExists(repoRoot, "Dockerfile");
  if (dockerized) {
    evidence.push("file:docker-compose/Dockerfile");
    // Dockerized + a self-hostable provider (or none yet) => self-hosted infra.
    if (hostingModel !== "managed") hostingModel = "self-hosted";
  }
  return { provider, hostingModel, evidence };
}

// Google OAuth scopes that trigger Google's sensitive/restricted-scope app
// verification (an outside clock of days to weeks). Only a literal scope URL in
// code counts; plain "Sign in with Google" (openid/email/profile) does not.
const GOOGLE_SENSITIVE_SCOPE_RE =
  /googleapis\.com\/auth\/(gmail|drive|calendar|contacts|photoslibrary|youtube|fitness|spreadsheets|documents)/;

function detectAuth(deps, repoRoot) {
  const evidence = [];
  let provider = null;
  if (hasAny(deps, ["@clerk/nextjs", "@clerk/clerk-react", "@clerk/clerk-sdk-node"])) { provider = "clerk"; evidence.push("dep:@clerk/*"); }
  else if (hasAny(deps, ["next-auth", "@auth/core", "@auth/nextjs"])) { provider = "authjs"; evidence.push("dep:next-auth/@auth"); }
  else if (hasAny(deps, ["@supabase/supabase-js"]) && sourceMatch(repoRoot, [/supabase[\s\S]{0,40}auth/i, /auth\.signIn/])) { provider = "supabase"; evidence.push("supabase auth usage"); }
  else if (hasAny(deps, ["firebase"]) && sourceMatch(repoRoot, [/getAuth\(/, /firebase\/auth/])) { provider = "firebase"; evidence.push("firebase auth usage"); }
  else if (sourceMatch(repoRoot, [/bcrypt|argon2|jsonwebtoken|iron-session|lucia/])) { provider = "custom"; evidence.push("custom auth primitives"); }
  const scope = sourceMatch(repoRoot, [GOOGLE_SENSITIVE_SCOPE_RE]);
  const googleSensitiveScopes = !!scope;
  if (scope) evidence.push(`google-sensitive-scope:${scope.file}`);
  return { provider, googleSensitiveScopes, evidence };
}

function detectPayments(deps, repoRoot) {
  const evidence = [];
  let provider = null;
  if (hasAny(deps, ["stripe", "@stripe/stripe-js"])) { provider = "stripe"; evidence.push("dep:stripe"); }
  else if (hasAny(deps, ["@paddle/paddle-js", "@paddle/paddle-node-sdk"])) { provider = "paddle"; evidence.push("dep:paddle"); }
  else if (hasAny(deps, ["@lemonsqueezy/lemonsqueezy.js"])) { provider = "lemonsqueezy"; evidence.push("dep:lemonsqueezy"); }
  // webhook signature verification (the recurring gap)
  let webhookVerified = false;
  if (provider === "stripe") {
    const m = sourceMatch(repoRoot, [/stripe\.webhooks\.constructEvent(Async)?\s*\(/]);
    if (m) { webhookVerified = true; evidence.push(`webhook-verify:${m.file}`); }
  } else if (provider === "paddle") {
    const m = sourceMatch(repoRoot, [/verifyWebhook|webhookSignature/i]);
    if (m) webhookVerified = true;
  }
  return { provider, webhookVerified, evidence };
}

function detectAnalytics(deps) {
  const evidence = [];
  let provider = null;
  if (hasAny(deps, ["posthog-js", "posthog-node"])) { provider = "posthog"; evidence.push("dep:posthog"); }
  else if (hasAny(deps, ["@vercel/analytics"])) { provider = "vercel"; evidence.push("dep:@vercel/analytics"); }
  else if (hasAny(deps, ["plausible-tracker", "next-plausible"])) { provider = "plausible"; evidence.push("dep:plausible"); }
  else if (hasAny(deps, ["react-ga4", "react-ga"])) { provider = "ga4"; evidence.push("dep:ga"); }
  return { provider, evidence };
}

function detectDeploy(repoRoot, deps) {
  const evidence = [];
  let target = null;
  const map = [
    ["vercel", ["vercel.json"]],
    ["netlify", ["netlify.toml"]],
    ["fly", ["fly.toml"]],
    ["render", ["render.yaml"]],
    ["railway", ["railway.json", "railway.toml"]],
    ["cloudflare", ["wrangler.toml"]],
  ];
  for (const [name, files] of map) {
    if (files.some((f) => fileExists(repoRoot, f))) { target = name; evidence.push(`file:${files[0]}`); break; }
  }
  if (!target && (fileExists(repoRoot, "Dockerfile") || fileExists(repoRoot, "docker-compose.yml"))) {
    target = "docker"; evidence.push("file:Dockerfile");
  }
  if (!target && hasAny(deps, ["expo", "eas-cli"])) { target = "eas"; evidence.push("dep:expo/eas"); }
  return { target, evidence };
}

function detectEmail(deps) {
  let provider = null;
  if (hasAny(deps, ["resend"])) provider = "resend";
  else if (hasAny(deps, ["@loops/sdk", "loops"])) provider = "loops";
  else if (hasAny(deps, ["@customerio/cdp-analytics-node"])) provider = "customerio";
  else if (hasAny(deps, ["postmark", "@sendgrid/mail", "nodemailer"])) provider = "smtp/other";
  return { provider };
}

function detectFunnel(repoRoot) {
  const evidence = [];
  const hasPricing =
    fileExists(repoRoot, "app/pricing") ||
    fileExists(repoRoot, "app/pricing/page.tsx") ||
    fileExists(repoRoot, "pages/pricing.tsx") ||
    !!sourceMatch(repoRoot, [/\/pricing|PricingTable|<Pricing/]);
  const hasLanding =
    fileExists(repoRoot, "app/(marketing)") ||
    fileExists(repoRoot, "app/page.tsx") ||
    fileExists(repoRoot, "pages/index.tsx") ||
    fileExists(repoRoot, "index.html");
  if (hasPricing) evidence.push("pricing surface");
  if (hasLanding) evidence.push("landing surface");
  return { hasLanding: !!hasLanding, hasPricing: !!hasPricing, evidence };
}

function detectAccountLifecycle(repoRoot) {
  const evidence = [];
  const deletionPath = !!sourceMatch(repoRoot, [
    /delete[\s_-]?account/i,
    /DELETE[\s\S]{0,30}\/api\/(account|user)/i,
    /deleteUser\s*\(/,
  ]);
  const exportPath = !!sourceMatch(repoRoot, [/export[\s_-]?(my[\s_-]?)?data/i, /data[\s_-]?export/i, /downloadMyData/i]);
  if (deletionPath) evidence.push("deletion path present");
  if (exportPath) evidence.push("export path present");
  return { deletionPath, exportPath, evidence };
}

const SENSITIVE_PATTERNS = [
  ["health", /\b(hipaa|phi|medical|health[\s_-]?record|patient|diagnos)/i],
  ["finance", /\b(plaid|stripe[\s_-]?issuing|ach|routing[\s_-]?number|brokerage|securities|kyc|aml)\b/i],
  ["children", /\b(coppa|under[\s_-]?13|kids?[\s_-]?mode|child(ren)?[\s_-]?account)\b/i],
  ["education", /\b(ferpa|student[\s_-]?record|school[\s_-]?district)\b/i],
  ["location", /\b(geolocation|precise[\s_-]?location|gps[\s_-]?track|lat(itude)?[\s_-]?long)/i],
  ["biometrics", /\b(biometric|face[\s_-]?recognition|fingerprint|faceid)\b/i],
  ["employment", /\b(eeoc|background[\s_-]?check|hiring[\s_-]?decision|ssn|social[\s_-]?security[\s_-]?number)\b/i],
];

function detectSensitive(repoRoot, deps) {
  const signals = [];
  const hay = Object.keys(deps).join(" ");
  for (const [name, re] of SENSITIVE_PATTERNS) {
    if (re.test(hay) || sourceMatch(repoRoot, [re])) signals.push(name);
  }
  return { signals, escalate: signals.length > 0 };
}

// ── public API ───────────────────────────────────────────────────────
function detectRepoState(repoRoot) {
  const root = repoRoot || process.cwd();
  const pkg = readJsonSafe(path.join(root, "package.json"));
  const deps = allDeps(pkg);

  const framework = detectFramework(deps);
  const deploy = detectDeploy(root, deps);
  const platform = detectPlatform(framework, deploy);

  return {
    schema: "lastmile/state/v1",
    repoRoot: root,
    isNodeProject: !!pkg,
    framework,
    platform,
    persistence: detectPersistence(deps, root),
    auth: detectAuth(deps, root),
    payments: detectPayments(deps, root),
    analytics: detectAnalytics(deps),
    deploy,
    email: detectEmail(deps),
    funnel: detectFunnel(root),
    account: detectAccountLifecycle(root),
    sensitive: detectSensitive(root, deps),
    envKeys: envKeyNames(root),
  };
}

module.exports = {
  detectRepoState,
  // exported for the selfcheck and adapter reuse
  detectFramework,
  detectPersistence,
  detectAuth,
  detectPayments,
  detectAnalytics,
  detectDeploy,
  detectFunnel,
  detectAccountLifecycle,
  detectSensitive,
  envKeyNames,
  allDeps,
  hasAny,
  SKIP_DIRS,
};
