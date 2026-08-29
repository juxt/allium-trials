# Autonomous 8-hour loop — Allium v4 ↔ test-harness (flip-flop)

Set up 2026-08-29 23:34. Runs unattended; the human reconvenes at the end for a sync on key
learnings (good and bad).

- **START_EPOCH:** 1788042878
- **END_EPOCH:** 1788071678  (START + 8h)
- To check the budget each wake: `date +%s`; if `>= 1788071678`, write the FINAL SUMMARY and stop.

## Mission (unchanged)

Make Allium v4 do everything v3 can PLUS a clear, data-driven value proposition over v3, a prose
spec, and no spec. Focus axis: **elicit** for greenfield/brownfield feature correctness (the one
place value is proven non-saturated). Distill parked (returns later as a seed-crystal spec). All
evals independently repeatable. If v4 isn't outperforming, find why and fix skill/syntax/CLI/analyse.

## Loop protocol (do this every wake)

1. `date +%s`; if `>= END_EPOCH`, append `## FINAL SUMMARY` (key learnings, good + bad, state of
   each open thread, recommended next steps) and STOP — do not reschedule.
2. Collect any finished background eval; read its outputs and log the result HONESTLY (good or bad).
   Verify before claiming — after the t3 false positive and the NPE-as-catch, read the artifacts,
   don't trust surface numbers.
3. Do ONE focused iteration of the current objective. Alternate each iteration:
   odd = improve the TEST HARNESS / eval methodology; even = improve ALLIUM v4 (syntax / CLI /
   skill / analyse). Ideate a new angle where useful, not just grind the backlog.
4. Append an iteration entry below (what / result / good / bad / next). Commit changes across repos.
5. `ScheduleWakeup` again with the same loop prompt. Never stop for user input before END_EPOCH.

## Discipline

Intellectually honest, emotionally steady, no angst at bumps. Verify results (read outputs, add
regression tests). Log bad/negative results as first-class findings. Keep v4 a general-purpose,
elegant, functionally-inspired behavioural spec language. Guard against harness self-deception
(leading the witness, vacuous specs, errors-counted-as-catches, judge inflation).

## Backlog (pull from here; add to it as ideas arise)

### Harness / methodology
- H1. More features beyond late-fee & dormancy (e.g. FX conversion, KYC hold, interest accrual
  change) for robustness of the surfacing + conflict evals.
- H2. Full-loop test: surface -> operator answers -> BUILD -> correctness vs a hidden oracle
  (not just surfacing). The load-bearing end-to-end claim.
- H3. Judge robustness: 2-3 judges + inter-rater agreement; sample hand-verification each run.
- H4. Token-efficiency test (banked): v4 vs prose spec at equal accuracy, spec + downstream cost.
- H5. Richer emergent-conflict scenarios / more operator error modes; subtler clashes.
- H6. v3 arm parity everywhere; quantify v4-vs-v3 deltas cleanly.

### Allium v4
- V1. Reachability: extend to guard COMBINATIONS (catch monotonic-style needing 2 guards true) —
  a DPLL(T)-lite over guard booleans + LRA.
- V2. Decimal/rational literals (0.02 currently doesn't lex cleanly) — general numeric literals.
- V3. analyse: suppress/reconcile the misleading boolean "jointly satisfiable" line when the
  arith tier has a verdict (avoid contradictory dual messages).
- V4. "Spec must bite" as a first-class analyse capability (falsifiability / spec-mutation check).
- V5. Wire the reachability/vacuity check into `check` (warnings) and the elicit loop's done-gate.
- V6. Cross-dimension conversion construct (K55 rate-carrying conversion) — general units algebra.

## Iteration log

(iterations appended below)
