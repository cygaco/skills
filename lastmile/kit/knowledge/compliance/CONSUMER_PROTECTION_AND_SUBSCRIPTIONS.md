---
guide: CONSUMER_PROTECTION_AND_SUBSCRIPTIONS
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [consumer-subscriptions]
sources:
  - "https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule"
  - "https://www.dwt.com/insights/2024/10/ab-2863-updates-california-automatic-renewal-law"
  - "https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act"
  - "https://developer.apple.com/app-store/review/guidelines/"
  - "https://support.google.com/googleplay/android-developer/answer/140504"
  - "https://eur-lex.europa.eu/eli/dir/2023/2673/oj"
---

# Consumer Protection & Subscriptions

**Subscription compliance reduces, at a reviewer's altitude, to two checkable promises: a user can *cancel as easily as they signed up*, and they were *told the renewal terms and affirmatively agreed* before being charged. The reviewer's job is to confirm those mechanics exist in the build (a same-medium cancel path, pre-purchase disclosure, affirmative consent, a linked Terms of Service) — and to FLAG the record-keeping and reminder obligations that only a human/legal owner can confirm. Be precise about the law: the FTC's federal "click-to-cancel" rule was VACATED — but state and other federal law still bind, so "click-to-cancel is gone, relax" is wrong.**

This guide teaches a compliance reviewer (you or your AI) what a compliant paid-subscription surface looks like. The deep how-to for *drafting* a Terms of Service and the full legal text lives in the launch guide [`LEGAL_GUIDE.md`](../../guides/LEGAL_GUIDE.md); this reference is the judgment-time reference for spotting a non-compliant subscription flow, not the drafting playbook.

---

## 1. What this is

Consumer-protection-and-subscription compliance is the law and platform policy governing **paid, auto-renewing subscriptions** and the basic fairness of selling to consumers. The reviewer must hold the current legal picture precisely, because it shifted in 2025:

- **FTC "Click-to-Cancel" rule (amended Negative Option Rule, 16 CFR Part 425)** — finalized **October 2024**, but **VACATED in its entirety on July 8, 2025 by the U.S. Court of Appeals for the 8th Circuit** in *Custom Communications, Inc. v. FTC*, on **procedural grounds** (the FTC's rulemaking process was found deficient). **There is therefore no operative *federal* click-to-cancel rule right now.** This does NOT mean cancellation requirements are gone.
- **ROSCA (Restore Online Shoppers' Confidence Act, 15 U.S.C. §§ 8401–8405)** — still in force. Requires, for online negative-option sales: **clear disclosure** of material terms, **express informed consent** before charging, and a **simple mechanism to stop recurring charges.**
- **FTC Act §5** — bans unfair/deceptive practices; dark-pattern subscriptions remain actionable independent of the vacated rule.
- **California's Automatic Renewal Law (ARL), amended by AB 2863 (effective July 1, 2025)** — the strictest broadly-applicable US regime. Requires: cancel **in the same medium** the user signed up in; **two separate consents** (one for the service, a distinct one for auto-renewal); coverage of **free trials**; clear **pre-billing disclosure**; an **annual reminder**; and **retention of consent records ≥ 3 years**.
- **Other state ARLs** — e.g. **New York GBL § 527-a**, **Massachusetts 940 CMR 38.00**, and others, each with their own disclosure/cancel rules.
- **EU "Withdrawal Button" Directive (EU) 2023/2673** — adds a **prominent online cancellation/withdrawal function** for distance contracts; **applies from June 19, 2026.** Plus the standing **14-day right of withdrawal** for EU consumers.
- **Platform policy** — **Apple Guideline 3.1.2** and **Google Play** require **pre-purchase disclosure** of subscription terms (price, period, "renews until cancelled"). The stores handle cancellation natively for in-app purchases — **but web/Stripe-billed subscriptions are outside store control and need a self-built easy-cancel path.**

The reviewer confirms the *mechanics*; whether a specific clause satisfies a specific state's wording is legal judgment — FLAG it.

---

## 2. Why it matters

- **The vacatur is a trap for the unwary.** A reviewer who "knows" click-to-cancel is the law (it was headline news in 2024) will mis-apply a vacated federal rule; a reviewer who hears "it was struck down" will wrongly green-light a hard-to-cancel flow. **The correct posture: no federal click-to-cancel rule, but CA ARL, ROSCA, FTC §5, and other state laws still mandate easy, same-medium cancellation and pre-charge consent.** Precision here is the whole point.
- **Dark-pattern subscriptions are a top enforcement target.** The FTC and state AGs continue to bring deceptive-subscription cases under §5/ROSCA/ARL even without the new rule. "Roach-motel" cancel flows (easy to join via web, only cancellable by phone during business hours) are exactly what these laws forbid.
- **Store rejection.** Apple 3.1.2 / Google reject subscriptions that don't disclose renewal terms before purchase.
- **The mechanics are checkable.** "Is there a cancel button reachable in the same medium as signup?" "Is the renewal price/period shown before the consent action?" "Is there a separate auto-renewal consent?" — these are build facts a compliance reviewer can verify.

**For a compliance review specifically:** the usual review checks that the build matches its spec and standards. Subscriptions extend that to "does the build honor the cancellation + disclosure + consent contract?" A web/Stripe subscription with no self-serve cancel path is a **critical** finding (SUBS-01). A purchase button with no pre-purchase renewal disclosure + affirmative consent is **serious** (SUBS-02). Record-retention, the annual reminder, and which *exact* state clauses apply are legal/operational facts the reviewer **FLAGS** for human confirmation, not hard PASS/FAIL — and the reviewer must state the FTC vacatur precisely so downstream readers don't relax cancellation discipline.

---

## 3. Core principles / requirements

### 3.1 Easy, same-medium cancellation (ROSCA "simple mechanism"; CA ARL same-medium)

A user must be able to cancel **as easily as they subscribed**, and under CA ARL **in the same medium** they used to sign up (signed up online → cancellable online; no forcing a phone call or retention gauntlet). For **store-billed** in-app subscriptions, Apple/Google provide native cancellation — that satisfies the mechanic. For **web / Stripe-billed** subscriptions, the store does nothing — the product must **build its own easy cancel path** (a self-serve "Cancel subscription" in account settings, ideally a few clicks, no mandatory phone-only route).

### 3.2 Pre-purchase disclosure + affirmative consent (ROSCA; CA ARL; Apple 3.1.2)

**Before** the charge, and **adjacent to** the consent action, the user must clearly see the material terms: **price**, **billing period**, that it **auto-renews until cancelled**, and how to cancel. Consent must be **affirmative** (an actual click/tap on a button that says what it does) — not buried, not pre-checked, not inferred.

### 3.3 Two separate consents (CA ARL / AB 2863)

CA ARL requires the **auto-renewal consent to be distinct from the consent to the underlying service** — the user agrees to the product *and separately* acknowledges the auto-renewing charge. A single "I agree" that bundles both can fail.

### 3.4 Free trials are covered (CA ARL)

A **free-trial → paid conversion** is a negative option: the user must be told, before the trial, the **post-trial price**, the **conversion date/terms**, and how to cancel before being charged — and must consent to that. "First month free" with a silent auto-charge afterward is the classic violation.

### 3.5 Annual reminder + consent-record retention (CA ARL — human/legal FLAG)

CA ARL requires a **periodic reminder** (annual for many terms) of the ongoing subscription and how to cancel, and **retention of the consent record for ≥ 3 years**. These are operational/legal obligations the reviewer generally **cannot verify from the repo** (they involve a sending schedule and a records system) — so the reviewer **FLAGS** them for human/legal confirmation.

### 3.6 EU withdrawal (Directive (EU) 2023/2673 — applies June 19, 2026)

For EU consumers: a **prominent, easily-findable online cancellation/withdrawal function** (the "withdrawal button"), plus the standing **14-day right of withdrawal** for distance contracts. If the product serves EU users, FLAG that this function must be present and confirmed (and note the June 19, 2026 application date).

### 3.7 A Terms of Service exists (FTC §5; contract basics)

A paid product needs a **Terms of Service**, present and **linked** (in-app + at purchase), covering at minimum the subscription terms, limitation of liability, and governing law. The reviewer checks **presence + linkage**; the *drafting depth* (the exact liability/arbitration/governing-law clauses) lives in the LEGAL launch guide and is a human/legal responsibility — the reviewer FLAGS adequacy of clause content.

---

## 4. Concrete examples (what compliant vs non-compliant looks like)

**Same-medium cancel for web/Stripe billing — DON'T / DO**
- DON'T: a SaaS that takes Stripe subscriptions on the web but offers no in-app cancel — "email us / call during business hours to cancel." Roach-motel; fails ROSCA + CA ARL same-medium.
- DO: a self-serve "Cancel subscription" button in account settings that cancels the Stripe subscription in a few clicks, no phone gate. (Store-billed IAP: rely on the native Apple/Google cancel — that path is compliant.)

**Pre-purchase disclosure + consent — DON'T / DO**
- DON'T: a "Start" button that begins a $9.99/mo charge with the price and "renews monthly until cancelled" only buried in a linked ToS.
- DO: directly above/at the purchase button: "$9.99/month, renews monthly until you cancel. Cancel anytime in Settings." with an explicit "Subscribe — $9.99/mo" affirmative button.

**Two consents (CA ARL) — DON'T / DO**
- DON'T: one checkbox "I agree to the Terms" that silently includes auto-renewal.
- DO: separate the agreement to the service from a distinct, clearly-labeled acknowledgement of the auto-renewing charge.

**Free trial — DON'T / DO**
- DON'T: "7 days free!" then a silent $49/year charge on day 8 with no pre-trial disclosure of the price or conversion.
- DO: "Free for 7 days, then $49/year. Cancel anytime before [date] in Settings and you won't be charged." — disclosed and consented before the trial starts.

**Terms of Service presence — DON'T / DO**
- DON'T: a paid app with no ToS, or a ToS that exists but isn't linked at the point of purchase or in-app.
- DO: a live `/terms` page linked in-app and at checkout.

**Stating the law precisely — DO**
- DO (reviewer note): "The FTC click-to-cancel rule was vacated (8th Cir., Jul 8 2025) on procedural grounds, so there is no operative *federal* click-to-cancel rule; **however** CA ARL (AB 2863, eff. Jul 1 2025), ROSCA, FTC §5, and other state ARLs still require easy, same-medium cancellation and pre-charge consent — do not relax the cancel-path requirement."

---

## 5. Common failure modes

| Failure | How it reads / what breaks | How the reviewer detects it |
|---|---|---|
| Web/Stripe subscription with no self-serve cancel | Roach-motel; ROSCA + CA ARL same-medium violation | A Stripe (or other web) recurring charge exists but no in-app "Cancel subscription" path; cancellation routed only through phone/email/support |
| Renewal terms not disclosed before purchase | ROSCA / CA ARL / Apple 3.1.2 reject | Purchase/subscribe action with no adjacent price + period + "renews until cancelled" disclosure (terms only in a linked ToS) |
| Consent not affirmative / pre-checked / bundled | Express-consent failure (ROSCA, CA ARL) | Auto-renewal enrolled without a distinct affirmative click; a pre-ticked box; a single bundled "I agree" covering both service + renewal |
| Free trial auto-converts with no disclosure | CA ARL free-trial violation | Trial→paid conversion in code with no pre-trial disclosure of post-trial price/date/cancel |
| Mis-stating the FTC vacatur ("click-to-cancel is dead, relax") | Reviewer green-lights a hard-to-cancel flow | A reviewer rationale that treats easy cancellation as no-longer-required — flag the rationale itself as wrong; state law still binds |
| No Terms of Service, or ToS not linked | Contract gap; FTC §5 exposure | No `/terms` document, or present but not linked in-app / at purchase |
| EU users, no withdrawal function (post Jun 19 2026) | Dir. (EU) 2023/2673 non-compliance | EU consumer subscriptions with no prominent online cancel/withdrawal function — FLAG (date-gated) |
| Annual reminder / consent records absent | CA ARL operational obligation unmet | Not verifiable from repo → FLAG for human confirmation (reminder schedule + ≥3-yr record retention) |
| Store-billed sub also gates cancel behind a custom phone flow | Conflicts with native cancel; deceptive | A custom cancel-retention flow that obstructs the native Apple/Google cancellation |

> **Detectability caveat (important for an automated review):** the reviewer can mechanically detect *build mechanics* — a cancel path's presence and medium, a disclosure block adjacent to the purchase action, the presence of a linked ToS, a separate auto-renewal consent. It generally **cannot** verify *operational/legal* facts from the repo — the annual-reminder sending schedule, ≥3-year consent-record retention, whether a specific clause satisfies a specific state's wording, or whether a given product is in-scope of a given state law. Those are **FLAGS** for human/legal confirmation, never a hard PASS. And the reviewer must **state the FTC vacatur precisely** (vacated federally on procedural grounds; state + other federal law still binds) — an imprecise statement is itself a finding.

---

## 6. ✅ Agent-applicable RULES

Each rule: **[ID] severity — assertion → maps_to → detection (observed vs expected).** Items needing human/legal judgment are written as **FLAGS** ("reviewer flags for human/legal confirmation"), not hard automated PASS/FAIL, and say so.

**Cancellation (the core mechanic)**
- **[SUBS-01] critical — Every paid auto-renewing subscription has an easy, same-medium cancel path (self-built for web/Stripe billing; native cancel suffices for store-billed IAP).** → `consumer-subscriptions`. Detect: a recurring charge exists (Stripe/other web billing) but no in-app self-serve "Cancel subscription" path, or cancellation is routed only via phone/email/support = FAIL (observed: no same-medium cancel; expected: cancel as easy as signup, same medium). For store-billed IAP, the native Apple/Google cancel satisfies this — but a custom flow that *obstructs* it = FAIL.
- **[SUBS-07] serious — No dark patterns in the cancel/subscribe flow (FTC §5; ROSCA).** → `consumer-subscriptions`. Detect: pre-checked auto-renewal, a hidden/disguised cancel, a mandatory multi-step retention gauntlet, or asymmetric prominence (easy subscribe / obstructed cancel) = FAIL.

**Disclosure & consent (before the charge)**
- **[SUBS-02] serious — Auto-renewal terms (price, billing period, "renews until cancelled," how to cancel) are clearly disclosed BEFORE purchase, adjacent to an affirmative consent action.** → `consumer-subscriptions`. Detect: a subscribe/purchase control with no adjacent disclosure of price + period + auto-renew + cancel method (terms only inside a linked ToS), or consent that is not an explicit affirmative click = FAIL (observed: buried/absent terms; expected: clear pre-purchase disclosure + affirmative consent).
- **[SUBS-03] serious — Free-trial → paid conversion is disclosed and consented before the trial (CA ARL).** → `consumer-subscriptions`. Detect: a trial that auto-converts to a paid charge in code with no pre-trial disclosure of the post-trial price, conversion date, and cancel-before-charge method = FAIL.
- **[SUBS-06] serious — Auto-renewal consent is separate from the underlying-service consent (CA ARL / AB 2863).** → `consumer-subscriptions`. Detect: a single bundled "I agree" or a pre-ticked box that enrolls auto-renewal without a distinct, clearly-labeled affirmative auto-renewal acknowledgement = FAIL. Because exact-clause sufficiency is a legal call, pair the FAIL with a FLAG for legal confirmation of the wording.

**Terms of Service**
- **[SUBS-04] serious — A Terms of Service is present and linked (in-app + at purchase).** → `consumer-subscriptions`. Detect: no `/terms` document, or present but not linked in-app and at the point of purchase = FAIL. (Clause *content* adequacy — limitation of liability, governing law, arbitration — is a human/legal FLAG; the LEGAL launch guide owns the drafting depth.)

**Legal-precision guardrail (the vacatur)**
- **[SUBS-08] serious — The FTC click-to-cancel vacatur is stated precisely; cancellation discipline is NOT relaxed.** → `consumer-subscriptions`. Detect: any reviewer rationale, doc, or build decision that treats easy/same-medium cancellation as no-longer-required because "click-to-cancel was struck down" = FAIL. Correct framing: the federal rule (16 CFR Part 425 amendments) was VACATED on **Jul 8, 2025 (8th Cir., *Custom Communications v. FTC*)** on **procedural** grounds — but **CA ARL (AB 2863, eff. Jul 1 2025), ROSCA, FTC §5, and other state ARLs still bind**, so easy same-medium cancellation + pre-charge consent remain required.

**Post-cancel honesty**
- **[SUBS-09] serious — Post-cancel entitlement matches the promise.** → `consumer-subscriptions`. Detect: the cancel flow/policy promises access "until the end of the billing period" (or the checkout sold a period) but code revokes entitlements immediately at cancel-click (e.g. ignores `cancel_at_period_end` / kills access on the cancellation webhook instead of period end) = FAIL; the inverse (silently continuing to charge after a completed cancel) = FAIL (observed: entitlement/billing behavior contradicts the stated cancel terms; expected: access and billing follow exactly what the cancel surface promises).

**Human/legal-judgment FLAGS (never a hard automated PASS/FAIL)**
- **[SUBS-05] minor — Annual renewal reminder + consent-record retention (≥3 yrs, CA ARL) flagged for human/legal confirmation.** → `consumer-subscriptions`. Detect: not verifiable from the repo (sending schedule + records system); always emit a FLAG that a human must confirm the periodic reminder and ≥3-year consent-record retention are in place.
- **[SUBS-09] minor — Applicable-jurisdiction subscription rules (CA ARL, NY GBL 527-a, MA 940 CMR 38.00, other state ARLs, EU withdrawal) flagged for human/legal confirmation.** → `consumer-subscriptions`. Detect: which exact state/EU rules apply depends on where users are and clause wording the reviewer can't adjudicate; emit a FLAG naming the plausibly-applicable regimes for human confirmation. Never assert "no subscription law applies."
- **[SUBS-10] minor — EU "Withdrawal Button" function + 14-day right of withdrawal flagged for EU-facing products (Dir. (EU) 2023/2673, applies Jun 19 2026).** → `consumer-subscriptions`. Detect: EU consumer subscriptions present; FLAG that a prominent online withdrawal/cancel function and the 14-day withdrawal right must be confirmed by a human, noting the **June 19, 2026** application date.

> **Coverage note for a review:** [SUBS-01, 02, 03, 04, 06, 07] are largely detectable from the build (cancel path, disclosure adjacency, consent shape, ToS presence). [SUBS-08] is a precision guard on the reviewer's own reasoning. [SUBS-05, 09, 10] depend on operational/legal facts off-repo and are written as FLAGS for human/legal confirmation. The ToS-drafting depth lives in the LEGAL launch guide. **This document is not legal advice.**

---

## 7. Sources

- WilmerHale — *Eighth Circuit Vacates the FTC's "Click-to-Cancel" Rule* (Aug 1 2025) — https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule (*Custom Communications, Inc. v. FTC*, vacated Jul 8 2025 on procedural grounds; no operative federal click-to-cancel rule)
- Davis Wright Tremaine — *AB 2863 Updates California's Automatic Renewal Law* — https://www.dwt.com/insights/2024/10/ab-2863-updates-california-automatic-renewal-law (CA ARL eff. Jul 1 2025: same-medium cancel, two consents, free trials, pre-billing disclosure, annual reminder, ≥3-yr records)
- FTC — *Restore Online Shoppers' Confidence Act (ROSCA, 15 U.S.C. §§ 8401–8405)* — https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act (clear disclosure + express consent + simple cancel)
- Apple — *App Store Review Guidelines* (3.1.2 subscriptions — pre-purchase term disclosure) — https://developer.apple.com/app-store/review/guidelines/
- Google Play — *Subscriptions and free trials policy* — https://support.google.com/googleplay/android-developer/answer/140504
- EUR-Lex — *Directive (EU) 2023/2673 (the "Withdrawal Button" / distance financial-services directive)* — https://eur-lex.europa.eu/eli/dir/2023/2673/oj (prominent online cancellation function; applies Jun 19 2026; 14-day withdrawal)
- Other state ARLs to confirm with counsel: New York GBL § 527-a; Massachusetts 940 CMR 38.00
- Product LEGAL launch guide (deep ToS drafting, not this reference) — see [`LEGAL_GUIDE.md`](../../guides/LEGAL_GUIDE.md)

---

*This is a compliance-review reference in the lastmile [`knowledge/compliance/`](README.md) library. It states checkable mechanics and FLAGS the items that need human/legal judgment — and it states the FTC click-to-cancel vacatur precisely so cancellation discipline is not wrongly relaxed. **It is not legal advice.** Laws and platform policies change; the official sources above are the source of truth.*
