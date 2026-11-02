# ONBOARDING_ACTIVATION

## Purpose

Place the signup wall and profile-data collection so users reach the first problem-solved moment fastest. Every field asked before value is a toll booth; every field the core loop genuinely needs is a gate worth keeping.

## Doctrine

- **Optimize time-to-value.** Define the activation moment (first core problem solved) in product language first; design onboarding backwards from it.
- **Default: defer the wall.** Let users experience value before identity where the product allows (guest/anonymous mode + later account linking). Forced first-session registration measurably drives abandonment.
- **Justified early walls exist:** multi-device continuity products, social/matchmaking products where anonymous or empty profiles poison liquidity, sensitive-data products, and B2B tools may wall earlier — by decision, not by default.
- **Progressive profiling:** collect at signup only what the core loop requires; gate each additional field at the experience that needs it (an info-hungry product still starts minimal).
- **Anonymous-mode mechanics:** Firebase anonymous auth / Supabase `signInAnonymously()` / Clerk-style progressive sign-up; the linking path must be built and TESTED before launch. Known footguns: orphaned anonymous data, merge conflicts on linking, anonymous-bot abuse (mitigate with App Check/CAPTCHA/Turnstile + scheduled cleanup of stale anonymous rows).
- **Minors change everything:** the amended COPPA Rule (effective 2025-06-23, compliance deadline 2026-04-22) plus GDPR-K age-of-consent variance. Under-13 reachable → age gate + legal review before launch, no exceptions.

## Rules

- `GRW-ONB-01 PASS`: The build spec defines the activation moment and a time-to-value target before onboarding screens are designed.
- `GRW-ONB-02 FAIL`: A signup wall precedes any value demonstration without a named justifying product property (continuity, liquidity, data sensitivity, B2B).
- `GRW-ONB-03 PASS`: Signup collects only core-loop-required fields; all other profile data is gated at point-of-need.
- `GRW-ONB-04 FAIL`: Guest/anonymous mode ships without a tested account-linking path, abuse mitigation, or stale-row cleanup.
- `GRW-ONB-05 FAIL`: A product reachable by minors ships without an age gate and a COPPA/GDPR-K plan reviewed by a human (legal escalation).
- `GRW-ONB-06 WARN`: No activation metric (signup→first-core-action rate, D1 retention cross-check) is instrumented at launch. (Chain integrity: see `TEL-EVT-*`.)

*Last reviewed: 2026-06.*
