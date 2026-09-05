# iban-validate result (3rd codebase, N=3, partial) — small gap, mostly-inferable

| arm | opus | sonnet |
|---|---|---|
| none | 96.4 | 96.4 |
| prose | 98.2 | 100 |
| v3 | 96.4 | 64.3* |
| v4 | 98.8 | (failed**) |

no-spec = 96.4 both models: every run 27/28, always missing the ONE non-inferable case (a Belgium IBAN that
passes mod-97 but fails stdnum's national check digit). Specs occasionally catch it (prose/v4 hit 28/28 in
several runs); no-spec never did. mod-97 is inferable, so the gap is small (1/28) — same pattern as the
Fineract enums: mostly-inferable domain -> small spec gap, concentrated on the non-inferable national check.

Data-quality caveats (honest): *v3/sonnet had one broken run (0/0) dragging its avg; **v4/sonnet failed
entirely ("prompt too long" — the distilled v4 spec was oversized) + some API-overloaded errors. Partial
data; headline (no-spec ~96, small gap on the national check) is clear regardless. A cleaner rerun would
need a shorter v4 spec.
