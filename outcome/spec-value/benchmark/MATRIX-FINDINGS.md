# Matrix findings — how V3 and V4 perform vs prose and no-spec on real code

Four arms (no-spec / prose / V3 / V4) × two models (Opus, Sonnet), measuring RESULTING CODE quality
(fraction of a real-code golden oracle matched). Real programmer jobs (port / reconstruct / feature-add /
bugfix) on four real codebases. Spec quality is a diagnostic, not the headline.

## The results (code quality %, opus / sonnet)

| task | codebase | domain | none | prose | v3 | v4 |
|---|---|---|---|---|---|---|
| mathutil-port HARD (287) | Fineract | numeric null-handling | 94.8 / 88.2 | 86.1 / 100 | 100 / 100 | 100 / 100 |
| npf-annuity (N=5) | numpy-financial | annuity math | 86.7 / 66.7 | 100 / 73.3 | 86.7 / 73.3 | 100 / 93.3 |
| bech32-segwit | bech32 (crypto) | address encoding | 82.1 / 82.1 | 100 / 100 | 100 / 100 | 100 / 100 |
| isin-validate | python-stdnum | check-digit | 73 / 68.3 | 100 / 100 | 95.2 / 97.6 | 98.4 / 58.7* |
| iban-validate | python-stdnum | number validation | 96.4 / 96.4 | 98.2 / 100 | 96.4 / 64.3* | 98.8 / fail* |
| loan-status | Fineract | state machine | 98.8 / 98.0 | 100 / 100 | 100 / 100 | 100 / 100 |
| charge-calc | Fineract | business rules | 98.8 / 98.1 | 100 / 100 | 100 / 100 | 100 / 100 |
| charge-time (357) | Fineract | business rules | 99.5 / 98.2 | 100 / 100 | 100 / 100 | 100 / 100 |
| allocation-reversal | Fineract | feature-add | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |

`*` = data-quality issues (v4/sonnet complex-spec fragility; one broken run). See per-task RESULT.md.

## Six findings

1. **Spec code-quality value is proportional to NON-INFERABILITY.** Where a capable model can infer the
   behaviour (state machines, business rules, "reverse a payment"), all arms converge near 100 and a spec
   adds ~0-2%. Where the behaviour is genuinely non-inferable, a spec adds a real margin — up to ~30 points
   (isin check-digit) and reliably closes it: null conventions, the pmt sign/when convention, a crypto
   charset+polymod, a check-digit algorithm. The whole game is finding non-inferable real behaviour.

2. **Spec >> no-spec on non-inferable behaviour — replicated across all four codebases.** No-spec floors:
   isin 68-73, bech32 82, npf-sonnet 67, mathutil-hard-sonnet 88. A spec (any form) lifts these toward 100.

3. **The margin is often about RELIABILITY over flaky recall, not filling a blank.** bech32 is a famous
   algorithm; no-spec is bimodal (100% when the model recalls the exact charset/polymod, 73-82% when memory
   is fuzzy). A spec supplies the constants exactly, so every spec arm is a reliable 100. Even well-known
   code benefits because model memory is unreliable.

4. **The margin is larger for the weaker model on BESPOKE conventions, equal on FAMOUS ones.** npf pmt
   (bespoke): sonnet no-spec 67 vs opus 87. bech32 (famous): both 82. So spec value rises as capability
   falls — but only where the behaviour isn't in the model's training memory.

5. **V3 ≈ V4 on code output.** Both are "structured spec" and tie on almost every task. The one apparent
   counterexample (npf, single-distillation v4>v3) DISSOLVED under a multi-distillation study (v3 recovered
   to 5/6 ≈ v4 6/6): it was single-artifact luck, not a language effect. V4's distinct value (design-time
   proof, the anti-vacuity gate) is a CAPABILITY, not a code-quality delta, and does not show here.

6. **Prose vs structured reliability is TASK-SPECIFIC; and rich V4 specs can be too complex for a weak
   model.** Prose misled Opus on mathutil-hard (86, below no-spec) but was the most reliable on isin (100).
   Neither is uniformly safer. Separately, V4's richer specs occasionally broke a Sonnet port (isin/bech32/
   iban: prompt-too-long or a botched port) — a genuine practical downside of spec complexity for code-gen
   on mid-tier models, independent of correctness.

## Honest headline

For a capable model, **spec form does not change code quality where the behaviour is inferable** (most
enum/rule tasks tie near 100). Where it is NOT inferable — arbitrary conventions, check-digits, crypto
constants, half-remembered famous algorithms — **a spec reliably lifts code from a flaky 70-88% to ~100%,
across four real codebases**, and the lift is largest for weaker models on bespoke behaviour. Among spec
forms, **V3 ≈ V4 on code quality** (V4's edge is capability, not code); **prose usually matches but is less
predictable** (can mislead, or in reverse can beat an over-complex structured spec). The defensible
proposition: a spec buys correctness-and-reliability precisely on the parts a model cannot infer or reliably
recall — which in real regulated/finance/crypto code is exactly the load-bearing detail.
