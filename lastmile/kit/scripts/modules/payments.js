"use strict";
/**
 * modules/payments.js — last-mile PAYMENTS / MONETIZATION adapter.
 *
 * Web/desktop defaults to Stripe. Mobile apps default to platform billing for
 * in-app digital goods/subscriptions (Apple StoreKit / Google Play Billing);
 * Stripe remains appropriate for physical goods, real-world services, or a
 * human-confirmed external web purchase path. Builds the FUNNEL, not just
 * checkout, and treats unverified webhooks as a first-class risk. Pure;
 * conforms to lib/adapter-contract.js.
 */

function isMobileSurface(state, profile) {
  return profile === "mobile-app" || (state && state.platform === "mobile");
}

function purchaseContext(state) {
  const p = (state && state.payments) || {};
  const m = (state && state.monetization) || {};
  return String(
    p.purchaseContext ||
      p.goodsType ||
      p.billingScope ||
      p.model ||
      m.purchaseContext ||
      m.goodsType ||
      m.billingScope ||
      m.model ||
      "",
  ).toLowerCase();
}

function isPhysicalOrOutsideApp(state) {
  const ctx = purchaseContext(state);
  return /\b(physical|real[-\s]?world|outside[-\s]?app|out[-\s]?of[-\s]?app|web[-\s]?only|reader|external[-\s]?service|in[-\s]?person)\b/.test(ctx);
}

function requiresPlatformBilling(state, profile) {
  return isMobileSurface(state, profile) && !isPhysicalOrOutsideApp(state);
}

function detect(state) {
  const p = (state && state.payments) || {};
  if (!p.provider) return { status: "absent", present: false, provider: null, webhookVerified: false, evidence: p.evidence || [] };
  // present-but-partial when payments exist without verified webhooks
  return {
    status: p.webhookVerified ? "present" : "partial",
    present: true,
    provider: p.provider,
    webhookVerified: !!p.webhookVerified,
    evidence: p.evidence || [],
  };
}

function recommend(state, profile) {
  const existing = state && state.payments && state.payments.provider;
  const mobilePlatformBilling = requiresPlatformBilling(state, profile);
  if (existing) {
    if (mobilePlatformBilling && /^stripe/i.test(existing)) {
      return {
        choice: "platform-billing-review",
        rationale:
          "Stripe is wired, but mobile in-app digital goods/subscriptions default to Apple StoreKit / Google Play Billing. Keep Stripe only for physical goods, real-world services, or a region/date-confirmed external purchase path.",
        alternatives: ["apple-storekit", "google-play-billing", "stripe for physical/outside-app purchases", "region-specific external purchase link (human/legal confirmation)"],
      };
    }
    return {
      choice: `${existing} (keep existing)`,
      rationale: "Payment provider already wired — complete the funnel + verify webhooks rather than switch.",
      alternatives: [],
    };
  }
  if (mobilePlatformBilling) {
    return {
      choice: "platform-billing",
      rationale:
        "Mobile in-app digital goods/subscriptions should use platform billing by default: Apple StoreKit for iOS and Google Play Billing for Android. Use Stripe only for physical goods, real-world services, or a human-confirmed external web checkout path.",
      alternatives: ["apple-storekit", "google-play-billing", "stripe for physical/outside-app purchases", "region-specific external purchase link (human/legal confirmation)"],
    };
  }
  // Stripe default; Connect for marketplaces.
  const choice = profile === "marketplace" ? "stripe-connect" : "stripe";
  return {
    choice,
    rationale: "Stripe is the boring, well-documented default. Connect when the product pays third parties (marketplace).",
    alternatives: ["stripe", "stripe-connect", "paddle (merchant-of-record)", "lemonsqueezy (MoR)"],
  };
}

function plan(state, profile) {
  const rec = recommend(state, profile);
  const p = (state && state.payments) || {};
  const webhookGap = p.provider && !p.webhookVerified;
  const platformBilling = /^platform-billing/.test(rec.choice);
  const steps = platformBilling
    ? [
        "Classify the purchase first: in-app digital goods/subscriptions vs physical goods, real-world services, or outside-app/web-only access.",
        "iOS digital/in-app: create App Store Connect In-App Purchase or subscription products and wire StoreKit product ids.",
        "Android digital/in-app: create Play Console products/subscriptions and wire Google Play Billing product ids.",
        "Entitlement checks: grant access on the SERVER from verified App Store / Play purchase state, never client-only.",
        "Server notifications: verify Apple App Store Server Notifications and Google Play purchase tokens before updating paid state.",
        "External payment carve-out: if relying on a region-specific link-out or web checkout path, record region + as-of date + human/legal confirmation before implementation.",
        "Pricing and paywall copy: disclose every IAP/subscription accurately in store metadata and in-app UI.",
        "Sandbox tests: use StoreKit testing/TestFlight and Play Billing test purchases before any store submission.",
      ]
    : [
        "Choose the model: subscription / one-time / freemium / trial / usage / credit / waitlist — match the value delivery.",
        "Pricing page: clear tiers, the recommended plan highlighted, annual/monthly toggle if subscription.",
        "Upgrade prompts: in-product nudges at the value moment (not nagware).",
        "Checkout: Stripe Checkout (hosted) for speed; Payment Links for a no-code start.",
        "Success/cancel states: confirm entitlement on success; recover gracefully on cancel.",
        "Billing portal: Stripe Customer Portal for self-serve plan changes + invoices.",
        "Entitlement checks: gate features on the SERVER from verified subscription state, never client-only.",
        "Webhook handling: verify the signature (stripe.webhooks.constructEvent) and grant entitlements ONLY on verified events.",
        "Refund/cancellation policy copy: plain-language, linked from pricing + checkout.",
      ];
  if (!platformBilling && webhookGap) {
    steps.unshift("FIX (security): payment webhook signature is NOT verified — add stripe.webhooks.constructEvent before trusting any event. Forgeable events can grant free entitlements.");
  }
  return {
    summary: platformBilling
      ? `Monetization: ${rec.choice}. Mobile digital/in-app monetization uses platform billing by default (Apple StoreKit / Google Play Billing); Stripe is only for physical, outside-app, or confirmed external-purchase paths.`
      : `Monetization: ${rec.choice}. Build the funnel (pricing → checkout → portal → entitlements → verified webhooks), not just a checkout button.${webhookGap ? " ⚠ webhook signature unverified — fix before launch." : ""}`,
    steps,
    envVars: platformBilling
      ? ["APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_ISSUER_ID", "GOOGLE_PLAY_PACKAGE_NAME", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]
      : ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    gates: platformBilling ? ["app-store-submit"] : ["stripe-live"],
    tests: [
      ...(platformBilling
        ? [
            "StoreKit sandbox/TestFlight purchase completes + grants entitlement",
            "Google Play Billing test purchase completes + grants entitlement",
            "server rejects unsigned/fake mobile purchase state",
            "entitlement is denied without a verified platform transaction",
          ]
        : [
            "test-mode checkout completes + grants entitlement",
            "webhook signature verification rejects an unsigned/forged event",
            "entitlement is denied without a verified subscription",
            "billing portal opens for an existing customer",
          ]),
    ],
    template: "launch-plan",
    risks: platformBilling
      ? ["Do not sell in-app digital goods/subscriptions through embedded Stripe unless a region/date-specific external-payment path has human/legal confirmation."]
      : webhookGap
        ? ["UNVERIFIED webhooks: forged events can grant paid features for free — highest-priority monetization fix."]
        : ["Verify in Stripe TEST mode before any live-mode switch (live mode is a human-approval gate)."],
  };
}

module.exports = { name: "payments", title: "Payments & Monetization", detect, recommend, plan, requiresPlatformBilling };
