# Benchmark tasks — slug registry

Each task has a short slug for results tables. Type ∈ {greenfield, distill, feature, update}.
The gotcha is the authentic failure mode the oracle scores; it is NOT stated in the requirements.

| slug | type | domain | gotcha (authentic failure mode) | status |
|---|---|---|---|---|
| `payment-allocation` | gate/anti-vacuity | Fineract default alloc order | a vacuous allocator (allocates nothing) is SAFE but useless; does the V4 anti-vacuity objective make the catch reliable where V3 (safety-only) misses it? Replicates p7 on real domain | running |
| `loop-guard` | gate/liveness | Fineract LoopGuard | the max-iterations termination guard is load-bearing; does each arm's generated test suite CATCH a version with the guard removed? (V4 objective = liveness test; V3 no construct) | running |
| `loan-status` | reconstruct/behavioural | Fineract loan lifecycle | isClosed quirk | **SATURATED** (prose=V3=V4=100%, all got the quirk). 6th data point: reconstruction-fidelity retired — cannot favour a declarative language |
| `mathutil-port` | port/MATRIX | Fineract MathUtil | reconstruct 20 numeric utils from spec; non-obvious null/clamp semantics; 980 graded golden; 4 arms x 2 models | running (first matrix task) |
| `fineract-amortization` | reconstruct/real | Fineract TVM math | fidelity of a spec-reconstructed `rate()` solver vs real Fineract golden values (differential) | **DONE — INVERTED**: prose 100 / V3 97 / V4 86. Numerical algorithm = wrong code for a declarative language; reconstruction-fidelity favours transcription. Boundary case: where Allium does NOT help |
| `legacy-terminate` | legacy/objective | worklist drain | termination via max_ops budget | **SATURATED** (all arms 100%) — max_ops was a required signature parameter, too legible; every arm kept and used it |
| `acct-fee` | feature | account / money | overdraft on an unguarded fee | **SATURATED** (all arms 100%; gotcha too obvious, base code telegraphs the guard) — harden or replace |

Planned (design in DESIGN.md): a second of each type across domains — greenfield (sorted-segment store,
metric store), distillation, and a second feature/update — chosen for a credible task + authentic gotcha.

## Task types (updated)

The strongest domain is **legacy modernisation**: refactor legacy code carrying a load-bearing but
surprising behaviour; the oracle tests it survives. Split by quirk kind:
- **safety quirk** (a boundary, rounding, null-handling depended upon) → demonstrates **prose < V3** (the
  spec captures what prose omits; V3 ≈ V4).
- **objective quirk** (a termination / drain / bounded-retry guarantee) → demonstrates **V3 < V4** (only V4
  can express AND verify the objective; V3 has no construct for it).

Planned next: `legacy-terminate` (objective quirk — a modernisation that breaks a loop's termination
guarantee; V4's objective discharge catches it, V3 cannot express it).
