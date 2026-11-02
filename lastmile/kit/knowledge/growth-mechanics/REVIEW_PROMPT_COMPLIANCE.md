# REVIEW_PROMPT_COMPLIANCE

## Purpose

Keep in-app store-review prompting compliant and effective. The widely-blogged "Are you enjoying the app?" yes→store-review / no→feedback-form pattern is **review gating**: explicitly banned on Google Play, manipulation-risk on Apple, and regulatory exposure under the FTC Consumer Review Rule. Never build it.

## The policy ground truth (verified 2026-06)

- **Google Play In-App Review API guidelines (verbatim):** "Your app shouldn't ask the user any questions before or while presenting the rating button or card, including questions about their opinion (such as 'Do you like the app?') or predictive questions (such as 'Would you rate this app 5 stars')." The Play card must be surfaced as-is — no tampering, overlay, or modification.
- **Apple** has no verbatim equivalent, but App Store Review Guidelines 5.6.x review-manipulation principles + the requirement to use the provided `requestReview` API make sentiment-filtered routing risky. iOS gating is also technically moot: `requestReview` is fire-and-forget (no signal whether the prompt showed or what was rated), max 3 prompts per 365 days, never shows in TestFlight.
- **FTC Final Rule on Consumer Reviews** (effective 2024-10-21, civil penalties up to ~$51,744/violation) targets review suppression broadly — gating intent carries risk even where a platform text is silent.

## The compliant design: two decoupled flows

- **Flow A — private feedback**, triggered by NEGATIVE signals (crash recovery, failed action, cancellation, support tap). Never mentions store reviews.
- **Flow B — native review prompt**, triggered by OBJECTIVE positive milestones (task completed, streak, success moment). No sentiment question before or coupled to it.

## Rules

- `GRW-REV-01 FAIL`: A sentiment or opinion question is asked before or while presenting a store review prompt, or routing to the store prompt is conditioned on a positive answer.
- `GRW-REV-02 PASS`: Private feedback collection exists as its own flow, triggered by negative product signals, with no store-review mention.
- `GRW-REV-03 PASS`: Review prompting uses only the native APIs (StoreKit `requestReview` / Play In-App Review); no custom rating UI precedes or mimics the store card.
- `GRW-REV-04 PASS`: Prompt triggers are objective positive milestones with caps — respect iOS 3/365, treat the Play quota as undocumented (silent no-op), gate on minimum usage, never prompt after an error or crash.
- `GRW-REV-05 FAIL`: UI promises a rating dialog (e.g. a "Rate us" button wired to `requestReview`) or offers an incentive for a rating/review.
- `GRW-REV-06 WARN`: Review prompt can fire in the first session or before the product's activation moment.

*Last reviewed: 2026-06.*
