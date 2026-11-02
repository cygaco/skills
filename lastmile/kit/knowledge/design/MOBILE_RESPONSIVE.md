---
guide: MOBILE_RESPONSIVE
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [mobile-responsive, layout, a11y]
sources: ["https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html", "https://www.w3.org/WAI/WCAG21/Understanding/reflow", "https://www.w3.org/TR/WCAG22/", "https://baymard.com/blog/mobile-checkout", "https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/", "https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/", "https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth", "https://web.dev/articles/vitals"]
---

# Mobile & Responsive Design

**Mobile-responsive design means the UI works on the surface most users actually hold: layout reflows fluidly to small viewports with no horizontal overflow and no overlap, every tap target is large enough and far enough from its neighbors to hit reliably, and text is readable on a phone — all built mobile-first, not bolted on after.** Mobile is the real surface, not an afterthought.

This guide covers mobile and responsive design: the layout and accessibility checks you (or your AI) can run on the rendered page at a phone-sized viewport.

---

## 1. What this governs

Every UI your AI builds must be reviewed at **two viewports**: a desktop size (e.g. 1280×900) *and* a mobile size (e.g. 375×812), with 320px as the hard floor that must still work. At the small viewport, ask four questions:

1. **Does it reflow?** Content fits the width with no two-dimensional scrolling, no clipping, no overflow.
2. **Can you tap it?** Interactive targets meet the size floor and have enough spacing.
3. **Can you read it?** Body and input text is large enough (and input text large enough not to trigger zoom).
4. **Was it built mobile-first?** Base styles target small screens; larger screens are progressive enhancements.

Together they give one pass condition: *"at the mobile viewport the layout holds — no overflow, no overlap, tap targets ≥ the baseline, content reflows per the design's mobile requirements."*

---

## 2. Why it matters

**For the user and the product.** The majority of first touches happen on a phone. A page that overflows sideways, hides its CTA off-screen, or has buttons too small/too close to hit reliably *loses the user before the product gets a chance*. On a conversion page, a broken mobile layout is a direct revenue leak; in-app, it makes the core task impossible on the device most people are using.

**Accessibility floor (codified, not optional).** Two WCAG 2.2 Level-AA criteria make parts of this mechanically testable:
- **SC 2.5.8 Target Size (Minimum)** — "The size of the target for pointer inputs is at least **24 by 24 CSS pixels**" (the interactive hit area), unless an exception applies. [w3.org — verified]
- **SC 1.4.10 Reflow** — content must be usable "without loss of information or functionality, and without requiring scrolling in two dimensions" at **320 CSS px** width (320px ≡ 1280px at 400% zoom), except content that genuinely needs 2-D layout (maps, diagrams, data tables). [w3.org — verified]

**For design and review work.**
- **App-screen design** has a mobile/responsive lens — app screens must hold at 375px.
- **Landing-page design** has a mobile lens — landing pages convert on phones; the hero, proof, and CTA must all work at 375px.
- **A mobile view that overflows** or buries content behind an off-canvas with no escape fails outright; it is not a suggestion.
- **On the rendered page at the mobile viewport**, look for the symptoms: broken layout (overlap, off-screen content, missing padding) and accessibility problems (targets too small, type too small).

---

## 3. Core principles

### 3.1 Mobile-first, then progressively enhance

Design and code the smallest, most constrained viewport **first**, then layer on enhancements for larger screens. This forces prioritization: if it doesn't fit on a phone, it isn't core. In a Tailwind substrate this is literal — **unprefixed utilities are the mobile base**, and `sm:` / `md:` / `lg:` apply *min-width and up*. You write the mobile layout as the default and override *upward*, never the reverse.

```tsx
// ✅ mobile-first: single column by default, two columns from md up
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">…</div>
```

### 3.2 Reflow without overflow (no two-dimensional scroll)

At 320–375px the layout must fit the width. The recurring causes of horizontal overflow and the fixes:

- **Flex/grid children that won't shrink.** Flex and grid items default to `min-width: auto`, so a long child refuses to shrink below its content and pushes the row wide. Fix: `min-w-0` on the shrinking child (and `min-h-0` for the vertical analog).
- **Fixed pixel widths > viewport.** A `w-[420px]` or a fixed-width table on a 375px screen overflows. Fix: fluid widths (`w-full`, `max-w-*`), let content wrap.
- **`100vw`.** `100vw` ignores the vertical scrollbar's width and overflows by exactly that much. Fix: `w-full` / `100%`.
- **Unbreakable strings** (long URLs, tokens). Fix: `break-words` / `overflow-wrap`.
- **Unwrapped rows.** Fix: `flex-wrap`.
- **Text with no measure cap** can stretch absurdly wide on desktop and crowd on mobile. Fix: `max-w-prose` / a measure cap (~45–75ch).

Genuine 2-D content (a data table, a map) is *excepted* from reflow — but the exception does **not** extend to the surrounding page; wrap it in its own scroll container, don't let it widen the whole layout.

### 3.3 Touch targets: big enough and far enough apart

- **Floor:** ≥ **24×24 CSS px** hit area (WCAG 2.5.8). This is a *minimum*, not a goal.
- **Comfortable target:** platform guidance is more generous — Apple **44×44 pt**, Material **48×48 dp** (~9mm). Primary and frequently-tapped actions should aim here (Fitts's Law: bigger + closer = faster, fewer errors).
- **Spacing:** if a target is below the floor, it must satisfy the **spacing exception** — a 24px-diameter circle centered on each target must not intersect another target. Practically: don't pack small icon buttons edge-to-edge.
- Size targets with `min-h`/`min-w` (a `Button` default of `h-10` is 40px, and an `icon` size of `size-10` is 40px), not by hoping the text makes them big enough.

### 3.4 Readable type on small screens

- **Body text** comfortable on a phone (don't ship 12px body).
- **Inputs ≥ 16px computed font-size.** Below 16px, iOS Safari **auto-zooms** the viewport on input focus — the page jumps, layout breaks, and the user is fighting the zoom. Set inputs to ≥16px (a `@media (pointer: coarse)` rule can keep desktop smaller while touch gets 16px).
- **Never disable zoom to "fix" it.** `maximum-scale=1` / `user-scalable=no` blocks low-vision users and is a WCAG failure. Fix the font size, not the viewport.
- **Line length** stays readable — cap the measure so lines don't run edge-to-edge on a wide phone in landscape.

### 3.5 Touch ergonomics & affordance parity

- **No hover-only affordances.** A control revealed only on `:hover` is *unreachable on touch* (touch has no hover). Provide a visible/tap-triggered equivalent.
- **Reachability.** Primary actions belong where a thumb can reach (bottom/center on tall phones); critical actions stuck in a top corner are awkward one-handed. (Soft ergonomic principle, not a hard pass/fail.)
- **Escape from overlays.** Off-canvas menus, sheets, and modals must have a visible, tappable close/back — content hidden with no escape is a trap.

### 3.6 The viewport contract & safe areas

- **Viewport meta present:** `<meta name="viewport" content="width=device-width, initial-scale=1">` — without it, mobile browsers render at a fake desktop width and shrink everything.
- **Safe-area insets:** on notched/rounded devices, pad critical UI with `env(safe-area-inset-*)` so the CTA isn't under the home indicator or notch.

### 3.7 Stability on load (no layout shift)

Content that jumps as it loads makes users mis-tap. Reserve space: give images explicit dimensions / aspect ratios, reserve space for late banners, and avoid inserting content above existing content after paint. (Cumulative Layout Shift is covered in depth in [PERFORMANCE_PERCEIVED_UX](PERFORMANCE_PERCEIVED_UX.md); here it's the *mobile mis-tap* angle.)

---

## 4. Concrete examples (do / don't, in build terms)

**Overflow — shrink vs push-wide**
```tsx
// ❌ DON'T — flex child won't shrink; long content pushes the row past 375px
<div className="flex gap-2">
  <p className="flex-1">{veryLongUnbrokenText}</p>
</div>

// ✅ DO — min-w-0 lets it shrink; words break
<div className="flex gap-2">
  <p className="flex-1 min-w-0 break-words">{veryLongUnbrokenText}</p>
</div>
```

**Fixed width vs fluid**
```tsx
// ❌ DON'T — fixed 420px overflows a 375px screen
<div className="w-[420px]">…</div>
// ✅ DO — fluid, capped
<div className="w-full max-w-md">…</div>
```

**Tap target & input type**
```tsx
// ❌ DON'T — tiny tap target; 14px input triggers iOS zoom
<button className="h-5 w-5"><Icon/></button>
<input className="text-sm" />

// ✅ DO — meets the floor (prefer 44px for primary), 16px input
<Button size="icon" aria-label="Close"><Icon/></Button>   {/* size-10 = 40px */}
<Input className="text-base" />                            {/* 16px, no zoom */}
```

**Mobile-first responsive layout**
```tsx
// ✅ single column on mobile, sidebar from lg up; nav wraps; no overflow
<div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
  <nav className="flex flex-wrap gap-2">…</nav>
  <main className="min-w-0">…</main>
</div>
```

**Hover-only → touch-safe**
```tsx
// ❌ DON'T — actions only on hover; invisible/unreachable on touch
<Row className="[&_.actions]:opacity-0 hover:[&_.actions]:opacity-100">…</Row>
// ✅ DO — actions always reachable (e.g. an overflow menu button) on touch
<Row><Button variant="ghost" size="icon" aria-label="More">⋯</Button></Row>
```

---

## 5. Common failure modes

| Failure | How it reads to the user | How to detect |
|---|---|---|
| **Horizontal overflow** | page scrolls sideways; content cut off | `documentElement.scrollWidth > innerWidth` at 375/320 |
| **Element overlap / clipping** | text on top of text; content hidden | overlapping bounding rects; content past viewport |
| **Tap target below floor** | mis-taps, can't hit small buttons | computed box < 24×24 (prefer < 44×44 flagged) |
| **Targets too close** | fat-finger wrong action | 24px circles on adjacent targets intersect |
| **Input/body < 16px** | iOS zooms on focus, page jumps | computed `font-size < 16px` on inputs |
| **Disabled zoom** | low-vision users can't enlarge | `user-scalable=no` / `maximum-scale=1` in viewport meta |
| **Hover-only control** | feature unreachable on touch | action only under `:hover`, no touch path |
| **Off-canvas with no escape** | trapped in a menu/modal | overlay open, no visible tappable close |
| **Missing viewport meta** | everything tiny / desktop-shrunk | no `width=device-width` meta tag |
| **Layout shift on load** | taps land on the wrong thing | CLS / content moves after paint |
| **Fixed-px wide content** | doesn't fit, overflows | fixed width > viewport at 320/375 |

The shared root cause: **the layout was designed for the desktop and never verified at 375px (or 320px).** Mobile review is not optional — both viewports are required.

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL check you (or your AI) can mechanically apply on the rendered page at a **375×812** (and **320px** floor) viewport. Format: `severity` · observed-vs-expected · how to detect (most via resizing the browser and reading computed geometry).

### Mobile-responsive checks
- **MR-1 — No horizontal overflow.** — FAIL (severity: **critical**) if `document.documentElement.scrollWidth > window.innerWidth` at 375px (and 320px). *Observed:* page scrolls sideways / content clipped. *Expected:* fits the width. *Detect:* open the page in a browser at 375px wide and run `document.documentElement.scrollWidth - window.innerWidth` in the DevTools console; a result > 0 fails; to locate the culprit, iterate elements where `getBoundingClientRect().right > innerWidth`.
- **MR-2 — No two-dimensional scroll / reflow holds at 320px (WCAG 1.4.10).** — FAIL (**critical**) if reaching/reading content requires scrolling in two dimensions at 320px (excluding genuine 2-D content like data tables/maps, which must be in their own scroll container). *Detect:* render at 320px; confirm no content lost and no 2-axis scroll on the page body.
- **MR-3 — Tap target ≥ 24×24 CSS px (WCAG 2.5.8).** — FAIL (**high**) if an interactive element's computed box is `< 24×24` CSS px and it does not meet the spacing exception. *Observed:* `h-5 w-5` icon button (20px). *Expected:* ≥24px (prefer ≥44px for primary). *Detect:* `getComputedStyle`/`getBoundingClientRect` on interactive elements.
- **MR-4 — Primary/frequent targets are comfortable.** — FAIL (**medium**) if a primary or frequently-tapped action is between 24px and 44px — meets the floor but not the Fitts's-Law comfort target. *Severity:* medium (not a hard a11y failure, but a usability finding).
- **MR-5 — Adequate spacing between small targets.** — FAIL (**high**) if two undersized adjacent targets fail the spacing exception (24px-diameter circles centered on their bounding boxes intersect). *Detect:* compute target centers + distances.
- **MR-6 — Input/body font-size ≥ 16px.** — FAIL (**high**) if a text `input`/`textarea`/`select` (or body copy) has computed `font-size < 16px` at the mobile viewport. *Observed:* `text-sm` (14px) input. *Expected:* ≥16px (prevents iOS focus-zoom). *Detect:* `getComputedStyle(el).fontSize`.
- **MR-7 — Zoom is not disabled.** — FAIL (**high**, a11y) if the viewport meta contains `user-scalable=no` or `maximum-scale=1`. *Detect:* read the `<meta name="viewport">` content attribute.
- **MR-8 — Viewport meta present.** — FAIL (**high**) if no `<meta name="viewport" content="width=device-width …">`. *Observed:* mobile renders at desktop width, everything tiny. *Detect:* check `<head>`.
- **MR-9 — No element overlap / clipped content at mobile.** — FAIL (**critical** if it hides content, else **high**) if interactive/text elements overlap or content sits outside the viewport at 375px. *Detect:* compare bounding rects for overlap; check elements with `right/bottom` beyond viewport or `0` size.
- **MR-10 — No hover-only affordance.** — FAIL (**high**) if a control is revealed/enabled only on `:hover` with no touch-reachable equivalent. *Detect:* action exists only under a `:hover` style; no always-visible or tap path.
- **MR-11 — Overlays have a tappable escape.** — FAIL (**high**) if an open off-canvas/sheet/modal has no visible, tappable close/back at the mobile viewport. *Detect:* overlay open, no accessible-named close control.

### Layout checks
- **LY-1 — Layout holds at the mobile viewport.** — FAIL (**critical**) on any of: sideways scroll, overlapping elements, content off-screen, missing padding crowding the edges. *Detect:* screenshot + bounding-rect inspection at 375px. (Mirrors MR-1/MR-9.)
- **LY-2 — Fluid, not fixed.** — FAIL (**medium**) if a fixed pixel width (`w-[NNNpx]` > 320) or `100vw` causes content not to fit at 320–375px. *Expected:* `w-full` + `max-w-*`. *Detect:* find fixed widths exceeding the viewport.

### Accessibility checks (mobile)
- **A11Y-M1 — Targets meet the size/spacing floor.** — Mirrors MR-3/MR-5 as an a11y finding (WCAG 2.5.8). FAIL (**high**).
- **A11Y-M2 — Zoom not blocked.** — Mirrors MR-7 (WCAG-conformant viewport). FAIL (**high**).
- **A11Y-M3 — Readable type / no forced zoom.** — Mirrors MR-6. FAIL (**high**).

### Guidance clause (avoid false flags)
- **MR-EX — Desktop-primary products.** For a genuinely desktop-primary, data-dense product (B2B dashboard/analytics), the mobile review still requires *no overflow, tappable targets, and readable type*, but a deliberately information-dense desktop layout that *reflows to a usable (if simplified) mobile view* is **PASS** — do not fail it for "not being a phone-first marketing page." The hard floors (MR-1, MR-2, MR-3, MR-6, MR-7, MR-8) are non-negotiable regardless; only the *richness* of the mobile layout is allowed to differ.

---

## 7. Sources

Provenance/evidence only — the principles above are self-contained; do not treat any source as a "go use this tool" directive.

- WCAG 2.2 SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (24×24 CSS px, spacing exception) — *verified against primary*
- WCAG SC 1.4.10 Reflow — https://www.w3.org/WAI/WCAG21/Understanding/reflow (320 CSS px, no 2-D scroll) — *verified against primary*; WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- Apple Human Interface Guidelines (44pt) / Material Design (48dp) — platform touch-target guidance (principle source).
- Baymard Institute — mobile checkout/forms usability — https://baymard.com/blog/mobile-checkout
- Smashing Magazine — best practices for mobile form design — https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/
- CSS-Tricks — 16px+ text prevents iOS form zoom — https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/
- MDN — `Element.scrollWidth` (overflow detection) — https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth
- web.dev — Core Web Vitals / CLS (layout stability) — https://web.dev/articles/vitals
- Substrate reference: Tailwind mobile-first breakpoint model + shadcn primitives (`Button size="icon"` = `size-10`) — as a *principle* substrate, not a product recommendation.
