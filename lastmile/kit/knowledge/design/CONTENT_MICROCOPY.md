---
guide: CONTENT_MICROCOPY
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: standard
maps_to: [design-handoff, copy]
sources:
  - "https://www.nngroup.com/articles/ten-usability-heuristics/"
  - "https://www.nngroup.com/articles/error-message-guidelines/"
  - "https://www.nngroup.com/articles/microcontent-how-to-write-headlines-page-titles-and-subject-lines/"
  - "https://www.nngroup.com/articles/plain-language-experts/"
  - "https://www.w3.org/TR/WCAG22/"
---

# Content & Microcopy (UX Writing)

**Microcopy is the small, functional text that does the heavy lifting of the interface** — button labels, form hints, error and empty-state messages, tooltips, confirmations, placeholders. Good microcopy is clear, concise, useful, and consistent: it tells the user exactly what will happen, what went wrong and how to fix it, and what to do next — in plain language, in the user's words.

## Why it matters

Words *are* interface. A user doesn't read a button and a label as "design" and "copy" — they read one thing and act. The most beautiful component with the wrong word fails the user; a plain component with the right word succeeds. Microcopy is where the product talks to the user at the exact moment of a decision (submit? cancel? retry?), so its quality is felt as confidence or anxiety, clarity or confusion.

For **design and review work**:

- **App screens and landing pages** both need their in-context words authored and reviewed — labels, errors, empty states, CTAs. Copy that doesn't match the design intent (a "Save" button that actually publishes; a CTA that promises more than the offer) is a handoff defect.
- **On the rendered page, you (or your AI) can check:** *does the rendered copy match your approved copy and the action's true behavior?* An approved label that's missing, wrong, or truncated is a defect to flag, not wave through.
- **This guide covers copy defects on the rendered page:** wrong/missing/placeholder text, untranslated keys, lorem ipsum in production, mismatched headings, and misleading labels.

Microcopy also reinforces the **claims-boundary** rule (see [`ETHICS_NO_DARK_PATTERNS.md`](ETHICS_NO_DARK_PATTERNS.md)): the words on the page must not promise what the product can't back.

## Core principles & techniques

### 1. Clear, concise, useful — in that priority order

The NN/g triad for all UX text:

- **Clear first.** The user must understand it on the first read, with no domain knowledge. If clarity and brevity conflict, *clarity wins* — a slightly longer label that's unambiguous beats a terse one that's cryptic.
- **Concise second.** Cut every word that doesn't change meaning. Users scan, they don't read; front-load the meaningful word ("Delete" not "Click here to delete"). But never amputate the noun the label needs to be unambiguous.
- **Useful third.** If a piece of text doesn't help the user decide or act, it's noise. Decorative microcopy ("Awesome choice!") that doesn't inform is cognitive cost with no payoff.

### 2. Plain language, in the user's words

- **Write for the audience, not the system.** No internal jargon, no error codes as the primary message, no developer/database terms ("null", "exception", "invalid input"). The user cares about their task, not your stack.
- **Use the words the user uses.** Match the user's mental model and vocabulary ("Sign in" not "Authenticate"; "Trash"/"Bin" not "Soft-delete queue"). This is recognition-over-recall in words.
- **Plain doesn't mean dumb** — it means *accessible*. Even expert audiences read plain language faster and prefer it; plain language correlates with higher task success and satisfaction across expertise levels.
- **Reading level:** aim low (roughly grade 7–9 for general audiences). Short sentences, common words, active voice, "you" and verbs.

### 3. Buttons & CTAs: name the action and its outcome

A button label must answer *"what happens when I click this?"* — specifically.

- **Action verb + object.** "Create account", "Send invite", "Delete project" — not "Submit", "OK", "Go", "Click here". Generic labels force the user to reconstruct meaning from context and raise anxiety at the decision point.
- **First-person can lift conversion** ("Start my free trial" vs "Start your free trial") but consistency matters more than the gimmick — pick one voice and hold it.
- **The label must match the real behavior.** A button that says "Save" must save, not publish or charge. Mismatch is both a copy defect and a trust/ethics violation.
- **Pair destructive labels with the consequence.** A confirm dialog for deletion says "Delete 3 files" (specific, names the count/object), and the destructive button is *not* the visually dominant default.

### 4. Error messages: say what's wrong, why, and how to fix it (NN/g #9)

The single highest-leverage microcopy. A good error message has up to four parts:

1. **What went wrong** — in human terms ("That email address isn't recognized").
2. **Why / the constraint** — the rule the input violated ("Passwords need at least 8 characters").
3. **How to fix it** — the concrete next action ("Check the spelling, or reset your password").
4. **Preserve the user's work** — never wipe the form; keep entered data and put focus on the field to fix.

Rules:

- **Be specific, not generic.** "Something went wrong" / "Invalid input" tells the user nothing. State the field and the requirement.
- **Be human and blameless.** No accusatory language ("You entered an illegal value"), no system-speak ("Error 0x80004005"), no ALL-CAPS shouting. State the problem and the path forward.
- **Be polite and constructive.** Suggest the fix; offer a way out (retry, contact, alternative).
- **Place it where the problem is.** Inline, next to the offending field, not only in a top-of-page banner the user has to hunt through. Validate at the right time (inline as the user finishes a field, or on submit — not nagging on every keystroke before they've finished typing).
- **Visibility:** an error must be perceivable (not color-alone — see [ACCESSIBILITY_WCAG](ACCESSIBILITY_WCAG.md)), associated with its field for screen readers (`aria-describedby`), and the field marked `aria-invalid`.

### 5. Empty states, loading, success, confirmation — close the loop

State coverage is also a *copy* job:

- **Empty states** teach: explain why it's empty and what to do to fill it ("No projects yet — create your first one to get started"), with the primary action right there. A blank screen with no words is a dead end.
- **Loading / progress** copy reassures during waits ("Uploading… this can take a minute for large files").
- **Success / confirmation** copy confirms what happened and what's next ("Invite sent to sam@example.com"). No silent success — every meaningful action gets a worded acknowledgment.
- **Placeholders are not labels.** Placeholder text disappears on input, fails contrast and accessibility, and must never replace a visible label. Use it only for *format examples* ("e.g. you@example.com") atop a real label.

### 6. Consistency of terminology and voice

- **One name per concept.** If it's a "Project" in the nav, it's a "Project" in the button, the empty state, and the error — never "workspace" here and "project" there. Inconsistent terms make the user wonder if they're two different things (violates NN/g #4 consistency).
- **Consistent voice and casing.** Pick sentence case vs. Title Case for buttons/headings and apply it everywhere; pick a tone (e.g. plain-helpful) and hold it across success, error, and empty states.
- **Consistent capitalization, punctuation, and number/date formats.** These are tokens of a system; drift reads as sloppiness.

### 7. Headings, labels, and scannable microcontent

- **Front-load meaning.** Headings, page titles, and link text must make sense out of context (users scan headings and links first). "Reset your password" not "Click here"; descriptive section headings not clever ones.
- **Labels describe the input's purpose**, are always visible, and read in plain terms ("Work email" not "Email_2"). Mark required vs optional explicitly in words, not only with a `*`.

### Trade-offs

- **Brevity vs. clarity:** default to clarity; only trim once meaning is safe.
- **Personality vs. function:** brand voice is fine in low-stakes moments (empty states, onboarding) but must never obscure function in high-stakes moments (errors, payment, destructive confirms) — there, be boringly clear.
- **Helpfulness vs. nagging:** inline guidance helps; the same guidance fired too early/too often becomes nagging (a dark-pattern adjacency).

## Concrete examples (build terms)

**DO — specific, action-named CTA**
```tsx
<Button type="submit">Create account</Button>
// not <Button>Submit</Button> — the verb+object tells the user the outcome.
```

**DO — error that says what/why/how, inline, accessible**
```tsx
<Input id="email" aria-invalid={!!error} aria-describedby="email-err" />
{error && (
  <p id="email-err" role="alert" className="text-destructive text-sm">
    We don’t recognize that email. Check the spelling or create a new account.
  </p>
)}
// what (not recognized) + how (check spelling / create account); tied to the field; not color-alone (has text).
```

**DON'T — generic, system-speak, color-only error**
```tsx
<p className="text-red-500">Invalid input.</p>   // ✗ vague, ✗ blames, ✗ no fix,
                                                 // ✗ not associated with a field, ✗ meaning by color alone
```

**DO — empty state that teaches and offers the action**
```tsx
<EmptyState
  title="No projects yet"
  body="Create your first project to start tracking work."
  action={<Button>New project</Button>}
/>
```

**DON'T — placeholder as the only label**
```tsx
<Input placeholder="Email" />   // ✗ label vanishes on input, ✗ fails a11y/contrast — use a real <Label>.
```

**DON'T — lorem ipsum / unresolved key shipped**
```tsx
<h1>Lorem ipsum dolor</h1>      // ✗ copy regression
<span>{t('cta.label')}</span>   // renders the KEY, not text  ✗ untranslated/missing copy
```

## Common failure modes

| Failure | How it reads to the user | How to detect |
|---|---|---|
| Generic button labels ("Submit", "OK", "Go") | "What will this actually do?" — hesitation, mis-clicks | Scan all buttons for verb+object; bare "Submit/OK/Go/Click here" = flag |
| Vague errors ("Invalid input", "Something went wrong") | No idea what to fix; abandons the form | Trigger each validation; error must name the field + the fix |
| System-speak / error codes as the message | Confusion, distrust | Look for "null/undefined/exception/Error 0x…" surfaced to the user |
| Placeholder used as the label | Label gone after first keystroke; a11y fail | Inputs with placeholder and no associated `<label>` |
| Lorem ipsum / unresolved i18n keys in render | Broken, unfinished product | Grep rendered text for "lorem", `t('…')`, `{{…}}`, `undefined` |
| Inconsistent terminology for one concept | "Are these two different things?" | Diff the noun used for the same object across nav/button/error/empty |
| Label ≠ behavior (Save that publishes) | Surprise, broken trust | Compare label verb to the action's actual effect |
| Silent success (no confirmation) | "Did that work?" — repeats the action | After each mutating action, check for a worded confirmation |
| Truncated/missing approved copy | Headline cut off, label clipped | Compare rendered text to your approved copy; check for ellipsis/overflow |

## ✅ Agent-applicable RULES (the payoff)

Format: category + severity + detection.

- **CM-1 — CTA labels name the action.** Every button/CTA uses a specific verb (+object); bare generic labels ("Submit", "OK", "Go", "Click here", "Continue" with no object where ambiguous) are flagged.
  *Category:* copy. *Severity:* **medium** (**high** for a primary/conversion CTA).
  *Detect:* enumerate buttons; flag generic labels.
  *Finding shape:* `observed: primary CTA reads "Submit"; expected: action-specific label e.g. "Create account"`.

- **CM-2 — Errors say what + how.** Every error/validation message states the problem AND a concrete fix in human language; no vague ("Invalid input") or system-speak (codes, "null", stack terms) errors.
  *Category:* copy. *Severity:* **high**.
  *Detect:* trigger each validation/error path; message must identify the field/problem and the remedy. Generic/system text = FAIL (NN/g #9).

- **CM-3 — Errors are accessible & not color-alone.** Error text is associated with its field (`aria-describedby` + `aria-invalid`/`role="alert"`) and is conveyed by text, not color alone.
  *Category:* accessibility, copy. *Severity:* **high**.
  *Detect:* a11y tree — error node linked to the input; remove color and confirm the message still communicates.

- **CM-4 — No placeholder-as-label.** Inputs have a persistent visible label; placeholder is at most a format hint, never the only label.
  *Category:* copy, accessibility. *Severity:* **medium**.
  *Detect:* inputs with `placeholder` and no associated `<label>`/accessible name.

- **CM-5 — No placeholder/lorem/unresolved copy in render.** No lorem ipsum, no untranslated i18n keys (`t('…')`, `{{key}}`), no `undefined`/`null` rendered as text, no "TODO copy".
  *Category:* copy. *Severity:* **critical** (broken/unfinished content shipped).
  *Detect:* scan rendered text for lorem, key syntax, `undefined`.
  *Finding shape:* `observed: hero renders "cta.label"; expected: resolved text from your approved copy`.

- **CM-6 — Terminology is consistent.** One name per concept across nav, buttons, errors, and empty states; consistent casing/voice.
  *Category:* copy. *Severity:* **medium**.
  *Detect:* diff the noun/verb used for the same object/action across surfaces; divergence = flag.

- **CM-7 — Label matches behavior.** A control's label truthfully describes its effect (a "Save" doesn't publish/charge; a "Free" CTA doesn't lead to immediate payment).
  *Category:* copy. *Severity:* **high** (trust/ethics adjacency).
  *Detect:* compare each action label to its real effect; mismatch = FAIL (see ETHICS_NO_DARK_PATTERNS / claims-boundary).

- **CM-8 — Empty & success states are worded.** Empty states explain + offer the next action; mutating actions produce a worded confirmation (no silent success, no wordless dead-end).
  *Category:* copy. *Severity:* **medium**.
  *Detect:* visit empty list/collection views and post-action states; absence of guiding/confirming copy = flag.

- **CM-9 — Rendered copy matches what you approved.** Headings, labels, and body match your approved copy and design; no truncation/overflow hiding required text.
  *Category:* copy. *Severity:* **high** if required copy is missing/clipped.
  *Detect:* compare rendered text to your approved copy (the wording you signed off); check for ellipsis/overflow on required strings.

## Sources

- Nielsen Norman Group — *10 Usability Heuristics* (#4 consistency, #9 help users recognize/recover from errors) (https://www.nngroup.com/articles/ten-usability-heuristics/)
- Nielsen Norman Group — *Error-Message Guidelines* (https://www.nngroup.com/articles/error-message-guidelines/)
- Nielsen Norman Group — *Microcontent: Headlines, Page Titles, Subject Lines* (https://www.nngroup.com/articles/microcontent-how-to-write-headlines-page-titles-and-subject-lines/)
- Nielsen Norman Group — *Plain Language Is for Everyone, Even Experts* (https://www.nngroup.com/articles/plain-language-experts/)
- W3C — *WCAG 2.2* (labels, error identification/suggestion, name-role-value) (https://www.w3.org/TR/WCAG22/)
