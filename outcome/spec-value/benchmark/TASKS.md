# Benchmark tasks — slug registry

Each task has a short slug for results tables. Type ∈ {greenfield, distill, feature, update}.
The gotcha is the authentic failure mode the oracle scores; it is NOT stated in the requirements.

| slug | type | domain | gotcha (authentic failure mode) | status |
|---|---|---|---|---|
| `acct-fee` | feature | account / money | overdraft on an unguarded fee | **SATURATED** (all arms 100%; gotcha too obvious, base code telegraphs the guard) — harden or replace |

Planned (design in DESIGN.md): a second of each type across domains — greenfield (sorted-segment store,
metric store), distillation, and a second feature/update — chosen for a credible task + authentic gotcha.
