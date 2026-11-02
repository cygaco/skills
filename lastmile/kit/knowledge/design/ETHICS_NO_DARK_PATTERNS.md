---
guide: ETHICS_NO_DARK_PATTERNS
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: standard
maps_to: [design-handoff, copy]
sources:
  - "https://www.deceptive.design/"
  - "https://www.deceptive.design/types"
  - "https://en.wikipedia.org/wiki/Dark_pattern"
  - "https://www.nngroup.com/articles/ten-usability-heuristics/"
  - "https://www.ftc.gov/business-guidance/blog"
  - "https://www.w3.org/TR/WCAG22/"
---

# Ethics — No Dark Patterns

**Honest design helps the user do what *they* came to do; a dark (deceptive) pattern tricks or pressures the user into doing what the *business* wants instead.** Design persuades by making the good choice clear and easy; it deceives when it hides, lies, shames, traps, or manufactures pressure. This guide gives the named deceptive-pattern catalogue, their detectable signatures, and the rule that ties them to the **claims-boundary**: the interface may never promise what the product can't back.

## Why it matters

Persuasion and deception sit on a continuum, and the line is the user's *informed, intended* choice. A clear, prominent CTA that states a true offer is good design. The same CTA built on a fake countdown, a pre-checked add-on, a hidden fee at checkout, or a guilt-trip decline button is a dark pattern. Dark patterns extract short-term conversions at the cost of trust, retention, refunds, chargebacks, app-store rejections, and — increasingly — legal liability (EU Digital Services Act Art. 25; FTC enforcement in the US explicitly targets deceptive "dark pattern" UX).

For **design and review work** this is a guardrail on the *conversion* cluster:

- **Landing-page and checkout design** is where the temptation is strongest — its job is to lift conversion, and dark patterns *look* like conversion wins. This guide is the boundary on that work: optimize the *honest* funnel, never the deceptive one.
- **App-screen design** owns the in-app equivalents — roach-motel cancellation, nagging permission prompts, pre-checked sharing defaults, confirmshaming opt-outs.
- **On the rendered page, you (or your AI) can check:** *is the rendered intent faithful and honest, or does it deceive?* A flow that misrepresents the action is an intent-fidelity defect.
- **Read the copy on the rendered page:** misleading labels, confirmshaming wording, fake-urgency strings, and trick questions are copy defects.

It also directly reinforces NN/g heuristics #3 (user control & freedom — easy exit/undo, no traps) and #5 (error prevention — don't engineer the user into mistakes).

### The claims-boundary tie-in (load-bearing)

The **claims-boundary** says: *a page/flow may only promise what the product can actually deliver.* Dark patterns are the design-side breach of that boundary — they make the interface assert things that aren't true:

- **Fake urgency / scarcity** claims a deadline or stock limit that doesn't exist.
- **Fake social proof** claims popularity/endorsement that isn't real.
- **Hidden costs / sneaking** claims a price the user won't actually pay.
- **Trick wording / disguised ads** claim an identity or meaning the element doesn't have.
- **A "free"/"no commitment" CTA** that leads to a charge or a hard-to-cancel subscription claims a freedom the product doesn't grant.

So every dark-pattern check is also a claims-boundary check: **if the UI states or implies a fact (a count, a deadline, a price, a popularity, a guarantee, an identity), that fact must be true and backed.** Unverifiable or false claims are both a dark pattern *and* a claims-boundary violation, and should be flagged as such.

## Core principles & techniques

### 1. The honest-design baseline

- **Symmetry of choice.** The path the user wants (decline, cancel, opt out, the cheaper option) is as easy and visible as the path the business wants (accept, subscribe, upgrade). Making "yes" a big button and "no" a tiny grey link is asymmetry — a dark pattern.
- **Informed consent by default.** Defaults reflect the *least* the user is committing to; anything extra (add-ons, marketing email, data sharing, recurring billing) is opt-*in*, clearly disclosed, never pre-checked.
- **Truth in every claim.** Counts, prices, timers, stock, ratings, and endorsements shown to the user are real (claims-boundary).
- **Reversibility.** Easy undo/exit/cancel; signing up is no harder than cancelling (NN/g #3).
- **No manufactured emotion.** Persuade with value, not guilt, fear, or shame.

### 2. The deceptive-pattern catalogue (with signatures)

The canonical taxonomy (Brignull / deceptive.design), each with how it reads and how to detect it:

| Pattern | What it does | Detectable signature |
|---|---|---|
| **Sneaking** | Draws the user into a transaction on false pretences — info hidden/delayed | Costs/terms/items revealed only at the last step; an item added to cart the user didn't choose |
| **Hidden costs** | Low advertised price, surprise fees at checkout | Final total > advertised; fees first appear on the last step |
| **Hidden subscription / forced continuity** | Silent enrollment into recurring billing; free trial → auto-charge | Recurring charge not clearly disclosed pre-commit; no clear "this renews at $X on DATE" |
| **Hard to cancel (roach motel)** | Easy to sign up, very hard to cancel | Cancel buried, requires phone/email, multi-step obstruction vs one-click signup |
| **Confirmshaming** | Guilt/shame to manipulate a choice | Decline option worded to shame ("No thanks, I don't want to save money") |
| **Trick wording** | Confusing/misleading language to misdirect | Double negatives, inverted checkbox logic ("Uncheck to not opt out"), ambiguous toggles |
| **Preselection** | A consequential option pre-selected for the user | Pre-checked add-ons, marketing opt-in, or data-sharing boxes by default |
| **Visual interference / misdirection** | Hides/obscures/disguises info; styles the wrong choice as the obvious one | Decline link low-contrast/tiny; accept button dominant; important terms greyed/small |
| **Fake urgency** | Fake time limit to pressure | Countdown that resets on reload or never actually ends; "ends in 10:00" with no real deadline |
| **Fake scarcity** | Fake limited supply/popularity | "Only 2 left!" / "12 people viewing" with no real backing |
| **Fake social proof** | Fabricated reviews/testimonials/activity | "Someone just bought…" pop-ups with fake or random names; reviews that can't be verified |
| **Nagging** | Persistent interruptions to push an action | Repeated permission/upsell/notification prompts after the user already declined |
| **Obstruction** | Barriers to a legitimate task | Extra hoops to downgrade/export/delete account vs the easy upgrade path |
| **Forced action** | Requires an unrelated undesirable action to proceed | Must accept marketing/share contacts/create account to complete the real task |
| **Disguised ads** | Ad styled as content or a UI control | "Download" buttons that are ads; sponsored content not labeled |
| **Comparison prevention** | Makes options hard to compare | Bundled features/prices, inconsistent units, key info hard to line up |

### 3. The persuasion vs. deception test

For any conversion device, ask three questions. If any answer is "no," it's a dark pattern:

1. **Is every claim true?** (the count, deadline, price, popularity, identity — real and backed → claims-boundary)
2. **Is the user's preferred choice equally easy and visible?** (symmetry — no buried decline, no shamed opt-out, no pre-checked extra)
3. **Could the user predict, before committing, exactly what they're agreeing to?** (no hidden cost, no silent renewal, no surprise add-on)

Honest urgency exists (a real sale that truly ends; genuinely low stock) — the test is *truth + symmetry + predictability*, not "never create urgency."

### Trade-offs

- **Conversion now vs. trust later:** dark patterns lift a metric short-term and erode retention, reviews, refunds, and legal standing long-term. The honest funnel is the durable one.
- **Persuasion vs. manipulation:** emphasis, prominence, and real social proof are legitimate; fabrication, shame, traps, and hiding are not. The boundary is the user's informed intent.
- **Defaults:** a helpful default (remember-me on a personal device) differs from a self-serving one (pre-checked paid add-on). Default to what serves the user, opt-in for what serves the business.

## Concrete examples (build terms)

**DO — symmetric, truthful choice**
```tsx
<Button variant="primary">Start free — no card required</Button>
<Button variant="ghost">No thanks</Button>
// Decline is a real, visible, neutral option. "No card required" is true (no card is collected).
```

**DON'T — confirmshaming + visual interference**
```tsx
<Button variant="primary">Yes, I want to grow my business</Button>
<a className="text-[10px] text-gray-300">No, I don't care about success</a>
// ✗ shames the decline, ✗ decline is tiny/low-contrast (asymmetric)
```

**DON'T — preselected paid add-on**
```tsx
<Checkbox defaultChecked /> Add priority support (+$9/mo)
// ✗ consequential extra opted-in by default → preselection
```

**DO — opt-in extra, disclosed**
```tsx
<Checkbox /> Add priority support (+$9/mo) — optional, billed monthly, cancel anytime
```

**DON'T — fake urgency**
```tsx
const deadline = Date.now() + 10 * 60_000; // resets every page load → not a real deadline
<Countdown to={deadline} label="Offer ends in" />
// ✗ manufactured, resets on reload → fake urgency + claims-boundary breach
```

**DON'T — hidden subscription / sneaking**
```tsx
<Button>Start free trial</Button>
// ...no disclosure that it auto-charges $49 on day 8.  ✗ hidden subscription
// Honest: "Free for 7 days, then $49/mo. Cancel anytime before DATE and you won't be charged."
```

**DO — cancellation as easy as signup (anti-roach-motel)**
```tsx
// Account settings → "Cancel subscription" is one visible button, self-serve, same number of
// steps as signup; confirmation states the effective date. No phone/email gauntlet.
```

## Common failure modes

| Failure | How it reads to the user | How to detect |
|---|---|---|
| Asymmetric choice | "They're hiding the way out" | Compare prominence/contrast/size of accept vs decline; tiny/greyed decline = flag |
| Confirmshaming | Guilt-tripped on decline | Read decline/opt-out copy for shaming/manipulative wording |
| Preselection | Surprise charges/emails the user didn't choose | Inspect checkboxes/toggles for `defaultChecked`/pre-on consequential options |
| Fake urgency/scarcity | Pressure that turns out fake | Reload — countdown resets / stock unchanged = fabricated |
| Hidden costs | Total higher than advertised | Walk the flow; total/fees appearing only at the last step |
| Hidden subscription | Unexpected recurring charge | Look for trial/CTA with no clear "renews at $X on DATE / cancel anytime" |
| Roach motel | Can't get out | Compare signup vs cancel steps; cancel buried/off-product = flag |
| Trick wording | User does the opposite of intent | Double negatives / inverted toggle logic in opt-in/out copy |
| Fake social proof | Trust built on fabrication | "Someone just bought" / reviews with no verifiable backing |
| Nagging | Harassed after declining | Same prompt reappears after a decline |
| Disguised ads | Clicks the wrong thing | Ad styled as content/control, not labeled |
| Unbacked claim | Promise the product can't keep | Any stated fact (count/deadline/guarantee) with no real source → claims-boundary |

## ✅ Agent-applicable RULES (the payoff)

Format: category + severity + detection.

- **DP-1 — Symmetry of choice.** The user's preferred/safe option (decline, cancel, opt-out, cheaper) MUST be as easy and visible as the business-preferred one; no buried, tiny, or low-contrast decline.
  *Category:* copy, layout. *Severity:* **high**.
  *Detect:* compare prominence (size/contrast/position) of accept vs decline; decline materially less prominent = FAIL (NN/g #3).
  *Finding shape:* `observed: "Accept" is a primary button; decline is a 10px gray link; expected: decline equally reachable/legible`.

- **DP-2 — No confirmshaming.** Decline/opt-out copy MUST be neutral; no guilt, shame, or manipulative framing.
  *Category:* copy. *Severity:* **high**.
  *Detect:* read opt-out/decline labels; emotionally manipulative wording ("No, I don't want to succeed") = FAIL.

- **DP-3 — No preselection of consequential options.** Add-ons, paid extras, marketing opt-in, and data-sharing MUST be opt-in (unchecked/off by default).
  *Category:* copy. *Severity:* **high**.
  *Detect:* inspect checkboxes/toggles for `defaultChecked`/pre-enabled consequential options = FAIL.

- **DP-4 — No fake urgency or scarcity (claims-boundary).** Countdowns, "X left", and "N viewing" MUST reflect a real, backed condition; fabricated/resetting timers and unbacked scarcity are forbidden.
  *Category:* copy. *Severity:* **high** (**critical** if it directly drives a paid action).
  *Detect:* reload/re-enter — if a countdown resets or stock/viewer numbers are hardcoded/random with no source, FAIL (claims-boundary).

- **DP-5 — No hidden costs or hidden subscription (claims-boundary).** Total price and any recurring billing MUST be disclosed before commitment; trials state "renews at $X on DATE, cancel anytime."
  *Category:* copy. *Severity:* **critical**.
  *Detect:* walk the purchase/trial flow; fees or renewal terms first appearing post-commit, or absent, = FAIL.

- **DP-6 — No roach motel (cancellation symmetry).** Cancelling/downgrading/deleting MUST be self-serve and roughly as easy as signing up — not buried, not gated behind phone/email/extra hoops.
  *Category:* layout. *Severity:* **high**.
  *Detect:* compare signup vs cancel/delete step count and discoverability; cancel materially harder = FAIL (NN/g #3).

- **DP-7 — No trick wording.** Opt-in/out controls use clear, single-meaning language; no double negatives or inverted toggle logic.
  *Category:* copy. *Severity:* **medium** (**high** if it flips a consequential consent).
  *Detect:* read consent/toggle copy; double negatives or "uncheck to not opt out" patterns = FAIL.

- **DP-8 — No fake social proof or disguised ads.** Reviews/testimonials/activity shown MUST be real and verifiable; ads/sponsored content MUST be labeled and not disguised as UI/content.
  *Category:* copy. *Severity:* **high** (claims-boundary).
  *Detect:* check for unbacked "someone just bought"/random-name pop-ups and unlabeled sponsored elements.

- **DP-9 — No nagging / forced action.** A declined prompt MUST NOT immediately re-nag; the primary task MUST NOT require an unrelated undesirable action (forced signup/marketing/contact-sharing).
  *Category:* copy. *Severity:* **medium** (nagging) / **high** (forced action).
  *Detect:* decline a prompt and watch for re-appearance; check whether the core task is blocked behind an unrelated demand.

- **DP-10 — Every stated fact is backed (claims-boundary umbrella).** Any count, deadline, price, popularity, guarantee, or identity the UI asserts MUST be true and sourced.
  *Category:* copy. *Severity:* **high** (**critical** for price/guarantee).
  *Detect:* enumerate factual assertions in the UI; any that can't be tied to a real source/value = FAIL (this is the design-side claims-boundary check).

## Sources

- Harry Brignull — *Deceptive Patterns (deceptive.design)* (https://www.deceptive.design/)
- *Deceptive Design — Types of deceptive pattern* (https://www.deceptive.design/types)
- *Dark pattern — Wikipedia* (taxonomy + EU DSA Art. 25 regulatory provenance) (https://en.wikipedia.org/wiki/Dark_pattern)
- Nielsen Norman Group — *10 Usability Heuristics* (#3 user control & freedom, #5 error prevention) (https://www.nngroup.com/articles/ten-usability-heuristics/)
- U.S. Federal Trade Commission — *Business Guidance / enforcement on deceptive design* (https://www.ftc.gov/business-guidance/blog)
- W3C — *WCAG 2.2* (consent clarity, no-deception-adjacent operability) (https://www.w3.org/TR/WCAG22/)
