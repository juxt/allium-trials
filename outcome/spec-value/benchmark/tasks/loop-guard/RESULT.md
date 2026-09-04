# loop-guard result — gate saturates on CATCH; the signal is PRECISION

N=4. Each arm distils a spec from real LoopGuard.java, generates a pytest suite, run vs correct + guard-removed.

| arm | catches regression | passes correct (precision) |
|---|---|---|
| prose | 100% | 50% |
| V3 | 100% | 75% |
| V4 | 100% | 75% |

**Catch-rate saturated (100% all).** LoopGuard's whole purpose IS the termination guard — not a non-obvious
property — so every arm captured it and tested it. And V3 = V4: a bounded loop that THROWS is concrete
safety behaviour any spec describes and any test-gen tests, so V4's objective construct gave no edge here.
This narrows the p7 V4>V3 win: it appears only for a TRUE anti-vacuity property (does-it-do-anything) that
cannot be reduced to a concrete safety test — not for a concrete throw.

**The real signal is PRECISION.** Prose-generated suites false-alarm on the CORRECT code twice as often
(50% vs 75% pass-correct): they get the exact `++count > maxIterations` boundary wrong and over-specify more.
Structured specs yield more accurate gates. A suite that cries wolf on correct code is worse than useless, so
this is a genuine structure > prose signal — but weak at N=4 (2/4 vs 3/4), and no V3<V4. Re-running at N=10.

## N=10 UPDATE — the precision signal was noise, and INVERTS

| arm | catches regression | passes correct (precision) |
|---|---|---|
| prose | 100% | **80%** |
| V3 | 100% | 50% |
| V4 | 100% | 40% |

The N=4 "structured specs are more precise" signal was noise. At N=10 the opposite holds: **prose generates
the MOST precise gates, V4 the least.** Cause: the structured specs (V3/V4) OVER-SPECIFY — they add
invariants/objectives that generate extra tests which then false-alarm on the correct code. Catch stays
saturated (100% all). Net for this task: structure gives NO advantage and slightly more false alarms.
Precision thread is DEAD.
