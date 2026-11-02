---
guide: PERFORMANCE_PERCEIVED_UX
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: standard
maps_to: [mobile-responsive, component-usage, console-error, regression]
sources:
  - "https://web.dev/articles/vitals"
  - "https://web.dev/articles/lcp"
  - "https://web.dev/articles/inp"
  - "https://web.dev/articles/cls"
  - "https://web.dev/articles/optimize-cls"
  - "https://lawsofux.com/doherty-threshold/"
  - "https://www.nngroup.com/articles/response-times-3-important-limits/"
  - "https://www.nngroup.com/articles/skeleton-screens/"
---

# Performance & Perceived UX

**Performance is a feature of the design, not a tax paid after it.** Two things matter: how fast the page actually is (Core Web Vitals — loading, interactivity, visual stability) and how fast it *feels* (perceived performance — skeletons, optimistic UI, instant feedback, no layout shift). A design can be objectively slow but feel responsive, or objectively fast but feel broken; both axes are checkable.

## Why it matters

Speed is conversion and trust. Users abandon slow pages, mis-tap shifting layouts, and re-submit when nothing seems to happen. The user doesn't experience "milliseconds" — they experience *waiting*, *jumping*, and *frozen*. Designing for perceived performance turns dead time into reassured time and protects every downstream metric (engagement, conversion, task success).

For **design and review work**:

- **App-screen and landing-page design** both own this — load *is* conversion, and in-app responsiveness *is* usability. The design decisions (image sizing, what loads first, skeletons vs spinners, optimistic UI, reserved space) directly set the Vitals.
- **This guide covers** load and responsiveness on a real phone (where slow/jank bites hardest) and the right loading/skeleton/empty/error components (instead of ad-hoc spinners or blank screens).
- **On the rendered page, you (or your AI) can check** for console errors (errors that break or block render) and layout shift (CLS — content jumping, the classic "I tapped the wrong thing because it moved" bug).

## Core principles & techniques

### 1. Core Web Vitals — the objective floor

Three metrics, each with a "good" threshold at the **75th percentile** of real loads (mobile + desktop):

- **LCP — Largest Contentful Paint (loading): good ≤ 2.5 s.** When the largest above-the-fold element (usually the hero image or headline block) finishes rendering. Slow LCP = the user stares at a blank/partial page.
  *Design levers:* size and prioritize the hero image (`priority`/eager for the LCP image, lazy for everything below the fold); don't hide the LCP element behind a long entrance animation; avoid render-blocking the hero on a late web font.
- **INP — Interaction to Next Paint (interactivity): good ≤ 200 ms.** The latency from a user interaction (tap/click/keypress) to the next visual update. High INP = "I tapped and nothing happened" → re-tapping.
  *Design levers:* give *immediate* visual feedback to every interaction (pressed state, spinner, optimistic update) so the next paint is fast even when the work behind it isn't; avoid heavy synchronous work on click.
- **CLS — Cumulative Layout Shift (visual stability): good ≤ 0.1.** How much visible content unexpectedly moves during load/interaction. High CLS = content jumps; the user taps the wrong thing because the button moved.
  *Design levers:* reserve space for everything that loads late (images with explicit `width`/`height` or aspect-ratio boxes, ad/embed slots, fonts, deferred content); never insert content above existing content without reserving its space; animate `transform`/`opacity`, never layout properties.

These three map to the three things a user feels: *is it here yet, does it respond, does it stay put.*

### 2. Perceived performance — feeling fast

Objective speed has a ceiling; perceived speed is a design lever you control regardless:

- **The response-time limits (NN/g / Doherty):**
  - **~100 ms** — feels instantaneous; the user feels they directly manipulated the UI. Aim every interaction's *first feedback* here.
  - **~1 s** — the limit for keeping the user's flow of thought uninterrupted; below this no special indicator is needed, but the delay is noticed.
  - **~10 s** — the limit for keeping attention; beyond this the user mentally leaves and needs a progress indicator with an estimate.
  - **Doherty Threshold (~400 ms):** when system response is under ~400 ms, productivity and engagement rise sharply — the system keeps pace with the user's thought. Treat ~400 ms as the budget for "feels responsive."
- **Acknowledge instantly, complete later.** The *feedback* must beat the *result*. A button that shows a pressed/loading state in <100 ms feels fast even if the server takes a second. A silent button feels broken at 300 ms.
- **Optimistic UI.** For actions likely to succeed (like, add-to-list, toggle), update the UI immediately and reconcile/rollback if the server disagrees. The user perceives zero latency; you handle the rare failure with a clear revert + message.
- **Skeleton screens over spinners for content.** A skeleton (gray placeholder of the *eventual layout*) makes a load feel faster and shorter than a spinner, because it signals progress, sets expectations of the structure, and — critically — *reserves the layout so there's no shift when content arrives*. Spinners are fine for short, indeterminate, single-element waits; skeletons are better for content regions.
- **Progressive disclosure / streaming.** Show the above-the-fold and shell first; stream in the rest. The user starts reading/acting while the page finishes.

### 3. Full state coverage is a performance-perception job

The gap between "request sent" and "data here" must always be designed:

- **Loading** — skeleton or spinner, never a blank screen that looks broken or finished-but-empty.
- **Empty** — a worded empty state (see CONTENT_MICROCOPY), not a zero that looks like a failure.
- **Error** — a recoverable error state (retry + human message), not a stuck spinner or a silent fail.
- **Success** — confirmation (see [`CONTENT_MICROCOPY.md`](CONTENT_MICROCOPY.md)).

An infinite spinner (no timeout, no error fallback) is one of the worst perceived-performance failures: the user can't tell broken from slow.

### 4. Don't ship console errors that break render

A thrown error during render, a hydration mismatch, a failed critical fetch, or an unhandled promise rejection can blank a section, break interactivity, or cause a flash/re-render. These surface in the JS console and are a defect in their own right. The design implication: every data dependency needs a designed fallback (error boundary + error state) so a failure degrades gracefully instead of white-screening.

### 5. Weight discipline (design decisions that set the budget)

- **Images are the usual LCP/weight culprit.** Use appropriately sized, modern-format images; serve the right dimensions for the viewport (responsive sizes); lazy-load below-the-fold; always set intrinsic dimensions to prevent CLS.
- **Fonts:** avoid invisible text during font load (FOIT) and the layout shift from a late swap; use a sensible `font-display` and a matched fallback metric to minimize the shift.
- **Defer the non-critical.** Below-the-fold, offscreen, and interaction-only code/assets should not block first paint.

### Trade-offs

- **Optimistic UI vs. correctness:** optimistic updates feel instant but need a correct, visible rollback path for the failure case — silently reverting is its own bug.
- **Skeleton fidelity vs. cost:** a skeleton that doesn't match the eventual layout *causes* the shift it was meant to prevent; a rough skeleton is worse than a good spinner.
- **Eager vs. lazy:** eager-loading everything kills LCP; lazy-loading the LCP element delays it. Prioritize the hero, defer the rest.
- **Animation vs. speed:** entrance animations that gate content trade measured/perceived speed for polish.

## Concrete examples (build terms)

**DO — reserve space so images don't shift the layout**
```tsx
// Next/Image with explicit dimensions (or fill + aspect box) reserves space → no CLS.
<Image src="/hero.jpg" width={1200} height={630} priority alt="…" />   // priority = it's the LCP element
<Image src="/thumb.jpg" width={320} height={200} loading="lazy" alt="…" />  // below the fold
```

**DON'T — late image with no dimensions shoves content down**
```tsx
<img src="/hero.jpg" />   // ✗ no width/height → content reflows when it loads → CLS spike
```

**DO — skeleton that mirrors the real layout (reserves space, signals progress)**
```tsx
{loading
  ? <CardSkeleton />        // same box dimensions as <Card> → zero shift on swap
  : <Card data={data} />}
```

**DON'T — blank screen or layout-less spinner for a content region**
```tsx
{loading ? <Spinner /> : <Grid items={items} />}
// ✗ spinner collapses the region, then the grid pops in and pushes everything → CLS + "did it break?"
```

**DO — instant feedback + optimistic update**
```tsx
function onLike() {
  setLiked(true);                 // <100ms perceived: UI responds instantly
  like(id).catch(() => {          // reconcile on failure
    setLiked(false);
    toast('Could not save your like. Try again.');
  });
}
```

**DON'T — silent click, work-then-paint**
```tsx
<button onClick={heavySyncWork}>Save</button>
// ✗ no pressed/loading state; main thread blocks → high INP → user re-clicks → double submit
```

## Common failure modes

| Failure | How it reads to the user | How to detect |
|---|---|---|
| Image without dimensions loads late | Page content jumps; mis-taps | Inspect `<img>`/`<Image>` for missing width/height/aspect; measure CLS |
| Content inserted above existing content | Everything below shoves down | Watch load; reserve space for late/deferred content |
| Spinner-only for a content region | Region collapses then pops → shift + "broken?" | Compare loading vs loaded layout box; mismatch = CLS |
| Skeleton ≠ final layout | Shift happens anyway | Diff skeleton box vs real component box |
| No feedback on click (high INP) | "Did it register?" → re-clicks, double submits | Click and watch for sub-100ms feedback; check INP / blocked main thread |
| Infinite spinner, no error/timeout | Can't tell slow from broken; stuck | Force a failed/slow fetch; confirm a designed error+retry appears |
| Console error breaks/blocks render | Section blank or interactivity dead; flash | Read browser console for thrown errors, hydration mismatch, unhandled rejection |
| Oversized hero image | Long blank, slow LCP | Check LCP element size/format; LCP > 2.5s = fail |
| Entrance animation gates content | Slow to first usable action | Check whether content waits on an entrance animation before it can be used |

## ✅ Agent-applicable RULES (the payoff)

Format: category + severity + detection.

- **PP-1 — No unexpected layout shift (CLS).** Content MUST NOT jump during load/interaction; images/media/embeds/deferred content MUST reserve their space (explicit dimensions or aspect box). Target CLS ≤ 0.1.
  *Category:* layout shift. *Severity:* **high** (**critical** if shift causes mis-taps on a primary action).
  *Detect:* observe the load sequence and/or measure CLS; inspect images for missing intrinsic dimensions; watch for content inserted above existing content.
  *Finding shape:* `observed: hero image (no width/height) loads at ~1.2s, pushing the CTA down ~180px; expected: reserved dimensions, CLS ≤ 0.1`.

- **PP-2 — Interaction gives feedback within ~100 ms (INP).** Every interactive control shows immediate visual feedback (pressed/loading/optimistic state); no silent click that blocks while work runs.
  *Category:* responsiveness. *Severity:* **high**.
  *Detect:* click/tap and confirm sub-100ms visual response; flag heavy synchronous on-click work / high INP. Silent control + double-submit risk = FAIL.

- **PP-3 — Loading state is a skeleton/indicator that reserves layout.** Content regions show a skeleton (or contained indicator) matching the eventual layout; never a bare blank screen, and never a layout-less spinner that lets content pop in and shift.
  *Category:* loading states, layout shift. *Severity:* **medium** (**high** if it causes CLS).
  *Detect:* throttle/delay the data; confirm a layout-reserving loading state; diff loading vs loaded box.

- **PP-4 — Every async region has loading + empty + error states.** No infinite spinner without a timeout/error fallback; failures degrade to a recoverable error state (retry + human message), not a stuck or silent fail.
  *Category:* loading, empty and error states; copy. *Severity:* **high**.
  *Detect:* force slow + failed responses; confirm a designed error/retry and a non-broken empty state appear.

- **PP-5 — No console errors that break or block render.** No thrown render errors, hydration mismatches, failed critical fetches, or unhandled rejections in the console; data dependencies have error boundaries/fallbacks.
  *Category:* console errors. *Severity:* **critical** if render/interactivity breaks; **high** otherwise.
  *Detect:* read the browser console; any error that blanks a region, breaks interactivity, or causes a re-render flash = FAIL.

- **PP-6 — LCP element is fast.** The largest above-the-fold element (hero image/heading) is prioritized and reasonably sized; not lazy-loaded, not gated behind a long animation or a render-blocking late font. Target LCP ≤ 2.5 s.
  *Category:* load speed. *Severity:* **medium** (**high** if the user waits on a blank hero).
  *Detect:* identify the LCP element; check it's eager/prioritized and sized appropriately; oversized/lazy LCP = flag.

- **PP-7 — Perceived responsiveness budget (~400 ms).** User-initiated actions feel responsive — first feedback under the Doherty budget; long operations (>~1 s) show progress, very long (>~10 s) show an estimate.
  *Category:* responsiveness. *Severity:* **medium**.
  *Detect:* time first feedback on key actions; missing progress on a multi-second wait = flag.

## Sources

- web.dev — *Web Vitals* (LCP/INP/CLS thresholds) (https://web.dev/articles/vitals)
- web.dev — *LCP* (https://web.dev/articles/lcp), *INP* (https://web.dev/articles/inp), *CLS* (https://web.dev/articles/cls), *Optimize CLS* (https://web.dev/articles/optimize-cls)
- Laws of UX — *Doherty Threshold* (https://lawsofux.com/doherty-threshold/)
- Nielsen Norman Group — *Response Times: The 3 Important Limits* (https://www.nngroup.com/articles/response-times-3-important-limits/)
- Nielsen Norman Group — *Skeleton Screens* (https://www.nngroup.com/articles/skeleton-screens/)
