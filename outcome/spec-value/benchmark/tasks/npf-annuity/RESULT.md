# npf-annuity result — 2nd codebase; bigger, noisier gap; first v4>v3 hint

Port pmt/fv/pv/ppmt/ipmt from spec (hidden numpy-financial source). 162 real golden. N=3.

| arm | opus | sonnet |
|---|---|---|
| none | 88.9 | 77.8 |
| prose | 100 | 77.8 |
| v3 | 88.9 | 100 |
| v4 | 100 | 100 |

**Bimodal**: every run scored either 162/162 or 108/162. 108 = missing the entire `pmt` block (54 cases),
i.e. the non-inferable pmt SIGN/WHEN convention is a wholesale right-or-wrong. Reliability across all 6 runs
(both models) per arm:
- **v4: 6/6** (never missed the convention)
- v3: 5/6
- prose: 4/6
- none: 4/6

**Findings:** (1) The recipe generalises to a 2nd codebase — a non-inferable convention creates a real gap,
BIGGER than the Fineract enums (67% floor when missed) but NOISIER. (2) **First hint of v4 > v3** (v4 6/6
vs v3 5/6) — but N=3 and bimodal, so this needs a higher-N rerun to confirm vs noise. (3) Prose again
unreliable (prose/sonnet 4/6... actually 1/3 hits on sonnet). Structured > prose on reliability holds.
Re-running at higher N to de-noise the v4>v3 hint.
