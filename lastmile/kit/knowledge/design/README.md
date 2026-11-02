---
guide: README-DESIGN
anchor: none
shape: notice
timing: reference
lead_time: "none"
---

# Design-Principles Guides — deeper references for you and your AI

> This is the **design-principles guide library**: self-contained, teachable UI/UX & web-conversion guides for designing and reviewing the screens that decide whether people sign up and pay — app screens, landing pages, forms and checkout.
>
> **These are NOT launch guides.** Every guide here is `anchor: none` — deep reference material, read when a finding or a task needs the precise rule. The plain-language launch guides live one level up, in [`../../guides/`](../../guides/README.md).
>
> This pack ships the 7 design guides most tied to launch and conversion. Each one closes with a RULES section of PASS/FAIL assertions.

---

## How to use these

| When | What to read here |
|---|---|
| **Designing app screens** | every guide below — state coverage, simplicity, accessibility, mobile, honest copy |
| **Designing landing pages, forms and checkout** | CONVERSION_HIERARCHY and FRICTION_TRUST_FORMS first, then accessibility, mobile and ethics |
| **Approving a rendered screen** (you or your AI, on the live page) | the guide for each topic — see the coverage tables below |
| **Looking at the rendered page for defects** | the guide for each kind of defect — see the coverage tables below |

Apply the matching guides' RULES as part of your judgment. The guides supply the *principle*; keep whatever review format you already use.

---

## The 7 guides — grouped by cluster

### Accessibility (the inclusion floor)
| Guide | Tier | Maps to |
|---|---|---|
| [ACCESSIBILITY_WCAG](ACCESSIBILITY_WCAG.md) | core | accessibility · color · a11y |

### Conversion (web-specific)
| Guide | Tier | Maps to |
|---|---|---|
| [CONVERSION_HIERARCHY](CONVERSION_HIERARCHY.md) | core | hierarchy · layout · copy |
| [FRICTION_TRUST_FORMS](FRICTION_TRUST_FORMS.md) | core | component-usage · accessibility · copy · a11y · layout |

### Systems & cross-cutting (the production layer)
| Guide | Tier | Maps to |
|---|---|---|
| [MOBILE_RESPONSIVE](MOBILE_RESPONSIVE.md) | core | mobile-responsive · layout · a11y |
| [CONTENT_MICROCOPY](CONTENT_MICROCOPY.md) | standard | design-handoff · copy |
| [PERFORMANCE_PERCEIVED_UX](PERFORMANCE_PERCEIVED_UX.md) | standard | mobile-responsive · component-usage · console-error · regression |
| [ETHICS_NO_DARK_PATTERNS](ETHICS_NO_DARK_PATTERNS.md) | standard | design-handoff · copy |

**Count: 7 guides (4 core, 3 standard) across 3 clusters.**

---

## Coverage — which guide covers each topic

### Topics to cover before you approve a screen
| Topic | Guides (primary first) |
|---|---|
| **design-tokens** | — (no guide in this pack) |
| **component-usage** | FRICTION_TRUST_FORMS · PERFORMANCE_PERCEIVED_UX |
| **hierarchy** | CONVERSION_HIERARCHY |
| **mobile-responsive** | MOBILE_RESPONSIVE · PERFORMANCE_PERCEIVED_UX |
| **accessibility** | ACCESSIBILITY_WCAG · FRICTION_TRUST_FORMS |
| **design-handoff** (what renders matches what you approved) | CONTENT_MICROCOPY · ETHICS_NO_DARK_PATTERNS |

### Defects to look for on the rendered page
| Defect | Guides (primary first) |
|---|---|
| **color** | ACCESSIBILITY_WCAG |
| **layout** | CONVERSION_HIERARCHY · FRICTION_TRUST_FORMS · MOBILE_RESPONSIVE |
| **typography** | — (no guide in this pack) |
| **copy** | CONTENT_MICROCOPY · CONVERSION_HIERARCHY · FRICTION_TRUST_FORMS · ETHICS_NO_DARK_PATTERNS |
| **a11y** | ACCESSIBILITY_WCAG · FRICTION_TRUST_FORMS · MOBILE_RESPONSIVE |
| **console-error** | PERFORMANCE_PERCEIVED_UX |
| **regression** (layout shift) | PERFORMANCE_PERCEIVED_UX |

**Not covered in this pack:** design tokens (named color, spacing and type values) and typography (type scale, line length, font choice). Every other topic above has at least one guide.

---

*The lastmile design-principles guide library — reusable, stack-generic design judgment. Sources are cited per guide for provenance only; principles are self-contained and teachable (no "go use product X"). Last reviewed: June 2026.*
