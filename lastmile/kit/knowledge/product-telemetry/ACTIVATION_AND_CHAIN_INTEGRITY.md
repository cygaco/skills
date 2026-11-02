# ACTIVATION_AND_CHAIN_INTEGRITY

## Purpose

Telemetry is only useful if the event chain is honest. This reference helps you and your AI catch fake activation, duplicate emitters, raw sinks, and broken transport.

## Chain integrity

A good telemetry chain has:

- one named wrapper or sink for outbound events
- typed or enumerated event names
- validation of required properties
- no duplicate SDK/direct emitter paths
- tests for expected events
- release evidence that the chain can be evaluated

## Activation integrity

Activation must be:

- product-defined, not inferred from a placeholder
- specific enough to test
- tied to a real user action or verified state change
- revisionable with provenance/confidence when generated or confirmed by a lastmile module

## Rules

- `TEL-CHAIN-01 PASS`: The code has one sanctioned telemetry wrapper/sink and blocks or flags direct SDK calls outside it.
- `TEL-CHAIN-02 FAIL`: A diff adds `analytics.track`, `fetch('/telemetry')`, `sendBeacon`, or equivalent raw emitters outside the sanctioned sink.
- `TEL-CHAIN-03 FAIL`: `activation_reached` can fire from a placeholder, guessed, or unconfirmed definition.
- `TEL-CHAIN-04 PASS`: Activation changes emit enough metadata to explain what changed and why.
- `TEL-CHAIN-05 WARN`: Events are present but there is no test or release evidence that the chain is complete.
- `TEL-CHAIN-06 FAIL`: Client-controlled payment/entitlement events are treated as business truth without server/webhook verification.

*Last reviewed: 2026-06.*
