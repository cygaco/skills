---
guide: WEB_SECURITY_HEADERS_CSRF_CORS
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: standard
maps_to: [web-hardening, supply-chain]
sources:
  - "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html"
  - "https://owasp.org/www-project-secure-headers/"
  - "https://portswigger.net/web-security/cors"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
  - "https://owasp.org/Top10/2025/"
  - "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html"
  - "https://helmetjs.github.io/"
---

# Web Hardening — Security Headers, CSRF, CORS, Sessions & Supply Chain

**The browser will enforce a large set of defenses for you — but only if the server *opts in* via the right response headers, cookie flags, and cross-origin policy, and only if the dependency supply chain delivering that server code is itself trustworthy. This is the hardening layer: send the security headers (CSP, HSTS, nosniff…), flag auth cookies HttpOnly+Secure+SameSite, protect cookie-authenticated state-changing requests against CSRF, lock CORS to a server-side origin allowlist (never `*`-with-credentials, never reflect an arbitrary Origin), verify JWTs/sessions properly, and pin + audit dependencies — because in 2025 the npm registry itself became a primary attack vector.**

This guide trains your AI on the web-platform hardening controls and the **software supply chain** — grounded in the OWASP Secure Headers project, the OWASP cheat sheets, PortSwigger's CORS research, and **OWASP A03:2025 Software Supply Chain Failures** (a newly elevated category). These defects are configuration-shaped: a missing header, a `*` CORS origin, a non-HttpOnly cookie, an unpinned dependency. Each has a known-good setting, and most are deterministically checkable.

---

## 1. What this is

This is the **defense-in-depth perimeter** of a web app — the controls that live in response headers, cookie attributes, cross-origin configuration, token/session handling, and the dependency pipeline. Unlike injection (a code-path bug), these are largely **policy/configuration** decisions the browser or registry enforces on your behalf. The scope:

- **Security response headers** — Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, X-Frame-Options / `frame-ancestors`, typically set with **Helmet** (Express) or framework middleware.
- **Cookies** — `HttpOnly`, `Secure`, `SameSite` on session/auth cookies.
- **CSRF** — protecting cookie-authenticated, state-changing requests against forged cross-site requests.
- **CORS** — controlling which cross-origin sites may read your responses, and whether credentials are allowed.
- **JWT / session integrity** — verifying tokens and managing their lifetime (OWASP **A07:2025 Authentication Failures**).
- **Software supply chain** — pinning, auditing, and updating dependencies (OWASP **A03:2025 Software Supply Chain Failures**).

---

## 2. Why it matters

**For users and the product:** the browser is a powerful ally that does nothing unless told. Without **HSTS**, a user is one downgrade/MITM away from a plaintext session. Without **CSP**, an injected script runs freely. Without **HttpOnly**, any XSS trivially steals the session cookie. A wildcard or origin-reflecting **CORS** policy lets a malicious site read authenticated responses. Missing **CSRF** protection lets an attacker's page silently perform state-changing actions as the logged-in user. A mis-verified **JWT** (skipped signature, ignored `exp`) is an authentication bypass. And the **supply chain**: in 2025 the npm registry saw a major attack wave — the September 2025 **chalk/debug** maintainer-phishing compromise injected malware into packages with **billions of weekly downloads** (180+ packages affected), and the year saw hundreds of thousands of malicious packages published — so an unpinned, unaudited `npm install` can pull a backdoor straight into your build.

**For a security review specifically:**
- This guide owns the **`web-hardening`** and **`supply-chain`** vocabulary. Use it when configuring the middleware and the dependency policy, correcting misconfigurations, and reviewing header/cookie/CORS/JWT/dependency posture.
- This is a **high-precision, mostly-deterministic** axis: presence/absence of a header, a `*` CORS origin, a missing cookie flag, an unpinned dependency or absent lockfile are all directly checkable.
- The judgment layer is **correctness, not presence**: a CSP that allows `unsafe-inline` is present-but-weak; a CORS allowlist that *reflects* the Origin is just as exploitable as `*`; an HSTS with a 60-second `max-age` is technically present but useless. Your AI must check the *value*, not just the header name.

---

## 3. Core principles / techniques

### 3.1 Security response headers (Helmet-style)

Set these on every response (Helmet sets most by default; tune them):
- **Content-Security-Policy (CSP)** — the strongest XSS/clickjacking defense-in-depth. Use **`default-src 'self'`** and an explicit allowlist of sources; control framing with **`frame-ancestors 'self'`** (the modern replacement for X-Frame-Options). Avoid `unsafe-inline`/`unsafe-eval`; prefer nonces/hashes for any inline script.
- **Strict-Transport-Security (HSTS)** — force HTTPS: **`max-age=63072000; includeSubDomains; preload`** (two years, subdomains, preload-eligible). A tiny `max-age` defeats the purpose.
- **X-Content-Type-Options: `nosniff`** — stop MIME-sniffing (which can turn an uploaded text file into executable script).
- **Referrer-Policy** — e.g. `strict-origin-when-cross-origin` / `no-referrer` to avoid leaking URLs (which may carry tokens) to third parties.
- **X-Frame-Options: `DENY`/`SAMEORIGIN`** (legacy clickjacking) — superseded by CSP `frame-ancestors`; set both for coverage.

### 3.2 Cookie flags

Auth/session cookies must carry:
- **`HttpOnly`** — JavaScript can't read it (neutralizes cookie theft via XSS).
- **`Secure`** — sent only over HTTPS.
- **`SameSite=Strict`** (or `Lax` when top-level cross-site navigation must stay logged in) — the browser withholds the cookie on cross-site requests, which is itself a strong CSRF defense.

### 3.3 CSRF

CSRF abuses the browser's habit of auto-attaching **cookies** to cross-site requests, letting an attacker's page trigger a state-changing action as the victim. Defenses, layered:
- **`SameSite` cookies** (Strict/Lax) block the cross-site cookie attachment for most cases — the first line.
- An **anti-CSRF token** (synchronizer token or double-submit) on every **cookie-authenticated, state-changing** request (POST/PUT/PATCH/DELETE), validated server-side.
- **Bearer-token APIs are largely immune** — if auth is an `Authorization: Bearer` header that the browser does *not* auto-attach (and there's no ambient cookie), there's nothing to forge. The CSRF requirement applies specifically to **cookie-based** auth.

### 3.4 CORS — allowlist, never reflect

CORS controls which cross-origin sites may *read* your responses. The pitfalls:
- **Never `Access-Control-Allow-Origin: *` together with credentials** — and note the browser actually forbids `*`+credentials, so the dangerous workaround developers reach for is reflecting the Origin header.
- **Reflecting the `Origin` header back as `Access-Control-Allow-Origin` (with `Allow-Credentials: true`) is *equally* exploitable** — it effectively trusts every origin, so any malicious site can make credentialed cross-origin reads. This is the #1 CORS misconfiguration.
- **Use a server-side origin allowlist:** compare the incoming `Origin` against a fixed list and echo it back only on a match; otherwise omit the header. Never trust `null`, never use loose substring/regex matches that a lookalike domain can satisfy.

### 3.5 JWT / session integrity (A07:2025)

For token-based auth:
- **Verify the signature** with the expected algorithm — reject `alg: none` and don't let the token dictate the algorithm (algorithm-confusion).
- **Validate the claims** — `exp` (not expired), and `aud`/`iss` where applicable.
- **Short-lived access tokens + rotating refresh tokens** — minimize the window a stolen token is useful; support revocation.
- **Prefer HttpOnly cookies over `localStorage`** for browser token storage — `localStorage` is readable by any XSS; an HttpOnly cookie is not (paired with CSRF protection).

### 3.6 Software supply chain (A03:2025 — NEW, elevated)

Newly elevated in the 2025 OWASP top 10 because the registry became an attack vector:
- **Commit lockfiles** (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`) and install with **`npm ci`** (exact, lockfile-pinned, reproducible) — never an unpinned `npm install` in CI/production.
- **Automate updates with review:** Dependabot / Renovate, ideally with a **cooldown / minimum-package-age** so you don't auto-merge a version published an hour ago (the exact window a compromised release lives in before takedown).
- **Audit:** `npm audit` / `osv-scanner` in CI; fail on known-critical advisories.
- **Be aware of the 2025 npm attack wave** — the September 2025 chalk/debug maintainer-phishing campaign (180+ packages, billions of weekly downloads) and the broader flood of malicious packages mean "popular and widely-used" is **not** a safety guarantee. Pin, age, and audit.

> **The trade-off (lock vs. freshness):** pinning + a min-age cooldown delays security *patches* slightly in exchange for not ingesting a *freshly compromised* release. The resolution is automation *with* review and a cooldown — not "auto-merge everything instantly" (ingests attacks) and not "never update" (rots on known CVEs). Reproducible (`npm ci`) + reviewed + aged is the balance.

---

## 4. Concrete examples (build terms — Node/Express + Next.js)

**Security headers (Helmet) — DON'T / DO**
- DON'T: no Helmet; default headers; framing/MIME/HTTPS all unset.
- DO:
  ```js
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], frameAncestors: ["'self'"] } },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }));
  // Helmet also sets X-Content-Type-Options: nosniff, Referrer-Policy, etc.
  ```

**Cookies — DON'T / DO**
- DON'T: `res.cookie("session", id)` — readable by JS, sent over HTTP, attached cross-site.
- DO: `res.cookie("session", id, { httpOnly: true, secure: true, sameSite: "strict" })`.

**CORS — DON'T / DO**
- DON'T: `cors({ origin: true, credentials: true })` (reflects any Origin) or `Access-Control-Allow-Origin: *` with credentials.
- DO: allowlist explicitly —
  ```js
  const allow = new Set(["https://app.example.com"]);
  app.use(cors({ origin: (o, cb) => cb(null, !o || allow.has(o)), credentials: true }));
  ```
  Echo the Origin only on an exact allowlist match.

**CSRF — DON'T / DO**
- DON'T: cookie-session app with no CSRF token on POST/PUT/DELETE.
- DO: `SameSite=Strict/Lax` cookies **plus** a synchronizer/double-submit token validated on every state-changing cookie-auth request. (A pure `Authorization: Bearer` API with no auth cookie needs no token.)

**JWT — DON'T / DO**
- DON'T: `jwt.decode(token)` (no verification) or `verify(token, key, { algorithms: ["none"] })`; storing the token in `localStorage`.
- DO: `jwt.verify(token, key, { algorithms: ["RS256"], audience, issuer })`, check `exp`; short-lived access + rotating refresh; store in an HttpOnly cookie.

**Supply chain — DON'T / DO**
- DON'T: `npm install` in CI with no committed lockfile; auto-merge dependency PRs instantly.
- DO: commit the lockfile, `npm ci` in CI/prod, enable Renovate/Dependabot with a cooldown + `npm audit` gate.

---

## 5. Common failure modes

| Failure | How it reads to the attacker | How to detect |
|---|---|---|
| Missing security headers (CSP/HSTS/nosniff) | Inject script (no CSP); downgrade to HTTP (no HSTS); MIME-sniff an upload into script | No Helmet/middleware; responses lack `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options` |
| Weak CSP (`unsafe-inline`/`unsafe-eval`, no `default-src`) | Injected inline script still runs | CSP present but permits `'unsafe-inline'`/`'unsafe-eval'` or has no `default-src`/`frame-ancestors` |
| HSTS with tiny `max-age` | Downgrade window stays open | `Strict-Transport-Security` present but `max-age` is short / missing `includeSubDomains` |
| Auth cookie not HttpOnly/Secure/SameSite | XSS steals the session cookie; cross-site requests carry it | Session/auth cookie set without `HttpOnly` + `Secure` + `SameSite` |
| CORS `*` + credentials, or Origin reflection | Any site reads authenticated responses | `Access-Control-Allow-Origin: *` with credentials, or the server echoes back the request `Origin` / `origin: true` |
| Loose CORS origin match | A lookalike domain passes the check | Substring/regex origin match instead of an exact allowlist set; `null` origin accepted |
| No CSRF protection on cookie auth | Attacker's page performs actions as the victim | Cookie-authenticated state-changing route with no SameSite + no anti-CSRF token |
| JWT not verified / `alg: none` / no `exp` check | Forge a token → auth bypass | `jwt.decode` without `verify`; `algorithms: ["none"]`; `exp`/`aud`/`iss` unchecked; token in `localStorage` |
| Long-lived tokens, no rotation/revocation | A stolen token works indefinitely | Access token with a very long/absent expiry; no refresh rotation |
| Unpinned deps / no lockfile / `npm install` in CI | A compromised release lands in your build | No committed lockfile; `npm install` (not `ci`) in CI/prod; no audit step |
| Auto-merge deps instantly, no cooldown | You ingest a freshly compromised version | Dependabot/Renovate auto-merge with no min-package-age/cooldown; no `npm audit` gate |

**The detectability caveat (important for an automated review):** presence/absence is highly deterministic — missing header, `*` CORS, missing cookie flag, absent lockfile, `npm install` in CI are all greppable. The **judgment** layer is *value correctness*: a CSP can be present but neutered (`unsafe-inline`), an HSTS present but useless (60s), a CORS allowlist present but reflecting/substring-matching, a JWT verified but with `none` allowed. Your AI must read the *value and the auth model* (cookie vs bearer dictates whether CSRF even applies), not just confirm the header/middleware exists.

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion a security review can apply. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Headers**
- **[WEBSEC-01] serious — Security headers are set on responses: CSP (with `default-src`/`frame-ancestors`, no `unsafe-inline`/`unsafe-eval`), HSTS (`max-age` ≥ ~1 year + `includeSubDomains`), `X-Content-Type-Options: nosniff`, and Referrer-Policy.** → `web-hardening`. Detect: no Helmet/middleware, or any of these headers missing, or a CSP permitting `unsafe-inline`/`unsafe-eval`, or HSTS `max-age` too short = FAIL/WARN (observed: defaults only; expected: explicit hardened values).
- **[WEBSEC-07] minor — Framing is restricted via CSP `frame-ancestors` (and legacy `X-Frame-Options`) to prevent clickjacking.** → `web-hardening`. Detect: no `frame-ancestors` and no `X-Frame-Options` on a UI-serving app = WARN.

**Cookies & CSRF**
- **[WEBSEC-02] serious — Auth/session cookies are `HttpOnly` + `Secure` + `SameSite=Strict/Lax`.** → `web-hardening`. Detect: a session/auth cookie set without all three flags = FAIL (observed: `res.cookie("session", id)`; expected: `{ httpOnly, secure, sameSite }`).
- **[WEBSEC-04] serious — Cookie-authenticated, state-changing requests are CSRF-protected (SameSite + anti-CSRF token); pure bearer-token APIs are exempt.** → `web-hardening`. Detect: a cookie-auth POST/PUT/PATCH/DELETE route with no SameSite and no anti-CSRF token = FAIL; a bearer-only API flagged for CSRF = false positive (don't flag).

**CORS**
- **[WEBSEC-03] serious — CORS uses a server-side origin allowlist with exact matching; never `Access-Control-Allow-Origin: *` with credentials, and never reflects an arbitrary Origin.** → `web-hardening`. Detect: `origin: true`/Origin-reflection with credentials, `*`+credentials, `null` accepted, or substring/regex origin matching = FAIL.

**Tokens / sessions (A07:2025)**
- **[WEBSEC-05] serious — JWTs/sessions are verified (signature with a pinned algorithm — `alg: none` rejected; `exp`/`aud`/`iss` validated), short-lived with rotating refresh, and stored in HttpOnly cookies rather than `localStorage`.** → `web-hardening`. Detect: `jwt.decode` without `verify`, `algorithms: ["none"]`, unchecked `exp`, long-lived tokens, or tokens kept in `localStorage` = FAIL/WARN.

**Supply chain (A03:2025)**
- **[WEBSEC-06] serious — Dependencies are pinned via a committed lockfile and installed with `npm ci` (reproducible); not `npm install` in CI/prod.** → `supply-chain`. Detect: no committed lockfile, or `npm install` used in CI/Dockerfile/prod = FAIL.
- **[WEBSEC-08] minor — Automated dependency update + audit tooling is on (Dependabot/Renovate) with a cooldown/min-package-age and an `npm audit`/scanner gate; no instant auto-merge.** → `supply-chain`. Detect: no update automation, or auto-merge with no min-age/cooldown, or no audit step in CI = WARN (2025 npm attack-wave context).

**CI/CD perimeter, exposed surfaces & OAuth**
- **[WEBSEC-09] serious — GitHub Actions / workflows are least-privilege and pinned, and workflow-file changes are reviewed.** → `supply-chain`. Detect: `permissions: write-all` (or a default-write token where read-only suffices), third-party actions referenced by tag (`@v1`) instead of a full commit SHA, or workflow-file changes that can merge without review = FAIL (a compromised/over-permissioned pipeline reads prod secrets and ships code; complements WEBSEC-06/08).
- **[WEBSEC-10] serious — Dependency updates have review, a min-age/cooldown, and no instant auto-merge to prod.** → `supply-chain`. Detect: Dependabot/Renovate configured to auto-merge new package versions immediately with no tests and no min-package-age cooldown = FAIL/WARN (you ingest a freshly compromised release before takedown; the enforced form of WEBSEC-08).
- **[WEBSEC-11] serious — Admin / debug / staging endpoints are not publicly exposed.** → `web-hardening`. Detect: `/admin`, `/debug`, `/api/dev`, a framework debug console (e.g. stack-trace/`__debug__` route), or a staging DB/host reachable without strong auth = FAIL.
- **[WEBSEC-12] serious — OAuth/OIDC clients use current security controls.** → `web-hardening`. Detect: missing `state`/`nonce`/PKCE, wildcard or loose redirect-URI matching, or an ID token whose `iss`/`aud`/`exp` claims are not validated = FAIL (login-CSRF / account-binding takeover; pairs with WEBSEC-05).
- **[WEBSEC-13] minor — `Permissions-Policy` is set, and CSP is rolled out report-only before enforcement where needed.** → `web-hardening`. Detect: no `Permissions-Policy` restricting powerful features (camera/mic/geolocation/etc.), or a CSP shipped straight to enforce with no `Content-Security-Policy-Report-Only` testing phase so it breaks or gets disabled = WARN (extends WEBSEC-01).

> **Coverage note for a review:** presence/absence rules ([WEBSEC-01..03, 06]) are largely machine-detectable — high precision — and WEBSEC-09 (workflow `permissions`/unpinned-action inspection), WEBSEC-10 (auto-merge/cooldown config), and WEBSEC-13 (`Permissions-Policy` header present) are similarly inspectable. The *correctness* qualifiers (CSP strength, HSTS `max-age`, exact-vs-reflecting CORS, JWT verification details, cookie-vs-bearer CSRF applicability, cooldown policy) and WEBSEC-11 (is an exposed admin/debug/staging surface actually reachable without strong auth?) and WEBSEC-12 (state/nonce/PKCE + exact redirect + validated claims) are judgment-shaped — written as assertions so a reasoning reviewer can read the *value and auth model*, not just the header name, at build time.

---

## 7. Sources

- OWASP — *HTTP Security Response Headers Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html (CSP, HSTS, nosniff, Referrer-Policy, frame-ancestors)
- OWASP — *Secure Headers Project* — https://owasp.org/www-project-secure-headers/ (recommended header set + values)
- PortSwigger — *Cross-origin resource sharing (CORS)* — https://portswigger.net/web-security/cors (Origin-reflection and `*`+credentials exploits; allowlist guidance)
- OWASP — *CSRF Prevention Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html (SameSite + synchronizer/double-submit token; bearer-token exemption)
- OWASP — *Top 10 Web (2025)* — https://owasp.org/Top10/2025/ (A03:2025 Software Supply Chain Failures — NEW/elevated; A07:2025 Authentication Failures)
- OWASP — *JSON Web Token Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html (signature/alg verification, claim validation, storage)
- Helmet — *Express security headers middleware* — https://helmetjs.github.io/ (default and configurable header set)
- npm supply-chain 2025 — the September 2025 chalk/debug maintainer-phishing compromise (180+ packages, billions of weekly downloads) and the broader malicious-package wave (provenance for A03:2025 urgency)
