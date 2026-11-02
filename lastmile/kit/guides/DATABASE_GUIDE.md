---
guide: DATABASE
anchor: lastmile:module/database
shape: walkthrough
timing: at-module
lead_time: "none"
---

# DATABASE_GUIDE.md — Where Your App Remembers Things (for Total Newbies)

> **Who this is for:** You're building (or vibe-coding) an app and you've hit the moment where it needs to *remember stuff* — user accounts, saved posts, orders, settings. That "memory" is a **database**. You have little or no technical background. This guide explains what a database is, how to pick one, and exactly which bits are **your** job vs. your AI assistant's job.
>
> **How to read this:** Top to bottom the first time. Each part stands alone, so later you can jump straight to the one you need.

> 🔴 / 🤖 / 🧒 conventions and the "do your signups on day zero" timing are explained once in **[`README.md`](README.md)** — read that first; this guide doesn't repeat them.

---

## 1. ELI5 — what is a database, and why do you need one?

Imagine your app is a friendly shopkeeper. A **database** is the shopkeeper's **notebook**. Every time something happens — a new customer signs up, someone buys a thing, a user changes their photo — the shopkeeper writes it in the notebook. Next time that customer walks in, the shopkeeper flips the notebook open and *remembers* them.

Without a notebook, your app has amnesia: refresh the page and everything's gone. The database is **where your app remembers things between visits** — and across every user, every device, forever.

> 🧒 *Newbie note:* "The database" is not a special programming skill you need to learn. It's a service you rent (like renting a storage unit). Your AI assistant writes the code that *reads and writes* the notebook; you mostly just **create the storage unit and hand over the key**.

You need one the moment your app has to remember *anything* that should survive a page refresh: logins, user content, purchases, messages, settings.

---

## 2. Pick your database — managed options compared

For a first launch, you almost always want a **managed** database (someone else keeps it alive, backed up, and patched) rather than running your own server. Here's the lay of the land.

| Option | Type | Best when… | Newbie-friendliness |
|---|---|---|---|
| **Supabase** (Postgres) ⭐ | SQL (Postgres) | You want **one** service that does database **+ login + file storage** together. The default for most vibe coders. | Excellent — dashboard, generous free tier, AI-friendly |
| **Neon** / other hosted Postgres | SQL (Postgres) | You want plain Postgres (no bundled auth) — often with serverless "scale-to-zero" and instant branches for testing. | Good — but you'll add auth/storage separately |
| **Firebase / Firestore** | NoSQL (documents) | You're building a **mobile** app and want Google's realtime sync + offline support out of the box. | Good for mobile; different mental model (no tables) |
| **SQLite / Turso** | SQL (tiny/edge) | A small or single-user app, a local tool, or you want data physically *close to users* at the edge for speed. | Great for small/simple; Turso adds hosting |
| **Your existing stack** | Whatever you have | You (or a platform you already pay for) already run MySQL/Postgres/Mongo — don't add a second one for no reason. | Depends on what it is |

### "Pick this when" — the short version

- **Just starting and want the least to manage?** → **Supabase.** Database, auth, and file storage in one dashboard, real Postgres underneath, and it pairs with the **[`AUTH_GUIDE.md`](AUTH_GUIDE.md)** auth path so your users and your data live in the same place. **This is the recommended default for a first launch.**
- **Want clean, portable Postgres without the bundled extras?** → **Neon** (or another hosted Postgres). Easy to move later because it's standard Postgres.
- **Mobile-first, want realtime + offline sync, comfortable with NoSQL?** → **Firebase / Firestore.**
- **Tiny, embedded, or edge/offline app?** → **SQLite** (file-based, zero servers) or **Turso** (hosted SQLite at the edge).
- **Already have a database you trust?** → use it; don't add complexity.

> 🧒 *Newbie note:* **SQL vs NoSQL** in one breath — **SQL** databases (Postgres, MySQL, SQLite) store data in neat **tables** with fixed columns, like a spreadsheet. **NoSQL** (Firestore, Mongo) stores flexible **documents**, like a folder of JSON files. SQL is the safer default for most apps because relationships (users → their orders) are first-class. The rest of this guide uses SQL/Postgres examples since that's the recommended path.

---

## 3. Core concepts (just enough to not be lost)

You don't need to *write* any of this — your assistant does — but knowing the words means you can read what it builds.

| Word | ELI5 | Example |
|---|---|---|
| **Table** | One page in the notebook for one kind of thing | a `users` table, an `orders` table |
| **Row** | One entry on that page | one specific user |
| **Column / field** | One labeled blank that every row fills in | `email`, `created_at`, `price` |
| **Schema** | The *blueprint* — which tables exist and what columns they have | "users have an id, email, and name" |
| **Primary key** | The unique ID stamped on every row so you never confuse two rows | `id` (often a number or a random `uuid`) |
| **Relation / foreign key** | A row pointing at a row in another table — "this order belongs to *that* user" | `orders.user_id` → `users.id` |

> 🧒 *Newbie note:* A **relation** is just a labeled string tying two notebook pages together. "This order belongs to that user." When your assistant says "let's add a foreign key," it means "let's officially connect these two tables so the database keeps them honest."

---

## 4. Migrations — never hand-edit the live database

Your **schema** (the blueprint) will change as your app grows: you'll add a column, a new table, a relationship. The safe way to make those changes is a **migration** — a small, ordered, saved file that describes *exactly* one change to the blueprint.

Think of migrations as a **renovation permit**. You don't walk into the live shop and start knocking down walls while customers are inside. You write the plan down (a migration file), test it on a **copy**, then apply the same plan to the real shop in a controlled way.

| | **Migrations (do this)** | **Hand-editing the live DB (don't)** |
|---|---|---|
| How | Saved files, applied in order, AI writes them | Clicking around in the production dashboard |
| Repeatable? | Yes — same files rebuild the schema anywhere | No — undocumented, can't reproduce |
| Reversible? | Usually (you can write a "down" step) | Often not — a fat-finger can be permanent |
| Team/AI-safe? | Yes — they're in your code, reviewable | No — invisible to everyone else |

**The golden rule:** *Schema changes go through migration files, applied in order. Never make a structural change by hand-editing the production database.*

### Local vs production

- **Local / development database** — a throwaway copy on your machine (or a free "dev branch"). Break it freely; reset it anytime.
- **Production database** — the real one with real users' data. Treat it like the live shop: changes only arrive via tested migrations.

> **🤖 AI CAN DO THIS:** Your assistant writes the migration files (Supabase migrations, or via an ORM like Prisma/Drizzle — see Sources), runs them against your local copy first, and only then applies them to production. You just say *"add a `subscriptions` table"* and approve the result.

---

## 5. The connection string — your database's secret key

To talk to the database, your app needs a **connection string**: one long line that contains the address *and the password*. It looks roughly like:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

That `PASSWORD` part is exactly why this string is a **secret**, in the same family as an API key or a "Client Secret."

### Where it lives — and where it must NEVER live

| Place | Use it? |
|---|---|
| A local **`.env`** file (and `.env` is in `.gitignore`) | ✅ Yes — for local development |
| Your host's / platform's **secret manager** (Vercel, Netlify, Fly, etc. "Environment Variables") | ✅ Yes — for production |
| **Committed into git** (in code, in a config file, in the repo) | 🔴 **NEVER** |
| Pasted into a public chat, screenshot, or issue | 🔴 **NEVER** |

> **🔴 The secrets golden rule (same one from [`README.md`](README.md)):** a connection string with a password in it is a **secret**. It goes in a local `.env` file or your host's secret manager — **never** committed to git, never in a screenshot. If it ever leaks, **rotate (reset) the database password immediately.**

> 🧒 *Newbie note:* `.env` is a plain text file your app reads at startup to learn its secrets. The trick is the `.gitignore` line that tells git "pretend this file doesn't exist," so it never gets uploaded. If your assistant scaffolds the project, it sets this up for you — but **glance at `.gitignore` and confirm `.env` is listed.**

---

## 6. Row-Level Security (RLS) — so users can't read each other's data

By default a database will hand back any row anyone asks for. **Row-Level Security (RLS)** flips that: it adds a rule on each table that says *"a user may only see and change the rows that belong to them."* The database itself enforces it, on every query, even if your app code has a bug.

With **Supabase**, RLS is the headline safety feature: because Supabase auth and the database are the same platform, an RLS policy can directly reference *the logged-in user's id* and tie each row to its owner. So `posts` only returns the posts where `user_id = the current logged-in user`.

> 🔴 **Critical, and a classic newbie faceplant:** when you turn RLS **on** with no policies yet, the table returns **nothing** (deny-by-default). When you leave RLS **off**, the table can leak **everything**. There is no safe middle by accident — your assistant must write explicit policies. **Insist that RLS is ON with real policies before launch.**

> See **[`AUTH_GUIDE.md`](AUTH_GUIDE.md)** for how login establishes *who the current user is* — RLS is only meaningful once auth is wired, because the policy's "this user" comes from the auth session. The two guides are two halves of the same lock.

> **🤖 AI CAN DO THIS:** *"Enable RLS on all my tables and write policies so each user only sees their own rows."* The assistant writes the policies as migrations and can add a test that proves user A can't read user B's data.

---

## 7. Backups + your data is yours (export & portability)

Two promises you want from day one: **you won't lose the data**, and **you can take it with you**.

### Turn backups ON — and know what your plan actually gives you

Backups are not always automatic. On **Supabase specifically**, the **free tier has *no* automatic backups** — you must export your own (see below). Automatic **daily** backups start on the **paid (Pro and up) plans** (Pro keeps ~7 days), and finer-grained **Point-in-Time Recovery (PITR)** is a **paid add-on**. Other providers differ — check yours.

| Provider | Automatic backups? | Notes |
|---|---|---|
| **Supabase** | Free = **none** (export yourself); Pro+ = daily (~7-day retention); PITR = paid add-on | Verify on their pricing/backups page (Sources) |
| **Neon** | History/restore window varies by plan | "Branching" doubles as cheap point-in-time copies |
| **Firebase** | Scheduled exports you configure | Set up an export schedule explicitly |
| **Turso** | Plan-dependent | Check current docs |

> 🔴 **YOU MUST DO THIS:** On launch day, *confirm backups are actually on* for your plan. **"No backups = permanent data loss"** is not a metaphor — a bad migration or an accidental delete with no backup is gone forever. If you're on a free tier with no automatic backups, **schedule your own export** (below).

### You own your data — the export path

You should always be able to pull a full copy of your data out:

- **Postgres (Supabase/Neon/etc.):** a `pg_dump` / Supabase CLI `db dump` produces a single file with your entire database. Run it on a schedule and stash it somewhere safe (this *is* your backup on a free tier).
- **Firestore:** use its managed **export** to cloud storage.

> **🤖 AI CAN DO THIS:** *"Add a script that exports the whole database to a backup file, and document how to restore it."* The assistant writes the export command and a scheduled job; **you** decide where the copies are stored.

> This export path is also your **GDPR / "give me my data" / "delete my account"** mechanism — see **[`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md)**. Being able to export and delete a single user's data cleanly is a legal requirement in many places, and it's far easier when your schema and ownership (RLS) are clean from the start.

---

## 8. Who does what — the split

| Task | Who | Mark |
|---|---|---|
| Create the database **project/account** (e.g. a Supabase project) | **You** | 🔴 |
| **Copy the connection string** out of the dashboard into `.env` / secret manager | **You** | 🔴 |
| **Turn on backups** (or schedule exports on a free tier) + verify they ran | **You** | 🔴 |
| Decide the data **password** and **rotate** it if it leaks | **You** | 🔴 |
| **Design the schema** (tables, columns, relations, keys) | Assistant | 🤖 |
| **Write queries** and the data-access code | Assistant | 🤖 |
| **Write migrations** and run them (local first, then production) | Assistant | 🤖 |
| **Wire the client/SDK** into your app + write **RLS policies** | Assistant | 🤖 |

> The pattern mirrors the rest of the library: **you** do the things that need your identity, your money, or your secrets; the **assistant** does the building.

---

## 9. Managed provider vs. do-it-yourself

| | **Managed (recommended)** | **Do-it-yourself** |
|---|---|---|
| What it is | Supabase / Neon / Firebase host and run the DB | You run Postgres on your own server/VM |
| You worry about | Almost nothing — patches, uptime, backups handled (or one toggle) | OS patches, security, uptime, backups, scaling — all yours |
| Backups | A toggle (or an export script on free tier) | You build and test the whole backup system |
| Cost | Free tier → small monthly | A server bill + your time |
| Right for newbies? | **Yes** | Only if you specifically need it |

> **Recommendation for a first launch:** go **managed**, and most of the time go **Supabase** — it folds the database, auth, storage, and RLS into one dashboard, which is the smallest number of moving parts for a vibe coder.

---

## 10. Gotchas (the things that bite beginners)

- **Serverless connection pooling** — if your app runs on **serverless / edge** (Vercel functions, Netlify, Lambda, edge runtimes), each invocation can open a new database connection and you'll quickly **exhaust the connection limit** ("too many connections" / "remaining connection slots" errors). Fix: use the **pooled** connection string. On Supabase that's the **Supavisor pooler in transaction mode** (port **6543**), *not* the direct connection (port 5432). Tell your assistant *"this runs on serverless — use the pooled/transaction connection string."*
- **Secrets leaking into git** — the #1 way databases get hacked. The connection string ends up committed once and bots scrape it within minutes. Keep `.env` in `.gitignore`; if it ever leaks, **rotate the password immediately** (§5).
- **"No backups = permanent data loss"** — assuming backups are automatic when they aren't (Supabase free tier!). Verify on launch day and schedule your own export if needed (§7).
- **N+1 queries** — asking the database 100 separate times in a loop ("get this user… now get *their* orders one… by… one") instead of once. It's slow and can crash under load. If the app feels sluggish on a list page, tell your assistant *"check for N+1 queries here"* — an ORM or a single joined query fixes it.
- **Storing files in the database** — don't put images, videos, or PDFs *inside* the database. It bloats and slows it, and backups balloon. Put **files in object storage** (Supabase Storage, S3, Firebase Storage) and store just the **URL/path** in the database row. Files in object storage, *facts* in the database.
- **Forgetting RLS** — shipping with RLS off (table leaks everything) or on with no policies (table returns nothing). Neither is what you want — insist on real policies (§6).

---

## 11. Cross-references (the rest of the library)

- **[`AUTH_GUIDE.md`](AUTH_GUIDE.md)** — login. With Supabase, **auth and the database are one platform**, which is what makes RLS tie each row to the logged-in user. Set up auth and database together.
- **[`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md)** — your **export** and **delete-my-account** paths live in the database; a clean schema makes "give me / erase my data" requests painless.
- **[`PAYMENTS_GUIDE.md`](PAYMENTS_GUIDE.md)** — **store entitlements in your database, not in the client.** Whether a user is "Pro" must live server-side in *your* database (written from a verified webhook), never trusted from the phone/browser, which can be faked.

---

## 12. Official sources (verify the latest — pricing and limits change)

- Supabase — Connect to your database (connection strings, pooler): https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase — Supavisor connection terminology (transaction vs session mode): https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO
- Supabase — Database backups: https://supabase.com/docs/guides/platform/backups
- Supabase — Point-in-Time Recovery: https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase — Pricing: https://supabase.com/pricing
- Neon (serverless Postgres) docs: https://neon.com/docs/introduction
- Firebase / Firestore docs: https://firebase.google.com/docs/firestore
- Turso (edge SQLite) docs: https://docs.turso.tech
- Prisma (ORM — schema + migrations): https://www.prisma.io/docs
- Drizzle (ORM — schema + migrations): https://orm.drizzle.team/docs/overview

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`) — a reusable, plain-language launch playbook for newbie vibe coders. Last reviewed 2026-05. Provider pricing, free-tier limits, and backup policies change; the official sources above are the source of truth.*
