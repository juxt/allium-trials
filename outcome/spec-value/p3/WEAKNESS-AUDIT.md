# Programme 3 — weakness audit + big-n mechanical strengthening (90 min, END 1788115211)

## Honest critique of Programmes 1-2 (what could be chance / fallacy / irrelevant)

1. **Small n everywhere.** Almost every headline is n=1-4: B2 cost win rests on ONE hard task (T2);
   Phase 2 completeness is ONE distilled spec on ONE battery; Phase 4 is 3 reps of ONE flaw. These
   could be noise.
2. **Model-judge unreliability recurred** (B5 3/6 false-neg; Phase 1 caught_oos contradictory; Phase 4
   needed spot-reading). ANY result resting on a model judge is suspect. => Programme 3 uses MECHANICAL
   metrics only: monitor holds/fails (deterministic), JUnit pass/fail, exit codes. No model judge.
3. **"Completeness 63% vs 88%" is battery-dependent** — I chose the mutation kinds, so the number is an
   artefact of the battery, not an absolute completeness. Fix: report the DETECTION PROFILE over a
   large, systematic mutation set, and be explicit it is relative to that operator set.
4. **Within-context, small subsystem.** Phases 2-4 used the loan-schedule calculator + traces, which fit
   in a context window. The user's point stands: within-context results may not demonstrate the value.
   The genuinely beyond-context asset is the code — the spec is a ~30-line summary of code embedded in a
   ~985k-LOC repo. Programme 3 pushes to REAL-CODE mutation of that code.
5. **Phase 3 M1 (spec misses wrong-rate; shipped test catches) is n=1.** The complementarity claim needs
   a DISTRIBUTION: across many real-code mutants, how often does the spec-gate catch vs miss vs add
   coverage over the shipped tests? That is the honest, quantified version.
6. **prose ~ elicit** (Prog-1): surfacing is not Allium-specific. Not re-litigated here; flagged.

## Programme 3 plan (mechanical, bigger n, real code)
- **E1 Big-N faithfulness at scale:** generate a large trace corpus from the REAL calculator (one
  gradle run), monitor the gold spec over N>=hundreds. Mechanical. Confirms/【refutes】 the spec is a
  faithful contract at scale.
- **E2 Real-code mutation cross-tab (headline):** auto-generate many compiling mutants of the real
  calculator; per mutant run the gold-spec GATE (monitor over regenerated traces) AND the shipped JUnit
  suite. Cross-tabulate catches. Mechanical, no model judge. Answers: does the spec-gate ADD regression
  coverage over existing tests, DUPLICATE them, or MISS what they catch — with real n.
- **E3 (if time) Big-N trace-level mutation** with confidence intervals as a statistical complement.
- Honesty: report effect sizes with counts; call chance where n is small; keep only what survives.

## E3 results (big-n, mechanical, non-gradle) — STRUCTURAL detection is SOLID; value-only operator flawed
- STRUCTURAL breaks: **600/600 = 100% detected (95% CI 99-100%)** across 150 real traces x 6 operators.
  CONFIDENT: the spec-gate catches local structural regressions (broken roll-forward, monotonicity,
  conservation, principal-split, close, emi) deterministically at big n.
- VALUE-ONLY (uniform rescale): 68% — CONFOUNDED and discarded. Rounding each scaled field to 2dp makes
  sum(rounded) != rounded(sum), so the "value-only" scale accidentally violates conservation (partly
  structural). Not a clean measure. HONEST: do not use this number.
- CLEAN value-only blindness is established elsewhere, mechanically: (a) faithfulness = the spec holds
  on ALL 150 real schedules, so it cannot distinguish a correct schedule from a different wrong-but-
  internally-consistent one; (b) E2 real-code mutants that re-derive a consistent schedule (mul2sub_1:
  changed, shipped-test FAIL, spec HOLD). => the gate is blind to value errors that preserve structure.

## E2 + E4 final (real-code mutation, MECHANICAL) — the two-sided result
- E2 SOLVER (ProgressiveEMICalculator): 20 real-code mutants. spec caught **0/20**; shipped fixed-value
  tests caught 18/20 (2 within-tolerance setScale, missed by both). Spec-gate adds ZERO regression
  coverage on solver code — arithmetic bugs stay internally consistent, relational spec blind.
- E4 STRUCTURE-ASSEMBLING (CashBasedAccountingProcessorForLoan): omit credit legs (guard all
  createCreditJournalEntryForLoan). Double-entry spec caught **4/7 cash traces** (charge-off r=340,
  disbursement r=1000, repayment r=300, sub-cent-repayment r=300.005). Real code, deterministic, exact
  residuals. (3 held — those fixtures emit credits via a different primitive; first attempt was a null
  result from guarding an unexercised site — noted honestly.) Repo reverted clean after each run.
- => CONFIDENT two-sided, mechanical, real-code conclusion: the spec-gate catches omission/desync bugs
  in STRUCTURE-ASSEMBLING code (double-entry) and is BLIND to value bugs in SOLVER code. Scope the
  benefit accordingly.

## E5 (big-n, mechanical, real accounting traces) — the unifying law confirmed both sides
- DESYNC (omit/halve/duplicate one leg): 60/60 = 100% caught (95% CI 94-100%).
- consistent VALUE (scale all legs together): 0/30 = 0% caught (95% CI 0-11%).
- Same law as solver E2 (value bugs 0/20). CONFIDENT, GENERAL: the relational spec catches DESYNC
  (relation-breaking) bugs ~100% and consistent-VALUE bugs ~0%, regardless of code type. Domains whose
  characteristic bugs are desyncs (double-entry/ledger/allocation) benefit; solver domains do not.

## E6 (tolerance boundary) + solver deficiencies
- desync detection threshold = the tol setting exactly: default 0.005 misses <=0.005 desync (0/15 at
  +0.001), catches >0.005 (15/15 at +0.01); --tol 0 catches any nonzero desync (15/15 at +0.001).
  => tolerance is a SETTING not a floor; but the default 0.005 is unsafe for exact domains (D2).
- Solver deficiencies compiled in SOLVER-DEFICIENCIES.md (D1 reference-oracle = highest value; D2 per-
  invariant tolerance; D3 skipped-invariant coverage; D4 vacuity/reachability; D5 trace coverage; D6
  standard mutation operators). All fixable; several have prior art in TLA+/Alloy/model-based testing.

## E8 (real-code single-site accounting suite) — NULL / uninformative (honest)
- Guarded the first 5 individual createCredit sites in the cash processor, one at a time; ran the leg
  dumper each time. All 5: changed=no, caught=0 — those sites are NOT exercised by the dumper's 14
  fixtures (the exercised credit paths were only hit by E4's blanket guard, which caught 4/7).
- => E8 does NOT strengthen the single-site real-code claim; it only shows sites 1-5 are dead code for
  these fixtures. A proper single-site real-code suite needs a fixture->site coverage map first (more
  work than this budget). The structure-assembling catch claim therefore rests on: E4 (blanket real-code
  omit, 4/7 caught, exact residuals) + E5 (single-leg trace-level, 60/60) + E3 (structural injections,
  600/600). Not overclaimed. Repo reverted clean.

## E7-real (REAL code traces, post-hoc, no gradle) — value-blindness fix CONFIRMED on real code
- Added intended rate (annualRate/1200, from filename) as rate_factor to the real baseline traces and
  the M1 wrong-rate mutant traces (Programme 2); monitored interest_on_outstanding at tol 0.01.
- **baseline: held 114/120 (95%); M1 wrong-rate: CAUGHT 114/120 (95%).** The relations-only spec caught
  0/20 of these value bugs (E2); the input-anchored absolute invariant catches ~95% on real traces.
- ~5% baseline false-positive + ~5% M1 false-negative = day-count/rounding noise at tol 0.01 (intended
  rate diverges from the code's exact day-count factor on some fixtures, e.g. 9.99%). Fixable with the
  model's EXACT rate factor (getRateFactorPlus1) or a per-invariant tolerance (D2/D3). Not a fault.
- => CONFIRMED on real code, not just the E7 hand-demo: value-blindness is fixable by input-anchored
  absolute invariants + emitting the reference input. This is the constructive counterpart to E2.
