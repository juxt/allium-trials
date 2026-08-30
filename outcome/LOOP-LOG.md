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

### Iteration 4 — harness (collected the strict-judge re-run) — KEY HONEST FINDING
- Strict-judge non-leading result (runc3, 2 reps): v4 4/6 caught, 0/4 FA; v3 0/6, 0/4; prose 6/6,
  1/4; nospec 6/6, 1/4.
- **Verified by reading saved outputs (not trusting the number):** the model arms' catches are
  GENUINE and SPECIFIC, not hedging. nospec on floorcap works the max/min orderings and notes 2%
  becomes dead code; on monotonic it explicitly says "This isn't generic hedging. It's a specific
  arithmetic collision on outstanding_balance." So the strict judge is right and prose/nospec really
  do catch 6/6.
- **=> The conflicts I designed are catchable IN-HEAD by a frontier model.** So v4's deterministic
  analyse does NOT beat the model on catch-rate here (v4 4/6 vs model 6/6). This is the saturation
  problem one level up: two-constraint emergent conflicts are within the model's reasoning.
- **GOOD for v4:** clear air over v3 (4/6 vs 0/6); deterministic (same verdict every run) and 0
  false alarms vs the model's occasional FA; catches automatically without relying on the model
  noticing. The decimal + coherent-verdict fixes removed v4's earlier false alarm.
- **BAD / open:** v4 recurrence & monotonic only 1/2 — encoding-variance (the skill sometimes
  harmonises). And prose's clean_pct "false alarm" may be a judge misfire (the output discusses
  uniqueness constraints, not a requirements conflict) — flagged, low priority.
- **NEXT (the real gap):** to show v4's UNIQUE value (catch what the model misses), need SUBTLER
  conflicts that exceed in-head composition — infeasibility emerging only from composing 4-5 numeric
  constraints, or across a schedule of periods. If the model STILL catches those, the honest
  conclusion is that conflict-detection also saturates and v4's value is determinism/automaticity/
  v3-parity, not catch-rate. Iteration 5 = harness: design & run harder multi-constraint fixtures.

### Iteration 7 — harness: SCALE probe (the one place catch-rate clear air could remain)
- Built a 14-constraint loan-product config with a conflict BURIED among distant constraints: base
  1.75%/mo (=21%/yr, rule 4) + penalty 0.5%/mo (=6%/yr, rule 8), both counting toward APR (rule 11),
  total 27% > the 24% APR cap (rule 3). The four clashing constraints are stated far apart among 14.
  Plus a clean twin (cap 30%). Arms: v4 (encode all -> analyse) vs nospec (build, strict judge). 4 reps.
- De-risked: analyse CATCHES the encoded conflict (CONTRADICTORY, core apr_counts+...). So the v4 side
  is viable; the test is whether the MODEL misses the buried conflict while building.
- Eval launched (runscale). HYPOTHESIS: if nospec < v4 on the buried conflict, that is the first
  catch-rate clear air (scale beyond in-head composition). If nospec still 4/4, conflict-detection
  saturates even at 14 constraints and the honest conclusion holds. Collect next wake. Commit: allium-trials.

### Iteration 6 — collected hard-conflict eval — MAJOR HONEST FINDING: conflict-detection saturates
- Hard eval (runhard, strict judge, 2 reps): v4 6/6 caught 0 FA; nospec 6/6 (1 FA); prose 6/6 0 FA.
- **Verified by reading outputs:** the model's hard_chain catch is GENUINE and deep — nospec
  substituted the full 5-def chain (outstanding=5D -> surcharge=0.05D -> fee=0.07D=7% vs stated 4%,
  "Seven is not four") and checked no partial reading gives 4%. Real multi-step in-head composition.
  nospec's clean_alloc "false alarm" was a JUDGE MISFIRE, not a model error: the model said
  "40+30+20+7+3=100... no arithmetic conflict" and flagged a SEPARATE rounding-residual concern,
  which the clean-judge miscounted. So the model's real precision here is 0 FA too.
- **=> CONFLICT-DETECTION SATURATES.** A frontier model catches even 5-constraint emergent conflicts
  in-head, and is precise. v4 (after the decimals + requirement-feasibility fixes) also catches 6/6
  deterministically with a named core — but does NOT beat the model on catch-rate OR precision at
  this scale. This is the same saturation the whole programme found on every accuracy axis.
- **v4's genuine value on this axis (not accuracy):** determinism/repeatability, a machine-checked
  named core (auditability), an AUTOMATIC standing gate (no reliance on the model choosing to reason
  about consistency), and clear air over v3 (v3 analyse = 0/6, no such check). Catch-rate clear air
  would only appear beyond in-head composition — i.e. genuine SCALE (dozens of constraints / long
  schedules / a spec too big to hold), the untested frontier we keep hitting.
- **Harness fix (H3):** corrected the clean-scenario false-alarm judge to count only a claim that the
  REQUIREMENTS are mutually contradictory, not separate implementation concerns (rounding/residual).
  Committed (both harnesses).
- **Contrast with the SURFACING result (earlier):** that DID show clear air (v4/v3 elicit 9/0 vs
  prose/none ~5/~4 guessed) because it measured DISPOSITION (refuse to guess), not accuracy. So the
  elicit skill's surfacing value stands; the analyse conflict-CATCHING value saturates vs the model.
- **Next:** the only place catch-rate value could remain is scale-beyond-context. Iterations should
  either (a) probe that (a spec with many constraints the model can't hold — hard to construct so it
  actually exceeds a 1M-context model), or (b) consolidate v4's genuine differentiators (determinism/
  audit/automatic/v3-parity) and the surfacing win, which is where the honest value lives.

### Iteration 5 — harness (harder multi-constraint conflicts) + v4 fix it surfaced
- Designed 3 SUBTLER conflicts (harder to eyeball): hard_chain (5-def algebraic chain forcing fee =
  7% vs stated 4%, satisfiable only at overdue=0), hard_alloc (5 percentages sum to 101.5 not 100),
  hard_band (3% of 500 = 15, outside required [10,12]) + 2 consistent complex controls.
- **De-risk (hand-encoded) found a real v4 gap:** hard_alloc & hard_band caught, but hard_chain was
  MISSED — the arith feasibility check ignored `requirement`/existential items, so it "satisfied"
  the spec by setting overdue=0 (fee never applies). Fixed with a **requirement_probe**: grounds a
  `requirement some x :: C` and checks it feasible against the invariants via LRA; reports INFEASIBLE
  with core. GOOD: hard_chain now caught; regression test added; 45 tests green. Commit: allium-tools.
- Hard-conflict eval (v4/nospec/prose, strict judge) launched (runhard). Collect next wake: the
  question is whether the model MISSES any hard conflict that v4 catches (v4 unique value) or still
  catches all (conflict-detection saturates). Either is an honest result.
- Note: v4 catching hard_chain depends on the skill encoding a reachability `requirement` — the
  reworked skill says to, but encoding variance may bite.

### Iteration 3 — v4 (V3: coherent analyse verdict)
- analyse post-filters the boolean "jointly satisfiable" line for any component the arithmetic tier
  overrules (CONTRADICTORY/VACUOUSLY). Before, a floor>cap spec printed both "jointly satisfiable"
  AND "VACUOUSLY", which is misleading and the elicit gate reads it. GOOD: verified suppressed,
  vacuity kept, regression test added, 44 tests green. Commit: allium-tools.
- Next: iteration 4 = harness — collect the strict-judge re-run (runc3) and log the corrected
  v4/v3/prose/nospec numbers honestly (read the saved outputs to confirm the judge isn't over/under
  strict). Then iteration 5 = v4 (candidate: V5 wire vacuity into `check`, or V1 guard-combination
  reachability — but note the monotonic miss is an ENCODING loophole (skill), not only a check gap).
