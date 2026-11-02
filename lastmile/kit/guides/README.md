---
guide: README
anchor: none
shape: notice
timing: reference
lead_time: "none"
---

# lastmile launch guides — for total newbies

> You built (or are building) an app and you're ready to launch it **for real** — accounts, sign-in, data, email, payments, privacy. These guides walk you through each piece in plain language, from zero, assuming little or no technical background.
>
> **How to use:** skim this page, then open the guide you need. Each guide is self-contained — **but read Section 0 and the day-zero rule below once**; they apply to *every* guide.
>
> **Where they fit:** `/lastmile` links every finding in `last-mile/REVIEW.md` and every task in `last-mile/LAUNCH_PLAN.md` to the guide that explains it. These guides live in `.claude/lastmile/guides/`. Next to them, `../playbooks/` holds the default stacks, monetization patterns, the conversion-funnel playbook and the security/privacy baseline, and `../knowledge/` holds deeper reference material; both are indexed under [Deeper reference material](#deeper-reference-material) below.

---

## The guides

| Guide | What it covers | When to do it |
|---|---|---|
| **[DEV_SETUP_GUIDE](DEV_SETUP_GUIDE.md)** | Developer accounts & app-store registration — Apple Developer, Google Play Console, D-U-N-S | **Day zero** (long approval waits) |
| **[AUTH_GUIDE](AUTH_GUIDE.md)** | Letting users sign in — Google/Apple social SSO, email + password, magic links | When you add login (decide the *approach* early) |
| **[DATABASE_GUIDE](DATABASE_GUIDE.md)** | Data storage — Supabase/Postgres/Firebase/SQLite, schema, migrations, backups | Early (it's architectural) |
| **[EMAIL_GUIDE](EMAIL_GUIDE.md)** | Sending email — transactional (verify/reset/magic-link) + marketing, deliverability (SPF/DKIM/DMARC) | When you need to send mail (domain DNS has lead time) |
| **[PAYMENTS_GUIDE](PAYMENTS_GUIDE.md)** | Taking money — Stripe checkout for web/physical/outside-app payments; StoreKit / Play Billing for mobile in-app digital goods; webhooks/server notifications; entitlements | When you monetize (Stripe and store setup have lead time) |
| **[PRIVACY_GDPR_GUIDE](PRIVACY_GDPR_GUIDE.md)** | Privacy & the law — GDPR/CCPA, consent, cookie banner, data export/delete, privacy policy | Before you collect real user data / before launch |
| **[SECURITY_GUIDE](SECURITY_GUIDE.md)** | Not getting hacked — database/RLS lockdown, secrets, rate limits + AI usage caps, prompt injection, input validation | As you build → a hardening pass before launch |
| **[APP_STORE_GUIDE](APP_STORE_GUIDE.md)** | Getting an iOS app approved — privacy labels, TestFlight, Sign in with Apple, In-App Purchase rules | Before you submit to the App Store |
| **[LEGAL_GUIDE](LEGAL_GUIDE.md)** | Legal protection — Terms of Service, subscription-cancel law, data declarations, trademark/IP, your LLC | Before launch (a legal gate) |
| **[API_LIMITS_GUIDE](API_LIMITS_GUIDE.md)** | Third-party API limits & capacity prep — provider rate/usage tiers ramp over time, so you can't just launch on their API for unlimited users | Day zero (tiers ramp over weeks/months) |
| **[ANALYTICS_TELEMETRY_GUIDE](ANALYTICS_TELEMETRY_GUIDE.md)** | Product analytics and telemetry - activation, funnels, core events, privacy-safe event payloads | When you instrument the product |
| **[DEPLOYMENT_INFRA_GUIDE](DEPLOYMENT_INFRA_GUIDE.md)** | Deployment and infrastructure - host choice, env vars, domains, smoke tests, rollback | Before launch week |
| **[ADMIN_TOOLING_GUIDE](ADMIN_TOOLING_GUIDE.md)** | Founder/admin tooling - allowlist, user lookup, entitlement view, event feed, audit trail | When you need support/admin access |
| **[PUSH_NOTIFICATIONS_GUIDE](PUSH_NOTIFICATIONS_GUIDE.md)** | Push notifications - earn the opt-in (soft-ask, iOS provisional), token hygiene, frequency caps, deep links | When you add re-engagement (after analytics) |
| **[ONBOARDING_GUIDE](ONBOARDING_GUIDE.md)** | When to ask for signup and what to collect - signup-wall placement, progressive profiling, guest mode + account linking, minors (COPPA) | When you design signup/first-run (with AUTH) |
| **[GROWTH_LOOPS_GUIDE](GROWTH_LOOPS_GUIDE.md)** | Reviews + referrals - the compliant review prompt (NO "enjoying the app?" gating), native prompt quotas, referral rewards + fraud basics | Review prompt at launch; referrals after retention proves itself |
| **[TESTING_ON_PC_GUIDE](TESTING_ON_PC_GUIDE.md)** | Testing a mobile app from a Windows PC - Android emulator (WHPX), Expo Go/dev-client, the no-iOS-simulator truth, real-device checklist | Project start (device kit + accounts have lead time) |
| **[DATA_REQUESTS_GUIDE](DATA_REQUESTS_GUIDE.md)** | Operating data-rights requests - right-sized verification, statutory clocks + request queue, honest deletion + processor cascade + backups, retention schedule | When you build accounts (the clock starts at the first request) |
| **[SUBSCRIPTION_CANCELLATION_GUIDE](SUBSCRIPTION_CANCELLATION_GUIDE.md)** | The cancel path - as easy as subscribing, same medium; Stripe portal / platform IAP cancel; period-end entitlement honesty | With the subscribe path (the law binds from the first charge) |
| **[INCIDENT_RESPONSE_GUIDE](INCIDENT_RESPONSE_GUIDE.md)** | Breach/incident runbook - prepare-now checklist, evidence preservation, GDPR 72h + state notices, processor breaches | Before launch (the 72h clock starts at awareness) |
| **[AI_COMPLIANCE_GUIDE](AI_COMPLIANCE_GUIDE.md)** | AI features - deployer triage, chatbot disclosure + synthetic-media labeling (AI Act Art. 50), FTC claims substantiation, training-consent posture | When you ship an AI feature (disclosure ships WITH it) |
| **[MINORS_GUIDE](MINORS_GUIDE.md)** | The audience fork - under-13 = lawyer BEFORE building; teen lane duties; honest age gates for 13+ apps | **Day zero** (it's an audience decision) |
| **[COMPLIANCE_TRIGGERS_GUIDE](COMPLIANCE_TRIGGERS_GUIDE.md)** | 10 questions that switch on extra duties - sales tax/MoR, SMS/TCPA, UGC/DMCA/CSAM, ad pixels/GPC, sensitive data, sanctions | **Day zero** + whenever you add a feature class |
| **[AUTH_RUNBOOK](AUTH_RUNBOOK.md)** | The execution runbook for one auth path - passwordless Supabase (6-digit email code + Google), the password hard-block and the check that proves it | When you've chosen that path (after AUTH) |
| **[LAUNCH_FILM_GUIDE](LAUNCH_FILM_GUIDE.md)** | Making a launch film with code - renderer licence, render settings, assembly, size-capped delivery copies, music licences | Optional, before you announce |

---

## 0. What only YOU (the human) can do vs your AI assistant

Your AI coding assistant is great at **writing and wiring the code**. But across every guide, a set of steps can **only be done by you**, because they need *your* identity, *your* money, and *your* legal agreement:

| The kind of step | Who | Why |
|---|---|---|
| Create accounts (Google Cloud, Apple, Stripe, email provider, DB host…) | **YOU** | Logged in as *you*; tied to your identity |
| Pay fees / verify a bank or card | **YOU** | Your money, your legal contract |
| Pass identity / business verification (photo ID, D-U-N-S) | **YOU** | It's a check that *you* are real |
| Add DNS records, paste secrets/API keys, flip a service to "live" | **YOU** | Done in *your* dashboards, with *your* credentials |
| Publish a privacy policy / terms as real legal documents | **YOU** | You're the legal entity making the promise |
| Write the app code, config, schema, queries, login/payment/email wiring | **🤖 AI** | This is normal coding |

Throughout the guides: **🔴 YOU MUST DO THIS** = a step the AI can't do for you. **🤖 AI CAN DO THIS** = hand it back to your assistant.

> **🔑 Golden rule for newbies:** Never paste a **secret** — an API key, a "Client Secret", a signing password, a Stripe live key — into a public chat, a screenshot, or a file you'll commit to GitHub. Treat them like your house keys. Secrets live in environment variables / a secret manager, never in your code.

---

## ⏱️ The #1 rule: start the slow stuff on DAY ZERO

**This is the single most important lesson across all the guides.** Several launch steps have a **human/bureaucratic lead time you cannot speed up** — and newbies almost always discover them *after* the app is finished, turning a "ready to launch" moment into a multi-week wait:

| Slow thing | Where | Typical wait |
|---|---|---|
| Apple processes your $99 payment, *then* verifies you | DEV_SETUP | up to ~2 days for payment **+** 24–48 h verify |
| Google Play identity verification (manual review) | DEV_SETUP | hours → several days |
| Google Play **12-tester / 14-day closed test** (new personal accounts) | DEV_SETUP | **14+ days** |
| D-U-N-S number (organization accounts, Apple/Google) | DEV_SETUP | days → weeks |
| Stripe identity + bank verification before live payments | PAYMENTS | hours → days |
| Email **sending-domain DNS** (SPF/DKIM/DMARC) propagation + reputation warm-up | EMAIL | hours → days |
| Google "sensitive scope" OAuth verification (only if you request Gmail/Drive) | AUTH | days → weeks |

**So: kick off every account signup + verification the moment you start building** — let the clocks run in the background while you code. Do **not** save them for launch week. The setup is cheap; the **waiting is the real cost**, so start the waiting early.

---

## Recommended order of operations

1. **Day 1 — fire off the slow signups:** Apple Developer + Google Play (DEV_SETUP), and a Stripe account if you'll charge web/physical/outside-app purchases (PAYMENTS). Mobile in-app digital goods need StoreKit / Play Billing product setup instead. Org route? Apply for D-U-N-S first.
2. **Early & architectural:** pick your **database** (DATABASE) and your **auth approach** (AUTH) — these shape everything and are painful to swap later.
3. **As you build:** wire sign-in (AUTH); set up your **email** sending domain (EMAIL) so verification/magic-link mail isn't in spam.
4. **Before you collect real user data / launch:** privacy policy + consent + data export/delete (PRIVACY_GDPR).
5. **When you monetize:** web/physical/outside-app payments use Stripe checkout + subscriptions + webhooks, verified in **test mode** first; mobile in-app digital goods use StoreKit / Play Billing + server-side entitlement verification (PAYMENTS).
6. **Launch:** Apple review + Google Play production (after the 14-day test).

---

## Deeper reference material

The guides are the plain-language layer. For the precise rules behind them, open the playbooks and knowledge folders:

| Folder | What it holds |
|---|---|
| [`playbooks/default-stacks.md`](../playbooks/default-stacks.md) · [`monetization-patterns.md`](../playbooks/monetization-patterns.md) · [`conversion-funnel-playbook.md`](../playbooks/conversion-funnel-playbook.md) · [`security-privacy-baseline.md`](../playbooks/security-privacy-baseline.md) · [`research-signal-2026.md`](../playbooks/research-signal-2026.md) · [`acceptance-criteria.md`](../playbooks/acceptance-criteria.md) | Opinionated defaults: which stack, how to get paid, how the funnel converts, the security/privacy baseline, 2026 research signal, and what `/lastmile` itself promises |
| [`knowledge/security/`](../knowledge/security/README.md) | Application-security rules (authz/RLS, sessions, secrets, rate limits, prompt injection, input validation, headers, logging, mobile) |
| [`knowledge/compliance/`](../knowledge/compliance/README.md) | Launch-compliance rules (privacy, subscriptions, app-store policy, IP, data rights, incidents, minors, AI) |
| [`knowledge/growth-mechanics/`](../knowledge/growth-mechanics/README.md) | Store reviews, referrals, onboarding to activation |
| [`knowledge/product-telemetry/`](../knowledge/product-telemetry/README.md) | The minimum event chain and keeping it honest |
| [`knowledge/admin-tooling/`](../knowledge/admin-tooling/README.md) | A small, safe admin surface |
| [`knowledge/tech-stack-selection/`](../knowledge/tech-stack-selection/README.md) | Boring, reversible stack choices |
| [`knowledge/design/`](../knowledge/design/README.md) | Conversion design: hierarchy, forms, ethics, microcopy, accessibility, mobile, perceived performance |

---

*The lastmile launch guides — a reusable, plain-language launch playbook for newbie vibe coders. Last reviewed: May 2026. Rules, fees, and free tiers change; each guide's "Official sources" section is the source of truth.*
