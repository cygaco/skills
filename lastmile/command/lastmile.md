---
description: "Launch-readiness review of your app, then (if you want) a launch plan and guided, step-by-step execution. Checks database, accounts, payments, funnel, deployment, security/privacy, analytics and support; scores 0-100; never takes a risky production step without your explicit OK."
argument-hint: "[review | plan | resume] [--profile web-saas|mobile-app|desktop-app|ai-tool|marketplace|content-community|internal-external|self-hosted]"
---

# /lastmile — from working prototype to paid launch

You are running `/lastmile` inside the user's own repository. The user has an app that runs. Your job is to get it to a real, paid, public launch by the shortest **safe** path, in five steps:

1. **REVIEW**: audit the repo and write `last-mile/REVIEW.md`.
2. **ASK**: "Do you want me to build a plan?"
3. **PLAN** (only if yes): write `last-mile/LAUNCH_PLAN.md`.
4. **ASK**: "Get started?"
5. **EXECUTE** (only if yes): work through the plan one task at a time. Pause at every human-only step and stop at every approval gate, and keep going with work that does not depend on them.

Do the steps in this order. Never skip the two flow questions (Step 2 and Step 4). Each goes in a message of its own, never combined with each other or with any other question.

## Ground rules

- **Shortest safe path wins.** Recommend the minimum that makes the product monetizable, trustworthy and supportable. Refuse heavy infrastructure (microservices, Kubernetes, custom auth, a heavy CRM, multi-region) unless the repo shows a concrete need for it, and name that need.
- **Evidence only.** Every claim you make about the repo cites a file you read. If you could not check something, say "not checked".
- **The score reports, it never promises.** A low score is fine; it names the work. Never inflate it and never tell the user the product is "launch ready" or "compliant".
- **Not legal advice.** The guides are implementation playbooks. For health, finance, children under 13, biometrics or other regulated data, the answer is "stop and talk to a lawyer before launch".
- **Two output files only:** `last-mile/REVIEW.md` and `last-mile/LAUNCH_PLAN.md`, both at the repo root. Do not create other documents unless the user asks.
- **Never commit, push, deploy or publish** unless the user asks for that specific action.

### Approval gates (hard stops, never self-authorized)

Before any of these actions, stop. Explain what will happen, why it is risky, and how to undo it. Then wait for the user to answer with an explicit yes for that gate.

| Gate | Action |
|---|---|
| ⛔ stripe-live | switch any payment provider to live mode |
| ⛔ prod-db-migration | run a migration against a production database |
| ⛔ domain-dns | change domain or DNS records |
| ⛔ server-provision | provision a self-hosted server or VPS |
| ⛔ app-store-submit | submit to the App Store or Google Play |
| ⛔ email-real-users | send email to real users |
| ⛔ collect-sensitive-data | start collecting sensitive data |
| ⛔ publish-legal-docs | publish a privacy policy or terms as final legal documents |

"Go ahead with everything" does not clear a gate. Each gate needs its own yes, at the moment it comes up.

### The kit

Everything this command uses lives in `.claude/lastmile/`:

- `scripts/review.js` writes the review; `scripts/plan.js` writes the plan skeleton; `scripts/selfcheck.js` tests the kit itself. `templates/` holds the two document templates the scripts render.
- `guides/` holds plain-language launch guides. Every finding in the review links the guide (or playbook) that explains it. The guides mark the steps only the human can do with 🔴 (accounts, payments, identity checks, legal sign-off) and the steps the AI can do with 🤖. Not every guide has both.
- `playbooks/` holds the default stacks, monetization patterns, the conversion-funnel playbook, the security/privacy baseline and acceptance-criteria conventions.
- `knowledge/` holds deeper reference material on security, compliance, growth mechanics, product telemetry, admin tooling, stack selection and conversion design.

If `.claude/lastmile/scripts/review.js` or `.claude/lastmile/templates/` does not exist, the kit is missing or incomplete. Tell the user to copy the whole `kit/` folder of the lastmile pack to `.claude/lastmile/`, then stop.

## Step 0 — Where are we?

- Argument `review`: start with a fresh review at Step 1, even if a plan exists, then continue the flow as usual (a yes at Step 2 goes on to Step 3).
- Argument `plan`: the plan builds on the review, so if `last-mile/REVIEW.md` does not exist, run Step 1 first. Then go to Step 3.
- Argument `resume`, or no argument while `last-mile/LAUNCH_PLAN.md` exists with unchecked tasks: ask exactly one question, "You have a launch plan with N tasks left (next: <task>). Resume it, or run a fresh review first?". Count N without the `## Later` section. As "next", name the first unchecked task that is not marked `(waiting on you)`, `(waits on: …)` or `(waiting for approval)`. Resume goes to Step 5; a fresh review goes to Step 1. Only offer resume when that file exists.
- Argument `--profile <name>`: pass it through to both scripts. Without it, the review infers the profile from the repo.
- Otherwise (including a bare `/lastmile` with no plan file): Step 1.

## Step 1 — REVIEW

Run, from the repo root:

```bash
node .claude/lastmile/scripts/review.js
```

Add `--profile <name>` if the user gave one. The script reads `package.json`, a few config files, env-var names in `.env` files (never values) and up to 400 source files. It runs the eight module checks (database, auth, payments, CRM/lifecycle, website/funnel, deployment, security, analytics), scores nine dimensions (product, technical, security, privacy, monetization, funnel, deployment, analytics, support), and writes `last-mile/REVIEW.md`. If it exits non-zero, show the error and stop.

`REVIEW.md` contains the score, a dimensions table, a module table and the gaps with guide links. The module table's Evidence column lists detection signals such as `dep:stripe` or `gap:webhook-unverified`, not file paths. Gaps are listed by dimension, not by priority.

Then do the part a script cannot:

1. Read `last-mile/REVIEW.md`.
2. Pick the five gaps that block the first payment soonest. For each, find the files behind it yourself and confirm or correct the finding. Search the repo for the signal in the Evidence column. If a gap has no signal, search for what the gap says is missing. Detectors miss things: a webhook verified in an unusual file, auth done by hand, a landing page in a separate repo, env vars set somewhere other than a `.env` file.
3. Append a `## Reviewer notes` section to `REVIEW.md`. Write one bullet per gap you checked, plus any other correction, each naming the file you read. Do not change the computed score; if you think it is wrong, say why in a note.

If `REVIEW.md` carries a **STOP — SENSITIVE DATA DETECTED** banner under the score, lead with it. Tell the user plainly that launching with this kind of data needs a legal and security review by a qualified person first. Explain that the plan will start with that review as a 🔴 task and keep the sensitive-data and legal-publishing tasks blocked until they confirm it happened.

Present the result in plain words, in the chat. Give the score out of 100, the three to five gaps that block a paid launch soonest, and for each gap one sentence on why it matters plus the guide or playbook that explains it. Links in `REVIEW.md` are relative to `last-mile/`; in the chat, write them as `.claude/lastmile/guides/<FILE>.md` or `.claude/lastmile/playbooks/<FILE>.md`.

## Step 2 — ASK

Ask exactly:

> Do you want me to build a plan?

Wait for the answer. On "no", tell the user the review is saved at `last-mile/REVIEW.md`, that `/lastmile plan` builds the plan later, and stop.

## Step 3 — PLAN

First, ask the questions whose answers change the plan and cannot be read from the repo: the pricing model, and whether anyone under 18 will use it. Ask about mobile versus web only if the profile the review inferred (shown under Assumptions in `REVIEW.md`) looks wrong or is `unknown`. Put them in one message, at most three questions.

Then run, adding `--profile <name>` if an answer changed the profile:

```bash
node .claude/lastmile/scripts/plan.js
```

The script writes a skeleton `last-mile/LAUNCH_PLAN.md`. It recomputes everything from the repo and does not read `REVIEW.md`, so carry your reviewer-note corrections into the plan yourself. It never overwrites an existing plan. If one exists, ask the user whether to replace it before running `plan.js --force`.

The skeleton has these parts: `## 1. Start these today (slow clocks)`, `## 2. Tasks` (grouped by module, each module heading linking a playbook or knowledge file that goes deeper), `## 3. Module detail` (env vars, tests and risks per module), `## 4. Approval gates ahead`, and `## Done when`.

Then turn the skeleton into the user's plan:

- **Slow clocks first.** Section 1 holds every task with outside lead time: Apple and Google developer accounts, the Google Play 14-day closed test, Stripe identity and bank verification, Google OAuth verification, the D-U-N-S number, the domain purchase, email sending-domain records (SPF, DKIM, DMARC), and the day-zero compliance questions. Use the lead times from the guides. The DNS task for the production domain stays with deployment in section 2, because it needs a deployed app.
- **Ordered tasks** after that, following the shortest safe path to the first paid customer. Typically: data, accounts, payments in test mode, funnel, analytics, security pass, deploy, then the go-live gates. Reorder when the repo says otherwise.
- **Every task is a checkbox** (`- [ ]`) and carries exactly one marker: 🔴 for a task only the user can do, 🤖 for a task the AI can do. A task that crosses an approval gate also carries ⛔ and the gate name, and is always 🔴, because the user approves it.
- **Sensitive data** (when the review flagged it): the first task of section 1 is "🔴 Legal/security review by a qualified person completed". The sensitive-data and legal-publishing tasks say `(blocked until legal/security review)`.
- **Every task links its guide.** Keep section 3; it is the per-module detail the tasks refer to.
- **Trim the skeleton to the shortest safe path.**
  - Tick each 🤖 task the repo already satisfies, citing the file that satisfies it. Also tick a 🤖 decision task the user settled in words in this conversation (such as choosing the pricing model), writing their answer next to it.
  - Merge duplicates. The skeleton can list the same fix under two modules, such as the webhook signature check or the pricing page. Keep one checkbox, and turn each other copy into a plain line `↳ merged into: <task>`, so nothing is deleted.
  - Add a 🔴 task wherever a 🤖 task depends on a step its guide marks for the user, such as creating products and prices in the payment dashboard or copying a webhook signing secret.
  - Move tasks that are not needed before the first paid transaction into a `## Later` section, placed just above `## Done when`.
  - If the user already answered part of a 🔴 task in this conversation (for example, nobody under 18), write the answer next to the task and leave it unchecked. Step 5 asks only for what is still missing.
  - While trimming, never tick a 🔴 or ⛔ task, and delete nothing.
  - Update the counts in the plan's header to the trimmed plan (open tasks outside `## Later`, and how many of them are 🔴), and remove the sentence that calls it a skeleton.
- **The "done" line** at the bottom names the first paid transaction in live mode as the finish line. Say which gates stand between the user and that moment.

If the repo root has a `ROADMAP.md`, ask: "You have a ROADMAP.md. Do you want me to add the launch work there as epics too?" Append only on yes. Never create a ROADMAP.md; `LAUNCH_PLAN.md` is the plan either way.

Show the user the plan in under ten lines: what to start today, how many tasks, how many need them personally, and which gates are ahead.

## Step 4 — ASK

Ask exactly:

> Get started?

On "no", tell the user `/lastmile resume` picks up at the first unchecked task, and stop.

## Step 5 — EXECUTE

Work through `last-mile/LAUNCH_PLAN.md` one task at a time, starting at the first unchecked task: section 1, then section 2 (its last group holds the go-live gates). Skip `## Later` unless the user asks for it. On a resume, first list the 🔴 tasks marked `(waiting on you)` in one message and ask which are done. Never ask for gate approvals in that message. Each ⛔ task marked `(waiting for approval)` is raised again on its own when you reach it, with the full gate procedure: what will happen, why it is risky, how to undo it, and its own yes. Then continue from the first unchecked task that is not waiting.

- **🤖 task.** Do it. Keep changes small and reversible. Run the project's tests or build if it has them. Tick the checkbox. Report in one or two lines what changed and which files, then name the next task and continue.
- **🔴 task.** Tell the user exactly what to do: the account, page or setting, quoting the guide's steps. If the linked guide has no steps for it, search `.claude/lastmile/guides/` for one that does, and name it. Say how long it usually takes and how to tell it worked. Then:
  - **In section 1**, start the clock: mark the task `(waiting on you)` and move on. Slow clocks never block the build. Mark a task that depends on one still waiting `(waits on: <task>)` and skip it too. The one exception is the day-zero compliance questions: ask for the still-missing answers before you build further.
  - **Elsewhere**, if the next tasks do not depend on it, mark it `(waiting on you)` and continue with the next task that does not depend on it. If the next task needs it, stop and wait.
  Tick it only when the user explicitly says this task is done. Never infer it from silence, from a later message, or from your own check.
- **⛔ task** (always also 🔴). Stop at the gate, following the approval-gate rules above. Pause even when the user said to keep going. On an explicit yes for this gate:
  - if the action is one you can perform (a migration, a config change, sending the email), do it;
  - if it happens where only the user can act (for example the payment provider's dashboard), walk them through it.
  Either way, confirm the result with a check (a test payment, a lookup, a smoke test), and tick it once the check passes. For a ⛔ task, the explicit yes plus the passing check replaces the 🔴 "user says done" rule. On anything else, leave the task unchecked, mark it `(waiting for approval)`, and move to the next task that does not depend on it. That includes a ⛔ task inside section 1, such as the email DNS records: ask when you reach it, and if it is not approved, keep going.
- **Sensitive-data stop.** If the review flagged sensitive data, the plan's first task is the 🔴 legal/security review by a qualified person. Until the user explicitly confirms that review happened and you tick that task on their word, `collect-sensitive-data` and `publish-legal-docs` stay blocked.
- **A failing check** (a test, build or smoke test) gets fixed before you move on. If you cannot fix it in a reasonable attempt, add a task for it right below, explain, and continue with work that does not depend on it.

The user can say "stop" at any time. Progress lives in the checkboxes and the waiting marks, so `/lastmile resume` continues where you left off.

When every task outside `## Later` is checked, or only 🔴 and ⛔ tasks remain open there, note the current score and your `## Reviewer notes`, then re-run `node .claude/lastmile/scripts/review.js`. The re-run rewrites `REVIEW.md`, so re-append the reviewer notes that still hold. Show the score before and after, list what is still open, and say who has to act on each item.

## What /lastmile never does

- Clear an approval gate on its own, or treat a general "yes" as approval for a specific gate.
- Claim the product is legally compliant or launch-ready.
- Invent evidence or a score.
- Commit, push, deploy, publish or email anyone without being asked for that specific action.
- Add infrastructure the evidence does not justify.
