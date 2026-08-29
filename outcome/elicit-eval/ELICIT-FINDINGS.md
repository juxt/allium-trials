# Elicit eval: the first verified clear-air win for v4

The whole programme had shown the model saturates every "help it be correct" task, and that a
spec never beat prose. This is the exception, on the one axis our data always pointed to: the
unknowable. When a feature request is underspecified, a responsible process surfaces the genuine
decisions for a human instead of silently guessing them. This measures exactly that.

## Design (repeatable)

- **Task:** a deliberately underspecified feature request ("add late-payment fees"), phrased as a
  normal ticket. Ten load-bearing decisions are planted that the request does not determine
  (grace period, fee basis, rate, cap, recurrence, compounding, rounding, waiver authority,
  accounting destination, idempotency). The rubric is held by the judge only; the arms never see
  it.
- **Arms**, same request into each: `nospec` ("implement it"), `prose` ("write a spec, then
  implement"), `v4elicit` (follow the Allium v4 elicit skill). [Expanded run adds `v3elicit` and a
  second feature.]
- **Judge:** blind, scores each output per decision as SURFACED (asks / flags as open), GUESSED
  (silently commits a value), or ABSENT.
- **Metric:** high surfaced + low guessed. A guessed decision is a confident, unasked requirement
  that could be wrong — the exact failure a spec-in-the-loop should prevent. Three reps.

## Result (task A, 3 reps, hand-verified)

    arm        surfaced   guessed
    nospec       5.7        4.0
    prose        5.0        4.7     <- no better than no spec
    v4elicit     9.0        0.0     <- clear air, and dead stable (9/0 every rep)

Two things, both mattering for the mission:

1. **A prose spec does not help.** It is statistically indistinguishable from no spec. The model
   writes prose and still commits ~4-5 defaults. "Having a spec" is not the value.
2. **The v4 elicit skill specifically flips the disposition.** From "proceed with defaults, flag
   the big ones" to "refuse to guess, surface everything." Nine of ten surfaced, zero guessed,
   with no variance across reps.

## Verified, not judge-inflated

After the earlier false positive, both outputs were read by hand. The scoring is genuine:

- `v4elicit` explicitly separates what domain/repo settle from seven `-- OPEN:` questions it "will
  not guess", refuses to close the loop until answered, and gates completion on `allium analyse`.
- `nospec` is a careful engineer but its own words are "commit to concrete defaults so this is
  buildable today, and flag the two or three that genuinely need sign-off." It silently commits
  fee basis (flat), recurrence (one-shot), rounding, accounting legs, and the idempotency design —
  five confident unasked requirements — while flagging three. The judge's 5/5 is fair.

The gap (9 vs ~5 surfaced, 0 vs ~4 guessed) is far larger than plausible judge noise, and the
v4elicit variance is zero.

## Honest bounds

- Measures the surfacing half of the loop (surface -> human answers -> correct build), which is the
  load-bearing half (the 88%->0% fabrication finding), but not the full build. The full loop is the
  next test.
- One task at three reps here; the expanded run adds v3 and a second feature for robustness.
- The win is the elicit skill + language package (the OPEN-line discipline and the analyse gate),
  not the syntax in isolation. Prose has no such discipline and does not surface. That the package
  beats prose is the point.

## Expanded matrix (4 arms x 2 features x 3 reps, verified)

Added the v3 elicit arm and a second underspecified feature ("account dormancy", 10 planted
decisions incl. escheatment).

    arm        surfaced   guessed     (mean over 2 tasks x 3 reps)
    nospec       5.7        4.0
    prose        4.2        5.5     <- WORSE than no spec
    v3elicit     8.8        0.0
    v4elicit     8.5        0.2

Per task the pattern holds (task A: v3 8.7/0.0, v4 8.0/0.3, prose 5.3/4.7, nospec 5.0/4.3;
task B: v3 9.0/0.0, v4 9.0/0.0, prose 3.0/6.3, nospec 6.3/3.7).

Three robust findings:

1. **The elicit skill delivers clear air** over prose and none: ~8.5-8.8 surfaced, ~0 guessed,
   low variance, on both features.
2. **A prose spec is worse than no spec.** It guesses MORE (5.5 vs 4.0). Verified by reading
   outputs: asked to "write a spec", the model authors confident specifics as fact ("stated first
   and precisely") without flagging them open. The instruction to specify licenses fabrication.
   One prose run fabricated 9 of 10 decisions.
3. **v4 does NOT beat v3 at surfacing** (8.5/0.2 vs 8.8/0.0 — a tie, v3 marginally ahead). The
   value is the elicit DISCIPLINE, which both skills carry, not the v4 syntax.

## What this means for the mission, honestly

Clear air for the elicit skill over prose and no spec: yes, large and repeatable. Clear air for
v4 over v3: NOT on this axis. Surfacing the unknowable is a disposition the elicit process instils
(refuse to guess, ask), and both the v3 and v4 skills instil it equally. The v4-specific value, a
formal machine-checkable spec, does not manifest at the surfacing step.

Where it should manifest, and the next test (directive 5): the SECOND half of the elicit loop.
Once the human answers the surfaced questions, some answers conflict (a percentage fee with a flat
cap below the percentage on the smallest instalment; a recurring fee with a one-per-instalment
idempotency rule). v4's `analyse` catches such contradiction/infeasibility deterministically; v3
does so heuristically; prose not at all. That is where v4 earns clear air over v3, and it is the
test to run next: feed conflicting answers to the surfaced questions and measure which arm catches
the conflict. (We have prior evidence analyse catches contradictory rule sets, 74/74.)

## Why this is the right place to have pushed

Every accuracy-on-knowable-tasks experiment saturated, and formalism never beat prose there. Here,
on the unknowable, where the model's default disposition is to help and proceed, the v4 elicit
discipline is the one thing that reliably stops it guessing. That is a real, repeatable, verified
value proposition for v4 over both prose and no spec.
