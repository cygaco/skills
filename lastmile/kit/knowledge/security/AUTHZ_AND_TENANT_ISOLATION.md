---
guide: AUTHZ_AND_TENANT_ISOLATION
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [authz]
sources:
  - "https://owasp.org/Top10/2025/"
  - "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/"
  - "https://supabase.com/docs/guides/database/postgres/row-level-security"
  - "https://supabase.com/docs/guides/api/api-keys"
  - "https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view"
  - "https://www.postgresql.org/docs/current/ddl-rowsecurity.html"
  - "https://nvd.nist.gov/vuln/detail/CVE-2025-48757"
---

# Authorization & Tenant Isolation

**Authorization answers "is *this* requester allowed to touch *this* object?" on **every** read, write, and delete — and the default posture of a database-backed app is *open*, not closed. The build must flip that default: deny-by-default, enforce server-side, and verify object ownership against the authenticated identity on each request — never trust a client-supplied id, a client-side check, or "the table just isn't linked anywhere yet."**

This guide trains your AI to treat broken access control as the #1 risk it actually is (OWASP A01:2025), to recognize the specific way the modern Postgres/Supabase stack ships *open by default*, and to apply object-level ownership checks (the BOLA/IDOR class) as a build-time invariant rather than a pen-test finding.

---

## 1. What this is

**Authentication** proves *who* you are (login, session, JWT). **Authorization** decides *what that identity may do* — and it is where most real breaches live. The two dominant authorization failure classes:

- **OWASP A01:2025 Broken Access Control** — the #1 category in the OWASP Top 10 (web). Restrictions on what an authenticated user can do are not enforced: a user acts outside their intended permissions, reads/edits other users' records, escalates privilege, or reaches admin functions.
- **OWASP API1:2023 Broken Object Level Authorization (BOLA)** — also called **IDOR** (Insecure Direct Object Reference). An endpoint accepts an object id from the client (`/api/orders/8123`, `?account=42`, a row id in a request body) and returns or mutates that object **without checking the caller is allowed to access *that specific id***. The fix is one check on every object access: *does the authenticated principal own / have a grant to this object?*

In a multi-tenant app (every SaaS, every B2B product), this is **tenant isolation**: tenant A must never see, modify, or enumerate tenant B's rows. The enforcement boundary must sit at the data layer, server-side, keyed off the authenticated identity — not in the UI, not in a client query.

This domain owns the `authz` vocabulary axis and guides writing the policies/checks, closing the gaps, and asserting the rules in §6.

---

## 2. Why it matters

Broken access control is the most common serious web vulnerability and the costliest to discover late: a single missing ownership check silently exposes the entire tenant base, and the leak is invisible in normal use (the app "works"). The modern AI-assisted build amplifies it because the default stack ships **open**.

**The "database open by default" problem (Supabase/PostgREST specifics):**
- Supabase exposes the Postgres `public` schema over a REST API (PostgREST). Any table in `public` is reachable by the **anon** key — which ships in the client bundle — *unless* Row Level Security (RLS) restricts it.
- **A new table has RLS OFF.** Tables created in the SQL editor (or via raw `CREATE TABLE`) default to RLS disabled. The dashboard "Table Editor" prompts you to enable RLS, but the SQL path does not. RLS-off + `public` schema + anon key = **the whole table is world-readable/writable** to anyone who finds the project URL.
- The dashboard ships a linter rule, **"RLS Disabled in Public,"** that flags exactly this.

**The real incident: CVE-2025-48757 (May 2025).** A wave of AI-generated apps (notably Lovable-built Supabase apps) shipped tables that were anon-readable because RLS was never enabled — exposing user PII, payment data, and secrets across many live sites. The vulnerability was not a bug in Supabase; it was the *open-by-default* posture meeting code that never closed it. This is the canonical failure this guide exists to prevent.

**For a security review specifically:** you are the enforcer of the deny-by-default flip. Most apps you review will *function correctly* while being wide open, because nothing in the happy path exercises the missing check. You cannot rely on the app "working" as evidence. You must affirmatively verify: (a) every `public` table has RLS enabled with explicit least-privilege policies; (b) every endpoint that takes an object id checks ownership against the authenticated user; (c) privileged keys never reach the client; (d) authorization is server-side, never client-only. The rules in §6 are written so each is an independently checkable PASS/FAIL.

---

## 3. Core principles / techniques

### 3.1 Deny by default

The safe default is **no access until explicitly granted**. Postgres RLS embodies this: with RLS **enabled and no policy**, the table denies all access (to non-owner, non-superuser roles) — *fail-closed*. The dangerous state is RLS **disabled**, which means "no row filtering at all" — *fail-open*. So:
- RLS **ON, zero policies** = deny-all = **safe** (nobody but `service_role`/owner sees rows).
- RLS **OFF** = **unsafe** = every row exposed to whoever can reach the API.

You enable it per table: `ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;`. Then you *add back* exactly the access you intend, as explicit policies.

### 3.2 Object-level authorization on every access (kill IDOR/BOLA)

For **every** request that references an object by id — read, write, or delete — verify the authenticated principal is authorized for *that id*. Two equivalent enforcement points:
- **In the database (preferred on Supabase):** an RLS policy scopes rows to the caller: `USING (user_id = (select auth.uid()))`. The id in the request is irrelevant to safety because the row simply isn't visible/mutable unless it belongs to the caller.
- **In application code (Node/Express handlers, server actions):** before returning or mutating, run an ownership predicate: `WHERE id = $1 AND owner_id = $session.userId` (or an explicit membership/role check for shared resources). Never `WHERE id = $1` alone.

**Never trust a client-supplied identity.** The tenant/user id must come from the *server-validated session/JWT*, not from a request field the client controls. `body.userId`, `?org=`, a hidden form field — all attacker-controllable.

### 3.3 RLS mechanics that matter (Supabase/Postgres)

- **`auth.uid()` and the initPlan cache.** Write policies as `(select auth.uid())` — wrapping the call in a subselect lets Postgres cache it as an initPlan and evaluate it **once per query** instead of once per row, a large performance win on big tables. Functionally `auth.uid()` and `(select auth.uid())` are identical; the subselect form is the documented best practice.
- **`service_role` bypasses RLS.** The `service_role` key maps to a Postgres role with **`BYPASSRLS`** — RLS policies do **not** apply to it. It is an admin key. It must live **server-side only** and never ship to a browser/mobile bundle. Anon/publishable keys are subject to RLS; `service_role`/secret keys are not.
- **`FORCE ROW LEVEL SECURITY`.** By default, the **table owner** (and superusers) bypass RLS even when it's enabled. `ALTER TABLE t FORCE ROW LEVEL SECURITY;` makes policies apply to the **table owner** too — important when your app role also owns the table, or for defense in depth. **But its reach is bounded:** `FORCE` does **not** stop roles with the `BYPASSRLS` attribute, and superusers still bypass RLS regardless. Critically, it does **not** make `service_role` safe for normal CRUD — `service_role` carries `BYPASSRLS`, so even with `FORCE` set on a table a `service_role` query reads/writes every row. Use `FORCE` to close the owner-bypass gap, not as a way to let `service_role` serve per-user traffic (see §4 and AUTHZ-15).
- **`SECURITY DEFINER` views/functions are an RLS escape hatch.** A view or function declared `SECURITY DEFINER` runs with the *definer's* privileges and can leak rows past RLS; Supabase's linter flags `SECURITY DEFINER` views. Prefer `SECURITY INVOKER` (the default for functions) unless you deliberately need elevation, and scope it tightly.
- **Policies are per-command.** A policy applies to `SELECT`, `INSERT`, `UPDATE`, or `DELETE` (or `ALL`). A `SELECT`-only policy leaves writes denied (safe) — but make sure each command a tenant legitimately needs has its own least-privilege policy, and that `WITH CHECK` (on INSERT/UPDATE) prevents a tenant from writing rows assigned to *another* tenant.

### 3.4 Server-side enforcement, function-level authz

- **Authorization is a server concern, always.** Client-side checks (hiding a button, a route guard in React, a disabled field) are UX, not security — the API must independently re-check. An attacker calls the endpoint directly with `curl`.
- **Function/endpoint-level authorization (OWASP API5).** Beyond object-level, gate *which roles may call which functions*: admin endpoints, bulk-export, role-change, billing — verify the caller's role/permission server-side on each. Don't rely on the route being "unlinked" in the UI.
- **Least privilege.** Grant the narrowest scope that works: read-only where reads suffice, row-scoped where tenant-scoped suffices, a dedicated limited DB role for the app rather than a superuser.

---

## 4. Concrete examples (build terms)

**Enable RLS on a public table (deny-by-default) — DON'T / DO**
- DON'T: create a table and stop. `CREATE TABLE public.notes (id uuid primary key, user_id uuid, body text);` — RLS is OFF; the anon key reads every row.
- DO: enable RLS, then add least-privilege policies:
  ```sql
  ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "owner can read"   ON public.notes FOR SELECT
    USING ( (select auth.uid()) = user_id );
  CREATE POLICY "owner can insert" ON public.notes FOR INSERT
    WITH CHECK ( (select auth.uid()) = user_id );
  CREATE POLICY "owner can update" ON public.notes FOR UPDATE
    USING ( (select auth.uid()) = user_id )
    WITH CHECK ( (select auth.uid()) = user_id );
  CREATE POLICY "owner can delete" ON public.notes FOR DELETE
    USING ( (select auth.uid()) = user_id );
  ```

**Object-level check in an Express/Node handler (kill IDOR) — DON'T / DO**
- DON'T: `db.query('SELECT * FROM orders WHERE id = $1', [req.params.id])` — returns any order to any logged-in user.
- DO: `db.query('SELECT * FROM orders WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId])` and return 404 (not 403, to avoid confirming existence) when no row matches. The owner id comes from the **server session**, never from the request.

**Trusting client identity — DON'T / DO**
- DON'T: `const userId = req.body.userId; await transfer(userId, amount);` — attacker sets any `userId`.
- DO: `const userId = req.session.userId;` (or `auth.uid()` inside an RLS-protected query). The principal is always server-derived.

**Privileged key placement — DON'T / DO**
- DON'T: `const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY)` in a client component / `NEXT_PUBLIC_*` env / mobile app — `service_role` has `BYPASSRLS`; shipping it hands attackers the whole database.
- DO: use the **anon/publishable** key in client code (it's RLS-bound and designed to be public); use `service_role` only in server routes / Edge Functions, read from a server-only secret.

> **`FORCE ROW LEVEL SECURITY` is not a `service_role` safety net.** A common misread: "I enabled `FORCE ROW LEVEL SECURITY`, so my `service_role` queries are now policy-checked." They are not. `FORCE` applies RLS to the **table owner**, but roles with `BYPASSRLS` (which `service_role` has) and superusers still bypass it entirely. The only safe way to use `service_role` for data a user touches is to **manually re-check ownership/membership in the server code** for every object — `WHERE id = $1 AND owner_id = $session.userId`, or a deliberate membership query — never `WHERE id = $1` alone on a `service_role` client (see AUTHZ-15).

**Client-only authorization — DON'T / DO**
- DON'T: hide the "Delete user" button for non-admins in React and call `DELETE /api/users/:id` with no server role check.
- DO: re-check the role server-side in the handler (`if (req.session.role !== 'admin') return res.sendStatus(403)`), and/or scope the operation behind an RLS/role policy.

---

## 5. Common failure modes

| Failure | How it bites | How to detect |
|---|---|---|
| `public` table with RLS disabled | Anon key reads/writes the whole table; tenant data world-exposed (CVE-2025-48757 class) | Query `pg_tables`/`pg_class.relrowsecurity` for `public` tables with RLS off; run the Supabase "RLS Disabled in Public" linter |
| RLS enabled but zero policies on a table a tenant *needs* | App appears broken or a workaround uses `service_role` everywhere, re-opening the hole | RLS on + no policy for a command the app calls; grep for `service_role` in request paths |
| Endpoint takes an object id with no ownership check (IDOR/BOLA) | Any authenticated user reads/edits other users' objects by changing the id | `WHERE id = $1` with no owner/tenant predicate; route handler returns object by id without a session-scoped filter |
| Tenant id read from the request, not the session | Attacker sets `userId`/`org` to another tenant and crosses the boundary | Tenant/user id sourced from `req.body`/`req.query`/header instead of validated session/JWT |
| `service_role`/admin key in client bundle or `NEXT_PUBLIC_*` | Full `BYPASSRLS` access leaks to every visitor | Grep client/bundle and `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` for service/secret keys |
| Authorization only in the UI (button hidden, route guard) | Direct API call bypasses it entirely | Server handler has no role/ownership check; only the React layer gates the action |
| `SECURITY DEFINER` view/function leaking past RLS | Rows return regardless of the caller's policy | Supabase linter `security_definer_view`; grep DDL for `SECURITY DEFINER` |
| `INSERT`/`UPDATE` policy without `WITH CHECK` | Tenant writes rows owned by another tenant (cross-tenant write) | Policy for INSERT/UPDATE missing a `WITH CHECK` ownership predicate |
| Table owner bypasses its own RLS | App role == owner sees all rows despite policies | RLS enabled but `FORCE ROW LEVEL SECURITY` absent where the app role owns the table |
| Missing function-level authz on admin/bulk endpoints | Privilege escalation; non-admins hit admin actions | Admin/export/role-change endpoint with no server-side role gate |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Database deny-by-default (the open-by-default flip)**
- **[AUTHZ-01] critical — Every table in the exposed `public` schema has Row Level Security ENABLED.** → `authz`. Detect: `pg_class.relrowsecurity = false` for any reachable `public` table, or Supabase "RLS Disabled in Public" linter fires = FAIL (observed RLS off, expected on). This is the CVE-2025-48757 class.
- **[AUTHZ-05] serious — RLS-enabled tables have explicit least-privilege policies for exactly the commands a tenant legitimately needs (deny-by-default, no broader grant).** → `authz`. Detect: a policy with `USING (true)`/no tenant predicate, or `FOR ALL` where only SELECT is needed, or a needed command with no policy forcing a `service_role` workaround = FAIL.
- **[AUTHZ-06] serious — `INSERT`/`UPDATE` policies carry a `WITH CHECK` predicate that prevents writing rows assigned to another tenant.** → `authz`. Detect: write policy without `WITH CHECK`, or `WITH CHECK (true)` = FAIL (cross-tenant write possible).
- **[AUTHZ-07] minor — Where the app's DB role also owns the table, `FORCE ROW LEVEL SECURITY` is set; no `SECURITY DEFINER` view/function silently bypasses RLS.** → `authz`. Detect: owner-bypassable RLS, or Supabase `security_definer_view` linter fires = WARN/FAIL.

**Object-level authorization (kill IDOR/BOLA)**
- **[AUTHZ-02] critical — Every object-level data access (read/write/delete by id) verifies the authenticated requester OWNS or has an explicit grant to that object id.** → `authz`. Detect: handler/query selects or mutates by client id with no owner/tenant/membership predicate (`WHERE id = $1` alone), or no equivalent RLS scoping = FAIL (IDOR; OWASP API1:2023 BOLA).
- **[AUTHZ-08] critical — The tenant/user identity used for authorization comes from the server-validated session/JWT, never from a client-supplied field.** → `authz`. Detect: authorization keyed off `req.body`/`req.query`/header `userId`/`org`/`tenant` instead of session/`auth.uid()` = FAIL.
- **[AUTHZ-09] minor — Not-found vs not-authorized responses don't leak object existence across tenants (return 404 rather than 403 on cross-tenant ids where enumeration matters).** → `authz`. Detect: endpoint distinguishes "exists but yours-not" from "doesn't exist," enabling id enumeration = WARN.

**Key & privilege handling**
- **[AUTHZ-03] critical — `service_role` / admin / secret keys never reach client code, the browser bundle, or a client-exposed env prefix.** → `authz`/`secrets`. Detect: `service_role`/secret key referenced in a client component, committed `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` var, or shipped bundle = FAIL (full `BYPASSRLS` leak).
- **[AUTHZ-10] minor — The app uses a least-privilege key/role for its normal data path (anon/publishable + RLS), reserving `service_role` for narrow server-only admin operations.** → `authz`. Detect: `service_role` client used for ordinary per-user CRUD that RLS could scope = WARN.

**Server-side & function-level enforcement**
- **[AUTHZ-04] serious — Authorization is enforced server-side on every privileged action; client-side checks (hidden buttons, route guards) are never the only gate.** → `authz`. Detect: a privileged endpoint with no server role/ownership check while the UI alone restricts it = FAIL (direct API call bypasses).
- **[AUTHZ-11] serious — Admin / bulk-export / role-change / billing endpoints enforce function-level (role/permission) authorization server-side.** → `authz`. Detect: such an endpoint with no server-side role check (OWASP API5 / A01 escalation path) = FAIL.
- **[AUTHZ-12] minor — Access decisions deny by default: an unmatched/unknown principal, role, or resource yields denied, not allowed.** → `authz`. Detect: authorization logic whose default branch grants access, or a missing-role case that falls through to allow = WARN.

**Server-trust & isolation beyond Postgres rows**
- **[AUTHZ-13] critical — Object storage / buckets enforce tenant isolation: private user files live in private buckets, signed URLs expire, and every file download verifies ownership server-side.** → `authz`/`secrets`. Detect: private user files in a public bucket, signed URLs that never expire, or a file download path (`/userA/file.pdf`) trusted as authorization with no server-side ownership check = FAIL. RLS protects Postgres rows, not Storage/S3/Firebase Storage objects.
- **[AUTHZ-14] critical — Vector DB / RAG / search indexes enforce a server-derived tenant/user filter on BOTH ingest and retrieval.** → `authz`. Detect: an embedding/retrieval query with no tenant/user filter sourced from the server session/JWT, so user A can retrieve user B's chunks = FAIL (vector search leaks across tenants even when Postgres RLS is correct).
- **[AUTHZ-15] critical — Any route using `service_role` manually enforces authorization for every object it touches, because `service_role` bypasses RLS.** → `authz`. Detect: a `service_role` query keyed off a client-supplied `userId`/`orgId`/object id with no server-side ownership/membership check (`WHERE id = $1` alone on a service-role client) = FAIL. `FORCE ROW LEVEL SECURITY` does not close this — `service_role` carries `BYPASSRLS`.
- **[AUTHZ-16] serious — Server-owned fields cannot be set by the client.** → `authz`. Detect: a client can submit `role`, `tier`, `isAdmin`, `priceId`, `ownerId`, `tenantId`, `subscriptionStatus`, or `credits` and have it persisted (mass-assignment / privilege-escalation) = FAIL. These fields are derived server-side from the authenticated identity or provider-confirmed events, never trusted from the request body.
- **[AUTHZ-17] serious — Org membership, invites, role changes, billing ownership, data exports, and admin actions require a server-side permission check AND an audit-log entry.** → `authz`. Detect: an endpoint performing any of these with only a "logged-in" check (no role/membership verification, or no audit record of who/what/when) = FAIL.
- **[AUTHZ-18] serious — Tenant-isolation negative tests exist for EVERY data surface, not just DB rows.** → `authz`. Detect: tests prove "user A can't read user B's row" but cover no equivalent for files, RAG chunks, search results, cached responses, or exports = FAIL/WARN (coverage gap on the surfaces RLS doesn't reach).
- **[AUTHZ-19] serious — Exposed RPC / `SECURITY DEFINER` functions with elevated privileges are tightly scoped.** → `authz`. Detect: a `SECURITY DEFINER` function exposed to `anon`/`authenticated` that accepts arbitrary ids/SQL, or lacks explicit auth checks / `search_path` hardening = FAIL (RLS escape hatch; see §3.3 and the Supabase `security_definer_view` linter).

> **Coverage note:** AUTHZ-01/03/07 (and the linter-backed parts of 05/06), plus AUTHZ-13's signed-URL/public-bucket and AUTHZ-19's linter-flagged parts, are largely machine-detectable via DB/bucket introspection, secret grep, and the Supabase linter. AUTHZ-02/04/08/11 and AUTHZ-14/15/16/17/18 require reading the request→authorization path (is the RAG filter server-derived? does the `service_role` route re-check ownership? are server-owned fields client-settable? do isolation tests cover every surface?) and are judgment checks — written as assertions so a reasoning reviewer can evaluate each independently.

---

## 7. Sources

- OWASP — *Top 10:2025 (final)* — https://owasp.org/Top10/2025/ (A01 Broken Access Control = #1; A03 Software Supply Chain new)
- OWASP API Security — *API1:2023 Broken Object Level Authorization (BOLA/IDOR)* — https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ (per-request object ownership check; never trust a client id)
- Supabase — *Row Level Security* — https://supabase.com/docs/guides/database/postgres/row-level-security (RLS enable, deny-all on no policy, `(select auth.uid())` initPlan cache, `FORCE ROW LEVEL SECURITY`)
- Supabase — *API Keys (anon vs service_role)* — https://supabase.com/docs/guides/api/api-keys (anon/publishable is public + RLS-bound; `service_role` bypasses RLS, server-only)
- Supabase — *Database Linter: SECURITY DEFINER view* — https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view (and the "RLS Disabled in Public" lint family)
- PostgreSQL — *Row Security Policies* — https://www.postgresql.org/docs/current/ddl-rowsecurity.html (RLS semantics, `BYPASSRLS`, `FORCE`, `USING` vs `WITH CHECK`, per-command policies)
- NVD — *CVE-2025-48757* — https://nvd.nist.gov/vuln/detail/CVE-2025-48757 (May 2025: AI-generated/Lovable Supabase apps shipped anon-readable tables with RLS never enabled)
