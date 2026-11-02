# ADMIN_SECURITY_AND_AUDIT

## Purpose

Admin pages are privileged attack targets. This reference helps you and your AI enforce access control, audit logging, and destructive-action guardrails.

## Required security posture

- Admin authorization runs server-side on every admin route and action.
- Normal users cannot reach admin data by changing client state or URLs.
- Admin membership is explicit: allowlist, role claim, or database table.
- Sensitive fields are hidden or redacted unless needed.
- Every mutating admin action writes an audit record.
- Destructive actions require confirmation and focused review.
- Admin routes have rate limiting and safe error responses.

## Audit fields

Record at least:

- actor admin id
- action type
- target user/account/resource
- timestamp
- result
- reason or note for manual changes

## Rules

- `ADMIN-SEC-01 FAIL`: Any admin route or action relies only on a client-side `isAdmin` flag.
- `ADMIN-SEC-02 PASS`: Admin authorization is checked server-side on every admin route/action.
- `ADMIN-SEC-03 FAIL`: A normal authenticated user can access admin data by direct URL/API call.
- `ADMIN-SEC-04 PASS`: Every mutating admin action writes an audit record with actor, target, action, timestamp, and result.
- `ADMIN-SEC-05 WARN`: Admin views expose more sensitive data than needed for the stated support job.
- `ADMIN-SEC-06 FAIL`: Bulk destructive actions, impersonation, or refund/cancel automation ship without explicit focused security/QA review.

*Last reviewed: 2026-06.*
