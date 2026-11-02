# BAAS_DECISION_MATRIX

## Purpose

Give you and your AI a simple default for choosing the app's backend foundation before product-market fit.

## Default call

For a typical web SaaS or AI tool, prefer a managed, boring stack:

- Supabase when the product benefits from one service for Postgres, auth, storage, and row-level security.
- Neon/Postgres plus a separate auth provider when the team wants plain Postgres and a cleaner split of concerns.
- Firebase/Firestore when mobile realtime/offline sync is a central product requirement.
- SQLite/Turso when the app is tiny, local-first, edge-oriented, or mostly single-user.
- Existing stack when the repo already has a coherent database/auth/storage setup.

Do not add a second database/auth/storage provider just because a tutorial suggests it.

## Decision fields a build spec should include

- chosen provider(s)
- why this provider fits the current product stage
- what it owns: database, auth, storage, realtime, files
- what it does not own
- migration/backup/export path
- known constraints and limits
- what evidence would trigger a revisit

## Rules

- `STACK-BAAS-01 PASS`: A spec names the chosen backend/storage/auth providers and what each owns.
- `STACK-BAAS-02 FAIL`: Code introduces a second provider for the same responsibility without a spec decision.
- `STACK-BAAS-03 PASS`: Pre-PMF choices prefer managed services over custom servers unless the spec names a real constraint.
- `STACK-BAAS-04 WARN`: A provider choice is plausible but lacks backup/export or migration notes.
- `STACK-BAAS-05 FAIL`: The implementation stores product-critical data only in client/local storage when the product requires durable multi-user state.
- `STACK-BAAS-06 PASS`: Backend code uses the declared provider's idioms instead of bypassing them with ad hoc side channels.

*Last reviewed: 2026-06.*
