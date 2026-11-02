---
guide: README-COMPLIANCE
anchor: none
shape: notice
timing: reference
lead_time: "none"
---

# Launch-Compliance Knowledge Library — deeper references for you and your AI

> This is the **launch-compliance knowledge library**: 8 self-contained, teachable references for a **compliance review** — the review that asks "is this product *legally and policy* shippable?" alongside the correctness checks. Each ref closes with a §6 **RULES** section; because much of compliance needs human/legal judgment, many rules are written as **FLAGs** (the reviewer surfaces them for human confirmation) rather than hard automated PASS/FAIL.
>
> **⚠️ Not legal advice.** These refs help a reviewer (you or your AI) *spot likely issues + missing artifacts*; they do not make a product compliant and do not replace a lawyer. The hire-a-lawyer triggers live inside the refs.
>
> **These are NOT launch guides.** Every ref here is `anchor: none` — deep reference material, read when a finding or a task needs the precise rule. The newbie-facing, plain-language playbooks for the same topics are the separate launch guides **[`LEGAL_GUIDE.md`](../../guides/LEGAL_GUIDE.md)**, **[`PRIVACY_GDPR_GUIDE.md`](../../guides/PRIVACY_GDPR_GUIDE.md)**, and **[`APP_STORE_GUIDE.md`](../../guides/APP_STORE_GUIDE.md)**. This library is the deep, reviewer-grade layer behind them.

---

## How to use these

| When | What to read here |
|---|---|
| **Compliance review** | every ref's §6 RULES — to extend the usual "does the build match its spec" checks with code↔policy↔store-label compliance: does every collected data point appear in the privacy policy + the Apple/Google privacy labels (three-way match); is every paid subscription cancellable; is the app-store-policy surface covered; is there an IP/trademark/AGPL exposure to flag. |

The refs supply the *principle*; apply them in whatever review format you already use. They **add to, never weaken**, the review you already run.

---

## The 8 references

| Ref | Tier | Rule IDs | Maps to |
|---|---|---|---|
| [PRIVACY_AND_DATA_COMPLIANCE](PRIVACY_AND_DATA_COMPLIANCE.md) | core | `PRIV-*` | privacy-data |
| [CONSUMER_PROTECTION_AND_SUBSCRIPTIONS](CONSUMER_PROTECTION_AND_SUBSCRIPTIONS.md) | core | `SUBS-*` | consumer-subscriptions |
| [APP_STORE_AND_PLATFORM_POLICY](APP_STORE_AND_PLATFORM_POLICY.md) | core | `STORE-*` | app-store-policy · privacy-data |
| [IP_AND_TRADEMARK](IP_AND_TRADEMARK.md) | standard | `IP-*` | ip-trademark |
| [DATA_RIGHTS_OPERATIONS](DATA_RIGHTS_OPERATIONS.md) | core | `DSR-*` | data-rights-ops · privacy-data |
| [INCIDENT_READINESS](INCIDENT_READINESS.md) | core | `BRCH-*` | breach-incident |
| [MINORS_AND_AGE_ASSURANCE](MINORS_AND_AGE_ASSURANCE.md) | core | `MINOR-*` | minors · privacy-data |
| [AI_PRODUCT_COMPLIANCE](AI_PRODUCT_COMPLIANCE.md) | core | `AIACT-*` | ai-compliance · privacy-data |

**Coverage — every compliance axis is owned by ≥1 ref:** `privacy-data` (PRIVACY, STORE, DSR, MINOR, AIACT) · `consumer-subscriptions` (SUBS) · `app-store-policy` (STORE) · `ip-trademark` (IP) · `data-rights-ops` (DSR) · `breach-incident` (BRCH) · `minors` (MINOR) · `ai-compliance` (AIACT). No gap.

The founder-facing companions for the newer refs: [`DATA_REQUESTS_GUIDE.md`](../../guides/DATA_REQUESTS_GUIDE.md), [`INCIDENT_RESPONSE_GUIDE.md`](../../guides/INCIDENT_RESPONSE_GUIDE.md), [`MINORS_GUIDE.md`](../../guides/MINORS_GUIDE.md), [`AI_COMPLIANCE_GUIDE.md`](../../guides/AI_COMPLIANCE_GUIDE.md), [`SUBSCRIPTION_CANCELLATION_GUIDE.md`](../../guides/SUBSCRIPTION_CANCELLATION_GUIDE.md), [`COMPLIANCE_TRIGGERS_GUIDE.md`](../../guides/COMPLIANCE_TRIGGERS_GUIDE.md). A guardrail by construction: the reviewer FLAGS possible breach-notification duties but never concludes "no notice required" (BRCH-07), and the under-13 line stays a counsel escalation.

---

*The lastmile launch-compliance knowledge library — stack-generic, reviewer-grade compliance judgment, grounded in current 2025–2026 primary sources (FTC, USPTO, US Copyright Office, GDPR/CCPA text, Apple App Review Guidelines, Google Play policy). Sources cited per ref. Last reviewed: 2026-06. **Not legal advice** — a flagged item means "get a human/lawyer to confirm," not "this is fine."*
