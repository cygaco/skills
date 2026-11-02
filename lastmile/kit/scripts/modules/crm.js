"use strict";
/**
 * modules/crm.js — last-mile CRM / SUPPORT / LIFECYCLE adapter. Decide relevance
 * FIRST; recommend lightweight defaults; refuse a heavy CRM unless justified.
 * Pure; conforms to lib/adapter-contract.js.
 */

function detect(state) {
  const e = (state && state.email) || {};
  return {
    status: e.provider ? "present" : "absent",
    present: !!e.provider,
    provider: e.provider || null,
    evidence: e.provider ? [`email:${e.provider}`] : [],
  };
}

function recommend(state, profile) {
  const existing = state && state.email && state.email.provider;
  if (existing) {
    return {
      choice: `${existing} (keep existing)`,
      rationale: "Transactional email already wired — add lifecycle flows rather than a new tool.",
      alternatives: [],
    };
  }
  // Lightweight first. Loops/Customer.io for lifecycle marketing; Resend for pure transactional.
  const choice = profile === "content-community" ? "loops" : "resend";
  return {
    choice,
    rationale: "Start with transactional email + a simple lifecycle tool. Heavy CRM (HubSpot/Salesforce) is NOT justified pre-traction.",
    alternatives: ["resend (transactional)", "loops / customer.io (lifecycle)", "buttondown (newsletter)", "airtable/notion (lightweight lead store)"],
  };
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  const provider = (state && state.email && state.email.provider) || "resend";
  return {
    summary: `Lifecycle: ${rec.choice}. Capture leads + send the few emails that matter (welcome, receipt, churn). Do NOT add heavy CRM unless justified.`,
    steps: [
      "Leads/waitlist: a single capture (form → store) before any heavy tooling.",
      "Onboarding emails: welcome + activation nudge (the moment the user gets value).",
      "Payment events: receipt + failed-payment + cancellation emails (wire from payment webhooks).",
      "Support route: one reachable channel (email alias or a simple inbox) — published in-app + on the site.",
      "Feedback route: a lightweight way to collect feedback (form/inbox), reviewed weekly.",
      "Churn signals: flag cancellations + inactivity; a basic win-back email.",
      "Decision: skip a dedicated CRM unless sales-led or multi-touch B2B is the model.",
    ],
    envVars: provider === "loops" ? ["LOOPS_API_KEY"] : ["RESEND_API_KEY"],
    gates: ["email-real-users"],
    tests: [
      "welcome email renders + sends in test mode",
      "waitlist/lead capture persists an entry",
    ],
    template: "launch-plan",
    risks: ["Sending to real users is a human-approval gate (deliverability + privacy + unsubscribe)."],
  };
}

module.exports = { name: "crm", title: "CRM / Support / Lifecycle", detect, recommend, plan };
