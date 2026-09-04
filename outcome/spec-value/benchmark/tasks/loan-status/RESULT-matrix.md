# loan-status-matrix result — small gap (mostly-inferable domain)

| arm | opus | sonnet |
|---|---|---|
| none | 98.8 | 98.0 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 | 100 | 100 |

All specs = 100. No-spec = 98-98.8 (misses only 2-4 of 168 cases: the isClosed-excludes-OVERPAID/REJECTED/
WITHDRAWN quirk). Prose did NOT mislead here (unlike mathutil). The gap is small because the state machine
is mostly inferable — only isClosed's exclusions are surprising, and even those a model mostly guesses.

**Law forming: spec-gap size ∝ non-inferability.** mathutil null-handling (highly non-inferable) → 12% gap;
loan-status isClosed (one quirk, else inferable) → 2% gap. The spec's code-quality value is proportional to
how much of the behaviour a capable model CANNOT infer from names + domain sense.
