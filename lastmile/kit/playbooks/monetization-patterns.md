> v1 baked-in playbook — refresh it against current sources before relying on its numbers.

# Last-Mile Monetization Patterns

The reference `/lastmile` loads for monetization. This is the **get-paid brain**: pick a pricing model, wire Stripe correctly, and test before going live. Written for non-technical founders and the logic of `/lastmile`. Cite it as `.claude/lastmile/playbooks/monetization-patterns.md`. Pricing hypotheses and funnel checklists land in `last-mile/LAUNCH_PLAN.md`.

The default payments rail across every profile is **Stripe** (native IAP only where Apple/Google require it — see default-stacks.md).

## Pricing models — when each fits

| Model | Fits when | Watch out for |
|---|---|---|
| **One-time** | Self-contained value: a template, an app license, a course, a tool you "buy once." | No recurring revenue; growth = constant new sales. |
| **Subscription** | Ongoing value/access: SaaS, communities, content. The default for most software. | Churn is the silent killer — track it from day one. |
| **Freemium** | Free tier creates real usage/virality and a clear upgrade ceiling. | Free users cost money; gate the *valuable* feature, not a token one. |
| **Trial** | Value is obvious only after use; high-intent buyers. | Credit-card-up-front trials convert better but cut top-of-funnel. Pick deliberately. |
| **Usage-based** | Cost scales with consumption (AI, compute, API calls, messages). | Unpredictable bills scare buyers — show a live usage meter and caps. |
| **Credit-based** | Usage-based value but you want prepaid, predictable revenue (AI tools, generations). | Track balance honestly; warn before zero; never let a run start it can't finish. |
| **Waitlist / preorder** | Pre-launch demand validation, or capacity-limited launch. | Collect intent (and optionally a deposit) — don't over-promise a date. |

**Default heuristic:** SaaS → subscription (often with a trial or a free tier). AI tool → usage- or credit-based. One-off artifact → one-time. Pre-launch → waitlist. Don't blend three models at launch; ship one, learn, then layer.

## Stripe SaaS implementation patterns

Three building blocks, in order of how little code they need:

| Block | Use it for | Trade-off |
|---|---|---|
| **Payment Links** | Fastest possible "accept money": a hosted URL, no code, paste into a button. | Least control; fine for a first sale or a single plan. |
| **Checkout Session** | The **default** for SaaS — hosted, secure, handles tax/cards/wallets/SCA. Create server-side, redirect. | Slightly more setup than a Link; far more flexible. Start here. |
| **Billing Portal** | Let customers manage their own subscription — upgrade, cancel, update card, see invoices. | Stripe-hosted; wire it so you don't build a billing UI. |

> **Default path:** server-side **Checkout Session** for the purchase + Stripe **Billing Portal** for self-serve management. This combination covers ~90% of SaaS billing with the least custom code.

### The monetization funnel (build every stage)

A sale is a chain. A break anywhere loses the customer or, worse, takes money without granting access. Wire all of it:

1. **Pricing page** — clear tiers, one recommended plan, honest limits. CTA per tier.
2. **Upgrade prompts** — in-app, at the moment a free/limited user hits the ceiling. Context beats a generic "Upgrade" button.
3. **Checkout** — create a Checkout Session server-side; redirect the user to Stripe.
4. **Success / cancel states** — dedicated `success` and `cancel` return URLs. Success confirms + provisions; cancel returns gracefully without guilt-tripping. **Never grant access on the success redirect alone** — that's the webhook's job (see below).
5. **Billing portal** — a "Manage billing" link that opens the Stripe portal session.
6. **Entitlement checks** — a single source of truth (e.g. a `subscription_status` / `plan` field) the app reads on every gated action. Don't scatter plan logic.
7. **Webhook handling with signature verification** — the system of record for what the customer actually paid for (next section).
8. **Refund / cancellation policy copy** — written, linked from pricing and checkout. Set expectations *before* the dispute.

### Webhook signature verification — the #1 recurring gap

**This is the single most common monetization bug.** Treat it as a hard requirement, not a nice-to-have.

- **Always verify the `Stripe-Signature` header** using `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. An unverified endpoint lets anyone forge a "payment succeeded" event and unlock your product for free.
- **Use the raw request body** for verification — body-parsing middleware that mutates it breaks the signature. (Common Next.js/Express footgun: disable JSON parsing on the webhook route.)
- **The webhook is the source of truth** for provisioning. Listen for the relevant events — e.g. `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` — and update entitlements there, **not** on the browser redirect.
- **Make handlers idempotent** — Stripe retries; process each event id once.
- **Return 2xx fast**; do slow work async so Stripe doesn't retry on timeout.
- **Keep the webhook signing secret in env**, never in client code or the repo.

> Checklist gate: a Stripe integration is **not** considered launch-ready until the webhook endpoint verifies signatures, reads the raw body, and provisions entitlements server-side. If it grants access on the success redirect, flag it.

## Pricing-hypothesis + test-plan template

Pricing is a hypothesis, not a guess to defend forever. `/lastmile` writes one of these per pricing decision into `last-mile/LAUNCH_PLAN.md`:

```
PRICING HYPOTHESIS — <product / plan>
Date: <YYYY-MM-DD>

Hypothesis:
  We believe <segment> will pay <price/model> because <value / willingness signal>.

Price points to test:
  - A: <e.g. $19/mo>
  - B: <e.g. $29/mo>   (anchor / alternate)
  - (optional C: <annual or higher tier>)

Primary metric:
  <the ONE number that decides it — e.g. paid-conversion %, MRR, trial→paid %>

Guardrail metrics (don't win at their expense):
  <e.g. refund rate, churn, signup→activation>

Test window:
  <duration OR sample size — whichever comes first>

Kill / continue criteria (decide BEFORE running):
  CONTINUE if  <metric> >= <threshold>
  KILL/ITERATE if <metric> <  <threshold>  → next move: <lower price / change packaging / new segment>

Decision owner: <founder>
```

**Rules:** state the kill/continue thresholds *before* the test starts (no moving goalposts). Change **one** variable at a time. Don't A/B test prices to existing paying customers without care — grandfather them. Pick the metric that maps to revenue, not vanity (signups are not revenue).

## Test-mode-before-live — hard rule

Money is irreversible; this gate is non-negotiable.

- **All Stripe work happens in test mode first.** Use test API keys and Stripe's test cards to drive the full funnel: checkout → success → webhook fires → entitlement granted → billing portal → cancel/refund.
- **Verify the webhook end-to-end in test mode** (e.g. with the Stripe CLI `listen`/`trigger`) and confirm signature verification rejects a tampered payload.
- **Switching to live mode is a human-approval gate.** `/lastmile` never flips live keys, publishes live Payment Links, or issues a "go live" instruction autonomously. It prepares everything in test mode, then **surfaces a checklist for the founder to approve** at the ⛔ `stripe-live` gate (payments touch real money).
- **Live-mode preconditions** `/lastmile` confirms before recommending the switch: signatures verified, entitlements provisioned server-side, success/cancel pages live, billing portal wired, refund/cancellation copy published, spend/usage caps set (for usage- or credit-based models).

> One-line contract: **green in test mode + founder approval ⇒ go live.** Anything less stays in test mode.
