# Programme 4 research log — data-driven, executable oracles only. No LLM judge.

## Iteration 0 — setup
- Built the crown-jewel BUILD-TO-ORACLE harness: model writes a Python `schedule()` from its arm's spec;
  graded mechanically (grade.py) against 150 real Fineract schedules. Metrics: match@tol, struct_ok,
  closes_to_zero, crashes, median residual, $cost, tokens. No judge anywhere.
- Reference impl (my own, faithful) matches 143/150 @0.01 and 150/150 @0.50 — the achievable ceiling;
  oracle validated.
- v4 invariant spec pins STRUCTURE; conventions (rate/1200, HALF_EVEN, last-period residual) pinned via
  the shipped `given f(x) means e` reference-definition feature. Prose spec written faithfully with the
  same conventions (fair v4-vs-prose transmission test).
- Pilot launched: nospec/prose/v4 x2. Checking for ROOM (does no-spec diverge?) + saturation before the
  full matrix. Agile: branch on results toward elicit (surfacing->build) and distill (distill->rebuild)
  where v4 can earn clear air over prose/v3.

## Iteration 1 — A1 pilot: SATURATES on a standard behaviour (no room)
- nospec/prose/v4 all match 150/150 @0.50, struct 150, closes 150, 0 crashes, ~$0.07, 20k tok.
- => A frontier model builds a Fineract-matching amortising schedule from just "implement an amortising
  loan schedule". Build-to-oracle SATURATES on textbook behaviour — no room, so no clear air. Consistent
  with P1-P3 saturation. Not a spec failure; the behaviour is guessable.
- PIVOT (per plan): create ROOM with NON-DEFAULT but realistic conventions the model won't guess (real
  systems have system-specific quirks — that IS what a spec must transmit). Build a flat/add-on-interest
  reference (model defaults to declining balance), regenerate the oracle from it, rerun. Prediction:
  no-spec guesses declining -> fails; spec arms transmit flat -> pass. Then chase v4-vs-prose separately.

## Iteration 2 — flat product: CLEAR AIR of spec over no-spec (executable, decisive)
- Build-to-oracle vs 150 flat-interest oracle traces, 3 reps:
  - no-spec 54/150 (builds DECLINING balance, the textbook default -> fails the flat oracle; matches the
    declining-ref's 54/150 exactly -> confirmed it guessed the wrong convention).
  - prose 150/150. v4 150/150. (all struct 150, closes 150, 0 crashes, ~$0.08-0.12, 21-22k tok.)
- **=> FINDING 1 (executable, clean): a spec is NECESSARY for correct builds when the product has a
  system-specific convention the model can't guess. No-spec is wrong ~64% of schedules; any spec ->
  100%.** This is real correctness value, mechanically, clear air over no-spec.
- prose == v4 (both 150/150): notation doesn't matter for TRANSMISSION when both fully specify. To earn
  clear air over prose, v4 must win where prose is weak: (a) checkability (validate an imperfect spec
  before build), (b) distillation drift, (c) complexity/ambiguity. Next: distill direction + validate.
