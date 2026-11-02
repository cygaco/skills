---
guide: PRIVACY_GDPR
anchor: lastmile:gate/privacy
shape: notice
timing: at-gate
lead_time: "none (but STOP and hire a lawyer BEFORE launch if you touch health/finance/children/biometrics/special-category data)"
---

# PRIVACY_GDPR_GUIDE.md — Privacy & GDPR for Total Newbies

> ## ⚠️ READ THIS FIRST — this is NOT legal advice
> This guide is a **compliance-by-default implementation playbook**: it shows you the *normal, sensible* privacy setup that 90% of small apps need, in plain language, so your assistant can build most of it. **It is not legal advice, and it does not make you "GDPR compliant" by itself.**
>
> **STOP and hire a real lawyer / data-protection specialist BEFORE you launch if your app touches any of these:**
> - **Health or medical data** (symptoms, conditions, fitness/mental-health that reveals health)
> - **Money / financial data** beyond a normal Stripe checkout (lending, investing, accounts)
> - **Children** (anyone under 16 in the EU, under 13 in the US — see the age-gate section)
> - **Biometrics** (face scans, fingerprints, voiceprints used to identify someone)
> - **Other "special category" data**: race, ethnicity, religion, politics, sexual orientation, union membership, genetics
> - Anything in a **regulated industry** (healthcare, banking, insurance, legal, government)
>
> These carry extra rules, bigger fines, and traps a generic guide can't cover. For a plain consumer app (a to-do list, a SaaS dashboard, a marketplace) collecting **name, email, and basic usage** — this guide gets you to a solid, honest baseline. **When in doubt, ask a lawyer. Fines are real and start in the thousands.**

> **New here?** The shared "what only a human can do" and "do this on day zero" preamble lives in **[`README.md`](README.md)** — read it once. This guide does not repeat it.

---

## 1. What privacy law actually asks of you (ELI5)

Forget the 88-page regulation. At its heart, privacy law is **four common-sense promises**:

1. **Be honest** about what data you collect and why. (No secret collection.)
2. **Only collect what you actually need.** (Don't hoard "just in case.")
3. **Use it only for the reason you said.** (Don't quietly repurpose it.)
4. **Let people see, export, and delete their own data.** (It's their data, not yours — you're borrowing it.)

> 🧒 *Newbie note:* Think of yourself as a **coat-check clerk**. People hand you their coat (data) to hold. You must say what you'll do with it, not rummage through the pockets, give it back when asked, and shred the ticket when they leave. You never *own* the coat.

These four promises are the whole game. Everything below is just the **plumbing** that keeps those promises.

---

## 2. Does this even apply to me? (Almost certainly yes)

The single biggest newbie misunderstanding: *"I'm a solo dev in [country X], so EU law doesn't touch me."* **Wrong.** These laws follow your **users**, not you.

| Law | Where it applies | You're in scope if… |
|---|---|---|
| **GDPR** | EU / EEA (27 countries + Iceland, Norway, Liechtenstein) | Even **one** of your users is in the EU/EEA — no matter where *you* live or host. |
| **UK GDPR** | United Kingdom | You have UK users. (Same rules as GDPR, separate regulator: the ICO.) |
| **CCPA / CPRA** | California, USA | You have California users **and** hit the size/revenue thresholds (most tiny apps don't yet — but build as if you will). |

> 🧒 *Newbie note:* If your app is on the public internet and anyone can sign up, you will get EU, UK, and California users. So the safe assumption is: **all of these apply to me.** The good news — the *implementation* below satisfies all three at once. You don't build three systems; you build one honest one.

**Core principles in one breath** (you'll see these words everywhere — here's what they mean):
- **Lawful basis / consent** — you need a *valid reason* to hold someone's data. The usual reasons: they consented (ticked a box), or it's *necessary to provide the service they asked for* (you can't run an account without an email). Marketing almost always needs **consent**.
- **Data minimization** — collect the least you can. No date of birth if you don't need it.
- **Purpose limitation** — use data only for the stated purpose. Email for login ≠ email for a newsletter (that needs separate consent).
- **Transparency** — tell people, in plain words, before/at the moment you collect.

---

## 3. Who does what (the human-vs-AI split)

| Task | Who | Why |
|---|---|---|
| **Publish** the privacy policy + terms as real, live legal documents | 🔴 **YOU** | You're the legal entity making the promise; publishing = signing it. |
| **Review / approve** the policy text (ideally with a lawyer for anything sensitive) | 🔴 **YOU** | The AI drafts; only you can vouch that it's true for *your* app. |
| **Sign the vendor DPAs** (Supabase, Stripe, email, analytics) | 🔴 **YOU** | A DPA is a contract; only the account owner can accept it. |
| **Choose your data region** (e.g. EU hosting for EU users) | 🔴 **YOU** | A dashboard/account decision tied to your billing + setup. |
| **Get legal review** for health / finance / kids / biometric / regulated data | 🔴 **YOU** | See the red box at the top. Non-negotiable. |
| **Draft** the privacy-policy + terms text | 🤖 **AI** | It writes the prose from your real answers — you then verify + publish. |
| **Build the cookie / tracking consent banner** | 🤖 **AI** | Standard front-end work, wired to gate trackers. |
| **Build the data-export (DSAR) endpoint** | 🤖 **AI** | "Download all my data" button + the query behind it. |
| **Build the account-delete / erasure flow** | 🤖 **AI** | "Delete my account" that truly removes/anonymizes the data. |
| **Wire consent gating** (load analytics only after opt-in) | 🤖 **AI** | Conditional script-loading logic. |
| **Wire marketing opt-in + unsubscribe** | 🤖 **AI** | Consent checkbox + honoring opt-out (see `EMAIL_GUIDE.md`). |

> **Golden rule (from [`README.md`](README.md)):** the AI can *build* and *draft* almost all of this. But anything that is a **legal promise, a signed contract, or a true/false claim about your real app** is a human decision. Never let the AI invent facts in your policy ("we delete data after 30 days") that aren't actually true in your code.

---

## 4. What you must actually implement (the practical checklist)

### 4.1 Privacy Policy + Terms of Service 🤖 draft / 🔴 review + publish

Every app needs **two public pages**: a **Privacy Policy** (how you handle data) and **Terms of Service** (the rules of using your app). Both stores (Apple/Google) and most auth providers *require* a privacy-policy URL.

**Your privacy policy must clearly say:**
- **What** data you collect (email, name, usage analytics, payment info via Stripe, etc.)
- **Why** (your lawful basis — "to run your account," "to send a newsletter you opted into")
- **Who you share it with** — name your processors: Supabase, Stripe, your email + analytics providers
- **How long you keep it** (retention — e.g. "until you delete your account, then within 30 days")
- **Their rights** — access, export, correction, deletion, objection, withdrawing consent
- **How to contact you** — a real email a human reads (e.g. `privacy@yourdomain.example`)

> **🤖 AI CAN DO THIS:** *"Draft a privacy policy and terms of service for my app — here's exactly what I collect, who my processors are, and my retention rules."* Feed it the **truth**, read every line, then **🔴 you publish it** at `/privacy` and `/terms`.

> 🧒 *Newbie note:* Don't paste a random template you found and change the company name. A copied policy that doesn't match your app is *worse* than none — it's a written record of promises you're breaking. Generate it from your **actual** data practices.

### 4.2 Cookie / Tracking Consent Banner 🤖 build

You need a consent banner **only when you use non-essential trackers** — analytics (Google Analytics, PostHog, Mixpanel), advertising pixels (Meta, TikTok), session recording, A/B tests. You do **not** need consent for *strictly necessary* things (login session cookies, a security token, remembering items in a cart).

**The EU rules that trip everyone up (confirmed against 2026 ICO guidance):**
- **Opt-IN, not opt-out.** Trackers must be **OFF by default**. No pre-ticked boxes.
- **Load trackers only AFTER consent.** This is the #1 violation — see Gotchas. Analytics must not fire until the user clicks "Accept."
- **"Reject All" must be as easy as "Accept All"** — equal size, equal prominence, on the first screen. No tiny grey "reject" link hidden under a giant green "Accept."
- **No dark patterns.** Don't trick, nag, or pre-select. Consent must be *freely given, specific, informed, unambiguous*.
- **Modern scope:** the ICO's 2026 guidance covers not just cookies but *all* storage/access tech — pixels, fingerprinting, local storage, tag scripts. The banner gates **all** of it.

> **🤖 AI CAN DO THIS:** *"Build a GDPR-compliant cookie consent banner: off by default, Accept-All and Reject-All equally prominent, granular categories, and load analytics scripts only after consent."* The assistant builds the banner **and** the gating logic. (For a no-code path, managed tools like Cookiebot / CookieYes / Osano also exist — your assistant can wire one in.)

### 4.3 Right to Access / Data Export (DSAR) 🤖 build

A **DSAR** ("Data Subject Access Request") is a user saying *"show me everything you have on me."* The clean way: a self-serve **"Download my data"** button that exports their records (profile, content, activity) as JSON or CSV.

> **🤖 AI CAN DO THIS:** *"Add a 'Download my data' feature that exports everything tied to my account."* Ties directly to **`DATABASE_GUIDE.md`** (the queries that gather a user's rows). Legally you have **~30 days** to fulfill a request — self-serve makes it instant.

> **➡️ The OPERATIONS side** — verifying who's asking (without over-verifying: demanding ID copies is itself a violation), the exact statutory clocks, the request queue + audit log — lives in **`DATA_REQUESTS_GUIDE.md`**.

### 4.4 Right to Erasure / Delete My Account 🤖 build

Users can demand you **delete them**. You need a real **"Delete my account"** flow that *actually* removes or anonymizes their data — not a flag that hides them while you keep everything.

- **Delete** the personal data, or **anonymize** it (strip the identifying fields) if you must keep aggregate stats.
- **Cascade** the delete across related tables (see `DATABASE_GUIDE.md` for cascade/anonymization patterns).
- **Tell your processors** — deleting in your DB doesn't delete copies at Stripe/your email tool; trigger their deletion too (mostly via their API or dashboard).
- This ties to **`AUTH_GUIDE.md`** (account deletion at the auth-provider level — removing the login identity itself).

> **🤖 AI CAN DO THIS:** *"Add a 'Delete my account' flow that removes my user's data across all tables and revokes their login."* **🔴 You decide the policy** (hard delete vs anonymize, grace period, what aggregate data you legitimately keep) — the AI implements it.

> 🧒 *Newbie note:* "Delete" must be honest. A soft `deleted = true` flag where the row still sits in your database with their email is **not** erasure. If you keep anything (e.g. an invoice you're legally required to retain), say so in your policy.

> **➡️ The OPERATIONS side** — the backups answer, store mandates (Google Play requires in-app deletion **plus a web deletion link**; Apple 5.1.1(v) requires in-app), retention schedules, and the request log — lives in **`DATA_REQUESTS_GUIDE.md`**.

### 4.5 Marketing Consent + Unsubscribe 🤖 build

You may email **marketing** (newsletters, promos) **only to people who specifically opted in to marketing** — separately from signing up. And every marketing email must have a working **unsubscribe** link that you **honor immediately**.

- Login email ≠ marketing consent. Use a **separate, unticked** "Email me product news" checkbox.
- One-click unsubscribe; never email someone again once they opt out.
- *(Transactional* emails — password reset, receipts — don't need marketing consent; they're part of the service.)

> **Cross-ref:** see **`EMAIL_GUIDE.md`** for the full send setup. The rule here: *only email consenting users, and honor opt-out forever.*

### 4.6 Vendor DPAs (Data Processing Agreements) 🔴 sign

When you use a service that touches your users' data, that vendor is your **"processor,"** and GDPR requires a signed **DPA** (Data Processing Agreement) between you. Good news: **almost every major vendor offers a standard DPA** you accept in their dashboard — usually one click, sometimes auto-accepted in their terms.

**Typical processors you'll need a DPA with:**

| Vendor | What it processes | Where the DPA usually lives |
|---|---|---|
| **Supabase** (DB + auth) | All your user records | Dashboard / org settings → Legal / DPA |
| **Stripe** (payments) | Payment + customer data | Included in their services agreement / dashboard |
| **Email provider** (Resend, Postmark, SendGrid…) | Recipient emails | Account → Legal / Compliance |
| **Analytics** (PostHog, Plausible, GA…) | Usage / behavior data | Account settings → DPA |
| **Hosting** (Vercel, Netlify, Fly…) | Whatever passes through | Dashboard → Legal |

> **🔴 YOU MUST DO THIS:** find each vendor's DPA, accept/sign it, and **keep a copy or note the date.** Then **list those same vendors in your privacy policy** (section 4.1 "who you share with"). The two must match.

> 🧒 *Newbie note:* A "processor" is anyone who handles your users' data *on your behalf*. You're the "controller" (you decide the why). The DPA is just the contract saying the processor will only do what you tell them and keep the data safe.

### 4.7 Data Location / Transfers 🔴 choose region

If your users are in the EU but your data sits on US servers, that's an **international transfer**, which GDPR restricts. The newbie-safe move: **pick an EU data region** when you set up your database/hosting, so EU data stays in the EU and the transfer question mostly disappears.

If you *do* send EU data to the US (most US SaaS does), it's lawful when **either**:
- The US vendor is certified under the **EU-US Data Privacy Framework (DPF)** — an "adequacy" arrangement the EU recognizes (it survived a 2025 court challenge; an appeal, the pending appeal to the EU Court of Justice, was still pending as of May 2026, so treat it as valid-for-now but watch the news), **or**
- You rely on **Standard Contractual Clauses (SCCs)** — standard legal text baked into the vendor's DPA (plus, strictly, a short "transfer impact assessment").

> **🔴 YOU MUST DO THIS:** when creating your Supabase/hosting project, **choose an EU region** (e.g. Frankfurt) if your audience is EU. It's a one-time dropdown at setup and the cleanest answer. You generally can't change region later without a migration.

> 🧒 *Newbie note:* You don't need to memorize "DPF vs SCCs." Two practical moves cover you: **(1)** host EU users' data in the EU, and **(2)** make sure each US vendor's DPA mentions SCCs or DPF (they almost all do). That's the newbie baseline.

### 4.8 Age-Gate / No Under-13 (COPPA avoidance) 🔴 decide

Children's data is a **legal minefield** (COPPA in the US protects under-13s; GDPR sets the "digital consent" age at 13–16 depending on country). The simplest safe path for a normal app: **don't allow children.**

- Add a clear line in your terms: *"You must be at least 16 (or 13 with the consent applicable in your country) to use this app,"* and/or a simple **age confirmation** at signup.
- Do **not** knowingly collect data from kids.

> **🔴 IF YOU ACTUALLY TARGET CHILDREN: STOP.** Kids' apps trigger COPPA, age-verification, parental-consent, and design-code rules that are far beyond this guide. **Escalate to a lawyer before writing a line of code.**

---

## 5. The Gotchas (what actually bites newbies)

- **Analytics fires before consent.** The classic violation: Google Analytics / a Meta pixel loads on page-open, *then* the banner appears. By then you've already tracked them. **Fix:** trackers stay unloaded until the user clicks Accept — your assistant gates them.
- **No real deletion path.** A "delete" that just sets `is_deleted = true` while the row (and their email) lives forever is **not** erasure. Build a true delete/anonymize.
- **Vague "we use your data to improve our services."** Regulators hate catch-all phrases. Say *what* data, *for what*, *shared with whom*. Specifics, not vibes.
- **Dark-pattern consent.** Pre-ticked boxes, a giant "Accept" next to a hidden "Reject," guilt-trip copy ("No, I hate savings") — all illegal in the EU. Equal prominence, neutral wording.
- **Forgetting the DPA.** You signed up for Supabase/Stripe but never accepted their DPA, and never listed them in your policy. Both must be done.
- **Storing more than you need.** Collecting phone numbers, birthdays, addresses "just in case." Every extra field is extra risk and a bigger breach if you're hacked. Minimize.
- **Region chosen after launch.** You picked the default US region, got EU users, and now have a transfer problem you can't easily undo. Choose region **at setup**.
- **Policy that lies.** Your policy says "we never share data" but you use Google Analytics. The policy must describe what your code *actually does*.

---

## 6. Launch checklist (copy into your tracker)

```
PRIVACY & GDPR
[ ] Privacy Policy drafted (🤖) → reviewed → PUBLISHED at /privacy (🔴)
[ ] Terms of Service drafted (🤖) → reviewed → PUBLISHED at /terms (🔴)
[ ] Policy lists EVERY processor (Supabase, Stripe, email, analytics)
[ ] Cookie/consent banner: off-by-default, Reject = Accept prominence (🤖)
[ ] Trackers load ONLY after consent — verified by testing (🤖)
[ ] "Download my data" (DSAR export) works (🤖)
[ ] "Delete my account" truly removes/anonymizes across all tables (🤖)
[ ] Marketing = separate opt-in checkbox + working unsubscribe (🤖)
[ ] DPA signed/accepted with each vendor + date noted (🔴)
[ ] EU data region chosen at setup if EU users (🔴)
[ ] US vendors covered by DPF or SCCs in their DPA (🔴)
[ ] Age line in terms (16/13+); NOT targeting children (🔴)
[ ] Collecting only fields you actually use (data minimization)
[ ] Real contact email for privacy requests, monitored
[ ] (Sensitive data? health/finance/kids/biometric) → LAWYER FIRST (🔴)
```

---

## 7. Plain-English glossary

- **Data controller** — you. You decide *why* data is collected.
- **Data processor** — a vendor that handles data *for* you (Supabase, Stripe). Needs a DPA.
- **Lawful basis** — your legal reason to hold data (consent, or necessity to run the service).
- **Consent** — a freely given, specific, informed, unambiguous *opt-in*. Pre-ticked ≠ consent.
- **DSAR** — Data Subject Access Request: "show me / give me my data."
- **Right to erasure** — "delete me," a.k.a. "right to be forgotten."
- **DPA** — Data Processing Agreement: the contract between you and a processor.
- **SCCs** — Standard Contractual Clauses: standard legal text that legitimizes EU→non-EU transfers.
- **DPF** — EU-US Data Privacy Framework: an adequacy arrangement letting certified US firms receive EU data.
- **Special category data** — extra-sensitive data (health, race, religion, biometrics…) with stricter rules.
- **COPPA** — US law protecting under-13s. Triggers heavy obligations.
- **PII / personal data** — anything that identifies a person (name, email, IP, device ID).
- **Data minimization** — collect the least you need, keep it the shortest time.

---

> ## ⚠️ One more time — this is not legal advice
> You've now got a sensible **default** privacy setup that your assistant can largely build, satisfying the same core for GDPR, UK GDPR, and CCPA. But this guide can't know your specifics, and laws change. **For sensitive data (health, finance, children, biometrics, anything regulated) get a qualified lawyer before launch.** For everything else: be honest, collect little, let people leave with their data — and when unsure, ask a professional.

---

## 8. Official sources (the source of truth — rules change, always re-check)

- **GDPR full text** (official EU): https://eur-lex.europa.eu/eli/reg/2016/679/oj — and the readable version: https://gdpr.eu/
- **UK ICO — guide to data protection & PECR (cookies):** https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/ and https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/
- **California CPPA (CCPA/CPRA regulator):** https://cppa.ca.gov/ — law text: https://oag.ca.gov/privacy/ccpa
- **EU-US Data Privacy Framework (program overview + how to check certification):** https://www.dataprivacyframework.gov/Program-Overview
- **EDPB — DPF FAQ for businesses (v2.0, Jan 2026):** https://www.edpb.europa.eu/system/files/2026-01/edpb_dpf_faq-for-businesses_v2_en.pdf
- **DPA explainer (what a Data Processing Agreement is):** GDPR Art. 28 — https://gdpr-info.eu/art-28-gdpr/
- **COPPA (US children's privacy, FTC):** https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy

---

*This guide is part of the **lastmile launch guides** (`.claude/lastmile/guides/`) — reusable, plain-language launch playbooks for newbie vibe coders. See [`README.md`](README.md) for the shared preamble, and the sibling guides `AUTH_GUIDE.md`, `DATABASE_GUIDE.md`, and `EMAIL_GUIDE.md` referenced above. **Last reviewed: 2026-05.** Privacy laws and vendor terms change; the official sources above are the source of truth — and this guide is not legal advice.*
