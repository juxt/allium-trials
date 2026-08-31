# "Why not just write tests?" — the skeptic's first objection, made executable

The value prop rests on the executable gate. The obvious retort: a hand-written test suite is also
executable. This experiment answers it with mechanical numbers (no model judge), on the same real
Fineract oracle and 137 real input rows (13 large-balance rows dropped as an orthogonal tolerance-at-
scale limit — see below). Three regression mechanisms, one mutation battery of developer edits to a
correct build:

- **A. property tests** — hand-written assertions of the structural laws (conservation, closes-to-zero,
  principal = emi − interest, balance rolls forward).
- **B. oracle test** — re-implement `schedule()` and assert the build matches it (the strongest test).
- **C. v4 spec-gate** — `allium monitor-schedule` of the same LoanSchedule invariants.

## Result

| developer edit to a correct build | property | oracle test | v4 spec-gate |
|-----------------------------------|:--------:|:-----------:|:------------:|
| rate inflated 1.2× (value)        |  0/137   |   107/137   |   **107/137**|
| flat not declining (value)        |  0/137   |    89/137   |   ** 89/137**|
| final doesn't close (structural)  | 114/137  |   114/137   |    114/137   |
| principal split off (structural)  | 137/137  |   137/137   |    137/137   |
| benign refactor (control)         |  0/137   |     0/137   |      0/137   |

Read it honestly, top to bottom:

1. **The v4 gate equals the oracle test, row for row, on every mutation.** As a pure *detector*, a
   declarative spec is exactly as strong as a correctly re-implemented oracle — no stronger. We should
   not claim otherwise.
2. **Both beat structural/property tests on value bugs** (0 vs 89–107). A test suite that asserts only
   structure misses value drift entirely — the P3 desync lesson, now shown against hand-written tests.
3. **Value bugs aren't caught on every row** (107/137, 89/137). Small-magnitude deviations fall under
   the 2dp tolerance for the oracle test *and* the spec alike. A fundamental limit of penny-tolerance,
   not a spec weakness — and identical for both mechanisms.
4. **Zero false positives** for all three on the benign refactor.

So detection power alone does not separate a spec from a *correct* oracle test. The separation is elsewhere.

## The anchor — where a spec pulls ahead of any hand-written test

A test encodes the author's **belief** about correct behaviour. A spec's faithfulness is checked against
the real system's **recorded traces** — by construction, because `allium monitor-schedule spec
real_traces` is the authoring gate: a spec that contradicts reality fails to hold and you know it before
you trust it.

Scenario: a developer who *believes* flat interest is correct ships a flat-interest build **and** writes
the oracle test to match that belief (a shared misconception — the common case behind real defects).

| mechanism                                    | catches the shipped-wrong build |
|----------------------------------------------|:-------------------------------:|
| property tests (structure only)              |             0/137               |
| oracle test (author-written, shares belief)  |             0/137               |
| v4 spec-gate (faithful to real traces)       |          **89/137**             |

The oracle test passes — false confidence — because it re-implements the same wrong belief. The spec
fires, because `interest = rate_factor × outstanding` cannot hold faithfulness against the real
declining-balance traces *and* pass on a flat-interest build.

Be precise about the claim. A diligent golden-master test, replayed against real captured output, could
anchor to reality too. The spec's edge is not that tests *cannot* anchor; it is that a spec:

- **anchors by construction** — faithfulness against real traces is the tool's authoring gate, not a
  discipline you must remember; and golden-master expectations are exactly the ones teams quietly update
  to match new (buggy) output.
- **is one declarative statement covering all 137 rows** — no per-case expected values, and no second
  implementation of the oracle to maintain and let drift. The oracle test *is* a second copy of the code.
- **is auditable by a non-programmer** — a regulator reads `interest = rate_factor × outstanding`, not a
  `pytest` re-implementation with its own control flow.

## The honest value-prop line for "why not just tests?"

A v4 spec is *as strong a detector as a correct oracle test, and strictly stronger than structural
tests on value bugs* — but that is not the reason to prefer it. The reasons are the anchor (validated
against the real system by construction, so it can't silently encode a wrong belief), declarativeness
(one statement, all cases, no second implementation to drift), and auditability. Where a test suite
already golden-masters against real traces and is read only by engineers, the gap narrows to
declarativeness and audit — real, but smaller. State it that way; don't oversell detection power.

## Coda: `check` is not faithfulness — the monitor is the semantic net

A well-formedness pass (`allium check`) is necessary but not sufficient. Two roll-forward invariants,
both zero-error under `check`:

```
right: every p :: every q :: follows(q, p) implies outstanding_start(q) = outstanding_start(p) - principal(p)
wrong: every p :: every q ::                    outstanding_start(q) = outstanding_start(p) - principal(p)
```

The second drops the ordering guard and asserts the roll between *every pair* of periods — an
over-constraint. Both parse. Run against a real multi-period trace with `monitor-schedule`: the guarded
one HOLDS, the free-pair one FIRES. The faithfulness check against real traces catches a modelling error
the parser passes.

Put beside the anchor result, this is the whole point: the workhorse is not the parse, it is the
mechanical comparison of the spec against the real system's recorded behaviour. That is what catches a
wrong convention (a wrong belief) *and* a wrong quantifier structure (a modelling slip). A test suite has
`check`'s equivalent (it compiles); it has no built-in equivalent of the faithfulness net.

## Reproduce

```
python3 harness.py    # prints the matrix + anchor + faithfulness; writes result.json
```

Tolerance-at-scale note: 13 of 150 rows (all `disbursed ≈ 1e6` or the 6dp-rate `r5` family) are dropped
because a 2dp absolute invariant `interest = rate_factor × outstanding` can't hold when the rounded 6dp
rate times a ~1e6 balance leaves a residual > 0.01. This is the documented limit of absolute invariants
at large magnitudes (tolerance should scale with the operands), and it applies equally to the oracle
test — it is orthogonal to spec-vs-test.
