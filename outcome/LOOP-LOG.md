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

### Iteration 1 — v4 (decimal/rational literals) + processed the non-leading conflict eval
- **Non-leading conflict eval result (conflict-runs2, 2 reps):** v4 3/6 caught, 1/4 false-alarm;
  v3 0/6, 0/4; prose 4/6, 1/4; nospec 6/6, 2/4. (v4 catches via analyse; prose/nospec via a blind
  spontaneous-flag judge.)
- **GOOD:** v4 now catches conflicts it caught none of before (floorcap 2/2, monotonic 1/2), and
  cleanly beats v3 (3/6 vs 0/6) — v3 analyse has no consistency/vacuity check. The reworked skill +
  reachability check are working: v4's floorcap catch is the reachability report naming the core.
- **BAD / verified:** v4's one false alarm (clean_pct) was a REAL bug — `0.02` mis-lexed as `0`
  (v4 had only integer literals), so `fee = 0.02*base` collapsed to `fee = 0`, spuriously clashing
  with `fee >= 5`. Fixed: added general decimal/rational literals (Tok::Dec/Expr::Dec, exact num/den
  through types/arith/monitor). Re-verified: false alarm gone, floorcap still caught, 43 tests green.
- **BAD / open:** nospec 6/6 with 2/4 clean false-alarms strongly suggests the spontaneous-flag
  judge is counting the model's routine "I'll flag these for sign-off" HEDGING as a conflict catch,
  not genuine detection of the specific clash. So nospec's 6/6 is likely inflated. Also the harness
  didn't save prose/nospec text outputs, so I couldn't verify. => Iteration 2 (harness): (a) save all
  arm outputs; (b) make the spontaneous-flag judge require detection of the SPECIFIC emergent clash,
  not generic caveats; re-run and compare.
- **Also open (v4 backlog):** recurrence still 0/6 for v4 — the model encodes the mind-change into a
  coherent policy (not a hard conflict); monotonic only 1/2 — needs guard-COMBINATION reachability
  (V1). Note V3: analyse still prints a misleading boolean "jointly satisfiable" alongside the arith
  verdict.
- Commit: allium-tools (decimals). Next: iteration 2 = harness (judge strictness + save outputs).

### Iteration 2 — harness (strict spontaneous-flag judge + save outputs)
- Rebuilt the non-leading conflict eval's judge to require detection of the SPECIFIC clash (judged
  against ground truth), not generic hedging, and to save every arm's output for verification.
  Re-run launched (runc3). GOOD: removes the suspected inflation of nospec's 6/6. Result pending
  (collect next wake). Commit: allium-trials.

### Iteration 3 — v4 (V3: coherent analyse verdict)
- analyse post-filters the boolean "jointly satisfiable" line for any component the arithmetic tier
  overrules (CONTRADICTORY/VACUOUSLY). Before, a floor>cap spec printed both "jointly satisfiable"
  AND "VACUOUSLY", which is misleading and the elicit gate reads it. GOOD: verified suppressed,
  vacuity kept, regression test added, 44 tests green. Commit: allium-tools.
- Next: iteration 4 = harness — collect the strict-judge re-run (runc3) and log the corrected
  v4/v3/prose/nospec numbers honestly (read the saved outputs to confirm the judge isn't over/under
  strict). Then iteration 5 = v4 (candidate: V5 wire vacuity into `check`, or V1 guard-combination
  reachability — but note the monotonic miss is an ENCODING loophole (skill), not only a check gap).
