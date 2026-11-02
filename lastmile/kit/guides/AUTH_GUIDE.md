---
guide: AUTH
anchor: lastmile:module/auth
shape: walkthrough
timing: at-module
lead_time: "Google sensitive-scope OAuth verification: days-weeks (only if you request Gmail/Drive scope)"
---

# AUTH_GUIDE.md — Letting users sign in (Google SSO, email signup, magic links)

> **Part of the lastmile launch guides** (`.claude/lastmile/guides/`). New here? Read **`README.md`** first — it has the shared *"what only YOU can do vs your AI"* rule, the secrets golden-rule, and the day-zero timing principle that apply to every guide.
>
> **Who this is for:** you're adding a way for users to get *into* your app — "Sign in with Google", email + password, or a magic link. Plain language, from zero.

---

## 0. The mental model

Auth = proving who a user is. You can offer several methods at once:

- **Social SSO** — "Sign in with Google / Apple / GitHub." The user taps one button; the provider vouches for them. No password for you to store.
- **Email + password** — the classic. Someone must store passwords *safely* (hashed) — the single riskiest thing to do by hand.
- **Magic link / one-time code (OTP)** — passwordless: the user types their email and gets a one-time sign-in link or code. No password at all. (These emails are sent by your transactional email provider — see **`EMAIL_GUIDE.md`**.)

> **The single biggest decision:** use a **managed auth provider** (Clerk or Supabase Auth) instead of hand-building auth. Auth is where a small mistake becomes a *breach*, not a bug. See Section 2.

> **Already decided on passwordless Supabase?** If your answer is "Supabase, no passwords — a 6-digit email code + Google," you're past the decision this guide helps with. Jump to **[`AUTH_RUNBOOK.md`](AUTH_RUNBOOK.md)** — the opinionated, AI-drivable execution runbook for exactly that stack (your AI writes its code: clients, sign-in UI, PKCE callback, and the password hard-block migration + a check that proves it). This guide stays the method-*choice* reference; the runbook is the *execution* of one chosen path.

🔴/🤖 reminder: creating the provider account + the Google/Apple credentials + pasting secrets is **YOU**; installing the SDK, adding the login UI, protecting pages, wiring sessions is **your AI assistant**. (Full framing in `README.md`.)

---

## 1. The easiest path for most apps: a managed auth provider

You don't *have* to build login yourself. A **managed auth provider** runs the entire login system: sign-up, sign-in, sessions, secure password storage, social logins, password reset, email verification — even a ready-made login screen.

| | **Clerk** | **Supabase Auth** |
|---|---|---|
| What it is | A dedicated authentication service | Auth built into the Supabase platform (database + auth + storage in one — see `DATABASE_GUIDE.md`) |
| Best when | You want the most polished login UI with the least code | You're already using Supabase as your database |
| Prebuilt UI | Excellent — drop in `<SignIn />`, `<UserButton />`, profile & team management | Good — Auth UI components, or build your own |
| Where users live | On Clerk's servers | In **your own** Postgres database (you own the data) |
| Free tier (at writing) | Generous (~10k monthly active users) | Generous (~50k monthly active users) |

**Other options** (more control, more work): **Auth.js / NextAuth** (free, open-source, self-hosted, you own everything) and **Firebase Auth** (Google's, strong for mobile, ties you into Firebase).

> **🤖 AI CAN DO THIS:** *"Set up auth with Clerk"* (or *"…with Supabase Auth"*) → the assistant installs the SDK, adds the login components, protects your pages, wires the session. You only do dashboard clicks + paste credentials. **For a first launch: pick one of these two — don't hand-roll auth.**

---

## 2. "Sign in with Google" (social SSO) — step by step

SSO = "Single Sign-On." Instead of a new username/password, the user taps **"Sign in with Google"**. You set this up in **Google Cloud Console** (free). You end up with a **Client ID** (and sometimes a **Client Secret**) — code-strings your app/provider uses to talk to Google.

> **Same front door, different hallway:** whether you use a provider or DIY, you *always* create the Google OAuth credentials below. The difference is who runs the back-and-forth handshake afterward (Section 4).

### Step 1 — Create a Google Cloud project 🔴 YOU
1. Go to **https://console.cloud.google.com**, sign in with the Google account that will *own* this app (a real, kept account — not a throwaway).
2. Top bar → project dropdown → **New Project** → name it → **Create** → make sure it's selected.

> 🧒 A "project" is just a labeled box holding one app's settings.

### Step 2 — Configure the OAuth consent screen / "Branding" 🔴 YOU
The screen users see: *"MyApp wants to access your Google account."*
1. Left menu → **Google Auth Platform → Branding** (older accounts: **APIs & Services → OAuth consent screen**).
2. Fill in **App name**, **User support email**, **Contact email** (logo optional).
3. Under **Audience**, choose **External** (anyone with a Google account; *Internal* is Workspace-only).

> 🧒 While in **"Testing"** mode only accounts you add as **test users** can log in. For basic login (name + email) clicking **Publish app** is instant — **no Google review**. Review is only triggered by *sensitive* scopes (Gmail/Drive).

### Step 3 — Scopes 🔴 YOU
For normal login use only the three non-sensitive scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. **Do not add Gmail/Drive/Calendar** unless you truly need them — those trigger a multi-week Google verification.

### Step 4 — Create the OAuth Client ID(s) 🔴 YOU → 🤖 hand values to the assistant
Left menu → **APIs & Services → Credentials → + Create Credentials → OAuth client ID**. Pick the type (you may need more than one):

- **Web app** — set **Authorized JavaScript origins** (`http://localhost:3000` dev, `https://yourdomain.com` prod) + **Authorized redirect URIs** (where Google returns the user — your assistant/provider tells you the exact URL). Gives a **Client ID + Secret**.
- **iOS app** — needs your **Bundle ID** (`com.yourname.myapp` — see `DEV_SETUP_GUIDE.md`). Gives a Client ID + a reversed client ID. No secret.
- **Android app** — needs your **Package name** + a **SHA-1 fingerprint** (identifies your signing key). **🤖 the assistant can generate the SHA-1** (`keytool` / `./gradlew signingReport`); you paste it into Google.

### Step 5 — Which library (DIY only) 🤖
| Your app | Library |
|---|---|
| A website | **Google Identity Services (GIS)** |
| Native Android | **Credential Manager** + Sign in with Google (old "Google Sign-In SDK" is deprecated) |
| Native iOS | **GoogleSignIn SDK** (reversed client ID) |
| React Native / Expo | `@react-native-google-signin/google-signin` (needs iOS + Android client IDs) |
| Flutter | `google_sign_in` |

### Step 6 — The two ways to wire it up
**Path 1 — Through a managed provider (recommended).** You still make the Google credentials (Steps 1–4), but the **redirect URI is the *provider's* callback**, not your app's. In the provider dashboard: turn Google on → paste your Client ID + Secret. The provider does the token exchange + session + user record. You add a button.
- **Supabase callback URL** (paste into Google's Authorized redirect URIs): `https://<your-project-ref>.supabase.co/auth/v1/callback` (local: `http://127.0.0.1:54321/auth/v1/callback`).
- Add your own app URLs to **Supabase → Authentication → URL Configuration** (redirect allow-list) or login fails silently.
- **Google multi-platform gotcha:** paste Web + iOS + Android client IDs **comma-separated, Web ID first**.
- **Clerk shortcut:** Clerk can test Google login with *its own* shared dev credentials before you make your own — but switch to your own for production (else the consent screen says "Clerk").

**Path 2 — Do it yourself.** Redirect URI = your app's `/auth/callback`. You build the callback route that exchanges the `code` for a token, **verify the token's signature**, create/look up the user, and **issue + secure your own session** (httpOnly cookies, expiry, refresh). Ask the assistant to explicitly handle **session security + token verification** — the two easiest things to get wrong.

### Google SSO gotchas
- **`redirect_uri_mismatch`** → the redirect URL in code ≠ what you typed in Step 4 (even `/` or `http`/`https` differences break it). Make them identical.
- **Works for you, not others** → consent screen still in **Testing**; add test users or **Publish**.
- **Android login breaks after Play Store release** → Play *re-signs* your app; add **Play's SHA-1** (Play Console → Setup → App signing) as a *second* Android OAuth client. (See `DEV_SETUP_GUIDE.md`.)

---

## 3. Email signup (email + password, and magic links) — the "email signup"

Letting users sign up **with their email** instead of (or alongside) Google.

- **With a managed provider (recommended):** just enable the **Email** provider in Clerk / Supabase. You instantly get sign-up, login, **email verification**, and **password reset** — no password-handling code of your own.
- **Magic link / OTP (passwordless):** the user types their email and gets a one-time sign-in link or code. Enable it in the provider. Great UX, nothing to forget. The link/code email is **sent by your transactional email provider** → see **`EMAIL_GUIDE.md`** (if your email isn't set up right, the magic link lands in spam and "login is broken").
- **Verification & reset emails:** the provider sends these. In production, point the provider at **your own sending domain** for deliverability (again `EMAIL_GUIDE.md`).
- **Account deletion:** offer self-serve *"delete my account"* — it's a privacy-law requirement and ties to **`PRIVACY_GDPR_GUIDE.md`** (right to erasure) + **`DATABASE_GUIDE.md`** (actually remove/anonymize the rows).
- **🔴 DIY warning:** storing passwords yourself means correct **hashing** (bcrypt/argon2 — never plaintext), reset-token security, rate-limiting, and lockout. This is the highest-risk code in your app. Use a provider unless you have a specific reason not to.

> 🧒 *Newbie note:* "email signup" and "Sign in with Google" aren't either/or — most apps offer both, and a managed provider gives you both from the same dashboard.

---

## 4. "Sign in with Apple" — the traps

- **Apple's App Store rule:** if your app offers other social logins (e.g. Google), Apple usually **requires** you to *also* offer **Sign in with Apple** (or your app gets rejected). See `DEV_SETUP_GUIDE.md` Part on Apple review.
- **Three traps that catch almost everyone** (from Supabase's docs, but they apply generally):
  1. **The secret expires every ~6 months.** For the web/OAuth flow, Apple's "client secret" is a short-lived token built from a `.p8` **Sign in with Apple key** (+ your **Team ID**, **Key ID**, **Services ID**). After ~6 months it stops working and logins break — **set a recurring calendar reminder to regenerate it**; keep the `.p8` safe. (Native iOS-only sign-in is exempt.)
  2. **Apple sends the user's name only on the *first* sign-in** — `null` after — so **capture and store it on that first login**.
  3. **Not native on Android** (uses the web flow there), and Apple's secret-generator tool **doesn't work in Safari** — use Chrome/Firefox.

---

## 5. Auth checklist

```
[ ] Decided approach: managed provider (Clerk/Supabase) vs DIY — EARLY (it's architectural)
[ ] Google Cloud project + OAuth consent screen (Branding) filled in
[ ] Scopes limited to openid + email + profile
[ ] OAuth Client ID(s) created per platform (web / iOS / Android)
[ ] Redirect URI = provider callback (managed) OR your /auth/callback (DIY) — matches EXACTLY
[ ] Consent screen PUBLISHED before real users
[ ] (Android) Play App Signing SHA-1 added as a 2nd OAuth client
[ ] Email signup enabled (email/password and/or magic link)
[ ] Verification + reset emails sending from YOUR domain (see EMAIL_GUIDE)
[ ] Self-serve account deletion in place (see PRIVACY_GDPR_GUIDE)
[ ] (If offering Google) "Sign in with Apple" also offered (Apple rule)
[ ] (Apple web flow) calendar reminder set for the 6-month secret rotation
```

---

## 6. Official sources (verify the latest — these change)

- Google — Configure the OAuth consent screen: https://developers.google.com/workspace/guides/configure-oauth-consent
- Google — Setting up OAuth 2.0: https://support.google.com/googleapi/answer/6158849
- Supabase Auth (social login + email): https://supabase.com/docs/guides/auth
- Clerk: https://clerk.com/docs
- Auth.js (NextAuth): https://authjs.dev
- Sign in with Apple: https://developer.apple.com/sign-in-with-apple/

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`) — a reusable, plain-language launch playbook for newbie vibe coders. Last reviewed: May 2026. See `README.md` for the full set + recommended order.*
