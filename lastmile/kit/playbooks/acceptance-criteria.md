# /lastmile — Acceptance Criteria (verification map)

> Maps each `/lastmile` acceptance criterion to the evidence that
> verifies it. The executable suite is
> `.claude/lastmile/scripts/selfcheck.js`.

| # | Acceptance criterion | verified_by |
|---|---|---|
| AC-1 | Exists as one Claude Code command with a clear contract | `.claude/commands/lastmile.md` frontmatter (description + argument hint) ; the kit in `.claude/lastmile/` (scripts, templates, guides, playbooks, knowledge) |
| AC-2 | Runs in a product repo → `last-mile/REVIEW.md` + readiness score | `scripts/review.js` ; `selfcheck.js` runs it against each holdout fixture and checks that the review is written and names the expected gap |
| AC-3 | Turns the review into a task plan, not just advice | `scripts/plan.js` writes `last-mile/LAUNCH_PLAN.md` (slow-clock section first; every task carries one of 🔴 / 🤖; gate tasks carry ⛔) ; `selfcheck.js` checks the markers |
| AC-4 | Guides execution one task at a time, and can resume | the command's EXECUTE step ; progress lives in the plan's checkboxes (`/lastmile resume`) |
| AC-5 | Human-approval gates for risky production actions | `scripts/lib/approval-gates.js` (8 gates) ; `selfcheck.js` checks all 8 gate ids and that gate tasks carry ⛔ |
| AC-6 | Security/privacy/compliance escalation rules | `scripts/modules/security.js` (HARD STOP) + `scripts/lib/score.js` caps ; sensitive data puts the STOP banner on the review and blocks the sensitive-data and legal-publishing tasks until the legal/security review is confirmed |
| AC-7 | Tests/fixtures/holdout cases for representative product states | `scripts/fixtures.js` (7 holdout cases) ; `selfcheck.js` :: one gap check per fixture |
| AC-8 | Writes only its two outputs, and never clobbers a plan | `last-mile/REVIEW.md` + `last-mile/LAUNCH_PLAN.md` only ; `plan.js` refuses to overwrite an existing plan without `--force` |
| AC-9 | Avoids stale docs | every guide, playbook and knowledge file the review links exists in the kit (`selfcheck.js` checks the guide map) |
| AC-10 | Ends with a clear final report | the command re-runs the review at the end and shows the score before and after, what is still open, and who has to act on each item |

## Holdout fixtures → gap proven

| Fixture | Gap it proves the audit catches |
|---|---|
| `no-auth` | prototype with persistence but no auth |
| `auth-no-payments` | accounts present, no monetization |
| `stripe-no-webhook-verify` | payments without verified webhooks (forgeable events) |
| `db-no-deletion-path` | data with no deletion/export (privacy gap) |
| `no-funnel` | API/app with no conversion funnel |
| `mobile-appstore` | mobile app needing app-store readiness |
| `sensitive-data-redflag` | sensitive data → forces escalation (RED gate) |

> Run `node .claude/lastmile/scripts/selfcheck.js` to re-verify (exit 0 = nothing failed).
