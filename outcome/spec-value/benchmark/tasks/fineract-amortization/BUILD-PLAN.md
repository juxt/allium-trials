# fineract-amortization — first real-code differential-fidelity task

**Pinned smallest-viable target: `TvmFunctions.java`** (169 LOC, ZERO fineract deps, pure BigDecimal math).
Public API: `rate(nper, pmt, pv, mc)` — an iterative interest-rate solver (spreadsheet RATE), and
`discountFactor(eir, days, mc)`. Real, non-obvious numerical banking code; a naive reimplementation
diverges on convergence/tolerance/rounding edge cases. This is exactly where spec fidelity should matter.

## Instrument (distil → hide → reconstruct → differential)
1. **Golden extraction.** Pull real (input → expected output) pairs for `rate` / `discountFactor` from the
   2377-LOC golden test into `golden.json`. Real behaviour, incl. numerical quirks. (Where the test builds
   inputs indirectly, either read the intended values or run the Java once to capture I/O.)
2. **3-arm distil.** Fresh agents distil a spec from `TvmFunctions.java`: prose (NL description), V3
   (allium v3), V4 (allium v4 — may run `analyse`). Equal fidelity; each uses its tool's real process.
3. **Hide + reconstruct.** Hide the Java. A fresh agent reconstructs `rate`/`discountFactor` in Python from
   the spec alone.
4. **Differential score.** Run each reconstruction against `golden.json`. Fidelity = fraction matched
   (to the golden MathContext precision). prose vs V3 vs V4 by fidelity %.

## Why this is the honest instrument
Code-level (behavioural match to real code), inherent non-obviousness (real numerical logic we did not
author), no obfuscation dial (hide only the code), ungameable by language features (score is fidelity, not
expressiveness). A better spec → a more faithful reconstruction.

## Status: target pinned + staged. Next: step 1 (golden extraction), then the 4-step workflow.
