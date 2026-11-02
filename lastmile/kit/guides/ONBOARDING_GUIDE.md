---
guide: ONBOARDING
anchor: lastmile:module/auth
shape: walkthrough
timing: at-module
lead_time: "none (but under-13 / teen audiences: STOP — COPPA/parental-consent design needs legal review before launch)"
---

# ONBOARDING_GUIDE.md - From First Open to First Win (for Total Newbies)

> Onboarding is the path from a stranger's first open to their first solved problem. The single biggest mistake newbies make is putting a signup wall in front of that win — asking for an email, a name, a password before the user has felt *any* value. This guide is about *when* to ask people to sign up and *what* to collect, so you don't scare off the very users you worked so hard to attract.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split and the secrets golden-rule. This guide is about the *decision* of when to ask; [`AUTH_GUIDE.md`](AUTH_GUIDE.md) covers *how* to wire the actual sign-in (Google, email, magic links) — read it when you're building the screens.

---

## 1. ELI5 - what is onboarding, really?

Imagine a shop. A good shop lets you walk in, browse, pick something up, and feel what it's like — *before* anyone asks for your name. A bad shop has a guard at the door demanding your email, phone number, and date of birth before you're even allowed to look. Most people just turn around and leave.

Onboarding is that doorway. Your app's "doorway" is every screen between someone opening it for the first time and them solving the problem they downloaded it for. Onboarding done well makes that path short and clears every obstacle out of the way.

There is exactly **one doctrine** to internalize, and everything else in this guide flows from it:

> **Optimize for time-to-value. Every field you ask for before the user gets value is a toll booth — and every toll booth loses you people.**

A sharper version, because "ask for less" alone isn't precise enough:

> **Ask for identity or profile data only when it's required for the next value-delivering action, for legal/safety compliance, to protect durable data the user would hate to lose, to take payment, or to let the user interact with other people.** No earlier. No later.

That phrase — "no earlier *and* no later" — is the whole game. Too early and you kill activation. Too late and you can lose people's data, invite abuse, or poison a social product with empty profiles. The rest of this guide is how to find the exact right spot.

---

## 2. The signup-wall decision (this is the big one)

The "signup wall" is the screen that says *"Create an account to continue."* Where you put it is the highest-leverage onboarding decision you'll make.

### The evidence says: usually, put it LATE

The research is one-directional here. Forcing registration in a user's **first session** drives *"immediate uninstalls and poor retention."* Putting your demo or core feature *behind* a signup wall **cuts trial starts by roughly 30-70%**. Each friction point you remove from the path lifts completion by about **3-8%**. *([PARTIALLY VERIFIED] — the direction is rock-solid and echoed across multiple sources; the exact 30-70% and 3-8% ranges are from analyst/vendor write-ups, so treat the *direction* as gospel and the precise percentages as ballpark.)*

There's even a documented anti-pattern worth burning into memory: one product gated an email *before* download. It spiked their *account* numbers — but produced **no more activated or paying users.** They collected emails and learned nothing, because the people behind those emails never came back. Vanity metric up, real business flat.

**The default, then:** let people reach a first win *without* an account. Gate the account at the moment it actually buys the user something — saving their work, syncing to another device, exporting, sharing, or paying.

### The honest counter-cases: where an EARLY wall is right

"Late" is the default, not a law. An early signup wall is the *correct* call when one of these is true:

- **Multi-device continuity is the product.** If losing the user's session would be catastrophic — they'd lose real work — get them an account before they invest effort, so nothing evaporates on a phone wipe.
- **Social / network products where empty or anonymous profiles poison the pool.** On a matchmaker, a marketplace, or a community, anonymous and half-filled profiles degrade the experience for *everyone else*. Here, identity (and a minimum profile) before *visibility* is protecting your liquidity, not taxing your users.
- **Data-sensitive products.** Health, finance, anything regulated — you want an account and consent *before* you start collecting sensitive data, not after.
- **B2B / workspace products.** Workspace membership often *is* the product. A work email and an org up front is the natural first step, not friction.

> **The synthesis:** keep the wall late by default — but put a *meaningful* commitment step exactly at the point where the user is about to capture or protect value (save, sync, publish, pay, or interact with others). That filters for genuine intent without taxing people who are just exploring.

---

## 3. The decision framework (apply this to YOUR product)

Here's a framework you — or your AI assistant — can run mechanically. Answer the hard-stop questions first; if any trip the STOP, go to Section 6 *before* designing anything.

### Step 1 - the hard-stop checks

Ask, in this order:

1. Is the app aimed at **children or teens**?
2. Does it collect **sensitive data** (health, finance, biometrics)?
3. Does it let **users talk to each other** (DMs, comments, matching)?
4. Does it collect **precise location, contacts, photos, voice, or financial data**?
5. Does it involve **payments, payouts, or rewards**?

**If it's children/teens AND any of social / matchmaking / location / user-generated content** → **STOP. Legal and trust-and-safety review before you design onboarding at all.** (Section 6.)

### Step 2 - place the wall and pick the fields

| Your product looks like… | Put the signup wall… | Fields AT signup | Gate later, at point-of-need |
|---|---|---|---|
| User can solve their first problem locally (calculator, single-player tool, AI toy) | After the first value — no wall before it | None, or an anonymous ID | Cloud save, sync, export, subscribe |
| First core action creates durable data they'd hate to lose | Anonymous account *before* the core action; upgrade later | None or minimal | Email/social login at save or sync |
| Social / community / matchmaking | Account *before* visibility, posting, messaging, or matching | Age gate, display name, minimum profile, safety prefs | Bio, avatar, interests, contacts |
| Marketplace **buyer** | Browse as guest | None | Signup + payment + shipping at checkout |
| Marketplace **seller** | Signup before listing | Email, name/business, payout/KYC if needed | Richer shop profile |
| B2B / collaboration | Signup at invite or workspace entry | Work email, name, org | Role, team metadata, integrations |
| Health / finance / sensitive | Account + consent before any sensitive data | Auth, consent, required fields only | Optional personalization later |
| Subscription app | Preview before signup if you can | Account before purchase (entitlement is server-side) | Billing details at the paywall |

The pattern across every row: **the wall sits exactly in front of the first action that genuinely needs identity** — and not one screen sooner.

---

## 4. Progressive profiling (collect the minimum, gate the rest)

"Progressive profiling" is a fancy term for an obvious idea: **ask for the bare minimum your core loop needs at signup, then ask for each additional field at the exact moment the experience needs it** — and let people skip what isn't essential yet.

A field-by-field rule of thumb:

| Field | Ask at signup ONLY if… | Otherwise ask at… |
|---|---|---|
| **Email** | needed for recovery, sync, invites, payment, or moderation | save / sync / pay / share |
| **Phone** | needed for high-trust marketplace, abuse prevention, or 2FA | the high-risk action itself |
| **Display name** | the user will be visible to others immediately | first post / comment / match |
| **Avatar** | trust/social presence needs it | first time their profile is shown |
| **Date of birth / age** | legally required, age-restricted, minors, or dating/social | never ask casually |
| **Location** | needed for local results, safety, shipping, or matching | the "show nearby…" moment |
| **Contacts** | the user *explicitly* chose an invite flow | **never** on first launch |
| **Goals / preferences** | needed to generate the first useful result | before personalization — and allow skip/default |
| **Payment** | the user is buying right now | checkout / paywall |

### The worked example: even an info-hungry product starts minimal

Take a deliberately data-hungry case from the research: a **teen gaming-matchmaker social app**. This product genuinely needs a lot — age, username, game, platform, region, safety settings — because matching *requires* them. (And note: it's also a regulated trust-and-safety product, so read Section 6 first.)

Even here, you don't dump a ten-field form on a 14-year-old at first open. You collect the **minimum needed to make the first match**:

- **At signup:** age band (for the age gate), username, game/platform, region, safety preferences. These are the fields the *first match* can't happen without.
- **Gated later, after they've matched once:** avatar polish, detailed bio, optional interests.

So "this product needs lots of data" never means "ask for everything up front." It means: figure out the *minimum the very first value moment requires*, ask only that, and stage everything else at the screen that actually needs it.

---

## 5. Guest / anonymous mode + account linking (and its footguns)

A guest (or "anonymous") account is the cleanest way to deliver value before asking anyone to sign up. The tools give you a stable, real user ID with no email, no password — the user just *starts using the app* — and later you **link** that anonymous session to a real Google/email/Apple account, carrying their data forward.

What each tool gives you:

- **Firebase Anonymous Auth** — a throwaway-but-stable UID you later upgrade by linking a credential.
- **Supabase `signInAnonymously()`** — same idea; the user's JWT carries an `is_anonymous` claim so your security rules can tell guests apart.
- **Clerk** — has progressive sign-up. *([PARTIALLY VERIFIED] — Clerk's progressive sign-up is confirmed, but a first-class anonymous/guest primitive equivalent to Firebase/Supabase's `signInAnonymously()` was not confirmed in the research; check Clerk's docs directly before betting a guest-first flow on it.)*

### The footguns — these bite at launch, so design for them first

**Footgun 1 — orphaned anonymous data.** The tool tracks the *auth* identity, but **it does not solve your product's data-merge logic.** If you store user data loosely and then upgrade the account wrong, the anonymous rows get stranded, detached from the real account. *Fix:* store everything the user owns under the auth UID from the start, and link transactionally.

**Footgun 2 — merge conflict on linking.** When an anonymous user tries to link to an email or Google account **that already exists**, the system detects a conflict — and a naive flow either loses data or strands the user in limbo. Firebase's own issue trackers are full of this (2018 to present). The resilient pattern is **migrate-the-data-BEFORE-you-sign-in**: merge the anonymous user's data into the destination account *first*, and only complete the sign-in if that merge succeeds. Supabase frames the same job as "reassign entities tied to the anonymous user" and implement an explicit merge/overwrite/custom strategy. *([VERIFIED] — primary-source confirmed in Firebase and Supabase docs.)*

> **The one rule:** if anonymous users can create *valuable* data, build and test the upgrade/merge path **before** launch — not after a user emails you about their lost work.

**Footgun 3 — anonymous-bot abuse flooding your database.** Anonymous sign-in endpoints are easier to script against than OAuth. An attacker can decompile your app, pull the embedded config, and script thousands of anonymous logins — ballooning your database size and cost, and reading anything a too-loose rule like "is authenticated" exposes. *([VERIFIED] — documented proof-of-concept against Firebase anonymous login.)* The mitigations, all of which you should turn on *before* launch:

1. **Bot defense at sign-in:** Firebase **App Check**, or an invisible **CAPTCHA / Cloudflare Turnstile** (Supabase explicitly recommends Turnstile for anonymous sign-ins).
2. **Security rules stricter than "is authenticated":** an anonymous user should be able to touch **only their own** data, never the whole table.
3. **Scheduled cleanup of stale anonymous rows** — there is **no automatic cleanup**. Supabase even gives you the query: delete anonymous users with `is_anonymous = true` older than, say, 30 days. Run it on a schedule.
4. **Rate limits:** Supabase caps anonymous sign-ups at **30 requests/hour per IP** by default — keep a limit like that in place.

**One more, easy to miss — analytics split.** If you don't alias the anonymous ID to the real account ID at link time, the *same person* shows up as two users in your analytics — wrecking your activation and retention numbers. Alias on upgrade.

---

## 6. Teen / minor audiences (read this BEFORE designing anything)

This is the highest-risk corner of onboarding. If your audience includes — or you **cannot rule out** — under-13s, the rules change from "best practice" to "legal obligation," and the penalties are real.

### The law moved, and the deadline has passed

The **amended COPPA Rule** (US, covers children **under 13**) went **effective June 23, 2025**, with a **full-compliance deadline of April 22, 2026** — meaning if you're reading this at or after that date, the obligations are already live. *([VERIFIED] — primary-source dates from the Federal Register and legal analyses.)* The amended rule:

- **Expands "personal information"** to include **biometric identifiers** (fingerprints, face patterns, voiceprints) and **government-issued IDs**.
- Requires **separate verifiable parental consent** for non-core third-party uses like targeted advertising and AI training.
- **Prohibits indefinite retention** of children's data and mandates a written security program.
- For **mixed-audience** services (some kids, some adults), requires **age screening before collecting any personal info** — though you can section off general-audience areas to avoid a blanket age gate.

And it's not just the US: **GDPR-K** (EU) sets a parental-consent age that **varies by member state, anywhere from 13 to 16.** *([PARTIALLY VERIFIED] — the EU range was not enumerated per-country in the research; confirm the specific member-state thresholds before launching to an EU teen audience.)* The UK's Age Appropriate Design Code adds privacy-by-default expectations on top.

### Age-gate design, briefly

- Put the age gate **before** you collect any personal data.
- Make it **neutral** — don't nudge kids toward lying ("you must be 13+" with a prefilled adult birthday teaches the workaround).
- **Don't let an underage user immediately retry** with a different birthday.
- Store the **age band**, not the full date of birth, when the band is all you need.
- **Default minors to private settings**; never auto-upload contacts; never expose precise location.

### 🔴 The hard STOP

> **STOP and get a lawyer / trust-and-safety review before you build onboarding** if your app: targets under-13s; has a mixed kids/teen/adult audience; enables teen matchmaking; allows DMs or user-generated content involving minors; collects precise location, contacts, photos, or audio from minors; uses behavioral ads or tracking on minors; touches schools/education records or minors' health data; or offers cash/rewards to minors.

This isn't onboarding polish you can iterate on after launch — it's a legal gate, in the same severity class as the privacy and legal guides. A teen matchmaker isn't "an app with onboarding," it's a regulated trust-and-safety product that happens to have a sign-up screen. Treat it that way. See [`LEGAL_GUIDE.md`](LEGAL_GUIDE.md) and [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md).

---

## 7. Measurement — the ONE metric that matters first

Founders instinctively track **signup completion**. That's the wrong first metric — it measures the toll booth, not the value. (Remember the cautionary tale from Section 2: account numbers spiked, real users didn't.)

Track **activation rate to first core action** instead:

```text
activation_rate =
  new users who complete the first meaningful core action within the first session or 24h
  ────────────────────────────────────────────────────────────────────────────────────────
  new users who opened the app
```

The "first core action" is product-specific: first task completed (productivity), first successful generation or export (AI tool), first lesson finished (education), first workout logged (fitness), first item saved or checkout started (marketplace), minimum profile + first match/message (social), joined workspace + first collaborative action (B2B).

### Sane target bands

*([PARTIALLY VERIFIED] — these bands are sensible defaults from the research, not hard industry constants; use them to know whether you're roughly on track, not as a pass/fail line.)*

| Product type | Healthy activation band |
|---|---|
| Simple utility | 50-80% |
| AI / productivity | 30-60% |
| Social / matchmaking | 20-45% |
| B2B / complex workflow | 15-40% |

> **The rule of thumb:** if activation is **under 20%** for a consumer app, your onboarding or your core value is broken — **fix that before you add referrals, ads, or any other growth lever.** You can't pour users into a leaky bucket.

**Cross-check with D1 retention** (did they come back the next day?). Strong first-session activation paired with weak Day-1 return means your *first* win landed but there's no reason to come back — a different problem, and a signal to look at your second-session hook. Users who hit a value milestone in their first session retain at roughly **3-5x** the rate of those who don't. *([PARTIALLY VERIFIED] — directionally consistent across sources; the exact multiple is an estimate.)*

---

## 8. Minimum viable onboarding

```
ONBOARDING - MINIMUM VIABLE
[ ] A new user can reach a first "win" WITHOUT creating an account (unless an early-wall counter-case applies)
[ ] The signup wall sits exactly in front of the first action that needs identity (save/sync/pay/share/interact)
[ ] Signup asks ONLY for fields the core loop needs; everything else is gated at point-of-need
[ ] If guest/anonymous mode is used: data is stored under the auth UID, and the anonymous→account merge path is BUILT AND TESTED before launch
[ ] Anonymous abuse defenses are on: App Check / CAPTCHA / Turnstile + strict per-user rules + a scheduled stale-row cleanup
[ ] Anonymous IDs are aliased to account IDs so analytics doesn't double-count
[ ] If minors are possible: age gate before any data collection, minors default to private, and a legal/trust-safety review is DONE
[ ] The first instrumented metric is activation-to-first-core-action, not signup completion
[ ] D1 retention is tracked as a cross-check
```

**Done when:** a brand-new user opens the app, reaches a genuine first win without a wall in the way, is asked to create an account only at the moment it buys them something (saving, syncing, paying, or interacting) — and if they came in as a guest, their work carries over cleanly when they upgrade.

---

## 9. Top newbie mistakes (and the fix)

1. **Signup wall on first launch.** → Move it behind the first value moment; gate the account at save/sync/pay/share.
2. **Asking for "future useful" data up front.** → Collect only what the core loop needs now; gate each extra field at the experience that needs it.
3. **Treating signup completion as your north star.** → Measure activation-to-first-core-action instead.
4. **Building guest mode without the merge path.** → Build and *test* anonymous→account linking before launch; migrate data before sign-in.
5. **Leaving anonymous sign-in undefended.** → App Check / Turnstile + strict per-user rules + scheduled cleanup, or bots flood (and bill) your database.
6. **Storing user data loose, not under the auth UID.** → Orphaned anonymous rows on upgrade; key everything to the UID from the start.
7. **Double-counting guests vs. accounts in analytics.** → Alias the anonymous ID to the account ID at link time.
8. **Casually collecting date of birth, location, or contacts.** → Never on first launch; gate location/contacts behind an explicit user choice; store age *band* not full DOB.
9. **Designing a minors' product like any other app.** → Age gate first, private-by-default, and a legal review before you write the onboarding — full STOP if under-13s are in scope.
10. **A wall too late on a social/data product.** → Empty/anonymous profiles poison liquidity and risk data loss; put the wall before visibility/durable-data for those categories.

---

## 10. Cross-references

- [`AUTH_GUIDE.md`](AUTH_GUIDE.md) — *how* to wire the actual sign-in (Google SSO, email, magic links). This guide is *when* to ask and *what* to collect; that one is the implementation.
- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) — consent records, the data you're allowed to collect, and the minors/sensitive-data rules.
- [`LEGAL_GUIDE.md`](LEGAL_GUIDE.md) — the legal gate for minors, terms, and data declarations.
- [`ANALYTICS_TELEMETRY_GUIDE.md`](ANALYTICS_TELEMETRY_GUIDE.md) — how to instrument the activation event and the funnel this guide tells you to measure.
- [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md) — rate limits, anonymous-abuse defenses, and locking down database rules so guests can only touch their own data.

---

## 11. Official sources

- Supabase — Anonymous Sign-Ins (linking, conflict resolution, rate limit, cleanup): https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase — Security of anonymous sign-ins (CAPTCHA / Turnstile): https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL
- Firebase — Account linking (anonymous upgrade + merge conflict): https://firebase.google.com/docs/auth/android/account-linking
- Clerk — Progressive sign-up: https://clerk.com/docs/upgrade-guides/progressive-sign-up
- FTC — Children's Online Privacy Protection Rule (COPPA): https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- COPPA amended rule (Federal Register text): https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Activation benchmarks vary by category, and privacy law for minors changes and varies by country — treat the percentage bands here as directional, and confirm COPPA / GDPR-K obligations against primary sources before launching anything aimed at, or open to, minors.*
