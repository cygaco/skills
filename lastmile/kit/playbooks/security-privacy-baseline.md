> v1 baked-in playbook — refresh it against current sources before relying on its numbers.

# Security & Privacy Baseline (U.S. Consumer, 13+)

For `/lastmile`. This is **compliance-by-default implementation guidance**, not legal advice and **not a legal guarantee**. It covers the common case: a U.S.-facing consumer app whose users are **13 or older**, handling ordinary account data (email, name, usage, payments via a third-party processor). Anything outside that case hits a **HARD STOP** (last section) and goes to a human for legal/security review before any "launch-ready" claim.

**Posture:** ship the baseline by default, escalate the edges. `/lastmile` should treat every box below as a gate, not a suggestion.

---

## Security Checklist

Each item is a launch gate. Fail any → fix before claiming launch-ready.

- [ ] **Secrets scanning.** No keys, tokens, or passwords in the repo or git history. Run a secrets scanner in CI and pre-commit (for example gitleaks or TruffleHog). Treat any committed secret as compromised — rotate it, don't just delete it.
- [ ] **Env-var hygiene.** All secrets in environment variables / a secrets manager, never hardcoded. `.env` is gitignored; an `.env.example` documents names with **no real values**. Different secrets per environment (dev/staging/prod).
- [ ] **Auth & session.** Passwords hashed with a slow algorithm (bcrypt/argon2/scrypt) — never plaintext or fast hashes. Session tokens are random, httpOnly, Secure, SameSite. Sessions expire and can be revoked (logout works server-side). Offer or plan for MFA on sensitive accounts.
- [ ] **Rate limiting.** Login, signup, password-reset, and any write/expensive endpoint are rate-limited per IP and per account. Protects against credential stuffing, brute force, and cost-blowout abuse.
- [ ] **Input validation.** Validate and sanitize all input server-side (client validation is UX, not security). Parameterized queries — never string-concatenated SQL. Escape/encode output to prevent XSS. Validate file uploads (type, size, and store outside the web root).
- [ ] **Dependency audit.** Run `npm audit` / equivalent and a CVE scan in CI. No known-critical vulns at launch. Pin or lock versions; have a patch path for the next critical.
- [ ] **Webhook signature verification.** Every inbound webhook (payments, auth provider, etc.) **must** verify the provider's signature on the raw request body before acting. Reject unsigned/invalid requests. This is the single most-skipped control by vibe coders and it is how fake "payment success" and forged events get in. Use the timing-safe compare the provider documents; never trust a webhook just because it hit your URL.
- [ ] **Access-control tests.** Automated tests proving a user cannot read/modify another user's data (no IDOR), and that privileged actions require the right role. Default-deny: a new endpoint is locked until explicitly opened. Test the negative cases, not just the happy path.
- [ ] **Transport & headers.** HTTPS everywhere (HSTS). Sensible security headers (CSP, X-Content-Type-Options, frame options). No secrets or PII in URLs or logs.

---

## Privacy Checklist

- [ ] **Data deletion path.** A user can delete their account and associated personal data, and there's a real backend process that honors it (including backups within a documented window). "Delete" must actually delete — soft-flagging while retaining everything is a liability.
- [ ] **Data export / portability.** A user can export their personal data in a portable, machine-readable format (JSON/CSV). Required or strongly expected under several state laws below.
- [ ] **Privacy Policy (required before launch).** Plain-language, covers: what you collect, why, legal basis/purpose, who you share it with (processors, analytics, ads), retention, user rights (access/delete/export/opt-out), and a contact method. Dated and versioned. Linked in the footer.
- [ ] **Terms of Service (required before launch).** Acceptable use, payment/refund terms, liability limits, termination, governing law, dispute terms. Linked in the footer.
- [ ] **Cookie / tracking disclosure.** If you use analytics, ad pixels, or third-party trackers: disclose them and provide opt-out/consent. Strictly-necessary cookies are generally fine without consent; tracking/advertising cookies need a real choice (not a pre-ticked box). Honor Global Privacy Control (GPC) signals.
- [ ] **Age gate / no-under-13.** State in the Terms that the service is for users **13+** and you do not knowingly collect data from children under 13. If signup can plausibly attract under-13s, add a neutral age check. Do **not** collect a birthdate you don't need. If you discover under-13 data, delete it. (If you actually want under-13 users → HARD STOP, COPPA applies.)
- [ ] **Data minimization.** Collect only what the product needs to function. Every extra field is privacy risk + conversion friction. Don't log PII you don't need.
- [ ] **Third-party processors.** Keep a short list of every vendor that touches user data (hosting, payments, analytics, email). Each should be reputable and named in the privacy policy.

---

## Breach & Incident Posture (minimum)

Every U.S. state has a data-breach notification law. You don't need an enterprise plan, but you do need a minimum:

- [ ] **Know what you'd notify about.** Maintain a short inventory of what personal data you hold and where. You can't assess a breach if you don't know what's exposed.
- [ ] **A response path exists.** Documented steps: contain → assess scope → rotate credentials → notify affected users and regulators within the statutory window (varies by state, often "without unreasonable delay" / 30–60 days) → record what happened.
- [ ] **Logging that helps.** Auth events, admin actions, and access to sensitive records are logged (without logging the sensitive data itself), so you can reconstruct an incident.
- [ ] **Backups exist and restore.** Tested backups, with deletion requests propagated to them within a documented window. A backup you've never restored is a hope, not a backup.
- [ ] **A reachable security contact.** A monitored email (e.g. `security@`) so researchers can report issues instead of dropping them publicly.

This is a starting posture, not a full incident-response program. If you hold sensitive data (see HARD STOP), a real IR plan and counsel are required.

---

## U.S. State Privacy-Law Applicability Checklist

By 2026 roughly twenty U.S. states have comprehensive consumer-privacy laws, with more taking effect. They rhyme more than they differ. **This is a rough screen, not legal advice** — thresholds and effective dates change; confirm current law for your footprint.

**Do any of these apply to you?**
- [ ] You have users/customers in **California (CCPA/CPRA)** — the strictest and most-cited. Thresholds roughly: ≥$25M annual revenue, OR personal data of ≥100k consumers/households, OR ≥50% of revenue from selling/sharing data. Many startups fall *under* the threshold initially but should build to it.
- [ ] Users in **Colorado (CPA), Virginia (VCDPA), Connecticut (CTDPA), Utah (UCPA)** — the early wave. Typical thresholds: ~100k consumers, or ~25k consumers + revenue from data sales.
- [ ] Users in the **2024–2026 wave**: Texas, Oregon, Montana, Florida, Delaware, Iowa, Nebraska, New Hampshire, New Jersey, Indiana, Kentucky, Maryland, Minnesota, Rhode Island, Tennessee, and others coming online. Texas notably has **no revenue threshold** (applies to most for-profit entities doing business there that aren't small businesses), and Maryland/others add stricter data-minimization duties.

**Baseline that satisfies the common denominator of these laws** (build this once, it covers most):
- Privacy notice describing collection, purposes, sharing, and rights.
- Honor consumer rights requests: **access, correct, delete, export/portability, and opt-out of sale/share and targeted advertising.** Respond within the statutory window (commonly ~45 days).
- A clear **"Do Not Sell or Share My Personal Information"** path if you sell/share data or run targeted ads, and honor **GPC** browser signals as an opt-out.
- Get **opt-in consent for sensitive data** (precise geolocation, health, biometrics, race, sexual orientation, etc.) — but note most of these are also a **HARD STOP** below.
- Don't discriminate against users who exercise their rights.

> Building to the strictest (California + opt-out + GPC + deletion/export) generally keeps you defensible across states. It does **not** make you "compliant with all privacy laws" — never claim that.

---

## COPPA Avoidance + Escalation

**COPPA** (Children's Online Privacy Protection Act) governs online collection of personal data from **children under 13** and carries heavy penalties. The v1 default is **avoidance, not compliance**:

- Target **13+** only. Say so in your Terms.
- Don't market to children; don't use child-appealing design intended to draw under-13 users.
- Don't knowingly collect personal data from anyone under 13. If you become aware you have, delete it promptly.
- Don't collect birthdates/ages unless you have a reason — and if you do age-gate, use a neutral mechanism.

If you **want** or will **foreseeably attract** under-13 users, COPPA compliance (verifiable parental consent, special data handling, FTC-grade obligations) is required → **HARD STOP, escalate to legal.** This is not a build-it-yourself baseline. (Note: several states also extend heightened protections to **teens 13–17**; if minors are a core audience, escalate.)

---

## HARD STOP LIST

If the product **collects, processes, stores, or makes decisions about** any of the following, **STOP**. Do not run security/privacy as a self-serve baseline and do **not** make any launch-readiness claim until a qualified human completes legal and security review. These domains carry their own regulatory regimes that this v1 baseline does not cover.

- [ ] **Health / medical data** — symptoms, diagnoses, treatment, mental health, fitness-as-medical (HIPAA and state health-privacy laws like Washington's My Health My Data may apply).
- [ ] **Finance / payments beyond a hosted processor** — storing card numbers/bank credentials yourself, lending, money transmission, investment/crypto (PCI-DSS, GLBA, state money-transmitter and securities law). *Using* a hosted checkout (Stripe-style) where the processor handles card data is fine; *holding* the financial data yourself is a HARD STOP.
- [ ] **Children under 13** — any knowing collection (COPPA; see above).
- [ ] **Education / student records** — primary/secondary-school or institutional learning data (FERPA, state student-privacy laws).
- [ ] **Precise location / geolocation tracking** — continuous or precise location of individuals.
- [ ] **Biometrics** — face, fingerprint, voiceprint, retina (Illinois BIPA and peers carry per-violation statutory damages).
- [ ] **Employment / background / hiring decisions** — screening, automated hiring, worker surveillance (EEOC, FCRA, emerging AI-hiring laws).
- [ ] **Regulated or high-risk content** — anything touching firearms, alcohol/cannabis, gambling, adult content, immigration, legal advice, insurance, or other licensed activity.
- [ ] **Other sensitive categories** — race, religion, sexual orientation, union membership, immigration status, genetic data, or any data whose breach could seriously harm a person.

**The rule:** when in doubt, it's a HARD STOP. A launch-readiness claim made over a HARD STOP domain is worse than no claim — it implies a safety that wasn't verified. Stop and escalate to a qualified human, get their review, then proceed.

---

## Escalation Gates (for the logic of `/lastmile`)

`/lastmile` should route, not guess. Map findings to one of three gates:

- **GREEN — proceed.** All security + privacy boxes pass, no HARD STOP domain detected, state-law baseline (California-strict + opt-out + deletion/export) implemented. `/lastmile` may proceed with the launch plan.
- **YELLOW — fix then re-check.** A security/privacy checklist item fails but the domain is the ordinary 13+ consumer case. Fix the specific gap (e.g. add webhook verification, ship the deletion path) and re-run the gate. Do not claim launch-ready while any box is open.
- **RED — HARD STOP, escalate to human.** Any HARD STOP domain is present, OR the audience is or will foreseeably include under-13 users, OR you're storing financial/health/biometric/location/student data yourself. Stop and surface it to the founder with a single recommendation, and **block the launch-readiness claim** until a qualified human signs off. Record the escalation in the plan so it's auditable.

**Never let GREEN be the default when the inputs are unknown.** Absence of evidence that a HARD STOP applies is not evidence that it doesn't — if the product's data handling is unclear, ask the founder the few questions that resolve the gate, or treat it as RED.

---

## Launch-Readiness Gate Summary

The product is **not** launch-ready (from a security/privacy standpoint) unless ALL of the following hold:

- [ ] Every Security Checklist box passes — including **webhook signature verification** and **access-control tests**, the two most-skipped.
- [ ] Privacy Policy and Terms of Service exist, are accurate, and are linked in the footer.
- [ ] Data **deletion** and **export** paths work end to end (not just UI buttons — real backend honoring).
- [ ] Cookie/tracking disclosure present if any analytics or trackers run; GPC honored.
- [ ] Age posture is 13+, stated in Terms, with no knowing under-13 collection.
- [ ] State-law baseline implemented (rights requests, opt-out of sale/share, GPC) sized to your footprint.
- [ ] **No HARD STOP domain present** — or, if one is, a qualified human has reviewed and signed off in writing.

> If any box is open, the honest output is "not launch-ready, here's the gap" — never a green claim with caveats buried below the fold.

## Refresh & Disclaimer

This is a **v1 baked-in baseline**, current to knowledge through 2026. Privacy statutes, effective dates, thresholds, and security norms change continuously — re-derive against current law and tooling and update this file. Reference companion guidance in [`conversion-funnel-playbook.md`](conversion-funnel-playbook.md) (same directory). **Nothing here is legal advice or a guarantee of compliance.** It is a default implementation posture plus explicit escalation gates; matters of legal exposure go to a qualified professional before launch.
