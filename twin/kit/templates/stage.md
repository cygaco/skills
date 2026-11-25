# Your project's stage

This file tells your twin what this project is, who it is for, and what counts as a win at its current stage. Your twin reads it on every call and weighs technical choices by the stage. `/twin` fills it in from your first-run answers, and you can edit it by hand at any time; the stage is one of `research`, `pre-mvp`, `launch`, `finding-pmf` or `pmf`, described under "Stage definitions" below.

**Stage:** not set

## What this project is

_(not set: run /twin, or write it here)_

## Who it is for

_(not set: run /twin, or write it here)_

## A win right now

_(not set: run /twin, or write it here)_

## Priorities (ranked)

1. _(not set)_

## Avoid right now

- _(not set)_

## Stage definitions

| Stage | What good looks like | Avoid |
|---|---|---|
| `research` | Learning whether there is a problem worth solving, for whom, and how it would pay. | Building before that bet is settled. |
| `pre-mvp` | The smallest core loop that proves the bet, for a few real users. | Hardening for scale and edge cases, breadth, getting locked into one vendor, abstractions before they are needed. |
| `launch` | The first version is out: collect data, talk to users, fix what breaks, and win the first session and the first week. | Big new features ahead of fixing the first-run experience and obvious early bugs. |
| `finding-pmf` | Iterating until the numbers that show real demand pass for your kind of product: people coming back, steady use, what it costs to win a user, growth that comes on its own. | Scaling or adding breadth before people keep coming back; ignoring what the usage data says. |
| `pmf` | Steady demand. Hardening, reliability and scale now earn their cost. | Rewrites; adding features so fast that the loop that already works breaks. |

The shift between stages is not a feature checklist; it is what counts as a win.

## When to change the stage

The stage changes on a trigger, not on a feeling.

| Change | Trigger |
|---|---|
| `research` to `pre-mvp` | The problem, the audience and how it pays are settled: you know what to build. |
| `pre-mvp` to `launch` | The first version is real and going out to its first real users, not just friends. |
| `launch` to `finding-pmf` | The first users are in, and you are iterating on whether they come back, checking the numbers. |
| `finding-pmf` to `pmf` | The numbers pass for your kind of product: people keep coming without being pushed. |

To change it:

1. Edit the Stage line at the top of this file so it names the new stage: exactly one of the five stage names above, as plain text without backticks. Anything else counts as not set.
2. Refresh "A win right now", "Priorities (ranked)" and "Avoid right now" for the new stage.
3. Commit the file, if you track it in git.

Your twin uses the new stage on its next call.
