# One spec, three uses — the monitor is derived, not hand-written

`ReportLifecycle.allium` is a single artifact. The same file is verified at design time,
is the contract the build satisfies, and is compiled into the runtime monitor. Nothing is
hand-transcribed between the three, so they cannot drift.

## Use 1 — design time (`allium analyse`)

    rule set in `ReportLifecycle` is jointly satisfiable ...
    requirement `cleared_report`  is feasible under the contract ...
    requirement `bespoke_report`  is INFEASIBLE: blocked by collateral_needs_code, bespoke_has_no_code

The feasibility check catches a design bug before any code exists: the system declares it
will emit bespoke-collateral reports, but no acceptable report can be bespoke — a bespoke
schedule is a collateralisation (so it needs a portfolio code) yet a bespoke schedule
forbids that code. Two rules, no single one at fault; the blocking core names both.

## Use 2 — the build's contract

The reporting system is built to emit reports satisfying the same rules. The design-time
check above is exactly what would have stopped the R2 defect below at build time: a
collateralised report with no portfolio code is precisely what `collateral_needs_code`
forbids. The spec is the one place that rule lives.

## Use 3 — runtime monitor (`allium monitor spec stream.trace`)

    {"events":7,"violations":[
      {"t":"1","entity":"R2","invariant":"code_when_collateralised","kind":"point",   ...},
      {"t":"2","entity":"R3","invariant":"once_accepted_stays",     "kind":"temporal",...}
    ],"ok":false}          exit code 1

Over the live report stream the monitor catches two violations, with provenance (entity,
tick, invariant, offending state):

- **R2, point**: a report that is collateralised but carries no code. This is the same
  rule the design-time feasibility check used, now enforced on real data.
- **R3, temporal**: a report accepted at t=1 and rejected at t=2. This violation does not
  exist in any single state; it is only visible across states, via `old(accepted(r))`.
  A past-temporal property like "once accepted, never rejected" is the runtime modality of
  the spec — the fault meaning over a trace — not something a point assertion expresses.

The monitor exits non-zero on a violation, so it composes in a pipeline or CI.

## Why this is the differentiated value

The six trials showed that a strong model, on a well-specified task, matches the sound
checker on catch-rate. So the value is not out-thinking the model; it is the guarantee and
the artifact. This demo is that value made concrete:

- **One source of truth.** `collateralised(r) implies has_collateral_code(r)` appears once.
  It is the design-time acceptance rule *and* the runtime invariant. A hand-written monitor
  is a second copy that drifts; a model reviewing the code produces no reusable artifact at
  all.
- **Temporal properties.** Monotonicity and non-regression are the monitorable core that a
  scattered set of asserts cannot keep correct as the system changes.
- **Provenance and reproducibility.** Every violation names its entity, tick, and the exact
  invariant, deterministically, on every run — an audit trail, not a judgement call.

Design-time verify, build, runtime monitor: one artifact, three uses, mechanically.
