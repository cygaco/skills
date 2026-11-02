---
guide: DEPLOYMENT_INFRA
anchor: lastmile:module/deployment
shape: checklist
timing: at-module
lead_time: "domain/DNS, provider verification, production smoke tests, rollback setup, and app-store or mobile build pipelines can take hours-days; start before launch week"
---

# DEPLOYMENT_INFRA_GUIDE.md - Put Your App Online Without Drama (for Total Newbies)

> Deployment is the step where your app leaves your laptop and becomes a real thing people can visit. Infrastructure is the boring machinery that keeps it there.
>
> The goal for a first launch is not clever infrastructure. The goal is **boring, reliable, reversible** deployment.

---

## 1. ELI5 - what is deployment?

Your code is a recipe. Deployment is putting that recipe in a kitchen that is open to the public.

For a web app, that usually means a hosting platform like Vercel, Netlify, Render, Railway, Fly, or Cloudflare. For a mobile app, it means a build/submission pipeline like Expo EAS plus Apple/Google review. For a backend/API, it means a server or function host with environment variables, logs, and rollback.

---

## 2. Pick the boring host first

| App type | Simple default | Why |
|---|---|---|
| Next.js / React web app | Vercel or Netlify | Fast setup, previews, env vars, rollback |
| Plain backend/API | Render, Railway, Fly, or existing platform | Clear logs and managed deploys |
| Cloudflare-style edge app | Cloudflare Pages/Workers | Good when the app is already built for edge |
| Expo mobile app | Expo EAS | Build and submit pipeline for iOS/Android |
| Desktop app | Existing app-builder release flow | Signing/updates matter more than hosting |

Do not choose Kubernetes, multi-region databases, custom servers, or a microservice fleet for a first pre-PMF launch unless the product has a named reason.

---

## 3. The pieces you need

| Piece | Plain-English meaning |
|---|---|
| Build command | The command that turns code into something deployable |
| Environment variables | Secrets and settings your app reads at runtime |
| Preview deploy | A temporary URL for testing a branch before production |
| Production deploy | The real public version |
| Domain/DNS | Your custom URL and the records that point it at the host |
| Logs | Where you see crashes and errors after launch |
| Rollback | A button/procedure to return to the last known-good version |
| Smoke test | A tiny checklist proving the live app actually works |

---

## 4. What YOU must do

| Task | Why AI cannot own it |
|---|---|
| Create the hosting account | It uses your identity/billing |
| Add or verify a domain | It lives in your registrar/DNS dashboard |
| Paste production secrets into the host's secret manager | They are your real credentials |
| Approve a production migration or live deploy gate | It can affect real users/data |
| Decide when to roll back | It is a business/user-impact call |

Your assistant can produce exact instructions and checklists, but you control the dashboards.

---

## 5. What AI can build

Ask your assistant for the boring deployment surface:

```
Add production deployment readiness: document the build command, required environment variables, preview/production deploy steps, production smoke test, rollback steps, and safe log locations. Make the app fail clearly when required env vars are missing, without printing secret values.
```

Good AI-built deployment work includes:

- a `.env.example` with names only, never secret values
- build command documentation
- health check or simple smoke route when appropriate
- startup checks for required env vars
- production-safe error messages
- rollback instructions in release notes
- tests that do not require real production credentials

---

## 6. Environment variables and secrets

Environment variables are the safe place for secrets in a deployed app.

| Do | Do not |
|---|---|
| Put real keys in the host dashboard secret manager | Commit real keys to git |
| Keep `.env.local` untracked | Paste secrets into public chats/screenshots |
| Use `.env.example` with placeholder names | Put a real key in `.env.example` |
| Rotate a key if it leaks | Pretend a leaked key is harmless |

If a value starts with `sk_`, `sk-`, includes a password, or grants API access, treat it as a secret.

---

## 7. Production smoke test

Before you tell users to use the app, run the smallest real test that proves the important path works.

```
PRODUCTION SMOKE TEST
[ ] Production URL loads
[ ] Login/signup works
[ ] Main page/action works
[ ] Database write/read works if the app saves data
[ ] Payment test or live penny-path is verified only when approved
[ ] Email sends to a real inbox if email is part of the product
[ ] Logs show no repeated server errors
[ ] Analytics receives expected events, if analytics is installed
[ ] Rollback target is known
```

The smoke test is not the full QA suite. It is the "is the live kitchen open and serving food?" check.

---

## 8. Rollback plan

Every launch needs a way back.

Write down:

- last known-good commit or deployment
- where the rollback button/command is
- what database migrations were applied
- whether the migration is reversible
- who decides to roll back
- how to tell users if the issue was visible

If the deploy includes a production database migration, rollback is harder. See [`DATABASE_GUIDE.md`](DATABASE_GUIDE.md) and require explicit approval before applying it.

---

## 9. Launch checklist

```
DEPLOYMENT / INFRA
[ ] Host account created
[ ] Build command documented and tested
[ ] Required env vars listed in .env.example with placeholders only
[ ] Production secrets entered into host secret manager
[ ] Preview deploy works
[ ] Production deploy works
[ ] Custom domain/DNS verified if used
[ ] Logs are easy to find
[ ] Smoke test checklist exists and has been run
[ ] Rollback target and rollback steps are written down
[ ] No production migration or live-mode switch runs without explicit approval
```

---

## 10. Cross-references

- [`DATABASE_GUIDE.md`](DATABASE_GUIDE.md) - migrations, backups, and production database care.
- [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md) - secrets, headers, rate limits, and hardening.
- [`EMAIL_GUIDE.md`](EMAIL_GUIDE.md) - DNS records can block email deliverability.
- [`ANALYTICS_TELEMETRY_GUIDE.md`](ANALYTICS_TELEMETRY_GUIDE.md) - verify live events after deploy.

---

## 11. Official sources

- Vercel deployment docs: https://vercel.com/docs/deployments
- Netlify deployment docs: https://docs.netlify.com/site-deploys/overview/
- Cloudflare Pages docs: https://developers.cloudflare.com/pages/
- Render docs: https://render.com/docs
- Railway docs: https://docs.railway.com
- Fly.io docs: https://fly.io/docs/
- Expo EAS docs: https://docs.expo.dev/eas/

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Hosting dashboards, limits, and DNS behavior change; verify current provider docs before launch.*
