---
guide: LOGGING_BACKUP_IR
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [detect-respond]
sources:
  - "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html"
  - "https://www.rfc-editor.org/rfc/rfc9116"
  - "https://securitytxt.org/"
  - "https://owasp.org/Top10/2025/"
  - "https://supabase.com/docs/guides/platform/backups"
  - "https://supabase.com/docs/guides/platform/going-into-prod#availability"
  - "https://www.cisa.gov/sites/default/files/publications/Federal_Government_Cybersecurity_Incident_and_Vulnerability_Response_Playbooks_508C.pdf"
---

# Logging, Backups & Incident Response

**Prevention always partially fails. The question every launched app must be able to answer is "and then what?" — can you *detect* the breach while it's happening, *recover* the data after it, and *respond* in a way that contains the damage? An app with perfect RLS, secrets hygiene, and auth can still be slowly drained at 2 a.m. by a single residual bug — and if there are no audit logs, no alert to a human, no tested restore, and no runbook, that small breach becomes existential. Security is not only locks; it is also smoke detectors, backups, and a fire plan.**

This guide trains your AI to grade the **detect-and-respond** layer: audit logging of security-sensitive events, alerting to a real human, log redaction, tested backups/PITR, an incident runbook, and a vulnerability-reporting path (`security.txt`). These are the controls that turn "we got breached and lost everything and didn't notice for weeks" into "we caught it, contained it, and restored."

---

## 1. What this is

This domain covers the three controls that operate *around* prevention:

- **Detect** — audit logging of security-sensitive events plus alerting that reaches a real human on compromise/abuse signals. Without these, a breach is invisible until a customer or a public dump tells you.
- **Recover** — backups / point-in-time recovery (PITR) for the database and object storage, with a **restore that has actually been tested** — an untested backup is a hope, not a control.
- **Respond** — a written incident runbook (revoke sessions, rotate keys, pause AI spend, restore, notify) and a published vulnerability-disclosure path (`security.txt`, RFC 9116) so researchers can report a hole before it's exploited in the wild.

This maps to OWASP A09 (Security Logging and Monitoring Failures): the failure isn't a single exploitable bug, it's the *absence* of the machinery to notice and react to one. This domain owns the `detect-respond` vocabulary axis and guides building the logging/backup/alerting, closing the gaps, and asserting the rules in §6.

---

## 2. Why it matters

You will not catch every bug before launch. Webhook trust, an IDOR you missed, a leaked key, a dependency with a `postinstall` exfiltrator — something gets through. When it does, three outcomes diverge entirely on whether the detect/recover/respond layer exists:

- **No detection** → the attacker exports data slowly, deletes records, and you find out from a customer complaint or a credential dump weeks later. OWASP measures mean-time-to-detect for unmonitored apps in *months*.
- **No tested recovery** → backups exist on paper but the restore fails (wrong region, missing storage objects, PITR window already rolled past), and the deleted data is gone.
- **No runbook** → in the panic of an active incident, nobody knows how to revoke sessions, which keys to rotate, or how to pause the AI spend that the attacker is now running up — so the breach widens while you improvise.

The indie/AI-build amplifier: these controls produce *no visible product value* in the happy path, so they're the first thing skipped under launch pressure — and the most expensive omission when prevention fails.

**For a security review specifically:** you cannot grade detection by watching the app work — a missing alert and an untested backup are invisible until the day they're needed. You must affirmatively verify: (a) PITR/backups exist for production data **and** a restore has been tested at least once; (b) security-sensitive events are audit-logged (login failures, password/MFA changes, admin actions, role/billing changes, exports, webhook processing, key-setting changes); (c) alerts on compromise/abuse signals reach a **real human** (not just a log line nobody reads); (d) logs **redact** tokens, `Authorization` headers, reset links, secrets, and PII; (e) an incident runbook and key-rotation checklist exist; (f) a `security.txt` / security contact is published. The rules in §6 are written so each is an independently checkable PASS/FAIL.

---

## 3. Core principles / techniques

### 3.1 Backups & PITR — and a *tested* restore

- **Enable point-in-time recovery or daily backups** for the production database (Supabase PITR, managed-Postgres snapshots, etc.). Know your recovery window and recovery-point objective.
- **Back up — or be able to reproduce — object storage/uploads** too; RLS-free file buckets are data stores, and a DB-only backup loses every user file.
- **Test the restore at least once before launch.** Spin up the backup into a scratch environment and confirm the data is actually there and usable. The most common backup failure is discovering at recovery time that the backup was incomplete, misconfigured, or never ran. An untested backup does not count as a control.

### 3.2 Audit logging of security-sensitive events

Log the events that matter for *investigating a breach*, not just app analytics. Minimum security-event coverage (OWASP Logging Cheat Sheet):
- **Authentication events** — login *failures* (and successes), lockouts, MFA enrollment/removal, password changes/resets.
- **Authorization-sensitive actions** — admin actions, role/permission changes, billing/subscription changes, org membership/invite changes.
- **Data movement** — bulk exports, large downloads, data-deletion events.
- **Integration events** — webhook processing (and signature failures), key/secret/setting changes, API-key creation/revocation.

Each entry carries **who, what, when, and from where** (actor id, action, timestamp, source IP/request id), is append-only/tamper-evident where feasible, and — critically — is **redacted** (see 3.4). Use a consistent event vocabulary so alerts and queries are reliable.

### 3.3 Alerting to a real human

A log nobody reads is not detection. Wire alerts — to a channel an actual person watches (PagerDuty, on-call, even a dedicated Slack/email) — for the signals that correlate with compromise or abuse:
- **Error/status spikes** — bursts of `401`/`403`/`429`/`500` (probing, brute-force, scraping, or breakage).
- **Failed-login bursts** for one account or from one source (credential stuffing/brute-force).
- **Privilege/identity changes** — a new admin created, a role escalation.
- **Mass export / large download** — exfiltration signal.
- **Webhook-signature failures** — someone forging provider events.
- **Spend spikes** — AI/provider cost crossing a threshold (the "free Pro → bill bomb" tail; overlaps `RATE_LIMITING_AND_ABUSE.md`).

Tune thresholds so alerts are actionable, not noise — an alert that's always firing trains the human to ignore it.

### 3.4 Log redaction — logs are a secondary breach source

Logs get shipped to third-party aggregators, read by support, and sometimes leaked. They must **never** contain:
- `Authorization` headers, bearer tokens, session cookies.
- Password-reset / magic-login links and OTP codes.
- API keys, webhook signing secrets, DB credentials.
- Full PII payloads or full LLM prompts/responses carrying sensitive data.

Redact at the logging boundary (a serializer/middleware that strips known-sensitive keys and header patterns), not by remembering to omit them at each call site. Treat a secret-shaped value in any log line as a finding (overlaps `SECRETS_AND_CONFIG.md` SECRET-11).

### 3.5 Incident runbook & key-rotation checklist

Keep a **one-page runbook** so an active incident is execution, not improvisation. It must say *exactly* how to:
- **Revoke sessions** ("sign out everywhere" / invalidate the session store).
- **Rotate keys/secrets** — the provider-by-provider list of what to rotate and where (DB, API keys, webhook secrets, OAuth client secrets).
- **Pause AI / expensive spend** — the kill switch for provider endpoints so a takeover can't run up the bill.
- **Restore** from backup/PITR (pointer to the tested procedure).
- **Notify** — who tells users, and when legal/regulatory notification is required.

### 3.6 Vulnerability disclosure — `security.txt`

Publish **`/.well-known/security.txt`** (RFC 9116) with at least a `Contact:` (security email or reporting form) and an `Expires:` field. It gives researchers a safe, obvious path to report a hole privately before it goes public or gets sold. For revenue apps, budget a lightweight pentest or a vulnerability-disclosure program.

---

## 4. Concrete examples (build terms)

**Backups — DON'T / DO**
- DON'T: assume "Supabase has backups" and never check; discover at recovery time PITR was off on the free tier and the window is gone.
- DO: enable PITR/daily backups, restore into a scratch project once before launch, confirm the rows + storage objects are present, and document the restore steps in the runbook.

**Audit logging — DON'T / DO**
- DON'T: log only request paths and 200s; a slow data export leaves no trace of *who* exported *what*.
- DO: emit a structured `data.export` / `auth.login.fail` / `admin.role.change` event with `{actor, action, target, ts, ip, request_id}` for each security-sensitive action.

**Alerting — DON'T / DO**
- DON'T: write failed logins to a log table nobody queries; a credential-stuffing run goes unnoticed for days.
- DO: alert a human channel when one account exceeds N failed logins in M minutes, when a new admin is created, when webhook-signature failures spike, or when daily spend crosses budget.

**Log redaction — DON'T / DO**
- DON'T: `logger.info('reset', { url: resetLink })` or `logger.info(req.headers)` — the reset link / `Authorization` bearer lands in your aggregator.
- DO: pass logs through a redactor that drops `authorization`, `cookie`, `set-cookie`, token/secret keys, and reset-link params before they're written/shipped.

**Incident runbook — DON'T / DO**
- DON'T: have no written steps; in the 2 a.m. incident you Google "how to rotate Supabase service_role key" while data leaves.
- DO: keep `RUNBOOK.md` — revoke sessions → rotate {DB, service_role, OpenAI, Stripe, webhook} keys → pause AI endpoints → restore → notify — runnable without thinking.

**security.txt — DON'T / DO**
- DON'T: no contact path; a researcher who finds an IDOR either drops it publicly or sells it.
- DO: serve `/.well-known/security.txt` with `Contact: mailto:security@example.com` and an `Expires:` date.

---

## 5. Common failure modes

| Failure | How it bites | How to detect |
|---|---|---|
| No backups / PITR for production data | A bug, attacker, or fat-finger delete is unrecoverable | No PITR/daily backup configured for the prod DB; storage/uploads not backed up or reproducible |
| Backups exist but restore never tested | Recovery fails when it finally matters (wrong region, missing objects, stale window) | No documented/dated restore drill into a scratch environment |
| No audit log of security-sensitive events | Breach is uninvestigable — no record of who did what | No structured events for login failures, admin actions, exports, role/billing changes, webhook processing, key/setting changes |
| Audit log exists but no human is alerted | The attack runs for weeks because logs are write-only | No alerting wired to a real channel; "monitoring" is a table nobody queries |
| No alert on compromise/abuse signals | Credential stuffing, mass export, forged webhooks, spend bombs go unnoticed | No threshold alerts on 401/403/429/500 spikes, failed-login bursts, new admin, mass export, webhook-sig failures, spend spikes |
| Secrets/PII written to logs | Logs become a secondary breach source; aggregator leak = credential leak | `Authorization`/cookie headers, reset links, API keys, webhook secrets, or full PII/prompts in log output |
| No incident runbook | The incident is improvised; containment is slow and incomplete | No documented steps to revoke sessions, rotate keys, pause AI spend, restore, notify |
| No key-rotation checklist | Half the compromised keys are missed; attacker retains access | No provider-by-provider list of what to rotate and where |
| No `security.txt` / security contact | Researchers have no safe path; bugs go public or get sold | No `/.well-known/security.txt`; no published security contact |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Recover**
- **[OPS-01] critical — Backups / point-in-time recovery exist for production data AND a restore has been tested at least once.** → `detect-respond`. Detect: no backup or PITR configured for the production DB, storage/uploads not backed up or reproducible, or no documented/dated restore test = FAIL (observed unrecoverable/untested, expected backed-up + restore-verified).

**Detect — logging**
- **[OPS-02] serious — Audit logs exist for security-sensitive events (login failures, password/MFA changes, admin actions, role changes, billing changes, exports, webhook processing, key/setting changes), each carrying who/what/when/where.** → `detect-respond`. Detect: no structured security-event logging for these actions = FAIL.

**Detect — alerting**
- **[OPS-03] serious — Alerts reach a real human for likely compromise/abuse signals (401/403/429/500 spikes, failed-login bursts, new admin created, mass export, webhook-signature failures, spend spikes).** → `detect-respond`. Detect: no alerting wired to a human-watched channel for these signals (logs are write-only) = FAIL.

**Respond**
- **[OPS-04] serious — An incident runbook and key-rotation checklist exist with concrete steps to revoke sessions, rotate keys/secrets, pause AI/expensive spend, restore from backup, and notify users/regulators.** → `detect-respond`. Detect: no documented incident steps or no per-provider rotation checklist = FAIL/WARN.

**Detect — redaction**
- **[OPS-05] serious — Logs redact secrets and sensitive tokens — no `Authorization` headers, cookies, reset/magic links, API keys, webhook signing secrets, or full PII/prompts in log output.** → `detect-respond`. Detect: a secret-shaped value, auth header/cookie, reset link, or full-PII payload present in any log line/sink = FAIL.

**Disclosure**
- **[OPS-06] minor — A public vulnerability-reporting path exists (`/.well-known/security.txt` per RFC 9116, or a published security contact).** → `detect-respond`. Detect: no `security.txt` and no published security contact = WARN.

> **Coverage note:** OPS-05 (secrets in logs) and OPS-06 (`security.txt` presence) are largely grep/HTTP-detectable. OPS-01 (restore *tested*), OPS-02/03 (event coverage + a human actually alerted), and OPS-04 (runbook completeness) require reading config + ops docs and confirming a human-in-the-loop — judgment checks written as assertions so a reasoning reviewer can evaluate each independently. Maps to OWASP A09 (Security Logging and Monitoring Failures).

---

## 7. Sources

- OWASP — *Logging Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html (which security events to log, who/what/when/where, redaction)
- OWASP — *Logging Vocabulary Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html (consistent security-event vocabulary for reliable alerting/queries)
- IETF — *RFC 9116: A File Format to Aid in Security Vulnerability Disclosure (`security.txt`)* — https://www.rfc-editor.org/rfc/rfc9116 (`Contact:`/`Expires:`, `/.well-known/` location)
- securitytxt.org — *security.txt generator/spec reference* — https://securitytxt.org/ (practical `security.txt` authoring)
- OWASP — *Top 10:2025* — https://owasp.org/Top10/2025/ (A09 Security Logging and Monitoring Failures)
- Supabase — *Database Backups* — https://supabase.com/docs/guides/platform/backups (PITR vs daily backups, recovery windows)
- Supabase — *Going into Production / Availability* — https://supabase.com/docs/guides/platform/going-into-prod#availability (backup + restore readiness before launch)
- CISA — *Federal Government Cybersecurity Incident and Vulnerability Response Playbooks* — https://www.cisa.gov/sites/default/files/publications/Federal_Government_Cybersecurity_Incident_and_Vulnerability_Response_Playbooks_508C.pdf (incident-response runbook structure: detect → contain → eradicate → recover → notify)
