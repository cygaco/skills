---
guide: RATE_LIMITING_AND_ABUSE
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [rate-limiting, authz]
sources:
  - "https://genai.owasp.org/llm-top-10/"
  - "https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/"
  - "https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"
  - "https://upstash.com/docs/redis/sdks/ratelimit-ts"
  - "https://www.microsoft.com/en-us/security/blog/2019/08/20/one-simple-action-you-can-take-to-prevent-99-9-percent-of-account-attacks/"
---

# Rate Limiting & Abuse Prevention

**Every expensive or authentication-sensitive endpoint must enforce a server-side limit on *how fast* and *how much* a caller can consume it — a per-request cap, a per-user/per-tier usage quota, and (for auth routes) throttling with lockout/backoff. Without these, an AI endpoint becomes runaway cost (OWASP LLM10:2025 Unbounded Consumption / API4:2023 Unrestricted Resource Consumption) and a login route becomes a brute-force / credential-stuffing target.**

This guide trains your AI to distinguish *rate limiting* (requests per unit time) from *usage quotas* (total spend/tokens/count per user per period), to apply both to AI/LLM and other costly endpoints, to harden auth routes with account-keyed lockout + CAPTCHA + MFA, and to insist every limit is enforced **server-side** — never in the UI.

---

## 1. What this is

Three related controls, often conflated:

- **Rate limiting** — caps the *frequency* of requests (e.g. 10/min per user). Defends throughput, smooths spikes, blunts brute-force.
- **Usage quotas** — cap the *total consumption* over a window (e.g. tokens/spend/request-count per user per day/week), typically **scaled by paid tier**. Defends *cost* — the dimension rate limiting alone misses, because a slow-but-relentless caller can still rack up an enormous bill under a per-minute cap.
- **Brute-force / abuse defense** — for auth and other sensitive flows: throttle + lock out + back off after a few failures, add CAPTCHA, require MFA.

The relevant standards:
- **OWASP LLM10:2025 Unbounded Consumption** — an LLM app that lets users drive inference without limits on volume/cost; leads to denial-of-wallet (runaway spend), DoS, and model/resource abuse.
- **OWASP API4:2023 Unrestricted Resource Consumption** — APIs that don't bound the resources a request/caller can consume (no rate limit, no quota, unbounded payloads/results) → DoS and cost blowups.
- **Credential stuffing / brute force** — attackers replay breached username/password pairs (stuffing) or guess (brute force) against login; defended per the OWASP Credential Stuffing + Authentication cheat sheets.

This domain owns `rate-limiting` and intersects `authz` (auth-route hardening, tier enforcement). It applies whenever you build, fix or review these limits.

---

## 2. Why it matters

Uncapped expensive endpoints fail in two directions at once: an attacker (or a buggy client, or a viral spike) drives **cost** to ruin — "denial of wallet" on a metered LLM/API is a real, fast way to lose money — and drives **availability** to zero for legitimate users. Auth routes fail differently: without throttling, automated tools test thousands of breached credentials per minute, and stuffing succeeds because password reuse is rampant. Microsoft's data shows **MFA blocks ~99.9% of automated account-compromise attacks** — the single highest-leverage auth control.

**Why the AI generation makes this acute:** LLM calls are individually expensive and the cost is unbounded by default. A single chat endpoint with no per-request output cap and no per-user quota is one scripted loop away from a five-figure bill. "It works in the demo" hides this completely — the limit only matters under adversarial or accidental load, which the happy path never exercises.

**For a security review specifically:** you must verify *both* axes on every expensive endpoint — a per-request cap (max input/output tokens, max payload, max results) **and** a per-user/per-tier usage quota — and that *both* are enforced **server-side**, where the attacker can't bypass them. A common false-pass: the UI shows "5 of 10 used" but the server doesn't actually enforce it, so a direct API call ignores the quota entirely. For auth routes, verify lockout/backoff keyed on the **account** (not just IP, which distributed stuffing trivially rotates), plus CAPTCHA and MFA availability. The §6 rules make each of these an independent PASS/FAIL.

---

## 3. Core principles / techniques

### 3.1 Two axes: rate limit AND quota

- **Rate limit** (frequency): "≤ N requests per window per principal." Blunts bursts and brute force.
- **Quota** (volume/cost): "≤ M tokens / $X / K calls per principal per period," **tier-aware** (free vs paid vs enterprise get different M). This is the control that caps the *bill*. Rate limiting without a quota still allows a steady drip to exhaust budget; a quota without a rate limit still allows a damaging burst. **Expensive endpoints need both.**

### 3.2 Per-request caps for AI/LLM endpoints (LLM10 specifics)

Bound a *single* call so one request can't be pathological:
- **max input tokens** (reject/trim oversized prompts) and **max output tokens** (`max_tokens` on the completion) — uncapped output is the classic cost leak.
- **timeouts** and **max payload/result size**; reject unbounded `limit`/pagination.
- Consider **input validation** against prompt-bombing (huge or deeply nested inputs).

### 3.3 Per-user / per-tier usage quotas

Track consumption per authenticated principal over a window and enforce the cap before serving:
- Meter tokens or spend or request count; store the running counter (Redis/DB) keyed by user (and tenant).
- **Scale by tier** — e.g. free = small weekly cap, paid = larger, enterprise = negotiated. Enforce the tier limit **server-side from the authenticated identity**, not from a client-sent tier field.
- Return a clear `429` (or a quota-specific error) with `Retry-After`/reset metadata when exceeded.

### 3.4 Algorithms & tooling

- **Token bucket** — tokens refill at a steady rate; each request spends one; allows controlled bursts up to the bucket size. Good general default.
- **Sliding window** — counts requests in a moving time window; smoother than a fixed window (which allows a double-burst at the boundary).
- **Fixed window / leaky bucket** — simpler variants; fixed window has the boundary-burst weakness.
- **Tooling:** **Upstash Ratelimit** (serverless, Redis-backed, supports token-bucket/sliding-window, ideal for edge/serverless Node/Next) for app-level limits; **Cloudflare / a WAF / API gateway** for edge-level limits and bot mitigation. App-level and edge-level are complementary — edge stops volumetric floods, app-level enforces per-user/per-tier semantics the edge can't see.

### 3.5 Auth-route hardening (brute force / credential stuffing)

- **Throttle + lockout/backoff** after a **small** number of failed logins (~5), using progressive delay or temporary lock. Apply to **login, password-reset, OTP/verify, and signup**.
- **Key the failure counter on the ACCOUNT, not just the IP.** IP-only counters are defeated by distributed credential stuffing (a botnet rotates IPs); account-keyed (plus IP as a secondary signal) catches "many attempts against one account from many IPs." Mitigate lockout-as-DoS with backoff/CAPTCHA rather than hard permanent locks.
- **CAPTCHA** as a step-up after suspicious activity (raises automation cost).
- **MFA** for sensitive accounts — the strongest single control (~99.9% of automated attacks stopped). Prefer it available/required on privileged accounts.
- Generic error messages ("invalid credentials," never "no such user") to avoid username enumeration; same response timing.

### 3.6 Server-side, always

Every limit and quota is enforced on the server. UI gating (a disabled button, a client-side counter, a hidden tier) is UX, not enforcement — an attacker calls the endpoint directly. The authenticated identity and tier come from the server session/JWT, never a client field.

---

## 4. Concrete examples (build terms)

**AI endpoint with no caps — DON'T / DO (Next.js route + Upstash)**
- DON'T: `app/api/chat/route.ts` calls the model with the raw user prompt, no `max_tokens`, no per-user limit — one loop = denial-of-wallet.
- DO: cap the request and meter the user:
  ```ts
  import { Ratelimit } from "@upstash/ratelimit";
  import { Redis } from "@upstash/redis";
  const limit = new Ratelimit({ redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m") });        // rate limit
  const userId = session.user.id;                           // server identity
  const { success } = await limit.limit(userId);
  if (!success) return new Response("Rate limit", { status: 429 });
  if (await weeklyTokensUsed(userId) > tierQuota(user.tier))// usage quota, tier-aware
    return new Response("Quota exceeded", { status: 429 });
  await openai.chat.completions.create({ max_tokens: 1024, /* per-request cap */ … });
  ```

**Tier enforced only in the UI — DON'T / DO**
- DON'T: gray out "Generate" when the free quota is hit, but the `/api/generate` handler doesn't check the quota — a direct `curl` ignores it.
- DO: enforce the tier quota **server-side** in the handler from `session.user.tier`; the UI gating is a convenience layer on top.

**Login with no throttling — DON'T / DO**
- DON'T: `/api/login` checks the password and returns, unlimited attempts — brute-forceable.
- DO: increment a failure counter **keyed on the account** (e.g. `login_fail:{email}`), apply backoff/lock after ~5 failures, present a CAPTCHA after suspicious activity, and offer/require MFA. Use a generic "invalid credentials" message and constant-ish timing.

**IP-only counter — DON'T / DO**
- DON'T: `rateLimitByIp(req.ip)` as the only brute-force defense — distributed stuffing rotates IPs and walks right past it.
- DO: count failures per **account** (with IP as a secondary signal), so "one account, many IPs" is caught.

**Edge + app limits — DO**
- DO: a Cloudflare/WAF rule blunts volumetric floods and obvious bots at the edge; the app-level Upstash limit + DB quota enforce per-user/per-tier semantics the edge can't see. Both layers, not one.

---

## 5. Common failure modes

| Failure | How it bites | How to detect |
|---|---|---|
| AI/LLM endpoint with no per-request output cap | One request generates unbounded output; cost/latency blow up | No `max_tokens`/max-output/max-payload on the completion call; unbounded `limit` params |
| Expensive endpoint with no per-user usage quota | Steady scripted use = denial-of-wallet (LLM10 / API4) even under a per-minute cap | No metered counter (tokens/spend/count) per principal; rate limit present but quota absent |
| Quota/tier enforced only in the UI | Direct API call ignores it; free users consume paid volume | Handler has no server-side quota/tier check; UI gating is the only control |
| Tier read from a client-supplied field | User self-upgrades by setting `tier: "enterprise"` in the request | Quota keyed off `req.body.tier`/header instead of session/JWT |
| Login/reset/OTP route with no rate limit or lockout | Brute force / credential stuffing succeeds; account takeover | Auth handler with unbounded attempts, no failure counter, no backoff/lock |
| Brute-force counter keyed on IP only | Distributed stuffing rotates IPs and bypasses it | Failure counter keyed solely on `req.ip`/IP, not the account |
| No CAPTCHA / no MFA on sensitive accounts | Automated attacks proceed unimpeded (~99.9% stoppable by MFA) | No step-up challenge after suspicious activity; MFA unavailable on privileged accounts |
| Username enumeration via error/timing | Attacker maps valid accounts to target stuffing | Different message/timing for "no such user" vs "wrong password" |
| Fixed-window limiter boundary burst | 2× the intended rate at the window edge | Fixed-window algorithm where sliding-window/token-bucket is needed |
| Rate limit only at the edge, not app-level | Per-user/per-tier semantics unenforced; authenticated abuse slips through | WAF/edge rule present but no app-level per-user limit/quota |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Expensive / AI endpoints: rate limit + quota (both axes)**
- **[RATE-01] critical — Every AI/LLM/expensive endpoint enforces BOTH a per-user rate limit AND a usage quota (token/spend/count cap), server-side.** → `rate-limiting`/`authz`. Detect: a costly/LLM endpoint with no per-user rate limit, or no metered usage quota, or limits only client-side = FAIL (OWASP LLM10 / API4; denial-of-wallet).
- **[RATE-06] serious — AI/LLM calls carry per-request caps: bounded `max_tokens`/output, input-size limit, timeout, and bounded result/pagination size.** → `rate-limiting`. Detect: completion call with no `max_tokens`/output cap, or unbounded `limit`/payload = FAIL.
- **[RATE-02] serious — Usage quotas are tier-aware and enforced server-side from the authenticated identity (not UI-gated, not from a client-sent tier).** → `rate-limiting`/`authz`. Detect: tier/quota read from `req.body`/header, or enforced only in the UI while the handler omits the check = FAIL.
- **[RATE-07] minor — Quota/limit exhaustion returns a clear `429` with reset/`Retry-After` metadata rather than a silent failure or 500.** → `rate-limiting`. Detect: over-limit path returns 200/500 or no reset info = WARN.

**Auth-route hardening (brute force / credential stuffing)**
- **[RATE-03] critical — Auth-sensitive routes (login, password-reset, OTP/verify, signup) are rate-limited with lockout/backoff after a small number (~5) of failed attempts.** → `rate-limiting`/`authz`. Detect: auth handler with unbounded attempts / no failure counter / no backoff or lock = FAIL.
- **[RATE-04] serious — The brute-force/failure counter keys on the ACCOUNT (with IP as a secondary signal), not IP-only.** → `rate-limiting`/`authz`. Detect: failure counter keyed solely on IP = FAIL (distributed stuffing bypass).
- **[RATE-05] minor — MFA is available (and encouraged/required) for sensitive/privileged accounts; CAPTCHA step-up exists after suspicious activity.** → `rate-limiting`/`authz`. Detect: no MFA option on privileged accounts, or no step-up challenge after repeated failures = WARN.
- **[RATE-08] minor — Auth responses don't enable username enumeration: generic error message and consistent timing for unknown-user vs wrong-password.** → `rate-limiting`/`authz`. Detect: distinct message/timing per failure cause = WARN.

**Enforcement placement & algorithm**
- **[RATE-09] serious — All rate limits and quotas are enforced server-side (UI gating is never the only control); the principal/tier comes from the server session/JWT.** → `rate-limiting`/`authz`. Detect: only client-side limiting, or limit keyed off a client-controlled identity/tier = FAIL.
- **[RATE-10] minor — The limiter uses a burst-safe algorithm (token-bucket / sliding-window) rather than a naive fixed window; app-level limits complement any edge/WAF layer.** → `rate-limiting`. Detect: fixed-window only (boundary-burst), or edge limit present with no app-level per-user/per-tier enforcement = WARN.

**Spend caps, retry safety & abuse-flow limits**
- **[RATE-11] serious — Expensive-provider usage has a GLOBAL budget cap, spend alerts, and a kill switch / circuit breaker — not only per-user limits.** → `rate-limiting`/`authz`. Detect: per-user rate limits/quotas exist but there is no account-level/app-wide spend guard, no spend alerts (e.g. at 50/80/100% of budget), and no circuit breaker that pauses expensive work when daily spend or error rate crosses a threshold = FAIL/WARN (denial-of-wallet survives per-user caps under many accounts or one viral spike).
- **[RATE-12] serious — Retries are bounded and jittered, queues are bounded, and the provider's `Retry-After` header is honored.** → `rate-limiting`. Detect: an infinite/unbounded retry loop, an unbounded queue, exponential backoff without jitter, or a retry storm on 429/5xx that ignores `Retry-After` = FAIL (bad retry code multiplies traffic and cost).
- **[RATE-13] serious — Email / SMS / OTP / password-reset / signup / invitation flows are abuse-limited per ACCOUNT + IP/device.** → `rate-limiting`/`authz`. Detect: unlimited OTP sends, reset emails, signup attempts, or invitation sends — or limiting on only one of account vs IP/device = FAIL (cost abuse + harassment + enumeration vector; complements RATE-03/04).
- **[RATE-14] serious — Expensive actions are idempotent so a retry cannot double-charge, double-create, double-send, or double-spend credits.** → `rate-limiting`/`authz`. Detect: a payment/generation/send/credit-spend action with no idempotency key, so a retried request repeats the side effect = FAIL.
- **[RATE-15] minor — The limiter's failure mode is safe for costly routes.** → `rate-limiting`. Detect: a Redis/limiter outage causes **unlimited** expensive usage (fail-open) rather than degraded/deny on costly routes = WARN/FAIL depending on the endpoint's cost (fail-closed for the expensive path).

> **Coverage note:** RATE-06/07/10 are largely machine-detectable (presence of `max_tokens`, 429 handling, limiter config), and RATE-12 (retry-loop bounds / jitter / `Retry-After` handling) and RATE-14 (idempotency-key presence) are similarly inspectable in the call path. RATE-01/02/03/04/09 and RATE-11 (global spend guard + kill switch), RATE-13 (per-account+IP abuse-flow limits), and RATE-15 (limiter failure mode) require reading the endpoint→enforcement path (is the quota *actually* checked server-side? is there a global circuit breaker? does the limiter fail open or closed?) and are judgment checks — written as independent assertions a reasoning reviewer can evaluate.

---

## 7. Sources

- OWASP GenAI — *LLM Top 10 (2025)* — https://genai.owasp.org/llm-top-10/ (the LLM risk list, incl. LLM10)
- OWASP GenAI — *LLM10:2025 Unbounded Consumption* — https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/ (per-request caps + per-user quotas; denial-of-wallet)
- OWASP API Security — *API4:2023 Unrestricted Resource Consumption* — https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/ (bound rate, quota, payload, results)
- OWASP — *Credential Stuffing Prevention Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html (MFA, account-keyed lockout, CAPTCHA, defeating distributed stuffing)
- OWASP — *Authentication Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html (lockout/throttling thresholds, generic errors, enumeration)
- Upstash — *Ratelimit (Redis)* — https://upstash.com/docs/redis/sdks/ratelimit-ts (token-bucket / sliding-window limiter for serverless Node/Next)
- Microsoft Security — *One simple action … prevent 99.9% of account attacks* — https://www.microsoft.com/en-us/security/blog/2019/08/20/one-simple-action-you-can-take-to-prevent-99-9-percent-of-account-attacks/ (MFA blocks ~99.9% of automated attacks)
