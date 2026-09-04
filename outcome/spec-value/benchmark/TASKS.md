# Benchmark tasks — slug registry

Each task has a short slug for results tables. Type ∈ {greenfield, distill, feature, update}.
The gotcha is the authentic failure mode the oracle scores; it is NOT stated in the requirements.

| slug | type | domain | gotcha (authentic failure mode) | status |
|---|---|---|---|---|
| `legacy-terminate` | legacy/objective | worklist drain | a max_ops budget is a non-obvious TERMINATION guarantee (bounds retries); a 'drain until empty' rewrite loops forever on a poison item | running |
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
