# math-util-boundary — next task, staged (algorithmic-boundary)

Target: real Fineract `MathUtil.java`, the pure BigDecimal/Long boundary subset (isZero, isGreaterThanZero,
negativeToZero, nullToZero, zeroToNull, isLessThanOrEqualTo, min/max with null handling, ...). No Money deps
in these method bodies. Non-obvious quirks: null semantics (isZero(null)? nullToZero vs zeroToNull), the
exact </<= boundary on negativeToZero, min/max notNull behaviour. Exactly where prose-generated tests
misjudge a boundary and structured specs pin it.

## Launch depends on the loop-guard N=10 precision result:
- **If precision holds (prose < V3):** build as a GATE task — correct port + a boundary-BUGGED port
  (e.g. negativeToZero uses `<` not `<=` at 0; isZero misses null). Does each arm's generated suite CATCH
  the boundary bug? Second data point for "structured specs generate more precise gates". This is the live
  hypothesis.
- **If precision was noise (prose = V3):** drop the precision thread; instead scout a real Fineract
  anti-vacuity SERVICE (a COB step / poster where "does the work" vs "vacuously nothing") to replicate p7
  (V4>V3) on real code.

## Ready: source staged. Extract golden (real MathUtil boundary outputs), correct + bugged Python ports,
## then wire the 3-arm distil->gen->gate workflow (same shape as loop-guard).
