---
guide: COMPLIANCE_TRIGGERS
anchor: lastmile:day-zero
shape: notice
timing: project-start
lead_time: "none (answer the trigger questions on DAY ZERO — each yes adds duties that are cheap at design time and expensive after launch)"
---

# COMPLIANCE_TRIGGERS_GUIDE.md - "Does My App Need Extra Compliance?" in 10 Questions (for Total Newbies)

> The core guides (PRIVACY_GDPR, LEGAL, DATA_REQUESTS, INCIDENT_RESPONSE, AI_COMPLIANCE, MINORS, SUBSCRIPTION_CANCELLATION) cover what EVERY app needs. This notice covers the **triggered** duties — obligations that switch on only when your product does a specific thing. Skim the bold questions; every "yes" gives you one extra workstream. Most apps trigger one or two; none of them is optional once triggered.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split. Items marked 🔴 need you (accounts, registrations, legal sign-off); 🤖 builds the rest.

---

**1. Do you sell to consumers outside your home state/country (web payments, not app-store)?** → **Sales tax / VAT.** Tax duties can start from the first sale (EU VAT on digital services has no threshold for non-EU sellers). The newbie-proof answer: use a **merchant of record** (Paddle, Lemon Squeezy) that owes the tax instead of you, or Stripe Tax + registrations where you have exposure. 🔴 Decide the MoR-vs-self question BEFORE pricing — switching later is painful. *(App-store IAP: Apple/Google already handle most consumer tax.)*

**2. Do you send SMS / text messages?** → **TCPA (US).** Texting without the right consent is one of the most-litigated consumer laws in America (statutory damages per text). Need: prior express written consent for marketing texts, instant **STOP** handling, quiet hours. The consent-rule details shifted in 2025 (an Eleventh Circuit ruling vacated the FTC's one-to-one consent tightening) — the safe posture is unchanged: explicit per-program consent + STOP. 🔴 Default for newbies: **don't add SMS marketing at all** until the product earns it.

**3. Can users post content other users can see (UGC, comments, profiles, chat)?** → **Platform duties.** Register a **DMCA agent** with the US Copyright Office (~$6, online, 🔴) so one copyright complaint can't strip your safe harbor; build report + block + takedown flows (🤖); know that **CSAM has a federal REPORTING DUTY** (NCMEC) — a report-handling plan is not optional; EU users → DSA basics (a contact point + notice-and-action). If UGC is core to your product, treat this as a full module, not a checkbox.

**4. Do you run ad pixels / targeted advertising / sell-or-share data?** → **Adtech consent + GPC.** Several state laws (CA first among them) require honoring the **Global Privacy Control** browser signal as an opt-out of sale/sharing; pixels fire BEFORE consent banners on misconfigured sites (a top enforcement pattern — see the CA Healthline action). 🤖 Gate every pixel behind consent, honor GPC, and declare the sharing in your privacy policy + store labels. No pixels = skip this lane entirely (the newbie default).

**5. Do you touch health, biometric, financial, location-history, or other sensitive data?** → 🔴 **STOP — regulated-data lane.** Health-ish data outside HIPAA still triggers FTC Health Breach Notification + state health-privacy laws (WA My Health My Data is private-right-of-action territory); **biometrics** (face/voice templates) trigger BIPA-class statutes with per-scan damages. This is the same hard escalation the SECURITY/PRIVACY guides name: lawyer before launch, not after.

**6. Do you text/email/notify users for MARKETING?** → already covered: email consent + unsubscribe in `EMAIL_GUIDE`/`PRIVACY_GDPR_GUIDE` (CAN-SPAM/GDPR), push-notification consent in `PUSH_NOTIFICATIONS_GUIDE`, SMS above. The pattern is identical everywhere: **separate opt-in, working opt-out, honor it immediately.**

**7. Do you publish reviews, testimonials, or "results" claims?** → **FTC endorsement + reviews rules.** No fake/incentivized-undisclosed reviews (the FTC reviews rule carries ~$51k-per-violation exposure — see `GROWTH_LOOPS_GUIDE`), testimonials need typicality honesty, influencer posts need disclosure. 🤖 Audit the landing page claims against evidence (`AI_COMPLIANCE_GUIDE` for AI claims specifically).

**8. Do you serve the EU/UK at any scale?** → the baseline guides already assume yes (GDPR posture). What changes at scale: a **DSA contact point** for platforms, an EU **representative** when GDPR Art. 27 bites (no EU establishment + regular processing) — 🔴 flag for legal review once EU traction is real rather than incidental.

**9. Could sanctioned-country users buy your product?** → **Sanctions/export (light).** For ordinary SaaS: block checkout from embargoed jurisdictions (your payment processor does most of this — verify the setting) and don't ship encryption-exotic features without a check. 🔴 One-time confirm in your Stripe/MoR dashboard.

**10. Is your audience (or could it include) under-18s?** → `MINORS_GUIDE` — that fork is its own day-zero notice.

---

## The one action

Answer the 10 questions in writing on day zero (your AI assistant can generate the checklist and wire the triggered builds). Re-answer them whenever you add a feature class — SMS, UGC, pixels, AI, payments are the usual late-arriving triggers. Anything that flips to "yes" after launch gets its duties retrofitted BEFORE the feature ships, not after.

*Triggered lanes summarized here get full guides as the library grows; until then each bold item names its verify-source: FTC.gov (TCPA/endorsements/health-breach), copyright.gov (DMCA agent), oag.ca.gov (GPC/CCPA), your MoR's tax docs. Last reviewed: 2026-06. NOT legal advice.*
