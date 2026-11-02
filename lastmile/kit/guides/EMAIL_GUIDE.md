---
guide: EMAIL
anchor: lastmile:module/email
shape: walkthrough
timing: at-module
lead_time: "Sending-domain DNS (SPF/DKIM/DMARC) propagation + reputation warm-up: hours-days"
---

# EMAIL_GUIDE.md — Email for a Launching App, for Total Newbies

> **Who this is for:** You're building (or just built) an app, and now you need it to **send email** — the "verify your address" message when someone signs up, the "reset your password" link, the receipt after a purchase, and maybe a newsletter or onboarding emails. You have little or no technical background. This guide explains the whole picture in plain language, from zero.
>
> **How to read this:** Read it top to bottom once. The big idea (transactional vs marketing email) is the spine; everything else hangs off it.
>
> **Before you start:** The shared "what only a human can do" and "start the slow clocks on day zero" preamble lives in [`README.md`](./README.md) — read that once first; this guide doesn't repeat it.

Throughout, **🔴 YOU MUST DO THIS** = a step only you, a human, can do (buy/verify a domain, add DNS records, create the email account). **🤖 AI CAN DO THIS** = something you hand back to your assistant (the send code, templates, the signup form). **🧒 *Newbie note:*** = a plain-language clarification.

> **Golden rule (same as everywhere):** Never paste an **API key** into a public chat, a screenshot, or a file you'll commit to GitHub. It's a house key — anyone who has it can send email *as you* and torch your reputation.

---

## 1. The single most important idea: there are TWO kinds of email, and you must keep them apart

Almost every newbie email problem traces back to mixing these two up. They look the same (both are "an email") but they behave like different species.

| | **Transactional email** | **Marketing / lifecycle email** |
|---|---|---|
| **What triggers it** | A single user's **action** (they just signed up, clicked "reset password", bought something) | **You** deciding to message a **list** of people |
| **Examples** | Verification email, magic-link sign-in, password reset, receipt, "your export is ready" | Newsletter, onboarding drip ("Day 3: here's a tip"), product announcement, waitlist update |
| **Who gets it** | One person, right now, because they did a thing | Many people, on your schedule |
| **Consent needed?** | They asked for it by using your app | **Yes — they must have opted in**, and every email needs an **unsubscribe** link (legally required) |
| **Speed matters?** | Critically — a password reset is useless 10 min late | Not really — a newsletter can send over an hour |

> 🧒 *Newbie note:* Think of it like the post office. **Transactional** = a tracked package someone is waiting by the door for. **Marketing** = a flyer you mail to a list. The post office (your email provider) treats them differently, and so should you.

**Why keeping them apart matters so much:** email providers (Gmail, Outlook) score your **sending reputation**. Marketing email gets more spam complaints. If you send your newsletter from the *same* identity as your password resets, one bad newsletter campaign can drag your **password resets into the spam folder** — and now real users literally can't log in. The pros (see Postmark below) physically run them on **separate infrastructure** for exactly this reason. You should at minimum send them from a **different subdomain** (more on that in Section 4).

---

## 2. Pick a provider (you do NOT send email from your own server)

🧒 *Newbie note:* You might think your app "just sends an email." It can't — not reliably. Email sent directly from an app server almost always lands in spam (your server's address isn't trusted). You sign up with an **email sending provider**: a service whose whole job is getting your mail into the inbox. You call their API; they handle the rest.

Here are the vibe-coder-friendly choices and when to pick each:

| Provider | Best for | Free tier (at writing) | Why pick it |
|---|---|---|---|
| **Resend** | Transactional, modern, developer-first. The default for most vibe coders. | **3,000 emails/mo** (100/day cap) | Cleanest API + the nicest "React Email" templates; great docs; one provider for your app's sends. The 100/day cap is what makes you upgrade, not the 3k. |
| **Loops** | **Marketing / lifecycle** — newsletters, onboarding drips, waitlists. | **1,000 contacts** (~4k sends/mo) | Built for the *list* side: visual audience, campaigns, automations. Pairs with Resend (Resend = transactional, Loops = lifecycle). |
| **Postmark** | Transactional where deliverability is everything. | 100 emails to test (no recurring free tier) | Famous for the **best, fastest inbox placement** — they refuse to send marketing on the same pipes as transactional, which is *why* their transactional mail is so trusted. Costs a bit more. |
| **SendGrid / Mailgun** | **Scale** — high volume, or you've outgrown the above. | Limited/none recurring | The veterans. More knobs, more complexity. Reach for these when you're sending serious volume, not on day one. |

**Newbie recommendation:**
- **Just launching, want one thing that works?** → **Resend** for everything. Add a marketing tool later when you actually have a list.
- **Care most about resets/magic links never getting lost?** → **Postmark** for transactional.
- **You'll have a real newsletter / onboarding sequence?** → **Resend (transactional) + Loops (marketing)** is the popular pairing.
- **Huge volume?** → SendGrid or Mailgun, but you won't be there at launch.

> **🤖 AI CAN DO THIS:** Tell your assistant *"set up email sending with Resend"* (or your pick) and it installs the SDK, writes the send functions, and builds your templates. **You** do the account signup and domain steps below — those are the parts only a human can do.

---

## 3. 🔴 The human-only setup: domain, account, API key

These three are yours alone — they need your identity, your domain, and your account:

### Step 1 — Get a domain you own 🔴 YOU MUST DO THIS
You need a **custom domain** (e.g. `yourapp.example`) to send from. You **cannot** send "from" a free address like `you@example.com` — see Section 4 for *why* (it fails a check called DMARC and gets rejected). If you already bought a domain for your website, use that one. If not, buy one from any registrar (Namecheap, Cloudflare, Porkbun, etc.).

> 🧒 *Newbie note:* "Custom domain" just means a web address you own, like `yourapp.example`. You'll send mail as `hello@yourapp.example`. Owning the domain is what lets you prove the mail is really from you.

### Step 2 — Create the provider account 🔴 YOU MUST DO THIS
Sign up at your chosen provider (e.g. resend.com). Free, takes a few minutes.

### Step 3 — Add your domain in the provider and verify it 🔴 YOU MUST DO THIS
In the provider's dashboard, add your domain. It will hand you a **list of DNS records** (some `TXT`, some `CNAME`) to add at your domain's DNS host. This is the deliverability setup — covered next in Section 4, because it's the part that decides inbox vs. spam.

### Step 4 — Copy the API key into the project 🔴 (then 🤖 hand it off)
The provider gives you an **API key** (a long secret string). Paste it into your project's **environment variables / secrets** (a `.env` file or your host's secrets manager) — **never** hardcoded in the code, **never** committed to GitHub. Then tell your assistant it's set.

> **🤖 AI CAN DO THIS:** Once the key is in your environment, your assistant wires the send calls, the templates, and the signup form. You only did the signup + domain + paste.

---

## 4. Deliverability — the #1 reason emails go to spam

This is the section that actually determines whether your email lands in the inbox or vanishes into spam. Most "my emails aren't arriving" problems are here.

### Why you can't send "from" gmail.com
When you send email, the receiving server asks: *"Is this really from who it claims to be?"* There are three checks that answer that — **SPF, DKIM, DMARC**. They all rely on you controlling the **domain** the email comes from. You don't control `gmail.com` — Google does — so an email claiming to be "from `you@example.com`" but sent through Resend **fails the check** and gets rejected or spam-filed. That's why you send from a domain **you own and have verified**.

### The three checks, in plain language

| Record | What it literally is | What it proves | Who adds it |
|---|---|---|---|
| **SPF** | A `TXT` record listing who's *allowed* to send mail for your domain | "This sending service has permission to send as my domain" — like a guest list at the door | 🔴 You (paste the value the provider gives you) |
| **DKIM** | A `TXT`/`CNAME` record holding a public cryptographic key | "This email wasn't tampered with and really came from my domain" — like a wax seal/signature | 🔴 You (paste the provider's value) |
| **DMARC** | A `TXT` record at `_dmarc.yourdomain.com` | "Here's my policy: if SPF/DKIM fail, do X (reject it)." Ties the first two together and tells receivers what to trust | 🔴 You (the provider or an explainer gives you a starter value) |

> 🧒 *Newbie note:* You don't have to understand the cryptography. Your **only job** is to copy the records your provider shows you into your DNS host, exactly. The provider gives you the *values*; pasting them is the human part.

### 🔴 Adding the DNS records — YOU MUST DO THIS
1. In your **provider's dashboard**, go to the domain you added → it lists the records to add (name/host, type, value).
2. Go to your **domain's DNS host** — that's wherever your domain's DNS lives (your registrar like Namecheap/Porkbun, or Cloudflare if you moved DNS there).
3. **Add each record exactly as shown** — match the type (`TXT`/`CNAME`), the name/host, and the value. A stray space or wrong host breaks it.
4. Back in the provider, click **Verify**. It checks DNS and flips the domain to "verified."

> 🧒 *Newbie note:* "DNS host" = the control panel that decides where your domain points. It's usually at your registrar, unless you pointed your domain at **Cloudflare** (very common) — then you add records *in Cloudflare*. If unsure, your assistant can tell you which by looking up your domain's nameservers.

> **⏱️ Lead time:** DNS changes don't apply instantly — they **propagate** (spread across the internet) over minutes to a few hours, occasionally up to a day. So verification may not pass the second you save. This is one of those slow clocks — **start the domain + DNS step early** (see the day-zero note in [`README.md`](./README.md)), don't leave it for launch day.

### Warm up a new domain before sending in bulk
A brand-new domain has **no reputation**. If you blast 5,000 newsletter emails from a cold domain on day one, providers treat it as suspicious and spam-file you. **Warm up**: send a small, growing volume over days/weeks (transactional email naturally does this as real users sign up). For a big marketing send from a fresh domain, ramp up gradually — your marketing provider (Loops, etc.) has guidance.

### Use a subdomain to keep the two email types apart
Send transactional from one subdomain and marketing from another — e.g. transactional from `mail.yourapp.example` and marketing from `news.yourapp.example` (or `send.` / `updates.`). That way a marketing reputation hit can't poison your password resets. 🔴 You set up the subdomain's DNS records the same way; 🤖 your assistant configures the app to send each type from the right one.

---

## 5. Email-based signup flows (the transactional emails that power login)

When a user "signs up with email," several **transactional** emails make it work. **This provider SENDS those emails** — but the **login/auth logic itself lives in [`AUTH_GUIDE.md`](./AUTH_GUIDE.md)**. Don't build the auth flow from this guide; just know which emails the email provider delivers:

| Email | When it fires | This guide's job | Auth logic |
|---|---|---|---|
| **Verification email** | Right after signup — "confirm your address" | Provider sends it | See `AUTH_GUIDE.md` |
| **Magic-link sign-in** | User asks to log in via a one-time link instead of a password | Provider sends the link | See `AUTH_GUIDE.md` |
| **Password reset** | User clicks "forgot password" | Provider sends the reset link | See `AUTH_GUIDE.md` |

> 🧒 *Newbie note:* The split is simple — **`AUTH_GUIDE.md` decides *what* link/code to send and what happens when the user clicks it. This guide is the *delivery truck* that gets that email into their inbox.** If you use a managed auth provider (Clerk/Supabase Auth, see `AUTH_GUIDE.md`), it can even send these for you — but for control and deliverability many teams still route them through Resend/Postmark.

> **🤖 AI CAN DO THIS:** Your assistant wires the send call for each of these and writes the templates. The actual sign-in/verify/reset *flow* it builds per `AUTH_GUIDE.md`.

---

## 6. Marketing, newsletter & waitlist capture (the list side)

This is the other species: messaging people who **opted in** to hear from you.

### The flow
1. A **signup form** on your site (a "join the newsletter" / "join the waitlist" box).
2. Submitting it adds the person to your **list** — either the provider's **audience** (Loops, Resend audiences) or **your own database**.
3. You send **campaigns** (a newsletter) or **automations** (a welcome drip) to that list.

> **🤖 AI CAN DO THIS:** Your assistant builds the signup form, connects it to your list (provider audience or your DB), and wires the campaign/drip sends. **You** create the provider account and decide the consent wording.

### Three rules you cannot skip (these are legal, not optional)
- **Double opt-in (recommended):** after someone enters their email, send a "click to confirm" email; only add confirmed addresses. This proves consent and keeps your list clean (typos and bots can't sneak on).
- **Only email people who consented.** Don't import a list you scraped or bought. Sending to people who didn't ask = spam complaints = your domain's reputation tanks (and it's illegal in many places).
- **Every marketing email needs a working *unsubscribe* link.** This is **legally required** (CAN-SPAM in the US, GDPR/PECR in the EU). Marketing providers add an unsubscribe footer automatically — don't strip it.

> **Cross-reference:** Consent capture, what counts as valid consent, CAN-SPAM, and GDPR rules are covered in [`PRIVACY_GDPR_GUIDE.md`](./PRIVACY_GDPR_GUIDE.md). This guide handles the *sending mechanics*; that guide handles *who you're allowed to email and how you record their consent*.

> 🧒 *Newbie note:* Unsubscribe is not a courtesy — it's the law, and providers enforce it. Honoring it also *helps* you: someone who'd otherwise hit "spam" (which hurts everyone's deliverability) just quietly leaves the list instead.

---

## 7. Who does what — the clean split

| Task | Who | Notes |
|---|---|---|
| Buy a domain | 🔴 YOU | It's your purchase + identity |
| Add + verify the domain in the provider | 🔴 YOU | Provider account is yours |
| Add the SPF / DKIM / DMARC DNS records | 🔴 YOU | At your DNS host; paste the provider's exact values |
| Create the email provider account | 🔴 YOU | Resend/Loops/Postmark login |
| Put the API key in environment secrets | 🔴 YOU | Never in code, never in Git |
| Write the send code (verification, reset, receipts) | 🤖 AI | Calls the provider's API |
| Build the email templates | 🤖 AI | HTML/React Email |
| Build the signup form + connect it to your list | 🤖 AI | Form → audience/DB |
| Wire campaigns / onboarding drips | 🤖 AI | Per your provider |

---

## 8. Gotchas (the things that trip up beginners)

- **No SPF/DKIM/DMARC = spam folder.** The most common "my emails don't arrive" cause. Verify the domain and add all three records before you trust a single send.
- **Sending from gmail.com / a free address** → fails DMARC, gets rejected or spam-filed. Always send from your **own verified domain**.
- **Bulk-sending from a cold domain** → a brand-new domain with no reputation gets spam-filed when you blast it. **Warm up** gradually.
- **Transactional + marketing on the same domain/subdomain** → one bad newsletter campaign drags your password resets into spam. **Separate them** (different subdomains at minimum).
- **Missing unsubscribe link on marketing email** → illegal (CAN-SPAM/GDPR) *and* spikes spam complaints. Never strip the unsubscribe footer.
- **Hardcoding the API key** (in code or committed to GitHub) → anyone can send mail as you, and bots scrape public repos within minutes. Use environment secrets.
- **DNS propagation delay** → records don't verify the instant you save them; allow minutes to hours. Start the domain/DNS step **early** — it's a slow clock (see [`README.md`](./README.md) day-zero note).
- **Forgetting the daily cap** → e.g. Resend's free tier allows 3,000/month but only **100/day**; a launch-day spike can hit the cap and silently queue or drop mail. Know your tier's limits before launch day.

---

## 9. Official sources (rules and free tiers change — always confirm)

- Resend docs: https://resend.com/docs
- Resend pricing / free tier: https://resend.com/pricing
- Loops docs: https://loops.so/docs
- Postmark docs: https://postmarkapp.com/developer
- Postmark — why they separate transactional & marketing: https://postmarkapp.com/why
- SPF / DKIM / DMARC explainer (Cloudflare): https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/
- Google's bulk sender / email auth requirements: https://support.google.com/a/answer/81126
- CAN-SPAM (US) compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

---

*This guide is part of the lastmile launch guides (`.claude/lastmile/guides/`) — reusable, plain-language launch playbooks for newbie vibe coders. Last reviewed: 2026-05. Provider tiers and email/anti-spam laws change; the official sources above are the source of truth.*
