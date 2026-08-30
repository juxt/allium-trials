
## Iteration 1 — Phase 2 (spec correctness) — CONFIDENCE IS BUILDABLE by checking the spec against code
LLM-distilled a schedule spec from INFORMAL human guidance ("standard amortising loan, equal
instalments, interest on the balance, pays to zero"). Verified against the real 151-trace corpus.

- **2a FAITHFULNESS (monitor the spec against real code).** SPEC_LLM's `level_payment` (every period's
  EMI equal — it took "equal instalments" literally) FAILS on real multi-period traces, residual 0.04,
  because the real last instalment differs. The gold's `emi_constant` (excludes the last period) holds.
  => Monitoring an LLM spec against real outputs AUTOMATICALLY surfaces over-claims with exact residuals.
  Also: SPEC_LLM's `interest_on_balance` used a `given rate` absent from traces, so the monitor SKIPPED
  it silently — an unfaithful-and-unchecked invariant, itself a caution (unmonitorable invariants give
  false comfort).
- **2b COMPLETENESS (mutation-detection battery, 8 kinds x 12 traces, trace-level, no gradle).**
  Detection: **SPEC_LLM 63% (60/96) vs SPEC_GOLD 88% (84/96).** LLM BLIND SPOTS (gold 100%, LLM 0%):
  `rollforward_break` and `monotonic_break` — the inter-period balance link the informal guidance never
  stated and the LLM never inferred. Both specs miss `subtle_rounding` (0.003, within monitor tol) — an
  honest shared limit.
- **=> GATE 2 outcome (positive & actionable): an LLM spec from informal guidance IS incomplete (63%)
  and CAN be unfaithful (level_payment), BUT both failure modes are AUTOMATICALLY DETECTABLE by checking
  the spec against the code — monitor for faithfulness (over-claims), mutation-battery for completeness
  (blind spots). This is objective, needs no trust in the LLM, and is uniquely enabled by a CHECKABLE
  spec (a prose spec can be neither monitored nor mutation-tested).**
- Unifies with Phase 1: the completeness blind-spot map IS the tunnel-vision scope. Measuring where the
  spec is blind tells you exactly where not to over-trust it. Completeness measurement mitigates
  overconfidence. Bug caught this iteration: monitor-schedule exits non-zero on failure, so the harness
  must read stdout from the thrown error (first run showed a false 0% for all — fixed, verified).

## Iteration 2 — Phase 3 (specs -> tests / PBT) feasibility + faithfulness at scale
- Pipeline CONFIRMED: `./gradlew :fineract-progressive-loan:test --tests ProgressiveEMITraceHarness`
  regenerates 151 traces from the REAL ProgressiveEMICalculator (~1.5s test, <2min gradle). So I can
  mutate the real calculator, regenerate, and monitor the spec.
- FAITHFULNESS AT SCALE: the gold spec holds on **150/150** freshly-generated real traces. The spec is
  a true relational property of the real code across the 5x5x6 input grid.
- Mutant M1 (wrong interest rate, 1% low) in flight: predicted to keep the schedule INTERNALLY
  CONSISTENT (EMI recomputed from the wrong rate), so all structural invariants (conservation, balance
  roll, close, monotonic, principal-split, emi-constant) should still HOLD -> spec-oracle MISSES it;
  the shipped fixed-value test should CATCH it. If so: spec invariants and value-oracle tests are
  COMPLEMENTARY (relational vs absolute), not substitutes — a key refinement of the PBT claim.

## Iteration 3 — Phase 3 mutant M1 (wrong rate) — SPEC MISSES, shipped test CATCHES (complementarity, verified)
- Real-code mutant: interest rate 1% low in ProgressiveEMICalculator. Regenerated 150 traces, monitored
  gold spec, ran shipped ProgressiveEMICalculatorTest. Reverted cleanly.
- **SPEC-ORACLE: 0/150 traces flagged — MISSES the bug entirely.** The schedule stays internally
  consistent (EMI recomputed from the wrong rate), so every STRUCTURAL invariant still holds; the only
  invariant that could catch it (interest = rate x balance) is not monitorable from the trace.
- **SHIPPED FIXED-VALUE TEST: FAILED — CATCHES it** (exact expected numbers differ).
- **=> GATE 3 outcome: specs improve tests by supplying RELATIONAL properties checkable over the WHOLE
  input space (150 real schedules), catching structural corruption that a single-example fixed test
  misses (Phase 2b 88%, faithful 150/150). But they do NOT replace ABSOLUTE/golden oracles: a value
  error that keeps the structure consistent (wrong rate) slips straight through. Spec-PBT and
  value-oracle tests are COMPLEMENTARY confidence sources, not substitutes.**
- Refines the PBT claim honestly: a spec solves HALF the property-test oracle problem (the relational
  half, which is the hard-to-hand-write half and the broad-coverage half). The absolute half still needs
  a reference implementation or golden values. Strongest suite = spec invariants + reference oracle +
  model-checking = three independent confidence sources, each covering what the others miss.
