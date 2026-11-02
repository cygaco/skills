> v1 baked-in playbook — refresh it against current sources before relying on its numbers.

# Last-Mile Default Stacks

The reference `/lastmile` loads for stack choices. This is the **stack-selection brain**: given a prototype's profile, pick the shortest *safe* path to a paid launch. Written for non-technical founders and for the routing logic of `/lastmile`. Cite it as `.claude/lastmile/playbooks/default-stacks.md`. Stack picks land in `last-mile/LAUNCH_PLAN.md`.

`/lastmile` detects the profile from the existing codebase (framework, deps, package manifests), then proposes the matching row below as the default. The founder confirms or overrides. **No green-field rewrites** — adapt the prototype that already works.

## The one rule that governs everything

**The shortest *safe* path to a paid launch wins.** A founder is here to get *paid*, not to build a platform. Every stack choice is judged against: can a non-technical founder set this up with strong docs, low ops burden, and a free/cheap tier to start? If yes, it is the default. If it requires a DevOps hire, it is refused at v1.

## Easy-default stack per profile

Each row is the **opinionated default**. Pick the alternative only when a deviation trigger (bottom of doc) actually fires — with named, evidence-backed justification, not a hunch.

### web-saas (Next.js, the canonical default)

| Concern | Default | Why |
|---|---|---|
| Database | Supabase **or** Neon (Postgres) | Managed Postgres, generous free tier, branching (Neon) or batteries-included (Supabase). |
| Auth | Clerk **or** Supabase Auth | Drop-in UI, social + email, sessions handled. Clerk if you want polished components fast; Supabase Auth if already on Supabase. |
| Payments | Stripe | The default for SaaS billing everywhere; see monetization-patterns.md. |
| Hosting | Vercel | Native Next.js host, preview deploys, zero-config, free hobby tier. |
| Analytics | PostHog **or** Plausible | PostHog for product analytics + funnels; Plausible for simple privacy-friendly traffic. |
| Email | Resend **or** Loops | Resend for transactional (React Email); Loops for lifecycle/marketing sequences. |

*Rationale: one framework, one host, one billing rail. A founder ships from `git push` and gets paid the same week.*

### Simpler MVP (when even the above is too much)

| Concern | Default | Why |
|---|---|---|
| Database + Auth | Supabase (both in one) | One dashboard, one SDK — db, auth, storage, row-level security together. |
| Payments | Stripe **Checkout** (hosted) | No custom payment UI — redirect, collect, done. Lowest-code path to revenue. |
| Hosting | Vercel | Same `git push` deploy. |
| Analytics | Plausible (or none at launch) | Don't block launch on analytics; add after first paying user. |
| Email | Resend | Transactional receipts + magic links only, to start. |

*Rationale: collapse the stack to three vendors. This is the **starting recommendation for most vibe-coder prototypes** — graduate to the full web-saas row only when traction demands it.*

### mobile-app

| Concern | Default | Why |
|---|---|---|
| Database + Auth | Supabase | Same backend works for web and mobile; one SDK. |
| Framework | Expo (React Native) | Managed builds, OTA updates, no native toolchain headaches. |
| Payments | Stripe where supported, else native **IAP** (StoreKit / Play Billing) | Apple/Google require IAP for digital goods sold in-app — plan for it, don't fight it. |
| Build / Submit | EAS Build + EAS Submit | Cloud builds and store submission without a Mac farm. |
| Analytics | PostHog (mobile SDK) | Funnels + retention across sessions. |
| Email | Resend | Transactional + onboarding. |

*Rationale: Expo + Supabase + EAS is the lowest-ops mobile path; IAP is a legal/store reality, not an option, for in-app digital purchases.*

### desktop-app

| Concern | Default | Why |
|---|---|---|
| Database | SQLite (local) + Supabase (sync, if needed) | Local-first is simplest; add cloud sync only when multi-device is a real need. |
| Auth | Clerk **or** Supabase Auth (device flow) | Reuse web auth; avoid rolling your own. |
| Payments | Stripe (web checkout via license key) | Sell a license on the web, unlock the app — sidesteps store cuts. |
| Hosting / Distribution | Tauri (preferred) or Electron + auto-update | Tauri = small binaries, low memory; Electron if you need its ecosystem. |
| Analytics | PostHog (opt-in) | Respect desktop privacy expectations; make telemetry opt-in. |
| Email | Resend | License delivery + receipts. |

*Rationale: license-on-web + unlock-in-app keeps 100% of revenue and avoids store review latency.*

### ai-tool

| Concern | Default | Why |
|---|---|---|
| Database | Supabase **or** Neon | Store prompts, runs, usage rows for metering. |
| Auth | Clerk | Fast, and pairs cleanly with per-user usage metering. |
| Payments | Stripe **usage-based** or **credit-based** | AI cost scales with usage; bill for it. See monetization-patterns.md. |
| Hosting | Vercel (+ provider APIs) | Edge/serverless for the app; LLM calls go to provider APIs. |
| Analytics | PostHog | Track tokens, run success, conversion. |
| Email | Resend / Loops | Receipts + credit-low warnings + lifecycle. |
| Cost control | Usage caps + per-key spend limits | **Mandatory** — uncapped AI spend bankrupts a solo founder. |

*Rationale: AI margins die without metering. Default to usage- or credit-based billing and hard spend caps from day one.*

### marketplace

| Concern | Default | Why |
|---|---|---|
| Database | Supabase / Neon (Postgres) | Relational integrity for listings, orders, two-sided users. |
| Auth | Clerk / Supabase Auth | Same as SaaS. |
| Payments | **Stripe Connect** | Purpose-built for paying out third-party sellers; handles KYC, splits, payouts. |
| Hosting | Vercel | Standard. |
| Analytics | PostHog | Two-sided funnels (supply + demand). |
| Email | Resend + Loops | Transactional (orders) + lifecycle (re-engagement). |

*Rationale: Stripe Connect is the one non-negotiable — never hand-roll seller payouts, KYC, or fund splitting.*

### content-community

| Concern | Default | Why |
|---|---|---|
| Database | Supabase | Posts, comments, memberships, storage in one place. |
| Auth | Supabase Auth / Clerk | Social login lowers signup friction for communities. |
| Payments | Stripe **subscriptions** (membership tiers) | Recurring access is the model; gate content by tier. |
| Hosting | Vercel | Standard. |
| Analytics | Plausible + PostHog | Traffic (Plausible) + engagement/retention (PostHog). |
| Email | Loops (primary) + Resend | Newsletters/digests drive retention; Loops owns lifecycle. |

*Rationale: communities live or die on retention email + tiered access — lead with Loops and subscription gating.*

### internal→external (productizing an internal tool)

| Concern | Default | Why |
|---|---|---|
| Database | Keep existing (likely Postgres) → Supabase/Neon if migrating | Don't migrate data unless forced; wrap what works. |
| Auth | **Add** Clerk / Supabase Auth | Internal tools often have no real auth — this is the #1 gap to close before exposure. |
| Payments | Stripe | New surface; bolt on billing. |
| Hosting | Vercel (or keep current if stable) | Move only if current hosting can't take public traffic. |
| Analytics | PostHog | You now need conversion data you never tracked internally. |
| Email | Resend | Onboarding + receipts for external users. |
| Hardening | Rate limits, RLS/authz, secrets audit | **Required** — internal trust assumptions don't survive contact with the public. |

*Rationale: the work here is mostly *hardening and auth*, not new features. Externalizing trust is the real last mile.*

## Do NOT overbuild

This is a refusal rule, enforced in the reasoning of `/lastmile`. The following are **rejected by default** and require a named, evidence-backed need before `/lastmile` will propose them:

- **Microservices** — refused. A modular monolith ships faster and is easier to operate. Split only under measured scaling pain.
- **Kubernetes / self-managed orchestration** — refused. Vercel/managed hosting until you have a platform team.
- **Custom auth / rolled-your-own crypto** — refused, always. Use Clerk or Supabase Auth. Hand-rolled auth is a security incident waiting to happen.
- **Heavy CRM (Salesforce-class)** — refused pre-traction. A spreadsheet or Loops covers early lifecycle.
- **Multi-region / global replication** — refused until latency or compliance *data* demands it.
- **Self-hosted database / bespoke infra** — refused. Managed Postgres (Supabase/Neon) until cost or scale forces a move.
- **Event buses, queues, data warehouses, GraphQL gateways** — refused at v1 unless a concrete bottleneck is documented.

> If a founder *wants* heavy infra "to be ready for scale," the answer is: **get paid first.** You can re-platform a profitable product. You cannot re-platform a dead one.

## When to deviate from the default

Override the default row **only** when one of these concrete triggers fires, and record the trigger in the generated stack doc:

| Trigger (evidence required) | Deviation it justifies |
|---|---|
| Selling **digital goods in-app** on iOS/Android | Native IAP instead of (or alongside) Stripe. |
| **Paying third-party sellers** | Stripe Connect (marketplace row), not plain Stripe. |
| **Strict data residency / compliance** (HIPAA, EU-only) named in writing | Region-pinned hosting/db; possibly self-host. Not before. |
| **AI/compute cost** is a material share of revenue | Usage- or credit-based billing + hard spend caps. |
| Measured **scaling pain** (real traffic numbers, not hopes) | Read replicas, caching, then — last — service extraction. |
| Existing prototype already on a **different stable stack** | Keep it; adapt rather than rewrite. Don't migrate for taste. |
| **Offline-first / local-first** is a core product requirement | SQLite/local store + optional sync. |

Absence of a trigger = use the default. The burden of proof is on deviation, never on the simple path.
