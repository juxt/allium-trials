# allocation-reversal result — SATURATED (all arms 100%, both models)

| arm | opus | sonnet |
|---|---|---|
| none | 100 | 100 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 | 100 | 100 |

The premise failed: I assumed reverse-priority unwind order was a design decision a no-spec arm would
guess wrong (forward order → 25/49). It is NOT — every model, incl. no-spec on sonnet, correctly inferred
that "reverse a payment allocation" means unwind in reverse priority order (LIFO), matching the reference.
The oracle discriminates (naive forward = 25/49), so this is a real finding: **a strong OR mid-tier model
infers the natural intent of a domain operation without the spec.** A "design decision" is only
spec-separable if it is genuinely ARBITRARY / opaque (cannot be inferred from domain sense). Reverse-order
reversal is inferable. Saturated; kept as a boundary case.
