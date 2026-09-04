# fineract-amortization result — the ladder INVERTED (an honest, important finding)

Distil → hide → reconstruct → differential vs 102 real Fineract golden values. N=4 per arm.

| arm | fidelity |
|---|---|
| prose | **100%** |
| V3 | 97.1% |
| V4 | **86%** |

Prose won; V4 last; the order is MONOTONIC IN ABSTRACTION (prose most detailed → V4 most abstract).

## Why (not noise — a real effect)

`TvmFunctions.rate` is a NUMERICAL ALGORITHM: its golden behaviour (exact convergence, edge cases,
last-digit rounding) *is* the algorithm. Prose can describe an algorithm in near-pseudocode detail, so
reconstruction is near-lossless. Allium is DECLARATIVE — it abstracts to what-must-be-true ("rate solves
the PV equation"), which any correct solver satisfies, not Fineract's specific one. The reconstructor
rederives a mathematically-correct but numerically-different solver that misses ~15% of golden cases (the
edge/precision ones the abstraction did not pin). More abstraction → more of the algorithm discarded →
prose > V3 > V4.

## Two findings, both bigger than the number

1. **Wrong kind of code.** Allium is a BEHAVIOURAL spec language; its value is declarative behavioural
   obligations (state machines, invariants, business rules, lifecycles), not imperative numerical recipes
   where the behaviour *is* the algorithm. A solver is the worst case: nothing to abstract but the answer.
   Right Fineract targets: loan state machine, charge applicability, transaction validation, suitability —
   rules over state.
2. **Wrong instrument for Allium's value.** Reconstruction-fidelity rewards TRANSCRIPTION COMPLETENESS,
   which prose (approaching verbatim code) maximises; Allium abstracts on purpose. A "reproduce every
   digit" round-trip structurally favours the least abstract representation. This is a real limitation of
   the instrument, not a knock on the run.

## Recalibration
- Target BEHAVIOURAL Fineract modules (rules/state/lifecycle), not calculators.
- Score behavioural correctness (right transitions / right rule applied / invariant held), not numerical
  last-digit match. The differential-vs-real-golden harness still applies; the golden is behavioural
  outcomes, not floats.
- Keep this task as the honest boundary case: it marks where Allium does NOT help (pure algorithms) and
  where the reconstruction instrument breaks down.
