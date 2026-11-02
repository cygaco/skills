---
guide: AUTH_RUNBOOK
anchor: lastmile:module/auth
shape: walkthrough
timing: at-module
lead_time: "Custom Domain add-on purchase (you, ~$10/mo) gates §7; Resend account (you) gates live email"
---

# AUTH_RUNBOOK.md — Passwordless auth on Supabase (product-agnostic, AI-drivable)

> **This is the *execution runbook*, not the *decision guide*.** Still choosing an approach (Clerk vs
> Supabase, password vs passwordless, Apple sign-in)? Read **`AUTH_GUIDE.md`** first — it covers the
> method-choice for a human founder. **This** doc assumes the choice is made: **passwordless Supabase
> (6-digit email code + Google), no passwords, ever.** It is written so **your AI can drive the
> whole setup**, with the steps only you can do fenced (🔴 YOU = only you can do it;
> 🤖 AI = your AI does it). Your AI writes the code half in your repo (clients, sign-in UI,
> PKCE callback, the §9 password hard-block migration + a check that proves it); this runbook is the config half.

## 0. Placeholders (fill these first)

| Placeholder | Meaning | Example |
|---|---|---|
| `{{PRODUCT}}` | Brand name as users see it | `acme` |
| `{{APEX}}` | Production apex domain | `acme.example` |
| `{{AUTH_HOST}}` | Custom auth subdomain (§7, optional) | `auth.acme.example` |
| `{{REF}}` | Supabase project ref | `abcdefghijklmnopqrst` |
| `{{ORG}}` | Supabase org slug (billing URLs) | — |
| `{{SENDER}}` | Sign-in email sender | `sign-in@{{APEX}}` |

**Secrets** (store in `.env.local`, NEVER commit): `sbp_…` Supabase Management token, Resend `re_…`,
Google OAuth client id/secret. Keep an `.env.local.example` that lists the variable *names* only.

## 1. Philosophy (4 rules)

1. **Passwordless-first.** Only two sign-in methods: a **6-digit email code** and **"Continue with
   Google."** No password anywhere — hard-blocked at the database (§9).
2. **The code IS the confirmation.** No separate "confirm your email" link — entering the code proves
   inbox ownership (mechanism: Supabase "Confirm email" **OFF**, §6).
3. **Sign-up-first.** One email-code flow serves new + returning users (auto-create on first request).
4. **Never lose access.** No password to forget; a lost inbox → Google is the second door.

## 2. Auth methods (only two)

1. **Email OTP code** — `signInWithOtp({ email })` sends a 6-digit code; verify with
   `verifyOtp({ email, token, type:'email' })`.
2. **Google OAuth** — `signInWithOAuth({ provider:'google', options:{ redirectTo } })`.

No `signInWithPassword` / `signUp(email, password)` anywhere. The §9 hard-block enforces this at
the database: any password is nulled there.

## 3. Client architecture — variant A is the default

Use **variant A** (browser client, `@supabase/ssr`, tokens in cookies managed by the
lib) — simplest, production-proven. A typical Next.js layout:

- `src/lib/supabase/config.ts` — `isSupabaseConfigured()` gate + env reads.
- `src/lib/supabase/client.ts` — browser client; **returns `null` when unconfigured** (so `next build`
  never breaks before a Supabase project exists).
- `src/lib/supabase/server.ts` — server client (`await cookies()`, Next 16; `getAll`/`setAll` adapter).
- `src/app/auth/callback/route.ts` — PKCE `exchangeCodeForSession` (sanitizes `?next=`, `no-store`).
- `src/middleware.ts` + `src/lib/supabase/middleware.ts` — session refresh (no-op when unconfigured;
  writes cookies onto the same response it returns; uses `getUser()` not `getSession()`).

**Variant B (server-proxied, httpOnly cookies)** — an optional **swap-in** for a higher
security bar (no JS-readable token): move the `signInWithOtp`/`verifyOtp` calls into a
`/api/auth/session` route handler; set the session cookie `httpOnly` server-side; the page POSTs
`{email}` then `{email, token}` and reads whoami via GET. The `config.ts` seam is unchanged — only the
call-site moves.

**Both variants:** OAuth stays a browser redirect; `/auth/callback` exchanges the PKCE code. Redirects
derive from `window.location.origin`, **never hardcoded**; `?next=` is sanitized to a relative path.
**Never let a service worker cache `/api/*`** (a cached whoami goes stale).

## 4. ★ The sign-up-first + code pattern (no confirm email) — the core flow

ONE flow serves brand-new and returning users; no separate registration, no "check your email to
confirm" dead-end, no password.

```
user enters email
  → signInWithOtp({ email })            # Supabase AUTO-CREATES the user if new ("sign-up-first")
  → email arrives with a 6-DIGIT CODE   # not a link — §5.1 template renders {{ .Token }}
  → user types the code into the app
  → verifyOtp({ email, token, type: 'email' })
  → session established; a new user is now BOTH confirmed AND signed in
```

Why no confirm-email step: **entering the code IS the confirmation.** Needs two Supabase settings
together: (1) **"Confirm email" = OFF** (§6) and (2) the Magic Link template renders **`{{ .Token }}`**
not `{{ .ConfirmationURL }}` (§5.1). Verify `type:'email'` for everyone.

**Safety:** sign-up-first + Confirm-email-OFF is safe **only** paired with the §9 password hard-block.
An attacker who "signs up" someone else's address gets nothing — they can't receive the code, and the
real owner's later sign-in takes over the empty, passwordless row.

### UI copy
"Create your account" → email field → **"Email me a code"** (primary) → 6-box code entry
(`inputMode=numeric`, `autoComplete="one-time-code"`, `maxLength=6`, auto-submit on the 6th digit) →
signed in. "Continue with Google" secondary. "Already have an account? **Log in**" toggles the copy
only.

## 5. Email delivery (code arrives, from your domain)

### 5.1 The link-vs-code flip (the classic signup bug)
`{{ .ConfirmationURL }}` = link (stock default); **`{{ .Token }}`** = the 6-digit code.
1. Auth → Emails → **Magic Link** template: render `{{ .Token }}` (large, monospace); put it in the
   subject too: `{{ .Token }} is your {{PRODUCT}} sign-in code`.
2. **"Confirm email" OFF** (§6) — else NEW signups route through the "Confirm signup" **link** template.
   **Trap: an EXISTING user shows a code; a NEW user still gets a link until this is OFF.**
3. Auth → Providers → Email: **OTP length = 6** (default 8 breaks a 6-box input), expiry ~10 min.

### 5.2 SMTP via Resend
Auth → Emails → SMTP: host `smtp.resend.com`, port `465`, user `resend`, sender `{{SENDER}}`,
password = Resend API key. 🔴 YOU create the Resend account.

### 5.3 Sending-domain DNS — find where the zone ACTUALLY lives first
**⚠ registrar ≠ DNS host.** `nslookup -type=NS {{APEX}}` before touching any panel. Records (from
Resend): MX `send` → `feedback-smtp.<region>.amazonses.com` (prio 10); TXT `send` →
`v=spf1 include:amazonses.com ~all`; TXT `resend._domainkey` → DKIM; TXT `_dmarc` →
`v=DMARC1; p=none;`. Then Verify in Resend.

## 6. "Confirm email" OFF — the crux

Auth → Providers → Email → **Confirm email = OFF.** **Safe ONLY together with the §9 password
hard-block** — the only thing OFF loosens is password signups (auto-confirmed), and §9 removes that path
entirely. Config-first ordering: if the app shipped a two-type fallback (`type:'signup'` vs `'email'`),
collapse it to uniform `type:'email'` **after** the toggle, not before.

## 7. Custom auth domain — OPTIONAL, gated on you, DEFERRABLE

Runs OAuth + auth emails on `{{AUTH_HOST}}` instead of `{{REF}}.supabase.co`. **Deferrable** — auth
works fully on `{{REF}}.supabase.co` without it. Gated on you buying the **Custom Domain
add-on (~$10/mo)**; until then custom-hostname calls return `entitlement_required` + an upgrade URL —
surface it and wait. Flow (🤖 AI, once bought): `POST /v1/projects/{{REF}}/custom-hostname/initialize`
`{"custom_hostname":"{{AUTH_HOST}}"}` → DNS (CNAME `auth`→`{{REF}}.supabase.co` **DNS-only on
Cloudflare**, ownership TXT, ACME TXT) → `POST /reverify` every ~90s until `ssl.status:"active"` →
`POST /activate`. Then 🔴 add `https://{{AUTH_HOST}}/auth/v1/callback` to Google, 🤖 set
`NEXT_PUBLIC_SUPABASE_URL=https://{{AUTH_HOST}}` + redeploy. **Cloudflare CNAME must be DNS-only**
(proxying breaks validation). Stuck at `2_initiated`/`does not CNAME to this zone` while CNAME visible +
SSL active = checked while briefly Proxied (`moved`, stale reverify): `DELETE /custom-hostname` →
re-init (new UUID) → reverify → activate. Polling: healthy = literal `"errors":[]`; don't grep bare
`error`.

## 8. Google consent-screen branding — LATER (do §7 first)

Once the custom domain is live the consent screen reads "continue to {{AUTH_HOST}}" (acceptable
immediately). App-name branding (Console → OAuth consent screen: App name, support email, logo,
home/privacy/terms, Authorized domain → Publish) is polish and may sit behind Google brand-verification
— **do NOT block rollout on it.** All Google Console steps are 🔴 YOU (your AI has no Google Cloud
access; it supplies the exact values).

## 9. Security: the password hard-block (what makes §6 safe) — VERIFY + GATE

**The property to verify:** password sign-in is hard-blocked at the database, so a direct password
signup or password grant with the anon key fails. The mechanism is a migration your AI writes: a
**BEFORE INSERT/UPDATE trigger on `auth.users`** that nulls `encrypted_password`, killing the anon-key
password-signup surface (the Sudhodanan & Paverd pre-account-takeover class). 🤖 **Have your AI write a
fail-closed check that proves the block is installed and effective**, and run it GREEN before any auth-enabled deploy.
A good check has two modes:

- STATIC mode (no DB) asserts the trigger *definition* is correct (the function nulls
  `NEW.encrypted_password` AND the `CREATE TRIGGER … ON auth.users … FOR EACH ROW EXECUTE FUNCTION`
  binding). A static-only pass is reported **`PROVEN=STATIC-ONLY`, not "installed"**, and exits
  **non-zero by default** — static is NOT proof of installation. (Static validates a
  single-trigger migration; a hand-edited multi-trigger migration should rely on LIVE-mode
  installed-proof below, which inspects every trigger actually on `auth.users`.)
- LIVE mode (`SUPABASE_DB_URL` set) proves the EXACT intended hard-block is installed AND effective —
  an *allowlist of the one valid shape via whole-definition EQUALITY*, not token/keyword parsing (which
  is a denylist against a grammar — a `WHEN`-clause or a probe-aware conditional body defeats token
  checks). Installed-proof requires: the trigger you created (for example `hardblock_password_trigger`) present + **enabled**
  (`tgenabled ∈ {O,A}` — disabled/replica-only rejected), its normalized `pg_get_triggerdef` **equal to**
  the trigger definition in your migration, and its function's normalized `pg_get_functiondef` **equal to** the
  function in your migration (for example `public.hardblock_password`) (normalization canonicalizes whitespace/case/comments/
  dollar-quote tags — robust to benign rendering, exact on substance). Behavioral negative tests on
  **both** INSERT and UPDATE (randomized sentinels, rollback txn) are defense-in-depth. Anything short
  of the exact shape → `ok:false`. Only this exits 0 as installed-proof; a missing `pg` dependency fails
  closed (never skips to green).

> **⛔ MANDATORY ADOPTION GATE:** never ship an auth-enabled build without the hard-block check
> GREEN in LIVE mode against your live project. 🤖 Have your AI also test the check itself both ways
> (hard-block present → green, hard-block absent → red); the *safety property* is realized only when
> the check runs against your **live Supabase project** at deploy. Wire it as a required predeploy CI step.

Do NOT reintroduce password UI; app-side password-rotate revokes the session (GoTrue #1579).

## 10. Environment

```
NEXT_PUBLIC_SUPABASE_URL=https://{{AUTH_HOST}}      # after §7; {{REF}}.supabase.co before
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…      # "publishable key" — safe in client
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…               # "secret key" — server-only
SUPABASE_ACCESS_TOKEN=sbp_…                         # Management API — never commit
SUPABASE_DB_URL=postgresql://…                       # hard-block check, live mode (§9); optional
GOOGLE_OAUTH_CLIENT_ID=… / GOOGLE_OAUTH_CLIENT_SECRET=…
RESEND_API_KEY=re_…
```
Key-name mapping: dashboard "publishable" = anon, "secret" = service-role. A raw `apikey`-header curl
401s with the new key format = wrong call shape, not a bad key. **Build the auth seam so that when any
Supabase var is unset it no-ops — the app still builds and runs; the auth UI shows an "auth not
configured" state.**

## 11. Who does what (you vs your AI)

| Step | Owner | Why |
|---|---|---|
| All Supabase config (templates, Confirm-email, OTP length, SMTP) | 🤖 AI via Management API (`PATCH /v1/projects/{{REF}}/config/auth`) | token suffices |
| Custom-hostname initialize/reverify/activate (§7) | 🤖 AI | token suffices |
| DNS records | 🤖 AI (API, or browser with your live login) | never enters credentials |
| Plan/add-on purchase, Resend account creation | 🔴 YOU | only you make purchases |
| Google Cloud Console (consent screen, redirect URIs) | 🔴 YOU (your AI supplies exact values) | your AI has no access |
| Vercel env + deploy | 🤖 AI (if CLI/token wired) | |
| Live E2E proof (new-user code, returning, Google, lost-inbox) | 🤖 AI drives, 🔴 YOU receive the code email | inbox access |

### 11.5 ★ Executable Management-API config (🤖 AI drives this inline)

> Your AI drives Supabase config by FOLLOWING these calls directly — no separate driver script is
> needed (an idempotent driver is an optional extra — see §14). "AI-drivable" means these calls are
> precise enough to execute directly.

**Base:** `https://api.supabase.com/v1/projects/{{REF}}/config/auth`, header
`Authorization: Bearer $SUPABASE_ACCESS_TOKEN`.

**Step 1 — READ current config + assert the trap isn't set:**
```
GET /v1/projects/{{REF}}/config/auth
```
Assert in the response: `mailer_autoconfirm == true` (this is Confirm-email **OFF** — if `false`, the
§5.1 link-vs-code trap is live), `mailer_otp_length == 6`, `external_google_enabled == true`,
`site_url == https://{{APEX}}`, and `uri_allow_list` contains `https://{{APEX}}/auth/callback`,
`https://{{APEX}}/account`, AND their `www.` variants (`https://www.{{APEX}}/…`). A missing `www.`
variant fails redirects silently.

**Step 2 — PATCH the passwordless config:**
```
PATCH /v1/projects/{{REF}}/config/auth
Content-Type: application/json
{
  "mailer_autoconfirm": true,               // Confirm email OFF (§6) — new+returning both get the code
  "mailer_otp_length": 6,                   // 6-digit (default 8 breaks the 6-box input)
  "mailer_otp_exp": 600,                    // ~10 min
  "external_google_enabled": true,
  "site_url": "https://{{APEX}}",
  "uri_allow_list": "https://{{APEX}}/auth/callback,https://{{APEX}}/account,https://www.{{APEX}}/auth/callback,https://www.{{APEX}}/account"
}
```

**Step 3 — Magic Link template + SMTP (same `PATCH /config/auth` endpoint):**
```
PATCH /v1/projects/{{REF}}/config/auth
Content-Type: application/json
{
  "mailer_subjects_magic_link": "{{ .Token }} is your {{PRODUCT}} sign-in code",
  "mailer_templates_magic_link_content": "<p>Your {{PRODUCT}} sign-in code:</p><p style=\"font-size:28px;font-family:monospace;letter-spacing:4px\">{{ .Token }}</p>",
  "smtp_host": "smtp.resend.com",
  "smtp_port": 465,
  "smtp_user": "resend",
  "smtp_pass": "<RESEND_API_KEY>",
  "smtp_sender_name": "{{PRODUCT}}",
  "smtp_admin_email": "{{SENDER}}"
}
```
The template body MUST render **`{{ .Token }}`**, NOT `{{ .ConfirmationURL }}` (§5.1 — else a NEW user
gets a link, not a code). **FALLBACK (dashboard/manual):** if a field name differs in your Supabase
Management-API version, these exact settings also live in the dashboard — **Auth → Emails → Magic Link**
(template + subject) and **Auth → Emails → SMTP** (host/port/user/pass/sender). Both write the same
config; the dashboard is the authoritative manual path when the API field shape is uncertain. (The
Resend *account* + sending-domain DNS remain per §5.2–5.3; this step only wires Supabase → Resend.)

**Step 4 — re-GET and re-assert** the Step-1 invariants now hold. Polling any custom-hostname state
(§7): a healthy response contains the literal `"errors":[]` — match that exact token, never grep bare
`error` (it false-positives your own watchdog).

### 11.6 Ordered checklist (your AI executes top-to-bottom)
1. `GET /config/auth` — verify the §11.5 Step-1 assertions.
2. `PATCH /config/auth` + Magic Link template (§11.5 Steps 2–3).
3. Resend SMTP + sending DNS (§5.2–5.3).
4. Custom domain (§7) — gated on your add-on purchase.
5. Consent screen + redirect URI (§8, 🔴 you; your AI supplies values).
6. Env swap + deploy + live E2E proof + the §9 hard-block check GREEN in LIVE mode (§9 gate).
7. Post-config cleanup: collapse any two-type OTP fallback to uniform `type:'email'` (§6).

## 12. Verification commands

```bash
nslookup -type=NS {{APEX}} 8.8.8.8                           # where does the zone live?
nslookup -type=TXT _cf-custom-hostname.{{AUTH_HOST}} 8.8.8.8 # ownership TXT propagated?
nslookup -type=TXT _acme-challenge.{{AUTH_HOST}} 8.8.8.8     # ACME TXT propagated?
nslookup {{AUTH_HOST}} 8.8.8.8                               # CNAME resolves to supabase?
curl -s https://{{AUTH_HOST}}/auth/v1/health                 # auth server answers on the brand domain
# then run your §9 hard-block check with SUPABASE_DB_URL set  # installed-proof
```

## 13. What your AI builds vs what you configure

**🤖 Your AI builds (in your repo):** the two Supabase clients + config seam (no-op when unset), the
sign-up-first sign-in UI (§4) + account page, the PKCE `/auth/callback` + session middleware, the §9
password hard-block migration + a fail-closed check that proves it + a test that the check fails when
the block is absent, and the env-var names.

**You configure (per §11):** a real Supabase project + keys, Confirm-email-OFF + the
`{{ .Token }}` template (§5.1/§6), Resend + sending DNS, the optional custom domain (§7), Google Console
(§8), the live E2E proof, and the §9 check GREEN against your live DB. The app should compile and run
before any of this; auth activates when you fill the env.

## 14. Optional later

- **Idempotent Management-API driver script** — your AI can run the §11.5 calls inline; a
  driver script (retry/idempotency/dry-run) is a reliability nicety, not a requirement.
- **Custom auth domain §7 + consent branding §8** — when you are ready to buy the add-on.
- **Variant B (server-proxied)** — the optional swap-in (§3).
- **Live E2E harness** — the new-user/returning/Google/lost-inbox proof is a per-product step (§11).

---

_Companion to
`AUTH_GUIDE.md` (the method-choice decision guide). Keep updated when a new failure mode is hit._
