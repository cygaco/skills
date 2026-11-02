---
guide: DEV_SETUP
anchor: lastmile:day-zero
shape: checklist
timing: project-start
lead_time: "Apple ~2d payment+verify; Google Play identity review hours-days; Play 12-tester / 14-day closed test; D-U-N-S days-weeks"
---

# DEV_SETUP_GUIDE.md — Developer accounts & app-store registration

> **Part of the lastmile launch guides** (`.claude/lastmile/guides/`). Read **`README.md`** first — it has the shared *"what only YOU can do vs your AI"* rule, the secrets golden-rule, and the day-zero timing principle.
>
> **Who this is for:** you're ready to publish on the **Apple App Store** and/or **Google Play Store** and need the developer accounts set up. Plain language, from zero.
>
> **Looking for sign-in?** "Sign in with Google / Apple", email signup, and magic links are covered in **`AUTH_GUIDE.md`**.

---

## 1. The two store accounts (read once)

To publish a mobile app you register as a developer with each store you target. They are separate, paid, and have **approval waits** — so start them on **day zero** (see `README.md` → the day-zero rule).

| Account | Cost | First-time setup | Approval / wait |
|---|---|---|---|
| **Apple Developer Program** | **$99 / year** | ~30 min to apply | Apple may take **up to ~2 days just to process the payment**, then 24–48 h to verify (individual); 1–4 weeks (organization, needs D-U-N-S) |
| **Google Play Console** | **$25 once** | ~30 min to apply | Identity check: hours–days. **Then new personal accounts must run a 14-day, 12-tester closed test before going live** (Part 3 — the #1 surprise) |

> 🧒 Two confusingly-named Google sites: **Google Play Console** (the Android *store*, here) vs **Google Cloud Console** (where you set up "Sign in with Google" — that's in `AUTH_GUIDE.md`). Different sites, not connected.

---

## 2. Apple App Store (Apple Developer Program)

To put an app on iPhone/iPad you must be a paying member of the **Apple Developer Program** ($99/year). Without it you can only test on your own device.

### Choose your account type *before* you start
| | **Individual** | **Organization** |
|---|---|---|
| Shown to users as | Your personal name | Your company's name |
| Needs a **D-U-N-S number**? | **No** | **Yes** (free, but days–weeks to get) |
| Best for | Solo devs, side projects | Companies, brand name on the store |
| Setup speed | Faster (24–48 h typical) | Slower (D-U-N-S + verification) |

> **🤖 Recommendation for a first-time solo launch:** start as an **Individual** — you can migrate to an Organization later. Don't let D-U-N-S block your first launch unless a company name is non-negotiable.

### Step 1 — Prerequisites 🔴 YOU
- An **Apple Account** (formerly "Apple ID") you'll keep long-term, with **two-factor authentication ON** (required — set it in iPhone Settings → your name → Sign-In & Security, or https://account.apple.com).
- You must be the **legal age of majority**; a credit/debit card for the $99.
- *(Organization only)* a **D-U-N-S number** — free at https://developer.apple.com/enroll/duns-lookup/. Apply for this **first**; it gates everything.

### Step 2 — Enroll 🔴 YOU
- **Easiest (individuals):** install the **Apple Developer** app on iPhone → **Account → Enroll** → pay $99.
- **Web:** https://developer.apple.com/programs/enroll/ → sign in → Individual or Organization → pay $99.

> 🧒 **Timing:** Apple can take **up to ~2 days just to process the $99 payment** before enrollment even begins — then individual approval is often *another* 24–48 h; organizations take longer (Apple confirms the business by phone/email). Pay early so the clock starts.

### Step 3 — Accept agreements 🔴 YOU
In **App Store Connect** (https://appstoreconnect.apple.com) → **Agreements, Tax, and Banking** → accept the latest agreements. **Skip this and your app literally cannot be submitted** — a very common trap.

> **EU note:** EU developers (or apps shown to EU users) must declare **trader status** + contact details (a Digital Services Act rule) before the app appears in EU countries. App Store Connect prompts you.

### Step 4 — Create the app listing 🔴 YOU (🤖 AI drafts the text)
**App Store Connect → Apps → +**: app name (unique across all of Apple), language, category, and the **Bundle ID** (next step).
> **🤖 AI CAN DO THIS:** draft your description, keywords, "what's new", and size screenshots to Apple's dimensions.

### Step 5 — The Bundle ID (reused everywhere) 🔴 YOU DECIDE
Your app's permanent reverse-domain name, e.g. `com.yourname.myapp`. **Decide once, keep forever** — you reuse the exact string in Apple's Identifiers, your iOS Google OAuth client (`AUTH_GUIDE.md`), and your project config. **You cannot change it after the app ships.**

### Step 6 — Signing & TestFlight (the part beginners fear — but tools do it)
- **Certificates & provisioning profiles** prove the app is yours. **🤖 Modern build tools (Xcode "automatic signing", EAS, Codemagic) generate these** — you rarely touch them.
- **TestFlight** — Apple's free beta system. Upload a build, invite testers by email, get feedback before going live.

### Apple gotchas
- **Payment isn't instant** → ~2 days to process the $99 *before* verification even starts. Start early.
- **Forgot the agreements (Step 3)** → submissions silently blocked. Check first.
- **2FA not enabled** → enrollment won't proceed.
- **First review rejection** → common and *not* a disaster; Apple emails the reason in **Resolution Center**. Frequent causes: missing privacy-policy URL (see `PRIVACY_GDPR_GUIDE.md`), a login the reviewer can't use, and **Apple requiring "Sign in with Apple" when you offer other social logins** (see `AUTH_GUIDE.md`).
- **Renewal:** $99 is **per year** — if it lapses, your app is *removed*. Set a calendar reminder.

---

## 3. Google Play Store (Google Play Console)

A **Google Play Console** account is **$25 once** (not yearly). Then you upload and manage your Android app.

### Choose your account type — and the big catch
| | **Personal** | **Organization** |
|---|---|---|
| Needs **D-U-N-S**? | No | **Yes** |
| **Mandatory 14-day / 12-tester closed test before going live?** | **YES** (accounts created after 13 Nov 2023) | **No** (orgs exempt) |
| Best for | Solo devs | Registered businesses |

> **🔴 THE #1 SURPRISE FOR NEW ANDROID DEVS — read twice:** a **new personal** account must run a **closed test with ≥12 testers who stay opted-in for 14 continuous days** before Google lets you publish publicly. "12 testers" = 12 real Google accounts that opted in via your link **and installed the app** — not 12 invites. Line up 12 friends/devices, or budget ~2+ weeks. **Organization accounts skip this** (but need D-U-N-S).

### Step 1 — Prerequisites 🔴 YOU
- A **Google account** to own the developer profile (a dedicated one is wise); a card for the **$25**; a government **photo ID** + **address** (Google verifies all new developers).
- *(Org only)* a **D-U-N-S number** (reuse the one from Apple if it's the same legal entity).

### Step 2 — Sign up 🔴 YOU
https://play.google.com/console/signup → sign in → **Personal** or **Organization** → developer name + contact → pay **$25** → complete **identity verification** (upload ID, confirm address). **Google manually reviews this** (hours → several days); you **cannot publish until it clears**. Submit it the moment you create the account so the clock starts.

### Step 3 — Create the app 🔴 YOU (🤖 AI drafts content)
**Play Console → Create app**, then the **Dashboard setup tasks**: privacy-policy URL, content-rating questionnaire, target audience, **Data safety form** (what data you collect — be honest), app access (give Google test login details if needed).
> **🤖 AI CAN DO THIS:** draft the privacy policy (see `PRIVACY_GDPR_GUIDE.md`), store description, content-rating answers, and Data-safety declarations.

### Step 4 — The package name 🔴 YOU DECIDE
Android's equivalent of the Bundle ID (`com.yourname.myapp`). **Choose once, never change** — it's permanent on Play and used in your Android OAuth client (`AUTH_GUIDE.md`). 💡 Use the **same** reverse-domain string on both stores.

### Step 5 — Closed testing → production 🔴 YOU
1. Build a release **.aab** (🤖 your build tool produces this).
2. **Play Console → Testing → Closed testing** → add ≥12 testers → share the **opt-in link**.
3. Keep them opted in **14 continuous days** (personal accounts).
4. The **"Apply for production access"** button then unlocks → promote to **Production**.

### Step 6 — App signing
- Use **Play App Signing** (default — Google holds the key safely).
- **🔴 Then add Play's SHA-1** (Play Console → Setup → App signing) as a **second Android OAuth client** in Google Cloud Console, or Google login breaks for store-installed users (see `AUTH_GUIDE.md`).

### Google Play gotchas
- **Verification is a review, not a checkbox** → budget days; start day one.
- **"I have to wait 14 days?!"** → yes, new personal accounts. Start the closed test the moment you have any working build.
- **Testers don't count unless** they click the opt-in link *and* install.
- **Data safety form rejected** → it must match reality; if you added Google login you *do* collect email — declare it.
- **Verification stuck** → the name on your ID must match the developer-account name exactly.

---

## 4. Checklist (accounts & stores)

```
APPLE
[ ] Apple Account with 2FA enabled
[ ] (Org only) D-U-N-S number obtained
[ ] Enrolled + $99 paid + identity verified
[ ] Agreements/Tax/Banking accepted in App Store Connect
[ ] (EU) Trader status declared
[ ] Bundle ID decided: com.________.________
[ ] App listing created, screenshots + description ready
[ ] Tested via TestFlight
[ ] Submitted for review

GOOGLE PLAY
[ ] Google Play Console account ($25) created + identity verified
[ ] (Org only) D-U-N-S obtained
[ ] Package name decided (match Apple): com.________.________
[ ] App created; Data safety + content rating + privacy policy done
[ ] (Personal account) Closed test running: 12+ testers, 14 days
[ ] Production access granted → rolled out

(Sign-in / SSO checklist is in AUTH_GUIDE.md)
```

---

## 5. Glossary

- **Bundle ID (Apple) / Package name (Android)** — your app's permanent unique name, like `com.yourname.myapp`.
- **D-U-N-S number** — a free 9-digit business ID from Dun & Bradstreet; required for *organization* accounts on both stores.
- **SHA-1 fingerprint** — a code-string identifying your app's signing key; Android Google-login needs it (see `AUTH_GUIDE.md`).
- **TestFlight (Apple) / Closed testing (Google)** — beta channels to test with real users before going public.
- **.aab / App Bundle** — the file format you upload to Google Play.
- **App Store Connect / Play Console** — the dashboards where you manage your published apps (Apple / Google).
- **Two-factor authentication (2FA)** — a second login step (a code on your phone); Apple requires it.

---

## 6. Official sources (verify the latest — rules change)

- Apple — Become a member: https://developer.apple.com/programs/enroll/
- Apple — Compare memberships: https://developer.apple.com/support/compare-memberships/
- Apple — Enrollment help (D-U-N-S, individual vs org): https://developer.apple.com/help/account/membership/program-enrollment/
- Apple — D-U-N-S lookup: https://developer.apple.com/enroll/duns-lookup/
- Google Play — App testing requirements (new personal accounts): https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play Console signup: https://play.google.com/console/signup

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`) — a reusable, plain-language launch playbook for newbie vibe coders. Last verified against published requirements: May 2026. Store policies and fees change; the official sources above are the source of truth.*
