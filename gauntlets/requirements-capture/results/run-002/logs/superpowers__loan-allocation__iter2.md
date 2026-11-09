# superpowers — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 7 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ Following the brainstorming process, I ask one focused question at a time; allocation ordering is the most material policy the brief omits and cannot be reliably inferred.

Q: When a borrower's payment is applied across their outstanding instalments, in what order should it absorb the amounts owed, both across the instalments themselves (for example oldest instalment first) and across the components within an instalment (penalties, fees, interest, principal)?
A: Across instalments: oldest first — clear all four buckets of the oldest overdue instalment in full before any money touches the next. Within an instalment: fees, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Allocation order is settled; the next unresolved material policy is how to handle payments that exceed or fall short of what is currently owed, which cannot be reliably inferred.

Q: Once the oldest-first, fees-penalties-interest-principal waterfall has run, what should happen to money left over after every outstanding instalment is fully cleared — hold it as a credit on the loan, apply it to instalments not yet due, or return it to the borrower? And conversely, when a payment is too small to clear a bucket in full, should it partially fill that bucket and stop, or is there a minimum-payment rule that rejects or defers partial application?
A: Surplus after all outstanding instalments are cleared is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due; it is never auto-refunded and does not prepay principal or alter future interest. For an underpayment, there is no minimum-payment rule: the waterfall runs in strict bucket order, partially fills whichever bucket the money reaches, and stops there — no proportional split, no deferral or rejection.

### Round 3
_Step reasoning:_ The waterfall ordering, surplus and underpayment policies are now pinned down; monetary precision/rounding remains a material, non-inferable policy decision that affects correctness, so one more focused question is warranted before writing the spec.

Q: How should the allocation handle monetary precision and rounding — do payments and bucket balances work in whole minor units (e.g. cents) with no sub-unit amounts possible, or can balances carry fractional amounts that require a rounding rule, and if so which direction and at what step does rounding apply?
A: The loan is denominated in BHD, whose minor unit is the fils — three decimal places. All amounts and balances are expressed to 3 dp; no sub-unit fractions are carried beyond that. Where arithmetic produces a sub-fils remainder, round half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

### Round 4
_Step reasoning:_ Ordering, surplus/shortfall and rounding are settled; the one remaining material policy with several plausible institution-specific answers is validation of degenerate/invalid inputs, so I ask that before concluding.

Q: Before I treat the policy as settled, how should the function handle degenerate or invalid inputs: a zero payment, a negative payment (is that ever a valid reversal/adjustment, or always an error?), a payment applied to a loan that currently has nothing outstanding (straight to credit balance, or rejected?), and a non-whole-fils input amount such as four decimal places (reject, or round on entry using the same half-up rule)?
A: A zero payment is not rejected: it is a no-op that still records a zero-value allocation transaction.

### Round 5
_Step reasoning:_ Round 4 raised four input-handling cases but the stakeholder answered only the zero-payment one; the negative, nothing-outstanding, and sub-fils-precision cases are still open material policy decisions that cannot be inferred.

Q: My previous question bundled four degenerate-input cases but only the zero-payment case was answered, so to finish settling input handling: (a) is a negative payment ever a valid reversal/adjustment, or always an error? (b) when a payment arrives on a loan with nothing currently outstanding, does it go straight to the unallocated credit balance, or is it rejected? and (c) if the input amount carries more precision than whole fils (e.g. four decimal places), do you reject it or round it on entry using the same half-up-to-3dp rule?
A: Negative is always an error — it is rejected and no allocation or transaction is recorded.

### Round 6
_Step reasoning:_ Rounds 4 and 5 left two explicitly-asked degenerate-input cases (nothing-outstanding and over-precise input) unanswered; I must settle them before the policy is complete rather than inventing answers.

Q: Two parts of my previous input-handling question are still open. (b) When a payment arrives on a loan that currently has nothing outstanding, does it go straight to the unallocated credit balance, or is it rejected? (c) If the input amount carries more precision than whole fils (e.g. four decimal places), do you reject it or round it on entry using the same half-up-to-3dp rule?
A: A payment on a loan with nothing outstanding goes straight to the unallocated credit balance — same treatment as an overpayment surplus.

### Round 7
_Step reasoning:_ Every material policy is settled except the sub-fils input-precision case (round-6 part c), which was never answered; one final question closes input handling before the spec is complete.

Q: One input-handling case from my previous question is still open: if the payment amount arrives with more precision than whole fils (for example four or more decimal places, such as 12.3456 BHD), should the function reject it as invalid, or accept it and round it on entry using the same half-up-to-3dp rule before the waterfall runs?
A: [default, not policy] Accept it and round on entry using the same half-up-to-3dp rule before the waterfall runs.

### Round 8 (process signalled done)
_Step reasoning:_ All material policy decisions — instalment/component waterfall order, surplus and underpayment handling, BHD/fils precision and half-up rounding with residual to interest, and every degenerate-input case (zero, negative, nothing-outstanding, excess precision) — are now settled, so requirements capture is complete.

(no questions this round)

## Produced specification

# Payment allocation specification — `allocate_payment(payment, loan)`

## Purpose

Apply a borrower's payment across the amounts currently owed on a loan, and report both how the payment was applied and the loan's updated balances. A loan carries one or more outstanding instalments, each split into four component buckets: penalties, fees, interest and principal.

## Function

`allocate_payment(payment, loan) -> result`

- `payment`: a single monetary amount in BHD, plus whatever identifying metadata the caller supplies (not constrained by this policy).
- `loan`: the loan with its outstanding instalments and its existing unallocated credit balance.
- `result`: the allocation breakdown (how much of the payment went to which bucket of which instalment, and any surplus) together with the loan's updated balances.

## Monetary model and rounding

- The loan is denominated in BHD. The minor unit is the fils: three decimal places.
- All amounts and balances are expressed to 3 dp. No fraction smaller than one fils is ever carried.
- Where arithmetic produces a sub-fils remainder, round half-up to 3 dp.
- Any rounding residual is absorbed into the interest component, never into principal.

## Allocation waterfall

The payment absorbs amounts owed in a strict, deterministic order.

Across instalments: oldest first. The oldest overdue instalment must have all four of its buckets cleared in full before any money reaches the next instalment.

Within a single instalment, buckets fill in this order:

1. Fees
2. Penalties
3. Interest
4. Principal

The waterfall runs bucket by bucket in that order until the payment is exhausted or every outstanding instalment is fully cleared.

## Underpayment (payment smaller than total outstanding)

There is no minimum-payment rule. The waterfall runs in strict bucket order, partially fills whichever bucket the money reaches, and stops there. No proportional split across buckets, no deferral, no rejection.

## Surplus (payment larger than total outstanding)

Money left after every outstanding instalment is fully cleared is held as an unallocated credit balance on the loan. That credit is auto-applied to the next instalment when it falls due. It is never auto-refunded to the borrower, it does not prepay principal, and it does not alter future interest.

Auto-application when an instalment falls due is a separate event from this function. `allocate_payment` records the surplus into the unallocated credit balance.

## Degenerate and invalid inputs

- Zero payment: not rejected. It is a no-op against the buckets but still records a zero-value allocation transaction.
- Negative payment: always an error. It is rejected, and no allocation and no transaction are recorded. Negative amounts are not treated as reversals or adjustments.
- Nothing outstanding: a payment against a loan with no current outstanding amounts goes straight to the unallocated credit balance, the same treatment as an overpayment surplus.
- Excess input precision (more than 3 dp, for example 12.3456 BHD): accepted and rounded on entry using the same half-up-to-3-dp rule before the waterfall runs. This is a default resolution, not a stakeholder policy decision.

## Return value

The result reports:

- Per bucket, per instalment: the amount of the payment applied.
- The surplus moved to the unallocated credit balance, if any.
- The loan's updated balances: each instalment's remaining bucket balances, and the loan's updated unallocated credit balance.
- For a zero payment, a recorded zero-value allocation transaction.

## Decisions confirmed by the stakeholder

- Across-instalment order: oldest first, each cleared in full before the next.
- Within-instalment order: fees, penalties, interest, principal.
- Surplus held as unallocated credit, auto-applied to the next instalment when due, never auto-refunded, no principal prepayment, no change to future interest.
- Underpayment: strict bucket order, partial fill of the reached bucket, stop; no minimum, no proportional split, no deferral.
- Precision: BHD to 3 dp, round half-up, residual absorbed into interest.
- Zero payment is a no-op that still records a zero-value transaction.
- Negative payment is always rejected with nothing recorded.
- A payment with nothing outstanding goes straight to the credit balance.

## Assumptions and defaults (not confirmed as policy)

- Input precision above 3 dp is rounded on entry rather than rejected (Round 7, explicitly given as a default).
- The concrete shape of the `loan`, `instalment`, `payment` and transaction-record structures is left to implementation; only the fields named above are required by policy.

## Open questions (neither in the brief nor settled)

- How an instalment's due status (outstanding or overdue versus not yet due) is determined, and the mechanism and timing of auto-applying credit when an instalment falls due.
- Whether a surplus credit is ever refunded through an explicit, separate operation; only auto-refund was ruled out.
- Any validation of the payment beyond sign and precision, for example a currency mismatch.

## Auditor verdict

_The spec is strong on the precision/rounding cluster (4,5,6) and the allocation-order and credit-balance decisions (1,2,3,8,9), plus the degenerate-input contract (11). It misses the genuinely bespoke time-and-tolerance decisions entirely: back-valued re-accrual (7), write-off tolerance (10), penalty accrual timing (12), and same-day FIFO (13) are all absent. The return shape (14) is close but incomplete, lacking tolerance_written_off because the tolerance policy itself was never elicited. Coverage: 9/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Within a single instalment, buckets fill in this order: 1. Fees 2. Penalties 3. Interest 4. Principal | The spec states fees before penalties before interest before principal, matching the reference's deliberately non-default order exactly. |
| 2 | yes | **yes** | Across instalments: oldest first. The oldest overdue instalment must have all four of its buckets cleared in full before any money reaches the next instalment. | Matches the reference: oldest instalment cleared in full across all four buckets before touching the next. |
| 3 | yes | **yes** | Money left after every outstanding instalment is fully cleared is held as an unallocated credit balance on the loan. That credit is auto-applied to the next instalment when it falls due. It is never auto-refunded to the borrower, it does not prepay principal... | Exactly matches: unallocated credit balance, auto-applied to next instalment, never auto-refunded. |
| 4 | yes | **yes** | The loan is denominated in BHD. The minor unit is the fils: three decimal places. All amounts and balances are expressed to 3 dp. | Matches BHD / 3 dp (fils) precisely. |
| 5 | yes | **yes** | Where arithmetic produces a sub-fils remainder, round half-up to 3 dp. | Matches round half-up to the minor unit (3 dp). |
| 6 | yes | **yes** | Any rounding residual is absorbed into the interest component, never into principal. | Exactly matches the reference: residual absorbed into interest, not principal. |
| 7 | no | no | absent | The spec never mentions value_date, back-valued payments, or recomputing/re-accruing interest to an earlier date; nothing addresses this decision. |
| 8 | yes | **yes** | It is never auto-refunded to the borrower, it does not prepay principal, and it does not alter future interest. | The surplus treatment states surplus becomes credit, does not prepay principal, and leaves future interest unchanged, matching the early/on-time surplus resolution. |
| 9 | yes | **yes** | The waterfall runs in strict bucket order, partially fills whichever bucket the money reaches, and stops there. No proportional split across buckets... | Matches strict in-order filling with no proportional split for a payment smaller than the first bucket due. |
| 10 | no | no | absent | The spec contains no write-off tolerance rule, no 0.005 BHD threshold, and no mention of marking an instalment paid by forgiving a residual. |
| 11 | yes | **yes** | Zero payment: ... a no-op against the buckets but still records a zero-value allocation transaction. Negative payment: always an error. It is rejected, and no allocation and no transaction are recorded. | Matches exactly: negative rejected with nothing recorded, zero is a no-op that still records a zero-value transaction. |
| 12 | no | no | absent | The spec does not address penalty accrual timing or accruing penalties up to the value date before allocation; no accrual step is mentioned. |
| 13 | no | no | absent | The spec says nothing about multiple same-day payments or FIFO-by-timestamp ordering of independent allocations. |
| 14 | yes | no | Per bucket, per instalment: the amount of the payment applied. The surplus moved to the unallocated credit balance... each instalment's remaining bucket balances, and the loan's updated unallocated credit balance. | The spec covers per-bucket/per-instalment amounts, outstanding balances, and credit_balance, but omits tolerance_written_off (decision 10 is absent), so the result shape does not match the reference's four required elements. |
