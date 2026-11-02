---
guide: SECRETS_AND_CONFIG
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [secrets]
sources:
  - "https://owasp.org/Top10/2025/"
  - "https://github.com/gitleaks/gitleaks"
  - "https://github.com/trufflesecurity/trufflehog"
  - "https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning"
  - "https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection"
  - "https://nextjs.org/docs/app/guides/environment-variables"
  - "https://vimeo.com/docs/api/guides/secrets"
  - "https://supabase.com/docs/guides/api/api-keys"
  - "https://trufflesecurity.com/blog/guest-post-how-i-scanned-all-of-github-s-oops-commits-for-leaked-secrets"
---

# Secrets & Configuration

**A secret is any credential whose disclosure grants an attacker capability — API keys, tokens, passwords, private keys, database connection strings. The single invariant: secrets live **only** server-side, **never** in source, in git history, in the client bundle, or under a client-exposed env prefix — and a secret that has ever been committed or shipped is **compromised** and must be **rotated**, not merely deleted.**

This guide trains your AI to recognize where secrets leak in the modern stack (the frontend bundle is *public*; git history is *forever*; `NEXT_PUBLIC_*`/`VITE_*`/`EXPO_PUBLIC_*` are *compiled into client code*), to scan for them mechanically (gitleaks, TruffleHog, GitHub Secret Scanning + Push Protection), and to treat rotation — not deletion — as the only real remediation.

---

## 1. What this is

Secrets management is the discipline of keeping credentials out of every place an attacker can read, and reachable only by the server code that legitimately needs them. The leak surfaces, in order of how often they bite:

1. **Hardcoded in source** — a key pasted into a `.ts`/`.py`/config file and committed.
2. **In git history** — even after you "remove" the line, the secret remains in prior commits; the repo is a time machine.
3. **In the client bundle** — anything the browser/mobile app downloads is *public*; an env var with a client-exposed prefix is **compiled into** that download.
4. **In logs, error pages, CI output, screenshots** — secondary but real.

Hardcoded secrets fall under **OWASP A02:2025 (Cryptographic Failures / sensitive-data exposure)** and the broader misconfiguration class; the supply-chain dimension (leaked CI/registry tokens) intersects **A03:2025 Software Supply Chain Failures**. This domain owns the `secrets` vocabulary axis and applies whenever you build, fix or review secrets handling.

---

## 2. Why it matters

A leaked credential is *immediately weaponizable*: a database URL is a full data dump, a cloud key is runaway spend or pivot-to-prod, an LLM key is someone else's bill. Automated bots scrape public GitHub and npm continuously — leaked AWS/OpenAI/Stripe keys are exploited within **minutes** of being pushed. And because git history and published bundles are immutable distribution channels, a leak is not a momentary slip you can quietly undo; it's a disclosure that has already propagated.

**Two facts that make this counterintuitive:**

- **The frontend bundle is public.** Anything your client downloads — JS, source maps, mobile binary — can be read by anyone who opens devtools or unzips the app. There is no "obfuscated enough." A real secret in client code is a *published* secret.
- **Deleting a commit doesn't delete the secret.** Force-pushing over a bad commit, or deleting it, leaves it reachable: GitHub retains dangling/orphaned commits that remain scrapeable via the commit SHA or the events API. Tools like the **Force Push Scanner / "Oops Commits"** harvest exactly these "deleted" commits. The only safe assumption: **once committed, always exposed → rotate.**

**For a security review specifically:** your job is to (a) find secrets that are *in* the codebase or its history *now*, (b) catch new ones at write-time before they land, and (c) insist on **rotation** as the remediation, because "I removed the line" is a false fix. You must also distinguish a **true** secret from a **deliberately public** one — the Supabase **anon/publishable** key is *designed* to ship to the client (it is RLS-bound; see AUTHZ), whereas the Supabase **service_role/secret** key must never. Flagging the anon key as a leak is a false positive; missing the service_role key is the real miss. The §6 rules encode this distinction.

---

## 3. Core principles / techniques

### 3.1 No secret in source, ever

Secrets are read from the **environment** (or a secret manager) at runtime, never literalized in code. The build references `process.env.STRIPE_SECRET_KEY`; the value lives in a server-only env. No keys, tokens, passwords, private keys, or connection strings appear as string literals in any tracked file.

### 3.2 The client-exposed env prefix trap

Build tools split env vars into *server-only* and *client-inlined* by **prefix**:
- **Next.js:** `NEXT_PUBLIC_*` is inlined into the browser bundle at build time; everything else stays server-only.
- **Vite:** only `VITE_*` is exposed to client code.
- **Expo / React Native:** `EXPO_PUBLIC_*` is embedded in the app.

So the prefix *is* the leak decision. A real secret under any of these prefixes is **shipped to the client = compromised**. Rule of thumb: under a public prefix, put only values that are *safe to be world-readable* (publishable keys, public URLs, feature flags). Note the nuance again: Supabase's **anon/publishable** key correctly lives under `NEXT_PUBLIC_SUPABASE_ANON_KEY` — that's by design; the **service_role/secret** key must never carry a public prefix and must never appear in client code.

### 3.3 `.env*` is gitignored and absent from every branch and history

- `.env`, `.env.local`, `.env.*` (except a committed `.env.example` of *placeholders*) are listed in `.gitignore`.
- More importantly, they must be **absent from every tracked commit, every branch, and the full history** — `.gitignore` only prevents *future* adds; a file committed *before* it was ignored is still tracked. Verify with history scanning, not just a clean working tree.
- Ship a `.env.example` with key *names* and dummy values so collaborators know what's needed without exposing the real ones.

### 3.4 Scan: history, write-time, and push-time

Layer the defenses:
- **gitleaks** — fast regex/entropy scanner; run as a **pre-commit hook** (and in CI) to block secrets *before* they're committed. Scans working tree and history.
- **TruffleHog** — scans git history and many sources; its differentiator is **live verification** — it calls the provider to confirm a found key is *active*, cutting false positives. Strong as a **CI** gate and for auditing existing repos.
- **GitHub Secret Scanning** — server-side scanning of pushed content against hundreds of partner patterns, with alerts; partners may auto-revoke.
- **GitHub Push Protection** — *blocks the push* when a detectable secret is in the diff, stopping the leak at the door (the highest-leverage control — prevention beats detection).
- **Force Push Scanner / "Oops Commits"** — audit tooling that surfaces secrets in *force-pushed/deleted* commits; relevant when assessing whether a past leak is still recoverable.

### 3.5 Rotate, don't just delete

Remediation order when a secret is found in source/history/bundle:
1. **Rotate / revoke** the credential at the provider *first* — this is what actually closes the hole. The old value is assumed harvested.
2. Remove it from code; move it to a server-only env / secret manager.
3. Purge history if feasible (e.g. `git filter-repo`) — but treat this as cleanup, **not** the fix; the rotation already neutralized the value.
4. Add a scanner gate so it can't recur.

### 3.6 Server-only storage, secret managers, least privilege

- Production secrets belong in a **secret manager** (Vault, AWS/GCP Secrets Manager, Doppler, the platform's encrypted env store), not a flat file on a box.
- **Least-privilege keys:** scope each credential to the minimum (read-only where possible, single-service, single-environment). A leaked narrow key is a smaller blast radius.
- **Separate keys per environment** (dev/staging/prod) so a dev leak can't touch prod.

---

## 4. Concrete examples (build terms)

**Hardcoded key — DON'T / DO**
- DON'T: `const stripe = new Stripe("sk_live_51HxQ...")` committed to the repo.
- DO: `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`, with the value in a server-only env, and the key *rotated* if it was ever committed.

**Client-exposed prefix — DON'T / DO (Next.js)**
- DON'T: `NEXT_PUBLIC_OPENAI_API_KEY=sk-...` — inlined into the browser bundle; anyone reads it in devtools. Also DON'T: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=...` — leaks the `BYPASSRLS` admin key.
- DO: keep `OPENAI_API_KEY` (no prefix) server-only and call OpenAI from a server route/Edge Function. The browser hits *your* endpoint, which holds the key. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (designed-public) belong under the prefix.

**`.gitignore` and `.env.example` — DON'T / DO**
- DON'T: commit `.env.local` "just for the team," or assume `.gitignore` retroactively untracks an already-committed `.env`.
- DO: `.gitignore` → `.env\n.env.*\n!.env.example`; commit only `.env.example` with placeholder values; if `.env` was ever tracked, `git rm --cached .env`, **rotate every key it held**, then scan history.

**Calling a provider without exposing its key — DON'T / DO (Node/Next)**
- DON'T: call the LLM/Stripe/etc. directly from a client component with the secret in `NEXT_PUBLIC_*`.
- DO: `app/api/chat/route.ts` (server) reads `process.env.OPENAI_API_KEY` and proxies; the client calls `/api/chat`. The secret never crosses the network boundary to the browser.

**Pre-commit + CI scanning — DO**
- DO: add gitleaks as a pre-commit hook and a CI job; add TruffleHog in CI (live-verify) on PRs; enable GitHub Secret Scanning + **Push Protection** on the repo so a secret in a diff is blocked at push.

**Remediating a found leak — DON'T / DO**
- DON'T: `git revert`/delete the line and call it fixed — the value is already harvested and lives in history/force-push records.
- DO: rotate at the provider first, then remove from code, then (optionally) purge history, then add a scanner gate.

---

## 5. Common failure modes

| Failure | How it bites | How to detect |
|---|---|---|
| API key/token/password hardcoded in a tracked source file | Bots scrape and exploit within minutes; full capability of that key | gitleaks/TruffleHog on working tree; grep for key formats (`sk_live_`, `AKIA`, `ghp_`, `xoxb-`, JWTs, `postgres://user:pass@`) |
| Real secret under `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` | Compiled into the public bundle; any visitor reads it in devtools | Scan client bundle + env files for secret-shaped values under a client prefix; check what's inlined |
| `.env` committed before being gitignored | Secret persists in history despite a clean working tree | History scan (gitleaks/TruffleHog `--since`/full); `git log --all -- .env` |
| Secret "removed" by force-push/commit delete, never rotated | Dangling commit still scrapeable; key still valid | Force Push Scanner / "Oops Commits"; assume any once-committed secret is live until rotated |
| Connection string with embedded credentials in config/code | Full DB access leaks | grep for `://user:password@` URIs in source and committed config |
| Deleted-but-not-rotated credential | Attacker who already harvested it retains access forever | Confirm provider-side revocation/rotation timestamp, not just code removal |
| No secret scanning in CI/pre-commit | Next leak lands unblocked; relies on human vigilance | Absence of gitleaks/TruffleHog job and of GitHub Secret Scanning/Push Protection |
| Secrets in CI logs, error pages, or source maps | Secondary leak channel often missed | Inspect CI output, server error responses, and published `.map` files |
| One over-privileged, shared-across-envs key | A single dev leak compromises prod; huge blast radius | Same key value across environments; broad scopes on the credential |
| Anon/publishable key flagged as a leak (false positive) | Wasted remediation, or worse, distrust of real findings | Confirm key type: Supabase **anon/publishable** is designed-public; **service_role/secret** is not |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**No secret in source / bundle / history**
- **[SECRET-01] critical — No hardcoded API keys, tokens, passwords, private keys, or connection strings appear as literals in any tracked source/config file.** → `secrets`. Detect: gitleaks/TruffleHog or pattern match (`sk_live_`, `AKIA…`, `ghp_…`, `xox[bp]-…`, PEM blocks, `://user:pass@host`) hits a tracked file = FAIL (observed literal secret, expected env reference).
- **[SECRET-02] critical — No *real* secret is shipped to the browser/mobile bundle, including under a client-exposed env prefix (`NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_`).** → `secrets`. Detect: a secret-shaped value under a public prefix or inlined in client bundle/source map = FAIL. *Exception:* designed-public values (Supabase anon/publishable key, public URLs, feature flags) PASS — confirm key type before flagging.
- **[SECRET-03] critical — `.env*` files are gitignored AND absent from every tracked commit, branch, and the full history (only a placeholder `.env.example` may be committed).** → `secrets`. Detect: `.env`/`.env.local`/`.env.*` present in `git log --all` or any branch's tree = FAIL; missing `.gitignore` entry = FAIL.
- **[SECRET-06] critical — The service_role/secret key (vs the designed-public anon key) never appears in client code or under a public prefix.** → `secrets`/`authz`. Detect: `service_role`/secret-key value referenced in a client component or `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` var = FAIL (full `BYPASSRLS` leak).

**Remediation = rotation**
- **[SECRET-04] serious — Any credential found in source, history, a bundle, or a force-pushed/deleted commit is ROTATED/revoked at the provider, not merely removed from code.** → `secrets`. Detect: a leaked key removed in the diff with no corresponding provider-side rotation/revocation evidence = FAIL (value still live).
- **[SECRET-07] minor — History is purged (e.g. `git filter-repo`) for leaked secrets where feasible, treated as cleanup AFTER rotation — never as the primary fix.** → `secrets`. Detect: history-rewrite performed but key not rotated, or leak left reachable via dangling/force-pushed commit = WARN.

**Storage, scope, and configuration**
- **[SECRET-08] serious — Secrets are read from the environment / a secret manager at runtime and stored server-side; production secrets are not flat-filed on the host.** → `secrets`. Detect: secret loaded from a tracked file instead of env/secret manager, or prod secrets in a plain file = FAIL/WARN.
- **[SECRET-09] minor — Keys are least-privilege and separated per environment (dev/staging/prod); not one broad key reused everywhere.** → `secrets`. Detect: identical key value across environments, or an over-scoped key where a narrower one suffices = WARN.

**Scanning & prevention controls**
- **[SECRET-05] minor — Secret scanning runs in CI and/or as a pre-commit hook (gitleaks/TruffleHog), and GitHub Secret Scanning + Push Protection is enabled where the host supports it.** → `secrets`. Detect: no scanner in pre-commit/CI and no push-protection = FAIL (next leak lands unblocked).
- **[SECRET-10] minor — No secrets leak through secondary channels: CI logs, server error responses/stack traces, or published source maps.** → `secrets`. Detect: secret-shaped value in CI output, an error page, or a shipped `.map` = WARN.

**CI/CD, build & deploy secret hygiene**
- **[SECRET-11] critical — Secrets do not appear in any secondary channel: CI logs, Docker image layers, build artifacts, mobile binaries, crash reports, screenshots, tickets, or AI-assistant chats.** → `secrets`. Detect: a secret-shaped value in CI output, a baked `ENV`/`ARG`/`RUN` in a Docker layer (`docker history`), a bundled mobile binary, a crash/error report, or pasted into an AI chat = FAIL (broadens SECRET-10 to every build/deploy/support channel — server-side capability leaks regardless of where it surfaces).
- **[SECRET-12] serious — CI/CD deploy credentials are short-lived and least-privilege; OIDC short-lived tokens are used where the platform supports them.** → `secrets`. Detect: a long-lived cloud **admin** key stored as a GitHub/Vercel/Netlify secret when OIDC deploy is available, or a deploy credential scoped far broader than the deploy needs = FAIL/WARN.
- **[SECRET-13] serious — Untrusted PRs/workflows cannot access repository secrets.** → `secrets`. Detect: a fork PR that can read repo secrets, or a `pull_request_target` workflow that checks out and runs untrusted PR code with secrets in scope = FAIL (secret-exfiltration via CI).
- **[SECRET-14] serious — Production secrets are separated from preview / staging / dev.** → `secrets`. Detect: preview or staging deployments that receive the production database URL or production API keys = FAIL (a preview-env leak reaches prod; see also SECRET-09 per-environment separation).
- **[SECRET-15] minor — A secret inventory exists with an owner and a rotation path for each key.** → `secrets`. Detect: no record of where each credential lives, who owns it, or how to rotate it = WARN (rotation in SECRET-04 is only actionable if the key is inventoried).

> **Coverage note:** SECRET-01/02/03/06 are largely machine-detectable (gitleaks/TruffleHog/history scan/prefix inspection), and SECRET-11 (Docker-layer / build-artifact scan) and SECRET-13 (workflow-config inspection of fork-secret access / `pull_request_target`) are likewise mostly mechanical. SECRET-04/07 (rotation actually happened), SECRET-09/SECRET-14 (least privilege + per-environment separation), SECRET-12 (OIDC/short-lived deploy creds), and SECRET-15 (inventory + ownership) require judgment + provider/platform evidence — written as assertions a reasoning reviewer can confirm against rotation timestamps and CI/deploy configuration.

---

## 7. Sources

- OWASP — *Top 10:2025 (final)* — https://owasp.org/Top10/2025/ (A02 Cryptographic/sensitive-data exposure; A03 Software Supply Chain Failures — leaked CI/registry tokens)
- gitleaks — https://github.com/gitleaks/gitleaks (fast regex/entropy secret scanner; pre-commit + CI, history scanning)
- TruffleHog — https://github.com/trufflesecurity/trufflehog (history/source scanner with live key **verification** to cut false positives)
- GitHub — *About secret scanning* — https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning (server-side partner-pattern detection + alerts)
- GitHub — *About push protection* — https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection (blocks the push when a secret is in the diff)
- Next.js — *Environment Variables* — https://nextjs.org/docs/app/guides/environment-variables (`NEXT_PUBLIC_*` is inlined into the client bundle at build time)
- Supabase — *API Keys* — https://supabase.com/docs/guides/api/api-keys (anon/publishable key is designed-public; service_role/secret key must stay server-only)
- TruffleHog — *Scanning GitHub's "Oops Commits" / Force Push Scanner* — https://trufflesecurity.com/blog/guest-post-how-i-scanned-all-of-github-s-oops-commits-for-leaked-secrets (force-pushed/deleted commits remain scrapeable → rotate, don't just delete)
