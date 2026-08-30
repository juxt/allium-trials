
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
