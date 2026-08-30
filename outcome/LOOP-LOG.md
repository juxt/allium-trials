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

### Iteration 18 — v4: root-cause of v4's higher ABSENT (why v4 trails v3 on surfacing)
- Followed iter 17's nuance (v4 ABSENT 2.1 > v3 1.5). Diffed the two elicit skills:
  - V3 SKILL.md = 368 lines, PHASED, with an explicit COVERAGE SWEEP: a "Verify and complete the
    specification" phase and questions like "Looking at [entity], are these states complete? Can it be
    in any other state?" plus "Open questions documented". V3 systematically walks the decision space
    and forces "what else?".
  - V4 SKILL.md = 114 lines, lean; its ONLY "complete" mention is a NEGATIVE ("don't produce a
    complete-looking spec without running analyse"). It nails the DISCIPLINE (refuse-to-guess, encode
    so the spec bites, dimensioned thresholds) but has NO enumeration/coverage step.
- **=> Root cause (confident): v4 surfaces well what it CONSIDERS but considers less BREADTH, so more
  decisions fall through as ABSENT instead of SURFACED.** The lean rewrite dropped V3's completeness
  sweep along with V3's bloat. This is a skill gap, not a syntax gap.
- **Ready-to-run fix (NOT shipped — would be an unverified change in the last minutes; the loop
  forbids shipping unverified):** port V3's coverage question into V4's frame as one short step —
  after drafting, for each entity/observable ask "are these cases exhaustive? what state/branch is
  unlisted?" and record each as an OPEN item rather than dropping it. Keep it to ~3 lines to preserve
  v4's leanness. Then re-run eval-elicit2 + eval-rejudge; success = v4 ABSENT drops to <=v3 without
  raising GUESSED. Logged as the top v4 backlog item for the human sync.
- Nothing shipped this iteration (root-cause + queued fix). No commit to allium-tools; log only.

### Iteration 17 — harness: judge-robustness check — SURFACING FINDING IS NOT A JUDGE ARTEFACT
- Risk: the load-bearing surfacing finding rested on ONE judge (elicit2's SURFACED/GUESSED/ABSENT
  scorer). Judge inflation could manufacture the whole result. Test: re-score the 40 ALREADY-SAVED
  arm outputs with a SECOND, independently-worded scorer (verbs ASKED/DECIDED/UNADDRESSED, different
  framing) — no regeneration, so this isolates JUDGE variance from generation variance. If the arm
  ordering survives a change of judge wording, the finding is real.
- Result (FINAL, 40/40, n=10 per arm):
  | arm | 2nd judge surf/guess/abs | 1st judge surf/guess |
  |---|---|---|
  | nospec   | 3.1 / 6.4 / 0.5 | 5.0 / 4.4 |
  | prose    | 2.2 / 7.0 / 0.8 | 3.8 / 5.1 |
  | v3elicit | 7.6 / 0.9 / 1.5 | 7.3 / 0.9 |
  | v4elicit | 7.1 / 0.8 / 2.1 | 7.1 / 0.5 |
- **Every load-bearing ordering SURVIVES the judge swap:** (a) prose worse than none — nospec surf
  3.1 > prose 2.2, and prose guesses more (7.0 > 6.4); (b) elicit >> both non-spec arms on surfaced
  (7.6/7.1 vs 3.1/2.2) and << on guessed (~0.9 vs ~6.7); (c) v4 ~= v3. The 2nd judge is uniformly
  stricter (all surfaced counts ~1-2 pt lower), so ABSOLUTE calibration is judge-dependent — but the
  DIRECTION of every claim is judge-independent. The surfacing value is not a scoring artefact.
- **Honest nuance (mild negative for v4):** on this stricter judge v4 slightly TRAILS v3 —
  v3elicit surf 7.6 vs v4 7.1, and v4 ABSENT 2.1 > v3 1.5. So v4's elicit skill drops a touch more of
  the decision space entirely (neither surfaces nor guesses) rather than surfacing it. v4 does NOT
  beat v3 on surfacing; it ties-to-marginally-trails. The value is the elicit DISCIPLINE both carry,
  and v4's edge over v3 must come from elsewhere (determinism / the analyse gate / dimensioned bite),
  not from a higher surfacing rate. Backlog item: audit whether the v4 SKILL.md wording causes the
  extra ABSENT (decisions silently dropped) and close that gap so v4 at least matches v3's coverage.
- Bad/limit: absolute numbers are not portable across judges (calibration drift ~1-2 pt), so report
  the finding as an ORDERING, never as "elicit scores 7/10". Commit: allium-trials.

### Iteration 16 — v4: close the polymorphic-literal laundering hole (regression test)
- Probed the risk that generalising "0 is polymorphic" to ALL literals opened a laundering hole:
  could a literal in an expression bridge two incompatible real dimensions? Tested 4 edges:
  - `fee <= cap + 0` (money + literal-0) → clean. GOOD.
  - `fee <= w` (money vs mass) → error. GOOD.
  - `t <= fee + w` (money + mass, literal-0 elsewhere) → STILL errors "cannot add money(gbp) and
    mass(kg)". GOOD — no laundering.
  - `fee >= 0 - disc` (negative literal bridge, same dim) → clean. GOOD.
- **=> The contextual-literal generalisation is SOUND: literals adopt a *neighbouring* dimension but
  never launder two genuinely incompatible ones.** This is exactly the property the user's "look for
  a general solution, not a money literal" pushed for — the general scalar mechanism holds without a
  type hole. Locked as `literal_does_not_launder_incompatible_dimensions` (48 tests pass).
  Commit: allium-tools.

### Iteration 15 — holistic regression of the session's v4 changes — CLEAN
- After a session of many core changes (decimals, contextual literals, non-vacuity/reachability,
  requirement feasibility, coherent verdict, exit-code gate, PARTIAL coverage, rate-pin removal,
  negative literals), re-ran the real demo specs end-to-end:
  - K55-money `check`: still catches `cannot add money(gbp) and money(usd)` (1 error). GOOD.
  - LoanScheduleInvariants `analyse`: SATISFIABLE over 3 periods **PARTIAL (1 nonlinear not checked)**;
    `balance_monotonic` NOT entailed (counterexample); `closes_to_zero` independent. GOOD — PARTIAL
    honesty and rate-pin removal both visible on a real spec.
  - LoanScheduleInvariants-fixed `analyse`: exit=0 (monotonic now entailed). GOOD.
  - Full v4 suite: 47 passed / 0 failed.
- **=> No regression; the session's changes compose correctly on the real specimens, not just unit
  fixtures.** rate-pin removal + PARTIAL are the load-bearing honesty upgrades; both behave on
  LoanSchedule. Verification only, nothing to commit.

### Iteration 14 — collected 4-feature surfacing eval — SURFACING WIN CONFIRMED ROBUST
- 4 features (late-fee, dormancy, overdraft, multi-currency) x 4 arms x 2 reps:
  nospec 5.0 surfaced / 4.4 guessed; prose 3.8 / 5.1 (WORSE than none, again); v3elicit 7.3 / 0.9;
  v4elicit 7.1 / 0.5.
- **Verified genuine (read outputs):** v4elicit (multi-currency) refuses to guess, lists explicit
  OPEN policy questions, even predicts the FX-markup-vs-conservation conflict analyse would catch.
  prose (dormancy) commits recommended defaults as fact ("default should be no dormancy fees",
  "keep interest accruing") while flagging only a few. Pattern holds across the new features.
- **=> v4's ONE proven clear-air value is ROBUST across 4 diverse features:** the elicit skill
  surfaces the unknowable and refuses to guess (~7/10 surfaced, ~0.5 guessed) vs prose (3.8/5.1,
  worse than nothing) and no-spec (5.0/4.4). Numbers a touch lower than the 2-feature run (some
  overdraft/FX decisions are more inferable), but the pattern is stable. v4 ~= v3 (the value is the
  elicit DISCIPLINE both skills carry, not the v4 syntax). This is DISPOSITION value, not accuracy —
  the one axis that never saturated. Commit: allium-trials.

### Iteration 13 — v4: negative literals (unary minus)
- Found: `bal(a) >= -1000` silently became `bal(a) >= <error>` (no unary-minus in the parser) — skipped
  as unchecked. Essential for finance (overdrafts, adjustments, refunds). Fixed: unary minus desugars
  to `0 - operand`, reusing subtraction everywhere. Verified: overdraft spec now satisfiable; negative
  literals compose (x>=-1000 ∧ x<=-2000 -> CONTRADICTORY). Regression test; 47 tests green. Commit:
  allium-tools. (The PARTIAL-honesty from iter 10 is why this was visible rather than silent.)

### Iteration 12 — harness: robustify the SURFACING win across 4 features
- Added overdraft + multi-currency features (taskC/taskD + rubrics) to the surfacing eval, now 4
  diverse banking features x 4 arms (nospec/prose/v3elicit/v4elicit) x 2 reps. Launched (runsurf4).
  GOAL: confirm the earlier clear-air surfacing result (v4/v3 elicit ~8.6 surfaced / ~0 guessed vs
  prose ~4 / ~5.5 guessed, prose WORSE than none) holds beyond the original 2 features — this is
  v4's ONE proven clear-air value, so it must be robust. Collect next wake. Commit: allium-trials.

### Iteration 11 — v4: fixed the over-broad rate-pinning (general-purpose + honest)
- Removed the arith `lower` rate-pin (Rate states were globally pinned to 1/10, a loan hack). Rate
  states are now variables; `rate * balance` is honestly nonlinear -> skipped + PARTIAL. Verified
  (rebuilt CLI): general `a = b*c` now SATISFIABLE-PARTIAL not faked; fineract loan's
  `interest = rate_factor * outstanding_start` now honestly "not linearisable, PARTIAL" instead of
  pinned. GOOD: arith tier is general-purpose again and no longer over-claims to check nonlinear
  interest; loan feasibility still holds via the linear invariants; 46 tests green. Commit: allium-tools.
- Net: this + iter 10 make analyse HONEST about the boundary of the decidable fragment — important
  given the scale-probe finding that real banking math (compound interest) is nonlinear and outside it.

### Iteration 10 — v4: honest coverage (PARTIAL) + surfaced a rate-pinning bug
- analyse now flags the satisfiability verdict as PARTIAL when nonlinear constraints were skipped
  ("N nonlinear constraint(s) were not checked, so this is not a full guarantee"), closing the
  over-reassurance gap the scale probe exposed (a clean verdict on a spec with unchecked nonlinear
  math). GOOD: verified; regression test; 46 tests green. Commit: allium-tools.
- **BUG SURFACED (backlog):** the arith tier's `lower` PINS any `Rate`-typed state to the constant
  1/10 (a loan-schedule hack for rate_factor). This leaks into general specs: `b(p) * c(p)` with b,c
  typed Rate becomes 0.01, not a variable product — wrong for any non-loan spec. The rate-pin should
  be scoped to the loan-schedule context (or removed / replaced by a symbolic rate). Over-specialised
  arith tier is a real v4 debt. Logged; not fixed this iteration.

### Iteration 9 — collected the SCALE probe — DECISIVE (refutes catch-rate clear air; surfaces a v4 limit)
- Scale probe (14 constraints, 4 reps): v4 2/4 caught (1 FA); nospec 4/4 caught, 4/4 "FA" on clean.
- **Verified by reading outputs — two big honest findings:**
  1. **My fixture was arithmetically NAIVE; the model corrected it.** nospec's "false alarm" on the
     clean (30% cap) config is NOT a false alarm — the model is right. It used the effective/COMPOUND
     APR: base 1.75%/mo = (1.0175^12-1) = 23.14%; base+penalty 2.25%/mo = (1.0225^12-1) = 30.60% >
     30% cap. My fixture assumed SIMPLE annualisation (12x -> 27% < 30% = "clean"), but regulatory APR
     is compound. So my "clean" twin is actually a conflict. The model's domain math exceeded my
     fixture design. HARNESS LESSON: you cannot easily out-design a frontier model's domain knowledge
     when building conflict fixtures — it knows the arithmetic better than the fixture author.
  2. **v4 is WEAKER here, not tied — it cannot express the math.** v4's decidable linear-arithmetic
     tier has NO exponentiation, so it cannot represent compound/effective APR at all. It caught only
     the naive simple-annualisation version, 2/4 (encoding variance: one rep didn't encode APR; one
     used a form analyse couldn't compose). So at scale on real financial constraints, the model
     catches (compound, in-head) while v4 can neither express nor check the constraint.
- **=> CATCH-RATE CLEAR AIR FOR v4 IS REFUTED at every scale I can construct.** The model doesn't miss
  buried conflicts, AND v4's linear (decidable, N6) spine can't express the nonlinear math (compound
  interest) the banking domain actually uses. Fundamental tension: real constraints are nonlinear;
  v4's checkable fragment is linear by design. Flag for the human — this bounds the analyse value.
- **This settles the conflict-catching thread:** v4's value is definitively the elicit SURFACING
  disposition + non-accuracy properties (determinism, audit core, automatic gate, v3-parity), NOT
  conflict-detection accuracy. The scale frontier that might still hold value is context-BEYOND
  (hundreds of constraints, a spec too big to hold) — not constructible cheaply, and my 14-constraint
  attempt both saturated and exposed my own fixture's naivety.
- No re-run: v4 can't check compound APR regardless of fixture, so a corrected fixture wouldn't change
  the conclusion. Note V-new backlog: v4 has no way to express/flag nonlinear constraints (should at
  least NOTE "nonlinear, not checkable" instead of silently linearising/skipping — honesty gap).

### Iteration 8 — v4: operationalize the automatic gate (analyse exit code)
- `allium analyse` now exits non-zero when a v4 spec is CONTRADICTORY / VACUOUSLY / INFEASIBLE
  (kept as warnings so the conformance score isn't lowered, but hard failures for CI and the elicit
  done-gate). Verified: contradictory spec -> exit 1, clean spec -> exit 0; 45 tests green.
- GOOD: makes v4's genuine value (an automatic, deterministic standing gate) concrete — a script or
  CI step can now gate on the exit code, which is exactly the non-accuracy differentiator the
  saturation finding pointed to. Commit: allium-tools.
- (Scale probe still finishing at collection time; collect next wake.)

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
