# Living ranking — which spec benefit is largest? (updated each iteration)

Status: OPEN. Evidence accumulating. No synthesis until B1..B5 each have a verified result.

| Benefit | Verdict so far | Effect size | Confidence | Notes |
|---|---|---|---|---|
| B1 intent / bug-prevention | not yet run | — | — | expected highest; the code-can't-tell-you-it's-wrong test |
| B2 navigation / amortisation | RUNNING | single-shot: NO saving (token penalty ~1.8x) | low | amortisation curve pending |
| B3 deterministic gap detection | SATURATES on catch+reliability; value = certifiable guarantee | ~0 on catch/variance; qualitative on audit | med | model 4/4 defects, 0 flips over 6 reps on tractable specs; analyse's edge is a NAMED verdict + exit code + proof-of-determinism, not a higher/steadier rate |
| B4 brownfield surfacing | not yet run | — | — | greenfield analog already proven |
| B5 drift / regression gate | not yet run | — | — | monitor = exact laws (150/150) already |

## Prior context feeding the ranking (from the earlier loop)
- Accuracy of single-shot catch/regeneration/verification SATURATES even at 985k LOC — the model
  navigates 1M lines and nails a cross-module invariant + the subtle guard-gap cold, in 16 turns,
  $0.82. So B-benefits that rest on the model being LESS capable are unlikely to be the winner.
- The elicit SURFACING disposition is the one axis that beat prose and no-spec, judge-robustly, in
  greenfield. That makes B4 (and the intent-encoding half of B1) the prior favourites.
- Determinism/auditability (B3, B5) is real but is a QUALITY of the verdict, not a higher rate — its
  significance depends on whether the user values reproducibility over raw catch (regulated setting: yes).
