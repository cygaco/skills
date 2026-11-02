---
guide: ANALYTICS_TELEMETRY
anchor: lastmile:module/analytics
shape: walkthrough
timing: at-module
lead_time: "none"
---

# ANALYTICS_TELEMETRY_GUIDE.md - Know If Your Product Is Working (for Total Newbies)

> You built an app. Analytics and telemetry answer the plain question: **are real people reaching the important moment, or are they getting stuck?**
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split. This guide focuses on what to measure, where to send it, and how not to turn analytics into a privacy or noise problem.

---

## 1. ELI5 - what is analytics?

Imagine your app is a small store. Analytics is the counter by the door, the receipt drawer, and the notebook where you write "people keep leaving before checkout." It does not tell you everything about your users. It tells you enough to see whether the store works.

For a launch-stage product, the goal is not a giant dashboard. The goal is a short event chain:

1. A person arrives.
2. They show intent.
3. They create an account or start.
4. They reach the activation moment.
5. They do the core product action.
6. If you charge money, they start and finish checkout.

If that chain breaks, analytics tells you where.

---

## 2. The tiny vocabulary you need

| Word | Plain-English meaning | Example |
|---|---|---|
| Event | A named thing that happened | `signup_completed` |
| Property | Extra facts attached to an event | plan: `pro`, source: `pricing_page` |
| User ID | Stable identifier for the signed-in user | your database user id |
| Anonymous ID | Identifier before sign-in | browser/device id from the analytics tool |
| Funnel | Ordered steps people should complete | visit -> signup -> activation |
| Activation | The first real "aha" moment | first export, first invite, first saved item |
| Retention | Whether people come back | active again on day 7 |

---

## 3. Pick a simple tool

Use one product analytics tool first. Do not install three trackers unless you have a strong reason.

| Tool type | Good when | Notes |
|---|---|---|
| Product analytics (PostHog, Mixpanel, Amplitude) | You need event funnels, activation, retention | Best fit for product learning |
| Privacy-light web analytics (Plausible, Fathom, Vercel Analytics) | You mostly need page visits and referrers | Simple and low-noise |
| GA4 | You already use Google marketing/reporting | Powerful, but can be confusing |
| Warehouse/custom events | You already have data infrastructure | Usually too much for pre-PMF |

**Recommendation for first launch:** choose either a product analytics tool for funnels or a privacy-light web analytics tool for basic traffic. Add more only when you know what question the extra tool answers.

---

## 4. The launch event chain

Start with these events. Rename them to match your app, but keep the chain.

| Event | Why it matters |
|---|---|
| `landing_viewed` | Someone reached the product |
| `cta_clicked` | They showed intent |
| `signup_started` | They began account creation |
| `signup_completed` | They became reachable |
| `onboarding_started` | They entered the first-use path |
| `activation_reached` | They hit the first real value moment |
| `core_action_completed` | They did the repeatable thing your product exists for |
| `checkout_started` | They tried to pay |
| `checkout_completed` | Revenue happened |
| `subscription_changed` | Upgrade, downgrade, cancel, or renewal changed |

> **Important:** `activation_reached` is a product decision, not a code guess. The human founder decides what counts as the "aha" moment. The AI assistant can wire the event after that.

---

## 5. What YOU must decide

| Decision | Why it is yours |
|---|---|
| What counts as activation | It defines whether the product is working |
| Which data is acceptable to collect | It affects user trust and privacy promises |
| Which tool account to create | It uses your email, billing, and legal agreement |
| Whether analytics uses cookies | It may affect consent/banner requirements |
| Which metrics matter this month | The app should not optimize for every number at once |

Your assistant can recommend, but you own these choices.

---

## 6. What AI can build

Ask your assistant for a small, typed analytics layer instead of sprinkling tracker calls everywhere.

```
Add a single analytics wrapper with named events, typed event properties, one raw sink, and tests that prevent direct calls to the analytics SDK outside the wrapper. Track landing_viewed, cta_clicked, signup_completed, onboarding_started, activation_reached, core_action_completed, checkout_started, checkout_completed, and subscription_changed.
```

The wrapper matters because it gives you one place to change tools later and one place to prevent secrets or private data from leaking into event payloads.

---

## 7. Privacy and safety rules

- Do not send passwords, tokens, API keys, full payment details, government IDs, health data, or private messages to analytics.
- Prefer user IDs from your database over raw emails.
- Do not collect more than you can explain in your privacy policy.
- If you use cookies or cross-site marketing trackers, check [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md).
- Give internal/admin events a separate category so they do not pollute customer funnels.
- Never make product decisions from a single vanity number like total page views.

---

## 8. Launch checklist

```
ANALYTICS / TELEMETRY
[ ] One analytics tool picked, not three
[ ] Activation definition written in plain English
[ ] Event names listed before implementation
[ ] Analytics wrapper exists; direct SDK calls are blocked or discouraged
[ ] No secrets, emails, payment data, or sensitive data in event properties
[ ] Signup -> activation -> core action funnel can be viewed in the analytics tool
[ ] Checkout events are driven by verified payment/webhook state, not client claims
[ ] Internal/admin/test events are filtered out of production metrics
[ ] Privacy policy/cookie disclosure matches what is actually collected
```

---

## 9. Cross-references

- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) - disclosures, consent, data export/delete.
- [`PAYMENTS_GUIDE.md`](PAYMENTS_GUIDE.md) - checkout and entitlement events should come from verified server/webhook state.
- [`API_LIMITS_GUIDE.md`](API_LIMITS_GUIDE.md) - AI-heavy products should track rate-limit and usage-cap failures calmly.
- [`knowledge/product-telemetry/`](../knowledge/product-telemetry/README.md) - the deeper rules behind this guide, for you and your AI.

---

## 10. Official sources

- PostHog docs: https://posthog.com/docs
- Plausible docs: https://plausible.io/docs
- Vercel Web Analytics docs: https://vercel.com/docs/analytics
- Google Analytics docs: https://support.google.com/analytics/
- GDPR personal data overview: https://commission.europa.eu/law/law-topic/data-protection_en

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Tool capabilities and privacy rules change; check the provider docs and your legal/privacy obligations before launch.*
