---
guide: PAYMENTS
anchor: lastmile:module/payments
shape: walkthrough
timing: at-module
lead_time: "Stripe identity + bank verification before live payments: hours-days"
---

# PAYMENTS_GUIDE.md — Taking Money in Your App, for Total Newbies

> **Who this is for:** You built an app (or are about to) and you want it to **make money** — charge for a subscription, a one-time purchase, or usage. You have little or no technical background. This guide walks you through it in plain language, from zero.
>
> **How to read this:** Top to bottom the first time. Each part is self-contained, so later you can jump straight to the one you need.
>
> **Read first:** the shared [`README.md`](./README.md) in this folder explains the day-zero rule (start the slow human/bureaucratic steps the moment you begin building) and the split between *what only you, a human, can do* vs *what your AI assistant does*. This guide does **not** repeat that — it assumes you've read it. Payments has its own slow human steps, flagged below.

---

## 0. ELI5 — what a "payment processor" actually does

When a customer pays you, their **card number** is the most dangerous data on the internet. If it touches your server, you inherit a mountain of legal/security rules called **PCI compliance** — audits, scans, liability. You do not want that.

A **payment processor** (Stripe, Paddle, etc.) is a company whose entire job is to handle card numbers *for* you. The flow:

1. Your app sends the customer to the processor's secure page (or shows the processor's secure card box).
2. The customer types their card **into the processor**, never into your app.
3. The processor charges the card, takes a small cut (~2.9% + 30¢ is typical), and tells your server *"this person paid."*
4. Your app reads that "they paid" signal and unlocks the paid features.

> 🧒 *Newbie note:* Think of the processor as a **cashier you hire**. The customer hands their card to the cashier, not to you. You only ever hear *"customer #4821 paid for the Pro plan."* You never see, store, or touch the card number. Because the card never touches your code, your PCI burden shrinks to almost nothing (the lightest tier, "SAQ A").

**The golden rule of this whole guide:** you store a **customer id** and a **subscription/plan status** — never card data. The processor holds the card. (More in §10.)

---

## 1. Which processor? Stripe by default

| | **Stripe** *(default)* | **Paddle / Lemon Squeezy** |
|---|---|---|
| What it is | A payment processor — you are the merchant | A **merchant of record (MoR)** — *they* are the legal seller |
| Best docs / vibe-coder friendly | **Yes — the best** | Good, simpler but less flexible |
| Who handles **sales tax / VAT** | You (Stripe Tax can *calculate & collect*, but you remit) | **They do — fully.** They charge, collect, and remit tax worldwide for you |
| Fees | Lower (~2.9% + 30¢) | Higher (they bake tax handling into a bigger cut, ~5%+) |
| Control / flexibility | High | Lower (you live inside their checkout) |
| Best for | Most apps; anyone who wants control + the smoothest AI-assisted build | Solo devs selling globally who never want to think about tax |

**Default to Stripe** in this guide for web apps, desktop apps, physical goods, real-world services, and outside-app checkout: it has the best documentation, the friendliest tooling for AI-assisted ("vibe") coding, and the widest support.

**Mobile app exception:** if an iOS or Android app sells digital goods, subscriptions, feature unlocks, credits, coins, or premium access that are consumed inside the app, default to the platform billing path instead: **Apple In-App Purchase / StoreKit** on iOS and **Google Play Billing** on Android. Do **not** build embedded Stripe checkout for in-app digital goods unless a region-specific external-payment rule has been checked by a human for the exact storefront and date. Stripe is still fine for physical goods, real-world services, and confirmed outside-app/web-only purchase paths.

**The one real reason to pick a merchant-of-record instead:** **tax.** A merchant of record (Paddle, Lemon Squeezy) becomes the legal seller, so *they* are responsible for collecting and remitting sales tax / VAT in every country — a genuine headache they make disappear. The trade-off: higher fees, less control, and you're inside their box. If selling worldwide and never touching a tax form is worth a few extra percent to you, choose an MoR. Otherwise, Stripe.

> 🧒 *Newbie note:* "Merchant of record" just means *whose name is legally on the receipt.* With Stripe, it's **you** — so taxes are your job. With Paddle/Lemon Squeezy, it's **them** — so taxes are theirs. The rest of this guide is written for Stripe; the *concepts* (checkout, webhooks, entitlements) apply to any processor.

---

## 2. 🔴 Account setup has lead time — start it early

Just like the app-store and dev-account signups in the [README day-zero rule](./README.md), **taking *live* (real-money) payments requires a verified account, and verification is a human review queue you cannot speed up.**

To accept live payments, **🔴 YOU MUST** (the processor verifies *your* identity, *your* business, *your* bank — the AI cannot):

1. **Create the Stripe account** at https://dashboard.stripe.com/register (your email, your business).
2. **Verify your identity** — name, sometimes a government photo ID.
3. **Provide business details** — sole trader vs company, address, tax id where required.
4. **Connect a bank account** — where your payouts land. Stripe verifies it.

Until this clears, you can build everything in **test mode** (§5), but **no real money moves.** Verification can take from minutes to several days depending on country and business type, and payouts often have an initial hold.

> ### ⏱️ Treat this as a day-zero task
> Per the README: kick off Stripe signup + identity/bank verification **the moment you start building**, and let that clock run in the background while your assistant wires the code in test mode. Do **not** discover the verification queue during launch week. The setup clicks are short; the **waiting is the real cost** — start the waiting early.

---

## 3. Pricing models — pick one before you build

Decide *how* you charge before wiring anything; it shapes the whole integration.

| Model | What it means | Use it when… | Watch out for |
|---|---|---|---|
| **One-time** | Pay once, own it | Single product, lifetime deal, digital download | No recurring revenue; you re-sell constantly |
| **Subscription** | Recurring (monthly/yearly) | SaaS, content, anything ongoing | You must handle renewals, cancels, failed payments (§9) |
| **Freemium / free trial** | Free tier or N-day trial, then pay | You want low-friction signups, prove value first | Define exactly what's gated; trials need a card-or-not decision |
| **Usage-based / metered** | Pay per unit (API calls, GB, seats) | Cost scales with use; infra/API products | Hardest to build — you must meter and report usage to Stripe |
| **Credits / prepaid** | Buy a bundle, spend it down | Pay-as-you-go without a meter; gift-card feel | You track the balance in *your* database (see [`DATABASE_GUIDE.md`](./DATABASE_GUIDE.md)) |

> 🧒 *Newbie note:* For a first launch, **subscription** (with an optional free trial) or **one-time** is by far the simplest. Save usage-based and credits for later — they need real metering logic. Annual + monthly is just two prices on the same product.

---

## 4. Build the *funnel*, not just a checkout button

A common beginner mistake is wiring only "the pay button." A working money flow is a **funnel** — six pieces:

```
  Pricing page  →  Stripe Checkout  →  Success / Cancel pages
       │                                        │
       │                                        ▼
       │                              Webhook (server) ──► update DB: "user is PAID"
       ▼                                        │
  Billing Portal  ◄── "Manage plan" link        ▼
  (user cancels / upgrades)              Entitlement check ("is this user paid?")
```

1. **Pricing page** — your plans, prices, a "Subscribe" / "Buy" button. (🤖)
2. **Stripe Checkout** — Stripe's *hosted* payment page. Easiest, most secure, handles cards/Apple Pay/Google Pay/SCA for you. (🤖)
3. **Success & Cancel pages** — where Stripe sends the user back. (🤖)
4. **Customer Billing Portal** — Stripe's hosted page where users update card, view invoices, **cancel** themselves. (🤖 to link; 🔴 you toggle features in the dashboard)
5. **Entitlement check** — your code asking *"is this user paid? which plan?"* before showing paid features. (🤖)
6. **Webhooks** — Stripe telling your server who paid, who cancelled, whose card failed. **This is the heart of correctness — see §6.** (🤖)

> 🧒 *Newbie note:* **Stripe Checkout** is the redirect-to-a-Stripe-page option — the simplest and what you should use first. (Stripe also offers "Elements," card fields embedded in your own page — more control, more work, more PCI surface. Skip it for a first launch.)

**🤖 AI CAN DO THIS:** Tell your assistant *"build a Stripe Checkout subscription funnel: pricing page, checkout session, success/cancel pages, the webhook handler, an entitlement check, and a billing-portal link."* It writes all the code. You do the dashboard clicks and paste the keys.

---

## 5. Test mode vs Live mode — the hard gate 🔴

Stripe has **two completely separate worlds**, toggled in the dashboard:

| | **Test mode** | **Live mode** |
|---|---|---|
| Money | **Fake** — nothing is charged | **Real** — actual cards, actual payouts |
| Keys | `pk_test_…` / `sk_test_…` | `pk_live_…` / `sk_live_…` |
| Cards | Magic test cards (below) | Real customer cards |
| When | While you build & verify everything | Only after it all works + your account is verified |

**Build and verify the entire funnel in TEST MODE first.** Use Stripe's magic test card:

```
Card number:  4242 4242 4242 4242
Expiry:       any future date  (e.g. 12 / 34)
CVC:          any 3 digits     (e.g. 123)
ZIP:          any              (e.g. 42424)
```

Other useful test cards: `4000 0025 0000 3155` triggers a 3DS/SCA prompt (§9); `4000 0000 0000 9995` simulates a declined card. (Full list in Stripe's docs — see §11.)

**Flipping to LIVE is a deliberate 🔴 action only you take** — a human decision you make once everything passes in test mode:

1. Confirm the funnel works end to end with test card `4242…`.
2. Confirm your account is fully verified (§2) and bank is connected.
3. Toggle the dashboard to **Live mode**, recreate your products/prices there (test and live data are separate), and swap your app's env vars to the **live keys**.
4. Do one small real charge yourself, then refund it, to confirm money truly moves.

> 🧒 *Newbie note:* Test and Live are like two parallel buildings. Products, prices, customers, and webhook endpoints you create in one **do not exist** in the other. When you go live you re-create the products and re-register the webhook in the Live building.

> **🔴 NEVER:** ship **test keys to production** (customers can't really pay) or commit **live keys to a git repo** (anyone who finds them can charge cards / drain your account). Keys live in environment variables / your host's secret store, never in code, never in git. See [`DEV_SETUP_GUIDE.md`](./DEV_SETUP_GUIDE.md)'s golden rule: a secret in a repo is a leaked secret.

---

## 6. Webhooks — the #1 correctness *and* security gotcha

This is the single most important technical section. Read it twice.

**The trap:** after paying, Stripe redirects the user back to your `success` page. It is *tempting* to write: *"they're on the success page → mark them paid."* **This is wrong and dangerous.** The success URL is just a web address — a user (or attacker) can type it into their browser **without paying** and unlock your paid features for free. The client redirect is **spoofable**. Never grant access based on it.

**The correct way — webhooks:** a **webhook** is Stripe's server phoning *your* server directly, behind the scenes, to say *"event happened: customer #4821 completed checkout / their invoice paid / they cancelled."* Because it's server-to-server and **cryptographically signed**, it can't be faked. **Entitlements (who is paid) MUST be driven by signature-verified webhooks, server-side — never by the client redirect.**

**What your webhook handler must do (🤖 the assistant writes this):**

1. **Receive the raw request body** from Stripe at your endpoint (e.g. `/api/stripe/webhook`).
2. **Verify the Stripe signature** using your **webhook signing secret** (`whsec_…`). Stripe's library does this: `stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)`. **If verification fails, reject the request (HTTP 400) and do nothing** — that's a forged or tampered event.
3. **Read the event type** and update the user's plan in **your database**:
   - `checkout.session.completed` → first payment done; mark the user **paid**, store their Stripe **customer id** and **subscription id**.
   - `invoice.paid` → a (recurring) subscription payment succeeded; keep them **active**. *(For SaaS, this is the main ongoing event.)*
   - `invoice.payment_failed` → a renewal failed; start dunning / warn the user (§9).
   - `customer.subscription.deleted` / `…updated` (cancelled or expired) → revoke access at period end.
4. **Be idempotent.** Stripe may deliver the same event more than once. Store each processed `event.id` and skip ones you've already handled, so you don't double-grant or double-email.
5. **Return HTTP 200 quickly.** If you don't, Stripe retries (which is good — but do the slow work after acknowledging, or keep it fast).

> 🧒 *Newbie note:* The mental model: **Checkout** collects the money; the **webhook** is the *only trustworthy messenger* that tells your app the money arrived. Your database's "is this user paid?" flag should change **only** when a verified webhook says so. Where to store that flag and the customer id → [`DATABASE_GUIDE.md`](./DATABASE_GUIDE.md).

> **🔴 YOU MUST DO THIS:** In the Stripe Dashboard → **Developers → Webhooks**, add your endpoint URL and pick the events above. Stripe gives you the **signing secret** (`whsec_…`) — copy it into your app's env vars so the handler can verify signatures. (Locally, the **Stripe CLI** `stripe listen --forward-to localhost:3000/api/stripe/webhook` gives you a test secret and replays events.) Do this once for **test** and again for **live**.

---

## 7. Entitlements — "is this user allowed in?"

An **entitlement** is just your app answering *"does this logged-in user have an active paid plan / enough credits?"* before it shows a paid feature.

- Your database has a field per user like `plan: "pro"` and `status: "active"` (or `until: <date>`), set **only by verified webhooks** (§6).
- Every protected page/API checks it: *if not active → show the paywall / upsell, don't run the feature.*
- This check lives **server-side** (a logged-in user can't be trusted to self-report their plan any more than the success page could).

> **🤖 AI CAN DO THIS:** *"Add an entitlement gate: server-side, read the user's plan from the DB, block paid routes if they're not active, and redirect to pricing."*

---

## 8. The Customer Billing Portal — let users help themselves 🤖

Stripe's **Customer Billing Portal** is a Stripe-hosted page where your users can, on their own: update their card, see invoices/receipts, switch plans, and **cancel** their subscription. You give them a **"Manage billing"** link that opens it; Stripe handles the rest and fires the matching webhooks (§6) so your DB stays in sync.

- **🤖** Your assistant adds a "Manage billing" button that creates a portal session for the logged-in customer and redirects there.
- **🔴** You enable/configure what the portal allows (cancel, switch plan, retention coupon to deflect cancellations) in **Dashboard → Settings → Billing → Customer portal**. Cancellation is on by default.

> 🧒 *Newbie note:* Skipping the portal is a classic beginner mistake — every "please cancel my plan" / "send me an invoice" then becomes a support email **you** answer by hand. The portal makes that self-serve for free.

---

## 9. The messy real-world bits (don't skip)

- **Failed payments / dunning.** Cards expire and renewals fail. Stripe **Smart Retries / dunning** automatically retries and emails the customer to update their card. Turn it on in **Settings → Billing → Subscriptions and emails**. Your `invoice.payment_failed` webhook (§6) is where you flag the account "past due" and nudge them.
- **Refunds.** Issue from the Dashboard (or API). Decide a refund policy up front and put it in your terms.
- **Cancellation policy copy.** Write clearly in your app/terms: *do they keep access until period end, or immediately?* (Stripe supports both.) Users cancel themselves via the portal (§8); the `customer.subscription.deleted/updated` webhook tells your app when access ends.
- **SCA / 3DS (European "Strong Customer Authentication").** EU rules require an extra "is this really you?" step (a bank prompt) on many card payments. **Stripe Checkout handles this for you automatically** — one more reason to use hosted Checkout instead of building your own card form. Test it with card `4000 0025 0000 3155`.

> 🧒 *Newbie note:* You do not build 3DS, retries, or the cancel flow from scratch — Checkout, the portal, and Stripe's dunning do the heavy lifting. Your job is to flip the right switches in the dashboard and react to the webhooks.

---

## 10. Tax — your responsibility 🔴

**With Stripe, you are the merchant of record, so collecting and remitting sales tax / VAT / GST is *your* legal responsibility.** Stripe **Tax** can *automatically calculate and collect* the right tax at checkout based on the customer's location — but **you still file and remit** it to the tax authorities (or use a service for that). Turn it on in **Settings → Tax** and add it to your Checkout sessions.

If you'd rather **never** deal with tax at all, that's the case for a **merchant of record** (Paddle / Lemon Squeezy, §1) — they become the legal seller and handle tax end to end, for a higher fee.

> 🧒 *Newbie note:* "Stripe handles tax" means *calculates and collects* — not *files for you*. Don't assume the money sitting in your account is all yours; some of it is tax you owe. When in doubt, talk to an accountant about your thresholds.

---

## 11. Don't store card data — what you *do* store

Stripe holds the card. Your app stores only **pointers and status**:

| Store this in your DB | Never store this |
|---|---|
| Stripe **customer id** (`cus_…`) | Card number |
| Stripe **subscription id** (`sub_…`) | CVC / security code |
| **Plan** + **status** (`active` / `past_due` / `canceled`) + renewal date | Expiry date |
| **Processed webhook event ids** (for idempotency) | Full magnetic-stripe data |

Because card data never touches your servers (Checkout/portal hold it), your PCI burden is the lightest tier. Tying the Stripe customer id to your user record lives in [`DATABASE_GUIDE.md`](./DATABASE_GUIDE.md).

**Privacy / GDPR:** Stripe processes your customers' personal + payment data, so you have a **Data Processing Agreement (DPA)** relationship with Stripe, and you must disclose what you collect/store (the customer id + status above) in your privacy policy. Details, the DPA, and the "what do I actually store and disclose" checklist are in [`PRIVACY_GDPR_GUIDE.md`](./PRIVACY_GDPR_GUIDE.md).

---

## 12. Who does what — the split

| Step | Who | Why |
|---|---|---|
| Create the Stripe account | **🔴 YOU** | Your business, your identity |
| Verify identity + business + bank | **🔴 YOU** | It's a check that *you* are real |
| Create **products & prices** in the dashboard | **🔴 YOU** | Business decision — what costs what |
| Add the **webhook endpoint** + copy the **signing secret** (`whsec_…`) | **🔴 YOU** | The secret comes from your account |
| Configure the **Customer Portal** (allow cancel, etc.) | **🔴 YOU** | Policy decision |
| Turn on **Stripe Tax** / pick a merchant of record | **🔴 YOU** | Legal/tax decision |
| **Flip from Test → Live** + swap to live keys | **🔴 YOU** | Deliberate go-live action |
| Build the **pricing page** | 🤖 AI | Normal coding |
| Create the **Checkout session** | 🤖 AI | Normal coding |
| Build **success / cancel** pages | 🤖 AI | Normal coding |
| Write the **webhook handler** *with signature verification* | 🤖 AI | Normal coding |
| Build the **entitlement gate** | 🤖 AI | Normal coding |
| Add the **Billing Portal** link | 🤖 AI | Normal coding |

> 🧒 *Newbie note:* You hand the assistant the **price ids** and tell it your model (subscription vs one-time); it writes the funnel. You keep the keys, secrets, and the live-mode switch in your own hands.

---

## 13. Gotchas (the things that bite beginners)

- **Trusting the client redirect.** Granting access because the user reached the success page → spoofable → free access for anyone. **Entitlements come from webhooks only.** (§6)
- **No webhook signature verification.** An endpoint that doesn't verify the Stripe signature will believe **forged** "they paid" events. Always `constructEvent` with your `whsec_…` and reject failures. (§6)
- **Test keys in production / live keys in git.** Customers can't pay (test), or your account gets drained (leaked live keys). Keys go in env vars / secret stores, never in the repo. (§5)
- **Not handling cancel/expire.** If you only listen for "paid" and ignore `subscription.deleted/updated` and `payment_failed`, cancelled users keep paid access forever. Handle the *end* of the lifecycle too. (§6, §9)
- **No Billing Portal.** Every cancel/invoice request becomes a manual support email. Ship the portal. (§8)
- **Forgetting tax.** With Stripe you owe the tax even if you didn't collect it. Turn on Stripe Tax or use a merchant of record. (§10)
- **Forgetting test↔live are separate.** Products, prices, and webhook endpoints created in test mode don't exist in live mode — recreate them when you go live. (§5)
- **Not idempotent.** Stripe re-delivers events; without storing handled `event.id`s you'll double-grant or double-email. (§6)

---

## 14. Launch checklist

Copy into your project tracker.

```
ACCOUNT (start day-zero — verification has lead time)
[ ] Stripe account created
[ ] Identity + business verified
[ ] Bank account connected (payouts)

PRICING
[ ] Pricing model chosen (one-time / subscription / freemium / usage / credits)
[ ] Products + prices created in TEST mode

FUNNEL (all built + verified in TEST mode)
[ ] Pricing page
[ ] Stripe Checkout session
[ ] Success + Cancel pages
[ ] Webhook endpoint registered, signing secret (whsec_) in env vars
[ ] Webhook handler verifies signature + is idempotent
[ ] Webhook updates DB: paid / past_due / canceled
[ ] Entitlement gate blocks paid features server-side
[ ] Billing Portal link + portal configured (cancel allowed)
[ ] Tested with card 4242 4242 4242 4242 (and 3DS / declined cards)

TAX & POLICY
[ ] Stripe Tax on (or merchant-of-record chosen)
[ ] Refund + cancellation policy written into terms
[ ] Privacy policy lists Stripe + what you store (see PRIVACY_GDPR_GUIDE)

GO LIVE (deliberate 🔴 action)
[ ] Account fully verified
[ ] Products/prices recreated in LIVE mode
[ ] Live webhook endpoint registered (new whsec_)
[ ] App env vars swapped to pk_live_ / sk_live_
[ ] One real charge made + refunded to confirm money moves
```

---

## 15. Plain-English glossary

- **Payment processor** — a company (Stripe) that handles card numbers so you don't have to.
- **Merchant of record (MoR)** — *whose name is legally on the receipt.* With Stripe it's you (you owe tax); with Paddle/Lemon Squeezy it's them (they handle tax).
- **PCI compliance** — the security rules for handling card data. Using hosted Checkout keeps your burden tiny.
- **Stripe Checkout** — Stripe's hosted payment page you redirect users to. The easiest, most secure option.
- **Customer Billing Portal** — Stripe-hosted page where users manage/cancel their own subscription.
- **Webhook** — a server-to-server message from Stripe ("they paid", "they cancelled"). The *only* trustworthy source of who's paid.
- **Webhook signing secret (`whsec_…`)** — the key your server uses to verify a webhook really came from Stripe.
- **Entitlement** — your app's check of *"is this user paid / which plan?"* before showing paid features.
- **Test mode / Live mode** — fake-money vs real-money worlds, with separate keys, products, and webhooks.
- **Publishable / Secret key (`pk_…` / `sk_…`)** — your app's keys. The secret is sensitive — never commit it.
- **Dunning** — automatic retries + reminder emails when a renewal payment fails.
- **SCA / 3DS** — Europe's "is this really you?" bank step; Stripe Checkout handles it.
- **Customer id (`cus_…`) / Subscription id (`sub_…`)** — Stripe's pointers you store instead of card data.

---

## 16. Official sources (always check these — rules and fees change)

- Stripe — How Checkout works: https://docs.stripe.com/payments/checkout/how-checkout-works
- Stripe — Build a subscriptions integration with Checkout: https://docs.stripe.com/payments/checkout/build-subscriptions
- Stripe — Fulfill orders (process `checkout.session.completed`, idempotency): https://docs.stripe.com/checkout/fulfillment
- Stripe — Using webhooks with subscriptions: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe — Webhooks overview & signature verification: https://docs.stripe.com/webhooks
- Stripe — Customer portal (let customers manage/cancel): https://docs.stripe.com/customer-management
- Stripe — Cancel subscriptions: https://docs.stripe.com/billing/subscriptions/cancel
- Stripe — Stripe Tax: https://docs.stripe.com/tax
- Stripe — Testing & test cards: https://docs.stripe.com/testing
- Stripe — Pricing: https://stripe.com/pricing
- Apple — App Store Review Guidelines (In-App Purchase): https://developer.apple.com/app-store/review/guidelines/
- Apple — In-App Purchase / StoreKit: https://developer.apple.com/in-app-purchase/
- Google Play — Payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- Google Play — Billing system: https://support.google.com/googleplay/android-developer/answer/1072599
- Paddle (merchant of record): https://www.paddle.com
- Lemon Squeezy (merchant of record): https://www.lemonsqueezy.com

---

*This guide is part of the lastmile launch guides (`.claude/lastmile/guides/`) — a reusable, plain-language launch playbook for newbie vibe coders. Last reviewed: 2026-05. Processor policies, fees, and tax rules change; the official sources above are the source of truth.*
