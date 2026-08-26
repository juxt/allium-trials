# Trial A result — elicit → build quality (ledger)

**Run 1 (2026-08-26, `claude-sonnet-4-6`): Allium 18/21 (86%), baseline 21/21 (100%).**
On its face the Allium path underperformed direct building. The detail matters.

## What actually happened

All three Allium-arm failures are ERRORS, not assertion failures — the tests could
not run because the Allium-built `Ledger` is missing a `total()` accessor. The three
are `test_total_is_sum_of_balances`, `test_transfer_conserves_total`,
`test_many_transfers_conserve_and_stay_nonnegative`, all of which call `total()`.

The behaviour was fine. The elicited spec captured conservation correctly, as
`@guarantee ConservationOfValue`, and the built `transfer` enforces same-account
rejection, insufficient-funds, and atomicity. The spec expressed conservation as an
invariant (the right abstraction — it is a property, not an API), so the build never
exposed a `total()` method. The baseline, reading the prose "totals" in the brief,
happened to add `total()`.

## The finding (and it is about the harness, not just Allium)

The gap is an **API-surface artifact plus a fairness hole**: neither arm was told the
method contract the hidden suite calls, and the suite couples a property (conservation)
to a specific method (`total()`). So the 3-test gap reflects whether `total()` got
implemented — nearly a coin-flip on API naming — not a real behavioural quality
difference. A naive "Allium 86% < baseline 100%" headline would mislead.

This is the evaluation doing its job: it surfaced a subtle measurement flaw. The fix,
applied to `trial-a.mjs`: give BOTH build arms the same explicit method contract, so the
comparison isolates behavioural correctness (invariants, failure modes) from API guesswork.
A fair re-run follows.

## Caveats

v3 skills, one run, one model, a tiny system, and a batch-brief approximation of the
interactive operator. This is a first datapoint and a harness lesson, not a verdict.
