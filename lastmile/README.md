# lastmile

Your app runs. It does not make money yet. `/lastmile` finds what stands between your repo and the first paid customer, then works through it with you, safely.

## What it does

One command, five steps. It reviews your repo and scores it 0–100 across 9 areas, asks "Do you want me to build a plan?", writes the plan with the slow-clock tasks first, asks "Get started?", then works through the plan with you, one task at a time.

At every step only a human can do, it tells you exactly what to do, then carries on with work that does not depend on it. It stops at every risky production action. The 8 gates: switching payments live, a production database migration, domain or DNS changes, provisioning a server, an App Store or Google Play submission, emailing real users, collecting sensitive data, and publishing legal docs.

How it behaves:

- A bare `/lastmile` starts with the review. If `last-mile/LAUNCH_PLAN.md` already exists with open tasks, it first asks one question: resume that plan at the first unchecked task, or run a fresh review. `/lastmile resume` asks the same question. Resume is only offered when that file exists.
- `/lastmile review` starts with a fresh review even if you already have a plan, then carries on with the usual questions. `/lastmile plan` builds the plan from the saved review, and runs the review first if there is none.
- The 9 areas are product, technical, security, privacy, monetization, funnel, deployment, analytics and support. The review infers what kind of app you have; `--profile <name>` sets it instead (web-saas, mobile-app, desktop-app, ai-tool, marketplace, content-community, internal-external).
- Before writing the plan it may ask, in one message, up to three questions your repo cannot answer: your pricing model, whether anyone under 18 will use it, and mobile or web (only if it guessed your platform wrong or could not tell).
- Every plan task is a checkbox marked 🔴 (only you can do it) or 🤖 (the AI can do it). A task that crosses a gate also carries ⛔ and the gate's name.
- For a 🤖 task the AI makes small, reversible changes, runs your tests or build if you have them, ticks the task and tells you which files changed.
- A 🔴 task is ticked only when you say that task is done. While you work on one, the AI keeps going with tasks that do not need it. A gate task waits for your explicit yes for that gate. Then the AI does the step, or walks you through it if it happens in a dashboard only you can reach, confirms it with a check (a test payment, a lookup, a smoke test) and ticks it. Neither is ever ticked because you went quiet or said "keep going".
- If the review finds signs of sensitive data, the plan's first task becomes "Legal/security review by a qualified person completed". Collecting sensitive data and publishing legal docs stay blocked until you confirm that review happened.
- Say "stop" at any time. Progress lives in the checkboxes, so `/lastmile resume` picks up where you left off.

## What you get

Two documents in your repo (it writes no other documents unless you ask):

- `last-mile/REVIEW.md`: the score out of 100 (with a sensitive-data warning at the top if it finds signs of sensitive data), the per-area scores, what each module check found and where, and the gaps, each linked to the guide that explains it. Claude checks the five most important gaps against your files and adds reviewer notes.
- `last-mile/LAUNCH_PLAN.md`: a "Start these today" section with the slow clocks that apply to your app (developer accounts, the Google Play 14-day closed test, Stripe identity and bank verification, Google OAuth verification, a D-U-N-S number, domain and DNS, email sending-domain records), then the ordered tasks, the detail for each module, the gates ahead, and the finish line: your first paid transaction in live mode. Claude then trims the skeleton with you. It ticks the AI tasks your repo already satisfies (naming the file), merges duplicates (leaving a pointer line), adds a 🔴 task wherever a guide says a step is yours (such as creating prices in your payment dashboard), and moves anything not needed before the first sale into a "Later" section, which waits until you ask for it. It never ticks a task that needs you or a gate on its own, and it deletes nothing.

If your repo has a `ROADMAP.md`, it asks before adding the launch work there. It never creates one.

Copied in with the command, under `.claude/lastmile/`:

- `guides/`: 25 plain-language launch guides (setup, database, auth, payments, email, deployment, app stores, privacy, legal, minors, security, analytics, growth and more), with the steps only you can do marked 🔴 YOU MUST DO THIS and the ones the AI can do marked 🤖 AI CAN DO THIS.
- `playbooks/`: 6 playbooks on default stacks, monetization patterns, the conversion funnel, a security/privacy baseline, acceptance criteria, and 2026 launch research notes.
- `knowledge/`: a reference library on security, compliance, growth mechanics, product telemetry, admin tooling, stack selection and conversion design.
- `scripts/` and `templates/`: the review, plan and self-check scripts, in plain Node with no dependencies. A small `package.json` marks the kit as CommonJS, so the scripts run even in a project configured for ES modules.

## Install (copy-in)

Run these from the folder that contains your app's folder. `your-app` stands for your project folder.

bash (macOS, Linux):

```bash
git clone https://github.com/<your-github-username>/skills
mkdir -p your-app/.claude/commands
cp skills/lastmile/command/lastmile.md your-app/.claude/commands/lastmile.md
cp -r skills/lastmile/kit your-app/.claude/lastmile
```

Windows PowerShell:

```powershell
git clone https://github.com/<your-github-username>/skills
New-Item -ItemType Directory -Force your-app/.claude/commands | Out-Null
Copy-Item skills/lastmile/command/lastmile.md your-app/.claude/commands/lastmile.md
Copy-Item -Recurse skills/lastmile/kit your-app/.claude/lastmile
```

Then confirm the install:

```
node your-app/.claude/lastmile/scripts/selfcheck.js
```

It prints one line per check and exits 0 when nothing failed.

To update later, delete `your-app/.claude/lastmile` first, then copy again. Copying a folder onto one that already exists nests it inside.

## 60-second demo

```
cd your-app
claude    # starts Claude Code
```

Then type `/lastmile`. What happens:

1. Claude runs `node .claude/lastmile/scripts/review.js`, which writes `last-mile/REVIEW.md`.
2. Claude opens the files behind the top gaps, confirms or corrects each one, and adds reviewer notes.
3. You see the score out of 100 and the three to five gaps that block a paid launch soonest, each with one sentence on why it matters and the guide that explains it.
4. Claude asks: "Do you want me to build a plan?"

What the review step looks like. This is real output from a small sample app: Next.js with Supabase and Stripe, an unverified Stripe webhook, and no auth.

```
$ node .claude/lastmile/scripts/review.js
lastmile review: launch-readiness 48/100 (profile: web-saas)
gaps: 10
sensitive-data escalation: no
wrote: last-mile/REVIEW.md
```

And an excerpt of the `last-mile/REVIEW.md` it wrote (each `…` marks a cut):

```
…
## Launch-Readiness Score: 48/100

### Dimensions

| Dimension | Score |
|---|---|
| product | 80/100 |
| technical | 80/100 |
| security | 40/100 |
| privacy | 30/100 |
| monetization | 75/100 |
| funnel | 40/100 |
| deployment | 40/100 |
| analytics | 20/100 |
| support | 25/100 |

… (the module readiness table)

### Gaps — shortest safe path to a paid launch

- **technical** — no deployment config detected — guide: DEPLOYMENT_INFRA_GUIDE.md · DATABASE_GUIDE.md
- **security** — no auth provider — accounts unprotected — guide: AUTH_GUIDE.md · SECURITY_GUIDE.md
- **security** — payment webhook signature NOT verified (forgeable events) — guide: PAYMENTS_GUIDE.md · SECURITY_GUIDE.md · AUTH_GUIDE.md
- **privacy** — no account deletion path (data-subject right) — guide: DATA_REQUESTS_GUIDE.md · PRIVACY_GDPR_GUIDE.md
- **privacy** — no data export path (portability) — guide: DATA_REQUESTS_GUIDE.md · PRIVACY_GDPR_GUIDE.md
… (5 more gaps: monetization, funnel, deployment, analytics, support)
```

In the real file each guide name is a link into `.claude/lastmile/guides/`.

## Run just the review, without Claude

From your app's root folder:

```
node .claude/lastmile/scripts/review.js
node .claude/lastmile/scripts/review.js --json
```

The first writes `last-mile/REVIEW.md` and prints a short summary: the score, the number of gaps and whether sensitive data was flagged. `--json` also writes the file, and prints the results as JSON instead of the summary. Both accept `--profile <name>`. This is the automated pass only; the reviewer notes, the plan and the guided work come from `/lastmile` inside Claude Code.

## Safety

- It never does any of these without your explicit yes for that specific action, asked at the moment it comes up: switch payments live, migrate a production database, change domain or DNS records, provision a server, submit to the App Store or Google Play, email real users, start collecting sensitive data, or publish a privacy policy or terms as final legal documents.
- Before each of those it tells you what will happen, why it is risky and how to undo it. "Go ahead with everything" does not count as a yes for any of them.
- It never commits, pushes, deploys or publishes unless you ask for that specific action.
- It never calls your product "launch ready" or "compliant", and it never inflates the score.
- It is not legal advice. For health, finance, children under 13, biometrics or other regulated data, the answer is: stop and talk to a lawyer before launch.

## Uninstall

Delete `.claude/commands/lastmile.md` and `.claude/lastmile/` from your app. Optionally delete `last-mile/` too; it holds your review and plan. From your app's root folder:

```bash
rm -rf .claude/commands/lastmile.md .claude/lastmile
```

```powershell
Remove-Item -Recurse -Force .claude/commands/lastmile.md, .claude/lastmile
```

## Requirements

- Claude Code
- Node 20 or newer
- git, to clone this repo (or download it as a ZIP)

Tested on Windows. CI runs Linux and Windows. macOS is untested, but the scripts are plain Node with no native code.
