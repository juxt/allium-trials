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

## Iteration 3 — LANGUAGE FIX: division operator added (real gap found via the reference oracle)
- Building the flat reference-oracle spec (interest = disbursed*rate/1200) exposed that v4 had NO
  division operator at all: BinOp lacked Div, the lexer skipped `/` as an unknown byte, so `x / 1200`
  silently became `x`. Financial specs are full of division (rate/1200, /12). Also the reference-oracle
  feature only inlined PARAMETERISED givens; 0-ary `given k means <arith>` didn't inline.
- Fixed end to end (RED->GREEN, 52 allium-v4 tests): lexer Slash, BinOp::Div, parse at mul precedence,
  eval in monitor (zero-guarded), LRA (constant divisor = linear, variable = nonlinear), type-checker
  (X/scalar keeps dim; same-dim/same -> scalar). 0-ary reference constants now inline. Now
  `interest = disbursed*rate/1200` monitors: correct spec residual ~0.005, /1000 typo residual 1.66 —
  cleanly distinguished. This is the executable substrate for the checkability experiment.
- Harness note: the model burns turns and hits --max-turns on big distill prompts, returning empty;
  fixed with --max-turns 6 + "respond in a SINGLE message, do not use tools". Also: the model is
  markedly LESS FLUENT in v4 than prose (uses # not --, omits header/end) -> naive v4 distillation is
  unreliable; the `allium check` gate is needed just to reach parity. A real adoption cost of a formal
  language, and part of why checkability matters (you can't ship an unparseable prose spec's analogue).

## Iteration 4 — ELICIT direction: surfacing -> correct build (executable, emerging)
- Vague request (flat product), operator answers ONLY surfaced decisions (deterministic keyword match),
  build graded vs flat oracle. So far:
  - nospec (no elicitation): surfaces nothing -> build 54/150 (guesses declining). 4/4 reps.
  - prose ("write a spec, list questions"): surfaces all 4 decisions incl. interest_basis -> operator
    answers -> build 150/150. 3/3 so far.
- => FINDING 2 (executable): the ELICIT step converts a vague request into a correct build by SURFACING
  the load-bearing convention decision; without it the model silently guesses the default and is wrong
  ~64%. v3elicit/v4elicit rows pending. Note this again is "specifying/eliciting helps"; v4-vs-prose
  distinction TBD from those rows + the validated experiment.
- Ops note: running two model-heavy harnesses concurrently ~halves throughput; the validated (v4
  check+monitor+fix, ~4 calls/rep) is slow under contention. Will run it solo.

## Iteration 5 — checkability has TWO mechanical layers (both demonstrated on the complex product)
- Layer 1 `check` (syntax): v4-complex rep0 distiller emitted INVALID v4; `allium check` caught it,
  fed back, fixed over 2 rounds -> valid spec -> rebuild 150/150. This partly compensates for v4's own
  fluency cost (the model is less fluent in v4 than prose).
- Layer 2 `monitor` (semantic faithfulness): hand-check on the complex oracle — faithful spec holds
  (ok True); a spec with the WRONG fee (0.5% vs 0.25%) FAILS interest_line at residual 12.5 (ok False).
  So a v4 spec that gets a convention wrong is caught MECHANICALLY. Prose can only be eyeballed.
- => v4 checkability is real and two-layered. Whether it yields CLEAR AIR over prose on build-
  correctness now hinges on whether prose (eyeball) drifts on the complex conventions — validated-
  complex prose reps + the naive distill-complex control will decide. v4-complex rep0 already 150/150.

## Iteration 6 — saturation is MODEL-INDEPENDENT (haiku confirms) + distill saturates
- Naive distill->rebuild on the COMPLEX product, 4 reps, fixed harness: v4 150/150, prose 150/150.
  Even claude-haiku-4-5 (cheap): v4 distill->rebuild 150/150 (reps 0,1). => given the reference/spec,
  correctness saturates across BOTH notation (v4=prose=v3) AND model strength (opus=haiku). The value
  is entirely in HAVING the specified conventions, not model/notation. The earlier "v4 drift" was a
  max-turns harness artefact.
- CONSEQUENCE: no v4>prose clear air on build/distill/elicit correctness or tokens is available — the
  regime is saturated. v4's only clear air over prose is CATEGORICAL: it is executable (checkable +
  monitorable + a standing regression gate). F5 stands as the v4-distinct value.
