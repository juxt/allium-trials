# settlement-format — the cluster is BROKEN (no-spec 17-25 vs spec ~99)

Bespoke wire-record encoder, ~12 independent non-inferable conventions, per-field graded. N=4, 2 models.

| arm | opus | sonnet |
|---|---|---|
| no-spec | 24.6 | 16.7 |
| prose | 100 | 100 |
| v3 | 99.2 | 99.2 |
| v4 | 99.2 | 99.2 |

## Findings
1. **~75-point no-spec-vs-spec gap.** No-spec can only guess natural encodings (matches the 23% naive
   baseline); every spec arm carries the bespoke conventions and nails it. The recipe (many independent
   non-inferable obligations + per-field graded oracle) works — this breaks the 80-100 cluster.
2. **Natural shape is no-spec LOW / spec HIGH, not 50-60/80-90.** Bespoke conventions are genuinely
   unguessable (no-spec < 50), and a precise spec gets followed near-perfectly (spec ~99, not 80-90).
   The GAP WIDTH is tunable by the inferable:non-inferable ratio; the spec CEILING stays ~95-100 unless the
   task is made artificially huge or ambiguous. Forcing spec down to 80-90 would be contrived.
3. **v3 = v4 = prose (~99-100).** Predicted risk that a procedural format would favour prose over structured
   did NOT materialise — structured specs carried the format as faithfully as prose. No v3/v4 penalty.

## Use
This anchors the HARD end of the suite. To show a spectrum, tune the inferable ratio for a ~50% no-spec
variant. Keep the honest message: the gap is no-spec vs spec (elicitation of non-inferable conventions);
prose≈v3≈v4 on score.
