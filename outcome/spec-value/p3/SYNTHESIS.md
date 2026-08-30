# Programme 3 synthesis — strengthening, honest pruning, and the benefit we can stand behind

Method: big-n where cheap, MECHANICAL metrics only (monitor holds/fails, JUnit pass/fail — no model
judge, after model judges misfired repeatedly in P1/P2), on REAL code. Weaknesses of P1/P2 attacked
head-on (small n, model-judge reliance, within-context, battery-dependent numbers).

## The confident finding: the spec-gate's regression value is SCOPED BY BUG MORPHOLOGY

A behavioural spec checks RELATIONAL invariants (things that must hold BETWEEN quantities). Whether
that catches a regression depends on whether the bug breaks a relation or preserves it:

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
