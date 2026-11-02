> v1 baked-in playbook — refresh it against current sources before relying on its numbers.

# Conversion Funnel Playbook

For `/lastmile`. Audience: a non-technical founder with a working prototype, AND the AI running `/lastmile` deciding what to build. Goal: turn a thing-that-works into a thing-that-converts. Opinionated defaults beat blank pages — adopt these, then test.

**Core thesis:** a landing page is not a brochure. It is a single-purpose machine that turns a stranger's attention into one decision (sign up / join waitlist / start checkout). Everything that doesn't push that decision is friction.

---

## 1. Landing Page Structure (top to bottom)

Build in this order. Each section earns the scroll to the next.

**Hero — offer + outcome (above the fold).**
- One headline stating the *outcome the user gets*, not what the product *is*. "Ship your side project this weekend" beats "AI-powered project tooling."
- One subhead (≤2 lines) naming who it's for and the mechanism.
- One primary CTA button. One. Mirror it in the nav.
- A product visual: real screenshot, short loop, or a 20-second demo. No abstract hero illustrations.
- Pass the 5-second test: a stranger should be able to say what this does, for whom, and what to click.

**Offer positioning (right under hero).**
- State the transformation: from [painful before] → to [desired after].
- Name the wedge: the one job you do better than the status-quo (spreadsheet, doing-it-manually, the incumbent).
- Avoid feature soup here. Position against the alternative the user is using *today*.

**Proof / trust.**
- Logos (customers, press, "as used by") if you have them. If you don't, omit — empty logo bars scream new.
- Testimonials with a real name, face, and specific result ("cut our onboarding from 3 days to 20 min"). Generic praise is worthless.
- Hard metrics: users, uptime, time saved, $ earned. Only real numbers — a fabricated metric is a trust bomb that detonates later.
- Trust signals near any data ask: "We never sell your data," security badge, link to privacy policy.

**Features → benefits.**
- Lead each block with the benefit (what the user *gets*), then the feature (how) as support.
- 3–5 blocks max. Alternating image/text. Each maps to a real pain from positioning.
- Don't list every feature — list the ones that close the sale.

**Pricing.**
- Show it. Hiding price to "book a demo" kills self-serve conversion for SMB/consumer.
- 2–3 tiers, anchor the middle as "most popular." Annual toggle with the discount visible.
- Each tier: who it's for + the 3 things that matter, not an exhaustive matrix.
- Free tier or free trial reduces signup friction; state exactly when/if a card is required.

**FAQ.**
- 5–8 questions that are really *objections in disguise*: "Is my data safe?", "Can I cancel?", "Does it work with X?", "Do I need a credit card?"
- Answer the cancellation/refund question plainly — dodging it reads as a trap.

**Footer — privacy / terms / contact.**
- Link **Privacy Policy** and **Terms of Service** (required before launch — see security-privacy-baseline.md).
- Cookie/tracking notice if you run analytics or ads.
- A real contact path (email or form). A reachable human is a trust signal.

**Final CTA band.**
- Restate the outcome + the single CTA. The visitor who scrolled this far is warm — don't make them scroll back up.

**Waitlist OR checkout — pick one per stage.**
- Pre-launch / capacity-limited → **waitlist**: email only, promise of access, optional "why you want in." Send a confirmation immediately.
- Live / self-serve → **checkout**: get them into the product fast. Defer non-essential fields to post-signup. Every extra required field costs conversions.

---

## 2. AI-Native Branding & Copy System (blank → coherent, fast)

A solo or AI-assisted builder can stand up a coherent brand in an afternoon. Sequence:

1. **Positioning first, name second.** Write one sentence: *"For [audience] who [pain], [product] is a [category] that [unique benefit], unlike [alternative]."* This sentence is the source of truth for everything below.
2. **Naming.** Generate 20 candidates with an LLM seeded by the positioning sentence. Filter on: .com or clean handle available, sayable on a phone call, not trademarked, no awkward homophones. Decide and move on — a good-enough name shipped beats a perfect name next month.
3. **Value prop ladder.** Derive three layers from the positioning sentence: one-liner (hero headline), one-paragraph (offer section), one-page (the whole landing). Keep them consistent — the headline is just the one-liner.
4. **Copy voice.** Pick 3 adjectives (e.g. "plain-spoken, confident, warm"). Write them into a short style note and feed it to the LLM on every copy pass so voice stays consistent. Default to plain language: short sentences, "you," active verbs, concrete nouns. Cut adjectives and hedging.
5. **Visual identity.** One primary color + one neutral scale + one accent. One font for headings, one for body (a single well-chosen typeface is fine). Use an AI logo/wordmark tool or a clean typographic wordmark — do not block launch on a bespoke logo. Lock these into design tokens so the page stays consistent.
6. **Generate, then cut.** Draft all copy with an LLM, then *delete half*. AI over-explains. The edit is where conversion is won.

**Coherence check:** the positioning sentence, hero headline, and first testimonial should all tell the same story. If they don't, the page feels off and trust leaks.

---

## 3. Principle: Clear Conversion Over Trendy Aesthetics

Beauty that obscures the offer is a liability. When clarity and trend conflict, clarity wins every time.

**Do**
- One primary CTA per screen, repeated as the user scrolls.
- High contrast between the CTA and everything else — the button should be the most obvious thing on screen.
- Standard, legible patterns: top nav, F-pattern reading, predictable button placement.
- Specific, concrete copy ("Join 4,200 builders") over vague vibes ("Reimagine your workflow").
- Fast load and mobile-first — most first visits are on a phone. A slow hero loses people before they read a word.
- Real screenshots of the actual product.

**Don't**
- Multiple competing CTAs ("Sign up" vs "Learn more" vs "Book demo" all equal weight).
- Hero carousels, autoplay sound, scroll-jacking, or animations that delay comprehension.
- Low-contrast "aesthetic" gray-on-gray text. Trendy ≠ readable.
- Mystery-meat navigation or clever labels nobody understands ("Discover", "Imagine").
- Stock-photo people pretending to be customers.
- Walls of feature copy with no benefit framing.

**Tiebreaker:** if a design choice makes the page prettier but the next action less obvious, revert it.

---

## 4. Copy Formulas That Convert (steal these)

Don't write from scratch. Start from a proven skeleton, fill with specifics from the positioning sentence, then cut.

**Hero headline patterns**
- *Outcome + timeframe:* "Launch your store in a weekend."
- *End the pain:* "Stop losing leads in your inbox."
- *For [audience], without [the bad part]:* "Invoicing for freelancers, without the spreadsheet."
- *The [old way] is dead. Meet [new way].* — only if you can back the claim.

**PAS for the offer block** — Problem → Agitate → Solve. Name the pain, make it sting for one line, present the product as the relief. Short. Don't wallow in the agitation.

**FAB for feature blocks** — Feature → Advantage → Benefit, but *lead with the Benefit*. "Never miss a payment (benefit) — automatic reminders (feature) chase invoices for you (advantage)."

**CTA button copy** — first person + value, not "Submit." "Start my free trial", "Get my [outcome]", "Reserve my spot." Avoid "Learn more" on the primary button — it's a dead end.

**Testimonial format** — [specific result] + [emotion] + [name, role, company]. "Cut onboarding from 3 days to 20 minutes — I finally trust the numbers. — Real Name, Ops Lead."

**Word-level edits that lift conversion**
- Replace "we/our" with "you/your." The page is about the reader.
- Replace adjectives with numbers. "Fast" → "loads in 0.4s." "Trusted" → "4,200 builders."
- Cut "simply", "just", "easily" — they describe your feeling, not the user's experience.
- One idea per sentence. If you used a comma to join two ideas, consider a period.

---

## 5. Analytics Event Per Funnel Step

The funnel must be measurable end to end. Fire one named event per step so you can see exactly where people drop. Use a consistent event taxonomy and emit to your product analytics.

| # | Funnel step | Event name | Fire when | Key properties |
|---|---|---|---|---|
| 1 | Visit landing | `landing_view` | Landing page loads | `source`, `referrer`, `variant`, `device` |
| 2 | CTA click | `cta_click` | Primary CTA clicked | `cta_id`, `section` (hero/pricing/footer), `variant` |
| 3 | Signup start | `signup_start` | Signup/waitlist form opened | `method` (email/oauth), `plan` |
| 4 | Signup complete | `signup_complete` | Account created / waitlist joined | `user_id`, `plan`, `method` |
| 5 | Activation | `activation` | User hits the "aha" core action | `feature`, `time_to_activate` |
| 6 | Checkout start | `checkout_start` | Payment flow opened | `plan`, `price`, `billing_cycle` |
| 7 | Payment success | `payment_success` | Charge confirmed (verify via webhook, see baseline) | `plan`, `amount`, `currency`, `txn_id` |

**Rules of thumb**
- **Define "activation" explicitly** — the single action that predicts retention (e.g. "created first project"). It's the most important and most often-missing event. Without it you can't tell signups apart from real users.
- One canonical name per event; never let the same step fire under two names — it forks your funnel math.
- Compute step-to-step conversion (each event ÷ the prior). The biggest drop is your next thing to fix.
- Verify `payment_success` against the payment provider's **webhook** (server-side), never trust the browser redirect alone — a client-side "success" can be spoofed or lost.
- Respect consent: gate non-essential analytics behind the cookie/tracking disclosure (see security-privacy-baseline.md). Conversion events you need to run the service are generally fine; ad/tracking pixels need consent.

**Minimum bar to claim "launch-ready funnel":** all 7 events firing, activation defined, and you can read the drop-off between every adjacent pair.

---

## 6. Launch-Readiness Funnel Checklist

Run this before any "launch-ready" claim. Each box is a gate, not a nice-to-have.

- [ ] Hero passes the 5-second test (stranger names what/who/click).
- [ ] Exactly one primary CTA, repeated on scroll, high contrast.
- [ ] Positioning sentence written; headline + first testimonial tell the same story.
- [ ] Proof is real (no fabricated logos, metrics, or stock-photo "customers").
- [ ] Pricing is visible with a clear path to start; card-required state is explicit.
- [ ] FAQ answers the top 5 objections, including cancel/refund.
- [ ] Privacy Policy + Terms linked in footer; cookie/tracking notice if applicable (see security-privacy-baseline.md).
- [ ] One conversion goal chosen per stage (waitlist OR checkout), confirmation fires on submit.
- [ ] Mobile-first; hero loads fast on a phone.
- [ ] All 7 funnel events firing; activation explicitly defined; drop-offs readable.

> A pretty page with no measurable funnel is not launch-ready. A plain page with a clear offer and a working funnel is. When forced to choose, ship the second.

## 7. Refresh

These are baked-in v1 defaults. Conversion benchmarks, copy fashions, and analytics tooling move fast — re-derive against current data and update this file rather than letting it rot. Cross-reference: the security and consent requirements that gate analytics and data-collection CTAs live in [`security-privacy-baseline.md`](security-privacy-baseline.md) in this same directory (`.claude/lastmile/playbooks/`). The **2026 web-research sweep** (benchmarks, copy primitives, Stripe/webhook pitfalls, stack tradeoffs, privacy baseline — with sources) are encoded in **`research-signal-2026.md`** (same directory).
