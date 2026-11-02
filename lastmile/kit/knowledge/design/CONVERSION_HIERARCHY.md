---
guide: CONVERSION_HIERARCHY
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [hierarchy, layout, copy]
sources:
  - "https://cxl.com/blog/how-to-build-a-high-converting-landing-page/"
  - "https://cxl.com/blog/above-the-fold/"
  - "https://unbounce.com/conversion-glossary/definition/attention-ratio/"
  - "https://lawsofux.com/von-restorff-effect/"
  - "https://lawsofux.com/serial-position-effect/"
  - "https://www.nngroup.com/articles/page-fold-manifesto/"
  - "https://unbounce.com/conversion-rate-optimization/landing-page-cta-placement/"
---

# Conversion Hierarchy

**Conversion hierarchy is visual hierarchy applied to a page that has exactly one job: arrange the page so a first-time visitor, scanning for a few seconds, perceives the value proposition, then the proof, then a single unmissable call-to-action — with no competing focal point pulling attention off that path.**

This guide covers the marketing/landing surface, and gives checkable rules for visual hierarchy, layout and copy that you (or your AI) can check on the rendered page.

---

## 1. What this is

A landing/marketing page is not a brochure that lists everything — it is a **single-goal instrument**. Conversion hierarchy is the discipline of making the *one desired action* the visual and narrative destination of the page, and subordinating everything else to it. It rests on three pillars:

1. **One page, one goal** — the page is built around a single conversion (sign up, buy, book, request) and every element either advances that goal or is removed.
2. **A dominant focal path** — `hook → proof → CTA`: the eye lands on the value proposition, is convinced by proof, and arrives at the action. There is one dominant CTA, not several equals.
3. **Low attention ratio** — the ratio of clickable distractions to conversion goals trends toward **1:1**: ideally one meaningful action and nothing competing for the click.

This is visual hierarchy specialized for a page whose success is *measured* — the general three-step reading flow (entry → secondary → finisher) becomes literally hook → proof → CTA.

---

## 2. Why it matters

**For the product/user:** a visitor decides in seconds whether a page is worth their time. If the page has no clear focal point — three equal-weight buttons, a hero that states a category instead of a benefit, a nav bar full of escape hatches — the visitor doesn't know what to do, so they do nothing. "If everything stands out, nothing stands out" is not an aesthetic complaint on a landing page; it is lost conversion. Eye-tracking work (NN/g) shows attention concentrates on the first viewport but users *do* scroll when the top earns it; the job of the hierarchy is to earn the scroll and then deliver the action.

**For design and review work:**
- This guide covers conversion hierarchy for landing pages: visual hierarchy specialized for conversion.
- On the rendered page it covers layout (is there one dominant focal point? is the CTA unmissable?) and copy (does the headline state a benefit? does each section install a belief or remove an objection?).
- It is the guardrail that keeps a page from becoming a feature list — and it pairs with the ethics guide so that "make the CTA dominant" never tips into manipulative urgency.

---

## 3. Core principles / techniques

### 3.1 One page, one goal (and a low attention ratio)

Every page exists to drive **one** conversion. **Attention ratio** = (number of clickable things) ÷ (number of conversion goals). A homepage might be 40:1; a focused landing page should approach **1:1** — one primary action, and links/nav that don't lead away from the goal are removed or demoted. Every extra link is an exit. The practical test: *can you name the one thing this page wants the visitor to do?* If you name two, the hierarchy is already compromised.

> **Trade-off:** 1:1 is the *campaign-landing-page* ideal (paid traffic, single intent). A homepage or a content page legitimately serves multiple intents and won't be 1:1 — apply the principle proportionally: even multi-intent pages should have **one clearly dominant** action per viewport, not a wall of equals.

### 3.2 The focal path: hook → proof → CTA

Plan the eye's journey as a narrative, top to bottom:

1. **Hook (value proposition, above the fold).** The first thing seen must answer "what is this and why should I care?" in a **benefit**, not a category. "Get paid in 2 days, not 30" beats "Invoicing software." The hook is the largest, highest-contrast text on the page (the H1), paired with a supporting subhead and the primary CTA.
2. **Proof (the convince layer).** Below the hook, supply what makes the claim believable: social proof (counts, testimonials, logos as evidence not decoration), concrete outcomes, a short how-it-works, objection handling. The principle: **every section installs a belief or removes an objection.** A section that does neither is filler and dilutes the path.
3. **CTA (the finisher).** The desired action, repeated at each natural decision point (after the hook, after proof, at the end) — but always the **same** primary action, visually dominant each time.

### 3.3 Above the fold — what it is and what belongs there

"The fold" still matters as the **first impression and the engagement gate**, even though users scroll. Research (NN/g) finds attention concentrates above the fold (~57% of viewing time) but a large share happens below — so the model is: **above the fold = the promise; below the fold = the proof.** The first viewport should contain, at minimum: the value-prop headline, a one-line supporting subhead, the primary CTA, and a trust/visual anchor (hero image or key proof). It should NOT try to contain *everything* — cramming the whole pitch into the first screen kills the scroll and buries the CTA.

> **Contrarian (hold this honestly):** "the fold is dead" overstates a real point — a *long* page with the CTA below the fold can outperform a cramped one, because a high-intent visitor scrolls and a well-built page builds desire before asking. The rule is therefore not "CTA must be above the fold" but "**the primary action must be reachable without hunting, present in the first viewport AND repeated at decision points.**"

### 3.4 The dominant CTA — making one element unmissable

The primary CTA must win the visual competition decisively. Levers (these are visual-hierarchy techniques pointed at the button):
- **Isolation (Von Restorff / the isolation effect):** the element that differs from its surroundings is the one noticed and remembered. The primary CTA should be the *one* element in its dominant accent color; if five things share that color, none of them is special. Surround it with whitespace so it stands alone.
- **Contrast for emphasis:** high color/weight/size contrast against the surrounding page. (This is emphasis-contrast, distinct from accessibility contrast — but the CTA must satisfy both: dominant AND ≥4.5:1 readable.)
- **Size & weight:** the primary action is visibly larger/heavier than any secondary action.
- **Hierarchy of actions:** a page may have a secondary action (e.g., "Learn more"), but it must be visually subordinate — outline/ghost/link styling against the solid, filled primary. Two equally-weighted solid buttons = no dominant CTA.
- **Direction & placement:** position and directional cues (the hero image's gaze, an arrow, the reading flow) should lead toward the CTA, not away.

### 3.5 Serial position — where to place the load-bearing elements

The **serial-position effect** (primacy + recency) says people best remember the **first** and **last** items in a sequence. On a page that means: put the strongest value statement **first** (the hook) and the strongest closing argument + CTA **last** (the final call). The weakest/most-skimmable material belongs in the middle. This is why "value prop on top, big closing CTA at the bottom" is durable.

### 3.6 Scanning patterns — design for the skim

Users don't read, they scan — typically an **F-pattern** for text-dense pages (two horizontal sweeps near the top, then a vertical scan down the left) and a **Z-pattern** for sparse, hero-driven pages (top-left → top-right → diagonal → bottom CTA). Design the hierarchy so the load-bearing elements (headline, CTA) sit on the scan path: top-left start, CTA at the terminus of the Z or repeated down the F's vertical stem. Left-align body copy so the F's vertical scan finds the start of each line.

### 3.7 No competing focal points

The single most common hierarchy failure on a converting page is **multiple co-equal focal points** — a hero with two solid buttons, a navbar of links competing with the CTA, decorative imagery louder than the message, three "primary" colored elements. The discipline: **per viewport, there is exactly one dominant element**, and the dominant element of the page overall is the path to the conversion. Subtract competitors; demote secondaries; isolate the CTA.

---

## 4. Concrete examples (build terms — Next/Tailwind)

**Hook above the fold — DON'T / DO**
- DON'T: hero `<h1>` = "Modern Invoicing Platform" (category), CTA buried below three feature cards.
- DO: hero `<h1 className="text-5xl font-bold">Get paid in 2 days, not 30</h1>` + one-line subhead + a single filled primary CTA + a proof anchor — all in the first viewport.

**Dominant CTA — DON'T / DO**
- DON'T: two solid buttons side by side: `<Button>Start free</Button> <Button>Book a demo</Button>` — co-equal, no dominant action.
- DO: one filled primary + one subordinate: `<Button>Start free</Button> <Button variant="ghost">Book a demo</Button>`. The primary is the only element in the accent color; the secondary is visually quieter.

**Isolation (Von Restorff) — DO**
- Reserve the accent/brand color **for the primary CTA only**. If links, badges, and icons all use the same accent, the CTA loses its isolation — demote those to neutral so the accent reads as "the action."

**Attention ratio — DON'T / DO**
- DON'T: a paid-campaign landing page with a full site navbar (Home, Features, Pricing, Blog, About, Login) plus footer link farm — every link is an exit from the goal.
- DO: strip the campaign lander to the goal — minimal/no nav, links only where they advance conversion; attention ratio near 1:1.

**Repeated CTA at decision points — DO**
- Place the *same* primary CTA after the hook, after the proof section, and at the page end. Same label, same style — it should read as one action offered three times, not three different asks.

**Every section earns its place — DON'T / DO**
- DON'T: a generic "Our Story" block on a conversion lander that neither builds belief nor removes an objection.
- DO: replace with a proof block (testimonial with a concrete result, a logo wall of recognizable customers as evidence, a "how it works in 3 steps" that pre-empts the "is this hard?" objection).

**Ghost-button trap — DON'T / DO**
- DON'T: a low-contrast outline-only "primary" CTA that recedes into the page (also an accessibility non-text-contrast risk).
- DO: a solid, high-emphasis primary that wins the visual competition AND reads at ≥4.5:1.

---

## 5. Common failure modes

| Failure | How it reads to the visitor | How to detect |
|---|---|---|
| Multiple co-equal CTAs (two solid buttons) | "Which one am I supposed to click?" → hesitation → no click | >1 element with the dominant/primary visual weight in a viewport |
| Vague/category headline (no benefit) | "What does this even do for me?" → bounce | H1 states a product category, not an outcome/benefit |
| Buried or missing CTA | "How do I actually start?" → hunt → leave | No primary action in the first viewport; no repeated CTA at decision points |
| High attention ratio (nav + link farm) | Too many exits; attention leaks off the goal | Many off-goal links relative to one conversion goal (≫1:1 on a campaign lander) |
| CTA lost in accent-color noise | Nothing pops; the action doesn't stand out | Accent/brand color used on many elements, so the CTA isn't isolated |
| Decorative imagery louder than the message | Eye lands on a stock photo, not the value prop | Largest/highest-contrast element is decorative, not the hook or CTA |
| Filler sections (no belief, no objection removed) | Page feels long and pointless; scroll fatigue | A section that conveys neither proof nor objection-handling |
| Ghost / low-contrast primary button | Looks disabled or secondary; under-clicked | Outline-only primary, or low emphasis vs page |
| Everything crammed above the fold | Cluttered first screen; CTA competes with 6 things | First viewport overloaded; no clear single focal point |
| Strongest argument in the middle | The memorable first/last slots are wasted | Best value statement isn't first; strongest close + CTA isn't last |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

- **[CONV-01] critical — The page has exactly one identifiable primary conversion goal, and one dominant CTA style for it.** → `hierarchy` / `layout`. Detect: count elements carrying the dominant/primary visual weight (filled accent button) per viewport; >1 co-equal primary = FAIL (observed two solid buttons, expected one primary + subordinate secondary).
- **[CONV-02] critical — The value proposition is in the first viewport as a benefit-stating headline (the hook), not a bare category.** → `hierarchy` / `copy`. Detect: H1 above the fold absent, or states a product category/feature with no user outcome = FAIL.
- **[CONV-03] critical — The primary CTA is present in the first viewport and repeated (same label + style) at subsequent decision points.** → `layout` / `hierarchy`. Detect: no primary action reachable without scrolling, or CTA not repeated after the proof section / at page end = FAIL.
- **[CONV-04] serious — The primary CTA is visually dominant: it is the most emphasized interactive element (size/weight/color) and is isolated (whitespace, sole use of the accent color).** → `hierarchy` / `layout` / `color`. Detect: a secondary action with equal/greater visual weight, or the accent color spread across many elements so the CTA isn't isolated = FAIL (Von Restorff violated).
- **[CONV-05] serious — Secondary actions are visually subordinate to the primary (ghost/outline/link vs filled), never co-equal.** → `hierarchy` / `layout`. Detect: two or more filled, equal-weight actions presented as peers = FAIL.
- **[CONV-06] serious — Attention ratio trends to the goal: a focused/campaign landing page has minimal off-goal navigation and link clutter (≈1:1).** → `layout` / `hierarchy`. Detect: a single-goal lander carrying a full multi-link nav/footer farm that pulls off the conversion = FAIL/WARN (proportional for multi-intent pages).
- **[CONV-07] serious — Every major section installs a belief or removes an objection (proof, social proof, how-it-works, objection-handling) — no pure filler.** → `copy` / `layout`. Detect: a section that conveys neither proof nor objection-handling on a conversion page = WARN/FAIL.
- **[CONV-08] serious — Per viewport there is exactly one dominant focal point, and it is on the conversion path; no competing co-equal focal points.** → `hierarchy` / `layout`. Detect: two+ elements competing for "loudest" in a viewport (e.g., decorative hero image out-weighing the hook/CTA) = FAIL ("if everything stands out, nothing stands out").
- **[CONV-09] minor — The strongest value statement is first and the strongest close + CTA is last (serial position).** → `hierarchy` / `copy` / `layout`. Detect: best argument buried mid-page; weak or missing closing CTA at page end = WARN.
- **[CONV-10] minor — Load-bearing elements (headline, CTA) sit on the scan path (F/Z); body copy is left-aligned for scannability.** → `layout` / `readability`. Detect: CTA off the natural scan terminus; centered long-form body copy that breaks the vertical scan = WARN.
- **[CONV-11] serious — The primary CTA satisfies BOTH emphasis (dominant) AND readability (text ≥4.5:1, non-text border/fill ≥3:1) — no ghost/low-contrast primary.** → `hierarchy` / `color` / `accessibility`. Detect: outline-only or low-contrast primary CTA = FAIL (cross-checks A11Y-01/03).
- **[CONV-12] minor — Conversion emphasis is honest: dominance comes from hierarchy, not from fake urgency/scarcity or disguised secondary actions (defers to the ethics guide).** → `copy` / `layout`. Detect: countdown/scarcity with no real basis, or a "secondary" action styled to be mistaken for the primary = WARN/FAIL.

---

## 7. Sources

- CXL — *How to Build a High-Converting Landing Page* — https://cxl.com/blog/how-to-build-a-high-converting-landing-page/ (page anatomy, one-goal, proof structure)
- CXL — *Above the Fold: How to Encourage Scrolling (and Converting)* — https://cxl.com/blog/above-the-fold/ ("above = promise, below = proof"; the fold still matters)
- Unbounce — *Attention Ratio* — https://unbounce.com/conversion-glossary/definition/attention-ratio/ (links ÷ goals; 1:1 ideal for campaign landers)
- Unbounce — *Where's the Best Place to Put Your CTA? (Case Study)* — https://unbounce.com/conversion-rate-optimization/landing-page-cta-placement/ (CTA below the fold can win on long pages — the contrarian evidence)
- Laws of UX — *Von Restorff Effect (Isolation Effect)* — https://lawsofux.com/von-restorff-effect/ (the differing element is noticed/remembered → isolate the CTA)
- Laws of UX — *Serial Position Effect* — https://lawsofux.com/serial-position-effect/ (primacy/recency → strongest value first, strongest close last)
- Nielsen Norman Group — *Page Fold / scrolling and attention* — https://www.nngroup.com/articles/page-fold-manifesto/ (attention concentrates above the fold but users scroll; F-pattern scanning)
