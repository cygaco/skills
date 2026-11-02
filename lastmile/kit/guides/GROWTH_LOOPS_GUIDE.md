---
guide: GROWTH_LOOPS
anchor: lastmile:module/analytics
shape: walkthrough
timing: at-module
lead_time: "none (review prompt ships at launch; build referrals only AFTER retention proves itself)"
---

# GROWTH_LOOPS_GUIDE.md - Reviews & Referrals, the Two Cheapest Growth Loops (for Total Newbies)

> A "growth loop" is when using your app produces something that brings in *more* usage — a flywheel instead of a bucket you keep refilling. Two of these are nearly free for a solo founder: **in-app review prompts** (more good reviews → higher store ranking → more downloads) and **referrals** (happy users invite friends → who invite more friends). This guide shows you how to build both *without* breaking store policy or the law.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split. The single most important thing in this guide: the popular "Do you like the app?" review trick that newbie blogs still teach is **banned on Google Play and legally risky in the US** — do not build it. That's Section 2.

---

## 1. ELI5 - what is a growth loop, and why these two?

Most ways to get users *cost* you something every time — you pay for an ad, you get one user, you stop paying, the users stop coming. That's a leaky bucket.

A **growth loop** is different: the output of using your app feeds back into getting more users, so it compounds.

- **Reviews loop:** a happy user leaves a 5-star review → your app ranks higher and looks more trustworthy in the store → more people download it → more happy users → more reviews. The store's ranking algorithm does the work for free.
- **Referral loop:** a happy user invites a friend → the friend joins and is happy → *they* invite a friend. Each user can bring more than one new user.

These two are the **cheapest loops a solo founder gets** because the platforms hand you the machinery for free: Apple and Google both ship a built-in review prompt, and a referral is just a link plus some backend bookkeeping. No ad budget required.

But there's an order to them. **The review prompt is near-free and you can ship it at launch. Referrals are not** — they only work *after* people already love and stick with your app, and built too early they waste your time and invite fraud. We'll come back to sequencing in Section 7. Start with reviews.

---

## 2. The one rule that saves you: don't build review gating

This is the section that keeps you out of trouble. There is a wildly popular pattern — taught in countless "grow your app" blog posts — that you must **not** build:

> **The banned pattern:** show the user *"Are you enjoying the app?"* → if they tap **YES**, send them to the store review prompt → if they tap **NO**, send them to a private feedback form.

It sounds clever (you funnel happy people to public reviews and unhappy people to private complaints). It is **"review gating," and it's a trap.** Three separate things make it dangerous:

### It is explicitly banned on Google Play

Google's In-App Review API guidelines say this, **word for word**:

> *"Your app shouldn't ask the user any questions before or while presenting the rating button or card, including questions about their opinion (such as 'Do you like the app?') or predictive questions (such as 'Would you rate this app 5 stars')."*

That is a primary-source quote from Google's own developer docs. "Are you enjoying the app?" is exactly the kind of question it names. *([VERIFIED] — quoted verbatim from developer.android.com.)*

### It is risky on Apple

Apple has **no single rule that names this pattern** the way Google does, so anyone who tells you "Apple explicitly bans it" is overstating. But Apple's review guidelines (the customer-reviews / 5.6.1 area) lay down principles that the gate clearly violates in spirit: **don't manipulate App Store reviews, use Apple's provided review API, and don't selectively steer who reviews you.** Apple reserves the right to remove apps and expel developers for manipulating ratings. So the honest read is: *Apple doesn't have a rule with this pattern's name on it, but the pattern cuts against its stated principles and the risk is real.* *([PARTIALLY VERIFIED] — Apple's silence is absence-of-a-rule, not a blessing; the principles it violates are confirmed.)*

There's also a technical reason the gate is pointless on iOS: the native prompt is **fire-and-forget**. Your code asks the system to *maybe* show it, and you get **no signal** about whether it appeared or what rating the user gave. You literally cannot build reliable sentiment-gating on iOS even if you wanted to.

### It can break US law

If you have US users you're also under the **FTC Consumer Review Rule** (effective **October 21, 2024**, penalties up to **~$51,744 per violation**). It targets review *suppression* — and a system whose whole purpose is to stop unhappy users from leaving public reviews is exactly what it's aimed at. The FTC has already hit a company (Fashion Nova) for $4.2M over review suppression. *([VERIFIED] — ftc.gov + Federal Register.)*

> **The golden rule: never route store reviews by sentiment, and never reward or require a review.** If a blog tells you to build the "Are you enjoying the app?" funnel, close the tab. The next section shows the compliant design that captures most of the same benefit, legally.

---

## 3. The compliant design: two flows that never touch each other

You wanted two good things from the gate: catch unhappy users *before* they rant in public, and nudge happy users *toward* a review. You can have both — by building **two completely separate, decoupled flows** that never reference each other.

### Flow A - private feedback, triggered by NEGATIVE signals

When something goes *wrong*, open a private feedback or support path. Good triggers:

- a crash just recovered
- an export / save / AI generation failed
- a payment failed
- the user tapped "Contact us" or entered a cancellation flow
- repeated validation errors, or a thumbs-down on a generated result

Copy that works: *"Something didn't work? Tell us what happened so we can fix it."*

**The hard rule for Flow A: it must NEVER mention store reviews.** It's a genuine "help us fix this" channel, not a disguised filter. The moment it says "...and if you're happy, rate us!" it becomes the banned gate again.

### Flow B - the native review prompt, triggered by OBJECTIVE positive milestones

Separately, ask for a review after the user *objectively succeeds* at something — with **no sentiment question attached**:

- completed a task / project / lesson
- hit a streak or weekly goal
- finished a first successful export
- won a level, or returned several days in a row

No *"are you enjoying it?"* branch. No question of any kind before the prompt. You just call the native review API at a good moment and let the system decide whether to show it.

Here's the whole logic, and notice the two flows share nothing:

```text
if recent_negative_experience:
    show_feedback_or_support_flow()      # Flow A - never mentions reviews

if positive_value_milestone
   and review_eligibility_rules_pass     # Section 5's defaults
   and not in onboarding / paywall / permission flow:
    request_native_review()              # Flow B - no question, ever
```

This keeps almost all the benefit of the gate — unhappy users get steered to private feedback by their *own bad experiences*, happy users get nudged toward a review by their *own wins* — without you ever sorting people by sentiment. That's the line: deflecting on a real failure is fine; *blocking negative public reviews* is the prohibited part.

---

## 4. Platform mechanics: the native prompts are weirder than you expect

Both stores **make you use their built-in prompt** — you cannot build your own rating UI and you cannot link out to a custom one. The built-in prompts behave in surprising ways. Get these wrong and you'll think your code is broken when it's working perfectly.

### iOS - `requestReview`

- **Fire-and-forget, no result.** There is *no programmatic way to know* whether the prompt showed or what rating the user gave. Don't write code that waits for an answer — there isn't one.
- **Max 3 prompts per 365 days, per user.** Apple rate-limits it; your fourth call in a year silently does nothing.
- **Always shows in debug builds, NEVER in TestFlight.** This trips up every newbie: you test in TestFlight, the prompt never appears, you assume it's broken. It isn't — TestFlight just suppresses it. You only see real production behavior after release.
- **Never attach it to a "Rate us" button.** Because the call can silently no-op (quota hit), a button wired to it will look broken to the user. If you want a "Rate us" item in Settings, make it open the **store listing URL** directly, not the native prompt.

### Android - In-App Review API

- **Quota is undocumented and silent.** Google enforces a time-bound limit (calling it more than once in, e.g., under a month "might not always display a dialog") and says outright: *"The specific value of the quota is an implementation detail, and it can be changed by Google Play without any notice."* So your call may simply show nothing, by design.
- **The card is rendered by Play and must not be touched.** You cannot modify its size, opacity, or shape, overlay it, or remove it programmatically.
- **No questions before or while it's on screen** (that's the Section 2 ban).
- **Same "Rate us" rule:** don't trigger the review card from a button — Google's guidance says to redirect to the Play Store listing for an explicit user-initiated rate action, because the card may not show.

> **The rule that ties it together:** log your *own* `review_prompt_attempted` event so you can see how often your code *tries* to prompt — but **never assume the store dialog actually appeared.** On both platforms, "I called the API" and "the user saw a prompt" are different things you cannot connect.

---

## 5. When to trigger the review prompt - copyable defaults

The right moment is a **value moment** — right after the user objectively succeeded at something. (Think "value," not "dopamine hit" — you're rewarding *their* success, not manipulating them.) Never after an error, never on day zero.

Here's a default eligibility rule a newbie can copy almost verbatim. Only prompt if **all** of these are true:

```text
days_since_install        >= 7
sessions_count            >= 3
core_success_events       >= 2
current_version_sessions  >= 2
last_review_attempt        is null OR more than 120 days ago
no crash or fatal error in the last 7 days
no failed payment / refund / support ticket in the last 14 days
NOT during onboarding, a paywall, a permission prompt, or an active task
```

For fast-cycle games you can prompt a little earlier, but still never on day zero:

```text
days_since_install   >= 2
sessions_count       >= 3
levels_completed     >= 5
last session was crash-free
```

**Conservative frequency caps that keep you safe:**

| Lever | Default |
|---|---|
| First eligible prompt | day 7+ (games: day 2+) |
| Minimum sessions | 3 |
| Minimum core successes | 2 |
| App-level cooldown between attempts | 120 days |
| Cooldown after a crash | 7 days |
| Cooldown after support/refund/cancellation | 14-30 days |
| After a major version update | wait 48 h or 2 sessions |
| Your own lifetime attempts | rarely more than 2-3/year (let the platform quota be the hard cap) |

**Good vs bad trigger moments by app type:**

| App type | Good trigger | Bad trigger |
|---|---|---|
| Game | Level/boss/tournament win, streak | Mid-game, after a loss, after an ad or loot-box |
| Productivity | Task/project completed, export succeeded | First launch, before they've made anything |
| Habit / fitness | Streak milestone, workout logged | After a missed streak |
| Education | Lesson completed, quiz passed | After a failed quiz |
| AI / content tool | Successful generation or export | After a failed/rate-limited/bad generation |
| Marketplace | After delivery or a successful booking | During checkout, on a failed payment, in a refund |
| Finance / health | After a useful insight or successful setup | During bad news, a loss, an anxious moment |

The pattern across the whole table: prompt when the user just *won*, never when they just *lost*.

---

## 6. Referrals - the acquisition loop (and when NOT to build it)

Referrals are the second loop: happy users invite friends. They're powerful but **easy to build too early and easy to get defrauded on.** Read this whole section before writing any code.

### First: are referrals even premature for you?

Referrals **amplify** a product people already love — they don't create love. Building them before you have retention is *pouring water into a leaky bucket*: you spend effort (and reward money) sending new users into an app they'll abandon anyway.

**Don't build referrals until your activation is healthy.** A concrete gate: if your activation rate (new users who complete the first core action in their first session/24 h) is **under ~20% for a consumer app, fix onboarding and core value first** — referrals are a waste until then. *([PARTIALLY VERIFIED] — the 20% line is expert judgment, not a hard universal; the direction "prove retention first" is strongly supported.)*

Referrals are probably a waste right now if: retention is poor, nobody's organically sharing, there's no obvious person to invite, reward cost is unclear, or fraud would be easy. In those cases, put your energy into app-store optimization, content, or partnerships instead.

> **The exception:** social / collaboration apps (where the app is *pointless* without other people — chat, multiplayer, shared workspaces) need **invite links** as core infrastructure from day one. But even they should hold off on *reward programs* until retention is proven. Invite links ≠ paid referral rewards.

### How a referral link actually works (deferred deep linking)

The flow you're building:

1. Every user gets a **referral code** (e.g. `ABCD123`).
2. They share a link: `https://yourapp.com/invite/ABCD123`.
3. If the app is installed, the link opens it.
4. If not, it routes to a landing page → the App Store / Play Store.
5. After the friend installs, signs up, and *activates*, your backend records who referred whom.

That step 5 — getting the code to survive the trip *through* the app-store install — is called **deferred deep linking**, and it's the hard part.

- **Android:** the **Play Install Referrer** can carry the code through an install fairly reliably.
- **iOS:** deterministic deferred deep linking is genuinely hard because of Apple's privacy stance — universal links work once the app is installed, but post-install attribution often needs a vendor or a fallback. **100% accurate attribution on iOS is not achievable**; don't promise yourself it is.

> **Important:** **Firebase Dynamic Links is DEPRECATED** (shut down through 2025) — do **not** build a new 2026 app around it. Current options: **Branch, AppsFlyer OneLink, Adjust** (vendor SDKs, if budget allows), or the simplest fallback that needs no SDK at all — **let the new user type or paste a referral code after signup**. Avoid device-fingerprinting and clipboard/pasteboard hacks; they invite privacy problems and store rejection.

For a first version, **a plain referral code entered after signup is completely fine** and dodges all the attribution complexity.

### Single vs double-sided rewards

You can reward just the referrer (single-sided) or **both** the referrer and the new friend (double-sided). **Default to double-sided** — giving the new person a reason to accept the invite is what makes it work. Vendor data claims double-sided gets roughly **2.3x more referrals and ~91% higher participation**, *([UNVERIFIED magnitude] — these specific multiples are vendor-sourced marketing stats; treat them as directional, the direction "double-sided wins" is solid, the exact numbers are soft.)*

### What to give as the reward (match it to your economics)

| Reward type | Right when… | Wrong when… | Watch out |
|---|---|---|---|
| **Subscription time** (free days/month) | Low marginal-cost subscription apps | — | Grant only *after* paid conversion; cap it monthly or it's farmable |
| **Credits / consumables** (AI generations, storage, exports) | The unit has a clear, low cost | The compute is expensive and farmable | Know your unit economics; add caps |
| **Feature unlock** | Prosumer tools, games, communities | The unlock cannibalizes what you sell | Cheap and effective when it doesn't hurt monetization |
| **Cosmetic / status** | Games, social, community | Utility apps with no status layer | Lowest fraud cost of all |
| **Cash** | Marketplaces, fintech, high-LTV products | **Almost every newbie app** | Needs fraud ops + tax/KYC/legal — **avoid by default** |

For mobile digital goods, **check Apple/Google payment rules before granting any paid entitlement as a reward** — you must not use referrals to route around the required in-app-purchase systems. Free promotional access is usually fine; discounts that steer users off IAP are not.

### Minimum viable anti-fraud (for a founder with no fraud team)

Referral fraud is the *dominant* attack on these systems — self-referrals and fake accounts. One cited program had over **40%** of its early-2025 payouts claimed by fraudulent actors. *([PARTIALLY VERIFIED] — single cited program; the *class* of risk is well-documented, the exact percentage is one data point.)* You don't need a fraud team, but you do need these floors:

- **Reward only after a real qualifying action** (email verified + first core action completed + account at least ~24 h old) — **never on signup alone**.
- **Block self-referral:** same account, same device/install ID, same payment instrument.
- **For paid rewards, wait past the refund window** and add **chargeback/refund clawback** — pull the reward back if the referred user refunds.
- **Cap rewards per referrer** per day/week/month.
- **Keep an immutable reward ledger** (append-only; each entry has an idempotency key) so you can audit and never double-pay.
- **Never pay cash without manual review.** Don't reward throwaway/anonymous accounts.
- **Publish referral terms** (also a legal requirement — see the LEGAL guide).

### A reality check on how much referrals actually grow you

The number that matters is the **k-factor**: how many *new* users each existing user brings.

```text
k = (share of users who invite) × (invites each sends) × (share of invites that become real users)
```

A worked example: 20% of users share, each sends 3 invites, 15% of those become real users → k = 0.20 × 3 × 0.15 = **0.09**. That's a useful assist, but **nowhere near viral** (viral is k > 1).

| k-factor | What it means |
|---|---|
| < 0.05 | Normal for non-social utilities |
| 0.05 - 0.15 | A useful assist channel |
| 0.15 - 0.4 | Strong for a consumer app |
| > 1 | Rare — usually only deeply social/collaborative products |

**Set expectations honestly: almost no app goes viral.** The Dropbox / Clubhouse stories are survivorship outliers. A realistic referral program *shaves your customer-acquisition cost* (a k of 0.2 means roughly 17% fewer paid users needed) — it **amplifies** acquisition, it doesn't replace it.

---

## 7. Sequencing - do these in the right order

The two loops sit at different maturity levels, and the order is the whole point:

1. **Review prompt → ship near launch.** It's near-free, the infrastructure is simple, and it's a *reputation* loop. Build it early, but **don't prompt on day zero** — gate it behind the Section 5 eligibility rules so the first prompt lands after a real value moment on a stable app.
2. **Referrals → only after retention proves itself.** It's an *acquisition* loop, and it only pays off once people stick. Build it after your activation/retention numbers are credible (the ~20% activation gate from Section 6).
3. **The one exception:** social/collab apps wire **invite links** in early as core plumbing — but still hold the *reward program* until retention is proven.

If you remember one sentence: **reviews are cheap and early; referrals are conditional and later.**

---

## 8. What only YOU can do vs your AI assistant

Most of both loops is normal coding your AI can do. A few steps need *you*, the human, because they need your store access, your money, or your judgment:

| The step | Who | Why |
|---|---|---|
| Wire the native review API, build the two decoupled flows, build the referral link + ledger + anti-fraud rules | **🤖 AI** | This is normal coding |
| Log into App Store Connect / Play Console to **read and reply to public reviews** | **🔴 YOU** | It's your store account; replying to reviewers is done as *you* |
| Decide the **referral reward and its dollar value** (and whether to offer cash at all) | **🔴 YOU** | It spends real money and shapes your economics — a business call, not a code change |
| Approve **cash payouts** / handle the tax/KYC side if you ever offer cash | **🔴 YOU** | Your money, your legal and tax obligations |
| Publish the **referral program terms** as a real document | **🔴 YOU** | You're the legal entity making the offer |
| Decide your **activation gate** — is retention good enough to build referrals yet? | **🔴 YOU** | A judgment call about your own product's readiness |

> **The funding rule:** never let an automated flow grant a *paid* reward (cash, expensive credits) without a human in the loop for anything above trivial value. Reward money is the one place a bug or a fraudster costs you real dollars.

---

## 9. Minimum viable setup

```
GROWTH LOOPS - MINIMUM VIABLE

Reviews (ship at launch):
[ ] NO "Are you enjoying the app?" sentiment gate anywhere
[ ] Flow A: private feedback on negative signals, never mentions store reviews
[ ] Flow B: native review prompt on objective positive milestones, no question attached
[ ] Uses the native iOS/Android review API (no custom rating UI, no link-out prompt)
[ ] Eligibility rules gate the prompt (day 7+, sessions, successes, cooldowns)
[ ] Never prompted on day zero, after an error, or during onboarding/paywall
[ ] A "Rate us" Settings item opens the STORE LISTING, not the native prompt
[ ] You log review_prompt_attempted but never assume the dialog showed

Referrals (build ONLY after retention proves itself):
[ ] Activation rate is healthy first (~20%+ for consumer apps)
[ ] Referral code + share link + deferred deep link (NOT Firebase Dynamic Links)
[ ] Double-sided reward, sized to your unit economics (avoid cash by default)
[ ] Reward is PENDING until a real qualifying action past the refund window
[ ] Self-referral blocked (account/device/payment-instrument dedup)
[ ] Per-referrer caps + immutable reward ledger + refund clawback
[ ] No automated cash payouts; published referral terms
```

**Done when:** a happy user hits a real win and *might* get a native review prompt (you never assume they did); an unhappy user gets a private feedback path that never mentions reviews; and — once retention is proven — a friend can accept an invite, activate, and earn *both* sides a reward that only pays out after they're verified-real and past the refund window.

---

## 10. Top newbie mistakes (and the fix)

1. **Building the "Are you enjoying the app?" sentiment gate.** → Banned on Google Play, risky on Apple, FTC-exposed in the US. Use two decoupled flows (Section 3).
2. **Mentioning store reviews in the negative-feedback flow.** → That re-creates the gate. Flow A must never reference reviews.
3. **Wiring the native review prompt to a "Rate us" button.** → It can silently no-op and look broken. Point "Rate us" at the store listing URL.
4. **Assuming the review dialog showed / panicking when it doesn't appear in TestFlight.** → It never shows in TestFlight; you get no result signal anywhere. Log the attempt, expect nothing back.
5. **Prompting for a review on day zero or after a failure.** → Gate behind eligibility rules; only prompt after an objective win on a stable app.
6. **Incentivizing or requiring a review.** → Both stores forbid it. No rewards for reviews, ever.
7. **Building referrals before you have retention.** → A leaky bucket. Fix activation first (~20% gate).
8. **Building on Firebase Dynamic Links.** → Deprecated. Use Branch/AppsFlyer/Adjust, or a plain referral code entered after signup.
9. **Paying the referral reward on signup.** → That's what fraudsters farm. Reward only after a verified qualifying action, past the refund window.
10. **Offering cash rewards as a newbie.** → Needs fraud ops + tax/KYC/legal. Default to subscription time, credits, or feature unlocks.
11. **Expecting referrals to go viral.** → Almost no app does (k > 1 is rare). Referrals shave acquisition cost; they don't replace acquisition.

---

## 11. Cross-references

- [`ANALYTICS_TELEMETRY_GUIDE.md`](ANALYTICS_TELEMETRY_GUIDE.md) - activation rate is the metric that tells you whether referrals are even worth building; review attempts and referral funnels are events you instrument here.
- [`PUSH_NOTIFICATIONS_GUIDE.md`](PUSH_NOTIFICATIONS_GUIDE.md) - the same "value moment, not day zero" discipline and the same native-API quirks (fire-and-forget, can't-tell-if-it-showed) apply to push.
- [`LEGAL_GUIDE.md`](LEGAL_GUIDE.md) - referral program terms, and the FTC review rule, are legal obligations.
- [`PAYMENTS_GUIDE.md`](PAYMENTS_GUIDE.md) - referral rewards as digital entitlements must respect Apple/Google in-app-purchase rules; refund windows drive reward timing.
- [`AUTH_GUIDE.md`](AUTH_GUIDE.md) - you need a stable user id to attribute a referral and to dedup self-referrals.

---

## 12. Official sources

- Google Play - In-App Review API (verbatim pre-prompt ban, opaque quota, design rules): https://developer.android.com/guide/playcore/in-app-review
- Apple - App Store Review Guidelines (customer reviews / ratings-manipulation, 5.6.x): https://developer.apple.com/app-store/review/guidelines/
- Apple - StoreKit `SKStoreReviewController` (the native iOS review API, no-result behavior): https://developer.apple.com/documentation/storekit/skstorereviewcontroller
- US FTC - Final Rule banning fake reviews & review suppression (effective Oct 21 2024): https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials
- Firebase Dynamic Links deprecation + alternatives (do not build new on FDL): https://firebase.google.com/support/dynamic-links-faq

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Store review policies and section numbers change frequently, referral and k-factor figures are directional and partly vendor-sourced, and deferred-deep-link options shift year to year — confirm the platform docs and your reward economics before launch.*
