---
guide: ADMIN_TOOLING
anchor: lastmile:module/admin
shape: walkthrough
timing: at-module
lead_time: "none"
---

# ADMIN_TOOLING_GUIDE.md - The Founder Control Room (for Total Newbies)

> Admin tooling is the private surface you use to help users, fix account problems, and understand what is happening in the product. It is not a second product. Pre-PMF admin should be small, protected, and useful.

---

## 1. ELI5 - what is an admin tool?

Imagine your app is a store. The normal app is the front counter customers see. The admin tool is the small staff-only desk in the back where you can look up an order, help a customer, or fix a mistaken setting.

For a launch-stage product, the admin tool should answer:

- Who is using the product?
- What account/subscription state are they in?
- Did the important events happen?
- Can I safely help this user?
- Can I turn a risky feature off?

It should not become a giant internal enterprise dashboard.

---

## 2. Build the minimum useful admin surface

| Surface | Why it helps |
|---|---|
| Founder allowlist | Only approved founder/admin emails can enter |
| User search | Find a user by email/id without browsing the database directly |
| User/account detail | See account state, plan, created date, last active |
| Entitlement view | Confirm whether the user should have paid access |
| Recent event feed | See signup, activation, checkout, core action events |
| Support notes/status | Track simple manual support outcomes |
| Feature kill switch | Disable a risky integration or expensive feature quickly |
| Audit trail | Know which admin did what and when |

If a feature cannot explain how it helps support, safety, or product learning, leave it out.

---

## 3. What YOU must decide

| Decision | Why it is yours |
|---|---|
| Who is allowed into admin | It grants power over real users |
| Which actions admins may take | Mistakes can affect accounts and money |
| Which data is too sensitive to show | Privacy/trust call |
| When a manual override is acceptable | Business/user-impact call |
| Whether the app is ready for more complex roles | Pre-PMF usually is not |

Use a short allowlist first. Do not build a full role matrix until the product has real operational demand.

---

## 4. What AI can build

Ask your assistant for a small protected surface:

```
Add a founder-only admin surface with allowlisted access, user lookup, account/entitlement read-only view, recent product events, a feature kill switch, and an audit log for every admin action. Do not add broad RBAC, refund automation, or bulk destructive actions.
```

Good admin code:

- checks admin access server-side on every admin route
- never trusts a client-side "isAdmin" flag alone
- logs admin actions
- defaults to read-only where possible
- hides or redacts sensitive fields
- has tests that prove normal users cannot access admin routes

---

## 5. Security rules

Admin tooling is powerful. Treat it like a privileged system.

- No public links to admin pages.
- No client-only admin checks.
- No broad database browser in production.
- No showing raw secrets, passwords, tokens, full payment details, or private content unless absolutely necessary.
- No destructive action without confirmation and audit.
- Every admin action should log who, what, when, and target user/account.
- Admin routes must have rate limits and safe error messages.
- If you add impersonation, refunds, deletes, exports, or bulk actions, escalate for a focused security review.

---

## 6. Pre-PMF overbuild traps

Do not build these first unless you have a specific need:

- complex RBAC role matrices
- bulk operations
- refund/cancel automation
- analytics dashboards duplicating your analytics tool
- custom CRM
- internal chat/workflow tools
- multi-team permission systems

Use Stripe, your analytics provider, your email tool, and your database host dashboards for advanced operations until the pain is real.

---

## 7. Launch checklist

```
ADMIN TOOLING
[ ] Admin route is private and not linked from public nav
[ ] Founder/admin allowlist exists
[ ] Admin checks run server-side on every admin route/action
[ ] Normal users are blocked by tests
[ ] User lookup is read-only by default
[ ] Entitlement/account state is visible
[ ] Recent product events are visible
[ ] Feature kill switch exists for risky/expensive features
[ ] Admin action audit log exists
[ ] Sensitive values are hidden/redacted
[ ] No destructive/bulk/admin impersonation feature shipped without focused review
```

---

## 8. Cross-references

- [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md) - admin routes are high-value targets.
- [`ANALYTICS_TELEMETRY_GUIDE.md`](ANALYTICS_TELEMETRY_GUIDE.md) - event feeds should use the same event vocabulary.
- [`PAYMENTS_GUIDE.md`](PAYMENTS_GUIDE.md) - entitlements should come from verified payment/webhook state.
- [`knowledge/admin-tooling/`](../knowledge/admin-tooling/README.md) - the deeper rules behind this guide, for you and your AI.

---

## 9. Official sources

- OWASP Access Control Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Stripe customer portal docs: https://docs.stripe.com/customer-management
- PostHog feature flags docs: https://posthog.com/docs/feature-flags

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Admin tools touch real users and should stay small until operational need is proven.*
