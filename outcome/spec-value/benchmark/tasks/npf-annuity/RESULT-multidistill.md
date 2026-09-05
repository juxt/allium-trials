# npf multi-distillation — the v4>v3 hint was DISTILLATION ARTIFACT (v3≈v4 confirmed)

Distil K=3 INDEPENDENT specs per arm, port 2x each, sonnet. Reliability = fraction that got the pmt
sign/when convention.

| arm | reliability | note |
|---|---|---|
| v3 | 5/6 (83%) | one weak distillation missed; the other two nailed it |
| v4 | 6/6 (100%) | all three distillations carried the convention |

**Verdict:** the earlier npf "v4 > v3" (single-distillation: v3 4/10 vs v4 9/10) was LARGELY an artifact of
one weak v3 distillation. Across 3 independent distillations v3 recovers to 5/6, essentially matching v4's
6/6 — the residual is a single run, within noise. So **V3 ≈ V4 on code output holds**, and the one apparent
counterexample dissolves once distillation variance is controlled.

**Methodological lesson (applies to the whole matrix):** with specs distilled once, a v3-vs-v4 difference
can be single-artifact luck. Where all arms saturate (mathutil, loan-status, charge-calc) it doesn't matter.
Where they diverge, multiple distillations are required to attribute the gap to the LANGUAGE vs the ARTIFACT.
Here, doing so removed the divergence.
