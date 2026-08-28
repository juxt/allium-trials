# Dual-syntax distil-at-scale — the first real signal, and it separates v3 from v4

## Setup

Both versions distilled the SAME real code — Fineract's 2204-line ProgressiveEMICalculator —
in ISOLATION (each arm read only its own distil skill + language reference), the v4 arm
looping the CLI (allium check/analyse). An external judge scored each spec against the 7
reference invariants (LoanScheduleInvariants.allium) on completeness and elegance.

## Result

    spec         lines   check errors   OPEN lines   completeness   elegance
    v3           268     0              0            9/10           8/10
    v4           107     0              7            3/10           6/10

Non-saturated, and it cleanly separates the two: on real arithmetic-heavy loan logic v3 is
far more complete. Both looped to a clean check; the difference is what each language can say.

## Where v4 falls short (the findings that matter for growing v4)

1. **The arithmetic tier (expected, large).** Four of seven invariants — interest-on-
   outstanding, principal = EMI − interest, balance roll-forward, principal conservation — are
   arithmetic. v4's predicate language has no numeric operators, so the distil honestly parked
   them as OPEN. v3 states them as direct equalities. The design admits linear integer
   arithmetic (NON-GOALS scope line); neither the analyse prototype nor the v4 language
   reference has reached it. This is the big, separate lift.

2. **A per-period-state modelling omission (unexpected, sharp, cheap to fix).** v4 modelled
   only schedule-level totals, no `outstanding_start(Period)` observable — so it missed
   balance-monotonicity, which is PURE ORDERING with no arithmetic and fully expressible in
   the fragment v4 already has. v4 lost a structural invariant it could have kept. Adding a
   per-period balance observable + an ordering predicate recovers it immediately. Part guidance
   (the thin v4 reference doesn't steer toward per-period state), part the distil process.

3. **Two concrete warts.** No Money zero literal (the spec had to declare `zero(Schedule) :
   Money` as an observable); and `<=` surrogates where the domain wants `=` (a weaker
   statement forced by the missing arithmetic).

## Reading

This is exactly what the scale phase was meant to produce and the synthetic probes could not:
a real, non-saturated separation of v3 and v4, and a precise, prioritised list of what v4
must gain to handle real financial logic — the arithmetic tier (big), a per-period-state
modelling habit and a Money literal (small). v3's maturity shows; v4's gaps are now concrete
and evidenced against real code, not asserted.

Method note: the v4 arm was grounded in the 70-line v4 language reference, which documents the
boolean-SAT prototype, not the fuller design (LIA). So "v4 can't express arithmetic" is partly
that the reference/prototype trail the design — itself a finding: the v4 reference must catch
up to the intended arithmetic tier.
