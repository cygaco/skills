---
guide: INCIDENT_RESPONSE
anchor: lastmile:module/security
shape: checklist
timing: at-module
lead_time: "none (but the GDPR 72-hour clock starts at AWARENESS — write the runbook and collect the contacts BEFORE launch)"
---

# INCIDENT_RESPONSE_GUIDE.md — Your Worst Day, on a Checklist Instead of in a Panic (for Total Newbies)

> Something leaked. A bucket was public, a key got stolen, a vendor emailed you "we had a security incident." This guide is the plan you follow when that happens — and, more importantly, the **short list of things you set up *before* it happens** so the worst day runs on a checklist instead of blind panic. The law does not punish *having* an incident nearly as hard as it punishes **hiding one**, **being unable to show what you did**, or **missing a deadline you didn't know was running**.
>
> **New here?** Read [`README.md`](README.md) once for the 🔴 YOU / 🤖 AI split and the "do the slow stuff on day zero" rule — this guide doesn't repeat them. The **prevention** side (RLS, secrets, rate limits, backups) lives in [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md); this guide is what you do **after a lock fails**, not how to set the locks.

---

## 0. ELI5 — what an "incident" actually is, and the one rule that matters

An **incident** is when data you hold **escapes your control** — someone saw, copied, or could have copied information they weren't supposed to. A "breach" is the legal version of the same thing: personal data (names, emails, messages, anything that identifies a person) got exposed, stolen, or even just *possibly* accessed by the wrong people.

Here's the part newbies get backwards. You assume the danger is **the breach itself**. The danger regulators actually punish is **what you do next**:

> **The whole game: a regulator forgives an honest, well-handled incident far more readily than a hidden or fumbled one.** The expensive mistakes are *missing the notification clock*, *wiping the evidence before you looked at it*, and *deciding "it was probably fine" with nothing written down.*

And there's a clock you can't see. Under EU/UK law (GDPR Article 33), your **72-hour deadline to notify the authority starts the moment you become *aware*** of a breach — **not** when you finish investigating. So if your plan is "I'll figure out what to do when it happens," the clock is already burning while you read the manual. *[Confidence: HIGH — Art. 33(1) verbatim: notify "without undue delay and, where feasible, not later than 72 hours after having become aware."]*

That's why this is a **checklist guide with a "do it now" half**. The single most valuable thing you can do is **prepare before launch**, so let's start there.

---

## 1. The prepare-now checklist (do this BEFORE you launch)

These take an afternoon and they're the difference between "a bad week" and "a regulator asking why you can't answer basic questions." None of it is glamorous. All of it is cheap now and priceless during an incident.

| Task | Who | Mark |
|---|---|---|
| **Write the one-page runbook** (Section 2) and save it where you'll find it at 2 a.m. — not buried in the repo | 🔴 **YOU** | the whole point of this guide |
| **Build the "who to call" list** (Section 1a) and keep it *outside* the systems that might be down | 🔴 **YOU** | you can't look up a contact in a system that's on fire |
| **Logging that can answer "what, when, whose"** — audit events for logins, admin actions, exports, data access, webhook processing | Assistant | 🤖 |
| **Don't log secrets** into those same logs (tokens, reset links, full PII) — or your evidence becomes a second breach | Assistant | 🤖 |
| **Evidence-preservation habit:** know how to *snapshot* a server/bucket/DB **before** you rebuild it (Section 3) | 🔴 **YOU** + 🤖 | the #1 thing newbies destroy |
| **Backups exist AND a test restore has been done** — a backup you've never restored is a guess | 🔴 **YOU** | also in SECURITY_GUIDE; it's load-bearing here too |
| **Admin-access audit:** you know exactly who/what has admin or `service_role`-level access, and MFA is on for all of it | 🔴 **YOU** | so you can tell "the attacker" from "me" |
| **A breach-assessment template** ready to fill (Section 4) — the questions you'll be too rattled to invent live | 🔴 **YOU** + 🤖 | turns panic into form-filling |

> 🧒 *Newbie note:* You are not preparing because you expect to be hacked. You're preparing because the **first 72 hours decide the legal outcome**, and you will not be thinking clearly in them. The runbook is the fire-escape plan taped to the wall — you write it calm so you can follow it scared.

### 1a. Your "who to call" list (build it now)

When something breaks, you do **not** want to be Googling "Supabase security contact" with your heart pounding. Collect these once and keep them somewhere reachable even if your app/email is down (a notes app on your phone, a printed card):

- **Your own emails** — the founder/security inbox an outsider would email to report a bug, and where you'll *receive* vendor breach notices. Publishing `/.well-known/security.txt` (a security-contact file — see SECURITY_GUIDE) means researchers tell *you* before they tell the internet.
- **Each processor's security page + breach contact.** A "processor" is any vendor that holds your users' data for you — Supabase, Stripe, your email sender, your host, your analytics tool, your LLM provider. Bookmark each one's **status page** and **security/incident contact** now. Their job is to tell *you* fast (Section 5); make sure they *can*.
- **A breach lawyer you identified BEFORE needing one.** You don't retain them now — you just know *who you'd call*. The notify/don't-notify decision (Section 4) is a legal call, and "find a privacy lawyer" is not a thing you want to start on hour 60 of a 72-hour clock.
- **Your insurer, if you have cyber insurance** (Section 6) — many policies *require* you to notify them fast and may *void coverage* if you hire your own forensics/lawyer before calling them.

> 🔴 **Only you can do this part.** It's your accounts, your relationships, your legal entity. The AI can scaffold the logging and the templates; it cannot pick your lawyer or hold your Stripe relationship.

---

## 2. The runbook itself (detect → contain → assess → notify → document)

This is the one-page plan, sized for **one person**. Print it. The order matters, and one golden rule overrides convenience.

> 🔴 **GOLDEN RULE: contain the bleeding, but PRESERVE THE EVIDENCE first.** Your instinct will be to *wipe and redeploy* — nuke the server, restore a clean backup, make the bad thing go away. **Do not.** If you destroy the compromised state before snapshotting it, you can no longer answer "what was accessed, when, and whose data?" — and that answer is exactly what the law, your users, and your lawyer need. **Snapshot, *then* rebuild.** (See Section 3.)

**The six steps, in order:**

1. **DETECT — write down what you know.** What happened? Who reported it (you, a user, a researcher, a vendor)? **When did you become aware?** Write that timestamp down *first* — it starts every clock. *[HIGH — "awareness" is the legal trigger, Art. 33(1).]*
2. **CONTAIN — stop more data leaving, without destroying evidence.** Rotate the leaked keys/secrets, revoke active sessions (kick the attacker out), disable the compromised account, patch the open rule (e.g. the missing RLS policy or public bucket). Pause AI endpoints if a stolen key is running up a bill. *Containment ≠ deletion* — you're closing the door, not burning the house.
3. **ASSESS — figure out the blast radius** (Section 4). What personal data was involved? Was it encrypted or plaintext? Whose data, and in which countries/US states? Any high-sensitivity data (passwords, payment info, health, biometric, minors)?
4. **DECIDE the notification path** (Section 4). Authority? Users? US state AGs? App stores/vendors? **This decision tree's hard calls are a 🔴 lawyer decision — your job is the facts, not the verdict.**
5. **NOTIFY if required** — using a template, sticking to verified facts, never speculating beyond what you know.
6. **DOCUMENT everything — *even if you decide no notice is required*.** Write down what happened, what you assessed, what you decided, and *why*. GDPR requires you to keep a record of **all** breaches, including the no-notify ones. "We decided it was fine" with nothing behind it is the answer that gets you fined. *[HIGH — Art. 33(5) requires documenting all breaches.]* Then do a short **postmortem**: root cause, the fix, how you prevent a repeat.

> 🧒 *Why "contain but don't wipe" trips everyone:* a normal bug, you fix by redeploying clean. A *security incident*, redeploying clean **erases the crime scene**. The discipline is unnatural — you have to *resist* the urge to make it disappear — which is exactly why it's written down where you'll see it under stress.

---

## 3. Preserve evidence — the snapshot habit

When a lock fails, "what exactly happened" lives in transient places that a rebuild destroys: server state, logs, the contents of a bucket, database rows, the vendor's email. The move is to **capture them before you change them.**

| Task | Who | Mark |
|---|---|---|
| **Snapshot before you rebuild** — take a DB snapshot / disk image / bucket copy of the compromised state *before* restoring or redeploying | 🔴 **YOU** + 🤖 | irreversible if you skip it |
| **Do NOT delete logs** — even if they're noisy or embarrassing; they're how you prove scope | Assistant | 🤖 |
| **Save every vendor notice** (email, status-page screenshot, support ticket) with its timestamp | 🔴 **YOU** | the vendor's timeline becomes part of yours |
| **Freeze, don't fix-in-place** — copy the affected config/data aside; investigate the copy | Assistant + 🔴 | so containment doesn't overwrite the truth |

> ⚠️ **The mistake that quietly makes the breach worse:** you panic, run "wipe and redeploy from a clean backup," and feel relieved. But now you genuinely **cannot say** whether 5 users or 50,000 were affected, or what was taken — so you can't right-size the notification, and a regulator reads "couldn't determine scope" as either negligence or concealment. Thirty seconds of `snapshot` first is what keeps a contained incident *small*.

> **Cross-link:** the backups/PITR + tested-restore items live in [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md)'s "Assume one lock fails" section — that's where you *set up* the ability to snapshot and restore; here you *use* it.

---

## 4. Who you must notify (the decision tree)

This is where a small incident becomes a legal one. Two truths up front:

> 🔴 **The notify / don't-notify call is a LAWYER decision, not a founder decision.** The thresholds below are *real* but they hinge on words like "risk" and "high risk" that have legal meaning. **Your job is to assemble the facts and the timeline** (what data, encrypted or not, how many people, which jurisdictions) **and hand them to counsel** — *not* to conclude "we decided it was fine" on your own. Deciding "no notice required" solo, and being wrong, is the expensive path.

> ⏱️ **The clock is already running.** For EU/UK, it started the moment you became *aware* (Section 2) — **not** when your investigation finishes. "We were still investigating" is the single most common reason apps blow the 72-hour deadline. Notify on what you know, supplement later — the law explicitly allows phased notification.

### GDPR / UK GDPR (EU or UK users) — the two-tier test

There are **two different thresholds**, and many breaches clear the first but not the second:

- **Notify the supervisory authority** (your EU lead Data Protection Authority, or the UK ICO) **within 72 hours of awareness** — **unless** the breach is *"unlikely to result in a risk to the rights and freedoms of natural persons."* If you're late, you must give reasons for the delay. *[HIGH — Art. 33(1) verbatim: "unless the personal data breach is unlikely to result in a risk."]*
- **Notify the affected users** **only** when the breach is *"likely to result in a **high** risk."* This is a *higher* bar — lots of breaches need an authority notice but not a user notice. *[HIGH — Art. 34(1) verbatim.]*

There are carve-outs to the **user** notice (Art. 34(3)): you may not have to tell users individually if the data was rendered **unintelligible** (e.g. strong encryption), if you took follow-up measures so the high risk *"is no longer likely to materialise,"* or if individual notice would take *"disproportionate effort"* (then a public notice can suffice). *[HIGH — Art. 34(3) verbatim.]* Encryption is the founder's friend here: encrypted-at-rest data that leaks is far less likely to trigger user notice.

> 🧒 *The two-tier rule in one line:* **regulator ≈ "could this hurt someone?" → tell them. Users ≈ "is this *likely* to hurt them, badly?" → tell them too.** When in doubt on the *user* notice, ask the lawyer — over-notifying users has its own costs (panic, churn), and the bar is deliberately high.

### US — the 50-state patchwork (the practical playbook)

There is **no single US federal breach law for ordinary consumer apps.** Instead, **all 50 states + DC** have their own breach-notification laws, and you generally notify **per the state each affected person resides in.** *[HIGH — all 50 states have laws; M-H on exact per-state details, confirm against the specific statute.]* The practical shape:

- **Trigger:** most state laws fire when **unencrypted personal information** of their residents was (or may have been) acquired by an unauthorized party. *Encrypted* data often falls outside the trigger entirely — another reason to encrypt.
- **Deadlines vary:** roughly **30–60 days** in the states that set a number; **CA, CO, FL, NY, WA use ~30 days.** *[M — aggregators consistent; confirm per state.]*
- **AG notification thresholds:** several states require you to also notify the **state Attorney General** above a resident count — commonly **500+ residents** (e.g. California, Florida, New York's SHIELD Act). *[H for CA/FL/NY; confirm the exact number per state.]*
- **The maintained references** (don't try to memorize 50 laws): the **Foley & Lardner "State Data Breach Notification Laws"** chart and the **Privacy Rights Clearinghouse 50-State Survey** are kept current — pull the exact rule for the states you actually have users in. *[HIGH — these sources exist and are maintained.]*

> ⚠️ **Silence is not a strategy — it's exposure.** Beyond state laws, the **FTC** treats covering up a breach (or sitting on it) as a deceptive/unfair practice, and state AGs pursue the same. "We'll quietly fix it and hope nobody notices" is how a contained technical problem becomes an enforcement action. The honest, timely notice is almost always the cheaper path.

| Task | Who | Mark |
|---|---|---|
| Assemble the **facts + timeline** (data type, encryption, count, jurisdictions, aware-at time) | 🔴 **YOU** + 🤖 | this is your job, always |
| Hand the assessment to **a lawyer** for the notify/don't-notify call | 🔴 **YOU** | never decide "no notice" solo |
| If notifying users: send **factual, non-speculative** notice (template ready, no guessing) | 🔴 **YOU** + 🤖 | sticking to verified facts protects you |
| **Document the decision and its reasons** — including a decision *not* to notify | 🔴 **YOU** | required even for no-notice breaches |

---

## 5. When the breach is your vendor's (processor breach)

Most solo-founder "breaches" won't be your code — they'll be a **vendor** (Supabase, Stripe, your email sender, your host, your LLM provider) emailing *you* that *they* had an incident. Two things newbies get wrong here:

1. **"It was their server, so it's their problem."** It isn't. Those vendors are your **processors** — they hold your users' data *on your behalf*. Their legal duty is to **notify *you*** (the "controller") **without undue delay**; **your** duty to authorities and users **does not disappear** because the server was theirs. *You* are still the one who decides and sends the user/authority notices for the data you control. *[HIGH — Art. 33(2) verbatim: the processor "shall notify the controller without undue delay"; Art. 28 requires this be in your written contract with them.]*
2. **Your 72-hour clock starts when *you* become aware** — i.e. when the vendor tells you (or when you otherwise find out). So the speed of *their* notice directly affects *your* deadline. This is why Section 1a says collect their breach contacts now and confirm your data-processing agreement (DPA) covers breach notice.

**What to do when a vendor reports an incident — step by step:**

1. **Save the notice** with its timestamp (this is now Day 0 of your clock).
2. **Ask the vendor, in writing, for the facts you need to assess:** which data categories, which of *your* users/accounts, what timeframe, was it encrypted, what they've done to contain it, and **whether they will notify anyone (your users/regulators) directly** — usually they won't; that's on you.
3. **Determine the vendor's role for the affected data.** Most are pure processors. Note: **Stripe** can act as a *processor* for some merchant data but an *independent controller* for some payment/compliance data — so for a payment-related incident, coordinate messaging and confirm who notifies whom. *[HIGH — Stripe's dual role; M on exact split, confirm in your Stripe DPA.]*
4. **Run the same assess → decide → notify → document flow** (Sections 3–4) for the data *you* control. The vendor handling *their* obligations does not discharge *yours*.

> 🧒 *Newbie note:* Think of a processor as a warehouse you rent to store your customers' boxes. If the warehouse gets broken into, the warehouse tells *you* — but **you're** the one your customers trusted with their boxes, so **you're** the one who has to tell them. "The warehouse should call them" is not how it works.

---

## 6. Cyber insurance — the honest verdict

Should a solo newbie founder buy cyber insurance before launch? The right-sized answer:

- **Not a launch blocker for a tiny, low-risk app.** If you're pre-revenue with a handful of users and no sensitive data, it's a "later," not a "now."
- **Worth seriously considering once you have meaningful revenue, B2B customers, sensitive data (health/biometric/financial/minors), or contracts that *require* you to carry it.** That's the point where an incident gets expensive enough that insurance earns its premium.
- **Its real value isn't the payout — it's the *response*.** A good cyber policy pays for the exact things you can't do alone at 2 a.m.: **breach counsel** (the lawyer from Section 4), **forensics** (figuring out scope), **notification costs**, and **credit monitoring** for affected users.

> ⚠️ **If you do have a policy, read the fine print *before* an incident:** many require you to **notify the insurer fast** and may **deny coverage if you hire your own lawyer/forensics first.** That's why "your insurer" is on the Section 1a call list — calling them is sometimes step one, not step five.

---

## 7. Done when (the gate)

You're ready to launch — from an incident-response standpoint — when **all** of these are true:

```
INCIDENT RESPONSE — MINIMUM VIABLE
[ ] One-page incident runbook is WRITTEN and saved where you'll find it under stress (🔴)
[ ] "Who to call" list exists OUTSIDE the systems that might be down:
      your security inbox · each processor's breach contact/status page ·
      a breach lawyer you've identified · your insurer (if any) (🔴)
[ ] Logging can answer "what was accessed, when, whose data" — and does NOT log secrets/PII (🤖)
[ ] You know how to SNAPSHOT a server/DB/bucket before rebuilding (evidence-preservation) (🔴 + 🤖)
[ ] Backups exist AND a test restore has been done at least once (🔴)
[ ] Admin/service_role access is audited and MFA-protected — you can tell "attacker" from "you" (🔴)
[ ] A breach-assessment template is ready: aware_at · data categories · encrypted? ·
      affected users · jurisdictions · notification decision · counsel escalated (🔴 + 🤖)
[ ] You understand: the 72h clock starts at AWARENESS, and the notify call is a LAWYER decision (🔴)
```

**Done when:** the day something leaks, you reach for a written plan — snapshot the evidence, contain the bleeding, fill in the assessment template, call the people on your list, and let your lawyer make the notify call on a timeline you started on hour zero — instead of inventing all of that while a 72-hour clock burns.

---

## 8. Top newbie mistakes (and the fix)

1. **Wiping and redeploying before snapshotting.** → You destroy the only evidence of scope. **Snapshot first, *then* rebuild** (Section 3).
2. **Missing the 72-hour clock because "we were still investigating."** → The clock starts at **awareness**, not at investigation-complete. **Notify on what you know; supplement later** (Section 4).
3. **Emailing all your users in a panic before you have facts.** → You create churn and may misstate scope. **Assess first, send factual notice, never speculate.**
4. **Deciding "no notice required" by yourself.** → If you're wrong, it's the expensive path. **The notify call is a lawyer's; your job is facts + timeline** (Section 4).
5. **Silence as a strategy.** → Hiding a breach is its own FTC/state-AG violation, worse than the breach. **Honest + timely is the cheaper path.**
6. **"It was the vendor's server, so it's their problem."** → Your duty to your users doesn't transfer. **You still assess, decide, and notify for the data you control** (Section 5).
7. **No "who to call" list — Googling a security contact mid-crisis.** → Collect contacts (and a lawyer) **before** you need them (Section 1a).
8. **Logs full of tokens but no "who did what."** → Useless for scope, *and* a second breach. **Log audit events; redact secrets** (Section 1).
9. **A backup nobody ever restored.** → It's a guess, not a safety net. **Test-restore once before launch** (Section 1, SECURITY_GUIDE).
10. **No record of a no-notify breach.** → "We decided it was fine" with nothing behind it fails an audit. **Document every breach and the reasoning, even the ones you don't report** (Section 2).

---

## 9. Cross-references

- [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md) — the **prevention** half: RLS, secrets, rate limits, the backups/PITR + tested-restore setup, and the audit-logging this guide depends on. That guide stops the lock from failing; this one handles the failure.
- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) — consent, the privacy policy, and the data export/delete mechanics; your privacy policy is also where you disclose data-retention practices that matter when assessing a breach.
- [`DEPLOYMENT_INFRA_GUIDE.md`](DEPLOYMENT_INFRA_GUIDE.md) — rollback and where your secrets/keys live (what you'll rotate during containment).
- [`LEGAL_GUIDE.md`](LEGAL_GUIDE.md) — your LLC, terms, and the legal-entity context behind "who is the lawyer's client."

---

## 10. Official sources (rules change — re-check before relying)

- **GDPR Art. 33 — breach notification to the authority (72h):** https://gdpr-info.eu/art-33-gdpr/
- **GDPR Art. 34 — communication to the data subject (high risk):** https://gdpr-info.eu/art-34-gdpr/
- **GDPR Art. 28 — processor contract / breach-assistance terms:** https://gdpr-info.eu/art-28-gdpr/
- **UK ICO — Personal data breaches: a guide:** https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/
- **Foley & Lardner — State Data Breach Notification Laws (maintained 50-state chart):** https://www.foley.com/insights/publications/2026/03/state-data-breach-notification-laws/
- **Privacy Rights Clearinghouse — Data Breach Notification Laws 50-State Survey (2026):** https://privacyrights.org/resources/data-breach-notification-laws-50-state-survey-2026-edition
- **FTC — Data Breach Response: A Guide for Business:** https://www.ftc.gov/business-guidance/resources/data-breach-response-guide-business

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Breach deadlines, AG thresholds, and the per-state patchwork change frequently — treat the 72-hour GDPR clock and "the notify call is a lawyer's" as the durable rules, and confirm the per-jurisdiction specifics against the sources above (and your own lawyer) before you rely on them. This guide is not legal advice.*
