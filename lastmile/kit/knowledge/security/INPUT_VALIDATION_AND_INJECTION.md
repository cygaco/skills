---
guide: INPUT_VALIDATION_AND_INJECTION
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [input-validation]
sources:
  - "https://owasp.org/Top10/2025/"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html"
  - "https://zod.dev/"
---

# Input Validation & Injection Prevention (OWASP A05:2025 Injection)

**Every byte that crosses a trust boundary into the server — request body, params, query, headers, uploaded files, webhook payloads, third-party API responses — is hostile until proven otherwise: it must be validated against a strict server-side schema (type, length, format) and *rejected* when malformed, and it must reach every interpreter (SQL, HTML, shell, filesystem, outbound HTTP) only through that interpreter's safe API — parameterized, context-encoded, or allowlisted — never via string concatenation. Validation is allowlist-first ("accept exactly this shape"), bounded ("reject oversized"), and server-side (client checks are UX, not security).**

This guide trains your AI on the **injection family** under **OWASP A05:2025 Injection** (which now folds XSS in) and the input-validation discipline that prevents it. The defects are introduced in a single line — `db.query("... " + req.body.id)`, `el.innerHTML = req.query.q`, `fetch(req.body.url)`, `exec("convert " + filename)` — and each has a deterministic, well-known safe form. Your AI's job is to ensure input is validated at the edge and that *no* untrusted value ever reaches an interpreter through concatenation.

---

## 1. What this is

This is conformance to the input-validation and injection-prevention baseline codified in **OWASP A05:2025 Injection** and the OWASP cheat sheets. Two complementary disciplines:

- **Validate at the edge (positive/allowlist validation).** Define the *expected* shape of every input — type, length bounds, format, allowed values — and reject anything that doesn't fit, before any business logic runs. Allowlist ("accept only these") beats denylist ("block these bad things"), because attackers find the cases your denylist missed.
- **Escape at the sink (context-correct output handling).** Even validated data must reach an interpreter safely: **parameterized queries** for SQL, **context-aware encoding** for HTML/JS/URL/attribute contexts, **allowlists** for outbound hosts and file types, and **never** the shell with user input. Validation reduces the attack surface; safe sinks are what actually stop the injection.

The injection classes a server builder controls: **SQL injection**, **Cross-Site Scripting (XSS)**, **Server-Side Request Forgery (SSRF)** (now folded into **A01:2025 Broken Access Control** in the OWASP top 10 grouping), **OS command / path-traversal injection**, and **malicious file uploads**. All share one root cause: untrusted data interpreted as code/structure instead of as inert data.

---

## 2. Why it matters

**For users and the product:** injection is the oldest and still one of the most damaging web vulnerability classes. SQL injection dumps or destroys the whole database; XSS runs attacker JavaScript in a victim's authenticated session (account takeover, token theft); SSRF turns your server into a proxy that reaches internal services and **cloud metadata endpoints** (`169.254.169.254`) to steal IAM credentials; command injection is remote code execution; a malicious upload that's served back can be a stored-XSS or a web-shell. A missing **body-size limit** is a cheap denial-of-service — a huge default payload (some frameworks default to ~1–5 MB or more) lets an attacker exhaust memory.

**For a security review specifically:**
- This guide is the primary source for the **`input-validation`** vocabulary — it owns the whole axis. Use it when writing request handlers, patching injection sinks, and reviewing both.
- Most injection findings are **deterministically detectable** at the sink (string-concatenated SQL, `innerHTML` of a request value, `fetch` of a user URL, `exec` with input, Content-Type-trusted uploads) — this is a high-yield, high-precision axis. The judgment layer is *completeness*: is **every** input validated, is the validation **strict** (reject-unknown-keys, bounded), is the allowlist actually exhaustive.
- The recurring mistake is validating *some* inputs (the body) and not others (params, query, headers, webhook payloads) — coverage gaps are the real bug class.

---

## 3. Core principles / techniques

### 3.1 Strict server-side schema validation (the edge)

Validate **body + params + query** (and headers/webhooks where used) against a schema that enforces **type, length, format, and allowed values**, and **rejects** anything malformed — return 400, don't coerce or truncate silently. Use a schema library:
- **Zod** — `.strict()` (reject unknown keys), `.max(n)` on every string, `z.enum([...])` for allowlists, `.parse()` (throws) at the boundary.
- **Pydantic** (Python) — strict models, `Field(max_length=...)`, `extra="forbid"`.
- **Joi** — `.required()`, `.max()`, `stripUnknown`/`{ allowUnknown: false }`.

Two non-negotiables: **(a) reject unknown keys** (`.strict()` / `extra="forbid"`) so mass-assignment and smuggled fields are blocked, and **(b) bound every string with `.max()`** so a 10 MB "name" can't sail through.

### 3.2 Allowlist > denylist

Define what is *valid* and reject everything else, rather than enumerating what's *invalid*. A denylist that blocks `<script>` misses `<img onerror>`, `javascript:`, SVG payloads, and Unicode tricks. An allowlist of `z.enum(["asc","desc"])` for a sort param has no bypass. This applies to enums, file extensions, outbound hosts, redirect targets, and formats.

### 3.3 Request body-size limit (DoS)

Set an explicit body-size cap at the framework edge — `express.json({ limit: "100kb" })`, a reverse-proxy `client_max_body_size`, or framework equivalent. Large or unbounded defaults are a memory-exhaustion DoS. Size the limit to the actual need (small for JSON APIs; a separate, larger, streamed path for uploads).

### 3.4 SQL injection — parameterize, never concatenate

Untrusted data must enter SQL only as a **bound parameter / prepared statement**, never via string concatenation or template interpolation. Use parameter placeholders (`$1`, `?`) or an ORM's safe query builder. Never build SQL with `+ userInput`. For the rare cases where an identifier (table/column) must be dynamic, allowlist it against a fixed set — you cannot parameterize identifiers.

### 3.5 XSS — context-aware output encoding + CSP

XSS is prevented at the **output** sink by encoding untrusted data for the **context** it's rendered into (HTML body, HTML attribute, JS string, URL). Modern frameworks (React/JSX, Angular, Vue) auto-escape text by default — the danger is the **escape hatches**: `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `document.write`, `eval`. If raw HTML is genuinely required, sanitize with a vetted allowlist sanitizer (DOMPurify). Layer a **Content-Security-Policy** as defense-in-depth so an injected script is blocked even if encoding is missed (CSP details live in WEB_SECURITY_HEADERS_CSRF_CORS).

### 3.6 SSRF — allowlist outbound, block internal (A01:2025)

When the server fetches a URL derived from user input, an attacker points it at internal services or the **cloud metadata endpoint** (`http://169.254.169.254/`) to steal credentials. Defenses: **allowlist the destination hosts/schemes**; resolve the hostname and **block private/loopback/link-local ranges** (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, IPv6 ULA/`::1`); disallow redirects to those ranges; prefer fixed endpoints over user-supplied URLs. Never `fetch(userUrl)` with no destination control.

### 3.7 Command / path injection — don't shell out; check traversal

Never pass user input to a shell (`exec`, `system`, backticks). If you must run a subprocess, use the **argv array form** (`execFile`/`spawn` with an args array, no shell) so arguments can't break out. For filesystem paths built from input, **resolve and confirm the result stays within the intended base directory** (reject `..` traversal, absolute paths, and null bytes); allowlist filenames where possible.

### 3.8 File uploads — validate real magic bytes, not the label

The client-supplied **Content-Type and filename/extension are attacker-controlled and must not be trusted.** Validate uploads by: **(a) inspecting the actual file signature (magic bytes) server-side** to confirm the real type; **(b) an extension allowlist** matched to that real type; **(c) a hard size cap**; **(d) storing outside the webroot** (or in object storage) with a generated, non-user-controlled name, served via a handler — never executed. A `.php`/`.jsp`/`.svg` slipped past a Content-Type check and served from the webroot is a web-shell or stored-XSS.

> **The trade-off (allowlist friction):** strict allowlists and reject-on-unknown can reject legitimate-but-unanticipated input, which feels brittle. The resolution is to make the allowlist *correct and explicit* (and evolve it deliberately) rather than loosen to a denylist — every "just allow anything" relaxation re-opens the class. Bounds and rejection are features, not bugs.

---

## 4. Concrete examples (build terms — Node/Express + Zod)

**Schema validation (edge) — DON'T / DO**
- DON'T: `const { email, role } = req.body;` then use them directly — no type, no length, no allowlist, unknown keys (`isAdmin`) sail through.
- DO:
  ```js
  const Body = z.object({
    email: z.string().email().max(254),
    role: z.enum(["member", "admin"]),
  }).strict();                         // reject unknown keys
  const data = Body.parse(req.body);   // throws 400 on malformed
  ```
  Validate `req.params`/`req.query` the same way.

**Body-size limit (DoS) — DON'T / DO**
- DON'T: `app.use(express.json())` — large default, no cap.
- DO: `app.use(express.json({ limit: "100kb" }))` (and a separate streamed path with its own cap for uploads).

**SQL (A05) — DON'T / DO**
- DON'T: `db.query("SELECT * FROM users WHERE id = '" + req.params.id + "'")`.
- DO: `db.query("SELECT * FROM users WHERE id = $1", [req.params.id])` (or an ORM's parameterized builder). Allowlist any dynamic identifier.

**XSS (A05) — DON'T / DO**
- DON'T: `el.innerHTML = req.query.q` / `<div dangerouslySetInnerHTML={{ __html: comment }} />`.
- DO: render as text (`textContent` / JSX `{q}`); if HTML is required, `DOMPurify.sanitize(html)` first; set a CSP header.

**SSRF (A01) — DON'T / DO**
- DON'T: `const r = await fetch(req.body.url)`.
- DO: validate the URL, allowlist host + scheme, resolve and reject private/loopback/link-local IPs (block `169.254.169.254`), and disable redirects to those ranges.

**Command / path (A05) — DON'T / DO**
- DON'T: `exec("convert " + req.body.file + " out.png")` / `fs.readFile(path.join(base, req.query.name))` with no traversal check.
- DO: `execFile("convert", [safeInputPath, "out.png"])` (argv, no shell); resolve the path and assert `resolved.startsWith(baseDir)`; reject `..`/absolute/null-byte.

**File upload — DON'T / DO**
- DON'T: trust `req.file.mimetype` / the extension; store under the webroot with the user's filename.
- DO: read the magic bytes (e.g. `file-type`) to confirm the real type, allowlist the extension for that type, cap size, store outside webroot with a generated name, serve via a handler that never executes it.

---

## 5. Common failure modes

| Failure | How it reads to the attacker | How to detect |
|---|---|---|
| Input used unvalidated (body/params/query) | Whatever shape/size/keys I send is accepted | Request value used without a server-side schema enforcing type+length+format; or only the body is validated, not params/query/headers |
| No reject-unknown-keys / no `.max()` | Smuggle extra fields (`isAdmin`); send a 10 MB string | Schema without `.strict()`/`extra="forbid()"`, or strings without `.max()` length bounds |
| No body-size limit | Send a giant payload → memory exhaustion (DoS) | `express.json()` (or equivalent) with no explicit `limit`; no reverse-proxy body cap |
| Denylist instead of allowlist | Find the one bad input the denylist forgot | Validation enumerates *bad* values/patterns rather than accepting only known-good |
| String-concatenated SQL | `' OR 1=1 --` dumps the table | SQL built with `+`/template interpolation of input instead of bound parameters |
| Raw render of untrusted data (XSS) | `<img onerror=steal()>` runs in the victim's session | `innerHTML`/`dangerouslySetInnerHTML`/`v-html`/`document.write` of a request value with no encode/sanitize; no CSP |
| `fetch`/HTTP client on a user URL (SSRF) | Point it at `169.254.169.254` to steal cloud creds | Outbound request to a user-derived URL with no host/scheme allowlist and no private-IP block |
| Shell-out with input (command injection) | `; rm -rf /` in a filename runs as the server | `exec`/`system`/backticks with concatenated input instead of argv `execFile`/`spawn` |
| Path built from input (traversal) | `../../etc/passwd` reads arbitrary files | Filesystem path from input with no resolve-and-confine-to-base check; `..`/absolute/null-byte allowed |
| Upload validated by Content-Type/extension only | Upload a web-shell labeled `image/png` | Type/extension trusted from the client; no magic-byte check; stored in webroot; original filename kept |

**The detectability caveat (important for an automated review):** the *sinks* are highly deterministic — concatenated SQL, raw-HTML render of a request value, `fetch` of a user URL, `exec` with input, Content-Type-trusted uploads are all greppable patterns. The *judgment* layer is **coverage and strictness**: is **every** input across **every** surface (body, params, query, headers, webhooks, third-party responses) validated, is the schema actually `strict` and bounded, is the allowlist genuinely exhaustive. A scan that finds zero concatenated SQL but never checks whether `req.query` is validated has missed the real gap.

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion a security review can apply. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Validate at the edge**
- **[INVAL-01] critical — Every external input (body, params, query, and headers/webhooks where used) is validated against a strict server-side schema (type + length + format) and rejected if malformed.** → `input-validation`. Detect: a request value used without a schema, or only the body validated while params/query are not = FAIL (observed: `req.params.id` used raw; expected: schema-parsed + rejected on mismatch).
- **[INVAL-07] serious — Schemas reject unknown keys (`.strict()` / `extra="forbid"`) and bound every string with a max length.** → `input-validation`. Detect: object schema without strict/forbid-unknown, or a string field without a `.max()` bound = FAIL (mass-assignment + oversized-field surface).
- **[INVAL-08] minor — Validation is allowlist-first (accept known-good), not denylist (block known-bad).** → `input-validation`. Detect: validation enumerating bad patterns/values rather than an allowlist/enum of valid ones = WARN.
- **[INVAL-02] serious — A request body-size limit is set at the framework/proxy edge.** → `input-validation`. Detect: `express.json()`/body parser with no `limit` (or no proxy body cap) = FAIL (unbounded-payload DoS).

**Escape at the sink**
- **[INVAL-03] critical — SQL uses parameterized queries / ORM bindings; no string concatenation or interpolation of input into SQL.** → `input-validation`. Detect: SQL built with `+`/template literals containing a request value instead of bound params (`$1`/`?`) = FAIL; dynamic identifiers must be allowlisted.
- **[INVAL-04] critical — User-controlled output is context-encoded (no XSS), framework auto-escaping is not bypassed without sanitization, and a CSP is set.** → `input-validation`. Detect: `innerHTML`/`dangerouslySetInnerHTML`/`v-html`/`document.write` of untrusted data with no sanitizer, or missing CSP = FAIL.
- **[INVAL-05] serious — Outbound/fetch targets derived from input are allowlisted (host + scheme); private/loopback/link-local IPs and the cloud metadata endpoint (169.254.169.254) are blocked, including via redirects (SSRF).** → `input-validation`. Detect: HTTP client called on a user-derived URL with no host allowlist and no private-IP/metadata block = FAIL.
- **[INVAL-09] critical — No OS command is built from user input via a shell; subprocesses use the argv array form (no shell), and filesystem paths from input are resolved and confined to a base directory (no `..`/absolute/null-byte traversal).** → `input-validation`. Detect: `exec`/`system`/backticks with input, or a path joined from input without a confine-to-base check = FAIL.

**Uploads**
- **[INVAL-06] serious — File uploads are validated by real magic bytes (server-side), an extension allowlist matched to the real type, and a size cap; files are stored outside the webroot with a generated name and never executed.** → `input-validation`. Detect: upload type trusted from Content-Type/extension only, no magic-byte check, no size cap, or stored in the webroot with the original filename = FAIL.
- **[INVAL-10] minor — Redirect/forward targets and any other "go to this location" input are allowlisted (no open redirect).** → `input-validation`. Detect: redirect/`Location` built from an unvalidated user-supplied URL/path = WARN.

**Webhooks, mass-assignment & parser/upload hardening**
- **[INVAL-11] critical — Provider webhooks verify the signature using the RAW request body and reject invalid/stale signatures.** → `input-validation`. Detect: a webhook route that accepts the JSON body with no signature verification, verifies against the *parsed* (re-serialized) body instead of the raw bytes, or doesn't reject stale timestamps = FAIL (a forged webhook grants paid access / fulfillment; e.g. Stripe `constructEvent(rawBody, sig, secret)`).
- **[INVAL-12] serious — Webhooks are replay/idempotency protected.** → `input-validation`. Detect: no stored processed-event-id set, so the same event id can be processed twice to grant duplicate credits/fulfillment = FAIL.
- **[INVAL-13] serious — Mass assignment is blocked: `req.body` is not spread directly into an ORM create/update for sensitive models.** → `input-validation`. Detect: `req.body` (or a permissive object) spread into a Prisma/Sequelize/Mongoose/ORM create/update for a user/account/org/payment model, letting a client set server-owned fields = FAIL (pairs with INVAL-07 strict schemas and AUTHZ-16).
- **[INVAL-14] serious — NoSQL / ORM filters are allowlisted, not built from raw client JSON.** → `input-validation`. Detect: client-supplied JSON becoming a Mongo/Prisma/Supabase `where`/`filter`/`orderBy`/`include` without a schema allowlist (NoSQL injection / operator injection like `{ "$gt": "" }`) = FAIL.
- **[INVAL-15] serious — XML and archive parsing is hardened.** → `input-validation`. Detect: an XML parser with external entities enabled (XXE), or a ZIP/TAR/archive upload that can zip-bomb (decompression DoS) or write paths outside the extraction dir (zip-slip / path traversal) = FAIL.
- **[INVAL-16] serious — Uploads with active content are handled safely.** → `input-validation`. Detect: SVG/HTML/PDF accepted and served **inline** from the app origin with no sanitization/transcoding, or no malware scan for risky file classes — so an SVG/HTML payload becomes stored XSS (magic bytes alone don't stop this; extends INVAL-06) = FAIL.
- **[INVAL-17] minor — Pagination / sort / search parameters are bounded and allowlisted.** → `input-validation`. Detect: an unbounded `limit`, an arbitrary client-supplied `orderBy`, or an expensive unbounded wildcard search = WARN/FAIL where DoS-prone.

> **Coverage note for a review:** the sink rules ([INVAL-02, 03, 04, 05, 06, 09]) are largely machine-detectable — high precision — and INVAL-11 (raw-body signature verify present), INVAL-13 (`...req.body` spread into an ORM call), and INVAL-15 (XXE-enabled parser / unbounded extraction) are similarly greppable sinks. The edge rules ([INVAL-01, 07] coverage/strictness; [08] allowlist posture; [10] redirect) and INVAL-12 (replay/idempotency actually enforced), INVAL-14 (filter allowlist completeness), INVAL-16 (active-content serving + scanning), and INVAL-17 (bounded pagination/sort/search) are judgment-heavy: written as assertions so a reasoning reviewer can confirm *every* surface is covered, not just the obvious ones, at build time.

---

## 7. Sources

- OWASP — *Top 10 Web (2025)* — https://owasp.org/Top10/2025/ (A05:2025 Injection, now including XSS; A01:2025 Broken Access Control, into which SSRF is folded)
- OWASP — *Input Validation Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html (allowlist/positive validation, type+length+format, server-side)
- OWASP — *SQL Injection Prevention Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html (parameterized queries, allowlist for identifiers)
- OWASP — *XSS Prevention Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html (context-aware output encoding, framework escape hatches, sanitizers)
- OWASP — *SSRF Prevention Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html (host allowlist, block private/metadata IPs, redirect handling)
- OWASP — *File Upload Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html (magic-byte validation, extension allowlist, size cap, store outside webroot)
- Zod — *Schema validation* — https://zod.dev/ (`.strict()`, `.max()`, `z.enum()`, `.parse()` at the boundary)
