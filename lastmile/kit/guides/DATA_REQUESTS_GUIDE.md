---
guide: DATA_REQUESTS
anchor: lastmile:module/auth
shape: walkthrough
timing: at-module
lead_time: "none (but statutory clocks start the moment a request ARRIVES — build the queue + flows BEFORE launch)"
---

# DATA_REQUESTS_GUIDE.md — Handling "Show Me My Data" and "Delete Me" Requests (for Total Newbies)

> Your privacy guide (`PRIVACY_GDPR_GUIDE.md`) shows you how to **build** the "Download my data" and "Delete my account" buttons. This guide is the sequel: how to **operate** them once real users start invoking their legal rights — because a button that exists but never runs is the same as no button, and the clock starts the moment a request arrives, not when you feel ready.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split, then read `PRIVACY_GDPR_GUIDE.md` (sections 4.3 / 4.4) for the build-level basics. This guide assumes those are done and focuses on the *operations*: verifying who's asking, the queue, the clocks, honest deletion, and your app-store obligations.

---

## 1. ELI5 — what a data-rights request actually is

A **data-rights request** is a user invoking a *legal right* that comes with a *statutory deadline*. The two that matter for almost every app:

- **"Show me / give me my data"** — the export, also called a **DSAR** (Data Subject Access Request).
- **"Delete me"** — erasure, also called the **right to be forgotten**.

The thing to internalize: **"we'll get to it" is a violation.** Privacy law doesn't say "respond when convenient." It says "respond within one month" (EU) or "within 45 days" (California) — and the countdown begins the second the request lands in your inbox, your in-app form, or even an app-store review. You don't get to start the clock when you finally notice it.

> 🧒 *Newbie note:* You already built the *machinery* (the export button, the delete flow) in `PRIVACY_GDPR_GUIDE.md`. This guide is about the *front desk* — receiving the request, checking it's really them, doing the work, and proving you did it on time. The build is a weekend; getting the operations wrong is a fine.

The single biggest risk, in one sentence: **you either hand a stranger someone else's data (because you didn't verify), or you claim "deleted" while the data quietly lives on in your backups, your analytics tool, and Stripe (because you didn't cascade).** This whole guide is about avoiding those two.

---

## 2. Right-sized identity verification — the part everyone gets backwards

This is the counterintuitive centerpiece, so it goes first. **Your instinct will be wrong.**

The instinct: *"Someone's asking me to delete an account / hand over personal data — I'd better verify hard. Demand a photo of their ID."* That feels responsible. **It's a violation.**

> **The golden rule: over-verification is itself a privacy breach.** Demanding a government ID for an ordinary request breaks **data minimization** — you've now collected a passport scan you never needed, for a request a session check would have covered.

This isn't theoretical. The fines are real and recent:

- **Dutch DPA fined DPG Media €525,000** for requiring an ID copy for *all* data-access requests. *([VERIFIED] — EDPB right-of-access guideline + named enforcement; the original "over-verification" fine.)*
- **California's CPPA fined Honda $632,500** (March 2025) — partly for gating **opt-outs** behind identity verification and making opt-out harder than opt-in. *([VERIFIED] — CPPA enforcement.)*
- **CPPA fined Todd Snyder $345,178** (May 2025) — its privacy portal demanded **government ID for all requests**, including opt-outs. *([VERIFIED] — CPPA enforcement.)*

The law's actual standard (GDPR Art. 12(6), verbatim): you may ask for more identity info only *"where the controller has reasonable doubts concerning the identity"* — **reasonable doubts, not "always ask for ID."** And the EDPB is explicit: *"copies of ID cards should not be considered an appropriate way of authentication."* The method must be *"relevant, appropriate, proportionate."* *([VERIFIED] — GDPR Art. 12(6) + EDPB Guidelines 01/2022.)*

### The verification ladder (use the lightest rung that fits)

| Who's asking | Right-sized verification |
|---|---|
| **Logged-in user** asks to export/delete from inside the app | The authenticated session *is* the verification. For destructive/export actions, add one re-auth step (re-enter password, MFA, or an email confirmation click). |
| **Email request from the account's own email** | Send a **magic link / confirmation** to that same email. If they click it, that's your proof. Reveal nothing extra before they do. |
| **Genuinely sensitive data** (payment history, private messages, health data) | Step *up* one rung: MFA, or a detail only the real user has (a recent invoice ID, last 4 of a card you already store). Still not a passport. |
| **User locked out of the account** | Use the *minimum* evidence that matches them to the account. Government ID only as a genuine last resort. |
| **Someone acting for another** (parent, estate, legal rep) | Escalation path — verify both their authority *and* the user's identity. This is the one case where you slow down. |
| **Something feels off** | Pause, ask for *minimal* extra proof, and **log why** you paused. |

**The default for 95% of requests: the authenticated session, or a tokenized email round-trip.** That's it. Reserve ID for the rare locked-out-of-account-holding-sensitive-data case, and even then ask whether something lighter matches them.

> 🧒 *Newbie note:* The mental model is a coat-check (from the privacy guide). When a regular hands you their own ticket, you give back their coat — you don't demand their driver's license first. The ticket *is* the verification. Asking for ID on top is the thing that gets you fined.

---

## 3. The clocks — when "on time" is legally defined

Different laws, different deadlines, all starting at **request-arrival**:

| Regime | Deadline | The fine print |
|---|---|---|
| **GDPR / UK GDPR** | **1 month** from receipt | Extendable by **2 more months** (3 total) for complex/numerous requests — *but only if you notify the user of the extension inside the first month.* *([VERIFIED] — Art. 12(3) verbatim.)* |
| **CCPA / CPRA** (California) | **45 days** to substantively respond | **Confirm receipt within 10 business days.** Extendable by another **45 (90 total)** with notice. *([VERIFIED] — statute + multiple sources.)* |
| **Other US state laws** (~19 in force or imminent by 2026: Virginia, Colorado, Connecticut, Texas, Oregon, Montana, and more) | Most mirror **45 days + 45-day extension** | The *pattern* is consistent; exact per-state effective dates vary. *([PARTIALLY VERIFIED] — count + clock pattern consistent across sources; confirm a specific state against its AG before relying on it.)* |

### The practical SLA for a solo founder

Don't try to memorize 19 regimes. Use one conservative internal rule:

> **Acknowledge fast (within 48 hours). Fulfill within 30 days. Make it self-serve wherever you can.**

A self-serve "Download my data" / "Delete my account" button (the ones you built in `PRIVACY_GDPR_GUIDE.md` 4.3/4.4) is your best friend here — a request the user fulfills *themselves, instantly* never touches your queue and never risks a missed clock. The queue below is for the requests that *don't* go through self-serve (emailed requests, locked-out users, edge cases).

The safe computed default, if you're ever unsure which regime applies: **30 days for access/export/delete; 15 business days for opt-outs.** Take the stricter of (applicable law, internal default).

---

## 4. The request queue + audit log — your defense, not just your to-do list

A request can arrive *anywhere*: your `privacy@` email, an in-app form, support chat, even an app-store review. **Route them all into one place.** A request you ignored because it came through the "wrong" channel is still a missed deadline.

### The intake

- An **in-app privacy/account page** (the self-serve buttons).
- A **public `privacy@yourdomain.example`** address that a human actually reads.
- The **web deletion link** (required for Android — see Section 6).
- One admin table: **`privacy_requests`**.

### The record

Every non-self-serve request becomes a row with at least these fields:

```
privacy_requests
  received_at     -- the moment it arrived (this starts the clock)
  request_type    -- access / export / delete / opt-out / correct
  verified_at     -- when + how you confirmed identity
  due_at          -- received_at + applicable deadline
  fulfilled_at    -- when you completed it
  status          -- received / verified / in_progress / fulfilled / refused
  systems_touched -- which of your tables + which processors
  exceptions      -- anything retained, and the legal reason
  handled_by      -- which admin
```

**Why the log is your defense:** if a regulator ever asks "did you honor this person's request on time?", the log *is* the answer. `received_at` → `fulfilled_at` inside the deadline, with a verification method recorded, is the difference between "yes, here's proof" and "we think so?". Keep the log itself access-restricted (it contains personal data) and retain it **2–3 years**. *([PARTIALLY VERIFIED] — expert-judgment default; the *need* for a log is well-grounded, the exact retention is a sensible practitioner number.)*

> **🤖 AI CAN DO THIS:** *"Add a `privacy_requests` table with received_at / verified_at / due_at / fulfilled_at / status, and route the privacy@ inbox + in-app form + web deletion link into it as new rows."* The AI builds the queue and the plumbing; **🔴 you** make the judgment calls on the edge-case and "feels-off" requests.

---

## 5. Deletion that's actually honest

This is where "delete" most often becomes a lie. A `deleted = true` flag where the row — and the email — still sits in your database **is not erasure.** Real deletion means one of:

1. **Hard delete** — the rows are gone.
2. **True anonymization** — every identifying field stripped, so what remains can't be tied back to a person (fine if you need aggregate stats).
3. **A short, disclosed soft-delete grace period** (e.g. 7–30 days for "undo"/fraud) that is *followed by* a scheduled hard delete. A soft flag with no hard-delete behind it does not count.

### Cascade across YOUR tables AND your processors

Deleting the user row in your own database does **nothing** to the copies living in the third-party tools you piped their data into. Each processor needs its own deletion method, and you must actually call it:

| Processor | How you delete there |
|---|---|
| **Stripe** (payments) | API (`customer.delete`) or dashboard — but mind the billing-record exception below |
| **Your email tool** (Resend, Postmark, SendGrid…) | API or dashboard contact-delete; add to suppression list |
| **Analytics** (PostHog, Mixpanel, GA…) | Most have a user-deletion API / GDPR-delete endpoint — use it |
| **Push** (Expo/OneSignal…) | Delete the device tokens tied to the user |
| **Auth provider** (Supabase, Clerk…) | Delete the login identity itself (ties to `AUTH_GUIDE.md`) |

Keep a tiny **`processors.yaml`** listing, for each vendor, *how* deletion happens (API / dashboard / email request) — so the cascade is a checklist, not a memory test. Log the deletion request sent and the confirmation received.

> 🧒 *Newbie note:* The classic newbie failure is "I deleted them from Supabase" while their email is still in Mailchimp, their events are still in PostHog, and Stripe still has their customer record. To the user — and the regulator — you did **not** delete them. The cascade is the job.

### The backups answer (the question that stumps everyone)

*"But their data is also in my nightly backups — do I have to surgically tear one user out of a frozen backup the instant they ask?"* **No.** The accepted doctrine (ICO, verbatim) is to put backup data **"beyond use"**:

> "the key issue is to put the backup data 'beyond use' … the backup is simply held on your systems until it is replaced in line with an established schedule." *([VERIFIED] — ICO primary source.)*

So the honest, accepted practice is a **rolling-window** delete:

- Delete from **live systems immediately.**
- Let **backups age out** on their normal retention schedule (a sensible default: **30–60 days**, up to 90 if you can justify it). *([PARTIALLY VERIFIED] — the rolling-window doctrine is VERIFIED; the specific day-counts are practitioner defaults, not a fixed legal number — ICO says "an established schedule," not "30 days.")*
- **Never restore a deleted record** from an old backup. If you *do* restore a backup for other reasons, re-apply the deletion before it goes back to production.
- **Disclose the window** in your privacy policy ("deleted data is purged from live systems immediately and from backups within N days").

One caveat to carry: the EDPB's 2026 review flagged that many controllers have *no* backup-deletion procedure, and is scrutinizing exactly this. So the latitude exists — but **"we have no backup-deletion process" is the failing answer.** Document your schedule. *([VERIFIED] — EDPB CEF report.)*

### Legal exceptions — keep narrowly, and say so

You're allowed to retain *some* data even after a deletion request, where the law requires it (GDPR Art. 17(3)): **billing/tax/invoice records** (commonly ~6–7 years US, longer for EU VAT — *jurisdiction-specific, confirm against local tax law*), fraud/chargeback records, and anything under an active legal hold. *([PARTIALLY VERIFIED] — the *existence* of the exception is VERIFIED; the year-counts are jurisdiction-specific defaults.)*

The discipline: retain **only the narrow slice** the law requires, **segregate/flag it**, keep it out of product and marketing use, and **disclose it honestly** in your policy. "We delete your account data, but retain invoices for 7 years as required by tax law" is a true, fine sentence. Keeping the whole user record "just in case" is not.

> **🔴 YOU decide the policy** (hard-delete vs anonymize, the grace-period length, exactly which records you retain and why). **🤖 The AI implements** the cascade, the scheduled hard-delete job, and the seeded-user deletion test that proves the user is gone from every mapped store.

---

## 6. Store mandates — the app-review blockers

This is not optional, and it's not just privacy law — it's **app-store policy**, enforced at review. Get it wrong and your submission is **rejected** (Google rejected ~2M apps in 2025).

### Apple — Guideline 5.1.1(v) (verbatim)

> "If your app supports account creation, you must also offer account deletion within the app." *([VERIFIED] — Apple primary source.)*

And the operational detail from Apple's support page:

> "Offer to delete the entire account record, along with associated personal data … only offering to temporarily deactivate or disable an account is insufficient." And: don't send users on a "phone call, send an email, or go through other support flows" (unless you're a highly-regulated industry). Apps using Sign in with Apple must use the **Sign in with Apple REST API to revoke user tokens.**

So: **in-app, finds-it-easily, deletes-the-whole-record, not just "deactivate."**

### Google Play (verbatim) — stricter: needs BOTH

> In-app path must be prominent: "the pathway should be prominent (for example, within the account settings)." **Plus** a web link: "provide a web link resource where users can request app account deletion" — usable "without sending the user back to the app." **And** you must declare it: "you must disclose if your app provides account deletion and provide the web link within your Data safety form in Play Console." *([VERIFIED] — Google primary source.)*

The difference, stated plainly:

| | In-app delete | Web deletion link | Declared in form |
|---|---|---|---|
| **Apple** | Required | — | (privacy label) |
| **Google Play** | Required | **Required** | **In the Data Safety form** |

> **🔴 YOU MUST DO THIS:** create the **web deletion link** (a public URL where a user can request deletion without re-downloading the app), and **enter it in the Play Console Data Safety form.** "If there are issues with your answers to the Data deletion questions … new submissions and app updates will be rejected." This is the single most common solo-founder launch blocker in this whole area.

---

## 7. Retention schedule — the one-sentence reason it matters

Data you no longer hold **can't breach, can't be subpoenaed, and shrinks every future DSAR.** Keeping everything forever turns a small incident into a massive historical exposure and turns every export request into a giant dig. So set sane defaults and let data age out:

| Data category | Sane newbie default |
|---|---|
| Active account profile | While account active; delete/anonymize within 30 days of a deletion request |
| App / error logs | 14–30 days; scrub personal data |
| Security / audit logs | 90–365 days, access-restricted |
| AI prompts / outputs | Don't store by default, or 7–30 days for abuse/debug |
| Analytics events | 6–13 months, then aggregate/delete — avoid user-level analytics forever |
| Deleted-account residue (backups) | Age out at the next 30–60 day backup cycle |
| Marketing consent records | While subscribed + 2–4 years; unsubscribe-suppression kept as needed |
| Privacy request log | 2–3 years |
| Invoices / tax | ~7 years US (longer for EU VAT) — the narrow legal-hold exception |
| Payment card data | **Never store it** — let Stripe / the app store hold it |

*([PARTIALLY VERIFIED] — these are expert-judgment defaults, not fixed legal numbers; the *principle* (minimize + schedule) is solid, the specific durations are sensible starting points to confirm against your jurisdiction.)*

> **The one rule to remember:** *if you can't say why a category of personal data is still needed, delete it, anonymize it, aggregate it, or move it to a narrow compliance-retention bucket.* Ask the AI to build a `retention_schedule.yaml` and wire it to your database TTLs, log retention, and deletion job so the schedule isn't just a document.

---

## 8. Who does what — the human-vs-AI split

| Task | Who | Why |
|---|---|---|
| Decide the **deletion policy** (hard vs anonymize, grace period, what you retain) | 🔴 **YOU** | A policy commitment about your real app |
| Sign the **DPAs** with each processor (covers their deletion duties) | 🔴 **YOU** | Only the account owner can accept a contract |
| Answer **edge-case + "feels-off"** requests (locked-out users, reps, suspicious ones) | 🔴 **YOU** | Judgment calls a checklist can't make |
| Make the final **"is this a breach / do I refuse this request"** call | 🔴 **YOU** | A legal judgment — never let the AI conclusively decide "no action needed" |
| Create the **web deletion link** + fill the **Play Data Safety form** | 🔴 **YOU** | Done in your Play Console with your credentials |
| Build the **`privacy_requests` queue** + intake routing | 🤖 **AI** | Standard table + plumbing |
| Build the **deletion cascade** across your tables + processor APIs | 🤖 **AI** | Normal integration work |
| Build the **seeded-user deletion test** (proves the user is really gone) | 🤖 **AI** | A test, not a decision |
| Wire **re-auth / email-token** verification on export + delete | 🤖 **AI** | Conditional auth logic |
| Build the **backup rolling-window** purge + `retention_schedule.yaml` enforcement | 🤖 **AI** | Scheduled job + config |

> **Golden rule:** the AI can *build* every flow, queue, cascade, and test here. But the **policy decisions, the signed DPAs, and the edge-case requests are yours** — and the AI must **flag** a possible legal duty, never conclusively decide one away.

---

## 9. Minimum viable setup

```
DATA REQUESTS — MINIMUM VIABLE
[ ] Self-serve "Download my data" + "Delete my account" live (from PRIVACY_GDPR 4.3/4.4)
[ ] Verification is RIGHT-SIZED: session / email-token default; NO government ID for ordinary requests
[ ] A privacy@ address a human reads + an in-app form, both routed into the queue
[ ] privacy_requests table logs received_at / verified_at / due_at / fulfilled_at / status
[ ] Internal SLA: acknowledge <48h, fulfill <30 days
[ ] Deletion is honest: hard-delete or true anonymization (no soft-flag-only)
[ ] Cascade deletes across YOUR tables AND every processor (processors.yaml lists the method)
[ ] Backups: rolling-window purge, disclosed in the policy, deleted records never restored
[ ] Legal exceptions (invoices/tax) kept narrowly, segregated, and disclosed
[ ] Apple: in-app account deletion deletes the WHOLE record (not "deactivate")
[ ] Google Play: in-app delete + WEB deletion link + declared in Data Safety form
[ ] retention_schedule.yaml set + wired to TTLs / log retention / deletion job
```

**Done when:** a real user can export or delete themselves self-serve and instantly; an emailed request becomes a logged, deadline-tracked ticket verified the light way; a deletion truly removes them from your database *and* Stripe *and* your email tool *and* analytics; your backups age the record out on a disclosed schedule; and your Play submission passes because the web deletion link is in the Data Safety form.

---

## 10. Top newbie mistakes (and the fix)

1. **Demanding government ID to verify a routine request.** → It's a violation (DPG Media, Honda, Todd Snyder). Verify via session or email token; reserve ID for genuine locked-out + sensitive cases.
2. **Starting the clock when you notice, not when it arrived.** → The deadline runs from `received_at`. Log arrival immediately.
3. **Ignoring a request because it came through support / an app-store review.** → Route *every* channel into the one queue.
4. **"Delete" = `deleted = true` while the row + email live on.** → Hard-delete or truly anonymize; a soft flag must be followed by a scheduled hard delete.
5. **Deleting from your DB but not from Stripe / email / analytics.** → Cascade across every processor; keep `processors.yaml` so it's a checklist.
6. **Panicking about backups and either ignoring deletion or promising the impossible.** → Rolling-window: live now, backups age out on a disclosed schedule, never restore a deleted record.
7. **Keeping the whole user record "for tax reasons."** → Retain only the narrow legal slice (invoices), segregated and disclosed — not everything.
8. **Apple: offering only "deactivate."** → Must delete the whole record in-app.
9. **Google Play: in-app delete but no web link / not in the Data Safety form.** → Both are required; the missing form answer gets your update rejected.
10. **No log.** → Without `received_at → fulfilled_at` proof, you can't show you complied. The log is the defense.
11. **Letting the AI decide "no action needed."** → The AI flags; you (or counsel) make the final legal call.

---

## 11. Cross-references

- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) — sections 4.3 / 4.4 build the export + delete features this guide *operates*; section 4.6 covers the processor DPAs.
- [`AUTH_GUIDE.md`](AUTH_GUIDE.md) — deleting the login identity itself; re-auth for verifying destructive requests.
- [`DATABASE_GUIDE.md`](DATABASE_GUIDE.md) — the cascade/anonymization query patterns and the backup schedule.
- [`EMAIL_GUIDE.md`](EMAIL_GUIDE.md) — suppression lists; honoring unsubscribe as its own opt-out request.
- [`APP_STORE_GUIDE.md`](APP_STORE_GUIDE.md) — Apple privacy labels; the in-app account-deletion review requirement.

---

## 12. Official sources

- **Apple — Offering account deletion in your app:** https://developer.apple.com/support/offering-account-deletion-in-your-app/
- **Apple — App Store Review Guidelines (5.1.1(v)):** https://developer.apple.com/app-store/review/guidelines/
- **Google Play — Account deletion requirements:** https://support.google.com/googleplay/android-developer/answer/13327111
- **GDPR Art. 12 (DSAR clock, fee, identity doubts):** https://gdpr-info.eu/art-12-gdpr/
- **GDPR Art. 17 (right to erasure + exceptions):** https://gdpr-info.eu/art-17-gdpr/
- **ICO — Right to erasure ("beyond use" backups):** https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
- **EDPB — Guidelines 01/2022 on data subject rights (right of access / ID proportionality):** https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf
- **California CPPA (CCPA/CPRA regulator + enforcement):** https://cppa.ca.gov/

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. The verification-is-over-collection rule, the store mandates, and the GDPR/ICO doctrines are primary-source verified; statutory day-counts and per-state effective dates move, and retention durations are sensible defaults — check the official sources above and your jurisdiction before launch. This is an operations playbook, not legal advice; for health/finance/children/biometric data, see the red box in `PRIVACY_GDPR_GUIDE.md` and get a lawyer.*
