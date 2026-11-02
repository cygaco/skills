"use strict";
/**
 * modules/database.js — last-mile DATABASE adapter. Detect persistence,
 * recommend a default that respects the existing stack, and plan schema/
 * migrations/seed/backup/export + env vars + data-ownership notes. Pure: reads
 * state, returns plain objects. Conforms to lib/adapter-contract.js.
 */

const { recommendStack } = require("../lib/profiles");

const ENV_BY_PROVIDER = {
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"],
  neon: ["DATABASE_URL"],
  postgres: ["DATABASE_URL"],
  prisma: ["DATABASE_URL"],
  drizzle: ["DATABASE_URL"],
  turso: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  sqlite: ["DATABASE_URL"],
  firebase: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
  mongo: ["MONGODB_URI"],
};

function detect(state) {
  const p = (state && state.persistence) || {};
  return {
    status: p.provider ? "present" : "absent",
    present: !!p.provider,
    provider: p.provider || null,
    evidence: p.evidence || [],
  };
}

function recommend(state, profile) {
  const existing = state && state.persistence && state.persistence.provider;
  if (existing) {
    return {
      choice: `${existing} (keep existing)`,
      rationale: "A persistence layer already exists — do not rewrite it; harden it (migrations, backups, deletion path).",
      alternatives: [],
    };
  }
  const stack = recommendStack(profile, state).stack;
  return {
    choice: stack.db,
    rationale: "Easy setup, strong docs, low ops, hosted backups. Postgres-compatible keeps portability open.",
    alternatives: ["supabase", "neon-postgres", "sqlite-turso", "firebase"],
  };
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  const provider = (state && state.persistence && state.persistence.provider) || "supabase";
  const envVars = ENV_BY_PROVIDER[provider] || ["DATABASE_URL"];
  return {
    summary: `Database: ${rec.choice}. Shortest safe path: a managed Postgres-compatible store with migrations, automated backups, and a data deletion/export path.`,
    steps: [
      "Schema plan: define core entities + relations; keep a single source-of-truth schema (Prisma/Drizzle/SQL migrations).",
      "Migrations: adopt a migration tool; every change is a reviewed, reversible migration (production migration is a human-approval gate).",
      "Seed strategy: a deterministic seed script for local/dev/staging; never seed production with fixtures.",
      "Backup/export: confirm automated backups are ON; add a user-facing data-export path (portability).",
      "Env-var checklist: " + envVars.join(", ") + " — present in .env.local and the host's env, never committed.",
      "Data ownership & portability: document where data lives, who can export it, and how to migrate off the provider.",
    ],
    envVars,
    gates: ["prod-db-migration"],
    tests: [
      "migration applies cleanly on a fresh copy",
      "seed script runs without error",
      "a row can be created, read, and deleted (deletion path)",
    ],
    template: "launch-plan",
    risks: rec.choice.includes("firebase")
      ? ["NoSQL lock-in reduces portability — justify if chosen over Postgres."]
      : [],
  };
}

module.exports = { name: "database", title: "Database & Persistence", detect, recommend, plan };
