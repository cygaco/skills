---
guide: ACCESSIBILITY_WCAG
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [accessibility, color, a11y]
sources:
  - "https://www.w3.org/TR/WCAG22/"
  - "https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/"
  - "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
  - "https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html"
  - "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html"
  - "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html"
  - "https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html"
  - "https://www.w3.org/WAI/WCAG21/Understanding/reflow.html"
  - "https://webaim.org/projects/million/2025"
  - "https://webaim.org/"
  - "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid"
  - "https://www.deque.com/automated-accessibility-coverage-report/"
---

# Accessibility (WCAG 2.2)

**Accessibility is the design floor: the interface must be Perceivable, Operable, Understandable, and Robust (POUR) for people who use assistive technology, keyboards only, low vision, low color discrimination, limited motor control, or limited cognition — expressed as concrete, numeric, mechanically-checkable WCAG 2.2 Level A/AA requirements that the build must satisfy.**

This guide trains you and your AI to treat accessibility not as a "pass later" polish step but as a set of hard constraints applied at build time, because the most common defects are introduced in markup and CSS (`<div onclick>`, `outline: none`, gray-on-white text, icon-only buttons) and are cheap to prevent and expensive to retrofit.

---

## 1. What this is

Accessibility is conformance to the **Web Content Accessibility Guidelines (WCAG) 2.2** at **Level AA** — the de-facto legal and professional baseline (referenced by the ADA, EN 301 549, Section 508, and the EU Accessibility Act). WCAG is organized under four principles, **POUR**:

- **Perceivable** — users can perceive the information (contrast, text alternatives, not-color-alone, content reflows, resizes).
- **Operable** — users can operate the interface (keyboard, visible focus, large-enough targets, no traps, enough time, no seizures).
- **Understandable** — content and operation are predictable (labels, consistent navigation, error identification + suggestion).
- **Robust** — content works with current and future assistive tech (valid name/role/value, status messages).

WCAG defines conformance at three **levels**: **A** (minimum), **AA** (the target — what "accessible" means in practice), and **AAA** (enhanced, not required wholesale). Each requirement is a **Success Criterion (SC)** with a number like `1.4.3`. This guide covers the A/AA criteria a *visual UI builder* can directly affect, with their exact thresholds.

---

## 2. Why it matters

**For users:** roughly 1 in 5–6 people have a disability that affects how they use software. Inaccessible UI silently excludes them — a keyboard user can't reach a `<div>` "button"; a screen-reader user hears "button" with no label; a low-vision user can't read 3:1 gray text; a motor-impaired user can't hit a 16px icon. These aren't edge cases: the **WebAIM Million 2025** audit found **94.8% of the top million home pages had at least one detectable WCAG failure**, averaging **51 errors per page**.

**For the product:** accessibility is also a legal-risk surface, an SEO surface (semantic structure overlaps with crawlability), and a quality signal. Most importantly for an AI builder: **the failures are systematic and machine-introducible**, so they are systematically preventable.

**For design and review work specifically:**
- This guide covers accessibility, including color contrast: things you (or your AI) can check on the rendered page.
- App screens and landing pages both carry forms, CTAs, and interactive controls — every one of those is an accessibility surface.
- Because ~57–70% of WCAG issues are NOT machine-detectable (see §5/§6), your AI's discipline at *build time* is the real enforcement — the review catches the rest.

---

## 3. Core principles / techniques

### 3.1 Perceivable — contrast (the #1 defect)

**SC 1.4.3 Contrast (Minimum) — Level AA.** Text and images of text must have a contrast ratio against their background of:
- **4.5:1** for normal text, and
- **3:1** for **large text**, defined as **≥18pt (≈24px) regular** or **≥14pt (≈18.66px) bold**.

Contrast ratio is computed from the relative luminance of the two colors `(L1 + 0.05) / (L2 + 0.05)`, ranging from 1:1 (identical) to 21:1 (black on white). **Exceptions:** incidental/inactive/decorative text, pure logotypes, and text that is "not visible to anyone." This is the single most common failure on the web (**79.1% of pages** per WebAIM Million 2025), almost always from light-gray body text or text over a colored/image background.

**SC 1.4.11 Non-text Contrast — Level AA.** **3:1** minimum for (a) **UI component boundaries/states** needed to identify the control (the edge of a text input, the fill of a checkbox, a toggle's on/off states) and (b) **meaningful graphical objects** (icons that carry meaning, chart segments). A borderless input that is white-on-white, or a ghost button whose only edge is a 1.5:1 hairline, fails this even if its *text* passes 1.4.3.

**SC 1.4.1 Use of Color — Level A.** Color must **never be the only** means of conveying information, indicating an action, prompting a response, or distinguishing an element. A red border on an invalid field, a green vs red status dot, or a "required fields are in orange" instruction all fail unless paired with a **non-color cue**: text, an icon, an underline, a label.

### 3.2 Perceivable — text scaling & reflow

**SC 1.4.4 Resize Text — Level AA.** Text must scale to **200%** without loss of content or function. In practice: size type and spacing in relative units (`rem`/`em`), never lock the layout to fixed pixel heights that clip text when it grows.

**SC 1.4.10 Reflow — Level AA.** Content must reflow to a **320 CSS px wide** viewport (equivalent to 400% zoom on a 1280px screen) **without requiring two-dimensional scrolling** — no horizontal scrollbar to read a paragraph. (Exceptions for content that genuinely needs 2D: data tables, maps, code.) This is the accessibility face of mobile-responsive: fixed-width containers, `width` in px, and `white-space: nowrap` on long content are the usual culprits.

**SC 1.4.12 Text Spacing — Level AA.** Layout must survive a user override of `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`, `paragraph-spacing: 2em` without clipping or overlap. Fixed-height text containers with `overflow: hidden` break this.

### 3.3 Operable — keyboard

**SC 2.1.1 Keyboard — Level A.** **Every** interactive function must be operable by keyboard alone. The classic failure is a non-native interactive element (`<div onclick>`, `<span role="button">` without a key handler) that the keyboard cannot reach or activate. **Prefer native elements** (`<button>`, `<a href>`, `<input>`) — they are keyboard-operable, focusable, and named for free.

**SC 2.1.2 No Keyboard Trap — Level A.** Focus that can enter a component must be able to leave it by keyboard. Custom modals/menus are the usual offenders.

**SC 2.4.3 Focus Order — Level A.** Tab order must follow a meaningful, logical sequence (usually = DOM order). Avoid positive `tabindex` values, which fork the natural order.

### 3.4 Operable — visible focus

**SC 2.4.7 Focus Visible — Level AA.** A keyboard focus indicator must be **visible** on every focusable element. The #1 cause of failure is `outline: none` / `outline: 0` with **no replacement**. If you remove the default outline, you MUST provide a visible substitute (ring, border, box-shadow). Prefer `:focus-visible` so the indicator shows for keyboard users without flashing on mouse click.

**SC 2.4.11 Focus Not Obscured (Minimum) — Level AA (new in 2.2).** When an element receives focus, it must not be **entirely hidden** by author content (sticky headers/footers, cookie bars). Sticky headers that cover the just-focused field are the common failure.

**SC 2.4.13 Focus Appearance — Level AAA in 2.2** (included here as the quality bar): the indicator should be **≥2 CSS px thick** (or equivalent area) and have **≥3:1 contrast** between focused and unfocused states. Even though it's AAA, a focus ring that is too thin or too low-contrast against its surroundings reads as "no focus" to low-vision keyboard users — treat the 2px/3:1 figures as the design target.

### 3.5 Operable — target size (motor accessibility, mobile)

**SC 2.5.8 Target Size (Minimum) — Level AA (new in 2.2).** Interactive targets must be **at least 24×24 CSS px**, **OR** be spaced so a 24px-diameter circle centered on each target doesn't intersect another target. **Exceptions:** the target is inline within a sentence; an equivalent control elsewhere on the page meets the size; the size is UA-determined (default); or the presentation is essential. Note this is the *minimum*; touch ergonomics (see the mobile guide) push toward 44–48px for primary actions.

**SC 2.5.7 Dragging Movements — Level AA (new in 2.2).** Any drag operation (sliders, drag-to-reorder, map pan) must have a **single-pointer alternative** that isn't a drag (e.g., tap-up/tap-down buttons, click-to-place).

**SC 2.5.3 Label in Name — Level A.** A control's **accessible name must contain its visible label text** so voice-control users ("click Submit") and screen-reader users hear/say the same word. A button that shows "Send" but has `aria-label="Submit form"` fails — the spoken label "Send" isn't in the accessible name.

### 3.6 Understandable — structure, names, errors

**SC 1.3.1 Info and Relationships — Level A.** Structure conveyed visually must be conveyed in markup: real headings (`<h1>`–`<h6>` in a logical, non-skipping order — exactly one `<h1>`, don't jump h2→h4 for styling), lists as `<ul>/<ol>`, tables with `<th scope>`, and **labels programmatically associated** with inputs (`<label for>` or wrapping). Visual-only headings (a big bold `<div>`) are invisible to screen readers navigating by heading.

**SC 4.1.2 Name, Role, Value — Level A.** Every UI component must expose an **accessible name**, a **role**, and its **state/value** to assistive tech. The dominant failures: **icon-only buttons** with no `aria-label` (announced as just "button"), and **empty links/buttons** (WebAIM Million: empty links **45.4%**, empty buttons **29.6%** of pages). Native elements get role/value for free; you supply the name via visible text, `aria-label`, or `aria-labelledby`.

**SC 3.3.2 Labels or Instructions — Level A** and the form-error pair **SC 3.3.1 Error Identification — Level A** + **SC 3.3.3 Error Suggestion — Level AA**: every input needs a persistent visible label; errors must be **identified in text** (not color alone — links to 1.4.1) and, when the fix is known, **suggest the correction**. Associate errors with their field via `aria-describedby` and set `aria-invalid="true"` *after* a failed validation. (Form depth lives in the FRICTION_TRUST_FORMS guide; this is the accessibility floor.)

**SC 3.3.7 Redundant Entry — Level A (new in 2.2)** and **SC 3.3.8 Accessible Authentication (Minimum) — Level AA (new in 2.2):** don't make users re-enter the same info in one flow (offer auto-fill/carry-over), and don't require a **cognitive function test** (solving a puzzle, transcribing) as the *only* way to authenticate — support password managers / paste / passkeys.

### 3.7 Operable/Understandable — motion & status

**SC 2.3.3 Animation from Interactions — Level AAA**, plus the broadly-expected baseline: **honor `prefers-reduced-motion`.** Wrap non-essential transitions/parallax/auto-animation in `@media (prefers-reduced-motion: reduce)` and reduce/remove them. **SC 2.2.2 Pause, Stop, Hide — Level A:** any auto-moving/blinking/scrolling content lasting >5s (carousels, marquees) must be pausable. **SC 2.3.1 Three Flashes — Level A:** nothing flashes more than 3×/second.

**SC 4.1.3 Status Messages — Level AA.** Status changes that don't move focus (a "Saved" toast, "3 results", an async error) must be announced via a **live region** (`role="status"`/`aria-live="polite"`, or `role="alert"`/`aria-live="assertive"` for errors) so screen-reader users learn of them.

### 3.8 The trade-off: ARIA is a last resort

> **First Rule of ARIA: don't use ARIA if a native element will do.** A `<button>` beats `<div role="button" tabindex="0">` + key handlers + `aria-pressed`. Bad/excess ARIA is worse than none — it overrides the real role and lies to assistive tech. Reach for ARIA only to *fill gaps* native HTML can't express (live regions, `aria-expanded`, `aria-describedby` for errors), and always pair `role` with the states it implies.

---

## 4. Concrete examples (build terms — Next/Tailwind/Radix/shadcn)

**Contrast (1.4.3) — DON'T / DO**
- DON'T: `text-gray-400` (#9ca3af ≈ 2.6:1) for body copy on white. FAIL.
- DO: `text-gray-700`/`text-gray-900` for body; reserve `text-gray-500` (#6b7280 ≈ 4.8:1 on white — passes) for genuinely large or secondary text and verify it. Make the contrast floor a **token rule**, not a per-component eyeball.

**Interactive element (2.1.1 / 4.1.2) — DON'T / DO**
- DON'T: `<div className="btn" onClick={save}>Save</div>` — not focusable, not keyboard-operable, role "generic".
- DO: `<button type="button" onClick={save}>Save</button>` — keyboard + focus + role + name for free. Use the Radix/shadcn `<Button>` primitive, which renders a real `<button>`.

**Icon-only control (4.1.2 / 2.5.3) — DON'T / DO**
- DON'T: `<button><TrashIcon /></button>` — announced "button", no name.
- DO: `<button aria-label="Delete item"><TrashIcon aria-hidden="true" /></button>` — name supplied, decorative icon hidden from AT. If the button also shows the word "Delete", that visible text becomes the name (no `aria-label` needed) and satisfies 2.5.3.

**Focus (2.4.7) — DON'T / DO**
- DON'T: `*:focus { outline: none }` (or shadcn components stripped of their ring) with no replacement.
- DO: keep a visible `focus-visible` ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring` — a 2px ring at 3:1 against its surroundings.

**Not-color-alone (1.4.1) — DON'T / DO**
- DON'T: invalid input shown only by `border-red-500`.
- DO: red border **plus** an error message text node **plus** `aria-invalid="true"` + `aria-describedby` to the message — color reinforces, text carries.

**Target size (2.5.8) — DON'T / DO**
- DON'T: a 16×16 icon button, or table-row action links packed 2px apart.
- DO: `min-h-[24px] min-w-[24px]` (44px for primary touch actions per the mobile guide), or add padding/spacing so the 24px circles don't intersect.

**Heading order (1.3.1) — DON'T / DO**
- DON'T: `<div className="text-3xl font-bold">Pricing</div>` as a visual heading; or jumping `<h2>` → `<h4>` to get smaller text.
- DO: `<h2 className="text-3xl font-bold">Pricing</h2>` — style with classes, keep the semantic level correct and sequential.

**Reduced motion (prefers-reduced-motion) — DO**
- Tailwind: gate animation with the `motion-safe:`/`motion-reduce:` variants, e.g. `motion-safe:animate-fade-in motion-reduce:animate-none`, so the OS preference is honored.

---

## 5. Common failure modes

| Failure | How it reads to the user | How to detect |
|---|---|---|
| Low-contrast text (gray-on-white, text-on-image) | Low-vision users can't read it; everyone strains | Compute ratio of text vs background; <4.5:1 (or <3:1 large) fails 1.4.3. **79% of pages.** |
| `<div>/<span>` used as button/link | Keyboard/AT users can't reach or activate it | Interactive handler on a non-interactive tag with no `role`+`tabindex`+key handler |
| Icon-only / empty control with no name | Screen reader says "button"/"link" with no purpose | Control has no text node, no `aria-label`/`aria-labelledby`, no `alt`. **Empty links 45%, empty buttons 30%.** |
| `outline: none` with no focus substitute | Keyboard user loses track of where they are | Focusable element shows no visible change on `:focus-visible` |
| Color-only state (red border, green dot) | Colorblind users can't tell valid from invalid | State conveyed by color with no text/icon/shape cue |
| Input without associated label (or placeholder-as-label) | Screen reader announces an unlabeled field; label vanishes on type | `<input>` with no `<label for>`/wrap/`aria-label`; placeholder used as the only label |
| Skipped/duplicated heading levels, no `<h1>` | Heading navigation is broken/misleading | h-level sequence skips (h2→h4) or multiple/zero `<h1>` |
| Fixed-width / nowrap content (no reflow) | Mobile/zoom users scroll sideways to read | Horizontal scroll appears at 320px width / 400% zoom |
| Tiny / tightly-packed tap targets | Motor-impaired & mobile users mis-tap | Interactive box <24×24px without the spacing exception |
| Auto-animation ignoring reduced-motion | Vestibular users get nausea/distraction | Animation present with no `prefers-reduced-motion` guard |
| Async status with no live region | Screen-reader user never hears "Saved"/"Error" | DOM text changes without `role=status`/`alert`/`aria-live` |
| Focus hidden behind sticky header (2.4.11) | Keyboard user can't see the focused field | Sticky/fixed element overlaps the focused element's rect |

**The detectability caveat (contrarian, important if you lean on automated checks):** automated tooling reliably catches only ~**20–40%** of WCAG issues — roughly the contrast, missing-name, missing-label, missing-lang, and ARIA-validity families. The remaining ~**60%** (is the focus order *meaningful*? is the alt text *accurate*? is the error message *helpful*? is the reading order logical?) require judgment. Your AI must apply the principles at build time; automated checks are a backstop, not the ceiling.

**The contrast-math caveat:** WCAG 2.x contrast uses a relative-luminance ratio that has known perceptual blind spots (it can pass combinations that are genuinely hard to read, and vice-versa, especially for thin fonts and dark mode). WCAG 3 / **APCA** is the emerging perceptual model. For now, **conform to WCAG 2.2's 4.5:1 / 3:1 as the hard floor**, and when a passing-but-marginal combination looks weak (thin weight, light hue), raise it rather than rely on the bare number.

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Contrast**
- **[A11Y-01] critical — Body/normal text contrast ≥ 4.5:1** against its background. → `accessibility` / `color` / `a11y`. Detect: compute ratio of computed `color` vs effective background; FAIL if <4.5:1 (observed e.g. 2.6:1 for `text-gray-400` on white, expected ≥4.5:1).
- **[A11Y-02] critical — Large text (≥24px reg / ≥18.66px bold) contrast ≥ 3:1.** → `accessibility` / `color`. Detect: ratio <3:1 on large text = FAIL.
- **[A11Y-03] serious — Non-text contrast ≥ 3:1** for UI component boundaries/states and meaningful icons/graphics (input borders, checkbox fill, toggle states, focus ring vs surroundings, meaningful icons). → `accessibility` / `color` / `a11y`. Detect: control/graphic edge or state color vs adjacent color <3:1 = FAIL (e.g., a 1.5:1 ghost-button border).
- **[A11Y-04] serious — Information is never conveyed by color alone (1.4.1).** → `accessibility` / `a11y` / `color`. Detect: a state/required/error/category distinction whose only differentiator is hue, with no text/icon/shape/underline cue = FAIL.

**Names, roles, structure**
- **[A11Y-05] critical — Every interactive control has a non-empty accessible name (4.1.2).** → `accessibility` / `a11y`. Detect: `<button>/<a>/<input>` (incl. icon-only) with no text node AND no `aria-label`/`aria-labelledby`/associated `<label>`/`alt` = FAIL (empty button/link/icon-button).
- **[A11Y-06] critical — Interactive behavior uses a native interactive element, or a fully-ARIA'd equivalent (2.1.1/4.1.2).** → `accessibility` / `a11y` / `component-usage`. Detect: click/keydown handler on `<div>`/`<span>` without (`role` + `tabindex="0"` + keyboard handler) = FAIL. Prefer `<button>`/`<a>`.
- **[A11Y-07] serious — Visible label text is contained in the accessible name (2.5.3).** → `accessibility` / `a11y` / `copy`. Detect: `aria-label`/`aria-labelledby` whose text omits the visible label words = FAIL.
- **[A11Y-08] serious — Every form input has a programmatically-associated, persistent visible label (1.3.1/3.3.2); placeholder is NOT the label.** → `accessibility` / `a11y` / `component-usage`. Detect: `<input>/<select>/<textarea>` with no `<label for>`/wrapping label/`aria-label`, or with only a `placeholder` = FAIL.
- **[A11Y-09] serious — Headings are real `<h1>`–`<h6>`, sequential (no skipped levels), exactly one `<h1>` per page (1.3.1).** → `accessibility` / `hierarchy` / `layout`. Detect: visual heading rendered as non-heading element; or level jump (h2→h4); or 0 or >1 `<h1>` = FAIL.
- **[A11Y-10] minor — ARIA is used only where native HTML can't express it; no redundant/conflicting roles.** → `accessibility` / `a11y`. Detect: `role` duplicating a native element's role (`<button role="button">`), or a `role` without its required states/props = FAIL/WARN.

**Keyboard & focus**
- **[A11Y-11] critical — A visible focus indicator exists on every focusable element (2.4.7).** → `accessibility` / `a11y`. Detect: `outline: none`/`outline: 0`/`outline-none` with no `:focus`/`:focus-visible` ring/border/shadow replacement = FAIL.
- **[A11Y-12] serious — Focus indicator is ≥2px (or equivalent area) and ≥3:1 against adjacent colors (2.4.13 target).** → `accessibility` / `a11y` / `color`. Detect: ring/outline <2px or <3:1 contrast vs surroundings = FAIL/WARN.
- **[A11Y-13] serious — All interactive functionality is keyboard-operable with no trap (2.1.1/2.1.2) and focus order is logical (2.4.3).** → `accessibility` / `a11y`. Detect: positive `tabindex`, mouse-only handlers, modal/menu that can't be exited by keyboard = FAIL.
- **[A11Y-14] minor — A focused element is not fully obscured by sticky/fixed content (2.4.11).** → `accessibility` / `a11y` / `layout`. Detect: sticky header/footer/cookie bar overlapping the focused element's bounding box = WARN.

**Targets & pointer**
- **[A11Y-15] serious — Interactive targets are ≥24×24 CSS px, or meet the 24px spacing exception (2.5.8).** → `accessibility` / `a11y` / `mobile-responsive` / `layout`. Detect: interactive box <24×24px and 24px circles intersect a neighbor, with no qualifying exception = FAIL.
- **[A11Y-16] serious — Any dragging interaction has a non-drag single-pointer alternative (2.5.7).** → `accessibility` / `a11y`. Detect: slider/reorder/pan with drag-only control = FAIL.

**Reflow, resize, spacing**
- **[A11Y-17] serious — Content reflows to 320 CSS px wide with no 2D scrolling (1.4.10), and text resizes to 200% without clipping (1.4.4).** → `accessibility` / `mobile-responsive` / `layout` / `a11y`. Detect: horizontal scroll at 320px width / 400% zoom on non-excepted content; fixed-px widths or `white-space: nowrap` on long content = FAIL.
- **[A11Y-18] minor — Layout survives user text-spacing overrides (1.4.12); no clipped/overlapping text.** → `accessibility` / `layout` / `a11y`. Detect: fixed-height text container + `overflow: hidden` that clips on increased line-height = WARN.

**Errors, status, motion**
- **[A11Y-19] serious — Form errors are identified in text and associated to the field (3.3.1/3.3.3); `aria-invalid`+`aria-describedby` wired; not color-only.** → `accessibility` / `a11y` / `copy`. Detect: validation that only colors the field, or an error message not linked via `aria-describedby`, or `aria-invalid` set before any validation = FAIL.
- **[A11Y-20] serious — Non-focus-moving status changes use a live region (4.1.3).** → `accessibility` / `a11y` / `console-error`. Detect: toast/result-count/async-error text inserted with no `role=status`/`role=alert`/`aria-live` = FAIL.
- **[A11Y-21] minor — Non-essential motion is gated behind `prefers-reduced-motion`; auto-content >5s is pausable (2.2.2); nothing flashes >3×/s (2.3.1).** → `accessibility` / `a11y` / `regression`. Detect: animation/transition/parallax/auto-carousel with no `prefers-reduced-motion` guard or no pause control = FAIL/WARN.
- **[A11Y-22] minor — `<html lang>` is present and correct; authentication doesn't require a cognitive-function test as the only method (3.3.8); no needless redundant entry (3.3.7).** → `accessibility` / `a11y`. Detect: missing/empty `lang`; CAPTCHA/puzzle as sole auth; re-asking data already given in the same flow = FAIL/WARN.

> **Coverage note for a review:** [A11Y-01..05, 08, 11, 22(lang)] are largely machine-detectable (the ~30% automatable band). The rest require your AI's judgment at build time — they are written as assertions so you or your AI can still evaluate them.

---

## 7. Sources

- W3C — *WCAG 2.2 Recommendation* — https://www.w3.org/TR/WCAG22/ (the normative success criteria, levels, and definitions)
- W3C/WAI — *What's New in WCAG 2.2* — https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ (the new 2.2 SC: 2.4.11, 2.4.13, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8)
- W3C/WAI — *Understanding SC 1.4.3 Contrast (Minimum)* — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (4.5:1 / 3:1, large-text definition, exceptions)
- W3C/WAI — *Understanding SC 1.4.11 Non-text Contrast* — https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html (3:1 for components/graphics)
- W3C/WAI — *Understanding SC 2.5.8 Target Size (Minimum)* — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (24×24px + spacing exception)
- W3C/WAI — *Understanding SC 2.4.7 Focus Visible* / *2.4.13 Focus Appearance* — https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html , https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html (2px / 3:1 target)
- W3C/WAI — *Understanding SC 1.4.10 Reflow* — https://www.w3.org/WAI/WCAG21/Understanding/reflow.html (320 CSS px, no 2D scroll)
- WebAIM — *The WebAIM Million 2025* — https://webaim.org/projects/million/2025 (defect frequencies: low contrast 79.1%, missing alt 55.5%, missing labels 48.2%, empty links 45.4%, empty buttons 29.6%, missing lang 15.8%; 94.8% of pages fail; 51 errors/page)
- WebAIM — contrast & general guidance — https://webaim.org/
- MDN — *aria-invalid* (and ARIA reference) — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid (error-state wiring)
- Deque — *Automated Accessibility Coverage Report* — https://www.deque.com/automated-accessibility-coverage-report/ (~30% machine-detectable; the rest need judgment)
