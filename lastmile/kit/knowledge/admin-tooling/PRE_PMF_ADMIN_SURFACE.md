# PRE_PMF_ADMIN_SURFACE

## Purpose

Help you and your AI scope a launch-stage admin surface to the smallest useful set: support, safety, and product learning.

## Useful first surfaces

- founder/admin allowlist
- user lookup
- user/account detail
- entitlement read view
- recent event feed
- feature kill switch for risky/expensive features
- support notes/status
- audit trail

## Overbuild to refuse pre-PMF

- complex RBAC matrices
- bulk operations
- refund/cancel automation
- custom CRM
- internal analytics dashboards that duplicate a provider
- broad data browser over production tables
- impersonation without a specific support need and focused review

## Rules

- `ADMIN-SCOPE-01 PASS`: Admin requirements name the user/support/product-learning job they serve.
- `ADMIN-SCOPE-02 FAIL`: A spec adds broad RBAC, bulk ops, refunds, impersonation, or destructive actions without a named current need.
- `ADMIN-SCOPE-03 PASS`: Read-only user/account/entitlement views are preferred before mutating admin actions.
- `ADMIN-SCOPE-04 WARN`: The admin surface is useful but lacks a feature kill switch for expensive/risky integrations.
- `ADMIN-SCOPE-05 FAIL`: Admin tooling becomes the source of truth for entitlements instead of reading verified payment/database state.

*Last reviewed: 2026-06.*
