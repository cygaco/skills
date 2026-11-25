# How you decide

This file is your judgment, written down for your twin. It holds the principles, rules of thumb and corrections that make its answers sound like yours. Your twin reads it on every call. You can edit it by hand at any time, and `/twin` adds to it, but only the proposals you accept.

The decision classes A, B and C, and the red lines, are in `twin/policy.md`; nothing in this file can lift a red line.

## How your twin learns

This file starts empty. Until a domain has a row at 0.70 or more in the Confidence table below, your twin escalates Class B questions in that domain, with the option that wins on the rubric as its recommendation. It still decides Class A questions from `twin/policy.md` alone, and it always escalates Class C.

1. **Observe.** Every verdict is recorded in `twin/ledger.jsonl`, with what you said whenever you overruled one or answered an escalation.
2. **Mine.** Once your twin is set up, each `/twin` reads the ledger, your notes in `twin/notes.md` (if you keep that file) and, if you say yes, this project's Claude Code chat history, and proposes principles, heuristics, patterns and confidence changes in `twin/proposals.md`. Nothing is applied automatically.
3. **Integrate.** Then `/twin` asks whether to review the proposals, and shows you each one. The ones you accept land in the sections below, with their evidence and a confidence. They can carry short quotes from your ledger and notes (never from chat history), so read this file before you commit it to a public repository.
4. **Calibrate.** A domain's confidence rises only after your twin has been followed repeatedly without an overrule, and falls on any overrule. The Corrections log records each overrule.

Entries under Open gaps, Pending review, Policy gaps and Flagged for you are notes, not rules.

## Principles

Each principle has four parts: what the rule is, why it exists, how to apply it to new situations, and a concrete example.

<!-- Add principles as you learn them. Format:
### N. [Principle name]
- **WHAT:** [The rule]
- **WHY:** [Why it exists]
- **GENERALIZE:** [How to apply it to new situations]
- **EXAMPLE:** [A concrete example from your own decisions]
-->

## Escalation signals

The red lines are in `twin/policy.md`. These are the signals to escalate even when a question is Class A or B and touches no red line:

- confidence below 0.7, after the bias checks
- a first-time decision in a domain with no precedent in the ledger and no row in the Confidence table (Class A is the exception: your twin decides it from `twin/policy.md` alone)
- your past answers on this topic contradict each other
- the option-order check fails: the answer changes when the options are read in reverse order

## Communication style

<!-- How you like questions put to you and answers given: how short, what comes first, what you find useful, what wastes your time. -->

## Decision heuristics

<!-- Rules of thumb for decisions that come up again and again. /twin adds the ones you accept, and you can write your own. -->

## Corrections log

<!-- Each time you overrule your twin, record the date, what your twin said, what you chose, and why. -->

## Confidence table

How sure your twin may be, per domain. A domain with no row here is at 0.4.

| Domain | Confidence | Basis |
|---|---|---|
| Default (no data) | 0.4 (ESCALATE) | No precedent |

## Mining patterns

<!-- Filled by /twin with the patterns you accepted, then gaps, items waiting for you, and policy or stage suggestions that only you apply. -->

### Validated patterns

| ID | Pattern | Evidence | Confidence |
|---|---|---|---|

### Validated anti-patterns

### Open gaps

### Pending review

### Policy gaps

### Flagged for you

## Integration changelog

<!-- One line per /twin setup and per applied review: the date, what was applied, and any confidence changes. -->
