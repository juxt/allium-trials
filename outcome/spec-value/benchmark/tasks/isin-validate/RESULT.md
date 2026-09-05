# isin-validate result (3rd codebase, 2nd module) — bigger gap; prose best here; v4/sonnet fragile

| arm | opus | sonnet |
|---|---|---|
| none | 73 | 68.3 |
| prose | 100 | 100 |
| v3 | 95.2 | 97.6 |
| v4 | 98.4 | 58.7* |

~30-point no-spec gap: the ISIN check-digit (Luhn over letters expanded A=10..Z=35, right-to-left doubling)
is genuinely NON-INFERABLE — bigger gap than iban's mod-97 (which is more standard). No-spec gets the
structure and reject cases but botches the check-digit computation (bimodal: some runs 8/21).

Two honest notes:
1. **prose was the MOST reliable here (100 both models)** — opposite of mathutil (where prose misled). So
   prose-vs-structured reliability is TASK-SPECIFIC, not a uniform structured>prose. Both usually work; both
   occasionally fail, in task-dependent ways. v3 consistently missed 1 case (a distillation gap).
2. ***v4/sonnet fragile (58.7 — 2 of 3 runs scored 8/21).** Recurring: a complex/long v4 spec is sometimes
   too much for a mid-tier model to port cleanly. A genuine PRACTICAL downside of richer v4 specs for
   code-gen on weaker models — distinct from correctness. (Also seen: v4/sonnet prompt-too-long on iban/bech32.)
