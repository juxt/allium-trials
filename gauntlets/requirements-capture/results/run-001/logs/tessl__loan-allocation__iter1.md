# tessl — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ Allocation order across instalments and across components is the core policy the brief omits and cannot be safely inferred, so I ask about it first before edge cases.

Q: When a payment is applied across the outstanding instalments, in what order should the money be allocated — for example, oldest instalment first, and within an instalment which component (penalties, fees, interest, principal) is paid before the others?
A: Oldest instalment first — clear all four buckets of the oldest instalment in full before any money touches the next. Within each instalment the order is: fees, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Allocation order is settled; the next highest-impact gap is the overpayment/surplus policy, which is a genuine institutional choice that can't be inferred.

Q: When the payment is larger than everything currently outstanding across all instalments, what should happen to the surplus — for example, is it held as an unallocated credit on the loan, applied to reduce future/not-yet-due principal, or returned to the borrower?
A: Surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay future principal.

### Round 3
_Step reasoning:_ Allocation order and surplus are settled; monetary rounding is the next material, un-inferable policy an institution picks specifically, so I ask it before moving to remaining edge cases.

Q: When an allocation produces fractional currency amounts (for example splitting a payment across interest and principal, or computing accrued interest), how should the money be rounded — to what precision (e.g. whole cents), using which rounding rule (round half up, banker's rounding, always round down), and does any residual rounding remainder get pushed into a specific component such as principal?
A: All amounts are denominated in BHD, which has a 3-decimal-place minor unit (fils). Round every computed amount to 3 dp using round-half-up. Any rounding residual is absorbed into the interest component, not principal.

### Round 4
_Step reasoning:_ Core happy-path ordering, surplus and rounding are settled; the partial-payment/underpayment path is the remaining material behaviour before edge cases.

Q: When an instalment cannot be paid in full (the payment runs out partway through clearing its fees/penalties/interest/principal buckets), should the allocation stop there and leave the remaining buckets and later instalments untouched, or is there any different handling for a partial instalment payment?
A: Strict order: fill each bucket in sequence until the payment is exhausted, then stop. The remaining buckets of that instalment and all later instalments are left untouched. There is no proportional split.

### Round 5
_Step reasoning:_ Rounds 1-4 settled order, surplus, rounding and partial handling; the remaining material, non-inferable policy is how a pre-existing credit balance interacts with a new payment at allocation time.

Q: At the moment `allocate_payment` runs, if the loan already carries an unallocated credit balance from a previous overpayment, how should it interact with the incoming payment — is the existing credit combined with the new payment and allocated together against the outstanding instalments in the same fees/penalties/interest/principal order, applied first before the new payment, or left untouched so only the new payment is allocated?
A: The existing credit balance is combined with the new payment and the total is allocated together against the outstanding instalments in the standard fees/penalties/interest/principal order.

### Round 6
_Step reasoning:_ Scope of 'outstanding instalments' (due/overdue only vs all including future) is still ambiguous and materially changes allocation behaviour, so one more targeted question before summarising.

Q: Which instalments are eligible to receive the payment allocation — only those currently due or overdue as at the payment date, or all outstanding instalments on the loan including ones not yet due (so that a large payment would flow into future instalments rather than becoming an unallocated credit)?
A: Only instalments that are due or overdue as at the payment date are eligible. A surplus does not flow into future instalments — it becomes an unallocated credit balance, auto-applied when the next instalment falls due.

### Round 7
_Step reasoning:_ Core allocation policy is settled across six rounds; the remaining material gap is input validation and the no-eligible-instalment edge case, which the institution must decide before spec authoring.

Q: When `allocate_payment` is called with a payment amount that is zero, negative, or not a valid BHD 3-decimal amount (and separately, when there are no due-or-overdue instalments to allocate against), should the function reject the input with an error, or process it (e.g. a zero/positive-but-unallocatable payment simply becomes or adds to the unallocated credit balance)?
A: Negative payment: rejected with an error. Zero payment: processed as a no-op but a zero-value allocation transaction is still recorded. Non-valid BHD 3-decimal-place amount: [default, not policy] reject with a validation error before any allocation runs. No due-or-overdue instalments: [default, not policy] the payment (combined with any existing credit balance) is held entirely as an unallocated credit balance, consistent with the overpayment rule.

### Round 8
_Step reasoning:_ Whether instalment component balances are fixed inputs or computed at payment date (especially daily interest accrual) is a material, non-inferable policy that determines the amounts being allocated; worth one focused question before summarising.

Q: At the moment `allocate_payment` runs, are the fees/penalties/interest/principal amounts for each instalment fixed values supplied on the loan (i.e. the function allocates against pre-computed outstanding balances), or does the function itself compute any of them at the payment date — in particular, is interest a static per-instalment figure or does it accrue daily up to the payment date (which would change how much is owed and therefore how the payment is split)?
A: Interest accrues daily up to and including the payment's value_date; the function recomputes accrued interest to that date before allocation runs. Fees and principal are fixed per-instalment figures. Penalties also accrue up to and including the value_date before allocation.

### Round 9 (process signalled done)
_Step reasoning:_ All material policy decisions from the brief (allocation order, surplus handling, rounding, partial payments, existing credit interaction, instalment eligibility, invalid inputs, and interest/penalty accrual) have been resolved by the stakeholder; no ambiguous requirements remain, so the interview is complete.

(no questions this round)

## Produced specification

# Requirements specification: `allocate_payment(payment, loan)`

## Purpose

When a borrower makes a payment against a loan, the money must be applied across what they currently owe. This specification defines `allocate_payment(payment, loan)`, which returns how the payment is applied and the loan's updated balances. It captures the allocation order, treatment of surplus and pre-existing credit, rounding, partial-payment handling, instalment eligibility, input validation, and how the owed amounts are established at the payment date.

Every policy below was confirmed with the stakeholder. Where a point was neither asked nor covered by the brief, it is marked as a default rather than confirmed policy.

## Scope

### Included

- Allocating a single incoming payment across a loan's outstanding instalments.
- Combining any existing unallocated credit balance with the incoming payment before allocation.
- Recomputing accrued interest and penalties to the payment's value date before allocation.
- Producing the resulting allocation breakdown, the loan's updated balances, and an allocation transaction record.
- Holding surplus as an unallocated credit balance on the loan.
- Validating the incoming payment.

### Excluded

- Disbursement, refunds, or any auto-refund of credit balances (surplus is never auto-refunded).
- Prepayment of future or not-yet-due principal.
- Recalculation of fees or principal (these are fixed per-instalment inputs).
- Scheduling logic for when future instalments fall due (the function acts only on eligibility as at the payment date).

## Currency and rounding

- All amounts are denominated in BHD, whose minor unit (fils) has 3 decimal places.
- Every computed amount is rounded to 3 decimal places using round-half-up.
- Any rounding residual is absorbed into the interest component, never into principal.

## Amounts owed at the payment date

Before any allocation runs, the function establishes the amount owed on each eligible instalment:

- **Interest** accrues daily up to and including the payment's `value_date`. The function recomputes accrued interest to that date; interest is not a static supplied figure.
- **Penalties** also accrue up to and including the `value_date`, and are recomputed before allocation.
- **Fees** are fixed per-instalment figures supplied on the loan; the function does not compute them.
- **Principal** is a fixed per-instalment figure supplied on the loan; the function does not compute it.

Recomputed interest and penalty figures are rounded per the rounding rules above before allocation.

## Instalment eligibility

Only instalments that are due or overdue as at the payment date are eligible to receive allocation. Instalments not yet due are ineligible. A surplus does not flow into future instalments; it becomes an unallocated credit balance (see Surplus).

## Core behaviour (happy path)

1. **Validate** the incoming payment (see Validation).
2. **Combine credit.** If the loan already carries an unallocated credit balance from a previous overpayment, combine it with the incoming payment. The total (existing credit + new payment) is what gets allocated. The two are allocated together as a single amount in the standard order; the existing credit is not applied as a separate prior step.
3. **Establish amounts owed.** Recompute accrued interest and penalties to and including `value_date`; take fees and principal as supplied. Determine the set of due-or-overdue instalments.
4. **Order the instalments** oldest first.
5. **Allocate** the combined total across instalments, oldest first. Clear all four buckets of the oldest eligible instalment in full before any money touches the next instalment. Within each instalment the bucket order is:
   1. Fees
   2. Penalties
   3. Interest
   4. Principal
6. **Continue** filling each bucket in sequence, instalment by instalment, until the combined total is exhausted or all eligible instalments are fully cleared.
7. **Handle surplus** (see Surplus).
8. **Return** the allocation breakdown, the loan's updated balances (including any credit balance), and record an allocation transaction.

## Partial instalment handling

Allocation is strict-order fill. Each bucket is filled in sequence until the payment is exhausted, then allocation stops. If the money runs out partway through clearing an instalment's fees, penalties, interest, and principal buckets, the remaining buckets of that instalment and all later instalments are left untouched. There is no proportional split across buckets or instalments.

## Surplus (overpayment)

When the combined total exceeds everything currently outstanding across all eligible instalments, the surplus is held as an unallocated credit balance on the loan. The credit balance:

- Is auto-applied to the next instalment when it falls due.
- Is never auto-refunded to the borrower.
- Does not prepay future or not-yet-due principal.

## Validation and edge cases

- **Negative payment:** rejected with an error. No allocation runs.
- **Zero payment:** processed as a no-op. No amounts move, but a zero-value allocation transaction is still recorded.
- **Non-valid BHD 3-decimal amount** (payment amount with finer precision than 3 decimal places, or otherwise not a valid BHD minor-unit amount): _[default, not confirmed policy]_ rejected with a validation error before any allocation runs.
- **No due-or-overdue instalments to allocate against:** _[default, not confirmed policy]_ the payment, combined with any existing credit balance, is held entirely as an unallocated credit balance, consistent with the surplus rule. No error is raised for a valid non-negative payment in this case.

## Constraints

- Monetary precision is fixed at 3 decimal places (BHD fils); round-half-up throughout; rounding residual absorbed into interest.
- The function must recompute interest and penalties to `value_date` on every call; it must not rely on stale supplied interest or penalty figures.
- Allocation order (oldest instalment first; fees, penalties, interest, principal within an instalment) and strict-order fill are invariant and must not be reordered or made proportional.
- Eligibility is strictly due-or-overdue as at the payment date.

## Outputs

- The allocation breakdown: how much of the combined total was applied to each bucket of each instalment, oldest first.
- The loan's updated balances after allocation, including remaining per-bucket balances on each instalment and the resulting unallocated credit balance.
- A recorded allocation transaction (including the zero-value transaction for a zero payment).

## Success criteria

- A payment is applied oldest-instalment-first, clearing fees, then penalties, then interest, then principal within each instalment, stopping when the combined total is exhausted.
- Existing credit is combined with the incoming payment and allocated together.
- Interest and penalties are accrued to and including `value_date` before allocation; fees and principal are taken as fixed inputs.
- Only due-or-overdue instalments receive allocation; any surplus becomes an unallocated credit balance that is auto-applied at the next due instalment and never auto-refunded and never prepays future principal.
- All amounts are rounded to 3 dp round-half-up with residual absorbed into interest.
- Negative payments are rejected; zero payments are a no-op with a recorded zero-value transaction.

## Auditor verdict

_The spec covers 12 of 14 decisions correctly, capturing all the bespoke elicitation targets (bucket order 1, credit-balance surplus 3, BHD 3-dp 4, residual-to-interest 6, value-date accrual 7/12, no-prepay 8) plus the inferable ones (9, 11). It misses decision 10 entirely (no write-off tolerance) and decision 13 (no same-day FIFO rule). Decision 14 is surfaced but incorrect because the returned result shape omits tolerance_written_off, consistent with the missing tolerance policy. Coverage = 12/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Within each instalment the bucket order is: 1. Fees 2. Penalties 3. Interest 4. Principal" | The spec states the bucket order as fees → penalties → interest → principal, matching the reference exactly, including fees before penalties. |
| 2 | yes | **yes** | "Clear all four buckets of the oldest eligible instalment in full before any money touches the next instalment." | The spec specifies oldest-first, clearing all four buckets fully before the next instalment, matching the reference strategy. |
| 3 | yes | **yes** | "the surplus is held as an unallocated credit balance on the loan... Is auto-applied to the next instalment when it falls due... Is never auto-refunded to the borrower." | Surplus held as unallocated credit balance, auto-applied at next due instalment, never auto-refunded — matches the reference exactly. |
| 4 | yes | **yes** | "All amounts are denominated in BHD, whose minor unit (fils) has 3 decimal places." | Currency is BHD with 3-decimal minor unit (fils), matching the reference precision. |
| 5 | yes | **yes** | "Every computed amount is rounded to 3 decimal places using round-half-up." | Round half-up to 3 dp matches the reference rounding method. |
| 6 | yes | **yes** | "Any rounding residual is absorbed into the interest component, never into principal." | Residual absorbed into interest, not principal — matches the reference destination. |
| 7 | yes | **yes** | "Interest accrues daily up to and including the payment's value_date. The function recomputes accrued interest to that date; interest is not a static supplied figure." | The spec recomputes interest to value_date before allocation, which covers the back-valued (earlier value_date) case in the reference. |
| 8 | yes | **yes** | "Does not prepay future or not-yet-due principal." and Excluded: "Prepayment of future or not-yet-due principal." | Surplus from an early payment becomes a credit balance and does not prepay principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | "Allocation is strict-order fill... There is no proportional split across buckets or instalments." | Strict in-order fill with explicit rejection of proportional split matches the reference for sub-bucket partial payments. |
| 10 | no | no | absent | The spec contains no write-off tolerance; nothing about marking an instalment fully paid when a small residual (≤ 0.005 BHD) remains. The reference's tolerance policy is unaddressed. |
| 11 | yes | **yes** | "Negative payment: rejected with an error." and "Zero payment: processed as a no-op... a zero-value allocation transaction is still recorded." | Negative rejected with error; zero is a no-op that still records a zero-value transaction — matches the reference exactly. |
| 12 | yes | **yes** | "Penalties also accrue up to and including the value_date, and are recomputed before allocation." | Penalties accrue to and including value_date, then allocation runs on post-accrual balances, matching the reference. |
| 13 | no | no | absent | The spec treats a single incoming payment and never addresses ordering of multiple same-day payments; no FIFO-by-timestamp rule appears. |
| 14 | yes | no | "The allocation breakdown... The loan's updated balances after allocation... the resulting unallocated credit balance. A recorded allocation transaction." | The spec returns per-bucket per-instalment amounts, outstanding balances, and credit balance, but omits the tolerance_written_off field required by the reference result shape, so it does not match exactly. |
