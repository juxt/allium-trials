# contra-catch — result: NULL at Opus / simple contradiction (honest negative)

Three late-fee rules, jointly contradictory via arithmetic (fee=5% of principal; principal<=200
=> fee<=10; yet minimum fee 15). Arms: allium-elicit (real `allium analyse`), prose, spec-kit.
Blind judge: CAUGHT vs SHIPPED. N=5, Opus.

| process | caught |
|---|---|
| allium-elicit (analyse) | 5/5 |
| plain prose | 5/5 |
| spec-kit | 5/5 |

## The null, stated plainly

**Every arm caught it every time.** A capable model writing prose simply does the arithmetic
(5% x 200 = 10 < 15) and flags the conflict itself. The checker's deterministic verdict did not
beat a smart reader here, because the reasoning is easy enough that the reader does it unaided.
This is the same pattern the whole programme keeps finding: a capable model saturates an easy
task, so the tool adds nothing on top.

The elicit arm's `analyse` DID fire correctly every run (verified real CLI output: "CONTRADICTORY
... conflicting core: feeIsFivePercent, feeMinimum, principalCap"). The point is not that analyse
failed — it worked perfectly — but that prose reasoning also succeeded, so there is no separation.

## Where the checker SHOULD separate (the null tells us what to test)

The determinism of `analyse` beats stochastic model reasoning only where the reasoning is beyond
what the reader reliably does unaided:
1. **A weaker author model.** Sonnet prose may not do the arithmetic or may miss it. Test: same
   task, sonnet author.
2. **A contradiction buried in a large spec.** Here the conflict was 3 of 3 rules — impossible to
   miss. Bury a 3-rule conflicting core among ~15 unrelated invariants: a prose reader checks the
   obvious pairs and is unlikely to test that specific non-adjacent triple, while `analyse` finds
   the minimal conflicting core mechanically regardless of spec size. This is the real-world case
   (a contradiction creeps into a big spec over time) and where determinism should win.
3. **A contradiction requiring more than eyeball arithmetic** — a linear system across several
   variables, or a scheduling/temporal conflict over many periods.

Next: contra-catch-v2 — buried conflicting core in a ~15-invariant spec, Opus AND Sonnet. Prediction:
prose catch-rate drops (misses the buried triple); analyse stays 100% (mechanical minimal core).
