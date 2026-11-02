# PMF_EVENT_VOCABULARY

## Purpose

Define the smallest telemetry vocabulary that lets a launch-stage product learn whether users reach value.

## Minimum viable event chain

- `landing_viewed`
- `cta_clicked`
- `signup_started`
- `signup_completed`
- `onboarding_started`
- `activation_reached`
- `core_action_completed`
- `checkout_started`
- `checkout_completed`
- `subscription_changed`

Names may change to match the product, but the chain should remain recognizable.

## Event property rules

- Use stable user/account IDs, not raw emails.
- Attach only properties needed to answer a product question.
- Never send secrets, tokens, payment details, passwords, private messages, or special-category data.
- Separate test/internal/admin events from customer events.
- Payment and entitlement events should be based on verified server/webhook state.

## Rules

- `TEL-EVT-01 PASS`: A build spec defines activation in product language before code wires `activation_reached`.
- `TEL-EVT-02 FAIL`: An implementation emits product telemetry with no declared event vocabulary or owner.
- `TEL-EVT-03 PASS`: The event chain covers signup, activation, core action, and monetization when relevant.
- `TEL-EVT-04 FAIL`: Telemetry payloads include secrets, raw tokens, full payment data, or unnecessary sensitive data.
- `TEL-EVT-05 WARN`: Events exist but cannot be joined to a stable user/account identifier after signup.
- `TEL-EVT-06 PASS`: Internal/admin/test events are filterable from customer metrics.

*Last reviewed: 2026-06.*
