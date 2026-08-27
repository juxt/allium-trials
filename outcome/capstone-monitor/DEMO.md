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

## Use 2 — the running build (`gateway.py`)

`gateway.py` is a small reporting gateway: it processes trades into reports and drives
their lifecycle. Its `emit` adapter is the one integration point — it projects each
report's state onto the spec's predicates and writes a trace line. So the running code is
observed through the same vocabulary the spec is written in. The gateway ships a bespoke
collateral feature (the one the design-time check rejected) and a late-correction path that
can reject an already-accepted report.

Running it emits `live.trace` (8 events across R1–R4).

## Use 3 — runtime monitor of the running code (`allium monitor spec live.trace`)

    {"events":8,"violations":[
      {"t":"5","entity":"R3","invariant":"code_when_collateralised","kind":"point",
       "witness":"collateralised=T, has_collateral_code=F"},
      {"t":"8","entity":"R4","invariant":"once_accepted_stays","kind":"temporal",
       "witness":"old accepted=T, rejected=T"}
    ],"ok":false}          exit code 1

The monitor, derived from the spec, catches two violations in the gateway's actual output,
each with a focused witness:

- **R3, point**: the bespoke report. This is the exact case the design-time feasibility
  check flagged as INFEASIBLE. One property, caught at both stages — design time said such
  a report can never be accepted; the runtime monitor catches the build emitting one.
- **R4, temporal**: the late-correction path rejected a report that had been accepted. This
  violation exists in no single state; it is only visible across states, via
  `old(accepted(r))`. "Once accepted, never rejected" is the runtime modality of the spec,
  the fault meaning over a trace, not something a point assertion expresses.

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

## The reproducible gate (`gate.sh`)

The value axis is not one clever pass; it is the same checks on every build, deterministic,
no judgement calls. `gate.sh` runs both stages and exits non-zero if either finds a problem:

    == Stage 1: design-time (allium analyse) ==
      FAIL — design defect:
        - requirement `bespoke_report` ... is INFEASIBLE ... Blocked by: collateral_needs_code, bespoke_has_no_code
    == Stage 2: runtime (allium monitor over the build's trace) ==
      FAIL — 2 runtime violation(s):
        - t=5 R3 code_when_collateralised (point): collateralised=T, has_collateral_code=F
        - t=8 R4 once_accepted_stays (temporal): old accepted=T, rejected=T
    GATE: FAIL

This is what a checker gives that a strong model's one-off review does not: a total,
deterministic, reproducible verdict with provenance, cheap enough to run on every commit.

## Honesty (soundness of the monitor itself)

The whole value rests on the verdict being trustworthy, so the monitor never evaluates an
invariant it cannot faithfully compute. Quantified, relational, or value-comparison
invariants are reported under `skipped` with a reason, not silently mis-evaluated. The
report carries `monitored` and `skipped` counts so a green result is never a hidden gap.
