# npf-annuity result (N=5, clean) — richest data point + a methodological caveat

Port pmt/fv/pv/ppmt/ipmt from spec (hidden numpy-financial source). 162 golden. Bimodal: each run scored
162 (got the pmt sign/when convention) or 108 (missed it, all 54 pmt cases wrong).

## Reliability — fraction of runs that got the convention (10 runs/arm across both models)

| arm | opus | sonnet | combined |
|---|---|---|---|
| none | 3/5 | **0/5** | 3/10 |
| prose | 5/5 | 1/5 | 6/10 |
| v3 | 3/5 | 1/5 | 4/10 |
| v4 | 5/5 | 4/5 | **9/10** |

## Findings

1. **No-spec clearly fails on a non-inferable convention.** Sonnet with no spec got the pmt sign/when
   convention right in 0 of 5 runs. This is the strongest no-spec-fails signal in the suite: the convention
   is genuinely not inferable for a mid-tier model, and a spec is needed.
2. **v4 was the most reliable spec form (9/10)** — confirming the N=3 v4>v3 hint. v4's structure appears to
   force the sign/when convention to be stated explicitly.
3. **CAVEAT (real, must flag): the v3<prose<v4 ordering is confounded by SINGLE-DISTILLATION quality.**
   Specs are distilled ONCE per arm (fixed fair artifacts). So a v3 spec that happened to bury the
   convention hurts every v3 run — I am partly measuring that one distillation, not the language. The v3
   result (4/10, barely above no-spec) most likely reflects a weak v3 distillation of the convention, not a
   language limitation. To attribute a v3-vs-v4 difference to the LANGUAGE, need MULTIPLE distillations per
   arm (distill-variance). This is the key methodological upgrade for a fair v3-vs-v4 claim.

## Honest read
Strong: spec >> no-spec here (esp. sonnet 0/5 unaided). Suggestive: v4 most reliable. Unproven: v4 > v3 as
a LANGUAGE property (single-distillation confound). Next: multi-distillation to separate language from
artifact.
