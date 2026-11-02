---
guide: APP_STORE_AND_PLATFORM_POLICY
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [app-store-policy, privacy-data]
sources:
  - "https://developer.apple.com/app-store/review/guidelines/"
  - "https://developer.apple.com/documentation/bundleresources/privacy-manifest-files"
  - "https://support.google.com/googleplay/android-developer/answer/14151465"
  - "https://support.google.com/googleplay/android-developer/answer/10281818"
---

# App Store & Platform Policy

**Before a build is submitted to the Apple App Store or Google Play, it must clear the platform's gating policy surface — completeness, minimum functionality, privacy disclosure, login requirements, in-app-purchase rules, and metadata accuracy — because the platforms reject or remove apps that violate these, and a rejection costs a full review cycle (days) per round-trip. This guide helps a compliance reviewer (you or your AI) flag the policy violations a reviewer can detect from the spec + code + metadata BEFORE submission, and to FLAG the items that need human/legal confirmation rather than asserting them.**

This is a *reference for a compliance reviewer*, not a step-by-step submission how-to. The newbie "how do I actually submit" walkthrough lives in the launch guide [`APP_STORE_GUIDE.md`](../../guides/APP_STORE_GUIDE.md) — use it for the step-by-step playbook (signup lead times, screenshots, build upload). Here we cover only the **rules a reviewer asserts a build against**, with the exact guideline numbers so a finding is checkable and not hand-wavy.

---

## 1. What this is

This is conformance to the two platforms' published review policy:

- **Apple — App Review Guidelines** (`developer.apple.com/app-store/review/guidelines/`), the normative document Apple's reviewers apply. Organized in five sections: **1 Safety**, **2 Performance**, **3 Business**, **4 Design**, **5 Legal**. Each rule has a number (`2.1`, `4.2`, `5.1.1`) you cite in a finding.
- **Google — Play Console policy + the closed-testing access requirement** for new personal developer accounts, plus the **Data Safety** form and **Play Billing**.

A reviewer does not certify "Apple will approve this" — approval is Apple's call and partly subjective. The reviewer's job is narrower and checkable: **does the build trip a known, documented rejection trigger that we can see from here?** Most triggers are visible in the spec, the code, the entitlements/manifest, and the store metadata. A subset (e.g., whether a marketing claim is "accurate") needs human judgment — those are written as FLAGs.

A critical property of this surface: **one rule (3.1.1 / external payments) is actively in flux** and varies by region and date. A reviewer must never state the IAP rule flatly — it must always be qualified by region + as-of date. See §3.5 and rule STORE-03.

---

## 2. Why it matters

**For the product:** a policy rejection is not a bug — it's a blocked launch. Each Apple rejection round-trip is a fresh review queue (commonly 1–3 days), and repeated rejections for the same class of issue (placeholder content, web-wrapper, undisclosed IAP) can extend scrutiny. A removal *after* launch (for a privacy-label mismatch or a missing account-deletion path) is worse — it pulls a live, possibly revenue-generating app. The cheapest place to catch all of this is pre-submission, statically, against the spec and code.

**For the user and the platform:** these rules encode user-protection guarantees — that the app actually works (2.1), does something a website can't (4.2), discloses and consents before sharing personal data (5.1.1 / 5.1.2), and lets a user delete the account they created (5.1.1(v)). Violations are user-harm surfaces, not just bureaucratic gates.

**For a compliance review specifically:**
- This guide owns the **`app-store-policy`** vocabulary and contributes to **`privacy-data`** for the disclosure rules (5.1.1, 5.1.2, App Privacy label, Privacy Manifest, Data Safety form).
- Read it with an adversarial "assume the builder cut corners" stance. A submission-blocking policy violation is a finding with a citation (an undisclosed-feature/copy gap included).
- Many of these are **human/legal-judgment** calls (is this metadata "accurate"? does an exception to 4.8 genuinely apply? which IAP region rule is in force at submission?). Those are written as **FLAGs** — the reviewer surfaces the item with evidence for a human to confirm; it does not silently pass or silently fail them.

---

## 3. Core principles / requirements

### 3.1 Apple — completeness & minimum functionality (the two most common rejections)

**Guideline 2.1 App Completeness.** The build must be **complete and final** — no placeholder text, dummy/lorem content, empty states that look broken, broken links, or temporary "coming soon" screens; it must not crash; and if any part is **login-gated**, a **working demo account** (or a demo mode) must be supplied in App Review notes so the reviewer can actually exercise the feature. A login wall with no provided credentials is a near-automatic rejection.

**Guideline 4.2 Minimum Functionality.** The app must do **more than a repackaged website** or a thin marketing brochure. Pure web-wrapper apps (a `WKWebView` pointed at the marketing site with no native capability), and **raw template/generator output** that hasn't been turned into a distinct, useful app, are rejected. The reviewer's tell: a single webview as the whole app, or boilerplate that is byte-identical to a known template with only the name swapped.

### 3.2 Apple — privacy disclosure & account deletion (the `privacy-data` cluster)

**Guideline 5.1.1 Data Collection and Storage.** A **privacy policy URL** must be present **both** in App Store Connect metadata **and** linked/accessible **in-app**. The app must request only the data it needs and obtain consent.

**Guideline 5.1.1(v) Account deletion.** If the app supports **account creation**, it must also offer **in-app account deletion** (not just "email us to delete"). A signup flow with no corresponding delete-account path is a violation.

**Guideline 5.1.2(i) Data sharing & consent (tightened Nov 2025).** The app must obtain **explicit user consent before transmitting personal data to third parties** — and Apple's tightening calls out **third-party AI** explicitly: sending a user's personal data to a third-party AI/LLM service requires explicit, informed consent. A build that pipes user content to an external model without a consent gate trips this.

**Privacy Manifest — `PrivacyInfo.xcprivacy`** (enforcement began **May 1, 2024**). The app (and SDKs that require one) must ship a privacy manifest declaring collected data types and, for **Required Reason APIs** (certain file-timestamp, disk-space, system-boot-time, `UserDefaults` APIs), the approved reason code for each use. Missing manifest / unjustified Required-Reason API = rejection at upload.

**App Privacy "nutrition label."** The data-collection answers in App Store Connect must **match what the app actually collects**. A label claiming "no data collected" while the code ships an analytics/ads SDK is a disclosure mismatch — and a `privacy-data` finding the reviewer can raise by comparing declared label vs. observed SDKs/network calls.

### 3.3 Apple — Sign in with Apple (4.8)

**Guideline 4.8.** If the app uses a **third-party or social login service** (Google, Facebook, etc.) as its **primary** login, it must **also offer Sign in with Apple** as an equivalent option (or another comparable privacy-preserving login meeting Apple's criteria). **Exceptions** where 4.8 does **not** apply: the app uses **only its own account system** (no third-party social login), it's an **enterprise/education/business** app using the company's existing login, it's a **government/industry-backed citizen identity (eID)** login, or it's a **specific-service client** (e.g., an email client for a specific provider). Whether an exception genuinely applies is a judgment call → FLAG.

### 3.4 Apple — metadata, spam, duplicates

**Guideline 2.3 Accurate Metadata.** Name, subtitle, description, screenshots, keywords, and the "what you see is what you get" promise must be **accurate**: no **hidden/undocumented features**, no **undisclosed in-app purchases** (every IAP and subscription must be represented and described), no **keyword stuffing** or irrelevant keywords, no screenshots of functionality the app doesn't have. "Accurate" is partly a human judgment → the reviewer flags suspected inaccuracy with evidence.

**Guideline 4.3 Spam.** No duplicate apps, no spammy clones of an existing app with trivial differences, no flood of near-identical submissions.

### 3.5 Apple — In-App Purchase & the external-payment rule (IN FLUX — qualify region + date)

**Guideline 3.1.1 In-App Purchase.** Digital goods, content, and **subscriptions consumed inside the app** must use **Apple's In-App Purchase** — you may **not** substitute Stripe/PayPal/your own card form to sell in-app digital content. (Physical goods and services consumed outside the app — ride-hail, e-commerce, food delivery — correctly use external payment and are out of scope of 3.1.1.)

**The external-link / external-payment carve-out is region- and date-dependent and unsettled:**

- **United States** — since **May 1, 2025**, following the *Epic v. Apple* injunction, apps **may include external purchase links** to a developer's own site and Apple is **barred from taking a commission** on those US purchases. **Apple has appealed**, so this is **subject to change** — a reviewer must treat it as the current US state, not a permanent rule.
- **European Union** — under the **DMA**, apps may use **external payment / link out**, but Apple charges **its own fees (in the ~10–20% range depending on the tier/terms)** on those transactions — so "external = free of Apple economics" is **false in the EU**.
- **Rest of world** — the default **IAP-only** rule for in-app digital goods still applies; no general external-payment carve-out.

**Reviewer rule:** never assert "you can link out / no commission" as a flat fact. Any IAP/external-payment finding **must name the region and the as-of date**, and where the build's target region or submission date is unknown, it is a **FLAG for human confirmation** — because the rule that applies depends on *where* and *when* the app ships. (See STORE-03.)

### 3.6 Google Play — access, data safety, billing

**Closed-testing access requirement.** For **new personal developer accounts** created after **Nov 13, 2023**, Google requires a **closed test with at least 12 testers opted-in continuously for 14 days** before the account can apply for production access. A build heading to Play from a fresh personal account without this testing track satisfied **cannot reach production** — a launch-blocking gate the reviewer should confirm is planned/met.

**Data Safety form.** Play's **Data Safety** section (the Play analog of Apple's privacy label) must **accurately** declare what data the app collects/shares and why. A mismatch between the form and the app's actual SDKs/network behavior is a violation — same shape as the Apple-label check, in the `privacy-data` cluster.

**Play Billing.** Like Apple's IAP, in-app digital goods/subscriptions on Play must use **Google Play Billing** (with its own evolving regional/external-offer nuances — qualify the same way as 3.1.1).

---

## 4. Concrete examples (compliant vs non-compliant)

**Completeness + demo creds (2.1) — DON'T / DO**
- DON'T: ship a build whose home screen reads "Dashboard coming soon," or whose only path is a login wall with no credentials in review notes.
- DO: every screen renders real, final content; if login-gated, App Review notes carry a **working demo account** (or a demo toggle) and no flow dead-ends or crashes.

**Minimum functionality (4.2) — DON'T / DO**
- DON'T: a single full-screen webview pointed at `https://marketing-site.example` as the entire app; or template output identical to a known scaffold with only the app name changed.
- DO: native, app-specific capability (offline state, device features, real interactivity) beyond what the website alone does.

**Account deletion (5.1.1(v)) — DON'T / DO**
- DON'T: a Sign-Up flow exists, but the only way to delete an account is "contact support."
- DO: an in-app **Delete account** action that actually deletes (or queues deletion of) the account and its data.

**Third-party AI consent (5.1.2(i)) — DON'T / DO**
- DON'T: user text is POSTed to a third-party LLM API with no disclosure or consent step.
- DO: an explicit consent gate (and privacy-policy disclosure) before any personal data leaves for a third-party AI service.

**Sign in with Apple (4.8) — DON'T / DO**
- DON'T: login screen offers **only** "Continue with Google" / "Continue with Facebook."
- DO: offer **Sign in with Apple** alongside the social options — OR document that a 4.8 exception (own-accounts-only / enterprise / eID / service-specific) genuinely applies → FLAG for human confirmation.

**IAP & external payment (3.1.1) — DON'T / DO**
- DON'T: sell an in-app subscription via an embedded **Stripe** checkout for a worldwide release; or write a review finding that says flatly "external links are allowed, no commission."
- DO: use platform IAP for in-app digital goods by default; **if** relying on an external-link carve-out, the finding **names region + as-of date** (e.g., "US, external link permitted as of 2025-05-01 post-Epic, Apple appealing") and FLAGs region/date confirmation.

**Privacy label / manifest match (5.1.1) — DON'T / DO**
- DON'T: App Privacy label says "Data Not Collected" while the build links an analytics + ads SDK; ship without `PrivacyInfo.xcprivacy`.
- DO: label and `PrivacyInfo.xcprivacy` enumerate exactly the data the code collects; Required-Reason APIs each carry a justified reason code.

**Metadata accuracy (2.3) — DON'T / DO**
- DON'T: screenshots show a feature the app lacks; an IAP exists but isn't disclosed in the description; keyword field stuffed with competitor names.
- DO: metadata reflects shipped functionality; every IAP/subscription is disclosed; keywords are relevant.

---

## 5. Common failure modes

| Failure | How it surfaces / why it's rejected | How the reviewer detects it |
|---|---|---|
| Placeholder/incomplete content, or crashes (2.1) | Reviewer hits a "coming soon"/lorem screen, broken link, or crash | Spec/UI shows non-final content, dead links, empty states styled as broken; crash logs |
| Login-gated, no demo account (2.1) | Reviewer can't get past login → rejected unreviewed | Login wall present AND no demo credentials/demo mode in submission notes |
| Web-wrapper / template output (4.2) | "More than a website?" fails | Whole app is one webview, or code is byte-identical to a known template with name swapped |
| No in-app account deletion (5.1.1(v)) | Account-creation app with delete-by-email only | Signup/account-create flow exists with no in-app delete-account path |
| Personal data → 3rd-party (incl. AI) without consent (5.1.2(i)) | Data shared before consent | Network call/SDK sends user PII/content to a third party (esp. an LLM) with no consent gate |
| Privacy label / Data Safety mismatch (5.1.1) | Declared collection ≠ actual | Declared "nutrition"/Data-Safety answers vs. observed SDKs & network calls disagree |
| Missing/invalid Privacy Manifest (May 1 2024) | Upload-time rejection | No `PrivacyInfo.xcprivacy`, or a Required-Reason API used with no justified reason code |
| Social login primary, no Sign in with Apple (4.8) | Missing required SiwA option | Only third-party/social login offered as primary AND no qualifying exception → FLAG |
| In-app digital goods via Stripe etc. (3.1.1) | Non-IAP payment for digital content | Embedded external card/Stripe checkout selling in-app digital goods/subscriptions |
| IAP rule asserted without region/date (3.1.1 FLUX) | Reviewer states a flat, possibly-wrong rule | Any external-payment/commission claim lacking a region + as-of-date qualifier → FLAG |
| Inaccurate metadata / undisclosed IAP / keyword stuffing (2.3) | Misleading store listing | Screenshots/description claim features not in code; undisclosed IAP; irrelevant keyword stuffing |
| Spam / duplicate (4.3) | Clone of existing app | Near-identical to a known app/scaffold with trivial differences |
| Play closed-testing gate unmet (post Nov-13-2023) | New personal account can't reach production | No 12-tester / 14-day closed test track planned or satisfied |

**The judgment caveat (important):** several of these — is the metadata "accurate"? does a 4.8 exception truly apply? which IAP region rule is in force at submission? is the content genuinely "more than a website"? — are **not** purely mechanical. The reviewer surfaces them as **FLAGs with evidence** for a human to confirm rather than a hard pass/fail, and never resolves the in-flux IAP rule on its own.

---

## 6. ✅ Agent-applicable RULES

Each rule is a PASS/FAIL (or FLAG) assertion a compliance review can apply. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).** severity ∈ {critical, serious, minor}. Items needing human/legal judgment are written as FLAGs (the reviewer surfaces them with evidence for a human to confirm).

**Completeness & functionality (Apple §2, §4)**
- **[STORE-01] critical — Build is complete: no placeholder/lorem/"coming soon" content, no broken links, no crashes; and if any flow is login-gated, working demo credentials (or a demo mode) are provided in review notes (2.1).** → `app-store-policy`. Detect: UI/spec shows non-final content or dead links, or a login wall with no demo account supplied = FAIL (observed: gated login, no creds; expected: final content + working demo account).
- **[STORE-02] serious — App exceeds web-wrapper minimum functionality: it is more than a single webview or unmodified template output (4.2).** → `app-store-policy`. Detect: entire app is one `WKWebView`/webview to a site, OR code is byte-identical to a known scaffold with only the name changed = FAIL.
- **[STORE-08] serious — No duplicate/spam submission; the app is not a trivial clone of an existing app (4.3).** → `app-store-policy`. Detect: build near-identical to a known app/scaffold with only cosmetic differences = FAIL/FLAG.

**In-app purchase (Apple §3 / Play billing) — region & date sensitive**
- **[STORE-03] critical — In-app digital goods/subscriptions use platform IAP (Apple IAP / Play Billing) UNLESS a region-specific external-payment carve-out applies — and any external-payment/commission claim names region + as-of date — FLAG region/date for human confirmation.** → `app-store-policy`. Detect: embedded Stripe/PayPal/own checkout selling in-app digital goods = FAIL; an external-link/commission claim with no region+date qualifier = FLAG (the US-post-Epic 2025-05-01 / EU-DMA-~10–20%-fee / RoW-IAP-only split is in flux — never assert flatly).

**Login (Apple §4)**
- **[STORE-04] serious — Sign in with Apple (or a qualifying privacy-preserving login) is offered whenever a third-party/social login is the primary login (4.8), UNLESS an exception applies (own-accounts-only, enterprise/edu, government eID, service-specific client) — FLAG the exception for human confirmation.** → `app-store-policy`. Detect: only social/third-party login offered as primary AND no SiwA AND no documented qualifying exception = FAIL/FLAG.

**Privacy disclosure & data (Apple §5 / Play Data Safety — `privacy-data`)**
- **[STORE-05] serious — App Privacy label / Play Data Safety form AND the Privacy Manifest are present and match the app's actual data collection (5.1.1; manifest enforced May 1 2024).** → `privacy-data` / `app-store-policy`. Detect: declared label/Data-Safety answers disagree with observed SDKs/network calls, OR `PrivacyInfo.xcprivacy` missing, OR a Required-Reason API used with no justified reason = FAIL.
- **[STORE-06] serious — Store metadata is accurate: no hidden/undocumented features, every IAP/subscription disclosed, no keyword stuffing (2.3).** → `app-store-policy`. Detect: screenshots/description assert features absent from code, OR an IAP exists undisclosed in metadata, OR irrelevant/competitor keyword stuffing = FAIL (subjective "accuracy" → FLAG with evidence).
- **[STORE-07] critical — A privacy policy URL is present in store metadata AND reachable in-app (5.1.1).** → `privacy-data` / `app-store-policy`. Detect: no privacy-policy URL in store config, or no in-app link to it = FAIL.
- **[STORE-09] serious — Account-creation apps provide in-app account deletion, not delete-by-email-only (5.1.1(v)).** → `privacy-data` / `app-store-policy`. Detect: a signup/account-create flow exists with no in-app delete-account path = FAIL.
- **[STORE-10] serious — Explicit user consent is obtained before sharing personal data with third parties, including third-party AI/LLM services (5.1.2(i), tightened Nov 2025).** → `privacy-data`. Detect: a network call/SDK transmits user PII/content to a third party (esp. an external model) with no preceding consent gate = FAIL.

**Google Play access**
- **[STORE-11] serious — For a new personal Play developer account (post Nov-13-2023), the 12-tester / 14-day closed-testing access requirement is planned or satisfied before production. — FLAG if account age/type is unknown.** → `app-store-policy`. Detect: production track targeted from a fresh personal account with no satisfied 12×14 closed test = FAIL/FLAG.
- **[STORE-12] minor — Play Data Safety form is filled and consistent with the app's actual collection/sharing (Play analog of the App Privacy label).** → `privacy-data` / `app-store-policy`. Detect: Data Safety answers absent or inconsistent with observed SDKs/network behavior = FAIL/WARN.

> **Coverage note for a compliance review:** STORE-01, -02, -05, -07, -09, -10 are largely observable from spec/code/metadata/entitlements. STORE-03 (IAP region/date), -04 (4.8 exception), -06 ("accurate" metadata), -08 (spam), -11 (account age) carry irreducible human/legal judgment and are written as FLAGs — the reviewer surfaces evidence for a human to confirm; it does not unilaterally resolve them.

---

## 7. Sources

- Apple — *App Store Review Guidelines* — https://developer.apple.com/app-store/review/guidelines/ (normative; §2.1 completeness, §4.2 minimum functionality, §4.3 spam, §4.8 Sign in with Apple, §5.1.1 + 5.1.1(v) privacy policy / account deletion, §5.1.2(i) data sharing & consent incl. third-party AI, §3.1.1 In-App Purchase, §2.3 accurate metadata)
- Apple — *Privacy Manifest Files (`PrivacyInfo.xcprivacy`) & Required Reason APIs* — https://developer.apple.com/documentation/bundleresources/privacy-manifest-files (enforcement began May 1, 2024)
- Google — *Prepare your app for review / closed testing access requirement* (new personal accounts post Nov-13-2023: 12 testers, 14 days) — https://support.google.com/googleplay/android-developer/answer/14151465
- Google — *Understanding Google Play's Payments policy* — https://support.google.com/googleplay/android-developer/answer/10281818
- *IAP external-payment status (IN FLUX):* US external purchase links permitted since **May 1, 2025** following the *Epic v. Apple* injunction, Apple barred from commission on those US purchases — **Apple is appealing** (treat as current, not permanent); EU **DMA** permits external payment but Apple charges its own **~10–20%** fees; rest-of-world remains **IAP-only**. A reviewer must qualify any IAP finding by **region + as-of date** — see Apple Review Guidelines §3.1.1 and the current US/EU/RoW posture above.
