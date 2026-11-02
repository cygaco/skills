---
guide: INCIDENT_READINESS
anchor: none
shape: checklist
timing: reference
lead_time: "none"
tier: core
maps_to: [breach-incident]
sources:
  - "https://gdpr-info.eu/art-33-gdpr/"
  - "https://gdpr-info.eu/art-34-gdpr/"
  - "https://www.foley.com/insights/publications/2026/03/state-data-breach-notification-laws/"
  - "https://privacyrights.org (50-state breach-notification survey, 2026 edition)"
---

# Incident Readiness & Breach Flags

## 1. What this is

READINESS checks (does the product/founder have what the worst day requires) plus breach FLAGS. The reviewer verifies preparedness and flags possible notification duties — it must NEVER conclude "no notice required" for a real incident; that is a counsel decision. Founder-facing companion: [`INCIDENT_RESPONSE_GUIDE.md`](../../guides/INCIDENT_RESPONSE_GUIDE.md).

## 2. Why it matters

GDPR Art. 33: notify the supervisory authority within 72 hours of AWARENESS "unless the personal data breach is unlikely to result in a risk"; Art. 34: notify users when the breach is likely to result in a "high risk"; Art. 33(2): processors must notify the controller without undue delay. All 50 US states have breach-notification laws (patchwork triggers/deadlines; AG-notice thresholds commonly at ~500 residents). The 72-hour clock is shorter than a weekend — preparedness is the only way a solo founder makes it.

## 3. Core principles / requirements

- **3.1 Runbook exists before launch** — detect → contain → assess → notify → document, sized for one person, with the who-to-call list (processor security contacts, a breach lawyer identified in advance, insurer).
- **3.2 Evidence preservation** — snapshot before wipe-and-redeploy; investigability beats fast cosmetic recovery.
- **3.3 Logs sufficient to answer** "what was accessed, when, whose data" for likely incident classes.
- **3.4 Assessment template** with `aware_at / contained_at / data_categories / affected_users / jurisdictions / encryption_status / notification_decision / counsel_escalated`.
- **3.5 Processor breach duty flows TO the founder** (Art. 33(2)/DPA terms) — the founder's own notification duties don't vanish because the breach happened at a vendor.
- **3.6 The notify/don't-notify legal call escalates to counsel** — always.

## 4. Concrete examples

- Compliant: an incident runbook in the repo/admin docs; secrets-rotation procedure; admin actions audited; access logs retained ≥ the investigation horizon; security contact published.
- Non-compliant: no runbook; logs rotate in 24h; the only admin is a shared password; a breach assessment that ends "we decided it was fine" with no counsel involvement.

## 5. Common failure modes

Wiping the compromised box before snapshotting · "still investigating" past the 72-hour mark · no processor security contacts when the vendor is the breach source · panic-mailing all users before facts · silence-as-strategy (FTC/AG exposure) · logs too short to scope the incident.

## 6. ✅ Agent-applicable RULES

Each rule: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

- **[BRCH-01] serious — An incident runbook exists (detect/contain/assess/notify/document + contacts).** → `breach-incident`. Detect: no `incident_runbook` (or equivalent ops doc) anywhere in repo/admin docs while the product stores personal data = FAIL.
- **[BRCH-02] serious — A security contact path exists** (security@/contact in app or repo docs). → `breach-incident`. Detect: no reachable security contact = FAIL.
- **[BRCH-03] serious — The processor inventory carries a security/breach contact or DPA link per processor.** → `breach-incident`. Detect: processors named with no breach-contact route = FLAG (FAIL if no processor inventory at all while processors are in the dependency list).
- **[BRCH-04] serious — Logging suffices to scope an incident** (authn events, admin actions, data-access paths) **and is retained beyond rotation-trivial windows.** → `breach-incident`. Detect: no auth/admin logging, or retention shorter than a plausible investigation (e.g. <7 days) = FLAG; PII-free products may pass with less.
- **[BRCH-05] minor — A secrets-rotation procedure exists.** → `breach-incident`. Detect: no documented rotation route for API keys/DB creds = FLAG.
- **[BRCH-06] minor — A breach-assessment template exists with `aware_at/contained_at/data_categories/affected_users/jurisdictions/encryption_status/notification_decision/counsel_escalated`.** → `breach-incident`. Detect: runbook present but no assessment fields = FLAG.
- **[BRCH-07] critical — The reviewer NEVER concludes "no notification required" for a concrete incident.** → `breach-incident`. Detect: any artifact where an automated assessment closed a real incident without `counsel_escalated` = FLAG for human/legal confirmation, stating the GDPR 72h/Art. 34 and state-law triggers that may apply. This rule constrains your AI itself.
- **[BRCH-08] minor — Admin access is logged.** → `breach-incident`. Detect: admin/founder surfaces mutate data with no audit record = FLAG (ties to ADMIN-SEC-*).

## 7. Sources

Primary: GDPR Art. 33 / Art. 34 (gdpr-info.eu). Secondary: Foley 50-state breach-notification chart (2026-03); PrivacyRights.org 50-state survey (2026 edition). *Last reviewed: 2026-06. NOT legal advice; notification decisions are counsel calls by construction (BRCH-07).*
