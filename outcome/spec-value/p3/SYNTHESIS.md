# Programme 3 synthesis — strengthening, honest pruning, and the benefit we can stand behind

Method: big-n where cheap, MECHANICAL metrics only (monitor holds/fails, JUnit pass/fail — no model
judge, after model judges misfired repeatedly in P1/P2), on REAL code. Weaknesses of P1/P2 attacked
head-on (small n, model-judge reliance, within-context, battery-dependent numbers).

## THE LAW (confident, big-n, mechanical, BOTH code types): DESYNC caught, consistent-VALUE blind

A behavioural spec checks RELATIONAL invariants (things that must hold BETWEEN quantities). So it
catches a bug iff the bug BREAKS a relation; it is blind to bugs that change values while keeping all
relations intact. One law, confirmed on both code types, mechanically, at big n:

| evidence | class | detection |
|---|---|---|
| E3 (schedule, injected)      | structural break                  | 600/600 = 100% (CI 99-100%) |
| E5 (accounting, real traces) | DESYNC (omit/dup/mismatch a leg)  | 60/60 = 100% (CI 94-100%) |
| E4 (accounting, REAL CODE)   | omit credit legs                  | 4/7 cash traces (exact residuals 340/1000/300/300) |
| E5 (accounting, real traces) | consistent VALUE (scale all legs) | 0/30 = 0% (CI 0-11%) |
| E2 (calculator, REAL CODE)   | consistent VALUE (arithmetic mutants) | 0/20 (shipped fixed-value tests caught 18/20) |

Whether a spec-gate adds regression value is decided by a domain's CHARACTERISTIC bug type: double-
entry / ledger / allocation / reconciliation code, where bugs are omitted or mismatched parts (DESYNC)
-> high value; solver / derivation code, where bugs are wrong arithmetic the code makes self-consistent
(consistent-VALUE) -> ~zero value (only golden/fixed-value tests catch those).

QUALIFIER (see E7): "consistent-VALUE blind" holds for a spec written with RELATIONS BETWEEN OUTPUTS
only. The general statement is: **a spec catches a bug iff the bug breaks a relation the spec STATES.**
Enrich the stated relations — add ABSOLUTE invariants that tie an output to a reference INPUT
(interest = rate x balance), and emit that input into the trace — and the monitor catches the
"consistent-VALUE" bugs too (E7 catches the wrong-rate mutant, resid 10). So the solver-side zero is
not a fundamental ceiling; it is what a relations-only spec + rate-less traces achieve. The fix is a
design choice (input-anchored absolutes) plus a fixable data deficiency (D3: emit reference inputs).

## The same law, seen as bug morphology on each code type

### Solver / derivation code (the loan calculator) — spec-gate value ~= ZERO  [E2, strong]
- 20 real-code mutants of ProgressiveEMICalculator (multiply->subtract/add across 9 sites x2, setScale
  x2). MECHANICAL cross-tab: **spec caught 0/20; the shipped fixed-value tests caught 18/20** (the 2
  neither caught were within-tolerance setScale changes).
- Mechanism (why, not just what): the amortisation solver RE-DERIVES a fully self-consistent schedule
  from whatever (mutated) arithmetic it is given, so an arithmetic bug produces an
  internally-consistent-but-wrong schedule. Every relational invariant (principal-split, roll-forward,
  conservation, close, monotonicity, emi-constancy) still holds; only the ABSOLUTE VALUES are wrong.
  The relational spec is blind by construction. E3 confirms the spec WOULD catch a structural break
  (600/600 = 100%, 95% CI 99-100% on injected structural mutations) — but arithmetic mutation of solver
  code never PRODUCES one (0/20).

### Structure-assembling code (double-entry accounting) — spec-gate CATCHES  [E4, real code]
- The double-entry spec (sum debit = sum credit) is faithful on the real baseline legs (balanced,
  residual 0). A real-code mutant that OMITS credit legs in the charge-off posting path:
  **double-entry spec FLAGGED 4/7 cash traces (residuals 340, 1000, 300, 300.005 — deterministic, exact) mutant traces as unbalanced.**  (3 held: refund/transfer/write-off emit credits via a different primitive than the guarded createCreditJournalEntryForLoan, so the mutation did not reach them; the 4 on the guarded path were caught with exact residuals.)
- Here independently-computed parts (debit legs, credit legs) must jointly satisfy a cross-cutting
  invariant that the code does NOT enforce on the loan path (P1 finding). An omission/duplication
  changes one side's sum, breaking the relation by arithmetic necessity -> the spec catches it, and a
  local per-leg test would not.

## => The benefit we can stand behind (precisely scoped, mechanical, real-code)
**A behavioural spec-gate adds regression coverage for code that ASSEMBLES independently-computed
parts which must jointly satisfy a cross-cutting invariant (double-entry, conservation across legs,
allocation totals) — catching omission/desync bugs that local and even fixed-value tests miss. It adds
~nothing for solver/derivation code that enforces its invariants by construction, where real bugs are
consistent VALUE errors that only golden/fixed-value tests catch.** Specs and golden-value tests are
complementary; the spec is the workhorse exactly where a cross-cutting invariant spans parts, and a
bystander where one derivation computes everything.

## Pruned / disconfirmed (kept honest)
- "Spec as a general bug-catching regression gate": FALSE for value bugs / solver code (E2 0/20). Do
  not sell it. This retires the strongest over-claim.
- Completeness "63% vs 88%": battery-dependent; report a detection PROFILE (structural ~100%, value
  ~0), not an absolute percentage. My E3 uniform-scale value operator was itself confounded by rounding
  and discarded.
- Model-judge-dependent results (P1/P2 review deltas): secondary; only mechanical results are load-bearing.

## Surviving confident benefits (all three programmes)
1. SURFACING the human's decisions (P1) — the largest unique benefit; it is the act of specifying.
2. The spec as a VALIDATABLE artefact (P2) — monitor catches faithfulness over-claims that review
   against vague intent misses (mechanical); mutation profiles what it covers. Confidence via
   validation-against-code, not authorship.
3. Spec-gate for STRUCTURE-ASSEMBLING code (P3) — scoped, mechanical, real.
4. Determinism / auditability / certifiability of the checkable core.
Not from catch-rate: accuracy saturates everywhere (P1, even ~1M LOC).

## What stays uncertain (do not over-read)
- E4 is n=1 accounting mutant (arithmetically guaranteed, but empirically light) — a big-n real-code
  accounting mutation suite is the clean next step.
- E2 is ONE solver; the solver-blind generalisation rests on the mechanism, not a 2nd solver.
- Beyond-context: the calculator (2204 lines) fits a context window; the "beyond-context" value is that
  the spec+validation give mechanical confidence about code embedded in ~985k LOC you could not read.
  Genuine >context-window big-n mutation of the full accounting subsystem is the remaining frontier.

## Recommendations
1. Pitch the spec-gate ONLY for cross-cutting-invariant / structure-assembling domains (ledgers,
   double-entry, allocation, conservation, reconciliation) — the places it demonstrably adds coverage.
2. Always pair specs with golden/fixed-value tests (relational + absolute).
3. Next: big-n real-code accounting mutation suite; a second solver to confirm solver-blindness;
   genuine beyond-context (full-subsystem) mutation at scale.

## E7 — the value-blindness is largely FIXABLE (constructive, demonstrated)
E2's spec missed value bugs because its traces omitted the reference input (rate), so the one ABSOLUTE
invariant (interest = rate x outstanding) was SILENTLY SKIPPED (deficiency D3). Fix it — put the
reference rate in the trace, keep the absolute invariant — and the monitor CATCHES the canonical
wrong-rate value bug that every structural invariant misses:
- correct schedule -> all 7 invariants hold.
- wrong-rate consistent value bug (E2's exact missed class) -> structural invariants all hold, but
  interest_on_outstanding FAILS, resid 10.0. CAUGHT.
The monitor evaluates rate x outstanding on concrete values with no trouble; the nonlinear limit is
only for STATIC analyse, not runtime monitoring. So the DESIGN LESSON and the fix:
**a spec-gate catches value bugs iff it (a) includes ABSOLUTE invariants tying outputs to reference
INPUTS (not only inter-output relations) and (b) the traces carry those inputs.** A relations-only
spec is value-blind (E2/E5); add input-anchored absolutes + emit the inputs, and value bugs become
catchable. This upgrades the earlier "complementary only" conclusion: the gate CAN cover value bugs
where the absolute law is computable and the reference inputs are known (e.g. contracted rate).
Residual fundamental limit: bugs where the checked output re-derives consistently from a WRONG value
that is ALSO not pinned by any reference (need a fuller golden oracle).

## BOTTOM LINE (Programme 3)
1. CONFIDENT LAW (big-n, mechanical, real code, both code types): a spec catches a bug iff the bug
   breaks a relation the spec STATES. Relation-breaking (DESYNC) bugs: ~100% caught (E3 600/600, E5
   60/60, E4 real code 4/7 exact). Consistent-VALUE bugs against a relations-only spec: ~0% (E2 0/20,
   E5 0/30).
2. SCOPE the benefit honestly: the spec-gate is a real, added regression layer for STRUCTURE-ASSEMBLING
   / cross-cutting-invariant code (double-entry, ledger, allocation, reconciliation). It is a bystander
   for SOLVER code unless you enrich the spec.
3. The value-blindness is largely FIXABLE, demonstrated (E7): add input-anchored ABSOLUTE invariants
   and emit the reference inputs into traces; the monitor then catches value bugs (wrong-rate, resid
   10) that structural invariants miss. Runtime monitoring handles the arithmetic; only STATIC analyse
   hits the nonlinear limit.
4. Retired over-claim: "spec as a general bug-catching regression gate" is FALSE as stated (E2 0/20 on
   solver value bugs). Sell the scoped version + pair with golden/fixed-value tests.
5. Solver deficiencies -> improvements (SOLVER-DEFICIENCIES.md): D1 reference/absolute-oracle
   capability (highest value; closes value-blindness; prior art TLA+ refinement / model-based testing),
   D2 per-invariant tolerance (default 0.005 unsafe for exact double-entry; E6), D3 emit reference
   inputs + never silently skip (E7 shows this converts value-blind to value-catching), D4 vacuity/
   coverage, D5 coverage-guided traces, D6 standard mutation operators. All fixable; several have prior art.
6. Uncertain / next: real-code E7 (needs the model's rate-factor accessor); big-n real-code accounting
   mutation suite; a 2nd solver to confirm solver-blindness; genuine >context-window full-subsystem
   mutation. The desync-gate is scale-FREE by construction (it checks output traces, not code), so it
   is the one confident benefit that extends to beyond-context codebases unchanged.
