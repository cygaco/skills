# Tech-Stack Selection Knowledge Library

> Deeper references for you and your AI on pre-PMF stack choices. This library helps you choose boring, reversible infrastructure instead of overbuilding or silently locking a product into the wrong provider.

This is not a launch guide. The founder-facing companion is [`DATABASE_GUIDE.md`](../../guides/DATABASE_GUIDE.md), [`AUTH_GUIDE.md`](../../guides/AUTH_GUIDE.md), and [`DEPLOYMENT_INFRA_GUIDE.md`](../../guides/DEPLOYMENT_INFRA_GUIDE.md).

## How to use it

| When | How this library helps |
|---|---|
| Deciding | Declare the stack decision, its rationale, and pivot/reversibility constraints. |
| Building | Implement against the declared stack without adding duplicate providers or hidden lock-in. |
| Code review | Check backend code for provider drift, duplicate persistence/auth layers, and irreversible choices not justified by the decision. |

## References

| Ref | Rule IDs | Purpose |
|---|---|---|
| [BAAS_DECISION_MATRIX](BAAS_DECISION_MATRIX.md) | `STACK-BAAS-*` | Choose Supabase/Neon/Firebase/SQLite/existing stack with pre-PMF defaults. |
| [STACK_DRIFT_AND_REVERSIBILITY](STACK_DRIFT_AND_REVERSIBILITY.md) | `STACK-REV-*` | Keep the choice explicit, reversible, and single-sourced. |
| [MOBILE_DEV_LOOP_ON_WINDOWS](MOBILE_DEV_LOOP_ON_WINDOWS.md) | `STACK-WINMOB-*` | Keep mobile products testable from a Windows PC; the honest iOS-without-a-Mac path. |

*Last reviewed: 2026-06.*
