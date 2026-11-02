---
guide: LEGAL
anchor: lastmile:gate/legal
shape: notice
timing: at-gate
lead_time: "none (but STOP and hire a lawyer BEFORE launch for health/finance/children/biometric/regulated data, equity/fundraising, or AGPL anywhere in your dependency tree)"
---

# LEGAL_GUIDE.md — Legal Protection for Your Launch (for Total Newbies)

> ## ⚠️ READ THIS FIRST — this is NOT legal advice
> This guide is a **sensible-default playbook** for the legal layer of launching a **normal consumer app** — the Terms of Service, subscription rules, IP hygiene, and corporate shields that 90% of small apps need, in plain language, so your assistant can draft most of it. **It is not legal advice, it is not written by a lawyer, and it does not make you "legally protected" by itself.**
>
> **STOP and hire a real lawyer BEFORE you launch if your app touches any of these:**
> - **Health or medical data** (symptoms, conditions, anything that reveals health)
> - **Finance / lending / payments beyond a normal Stripe checkout** (lending, investing, money transmission, crypto, holding balances)
> - **Children** (COPPA in the US protects under-13s; "under-16" rules apply in parts of the EU)
> - **Biometrics** (face/fingerprint/voiceprint used to identify someone — e.g. **Illinois BIPA**, which carries *statutory damages per violation* and has produced class actions costing tens of millions)
> - You're **raising money, giving away equity, or hiring** (securities + employment law — a different universe)
> - You have **AGPL** code *anywhere* in your dependency tree (see §5 — it can create source-disclosure obligations; how far they reach depends on architecture)
>
> These carry extra rules, bigger fines, and traps a generic guide can't cover. For a plain consumer app (a to-do list, a SaaS dashboard, a marketplace) selling a normal subscription — this guide gets you to a solid, honest baseline. **When in doubt, ask a qualified lawyer. Lawsuits and fines are real and start in the thousands.**

> **New here?** The shared "what only a human can do" and "do this on day zero" preamble lives in **[`README.md`](README.md)** — read it once. This guide does not repeat it.

> **The data/privacy half of the law lives next door.** Everything about **GDPR, CCPA, consent, cookie banners, data export & delete, vendor DPAs, and the privacy policy itself** is covered in depth in **`PRIVACY_GDPR_GUIDE.md`** — this guide does **not** duplicate it. This guide covers the **rest** of the legal surface: your Terms of Service, subscription law, IP (trademark/copyright/open-source), and the business shields (LLC, insurance, accessibility).

---

## 1. The two documents every app needs

Every launched app needs **two public legal pages**. They do different jobs:

| Document | What it is | Who requires it |
|---|---|---|
| **Privacy Policy** | The **DATA promise** — what you collect, why, who you share it with, how to delete it. | Required by **GDPR & CCPA**, *and* by **Apple, Google, and Stripe** before they'll let you ship. **Covered in depth in `PRIVACY_GDPR_GUIDE.md` → go there.** |
| **Terms of Service (ToS)** | The **RULES + your liability shield** — a real contract between you and your users. | Not always strictly "required," but without an enforceable one you **lose your best contractual liability cap** — some claims may still be limited by law, and some can't be capped even *with* a ToS. This guide. |

The Privacy Policy is covered fully in the privacy guide — **don't write it twice.** Here we focus on the **Terms of Service**, because it's the contract that actually protects *you*.

**What a Terms of Service must contain** (this is your liability shield — every clause earns its place):

- **Acceptable-use / license + restrictions** — you grant users a limited right to use the app; they agree not to abuse it (no scraping, reselling, reverse-engineering, hacking, illegal use).
- **Limitation of Liability** — caps how much you can be sued for. A common SaaS cap is **the fees the user paid you in the prior 12 months** (often "$100 or 12 months of fees, whichever is greater"), and it **excludes indirect / consequential damages** (lost profits, downtime). This single clause is the difference between "we refund you" and "we owe you your business."
- **Warranty disclaimers / "AS IS"** — you provide the service "as is," with no promise it's bug-free or always up. Without this you're implicitly promising perfection.
- **Governing law + venue** — *which* state/country's law applies and *where* disputes are heard (usually where your business is).
- **Dispute resolution** — **binding arbitration + a class-action waiver**, often with a **30-day opt-out** window. A 30-day opt-out *can improve* the clause's enforceability against consumers in the US — but enforceability isn't automatic: it depends on the **jurisdiction**, the **notice** you gave, whether a court finds the clause **unconscionable**, and the exact wording of the clause itself. Treat the opt-out as a helpful feature, not a magic switch — **have counsel review the clause.**
- **Termination** — your right to suspend/close accounts that break the rules.
- **IP ownership** — **you keep the product** (your code, brand, design). The **user usually keeps their own content** but grants *you* a license to host, store, and display it so the app can function. Spell this out.
- **Indemnification** — if a user's misuse of your app gets *you* sued, they cover that cost.

> **🤖 AI CAN DO THIS:** *"Draft a Terms of Service for my app from these real facts — what it does, what users can't do, my governing law (my state), a 12-month liability cap, AS-IS warranty disclaimer, arbitration with a 30-day opt-out, and IP ownership where I keep the product and users keep their content but license it to me."* The assistant drafts it; **🔴 you review and publish it** at `/terms`.

> 🧒 *Newbie note:* A **copied ToS that doesn't match your app is worse than none.** It's a written contract full of promises about a *different* app — gaps a user (or their lawyer) can drive a truck through. Generate it from your **actual** facts, read every line, then publish.

---

## 2. Publishing your Terms isn't enough — make acceptance PROVABLE

Here's the trap that quietly guts the shield you just built: a Terms of Service only protects you if your users **actually agreed to it.** Quietly posting your contract at `/terms` and hoping people stumble across it is the weakest possible position — if a dispute ever lands in front of a court or arbitrator, the **first** question is "did this user *assent* to these terms?" A page nobody clicked through is a contract nobody signed. The fix is **clickwrap** — an affirmative "I agree" action — plus a **record** that you can produce later.

What "provable acceptance" actually means in practice:

- **Link Terms AND the Privacy Policy at signup and at checkout** — the two moments money or an account is on the line. The links must be visible *before* the action, not buried in a footer.
- **Require an affirmative acceptance action** — a real clickwrap step: *"Create account — I agree to the Terms and Privacy Policy"* (with both links live). A pre-ticked box, or "by using this site you agree" fine print ("browsewrap"), is the weak version courts routinely *refuse* to enforce.
- **Store the proof** — when someone accepts, record the **Terms version**, the **timestamp**, the **user ID**, and the **acceptance source** (which screen/flow they accepted from). That record is what you produce if assent is ever challenged.
- **Re-accept on material change** — when you *materially* change the Terms, require users to accept the new version again where appropriate, rather than assuming silence equals agreement.
- **Keep a version history** — never silently swap legal text under people's feet. Keep every prior version so you can show *which* terms a given user agreed to *when.*

> **🤖 AI CAN DO THIS:** *"Add a clickwrap acceptance step at signup and checkout — a required 'I agree to the Terms and Privacy Policy' checkbox with both links — and store each acceptance as a record with the Terms version, timestamp, user ID, and source screen. Version my Terms so I can require re-acceptance when they materially change."* The assistant builds the flow and the acceptance log; **🔴 you** confirm the links point at the live, correct documents.

> 🧒 *Newbie note:* think of it like a signature on a paper contract. Publishing the contract on a noticeboard proves nothing; the **signed copy in your filing cabinet** is what holds up. The clickwrap checkbox *is* the signature, and the stored record *is* the filing cabinet. Skip them and you may have a beautiful ToS that protects no one.

---

## 3. If you charge a subscription, it must be easy to cancel (the law)

> **⚠️ IN FLUX — this section is deliberately precise. Read it carefully.**

Newbies assume there's "a click-to-cancel law" and either panic or ignore it. The real picture, as of mid-2026:

**The US federal "Click-to-Cancel" rule is currently VACATED.** The FTC's amended **Negative Option Rule** (16 CFR Part 425), finalized **October 2024**, was **vacated in its entirety on July 8, 2025** by the **8th Circuit Court of Appeals** (*Custom Communications v. FTC*) — on *procedural* grounds (the FTC skipped a required step), not because the idea was wrong. So **there is no federal click-to-cancel rule in force right now.**

**Do NOT relax — three other laws still bind you:**

| Law | Who it binds | What it still requires |
|---|---|---|
| **ROSCA** (federal, *Restore Online Shoppers' Confidence Act*) | Everyone selling online subscriptions in the US | Clear **disclosure** of terms before charging, **express consent** to the charge, and a **simple cancellation** mechanism. This survived the vacatur — it's the floor. |
| **California Auto-Renewal Law (ARL)**, amended by **AB 2863** (effective **July 1, 2025**) | Anyone with **California users** (so, basically everyone) | Cancel must be the **same medium** you signed up in (signed up on the web → must be cancellable on the web); **two separate consents** (one for the service, one *specifically* for auto-renewal); covers **free trials**; clear pre-billing disclosure; an **annual renewal reminder**; and you must **keep consent records ≥ 3 years.** |
| **EU "Withdrawal Button"** (Directive (EU) 2023/2673) | Sellers to EU consumers — **reaches non-EU sellers** | A prominent **withdrawal button** plus the **14-day right of withdrawal**. ⚠️ **Withdrawal ≠ ordinary cancellation:** the *right of withdrawal* (a "cooling-off" right to back out of a recent purchase, often with a refund) is a **different mechanism** from cancelling an ongoing subscription's auto-renewal (the rows above). This rule applies to **covered distance contracts from June 19, 2026** — **confirm the scope** for your specific product with counsel; plan for it now. |

**On the app stores vs. the web:**
- **Apple (Guideline 3.1.2)** and **Google** make in-app subscription cancellation **native** — the user cancels in their App Store / Play account. But you **must still clearly disclose the renewal terms and price before purchase.**
- **Web / Stripe-billed subscriptions get NO native cancel button.** If you bill on the web through Stripe, **you must build the easy cancel path yourself** — a visible "Cancel subscription" button in the account settings that actually ends the renewal. (Stripe's Customer Portal does this for you — see `PAYMENTS_GUIDE.md`.)

> **Practical rule (covers all of the above):** clear auto-renew disclosure **before** charging → a **separate** consent checkbox for the auto-renewal itself → an **easy, same-medium** cancel (web sign-up = web cancel) → **keep the consent records.** Do this and you're compliant under ROSCA, California's ARL, and the incoming EU button at once.

> **🤖 AI CAN DO THIS:** *"Add a separate 'I agree to auto-renewing billing' consent at checkout, store the consent with a timestamp, and add a one-click 'Cancel subscription' button in account settings that ends the Stripe renewal."* See **`PAYMENTS_GUIDE.md`** for the Stripe wiring.

> 🧒 *Newbie note:* "I'll just make them email me to cancel" is exactly what these laws **outlaw.** Cancelling has to be at least as easy as signing up.

---

## 4. Declare every data point you collect — and make the declarations MATCH reality

You don't just collect data — you have to **inventory it and declare it**, in *several* places, and **all the declarations must agree with each other and with what your code actually does.**

The same set of facts shows up in four places:

| Where you declare your data | What it's called |
|---|---|
| Your internal record of processing | GDPR **Records of Processing Activities (ROPA, Art. 30)** |
| Your privacy policy | CCPA **"categories of personal information"** |
| Apple App Store | **Privacy Nutrition Label** |
| Google Play | **Data Safety form** |

**The rule: all four must equal what your code actually collects.** The Apple Nutrition Label, the Google Play Data Safety form, **and** your privacy policy must say the *same* thing — and that thing must be *true*. Mismatches get your app **flagged or rejected** at store review.

- **Google's April 2025 Data Safety update** tightened this: an **Android Advertising ID counts as a device identifier** (you must declare it), and **"sharing"** means **any transfer to a third party — including an SDK** you bundle. A tracking SDK you forgot about is "sharing" you didn't declare.
- **Which laws apply follows your USERS' location**, not yours: **GDPR** = EU/EEA/UK users; **CCPA** = California users over the thresholds; and **~20 US states** have comprehensive privacy laws as of 2026 — note **Texas's TDPSA is broader than many state laws** (it doesn't gate purely on revenue/volume the way several others do). It *does* have a **small-business exclusion**, but that exclusion has exceptions — notably the **sale of sensitive data** — so a small app can still be pulled in. Don't assume "we're too small"; **confirm applicability with counsel.**

**The how-to** — building consent, the data-export button, the delete flow — is all in **`PRIVACY_GDPR_GUIDE.md` → go there.** The rule *here* is simpler: **know every field you collect, and keep all four declarations (ROPA, privacy policy, Apple label, Google form) in sync with the code.**

> **🤖 AI CAN DO THIS:** *"List every piece of personal data my code collects and every third-party SDK it sends data to, then draft my Apple Privacy Nutrition Label and Google Play Data Safety entries to match — and check them against my privacy policy."* **🔴 You verify** it's true before you submit.

> 🧒 *Newbie note:* The fastest way to fail App Review (and the easiest to fix) is a privacy label that claims you collect *less* than your code really does. Reviewers diff your declaration against your app's network traffic. Tell the truth and they pass you.

---

## 5. Don't step on someone else's IP

Three flavors of intellectual property can bite you: **trademark** (names), **copyright** (creative work + code), and **open-source licenses** (the strings attached to code you reused).

### Trademark — clear your NAME before you commit to it 🔴

Before you fall in love with an app/company name, **check that someone else doesn't already own it:**

- Search the official **USPTO Trademark Search** at **https://tmsearch.uspto.gov** (it replaced the old "TESS" system in **November 2023**).
- Search the software classes: **Class 9** (downloadable apps/software) and **Class 42** (SaaS / software-as-a-service). Your competitors' marks live there.
- The legal test is **"likelihood of confusion"** — you don't need an *identical* name to infringe; a **confusingly similar** name on **related goods** is enough. "Slacker" for team chat would have a problem; "Slacker" for a fishing app, less so.

> **🔴 YOU MUST DO THIS:** A free "knockout" search catches **exact** hits but **misses sound-alikes and unregistered "common-law" marks.** Before you build a brand, do a fuller clearance: USPTO Trademark Search **+** a plain Google search **+** the Apple App Store **+** Google Play **+** check the domain is available. Once it's clear, consider **registering your own mark** so the next person has to clear *around you*.

> 🧒 *Newbie note:* Skipping the search and launching is how you get a **cease-and-desist letter** *after* you've printed stickers, bought ads, and built an audience — then you have to rename everything. Ten minutes of searching up front saves a brand re-launch.

### Copyright — don't copy creative work or code you don't own 🔴

- Don't copy **code, text, images, icons, or fonts** you don't have the rights to. License stock assets (and *keep the license*).
- **Pure prompt-only AI output has no US copyright by itself.** The **US Copyright Office (January 2025 report)** confirmed that purely AI-generated material — where a prompt is the only human input — gets **no copyright on its own**. **But that's not the whole story:** human-authored **selection, arrangement, and edits** *on top of* AI output can be protectable, and a logo can carry **trademark** protection from how you *use* it in commerce even if the image itself isn't copyrightable. So don't treat "AI made it" as "anyone can copy it freely" — but also don't assume raw prompt output is "yours" to *defend* as a copyright. If your brand identity matters, get a human meaningfully in the creative loop (and clear the name — see Trademark above).

### Open-source licenses — the AGPL trap 🔴

You reuse open-source code constantly. The **license** decides what you owe in return:

| License family | Examples | For a closed-source app |
|---|---|---|
| **Permissive** | **MIT, Apache-2.0, BSD** | ✅ Fine. Just **keep the attribution / license text** somewhere (e.g. a `LICENSES` / "Acknowledgements" screen). |
| **Copyleft (GPL)** | GPL-2.0, GPL-3.0 | ⚠️ Copyleft **on distribution** — if you ship the binary, you may owe source. Usually fine for a *hosted* SaaS you don't distribute, but tread carefully. |
| **Network copyleft (AGPL)** | **AGPL-3.0** | 🔴 **The SaaS trap.** Letting users **access your hosted service over a network** can require you to **offer the Corresponding Source** for the modified AGPL software *and* works combined with it over the network. Whether that reaches your **whole app** depends on your architecture/linking — but the risk is real and hard to scope. **Avoid AGPL dependencies in a closed-source SaaS unless counsel approves** — or buy a commercial license from the author. |

> **🔴 YOU MUST DO THIS:** Run a **software-composition-analysis (SCA) / SBOM scan** to find copyleft hiding deep in your dependency tree. An AGPL package three levels down can quietly create source-disclosure obligations — how far they reach depends on your architecture, which is exactly why you want **counsel to review** any AGPL hit rather than guessing. Tools the assistant can wire in will list every license in your tree.

> **Patents:** filing your own is **rarely worth it early.** The real near-term risk is **infringing an existing one** — and that's genuinely a lawyer's job, not a DIY check. Don't lose sleep over it pre-launch, but flag it to counsel if you're doing anything genuinely novel in a crowded technical field.

---

## 6. Protect yourself (a few more shields)

A handful of non-software moves that put a wall between *your* product's risk and *your personal life*:

- **Form an LLC / Ltd company.** This separates your **personal assets** (your house, your savings) from **business claims** (a user sues the app). It's cheap and fast in most places. **But** you only keep that protection if you treat the company as real: a **separate business bank account**, separate records, no mixing personal and business money — otherwise a court can **"pierce the corporate veil"** and come after you personally anyway.
- **Consider basic insurance.** A **general liability** + **cyber/tech E&O** policy covers things like a data breach or a customer claim. This is a **quote to get, not a hard requirement** for day one — but worth pricing before you have real revenue at stake.
- **Mind accessibility law.** This catches newbies by surprise: in the US, **ADA web/app accessibility lawsuits are common** (thousands filed per year, often over simple things like missing image alt-text or unlabeled buttons). The **EU Accessibility Act has been in force since June 28, 2025.** Build to **WCAG 2.2 AA** where feasible — it's the **current** version — though some laws and procurement standards still reference **2.1 AA** or **EN 301 549**, so check which your specific obligations name. Either way, **your assistant can build to it** (alt text, keyboard navigation, color contrast, labeled form fields).

> **🤖 AI CAN DO THIS:** *"Audit my app against WCAG 2.2 AA and fix the issues — alt text, contrast, keyboard nav, ARIA labels, focus order."* This is normal front-end work the assistant handles well.

---

## Gotchas (what actually bites newbies)

- **No Terms of Service at all** — so you **lose your best contractual liability cap**: a user can argue for their lost business, not just a refund. (A ToS can't cap *everything* — some claims are limited by law, some can't be capped at all — but it's your strongest shield.)
- **A copied ToS / policy that lies about your app** — a contract full of promises about a *different* product. Worse than nothing.
- **A web/Stripe subscription with no cancel button** — straight ROSCA + California ARL violation. Build the cancel path; the stores only cover *in-app* purchases.
- **A privacy label that doesn't match the code** — instant App Store / Play rejection (or worse, an enforcement flag after launch).
- **Picking a name with no trademark search** — then a **cease-and-desist** lands after you've built the brand, and you rename everything.
- **An AGPL dependency in a closed-source product** — can create source-disclosure obligations for the AGPL code and network-combined works (how far it reaches depends on architecture — get counsel). Caught only by an SCA/SBOM scan.
- **Running the business out of your personal bank account** — hands a court the excuse to **pierce the veil** and erase your LLC protection.
- **Two separate consents collapsed into one** — California's ARL needs a *distinct* auto-renewal consent; a single "I agree to everything" checkbox fails it.

---

## Launch checklist (copy into your tracker)

```
LEGAL (beyond privacy — see PRIVACY_GDPR_GUIDE for the data half)
[ ] Terms of Service drafted (🤖) → reviewed → PUBLISHED at /terms (🔴)
[ ] ToS has: liability cap (12-mo fees), AS-IS disclaimer, governing law
[ ] ToS has: arbitration + class-action waiver WITH a 30-day opt-out (counsel-reviewed)
[ ] ToS has: IP ownership (you keep product / users license their content)
[ ] Acceptance is PROVABLE: clickwrap "I agree" at signup + checkout (🤖)
[ ] Acceptance RECORD stored: Terms version + timestamp + user ID + source (🤖)
[ ] Terms versioned; re-acceptance on material change (🤖)
[ ] Subscription: auto-renew disclosed BEFORE charge (🔴)
[ ] Subscription: SEPARATE auto-renewal consent, stored + timestamped (🤖)
[ ] Subscription: easy same-medium cancel — web/Stripe = build it yourself (🤖)
[ ] Consent records kept ≥ 3 years (California ARL)
[ ] Data declarations MATCH: code = privacy policy = Apple label = Play form
[ ] Every third-party SDK that receives data is declared as "sharing"
[ ] Trademark cleared: USPTO search (class 9 + 42) + Google + stores + domain (🔴)
[ ] No copyrighted assets/fonts/code without a license (license text kept)
[ ] SCA/SBOM scan run — NO AGPL in the dependency tree (🔴)
[ ] LLC/Ltd formed + SEPARATE business bank account (🔴)
[ ] Accessibility: built to WCAG 2.2 AA — current (some laws still cite 2.1 AA / EN 301 549) (🤖)
[ ] (Health/finance/kids/biometric/equity/AGPL?) → LAWYER FIRST (🔴)
```

---

## Plain-English glossary

- **Privacy Policy** — the **DATA** promise (what you collect / why / who with). Covered in `PRIVACY_GDPR_GUIDE.md`.
- **Terms of Service (ToS)** — the **RULES** contract + your liability shield. *This* guide.
- **Limitation of Liability** — the ToS clause capping how much you can be sued for (commonly the prior 12 months of fees) and excluding indirect damages.
- **Clickwrap** — an affirmative "I agree" acceptance step (a checkbox/button with the terms linked) that creates provable assent. The enforceable opposite of **browsewrap** ("by using this site you agree" fine print), which courts often refuse to enforce.
- **Acceptance record** — the stored proof that a specific user agreed to a specific Terms version: version + timestamp + user ID + source screen. Your "signed copy in the filing cabinet."
- **ROSCA** — *Restore Online Shoppers' Confidence Act*: US federal law requiring clear disclosure, express consent, and simple cancellation for online subscriptions. Still in force.
- **Auto-Renewal Law (ARL)** — California's strict subscription law (amended by AB 2863): same-medium cancel, two consents, free-trial coverage, annual reminder, 3-year records.
- **Negative Option** — any "your silence = you keep paying" arrangement (a subscription that auto-renews). The rules above govern these.
- **ROPA** — *Records of Processing Activities* (GDPR Art. 30): your internal inventory of what data you process and why.
- **Trademark** — legal protection for a **name/brand**. Registered at the USPTO.
- **Likelihood of confusion** — the trademark infringement test: would a customer confuse your mark with an existing one on related goods?
- **Nice class** — the international category system for trademarks (e.g. **Class 9** = downloadable software, **Class 42** = SaaS).
- **Copyleft** — an open-source license condition that forces *your* derivative work to also be open-source (the opposite of "permissive").
- **AGPL** — *Affero GPL*: network copyleft. Letting users *access* your hosted service can require you to offer the Corresponding Source for the modified AGPL code and works network-combined with it (how far it reaches depends on architecture). The SaaS trap.
- **SCA / SBOM** — *Software Composition Analysis* / *Software Bill of Materials*: a scan that lists every dependency and its license.
- **LLC** — *Limited Liability Company*: a legal entity that separates personal from business assets.
- **Piercing the veil** — when a court ignores your LLC's protection because you didn't keep business and personal affairs separate.
- **ADA / EAA** — *Americans with Disabilities Act* (US) / *European Accessibility Act* (EU): accessibility laws; **WCAG 2.2 AA** is the current practical standard (some laws/procurement still reference 2.1 AA or EN 301 549).
- **BIPA** — Illinois' *Biometric Information Privacy Act*: statutory damages per violation for mishandling biometric data. (If you touch biometrics → lawyer first.)

---

## Official sources (the source of truth — rules change, always re-check)

- **FTC business guidance** (subscriptions, Negative Option, advertising): https://www.ftc.gov/business-guidance
- **USPTO Trademark Search** (replaced TESS, Nov 2023): https://tmsearch.uspto.gov
- **US Copyright Office — AI & copyright report** (AI-generated output not copyrightable): https://www.copyright.gov/ai/
- **California Auto-Renewal Law** (Business & Professions Code §17600 et seq.): https://oag.ca.gov/ — search "automatic renewal law"
- **EU consumer rights / "Withdrawal Button"** (Directive (EU) 2023/2673 amending the Consumer Rights Directive): https://eur-lex.europa.eu/eli/dir/2023/2673/oj
- **Apple App Review Guidelines — subscriptions (3.1.2):** https://developer.apple.com/app-store/review/guidelines/
- **And the data half:** `PRIVACY_GDPR_GUIDE.md` (GDPR/CCPA, consent, cookie banner, export/delete) and `PAYMENTS_GUIDE.md` (Stripe subscription + cancel wiring).

---

> ## ⚠️ One more time — this is not legal advice
> You've now got a sensible **default** legal setup that your assistant can largely draft — a real Terms of Service, a compliant subscription flow, clean IP, and the business shields. But this guide is **not written by a lawyer, can't know your specifics, and laws change** (the FTC rule above was alive one year and dead the next). **When in doubt, ask a qualified lawyer** — especially for health, finance, children, biometrics, anything regulated, or if you're raising money. **Fines and lawsuits are real.**

---

*This guide is part of the **lastmile launch guides** (`.claude/lastmile/guides/`) — reusable, plain-language launch playbooks for newbie vibe coders. See [`README.md`](README.md) for the shared preamble, `PRIVACY_GDPR_GUIDE.md` for the data/privacy half of the law, and `PAYMENTS_GUIDE.md` for subscription billing. **Last reviewed: 2026-06.** Laws, rules, and court rulings change constantly — the official sources above are the source of truth, and **this guide is not legal advice.***
