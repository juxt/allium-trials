# Benchmark tasks — slug registry

Each task has a short slug for results tables. Type ∈ {greenfield, distill, feature, update}.
The gotcha is the authentic failure mode the oracle scores; it is NOT stated in the requirements.

| slug | type | domain | gotcha (authentic failure mode) | status |
|---|---|---|---|---|
| `acct-fee` | feature | account / money | a fee that skips the balance check overdraws (classic overdraft bug); must preserve the existing non-negative-balance invariant | building (first slice) |

Planned (design in DESIGN.md): a second of each type across domains — greenfield (sorted-segment store,
metric store), distillation, and a second feature/update — chosen for a credible task + authentic gotcha.
