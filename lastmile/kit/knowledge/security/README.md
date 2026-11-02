---
guide: README-SECURITY
anchor: none
shape: notice
timing: reference
lead_time: "none"
---

# Application-Security Knowledge Library — deeper references for you and your AI

> This is the **security-hardening knowledge library**: 9 self-contained, teachable references for building, fixing and reviewing the security of your app. Each ref closes with a §6 **RULES** section phrased as PASS/FAIL assertions, so a ref is something you or your AI can grade a build against.
>
> **These are NOT launch guides.** Every ref here is `anchor: none` — deep reference material, read when a finding or a task needs the precise rule. The newbie-facing, plain-language launch playbook for the same topics is the separate **[`SECURITY_GUIDE.md`](../../guides/SECURITY_GUIDE.md)** ("How Not to Get Hacked"). This library is the deep, precise, reviewer-grade layer behind it.

---

## How to use these

| When | What to read here |
|---|---|
| **Building** | every ref — to build hardening that satisfies the §6 RULES up front (authz/RLS, secrets handling, rate limits + quotas, prompt-injection defenses, input validation, web headers) rather than retrofitting them. |
| **Fixing** | the ref matching the finding — to repair it without weakening the rest. |
| **Reviewing** | every ref's §6 RULES as a deterministic OWASP / authn-z / injection / secrets / prompt-injection review — the assertions are written so a finding maps to a stable rule ID + severity. |

The refs supply the *principle*; apply the matching §6 RULES in whatever review format you already use.

---

## The 9 references

| Ref | Tier | Rule IDs | Maps to |
|---|---|---|---|
| [AUTHZ_AND_TENANT_ISOLATION](AUTHZ_AND_TENANT_ISOLATION.md) | core | `AUTHZ-*` | authz |
| [AUTHENTICATION_AND_SESSION](AUTHENTICATION_AND_SESSION.md) | core | `AUTHN-*` | auth-session · authz |
| [SECRETS_AND_CONFIG](SECRETS_AND_CONFIG.md) | core | `SECRET-*` | secrets |
| [RATE_LIMITING_AND_ABUSE](RATE_LIMITING_AND_ABUSE.md) | core | `RATE-*` | rate-limiting · authz |
| [PROMPT_INJECTION_AND_LLM](PROMPT_INJECTION_AND_LLM.md) | core | `PINJ-*` | prompt-injection · input-validation |
| [INPUT_VALIDATION_AND_INJECTION](INPUT_VALIDATION_AND_INJECTION.md) | core | `INVAL-*` | input-validation |
| [WEB_SECURITY_HEADERS_CSRF_CORS](WEB_SECURITY_HEADERS_CSRF_CORS.md) | standard | `WEBSEC-*` | web-hardening · supply-chain |
| [LOGGING_BACKUP_IR](LOGGING_BACKUP_IR.md) | core | `OPS-*` | detect-respond |
| [MOBILE_CLIENT_SECURITY](MOBILE_CLIENT_SECURITY.md) | standard | `MOB-*` | mobile-client |

**Coverage — every security-review axis is owned by ≥1 ref:** `authz` (AUTHZ, RATE, AUTHN) · `auth-session` (AUTHN) · `secrets` (SECRET) · `rate-limiting` (RATE) · `prompt-injection` (PINJ) · `input-validation` (INVAL, PINJ) · `web-hardening` (WEBSEC) · `supply-chain` (WEBSEC) · `detect-respond` (OPS) · `mobile-client` (MOB). No gap.

---

*The lastmile application-security knowledge library — stack-generic, reviewer-grade security judgment, grounded in OWASP (Top 10 2025, API Top 10 2023, LLM Top 10 2025, Cheat Sheets), Supabase/Postgres RLS docs, and current 2025–2026 incident evidence. Sources are cited per ref. Last reviewed: 2026-06. Not a substitute for a professional security audit on apps handling sensitive data.*
