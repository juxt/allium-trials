# Inductive invariants — the assurance-as-accuracy residual is ~0

## What it tests

The last open question: is value #2 (deterministic assurance) ever an ACCURACY value, not
just a trust one? The sharpest place to find a confidently-wrong residual is inductive-
invariant judgement — models are known to conflate "the invariant is true" with "it is
preserved by every transition." We generate boolean transition systems + a mutex invariant,
oracle inductiveness by the deterministic step-check (SAT of I ∧ T ∧ ¬I' = a counterexample-
to-induction), and ask the model (in-head, tools disabled) for a verdict + confidence.

## Result

    sizes            correct   high-confidence-wrong   says-INDUCTIVE-but-CTI-exists
    K=6,9,12  (24)   24/24     0                       0
    K=20,30   (10)   10/10     0                       0
    total     (34)   34/34     0                       0

Balanced mix (inductive and not). The model found every counterexample-to-induction and
distinguished inductive from not-inductive every time, at ~99-100% confidence, up to 30
transitions over 14 variables. No confidently-wrong case, and in particular never the
dangerous one (asserting inductive when a CTI exists).

## Conclusion — value #2 is trust, not accuracy

Across the two hard-to-self-check property classes we could construct — consistency (24/24)
and inductiveness (34/34) — a capable model is confidently correct, at scale, with a
confidently-wrong residual of zero. Where it cannot reason a property through, it does not
confidently assert a wrong verdict; it times out or reaches for a solver (the frontier
experiment). So there is no measurable regime where the deterministic checker catches a
confident verification error the model would ship.

This settles value #2 honestly: the checker's worth is not accuracy — the model is already
right — it is the NATURE of the guarantee. A deterministic, reproducible, auditable verdict
with a witness or a counterexample-to-induction is a different kind of evidence from a
reliable model's confident claim, and in a regulated assurance context that difference is
the product, at equal accuracy.

Caveat, stated plainly: "hard to self-check" here still means checkable by a bounded SAT
step. Genuinely unbounded or higher-order verification (liveness with ranking witnesses,
quantified reasoning over infinite state) is beyond both this oracle and this experiment; if
an accuracy residual exists anywhere, it is there, and it is also where the model can least
self-tool. That is the honest remaining frontier, and it coincides with the deepest
verification v4 does not yet do.
