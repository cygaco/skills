# STACK_DRIFT_AND_REVERSIBILITY

## Purpose

Prevent silent stack drift. A pre-PMF stack can change, but the change must be visible and reversible enough that a founder is not trapped by hidden infrastructure choices.

## What drift looks like

- Adding Clerk while Supabase Auth is already the declared auth layer.
- Adding Firebase for one feature while Postgres is the declared source of truth.
- Writing raw provider calls in many files instead of a small adapter/wrapper.
- Moving business truth into webhooks, analytics, or client storage with no database source.
- Depending on provider-only features without documenting the lock-in.

## Reversibility patterns

- Keep provider SDK calls behind small project wrappers where practical.
- Store business truth in the app database, not in the browser or analytics tool.
- Put migrations in files and keep export/backup commands documented.
- Keep environment variables named by responsibility, not by temporary experiment.
- Record the decision and revisit trigger in the build spec.

## Rules

- `STACK-REV-01 PASS`: Provider-specific code is either isolated behind wrappers or intentionally limited to integration boundary files.
- `STACK-REV-02 FAIL`: A diff adds a new source of truth for users, plans, entitlements, or core records without declaring ownership.
- `STACK-REV-03 WARN`: The implementation uses provider-specific features heavily but does not document migration/export implications.
- `STACK-REV-04 PASS`: Secrets and connection strings are injected through env vars, never committed.
- `STACK-REV-05 FAIL`: A reviewer finds two systems claiming to own the same durable product fact.
- `STACK-REV-06 PASS`: The build spec states what evidence would justify switching providers later.

*Last reviewed: 2026-06.*
