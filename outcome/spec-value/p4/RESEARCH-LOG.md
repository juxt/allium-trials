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
