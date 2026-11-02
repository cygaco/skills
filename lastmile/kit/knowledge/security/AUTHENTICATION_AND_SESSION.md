---
guide: AUTHENTICATION_AND_SESSION
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [auth-session, authz]
sources:
  - "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"
  - "https://www.w3.org/TR/webauthn-3/"
  - "https://www.rfc-editor.org/rfc/rfc9700"
  - "https://owasp.org/Top10/2025/"
  - "https://supabase.com/docs/guides/auth/sessions"
---

# Authentication & Session

**Authentication proves *who* a requester is — and it is the boring, common way real apps get owned. Stolen credentials, a reusable password-reset token, a forgotten admin without MFA, a loose OAuth redirect: each is a full account takeover that no amount of correct authorization can save you from, because the attacker simply *becomes* a legitimate user. The build must treat every login, token, session, and OAuth flow as a trust boundary: managed auth by default, phishing-resistant MFA for anyone privileged, single-use short-lived hashed tokens, rotating expiring server-side sessions, and standards-correct OAuth.**

This guide trains your AI to grade the authentication and session layer — the gate in front of the authorization checks that `AUTHZ_AND_TENANT_ISOLATION.md` owns. A correct `auth.uid()` policy is worthless if the attacker holds a valid session for someone else's `uid`.

---

## 1. What this is

**Authentication** establishes identity: login, MFA, password reset, social/OAuth sign-in, and the **session** that carries that proven identity across subsequent requests. It is upstream of authorization — authz decides what an identity may do, but only *after* authentication has (correctly) established which identity is calling.

Account takeover is consistently among the most common real breach paths, and it rarely needs a clever exploit. The recurring failure classes:

- **Credential & MFA gaps** — a privileged account (founder, admin, support, anyone who can export data or change billing) that can log in with a password alone. One phished or reused password = full compromise.
- **Reset/magic/OTP token flaws** — reset and passwordless tokens that are reusable, long-lived, stored in plaintext, or sendable without limit. A leaked or guessed token is a silent takeover.
- **Weak password storage** — passwords stored with fast/general-purpose hashes (SHA-256, MD5), reversible encryption, or a homegrown scheme. A DB leak becomes a credential dump.
- **Broken sessions** — session IDs that don't rotate across the auth boundary (session fixation), never expire, or live in `localStorage` where any XSS reads them.
- **OAuth/OIDC mistakes** — missing `state`/`nonce`/PKCE, wildcard or loosely-matched redirect URIs, or ID tokens accepted without validating `iss`/`aud`/`exp`. Each enables login CSRF, code injection, or token forgery — i.e. binding the attacker to the victim's account.

This domain owns the `auth-session` vocabulary axis (and touches `authz`, since session integrity is the foundation authorization stands on) and guides building the auth flows, closing the gaps, and asserting the rules in §6.

---

## 2. Why it matters

Authentication is the door. Authorization is the lock on each room inside. If the door's lock is broken, every interior lock is moot — the attacker walks in as a trusted resident. That is why broken authentication sits inside OWASP A07 (Identification and Authentication Failures) and why it produces the highest-impact, lowest-skill compromises: no injection, no RLS gap, just *being* the user.

The AI-assisted indie build amplifies three things:
- **DIY auth looks easy and is not.** A login form is twenty minutes; correct reset-token lifecycle, session rotation, rate limiting, and enumeration-safety are not. Hand-rolled auth re-introduces decades-old bugs.
- **Admin accounts are an afterthought.** The founder's own account often has god-mode access and a password-only login — the single highest-value target with the weakest gate.
- **OAuth "just works" in the happy path.** Drop in "Continue with Google," skip `state`/PKCE/redirect validation, and the app logs you in fine — while a login-CSRF or redirect-hijack takeover is wide open and invisible in normal use.

**For a security review specifically:** you cannot rely on the app "logging in correctly" as evidence the auth layer is safe — the happy path never exercises the missing token expiry, the absent session rotation, or the loose redirect URI. You must affirmatively verify: (a) privileged accounts require phishing-resistant MFA; (b) every reset/magic/OTP token is single-use, short-lived, hashed at rest, and rate-limited; (c) passwords use a memory-hard KDF (Argon2id) or bcrypt, never SHA/homegrown; (d) sessions rotate on every auth/privilege change and carry idle + absolute expiry with `HttpOnly`/`Secure`/`SameSite` cookies, not `localStorage`; (e) OAuth/OIDC validates `state`, `nonce`, PKCE, exact redirect URI, and ID-token claims; (f) responses don't leak whether an account exists. **Strongly prefer a managed auth provider** (Supabase Auth, Clerk, Auth0, WorkOS) — it gets most of §6 right by construction; DIY auth is high-risk security code that must satisfy every rule below by hand. The rules in §6 are written so each is an independently checkable PASS/FAIL.

---

## 3. Core principles / techniques

### 3.1 Managed auth by default; DIY auth is high-risk code

The cheapest large win is **don't build it**. A managed provider handles password storage, token lifecycle, session rotation, MFA, OAuth correctness, and enumeration-safety as a maintained product. If you build auth yourself, you own *all* of §6 — treat that code as the most security-sensitive in the app, and assume a reviewer will grade every token and session against the rules below.

### 3.2 MFA / passkeys — privileged accounts first

- **Require MFA for everyone privileged**: founders, admins, support, and anyone who can export data, change billing, or alter roles. A password-only admin login is a critical finding.
- **Prefer phishing-resistant factors.** WebAuthn/FIDO2 passkeys (and security keys) are bound to the origin and resist phishing and credential replay; TOTP is acceptable; **SMS OTP is the weakest** (SIM-swap, interception) and should not be the only second factor for privileged accounts.
- **Offer MFA/passkeys to ordinary users**, defaulting to the strongest factor the platform supports.

### 3.3 Reset / magic-link / OTP tokens — single-use, short-lived, hashed, rate-limited

Treat every out-of-band token (password reset, magic login, email-verification, OTP) as a bearer credential:
- **Single-use** — invalidated the moment it's consumed *and* invalidated when a new one is issued.
- **Short-lived** — minutes, not days, for OTP/magic links; an hour at the outside for reset links.
- **Stored hashed** — persist a hash of the token, never the raw token, so a DB read can't replay it (same reasoning as password storage).
- **High-entropy** — generated from a CSPRNG, long enough to be unguessable.
- **Rate-limited** — bounded sends per account *and* per IP/device, so an attacker can't spray reset/OTP emails or brute-force a short OTP (this overlaps the abuse rules in `RATE_LIMITING_AND_ABUSE.md`).
- On a successful password reset, **revoke existing sessions** so a thief who already has a session is kicked.

### 3.4 Password storage — memory-hard KDF, never a fast hash

If you store passwords at all: use **Argon2id** (preferred) with sound memory/iteration/parallelism parameters, or **bcrypt**/scrypt with a strong work factor. **Never** SHA-1/SHA-256/MD5, never reversible encryption, never a homegrown scheme — fast and general-purpose hashes are trivially brute-forced offline after a leak. Each password gets a unique salt (the KDF handles this); rehash on login when you raise the work factor.

### 3.5 Session management — rotate, expire, cookie-store

- **Rotate the session identifier** on every privilege transition: after login, after step-up MFA, after a password change. A fixed ID across the login boundary is **session fixation**.
- **Idle + absolute expiry.** Sessions expire after inactivity *and* have a hard ceiling regardless of activity; refresh tokens have their own bounded lifetime and rotate.
- **Cookie storage, not `localStorage`.** Session/refresh tokens live in cookies marked `HttpOnly` (JS can't read them — neutralizes XSS theft), `Secure` (HTTPS only), and `SameSite=Lax`/`Strict` (mitigates CSRF). Bearer tokens in `localStorage` are readable by any injected script; prefer an HttpOnly-cookie design wherever feasible.
- **Server-side revocation.** Logout, password reset, and "sign out everywhere" must actually invalidate sessions server-side, not just drop a client cookie.

### 3.6 OAuth / OIDC — state, nonce, PKCE, exact redirect, validate claims

For every social/OAuth/OIDC client (RFC 9700, the OAuth 2.0 Security BCP):
- **`state`** — a CSRF token bound to the user's session, checked on callback; defeats login CSRF (binding the attacker's account to the victim).
- **PKCE** — `code_challenge`/`code_verifier` on the authorization-code flow; defeats authorization-code interception (essential for public/mobile clients, recommended everywhere).
- **`nonce`** (OIDC) — echoed in the ID token and verified; defeats ID-token replay.
- **Exact redirect-URI matching** — the provider must be configured with the precise callback URL(s). **No wildcards, no open-ended paths** — a loose redirect lets an attacker exfiltrate the code/token.
- **Validate ID-token claims** — verify the signature, then `iss` (issuer), `aud` (your client id), and `exp` (not expired) before trusting any claim. Don't accept an unvalidated token.

### 3.7 Enumeration-safe responses & breached-password checks

- **Don't reveal account existence.** Login, signup, password-reset, and email-verification responses must look identical whether or not the email exists ("If an account exists, we've sent a link"), and avoid timing/status differences that leak it.
- **Check passwords against known-breached corpora** (e.g. a k-anonymity range query against Have I Been Pwned) and block/warn on compromised passwords at signup and change. Verify email ownership where it gates access.

---

## 4. Concrete examples (build terms)

**Password-only admin — DON'T / DO**
- DON'T: ship an `is_admin` account whose only credential is a password; one phish = full data export.
- DO: require WebAuthn/passkey (or at least TOTP) for every admin/support/billing-capable account; deny password-only login for privileged roles.

**Reset token lifecycle — DON'T / DO**
- DON'T: `reset_token = uuid()` stored raw in a `users.reset_token` column with no expiry, emailed without limit, still valid after use.
- DO: generate a CSPRNG token, store `sha256(token)` with `expires_at = now()+15min`, mark consumed on use, invalidate prior tokens on re-issue, rate-limit sends per account+IP, and revoke sessions on successful reset.

**Password storage — DON'T / DO**
- DON'T: `password_hash = sha256(password)` (or `crypto.createHash('sha256')`), or AES-encrypting passwords.
- DO: `await argon2.hash(password, { type: argon2.argon2id })` (or `bcrypt.hash(password, 12)`); compare with the library's verify; rehash on login when parameters increase.

**Session cookie — DON'T / DO**
- DON'T: `localStorage.setItem('jwt', token)` and reuse the same session id after login.
- DO: set the session in a cookie — `Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Max-Age=...` — and issue a **new** session id at login and at every privilege change; enforce idle + absolute expiry server-side.

**OAuth callback — DON'T / DO**
- DON'T: redirect URI configured as `https://app.example.com/*`, no `state`, no PKCE, ID token trusted without checking `aud`/`exp`.
- DO: register the exact callback URL; generate+verify `state` and `nonce`; use PKCE; on callback verify the ID-token signature then assert `iss`/`aud`/`exp` before creating a session.

**Enumeration-safe reset — DON'T / DO**
- DON'T: return "No account with that email" on reset, and "Email already in use" on signup — an attacker maps your user base.
- DO: respond "If an account exists, you'll get an email" uniformly; keep response time and status consistent regardless of existence.

---

## 5. Common failure modes

| Failure | How it bites | How to detect |
|---|---|---|
| Privileged account with password-only login | One phished/reused password = full admin takeover, data export, billing change | Admin/support/founder role can authenticate with no second factor; MFA not enforced for privileged roles |
| Reset/magic/OTP token reusable or long-lived | Leaked or replayed token = silent account takeover | Token has no `expires_at` / single-use flag, or remains valid after consumption / after re-issue |
| Tokens stored in plaintext | DB read replays every pending reset/OTP | Raw token value (not a hash) persisted in the DB |
| Unlimited token sends | Reset/OTP email spray, OTP brute-force, mailbox flooding | No per-account + per-IP rate limit on reset/OTP/signup/invite sends |
| Fast-hash / homegrown password storage | DB leak → offline credential dump in hours | `sha`/`md5`/`createHash`, reversible encryption, or custom hashing for passwords |
| No session rotation across auth boundary | Session fixation: attacker fixes a session id the victim then authenticates | Same session id before and after login / privilege change |
| No session expiry | Stolen session valid forever; logout doesn't revoke | No idle/absolute expiry; logout only clears client cookie, no server-side invalidation |
| Tokens in `localStorage` | Any XSS exfiltrates the session | Bearer/session token read from/written to `localStorage`/`sessionStorage` |
| Missing cookie flags | XSS reads cookie, CSRF rides it, token sent over HTTP | Session cookie lacking `HttpOnly` / `Secure` / `SameSite` |
| OAuth missing state/nonce/PKCE | Login CSRF / code injection binds attacker to victim account | Authorization request without `state`/`nonce`/PKCE; callback skips verification |
| Wildcard / loose redirect URI | Code/token exfiltrated to attacker-controlled URL | Provider config allows wildcard or unanchored redirect paths |
| ID token trusted without claim validation | Forged/replayed/cross-client token accepted | Signature, `iss`, `aud`, or `exp` not validated before use |
| Account-enumeration-leaky responses | Attacker maps valid emails for credential stuffing/phishing | Login/signup/reset responses differ by account existence (content, status, or timing) |
| No breached-password check | Users keep known-compromised passwords; easy credential stuffing | Signup/change accepts passwords with no compromised-password lookup |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**MFA & credentials**
- **[AUTHN-01] critical — MFA/passkeys are required for admin / founder / support accounts (anyone who can export data, change billing, or alter roles); phishing-resistant factors (WebAuthn/passkeys/TOTP) are preferred over SMS.** → `auth-session`/`authz`. Detect: a privileged account can authenticate with a password only (no enforced second factor), or SMS is the sole factor for privileged accounts = FAIL (observed password-only privileged login, expected enforced MFA).

**Out-of-band tokens**
- **[AUTHN-02] critical — Password-reset / magic-login / OTP tokens are single-use, short-lived, stored hashed (not plaintext), high-entropy, and rate-limited per account + IP/device; a successful reset revokes existing sessions.** → `auth-session`. Detect: a reusable or long-lived reset/OTP token, a token persisted in plaintext, or unlimited sends = FAIL.

**Password storage**
- **[AUTHN-03] serious — Stored passwords use Argon2id (preferred) or bcrypt/scrypt with strong parameters and a per-password salt.** → `auth-session`. Detect: plain `sha*`/`md5`, reversible encryption, or a homegrown password-hashing scheme = FAIL (offline-crackable on leak).

**Session lifecycle**
- **[AUTHN-04] serious — Sessions rotate after login and every privilege change, carry idle + absolute expiry, are revocable server-side, and are stored in `HttpOnly`/`Secure`/`SameSite` cookies — not `localStorage`.** → `auth-session`. Detect: a fixed session id across the auth boundary (fixation), no idle/absolute expiry, logout without server-side revocation, or a session/bearer token in `localStorage`/`sessionStorage` or a cookie missing `HttpOnly`/`Secure`/`SameSite` = FAIL/WARN.

**OAuth / OIDC**
- **[AUTHN-05] serious — OAuth/OIDC clients validate `state`, `nonce`, and PKCE, enforce exact (non-wildcard) redirect-URI matching, and validate ID-token signature + `iss`/`aud`/`exp` before trusting claims.** → `auth-session`/`authz`. Detect: any of `state`/`nonce`/PKCE missing, a wildcard/loose redirect URI, or an unvalidated ID token = FAIL.

**Enumeration & breached passwords**
- **[AUTHN-06] minor — Login/signup/reset/verification responses are account-enumeration-safe (uniform content, status, and timing), and breached-password checks + email verification are used where appropriate.** → `auth-session`. Detect: responses reveal whether an account exists, or consumer auth accepts known-compromised passwords with no warning/block = WARN.

**Passwordless-signup safety (pre-account-takeover)**
- **[AUTHN-07] critical — When email confirmation is disabled to enable a sign-up-first passwordless flow (e.g. Supabase "Confirm email" OFF), the password-signup surface is closed at the data layer, not just the UI.** → `auth-session`. Detect: an app that auto-confirms signups (Confirm-email OFF / `mailer_autoconfirm`) while any password-signup path remains reachable (no DB-level block such as a `BEFORE INSERT/UPDATE` trigger nulling `encrypted_password`) = FAIL — this is the Sudhodanan & Paverd **pre-account-takeover** class: an attacker pre-creates/binds a victim's email before they sign up. Removing the password *UI* alone is insufficient; the anon-key API path must be blocked at the DB. For the passwordless-Supabase pattern this is a hard-block migration (a `BEFORE INSERT/UPDATE` trigger on `auth.users`) + a fail-closed predeploy check that proves it is installed — see [`AUTH_RUNBOOK.md`](../../guides/AUTH_RUNBOOK.md) §9. Confirm-email-OFF is safe ONLY paired with a *verified-installed* hard-block.

> **Coverage note:** AUTHN-03 (password-storage call), parts of AUTHN-04 (cookie flags, `localStorage` use), and AUTHN-02 (plaintext token storage) are largely grep/introspection-detectable. AUTHN-01, AUTHN-05, and the lifecycle/enumeration parts of AUTHN-04/06 require reading the auth→session→OAuth path and are judgment checks — written as assertions so a reasoning reviewer can evaluate each independently. **Strongly prefer a managed auth provider**, which satisfies most of these by construction; DIY auth must pass every rule by hand.

---

## 7. Sources

- OWASP — *Authentication Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html (MFA, enumeration-safety, credential handling)
- OWASP — *Session Management Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html (rotation/fixation, idle + absolute expiry, cookie flags, `localStorage` warning)
- OWASP — *Forgot Password Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html (single-use/short-lived/hashed reset tokens, enumeration-safe flows)
- OWASP — *Password Storage Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (Argon2id/bcrypt/scrypt, never fast hashes)
- W3C — *Web Authentication: An API for accessing Public Key Credentials (WebAuthn Level 3)* — https://www.w3.org/TR/webauthn-3/ (phishing-resistant passkeys/FIDO2)
- IETF — *RFC 9700: Best Current Practice for OAuth 2.0 Security* — https://www.rfc-editor.org/rfc/rfc9700 (state, PKCE, exact redirect URI, token validation)
- OWASP — *Top 10:2025* — https://owasp.org/Top10/2025/ (A07 Identification and Authentication Failures)
- Supabase — *Auth: Sessions* — https://supabase.com/docs/guides/auth/sessions (managed session rotation/expiry; reference for the managed-auth-by-default recommendation)
