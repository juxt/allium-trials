# Parametric / EPR inductive probe — the last in-scope place for a value-#2 accuracy residual

## What it tests (and why it's in scope)

The one untested, on-plan place a deterministic checker might catch a *confident* verification
error: parametric ("for all N") inductive-invariant judgement. This is inside the decidable
spine (EPR + LIA); it reopens no decision (N6 excludes only unbounded *liveness*, not
parametric safety). The model is asked the genuinely-parametric question — is a mutual-
exclusion invariant inductive for ANY N — which it cannot settle by enumeration. The oracle
is the EPR step-check grounded over 3 processes, which for this quantifier depth is sound AND
complete for finding a counterexample-to-induction.

## Result (four guard variants, N=4 each)

    guard            oracle          model
    strong_all       INDUCTIVE       IND @92-97  (4/4 ok)
    strong_others    INDUCTIVE       IND @90-97  (4/4 ok)
    self_only        not-inductive   not @99     (4/4 ok)
    priority_want    not-inductive   not @98-99  (4/4 ok)     <- the subtle one

    16/16 correct; confidently-wrong = 0.

The model even nailed `priority_want`, the deliberately subtle guard: "no lower-numbered
process wants" looks like it enforces mutual exclusion, but it is not inductive — a
lower-numbered process can enter while a higher-numbered one is already in crit. The model
found exactly that counterexample, at ~99% confidence, every run.

## Conclusion — settled, and honestly

Across all in-scope verification classes — consistency (24/24), fixed-N inductiveness
(34/34), and now parametric all-N inductiveness including a subtle CTI (16/16) — a capable
model is confidently correct, 74/74, with a confidently-wrong residual of zero. There is no
regime inside the decidable spine where the deterministic checker catches a confident
verification error the model would otherwise ship.

So value #2 is definitively a **trust / determinism / auditability** value, not an accuracy
value, throughout the scope Allium actually targets. The checker does not make a capable
model's verdicts more correct; it makes them deterministic, reproducible, and auditable — a
different kind of evidence, which is the assurance product for a regulated buyer at equal
accuracy. The only place an accuracy residual could exist is outside scope (unbounded
liveness / ranking-witness), which N6 deliberately excludes and which we chose not to reopen.

This closes the value-#2 investigation. The positive, accuracy-bearing value is on the other
axis entirely: the elicit counterweight (fabrication 88%->0%) and distill completeness
(subtle-edge capture 80%->100%).
