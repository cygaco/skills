"use strict";
/**
 * lib/approval-gates.js — the hard human-approval gates for /lastmile.
 *
 * These actions are NEVER self-authorized. A general "go ahead with everything"
 * does not clear one: each gate needs your explicit yes at the moment it comes
 * up. plan.js marks every task that crosses a gate with ⛔ <gate-id>, and the
 * /lastmile command stops at each one.
 */

const GATES = [
  {
    id: "stripe-live",
    action: "Switch payment provider to LIVE mode",
    why: "Real money movement; mistakes charge real customers and are hard to reverse.",
    requires: "test-mode verification passed + your explicit approval",
  },
  {
    id: "prod-db-migration",
    action: "Run a production database migration",
    why: "Can corrupt or drop real user data; needs backup + reviewed migration + approval.",
    requires: "verified backup + dry-run on a copy + your explicit approval",
  },
  {
    id: "domain-dns",
    action: "Change domain / DNS records",
    why: "Can take the live product offline or hijack email deliverability.",
    requires: "your explicit approval + rollback note",
  },
  {
    id: "server-provision",
    action: "Provision a self-hosted server / VPS (and run the product on it)",
    why: "Spins up paid infrastructure you own + operate; carries cost, patching, and security-exposure obligations a managed host would absorb.",
    requires: "your explicit approval + a backup/restore plan + a reverse-proxy/TLS + hardening checklist",
  },
  {
    id: "app-store-submit",
    action: "Submit to an app store (App Store / Play)",
    why: "Public, reviewed, hard to retract; binds the product's public identity.",
    requires: "your explicit approval + store-readiness checklist passed",
  },
  {
    id: "email-real-users",
    action: "Send emails to real users",
    why: "Irreversible outbound contact; spam/deliverability + privacy implications.",
    requires: "your explicit approval + tested template + suppression/unsub honored",
  },
  {
    id: "collect-sensitive-data",
    action: "Collect sensitive data",
    why: "Health/finance/children/biometric/etc. trigger legal obligations.",
    requires: "legal/security review recorded + your explicit approval",
  },
  {
    id: "publish-legal-docs",
    action: "Publish privacy policy / terms as FINAL legal documents",
    why: "These are legal commitments; a drafted policy is a compliance-by-default starting point, not law.",
    requires: "your (or counsel's) review + explicit approval to publish as final",
  },
];

const GATE_IDS = GATES.map((g) => g.id);

function gateFor(actionId) {
  return GATES.find((g) => g.id === actionId) || null;
}

function requiresApproval(actionId) {
  return GATE_IDS.includes(actionId);
}

module.exports = { GATES, GATE_IDS, gateFor, requiresApproval };
