---
guide: SUBSCRIPTION_CANCELLATION
anchor: lastmile:module/payments
shape: walkthrough
timing: at-module
lead_time: "none (ship the cancel path WITH the subscribe path — ROSCA + state ARLs bind from the FIRST auto-renewing charge)"
---

# SUBSCRIPTION_CANCELLATION_GUIDE.md — Building the Cancel Button (Without Getting Sued) (for Total Newbies)

> You added a subscription. The moment you take the *first* auto-renewing charge, you've also taken on a legal duty: people have to be able to **get out** as easily as they got in. The cancel button isn't a nice-to-have you bolt on later — it's a legal requirement wearing a UX costume, and it ships *with* the subscribe button, not after it.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split and the day-zero rule. This guide is the **build walkthrough for the cancel path** — the flow, the entitlements, the ops. The *law* behind it lives in `LEGAL_GUIDE.md` §3 and the *billing wiring* lives in `PAYMENTS_GUIDE.md`; this guide points at both and does not repeat them.

---

## 1. ELI5 — the cancel button is a legal requirement in a UX costume

Imagine a gym that lets you sign up online in thirty seconds but only lets you quit by driving down on a weekday, finding the one manager who handles cancellations, and sitting through a "but don't you want to stay?" speech. That's illegal in a growing list of places, and it's exactly the trap these laws were written to kill.

The one rule that survives every version of every subscription law, in one sentence:

> **Cancelling must be as easy as subscribing — and in the same medium.** If they subscribed with about two clicks on the web, they cancel with about two clicks on the web. No phone calls. No "chat with our retention team." No cancel button hidden three menus deep. No mandatory gauntlet of "are you sure" screens.

That's the whole spirit of it. Everything technical in this guide is just *how you build that truthfully* across the two worlds where subscriptions actually live: **web billing (Stripe)** and **mobile in-app purchases (Apple / Google)** — which work completely differently and need different cancel paths.

> **Why this can't wait:** the duty attaches at the **first auto-renewing charge**, not at "launch" or "when we get big." `ROSCA` (US federal) and state auto-renewal laws bind from charge one. So you build the cancel path **at the same time** as the subscribe path. A subscribe flow shipped without a matching cancel path is shipping a violation. (The precise legal picture — including why the federal "click-to-cancel" rule is currently *vacated* but you must **not** relax — is in `LEGAL_GUIDE.md` §3. Read it; it's short and it's the part people get wrong.)

---

## 2. The two plumbing worlds (they are NOT the same)

Where you bill decides who owns the cancel button. Get this distinction wrong and you'll either build a cancel flow that's illegal (web) or one that fights the platform and gets you rejected (mobile).

| | **Web / Stripe** | **Mobile in-app purchase (Apple / Google)** |
|---|---|---|
| Who owns cancellation | **You do.** There's no native cancel — you build it. | **Apple / Google do.** The OS owns the cancel screen. |
| Your job | Build a real "Cancel subscription" path that ends the renewal | Build a "Manage subscription" link that **deep-links to the platform's** cancel screen + handle their server notifications |
| The mistake to avoid | No cancel path at all (a ROSCA + state-ARL violation) | Building your *own* custom cancel flow that obstructs the native one (Apple/Google reject this) |

### Web / Stripe — you build the cancel path

Two ways, easiest first:

1. **The Stripe Customer Portal (start here).** Stripe hosts a "manage billing" page where the user can update their card, see invoices, **and cancel themselves**. You add a "Manage subscription" button that opens a portal session; Stripe does the rest and fires the webhook that updates your access flags. This is the lowest-effort *correct* answer and it's already covered as the Billing Portal in `PAYMENTS_GUIDE.md` §8 — use it. *(Confirmed: cancellation is on by default in the portal; you toggle what else it allows in the Stripe dashboard.)*
2. **An in-app cancel button calling the API.** If you want the cancel button to live inside *your* UI (more control, more work), your button calls the Stripe API to end the subscription. The key choice is **when** access ends:
   - `cancel_at_period_end = true` → they keep what they paid for until the period runs out, then it stops renewing. **This is the right default** (see §3).
   - cancel *immediately* → access ends now. Only do this if that's genuinely what you sold, and ideally with a refund.

Either way, the cancel doesn't directly flip your app's "is this user paid?" flag. Stripe sends a **signed webhook** (`customer.subscription.updated` / `customer.subscription.deleted`) and *that* updates your access — same server-to-server trust model as the rest of payments (`PAYMENTS_GUIDE.md` §6). Never flip access straight from the button click.

### Mobile IAP — Apple and Google OWN the cancellation

On iOS and Android in-app subscriptions, **you cannot cancel the subscription from inside your app, and you must not try.** The platform owns it:

- Your job is a **"Manage subscription" affordance** that **deep-links** to the platform's subscription screen — `https://apps.apple.com/account/subscriptions` on iOS, `https://play.google.com/store/account/subscriptions` (optionally with your package + product) on Android. The user cancels *there*.
- The platform then tells your server via **server notifications** — Apple's **App Store Server Notifications V2** and Google's **Real-time Developer Notifications (RTDN)**. You handle those so your entitlements follow the cancellation (access flips at the right time).
- **Never build a custom in-app cancel flow that obstructs the native one.** A "to cancel, call us / chat with us / fill this survey" wall in front of the platform's own cancel is both an App Store rejection *and* the exact dark pattern the law forbids. Offer the deep-link, get out of the way.

> **The golden distinction:** **Web = you build the cancel. Mobile IAP = you build the *signpost* to Apple/Google's cancel.** Mixing these up is the #1 architecture mistake here.

---

## 3. Post-cancel honesty — access ends when you SAID it ends

A cancellation is a promise about the *future*, and the most common way to turn a legal cancel into an angry support ticket (or a deceptive-practice complaint) is to revoke access at the wrong moment.

**The default and fairest behavior: cancel-at-period-end.** If you sold "monthly, renews until you cancel," then cancelling means *"stop the next renewal"* — not *"cut me off right now."* The user keeps access until the **end of the period they already paid for**, then it stops. In code: the cancel sets `cancel_at_period_end`, and your entitlement flag flips to inactive at `current_period_end`, **not at the moment they clicked cancel**. Driving that flip from the webhook (`customer.subscription.updated`/`deleted`) is what keeps your access in sync.

- **No surprise immediate revocation.** Yanking access the instant someone cancels — when they've paid through the end of the month — feels like a punishment and reads like a dark pattern. Don't.
- **Say it plainly in the UI.** When they cancel, tell them: *"Your plan is cancelled. You'll keep Pro access until [date], then your account moves to the free plan."* Honesty here prevents most "you charged me / you cut me off early" tickets.

**Cancellation is not the same as a failed payment.** Two different lifecycle events people constantly confuse:

- **Cancellation** = the user *chose* to stop. Access continues to period end (above), then stops cleanly.
- **Failed payment (dunning)** = a renewal *tried* and the card was declined. The user did **not** ask to leave. The right move is to retry and email them to fix their card — **not** to instantly delete their account. Stripe's Smart Retries / dunning does the retrying and emailing for you; your `invoice.payment_failed` webhook marks the account "past due" and nudges them. (Full dunning setup is in `PAYMENTS_GUIDE.md` §9.) Treating a failed renewal like a cancellation churns people who *wanted to stay* and just had an expired card.

---

## 4. The flow UX that stays legal

The cancel flow has exactly one job: **let a person who wants to leave, leave** — quickly, in the same medium they joined. Around that core you may add a little friction, but only the *optional* kind. Here's the line.

**The one required thing:** an obvious **"Cancel subscription"** control in account/billing settings, reachable without a phone call, a support email, or a scavenger hunt. On mobile IAP, the equivalent is an obvious **"Manage subscription"** deep-link to the platform cancel screen. That's the part the law actually requires.

**What you MAY add (optional, skippable):**
- **One** "are you sure? here's what you'll lose" confirmation step. A *single* clear confirmation is fine. A *mandatory multi-step retention gauntlet* is not.
- A **pause** or **downgrade** offer — you may *offer* it, but it can **never** be a required stop on the way out. "Cancel" must remain a one-tap path past it.
- A **cancellation-reason survey** — must be **optional and skippable**. "Tell us why (or skip)" is fine; "you must pick a reason to proceed" is not.
- A **win-back coupon** ("stay for 50% off") — offer it once, accept "no thanks" gracefully, let them through.

**What makes it ILLEGAL (the dark patterns to never ship):**
- Cancel only via phone/email/chat when signup was self-serve web (the "roach motel").
- A cancel button that's hidden, greyed, disguised, or buried where subscribe was loud and obvious (asymmetric prominence).
- A **mandatory** retention gauntlet, survey, or "talk to us" wall you can't click past.
- A pre-checked auto-renewal box, or any flow where leaving is meaningfully harder than joining.

> **The test, every time:** count the taps to subscribe, then count the taps to cancel. If cancel is materially harder — more screens, a different medium, a human you have to talk to — you've built a violation. *Cancel ≤ subscribe, same medium.* (The legal authorities behind this — ROSCA, California's ARL, FTC §5, other state ARLs — are laid out in `LEGAL_GUIDE.md` §3. This guide is the build; that's the law.)

---

## 5. The before-the-charge half (what makes cancel-time painless)

Most "cancellation" pain is actually a *signup* problem. If you disclosed clearly and got clean consent up front, cancellation is calm; if you sneaked the charge in, every cancel is a fight (and a complaint risk). Build these at subscribe-time and the cancel half takes care of itself:

1. **Clear price + period + auto-renew disclosure, right next to the subscribe button.** Not buried in a linked Terms of Service — *adjacent* to the button: *"$9.99/month, renews monthly until you cancel. Cancel anytime in Settings."* The user should see exactly what they're agreeing to **before** they tap.
2. **A separate auto-renew consent.** California's ARL wants the agreement to **auto-renewing billing** to be **distinct** from the agreement to use the service — not one bundled "I agree to everything" checkbox. So: one consent for the product, a separate, clearly-labelled acknowledgement of the auto-renewing charge. *(Legal detail — exact wording is a lawyer's call; `LEGAL_GUIDE.md` §3 flags this. 🔴)*
3. **Trial-conversion disclosure + a pre-conversion reminder.** If there's a free trial, say *before* it starts: *"Free for 7 days, then $49/year. Cancel anytime before [date] and you won't be charged."* Then send a **reminder email a day or two before the trial converts.** The reminder is cheap goodwill *and* legally smart — a silent trial-to-paid charge is the classic violation, and a heads-up email kills most chargebacks.
4. **Keep the consent records.** When someone consents to auto-renewal, store the proof — what they agreed to, when, which version. *(Legal detail: California's ARL wants consent records kept **~3 years**. Flag this to a human / your records system; it's an operational obligation, not something the code "passes" on its own. 🔴)*

> **The cause-and-effect to internalize:** painful cancellations are usually *unclear subscriptions* coming home to roost. Disclose honestly and consent cleanly up front, and the cancel button is just a button.

---

## 6. Ops — the running obligations (some are 🔴 human, not code)

A few duties don't live in the cancel button itself — they're things you *operate* over the life of the subscription. Wire what you can; flag the rest to a human, because a green checkbox in code does **not** prove these are happening.

- **The annual-renewal reminder (long plans).** California's ARL requires a periodic reminder (annual for many terms) that the subscription is ongoing and how to cancel. The *sending* can be automated, but **🔴 the founder must confirm it's actually going out** on schedule — a reminder that's "implemented" but silently not sending is the failure mode. Treat this as a human-confirmed obligation, not a code-passes.
- **Win-back emails only with marketing consent.** After someone cancels, emailing them "come back, here's a deal" is **marketing** — it needs a recorded marketing opt-in, not just the fact that they were once a customer. (The marketing-vs-transactional consent line is the same one in `PRIVACY_GDPR_GUIDE.md` and `PUSH_NOTIFICATIONS_GUIDE.md` §7 — a cancellation *confirmation* is transactional and fine to send; a "we miss you, 50% off" is marketing and needs consent.)
- **A plainly-stated refund-on-cancel policy.** Decide up front and write it in your terms: on cancel, do they get a prorated refund, or do they just keep access to period end (no refund)? Either is fine — *state which.* **For mobile IAP, refunds are owned by Apple/Google**, not you: an iOS/Android user requests a refund from the platform, and you handle the resulting refund/revocation server notification. So your refund policy copy must distinguish "web purchases (we refund per this policy)" from "App Store / Play purchases (refunds are handled by Apple/Google)."

---

## 7. Done-when checklist

```
SUBSCRIPTION CANCELLATION — MINIMUM VIABLE
WEB / STRIPE
[ ] A visible "Cancel subscription" path exists in account/billing settings (NOT email/phone-only)
[ ] Cancel uses the Stripe Customer Portal OR an in-app button calling the API
[ ] Default is cancel-at-period-end (access ends at current_period_end, not at click)
[ ] Access flips ONLY via the signed webhook (subscription.updated / .deleted), never the button
[ ] Failed renewals go to dunning/past-due — NOT treated as a cancellation

MOBILE IAP (if applicable)
[ ] A "Manage subscription" affordance deep-links to the Apple/Google cancel screen
[ ] NO custom in-app cancel flow that obstructs the native one
[ ] Apple App Store Server Notifications V2 / Google RTDN handled → entitlements follow

THE FLOW STAYS LEGAL
[ ] Taps-to-cancel ≤ taps-to-subscribe, same medium
[ ] Any "are you sure" / survey / pause / win-back step is OPTIONAL and skippable
[ ] No pre-checked auto-renew; no mandatory retention gauntlet

BEFORE-THE-CHARGE HALF
[ ] Price + period + "renews until cancelled" disclosed ADJACENT to the subscribe button
[ ] Separate auto-renew consent (not bundled) — 🔴 wording confirmed
[ ] Trial: post-trial price + date disclosed before trial; pre-conversion reminder email sends
[ ] Auto-renew consent records stored (🔴 ~3-year retention confirmed with a human)

OPS (🔴 human-confirmed, not code-passes)
[ ] Annual renewal reminder for long plans — 🔴 founder confirms it's actually sending
[ ] Win-back emails gated on marketing consent
[ ] Refund-on-cancel policy stated plainly (web = you; IAP = Apple/Google own refunds)
```

**Done when:** a web user opens account settings, taps "Cancel subscription," confirms once, keeps their access until the period they paid for ends, gets an honest "cancelled, access until [date]" message — and a mobile user taps "Manage subscription" and lands on Apple's/Google's own cancel screen, with your entitlements following the platform's notification either way.

---

## 8. Top newbie mistakes (and the fix)

1. **Cancel only via support email/phone.** → The roach-motel violation. Build a self-serve, same-medium cancel (Stripe Portal is the fast correct answer).
2. **Killing access instantly while you promised period-end.** → Default to `cancel_at_period_end`; flip the entitlement at `current_period_end`, not at the click.
3. **Flipping the "paid" flag from the button.** → Drive access off the signed webhook, server-side — never the client action.
4. **Treating a failed payment like a cancellation.** → Failed renewal = dunning + "fix your card," not account deletion. They didn't ask to leave.
5. **Pre-checked auto-renew, or one bundled "I agree."** → California's ARL wants a *separate* auto-renewal consent. Two distinct consents.
6. **A mandatory retention gauntlet / un-skippable survey.** → Offers are fine; *requirements* aren't. Keep a one-tap path straight through.
7. **Building a custom cancel flow for mobile IAP.** → Apple/Google own IAP cancellation. Deep-link to their screen; handle their server notifications; don't obstruct.
8. **Silent trial-to-paid charge.** → Disclose the post-trial price/date before the trial and send a pre-conversion reminder.
9. **Assuming "click-to-cancel was struck down, so we can relax."** → Wrong, and it's the trap. The **federal** rule was *vacated on procedural grounds* (8th Cir., Jul 8 2025) — but **ROSCA, California's ARL, FTC §5, and other state ARLs still require easy, same-medium cancellation and pre-charge consent.** Do not relax the cancel path. (`LEGAL_GUIDE.md` §3 states this precisely — quote it, don't paraphrase it loosely.)
10. **Win-back emails with no marketing consent.** → A "come back" email is marketing; gate it on a recorded opt-in.

---

## 9. Who does what — the human-vs-AI split

| Step | Who | Why |
|---|---|---|
| Build the web "Cancel subscription" button / portal link | 🤖 AI | Normal coding |
| Wire `cancel_at_period_end` + the webhook-driven entitlement flip | 🤖 AI | Normal coding |
| Build the mobile "Manage subscription" deep-link + notification handler | 🤖 AI | Normal coding |
| Build the adjacent price/period/auto-renew disclosure + separate consent | 🤖 AI | Normal coding |
| Wire the pre-conversion trial reminder + cancellation-confirmation email | 🤖 AI | Normal coding |
| Configure the Stripe Customer Portal (allow cancel, retention coupon) | 🔴 YOU | Policy decision in your dashboard |
| Confirm the **annual renewal reminder is actually sending** | 🔴 YOU | An operational obligation code can't prove |
| Confirm consent-record **retention (~3 yrs)** is in place | 🔴 YOU | Records/legal obligation |
| Approve the **auto-renew consent wording** | 🔴 YOU | Exact clause sufficiency is a legal call |
| Decide + publish the **refund-on-cancel policy** | 🔴 YOU | Business + legal decision |

> 🧒 *Newbie note:* the assistant can build a *correct, easy, honest* cancel path end to end. What it **can't** do is *prove* the annual reminder is going out, that your records are retained for the legal window, or that your consent wording satisfies a specific state — those are 🔴 human confirmations. Code passing is not the same as the obligation being met.

---

## 10. Cross-references

- [`LEGAL_GUIDE.md`](LEGAL_GUIDE.md) §3 — the **law** behind this guide: ROSCA, California's ARL (AB 2863), the precise FTC click-to-cancel *vacatur* framing, the EU withdrawal button, and what still binds. Read it; this guide deliberately does not restate the legal detail.
- [`PAYMENTS_GUIDE.md`](PAYMENTS_GUIDE.md) — the **billing wiring**: Stripe Checkout, the Customer Billing Portal (§8), webhooks + signature verification (§6), entitlements (§7), dunning (§9), and the test-mode-first discipline.
- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) — the marketing-vs-transactional consent line that governs win-back emails and consent records.
- [`APP_STORE_GUIDE.md`](APP_STORE_GUIDE.md) — Apple's subscription rules (3.1.2) and why a custom IAP cancel flow gets rejected.

---

## 11. Official sources

- **FTC — ROSCA (Restore Online Shoppers' Confidence Act):** https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act
- **FTC — business guidance (Negative Option / subscriptions):** https://www.ftc.gov/business-guidance
- **California Auto-Renewal Law (Bus. & Prof. Code §17600 et seq., amended by AB 2863):** https://oag.ca.gov/ — search "automatic renewal law"
- **EU "Withdrawal Button" (Directive (EU) 2023/2673):** https://eur-lex.europa.eu/eli/dir/2023/2673/oj
- **Stripe — Customer portal (let customers manage/cancel):** https://docs.stripe.com/customer-management
- **Stripe — Cancel subscriptions (`cancel_at_period_end`):** https://docs.stripe.com/billing/subscriptions/cancel
- **Apple — App Store Server Notifications V2:** https://developer.apple.com/documentation/appstoreservernotifications
- **Apple — Managing subscriptions (deep link):** https://support.apple.com/en-us/HT202039
- **Google Play — Real-time developer notifications (RTDN):** https://developer.android.com/google/play/billing/rtdn-reference
- **Google Play — Cancel/manage subscriptions (deep link):** https://support.google.com/googleplay/answer/7018481

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). The cancel-path **build walkthrough** — the law lives in `LEGAL_GUIDE.md` §3, the billing wiring in `PAYMENTS_GUIDE.md`. Last reviewed: 2026-06. Subscription law and platform policies change (the federal rule above was alive one year and vacated the next) — the official sources are the source of truth, and **this guide is not legal advice.***
