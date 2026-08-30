# B1 design — bug prevention via encoded intent (the sharpest unique-value test)

## The trap to avoid
Every prior "does the spec help catch a bug" test SATURATED because a frontier model catches
invariant breaks from general knowledge (it knows double-entry must balance). If the model can infer
"this must hold" unaided, the spec adds nothing. So B1 must test intent that is **under-determined by
code + general knowledge**: an arbitrary-but-load-bearing human DECISION where two behaviours are both
defensible and only the spec says which is intended. That is the one thing the LLM provably cannot
have — the specific intent of THIS system.

## The task shape (accept/reject a change)
Self-contained review tasks (real Fineract code snippet + a proposed change that passes existing
tests). Arms:
- **nospec:** code snippet + proposed change. "MERGE or BLOCK, with reason."
- **spec:** same + the behavioural spec encoding the intended invariant.
Cold, isolated, blind judge classifies the verdict as MERGE / BLOCK + whether the reason cites the
specific intent.

## Case mix (discrimination, not just blocking)
- **Violating cases (V):** the change flips an under-determined intent. Spec should BLOCK citing the
  intent; nospec is EXPECTED to MERGE (the flip is defensible without the spec). Effect = V-merge-rate
  nospec − spec.
- **Benign cases (B):** the change is genuinely fine (a true refactor). BOTH should MERGE. Guards
  against a spec arm that just blocks everything. A useful spec DISCRIMINATES: blocks V, passes B.

The headline is the discrimination gap: does the spec move the verdict on V (toward BLOCK) WITHOUT
also breaking B (false BLOCK)? Only then is the value real, not "spec makes the model timid".

## Planted under-determined intents (grounded in real Fineract behaviour)
1. **Rounding residual placement.** Intent: the final schedule period absorbs the rounding residual so
   the loan closes to exactly zero (encoded in LoanScheduleInvariants: closes_to_zero, conservation).
   V-change: "simplify" to round each period independently / round at the end — plausible, passes a
   tolerance test, but the schedule no longer closes to exact zero. Model can't know which rounding is
   "right" without the spec; both are legitimate accounting choices.
2. **Zero-amount leg posting.** Intent (candidate; verify in code): a zero-amount journal leg is still
   posted for audit completeness. V-change: skip zero legs as an optimisation. Plausible; breaks audit
   intent only if that intent exists. VERIFY the real behaviour before using.
3. **Payment allocation order.** Intent: partial payments allocate in a specific order
   (principal/interest/fees/penalties or the configured order). V-change: hardcode a different, equally
   plausible order. Flips behaviour; only the spec/intent picks the order.
4. **Interest-on-declining-balance vs flat.** Intent (LoanScheduleInvariants: interest_on_outstanding):
   interest accrues on the opening OUTSTANDING balance each period. V-change: accrue on original
   principal (flat) — a real, common alternative. Model can't know which the product intends.

Use 1 and 4 first (both already encoded in an existing spec, both genuinely under-determined). Add 3;
treat 2 as optional pending verification. Include 2-3 benign controls (real safe refactors of the same
functions).

## Metric
Per case: nospec verdict, spec verdict, judge note on whether the reason cites the specific intent.
Report: V-block-rate (spec) vs V-block-rate (nospec) [the value], and B-block-rate (both) [the cost].
Effect size = (spec V-block − nospec V-block) − (spec B-block − nospec B-block). Positive and large =
the spec uniquely upholds intent without making the reviewer timid. Cold, no delegation (Task
disallowed), blind judge, spec never contains the verdict.

## Why this is the crux
If B1 shows a large positive discrimination gap, the largest spec benefit is **encoded intent**: the
spec tells the agent what the system is SUPPOSED to do where the code and world knowledge cannot. If
B1 also saturates (nospec blocks the V-changes unaided), then even intent is recoverable by a strong
model and the spec's value collapses toward determinism/audit (B3/B5) — itself a finding.
