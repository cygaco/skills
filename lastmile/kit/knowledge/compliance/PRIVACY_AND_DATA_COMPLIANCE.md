---
guide: PRIVACY_AND_DATA_COMPLIANCE
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [privacy-data]
sources:
  - "https://gdpr-info.eu/art-30-gdpr/"
  - "https://gdpr-info.eu/art-5-gdpr/"
  - "https://support.google.com/googleplay/android-developer/answer/10787469"
  - "https://developer.apple.com/app-store/review/guidelines/"
  - "https://developer.apple.com/app-store/app-privacy-details/"
  - "https://oag.ca.gov/privacy/ccpa"
  - "https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026"
---

# Privacy & Data Compliance

**Privacy compliance, at a reviewer's altitude, reduces to one checkable obligation: declare every personal-data point the product touches, and make every declaration match reality — the code, the privacy policy, and the store privacy labels must tell the same true story. The reviewer's job is not to draft policy or render legal opinions; it is to detect *mismatches* between what the product collects and what it claims to collect, and to FLAG the rest for human/legal confirmation.**

This guide trains a compliance reviewer (you or your AI) to treat privacy as a *three-way consistency check* — code ↔ policy ↔ store label — plus a small set of presence checks (a policy exists, it is linked, deletion is offered). The deep, step-by-step how-to for *building* the policy, consent banner, DSAR export, and deletion flow lives in the product's launch guide [`PRIVACY_GDPR_GUIDE.md`](../../guides/PRIVACY_GDPR_GUIDE.md); this reference is what the reviewer applies at judgment time, not the implementation playbook.

---

## 1. What this is

Personal-data compliance is the body of law and platform policy that governs collecting, storing, sharing, and deleting **personal data** (anything that identifies a person: name, email, IP, device ID, location, advertising ID, behavioral/usage data). The regimes that bind a normal consumer app:

- **GDPR / UK GDPR** (EU/EEA + UK) — applies whenever *any* user is in the EU/EEA or UK, regardless of where the developer is. Requires a lawful basis, transparency, data minimization, user rights (access/export/erasure), named processors, and — for the inventory obligation — **Records of Processing Activities (ROPA), Art. 30**: a maintained record of *what* you process, *why*, *who you share with*, and *how long you keep it*.
- **CCPA / CPRA** (California) — requires disclosing the **categories of personal information** collected, the purposes, and the categories of third parties it is shared/sold with. Applies to for-profit businesses meeting thresholds (see §3).
- **US state comprehensive laws** — roughly **20 states** have comprehensive privacy laws in effect or taking effect through 2026 (Texas notably has **no business-volume threshold** — it binds nearly any business handling Texans' data).
- **Platform policy** (binds independently of statute) — **Apple's App Privacy "Nutrition Label"** and **Google Play's Data Safety form** are mandatory declarations submitted to the store; **Stripe** and most processors require a privacy-policy URL. These are *promises to the platform* and are enforced by review/rejection.

The reviewer's altitude: confirm the declarations exist and are *internally consistent*, not adjudicate whether the lawful basis is correct (that is legal judgment — FLAG it).

---

## 2. Why it matters

A privacy mismatch is not a cosmetic defect — it is a written, machine-checkable record of a broken promise. Three concrete failure surfaces:

- **Store rejection / removal.** Google's **April 2025** Data Safety enforcement tightened: the Android Advertising ID and equivalent IDs must be declared as **device or other identifiers**; any transfer of data to a third party or SDK counts as **"sharing"** and must be disclosed; mismatches between the form, the policy, and observed SDK behavior are flagged and can block the release. Apple rejects under Guideline 5.1.1 for label/policy mismatches and missing in-app account deletion.
- **Regulatory exposure.** A policy that says "we never share data" while a Meta/Google SDK exfiltrates events is an actionable misrepresentation under GDPR transparency duties and the FTC Act §5 (deceptive practices) — not a typo.
- **The mismatch is the bug class.** Each individual fix (add the SDK to the label, name the processor in the policy) is trivial; the *systemic* failure is that nobody checked the three artifacts against each other. That cross-check is exactly what a compliance reviewer is for.

**For a compliance review specifically:** the usual review already checks "does the code match the spec." Privacy extends that to "does the code match the *declared data practices*." A field the code collects (a `deviceId`, a `latitude`, a third-party analytics call) that does NOT appear in the privacy policy AND the store privacy label is a data-contract mismatch finding in the privacy domain. The reviewer detects the inconsistency; whether a given regime *applies* and whether the *lawful basis* is valid are human/legal calls the reviewer FLAGS — it never issues a hard PASS on those.

---

## 3. Core principles / requirements

### 3.1 The policy-exists floor

A **Privacy Policy is required if any personal data is collected** — by GDPR, CCPA, Apple, Google, and Stripe alike. It must be a live URL, linked both **in-app** and **in the store metadata**. No personal data collected at all (rare) is the only clean exemption — and "we use an analytics SDK" already means personal data is collected.

### 3.2 The three-way match (the core check)

The single most important invariant: **code ⇄ privacy policy ⇄ store privacy label all describe the same data.** Concretely, every data point the code collects must be:
1. **disclosed in the privacy policy** (what, why, shared-with-whom, retention), and
2. **declared in the Apple Privacy Nutrition Label AND the Google Play Data Safety form**.

A field present in one artifact but absent in another is a mismatch. The reviewer's enumerable list of "what the code collects" comes from: explicit form/input fields, device/OS identifiers read, location/contacts/camera/mic permissions, and — critically — **third-party SDKs** (analytics, ads, crash reporting, auth), each of which collects on the developer's behalf.

### 3.3 Third-party SDK collection is the developer's duty

When an SDK (Firebase, Meta, AppsFlyer, Sentry, Mixpanel…) collects or transmits data, the **developer** is responsible for disclosing it — in the policy ("who we share with") and the store label ("sharing"). Google's definition of "sharing" = **any transfer of user data to a third party**, including SDK-mediated transfers. Undisclosed SDK data flow is the most common real-world privacy mismatch.

### 3.4 Data minimization + stated purpose (GDPR Art. 5; ROPA Art. 30)

Every collected field must have a **stated purpose**. Collecting a phone number, birthday, or precise location "just in case" with no purpose in the policy violates minimization. The reviewer can check: does each collected field map to a purpose in the policy? A field with no purpose = a finding.

### 3.5 Named processors

The policy must **name the processors** that receive data (the DB host, payment processor, email/analytics/crash vendors) — not say "trusted third parties." This is both a GDPR transparency requirement and the input to the three-way match (each named processor should correspond to a real dependency, and vice versa).

### 3.6 In-app account deletion (Apple Guideline 5.1.1(v))

Any app that supports **account creation** must offer **in-app account deletion** (initiating deletion of the account *and* its data from within the app — not merely a "email us to delete" instruction). This is an Apple hard requirement and a GDPR erasure-right expectation. The deletion must be real (remove/anonymize), not a soft `is_deleted` flag.

### 3.7 Which regime applies (a human/legal FLAG, not an automated verdict)

The reviewer can *describe* the triggers but should FLAG the determination for human confirmation:
- **GDPR / UK GDPR** — any EU/EEA / UK user.
- **CCPA/CPRA** — a for-profit doing business in California meeting **any one** threshold: **> ~$26.6M annual gross revenue**, OR buys/sells/shares the personal information of **≥ 100,000** California consumers/households, OR derives **≥ 50% of revenue from selling/sharing** personal information. (The revenue figure is inflation-adjusted; treat the exact number as approximate and confirm.)
- **Other US states** — ~20 comprehensive laws by 2026; **Texas has no volume threshold**. Thresholds and definitions vary by state.

The reviewer does not compute whether a specific product crosses a revenue threshold (it lacks that data) — it FLAGS "applicable-regime determination needed."

---

## 4. Concrete examples (what compliant vs non-compliant looks like)

**Policy presence + linking — DON'T / DO**
- DON'T: ship an app that creates accounts and runs Firebase Analytics with no `/privacy` page, or with a policy that exists but is not linked in the App Store / Play metadata.
- DO: a live `/privacy` URL, linked in-app (settings/footer) AND pasted into both stores' privacy-policy-URL field.

**Three-way match — DON'T / DO**
- DON'T: code reads `advertisingId` and sends events to Meta's SDK, but the Play Data Safety form declares "No data shared" and the policy never mentions Meta. Three-way MISMATCH → store rejection + misrepresentation.
- DO: `advertisingId` declared as a *device or other identifier* on the Play form and Apple label, "shared with Meta for advertising" disclosed; Meta named as a processor in the policy. All three agree.

**Named processors — DON'T / DO**
- DON'T: "We may share your data with trusted partners and service providers." (Vague — fails GDPR transparency and breaks the match.)
- DO: "We share data with: Supabase (database hosting), Stripe (payments), Resend (email), PostHog (product analytics)." Each name corresponds to a real dependency.

**Data minimization — DON'T / DO**
- DON'T: a signup form collects date of birth and home address; the policy lists neither a purpose nor uses them anywhere in code. Orphan collection.
- DO: collect only email + display name; the policy states the purpose of each. If DOB is genuinely needed (age-gating), state that purpose.

**Account deletion — DON'T / DO**
- DON'T: a "Delete account" that sets `deleted = true` while the row (with the email) lives forever, or a policy that says "contact support to delete." Fails Apple 5.1.1(v) + GDPR erasure.
- DO: an in-app "Delete my account" that removes/anonymizes the user across tables and triggers processor-side deletion.

---

## 5. Common failure modes

| Failure | How it reads / what breaks | How the reviewer detects it |
|---|---|---|
| No privacy policy, or not linked in store metadata | Store rejection; unlawful collection | Personal data collected in code (any input field, ID, or SDK) but no policy file / no linked URL in app + store config |
| Code collects a field absent from policy and/or store label | Misrepresentation; Apple/Google flag/reject | Enumerate code-collected fields + SDKs; diff against policy disclosures and the Nutrition Label / Data Safety form — any item in one but not all three |
| Third-party SDK data flow undisclosed | Undisclosed "sharing"; Apr-2025 Play enforcement | An analytics/ads/crash/auth SDK dependency that is not named in the policy AND not declared as "sharing"/data-collected in the labels |
| Advertising/device ID not declared as identifier | Play Data Safety violation | `advertisingId` / IDFA / device ID read in code but not declared as a *device or other identifier* on the form |
| Vague processor language ("trusted partners") | GDPR transparency fail; breaks match | Policy uses catch-all phrasing instead of naming each processor |
| Collected field with no stated purpose | Data-minimization violation (Art. 5) | A collected/stored field that maps to no purpose statement in the policy; an orphan field set but never used |
| Account-creation app with no in-app deletion | Apple 5.1.1(v) rejection; erasure-right gap | Account/signup flow present, but no in-app delete-account path (or a soft-delete flag that retains PII) |
| "We never sell/share data" while an SDK transmits | Deceptive claim (FTC §5) | Absolute negative claim in policy contradicted by an SDK/processor in the dependency list |
| Policy/label drift after a feature adds a new data point | Three-way match silently breaks | A new collected field/SDK landed in the diff with no corresponding policy or label update |

> **Detectability caveat (important for an automated review):** the reviewer can mechanically detect *mismatches* (a field in code but not the policy) and *presence* (no policy, no deletion path). It generally **cannot** mechanically read the store's submitted Nutrition Label / Data Safety form (those live in App Store Connect / Play Console, off-repo) — so where the store-side declaration isn't in the repo, the reviewer FLAGS "store privacy label must be verified against this field list by a human" rather than asserting PASS. Likewise, whether a regime *applies* and whether a lawful basis is *valid* are legal judgments — always FLAGS, never hard PASS/FAIL.

---

## 6. ✅ Agent-applicable RULES

Each rule: **[ID] severity — assertion → maps_to → detection (observed vs expected).** Many privacy items require human/legal judgment; those are written as **FLAGS** ("reviewer flags for human/legal confirmation") rather than a hard automated PASS/FAIL, and say so explicitly.

**Policy presence & linkage**
- **[PRIV-01] critical — A privacy policy exists and is linked (in-app AND in store metadata) whenever any personal data is collected.** → `privacy-data`. Detect: code collects any personal data (input field, device/advertising ID, location/contacts permission, or any analytics/ads/auth SDK) but no policy document is present, or no privacy-policy URL is wired into the app's settings/footer and the store config = FAIL (observed: data collected + no linked policy; expected: live, linked policy).
- **[PRIV-07] serious — The privacy policy describes what the code actually does; no absolute claim contradicts an observed dependency.** → `privacy-data`. Detect: an absolute negative ("we never share/sell your data," "no third parties") in the policy while the dependency list contains an analytics/ads/processor SDK that transmits data = FAIL.

**The three-way match (code ⇄ policy ⇄ store label)**
- **[PRIV-02] serious — Every data field the code collects is disclosed in the policy AND in the store privacy label / data-safety form (three-way match) — FLAG mismatches.** → `privacy-data`. Detect: enumerate code-collected fields + SDK-collected data; diff against policy disclosures and the Apple Nutrition Label / Google Data Safety declarations. Any item present in one artifact but not all three = FLAG for human confirmation (FAIL if the in-repo policy itself is missing the field; FLAG where the store-side form is off-repo and cannot be read — say so). Expected: all three artifacts list the same data.
- **[PRIV-03] serious — Third-party SDKs/processors that receive data are named and disclosed as "sharing."** → `privacy-data`. Detect: an analytics/ads/crash/auth/email SDK or processor in the dependency list that is NOT named in the policy's "who we share with" section AND/OR not declared as data sharing/collection on the store form = FAIL (observed: undisclosed SDK transfer; expected: named + declared).
- **[PRIV-08] serious — Advertising / device identifiers are declared as identifiers on the store data-safety form (Google Apr-2025).** → `privacy-data`. Detect: code reads an advertising ID / IDFA / device ID but it is not declared as a *device or other identifier*; where the form is off-repo, FLAG "verify the Data Safety form declares this identifier." Expected: identifier declared.

**Minimization, purpose, processors**
- **[PRIV-04] serious — Data minimization: no collected field lacks a stated purpose.** → `privacy-data`. Detect: a field collected/stored in code that maps to no purpose statement in the policy, or an orphan field set but never consumed = FAIL (observed: purposeless collection; expected: every field has a documented purpose).
- **[PRIV-09] serious — Processors are named specifically, not described with catch-all language.** → `privacy-data`. Detect: policy "who we share with" uses vague phrasing ("trusted partners," "service providers") instead of naming each real processor (DB host, payments, email, analytics) = FAIL.

**User rights & deletion**
- **[PRIV-05] serious — Apps that support account creation offer in-app data/account deletion (Apple 5.1.1(v) + GDPR erasure).** → `privacy-data`. Detect: a signup/account-creation flow exists but there is no in-app delete-account path, or deletion is a soft `is_deleted`/flag that retains PII, or the only delete route is "email support" = FAIL (observed: no real in-app erasure; expected: in-app delete that removes/anonymizes + triggers processor deletion).
- **[PRIV-10] serious — A data-access/export (DSAR) capability exists when GDPR/CCPA plausibly applies.** → `privacy-data`. Detect: personal data is stored and the product plausibly has EU/CA users, but there is no self-serve export or documented access process. Because applicability is a legal call, **FLAG** for human confirmation rather than hard-FAIL.

**Human/legal-judgment FLAGS (never a hard automated PASS/FAIL)**
- **[PRIV-06] minor — Applicable-regime determination (GDPR / CCPA-CPRA / state laws) flagged for human/legal confirmation.** → `privacy-data`. Detect: the reviewer cannot compute revenue/consumer-count thresholds (data not in repo); always emit a FLAG stating which regimes plausibly apply (EU/UK user → GDPR; CA business over a threshold → CCPA; ~20 states incl. threshold-free Texas) and that a human must confirm scope. Never assert "no regime applies."
- **[PRIV-11] minor — Special-category / regulated data (health, finance, children, biometrics) detected → escalate to a lawyer; do not PASS.** → `privacy-data`. Detect: the product touches health/medical, financial-beyond-checkout, under-16 (EU)/under-13 (US) children, or biometric data = emit a blocking FLAG "requires legal review before launch (extra obligations beyond this reference)"; the reviewer must not issue a clean PASS on a privacy domain that includes special-category data.
- **[PRIV-12] minor — International-transfer mechanism (EU→US: DPF or SCCs) and data region flagged for human confirmation.** → `privacy-data`. Detect: EU user data plausibly stored on US infrastructure; the reviewer FLAGS that an adequacy mechanism (Data Privacy Framework certification or Standard Contractual Clauses in the processor's DPA) and an appropriate data region must be confirmed by a human — it cannot verify a signed DPA or certification from the repo.

> **Coverage note for a review:** [PRIV-01, 02 (in-repo half), 03, 04, 07, 09] are largely detectable from the repo (presence + code-vs-policy diff). [PRIV-02 (store-label half), 05 (sometimes), 08, 10, 06, 11, 12] depend on off-repo artifacts or legal judgment and are written as FLAGS — the reviewer surfaces them for human/legal confirmation rather than asserting a clean PASS. The implementation how-to for everything here is [`PRIVACY_GDPR_GUIDE.md`](../../guides/PRIVACY_GDPR_GUIDE.md). **This document is not legal advice.**

---

## 7. Sources

- GDPR — *Art. 30, Records of Processing Activities (ROPA)* — https://gdpr-info.eu/art-30-gdpr/ (the data-inventory obligation: what you process, why, shared-with-whom, retention)
- GDPR — *Art. 5, Principles (incl. data minimization & purpose limitation)* — https://gdpr-info.eu/art-5-gdpr/
- Google Play — *Provide information for Google Play's Data safety section* — https://support.google.com/googleplay/android-developer/answer/10787469 (Apr-2025 enforcement: advertising/device IDs = identifiers; "sharing" = any third-party/SDK transfer; form must match code + policy)
- Apple — *App Store Review Guidelines* (5.1.1 privacy & in-app account deletion 5.1.1(v)) — https://developer.apple.com/app-store/review/guidelines/
- Apple — *App Privacy Details (the Nutrition Label)* — https://developer.apple.com/app-store/app-privacy-details/ (the developer-declared privacy label that must match the policy + code)
- California OAG — *CCPA* — https://oag.ca.gov/privacy/ccpa (categories-of-PI disclosure; thresholds)
- MultiState — *Comprehensive privacy laws taking effect in 2026* — https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026 (~20 states; Texas no volume threshold)
- Product launch guide (deep how-to, not this reference) — [`PRIVACY_GDPR_GUIDE.md`](../../guides/PRIVACY_GDPR_GUIDE.md)

---

*This is a compliance-review reference in the lastmile [`knowledge/compliance/`](README.md) library. It states checkable rules and FLAGS the items that need human/legal judgment. **It is not legal advice.** Laws and platform policies change; the official sources above are the source of truth.*
