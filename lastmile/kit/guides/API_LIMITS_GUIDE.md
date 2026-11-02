---
guide: API_LIMITS
anchor: lastmile:day-zero
shape: checklist
timing: project-start
lead_time: "3rd-party API usage TIERS rise gradually with account age + verified spend (days→months to high tiers); money alone won't unlock them — start climbing + request increases EARLY."
---

# API_LIMITS_GUIDE.md — Third-Party API Limits & Capacity Prep (for Total Newbies)

> Your app leans on someone else's API — almost certainly an **AI provider** (OpenAI, Anthropic, Google), and probably email, SMS, and payments too. Here's the surprise that ends a lot of launch days: **the provider decides how fast and how much you're allowed to call them, and that ceiling rises slowly over weeks and months — it does NOT jump the moment you're willing to pay.** A brand-new, fully-funded account sits at the *lowest* tier. So you **cannot just point your app at an API and serve unlimited users on day one**, no matter how big your credit card is. Blow past your tier at launch and your app throttles or errors for *real* users while they watch. This is a real launch-blocker founders hit too late — which is exactly why it's **day-zero prep**.
>
> **New here?** The shared "what only a human can do" and "start the slow stuff on day zero" rules live in **`README.md`** — read it once. This guide doesn't repeat them.

---

## 1. What "rate tiers" actually are (ELI5)

Every API provider caps how hard you're allowed to hit them. The caps come in a few flavors:

| Cap | What it means | Where it bites |
|---|---|---|
| **RPM** — requests per minute | How many separate calls you can make each minute | Spiky traffic, lots of users at once |
| **TPM** — tokens per minute (AI only) | How much *text* (in + out) you can push through an AI model per minute | A few big prompts/answers can blow this fast |
| **Concurrent requests** | How many calls can be in-flight at the same time | Parallel/background jobs |
| **Monthly spend cap** | A hard dollar ceiling on the account | Heavy usage near month-end |

Providers bundle these caps into **tiers** — for example **OpenAI's Usage Tier 1 → 5**. You **climb tiers by spending over time**: it's a combination of *how much you've cumulatively paid* **and** *how many days since your first payment*. You do not buy your way to the top tier with one big payment.

> 🧒 *Newbie note:* think of it like a **credit limit**, not a shopping cart. The bank raises your limit as you build a history of paying on time — it doesn't triple it just because you walked in waving cash. APIs work the same way: history first, headroom second.

---

## 2. The thing that bites: money ≠ instant capacity

Here's the part that catches everyone. Even a credit card with money to burn hits a **per-minute ceiling** the instant you cross it. The provider doesn't care that you'd happily pay more — for *that minute*, you're done.

> **An example (the wall is real):** run several heavy requests at once against a top-tier AI model and an account can slam into a hard **~450,000 tokens-per-minute** cap and get rate-limited mid-run. Throwing more money at it does *nothing* — the cap is per minute, not per dollar. Within the minute, what helps is **spacing the calls out** (so fewer tokens flow per minute); over time, **climbing tiers** raises the ceiling itself. Sections 3–4 cover the rest (limit increases, caching, fallback providers). 

That example is just a few big parallel calls. **Launch traffic — dozens or hundreds of users hitting your app in the same minute — is the same wall, except now it's your customers seeing the errors.** If you didn't prep, the first thing a successful launch does is throttle itself.

> 🧒 *Newbie note:* "I'll just pay for more" is the trap. There is no "pay for more *this minute*" button. The ceiling rises on the provider's clock, not your wallet's.

---

## 3. Day-zero prep 🔴 (mostly YOU — start NOW, it ramps over weeks)

This is the slow stuff. Like the account signups in `DEV_SETUP_GUIDE.md`, the *waiting* is the real cost — so start the clocks running today while you build.

| Step | Who | Why it can't wait |
|---|---|---|
| **Pick your API providers early** | 🔴 YOU | You can only build tier history on accounts you've actually opened. |
| **Read each provider's rate-limit / usage-tier docs** | 🔴 YOU | Know *your* numbers (RPM/TPM per model, what each tier unlocks) before you design. See Official sources. |
| **Start using + paying a little, EARLY** | 🔴 YOU | Tier-climbing needs *account age + cumulative spend*. A trickle of real usage now ages the account so it isn't stuck at Tier 1 on launch day. |
| **Request a rate-limit increase ahead of launch** | 🔴 YOU | Providers have a request form; approval depends on your history and **takes time**. Ask weeks before, not the night before. |
| **Estimate peak RPM/TPM at expected launch traffic** | 🔴 YOU (🤖 AI helps math) | Rough out "X users × Y calls × Z tokens" at your busiest minute, then confirm your tier actually covers it. |

> 🧒 *Newbie note:* you don't need perfect math. You need to know whether your launch-day busy-minute is "well under my tier" or "way over." If it's over, you have two levers — climb tiers (slow, start now) and architect for the ceiling (Section 4, start now too).

---

## 4. Architect for the ceiling 🤖 (mostly AI can build)

You **will** be limited at some point — so build as if hitting the limit is normal, not catastrophic. Your assistant can wire all of this:

| Pattern | What it does | Cross-ref |
|---|---|---|
| **Your own per-user rate limits + usage quotas** | Stops one user (or an abuser) from eating the whole account's provider limit | `SECURITY_GUIDE.md` — same machinery protects you from abuse *and* from blowing your provider cap |
| **Queue + backoff/retry on 429s** | When the provider says "Too Many Requests" (HTTP 429), wait and retry instead of failing the user | — |
| **Cache repeated results** | Don't re-call the API for an answer you already have | — |
| **Batch where possible** | Combine work into fewer, fuller calls instead of many tiny ones | — |
| **Fallback model / second provider (multi-provider)** | A backup API key or a second provider so one limit doesn't take the whole app down | — |
| **Graceful "we're busy, try again" messaging** | The user sees a calm message, not a crash or a spinning forever-loader | — |

> **🤖 AI CAN DO THIS:** *"Add per-user rate limiting and usage quotas, a queue with exponential backoff/retry on 429 errors, response caching, and a fallback to a second provider — and show users a friendly 'we're busy, try again in a moment' message instead of an error."*

> 🧒 *Newbie note:* the goal is simple — design so that **hitting a limit makes your app slow down, never break down.** A queued user who waits 3 seconds is fine. A user who sees a red error is not.

---

## 5. Retry safely: 429s are normal, retry storms are not 🤖

Section 4 said "queue + backoff/retry on 429s" — this is the **how**, because the retry code itself can become the problem. A 429 ("Too Many Requests") is a *normal* signal: the provider is telling you to slow down for a moment. But naive retry code reacts by hammering *harder* — every failed call instantly fires again, the failures pile up, and you've turned one slow minute into a self-inflicted **retry storm** that multiplies your traffic and your **bill**. The provider's RATE limit is your friend here; your own retry loop is the thing that bites.

Your assistant can wire every one of these — they're the difference between a graceful slowdown and a runaway:

| Pattern | What it does |
|---|---|
| **Honor `Retry-After`** | When the 429/503 response includes a `Retry-After` header, wait *that long* before retrying. The provider just told you the answer — obey it instead of guessing. |
| **Exponential backoff + jitter** | Each retry waits longer than the last (1s → 2s → 4s…), **plus a random wiggle** ("jitter") so a thousand clients don't all retry on the exact same tick and stampede the provider together. |
| **A maximum retry count** | Retries are *bounded* — after N tries, give up gracefully and show the friendly "we're busy" message. Infinite retries are how a blip becomes a bill. |
| **A bounded queue** | The waiting line has a *size limit*. When it's full, new work fails fast with a calm message rather than growing forever and eating all your memory. |
| **Idempotency keys** for expensive/charging actions | Send a unique key with any call that **charges money or generates something costly**, so if a retry fires for a call that *actually succeeded*, the provider de-dupes it instead of double-charging or double-generating. (Stripe and most AI providers support this — see `PAYMENTS_GUIDE.md`.) |
| **A global circuit breaker / spend kill switch** | One account-wide switch: if daily spend or the error rate crosses a threshold, **pause the expensive work entirely** and show users a friendly message. This is the backstop that turns a 4 a.m. abuse run from an existential invoice into a paused feature. |
| **Spend alerts at 50 / 80 / 100% of budget** | Get pinged *before* you hit the ceiling, not after the invoice. Three alerts, one per threshold. |

> **🤖 AI CAN DO THIS:** *"Make my API retry logic honor the `Retry-After` header, use exponential backoff with jitter, cap retries at a max count, and put requests through a bounded queue that fails gracefully when full. Add idempotency keys to every paid/charging call, a global circuit breaker that pauses expensive work when daily spend or error rate crosses a threshold, and spend alerts at 50%, 80%, and 100% of my budget."*

> 🧒 *Newbie note:* a 429 doesn't mean "something broke" — it means "wait a sec." The danger is code that hears "wait a sec" and instead screams the request a thousand times. **Wait the amount it told you to, add a little randomness so you're not stampeding with everyone else, and put a hard stop on both retries and spend.** This is the same machinery as the per-user limits in `SECURITY_GUIDE.md` and the rate-limiting knowledge it cross-links — pointed at *your own* outbound calls instead of incoming users.

---

## 6. It's not just AI — other ramped limits (adjacent)

AI is the loudest example, but the same "ramps over time, can't be rushed with money" pattern shows up across your whole stack. Start each one early:

| Service | The ramp | Cross-ref |
|---|---|---|
| **Email** | Daily send caps + a **reputation warm-up** — new sending domains start tiny and earn volume over days/weeks | `EMAIL_GUIDE.md` |
| **SMS** | **A2P 10DLC registration** must clear before you can send at volume — that's a multi-week approval, not a toggle | — |
| **Payments (Stripe)** | New accounts have a processing ramp and may face **reserves / rolling holds** until they build history | `PAYMENTS_GUIDE.md` |
| **Push notifications** | Per-app sending quotas on APNs/FCM | — |

All of these **ramp over time** — they reward accounts that started early and built a track record. Fire them off on day zero alongside your store and Stripe signups (`DEV_SETUP_GUIDE.md`, the day-zero-signups guide).

> 🧒 *Newbie note:* notice the pattern across every one of these — email, SMS, payments, AI. **The provider trusts you more as you age.** New = throttled. So the cheapest thing you can do today is *exist* on these services so the trust clock starts.

---

## 7. Budget the spend, too

Higher tiers and heavy AI usage cost **real money at scale**. A single AI call can be cheap; ten thousand of them in an hour during a launch spike (or an abuse run) is a bill that can make your eyes water.

- **Model your per-user cost** — roughly, what does one active user cost you in API calls per day? Multiply by your launch numbers.
- **Set spend caps** on each provider so a traffic spike — or an attacker hammering your endpoint — can't produce a surprise four-figure invoice.
- This ties straight to the **AI usage-cap** point in `SECURITY_GUIDE.md`: the same per-user quota that protects your rate limit also protects your *wallet*.

> 🧒 *Newbie note:* a spend cap is a smoke alarm, not a straitjacket. Set it; you can always raise it on purpose. Far better than discovering the bill after the fact.

---

## 8. The Gotchas (what actually bites newbies)

- **Assuming "I'll just pay for more" unlocks capacity instantly.** It doesn't. The per-minute ceiling is on the provider's clock, not your card. Plan around it.
- **Launching on a day-1 account at the lowest tier.** A brand-new account is *always* at the bottom tier, fully funded or not. Age it before launch.
- **No per-user quota.** A handful of heavy users (or one abuser) burns the whole account's provider limit, and *everyone else* gets throttled. Add per-user limits.
- **No fallback or queue, so a 429 = downtime.** One "Too Many Requests" shouldn't take your app down. Queue, retry, and fall back.
- **Forgetting email/SMS/Stripe ramps until launch week.** These take *weeks* to warm up or get approved. Start them on day zero, not on launch eve.

---

## 9. Launch checklist (copy into your tracker)

```
API LIMITS & CAPACITY
[ ] Providers picked early; accounts opened on day zero (🔴)
[ ] Read each provider's rate-limit / usage-tier docs — know my RPM/TPM (🔴)
[ ] Started real usage + small payments EARLY to age the account + climb tiers (🔴)
[ ] Requested a rate-limit increase ahead of launch (form + lead time) (🔴)
[ ] Estimated peak RPM/TPM at launch traffic; confirmed my tier covers it (🔴)
[ ] Per-user rate limits + usage quotas in place (🤖) — see SECURITY_GUIDE
[ ] Queue + backoff/retry on 429s (🤖)
[ ] Retry honors Retry-After + exponential backoff WITH jitter (🤖)
[ ] Retries are bounded (max count); queue is bounded (fails gracefully) (🤖)
[ ] Idempotency keys on expensive/charging calls — no double-charge on retry (🤖)
[ ] Global circuit breaker / spend kill switch wired (🤖)
[ ] Spend alerts at 50% / 80% / 100% of budget (🤖)
[ ] Caching for repeated results (🤖)
[ ] Batching where possible (🤖)
[ ] Fallback model / second provider (multi-provider) wired (🤖)
[ ] Friendly "we're busy, try again" message instead of a crash (🤖)
[ ] Email sending domain warm-up started (🔴) — see EMAIL_GUIDE
[ ] SMS A2P 10DLC registration started if sending SMS (🔴)
[ ] Stripe account opened early; aware of ramp/reserves (🔴) — see PAYMENTS_GUIDE
[ ] Per-user cost modeled; spend caps set on every provider (🔴)
```

---

## 10. Plain-English glossary

- **RPM** — requests per minute: how many separate API calls you may make each minute.
- **TPM** — tokens per minute: how much text (input + output combined) an AI model lets you push through each minute. "Tokens" ≈ chunks of words.
- **Usage tier** — a level (e.g. OpenAI Tier 1→5) that sets your rate/spend caps; you climb it with account age + cumulative spend.
- **Rate limit** — any cap on how fast/much you can call (RPM, TPM, concurrency, spend).
- **429 / "Too Many Requests"** — the HTTP error a provider returns when you cross a rate limit. Your code should catch it and retry, not fail.
- **Quota** — an allowance (per user, per day, per month) you set or the provider sets.
- **Backoff / retry** — when you hit a limit, wait a moment (often a *growing* wait — "exponential backoff") then try again.
- **Retry-After** — a header a provider can send with a 429/503 that tells you *exactly* how long to wait before retrying. Obey it instead of guessing.
- **Jitter** — a small random delay added to backoff so many clients don't all retry on the same tick and stampede the provider together.
- **Retry storm** — what happens when naive retry code reacts to a limit by hammering harder, multiplying traffic and cost instead of backing off.
- **Idempotency key** — a unique token you attach to an expensive/charging call so that if a retry fires for one that already succeeded, the provider de-dupes it instead of double-charging or double-generating.
- **Circuit breaker / kill switch** — an account-wide stop that pauses expensive work when daily spend or the error rate crosses a threshold, so a spike or abuse run can't run up the bill.
- **Queue** — a waiting line for outgoing API calls so you release them at a safe pace instead of all at once.
- **Fallback provider** — a backup model or second provider you switch to when your primary is rate-limited or down.
- **Warm-up** — the slow build of trust/volume on a new account (especially email), where caps rise as you prove good behavior over time.

---

## 11. Official sources (verify the latest — numbers change constantly)

- **OpenAI — Rate limits:** https://platform.openai.com/docs/guides/rate-limits
- **OpenAI — Usage tiers:** https://platform.openai.com/docs/guides/rate-limits/usage-tiers
- **Anthropic — Rate limits:** https://docs.anthropic.com/en/api/rate-limits
- **Google Gemini — Rate limits:** https://ai.google.dev/gemini-api/docs/rate-limits

> **Important:** the exact RPM/TPM numbers, tier thresholds, and dollar caps **change constantly** and differ per model. The numbers in this guide (including the ~450k TPM example) are illustrative. **Your provider's own dashboard is the only source of truth** for what *your* account can do right now — check it.

---

*Part of the **lastmile launch guides** (`.claude/lastmile/guides/`) — reusable, plain-language launch playbooks for newbie vibe coders. See `README.md` for the shared preamble, and the sibling guides `SECURITY_GUIDE.md`, `EMAIL_GUIDE.md`, `PAYMENTS_GUIDE.md`, and `DEV_SETUP_GUIDE.md` referenced above. **Last reviewed: 2026-06.** Provider tiers and numbers change constantly — check your provider's dashboard.*
