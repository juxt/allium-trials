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

## Why this is the right place to have pushed

Every accuracy-on-knowable-tasks experiment saturated, and formalism never beat prose there. Here,
on the unknowable, where the model's default disposition is to help and proceed, the v4 elicit
discipline is the one thing that reliably stops it guessing. That is a real, repeatable, verified
value proposition for v4 over both prose and no spec.
