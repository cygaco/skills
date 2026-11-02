---
guide: DATA_RIGHTS_OPERATIONS
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [data-rights-ops, privacy-data]
sources:
  - "https://gdpr-info.eu/art-12-gdpr/"
  - "https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf"
  - "https://support.google.com/googleplay/android-developer/answer/13327111"
  - "https://developer.apple.com/support/offering-account-deletion-in-your-app/"
  - "https://www.edpb.europa.eu (CEF 2025 right-to-erasure report)"
  - "https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-largest-ccpa-settlement-date-secures-155"
---

# Data-Rights Operations (DSAR + deletion + retention)

## 1. What this is

The OPERATIONAL layer above PRIV-05/PRIV-10 (which assert the export/delete features exist): how requests are verified, clocked, logged, cascaded to processors, reconciled with backups, and how long data lives at all. The founder-facing companion is [`DATA_REQUESTS_GUIDE.md`](../../guides/DATA_REQUESTS_GUIDE.md).

## 2. Why it matters

Statutory clocks start when a request ARRIVES (GDPR Art. 12(3): one month, extendable; CCPA/CPRA: 45 days + 45 extension). Enforcement now targets the OPERATIONS, not just the absence of features — and notably punishes OVER-verification: Dutch DPA fined DPG Media €525k for demanding ID copies; the CPPA fined Honda $632.5k and Todd Snyder $345.2k for ID-gating rights requests. Google Play blocks app review without an in-app deletion path AND a web deletion link declared in the Data Safety form (answer 13327111); Apple 5.1.1(v) requires in-app account deletion.

## 3. Core principles / requirements

- **3.1 Right-sized verification** — verify via the authenticated session or a tokenized email round-trip; demand stronger proof only proportionate to risk. Demanding government ID for ordinary requests is itself a violation (data minimization).
- **3.2 The clock + the queue** — every request gets a record: `received_at / verified_at / due_at / fulfilled_at / status`. The queue is the audit defense.
- **3.3 Honest deletion** — hard-delete or true anonymization; a soft `deleted=true` flag retaining PII is not erasure unless a scheduled hard-delete follows shortly.
- **3.4 Processor cascade** — deletion must propagate to every processor holding the user's data (payments, email, analytics, AI vendors); each processor entry names its deletion method.
- **3.5 Backups answer** — rolling backup retention window, disclosed in the policy; deleted data ages out of backups within the stated window; restores must not resurrect deleted users without re-deletion.
- **3.6 Legal exceptions are narrow** — billing/tax records may be retained under legal obligation (GDPR Art. 17(3)); retain the invoice fields, not the whole profile, and say so in the policy.
- **3.7 Store mandates** — Play: in-app deletion + web deletion link in Data Safety (app-review blocker). Apple 5.1.1(v): in-app account deletion for apps with account creation.
- **3.8 Retention schedule exists** — logs, analytics, deleted-account residue, invoices each have a stated lifetime; data with no purpose and no clock is the breach/DSAR multiplier.

## 4. Concrete examples

- Compliant: "Download my data" behind login; deletion flow that hard-deletes rows, calls Stripe customer-delete + email-tool suppression, writes a fulfillment record; policy states "backups age out within 35 days".
- Non-compliant: deletion = `is_deleted` flag only; "email us your passport to delete your account"; web app with Play listing but no web deletion URL; request inbox with no timestamps.

## 5. Common failure modes

Soft-delete masquerading as erasure · deleted users persisting in analytics/CRM/push tools · over-verification (ID demands) · no request log → no defense in an audit · backup restores resurrecting deleted accounts · "delete immediately" in the policy while code holds a 90-day shadow copy · missing the Play web-deletion link at submission.

## 6. ✅ Agent-applicable RULES

Each rule: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

- **[DSR-01] critical — Account deletion is not soft-flag-only.** → `data-rights-ops`. Detect: the delete path sets a flag/status but no hard-delete/anonymization job exists for the flagged rows = FAIL (observed: PII retained indefinitely post-"deletion"; expected: removal or true anonymization, immediate or scheduled).
- **[DSR-02] serious — Deletion cascades to all mapped stores.** → `data-rights-ops`. Detect: user-keyed tables/stores (incl. analytics events, files, vector stores) not touched by the deletion path = FAIL; off-repo processor cascade not evidenced = FLAG.
- **[DSR-03] serious — Export/deletion requests require session re-auth or a verified email token; never government ID for ordinary requests.** → `data-rights-ops`. Detect: rights flow demands ID documents or notarization for a standard request = FAIL (over-verification is itself a violation); no verification at all on an unauthenticated channel = FAIL.
- **[DSR-04] serious — A privacy-request record exists with `received_at/verified_at/due_at/fulfilled_at/status`.** → `data-rights-ops`. Detect: rights flows exist but no request log/queue persists = FAIL; queue lacks due-date computation (GDPR 1 month / CCPA 45 days) = FLAG.
- **[DSR-05] serious — Processors are enumerated WITH a deletion method each.** → `data-rights-ops`. Detect: processor inventory (or policy "who we share with") lacks a per-processor deletion route (API call, dashboard, ticket) = FAIL when the cascade is therefore unimplementable.
- **[DSR-06] serious — Android apps with accounts have in-app deletion AND a web deletion path; iOS apps with accounts have in-app deletion (5.1.1(v)).** → `data-rights-ops`, `app-store-policy`. Detect: account creation exists, target includes Android, and no web deletion route/URL is present or declared = FAIL; iOS target with no in-app delete = FAIL.
- **[DSR-07] serious — Stated retention matches code.** → `data-rights-ops`. Detect: policy/backup statements ("deleted within 30 days") vs actual job/config retention (e.g. 365-day soft-retention, unbounded log retention) mismatch = FAIL.
- **[DSR-08] minor — A retention schedule exists for logs/analytics/deleted-account residue/invoices.** → `data-rights-ops`. Detect: no retention statement anywhere while logs store PII (emails, IPs, prompts) = FLAG (observed: unbounded PII accumulation; expected: stated lifetimes).
- **[DSR-09] minor — Deleted users disappear from marketing/push reach.** → `data-rights-ops`. Detect: deletion path does not suppress/remove the user in email/push providers = FLAG (FAIL where the send-list is repo-local and provably retains them).

## 7. Sources

Primary: GDPR Art. 12 (gdpr-info.eu) · EDPB access-rights guidelines 01/2022 v2 · EDPB CEF 2025 right-to-erasure report · Google Play account-deletion policy (support.google.com answer 13327111) · Apple account-deletion support page + 5.1.1(v). Enforcement: CPPA Honda $632.5k, Todd Snyder $345.2k; Dutch DPA DPG Media €525k; CA AG Healthline (largest CCPA settlement). *Last reviewed: 2026-06. NOT legal advice; regime applicability stays a human FLAG (PRIV-06).*
