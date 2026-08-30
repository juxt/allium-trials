# Living ranking — which spec benefit is largest? (updated each iteration)

Status: OPEN. Evidence accumulating. No synthesis until B1..B5 each have a verified result.

| Benefit | Verdict so far | Effect size | Confidence | Notes |
|---|---|---|---|---|
| B1 intent / bug-prevention | REFUTED as catch-benefit; surfaced a HAZARD (tunnel vision) | ~0 on catch; NEGATIVE (a real out-of-scope miss) | med-high | model blocks all intent-flips unaided (saturates); spec made it dismiss a real negative-payment bug as "out of scope". Spec's only plus: better GROUNDS for a block (auditable) |
| B2 navigation / amortisation | POSITIVE but SCOPED: ~30% cheaper, concentrated on hard-to-locate targets | ~30% cost on retrieval-hard tasks; ~0 on easy; correctness neutral | med | clean run (no delegation): spec $4.79 vs nospec $6.86, driven almost entirely by T2 charge-off ($0.88 vs $3.15). n=1 hard task |
| B3 deterministic gap detection | SATURATES on catch+reliability; value = certifiable guarantee | ~0 on catch/variance; qualitative on audit | med | model 4/4 defects, 0 flips over 6 reps on tractable specs; analyse's edge is a NAMED verdict + exit code + proof-of-determinism, not a higher/steadier rate |
| B4 brownfield surfacing | LARGEST unique effect: nospec silently commits ~4/10 policy decisions | ~3-4 decisions/10 (nospec guessed 4.3 vs spec ~1) | med | but it's the ACT OF SPECIFYING, not Allium: prose (8.0) ~ elicit (7.7) >> nospec (4.7). n=1 task |
| B5 drift / regression gate | not yet run | — | — | monitor = exact laws (150/150) already |

## Prior context feeding the ranking (from the earlier loop)
- Accuracy of single-shot catch/regeneration/verification SATURATES even at 985k LOC — the model
  navigates 1M lines and nails a cross-module invariant + the subtle guard-gap cold, in 16 turns,
  $0.82. So B-benefits that rest on the model being LESS capable are unlikely to be the winner.
- The elicit SURFACING disposition is the one axis that beat prose and no-spec, judge-robustly, in
  greenfield. That makes B4 (and the intent-encoding half of B1) the prior favourites.
- Determinism/auditability (B3, B5) is real but is a QUALITY of the verdict, not a higher rate — its
  significance depends on whether the user values reproducibility over raw catch (regulated setting: yes).
