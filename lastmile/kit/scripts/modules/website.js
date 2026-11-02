"use strict";
/**
 * modules/website.js — last-mile WEBSITE + CONVERSION FUNNEL adapter. Plans the
 * landing→checkout funnel with an analytics event per step. Clear conversion
 * over trendy aesthetics. Pure; conforms to lib/adapter-contract.js.
 */

function detect(state) {
  const f = (state && state.funnel) || {};
  const have = [f.hasLanding && "landing", f.hasPricing && "pricing"].filter(Boolean);
  const status = f.hasLanding && f.hasPricing ? "present" : have.length ? "partial" : "absent";
  return {
    status,
    present: !!(f.hasLanding && f.hasPricing),
    hasLanding: !!f.hasLanding,
    hasPricing: !!f.hasPricing,
    evidence: f.evidence || [],
  };
}

function recommend(state /*, profile */) {
  const f = (state && state.funnel) || {};
  if (f.hasLanding && f.hasPricing) {
    return { choice: "optimize existing funnel", rationale: "Funnel surfaces exist — instrument + tighten copy/CTA rather than rebuild.", alternatives: [] };
  }
  return {
    choice: "build conversion funnel (landing + pricing)",
    rationale: "A monetizable product needs a public surface that converts visitors → signups → paid. Clarity beats aesthetics.",
    alternatives: ["single landing page", "landing + pricing + FAQ", "waitlist-only (pre-launch)"],
  };
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  return {
    summary: `Conversion funnel: ${rec.choice}. Favor clear conversion over trendy aesthetics; instrument every step.`,
    steps: [
      "Hero: one-line outcome-focused value prop + primary CTA above the fold.",
      "Offer positioning: who it's for + the specific job it does better than the status quo.",
      "Proof/trust: testimonials, logos, metrics, or a demo — at least one credible signal.",
      "Features → benefits: translate features into user outcomes; scannable.",
      "Pricing: clear tiers, recommended plan highlighted, link to checkout/waitlist.",
      "FAQ: handle the top 5 objections (price, security, lock-in, support, cancellation).",
      "Privacy/Terms links: present in the footer (required for trust + app stores + Stripe).",
      "Onboarding CTA: the activation path is obvious post-signup.",
      "Waitlist or checkout CTA: one primary action per page; remove dead ends.",
      "Instrument each step (see analytics module): visit → CTA click → signup → checkout start.",
    ],
    envVars: [],
    gates: [],
    tests: [
      "landing page renders + primary CTA is present",
      "CTA click emits the funnel analytics event",
      "privacy + terms links resolve",
    ],
    template: "launch-plan",
    risks: ["Trendy/animated designs that bury the CTA reduce conversion — measure, don't assume."],
  };
}

module.exports = { name: "website", title: "Website & Conversion Funnel", detect, recommend, plan };
