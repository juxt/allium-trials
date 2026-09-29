# superpowers — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 11 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ Architectural work under the brainstorming process requires eliciting the material allocation policies before writing any spec; these five are decisions the institution has picked and cannot be safely inferred.

Q: When a payment is applied to a single instalment, in what order are its components paid off — penalties, then fees, then interest, then principal, or some other sequence?
A: Fees first, then penalties, then interest, then principal.

Q: When several instalments are outstanding, does a payment clear the oldest instalment fully before moving to the next, or is it spread across instalments some other way (e.g. all penalties across every instalment first)?
A: Oldest instalment is cleared in full across all four buckets before any amount moves to the next instalment.

Q: If the payment is larger than everything currently owed, what happens to the excess — is it held as a credit, applied to future (not-yet-due) instalments, or returned to the borrower?
A: Surplus is held as an unallocated credit balance and auto-applied when the next instalment falls due. It is never auto-refunded.

Q: If the payment is smaller than a single component it lands on (a partial payment), do you apply what you can and leave a residual, or reject/hold the payment until it can cover that component?
A: Apply what you can and leave a residual — strict bucket order, no proportional split, no hold.

Q: What are the rounding rules for allocation — to the minor currency unit (e.g. whole pence), and how is any rounding remainder handled?
A: Round half-up to 3 decimal places (the loan is denominated in BHD). Any rounding residual is absorbed into the interest component.

### Round 2
_Step reasoning:_ Bucket order, cross-instalment order, surplus, partials and rounding are settled; still-material policies remain on prior credit interaction, invalid-payment handling, whether interest is fixed or accrues, and the function's return contract.

Q: Does an existing unallocated credit balance on the loan get combined with the incoming payment and allocated together in this call, or does `allocate_payment` only allocate the new payment and leave any prior credit untouched?
A: [default, not policy] allocate_payment only allocates the new incoming payment. Existing credit balance is applied separately when the next instalment falls due, not combined with the incoming payment in this call.

Q: How should the function handle a zero or negative payment amount — reject it, treat it as a no-op, or is that an invalid input the caller must prevent?
A: Negative payment amounts are rejected with an error. A zero payment is a no-op but still records a zero-value allocation transaction — it is not rejected.

Q: Within a single instalment, the bucket order is fees, penalties, interest, principal — but does interest accrue or change as part of allocation (e.g. daily interest recalculated at payment date), or are the four component amounts fixed values already recorded on each instalment that the payment simply draws down?
A: The component amounts are not fixed at call time. Penalties accrue up to and including the value_date before allocation runs, and for a back-valued payment (value_date earlier than today) interest is recomputed to that value_date first. Allocation then draws down the post-accrual balances.

Q: Does `allocate_payment` mutate the loan in place, or return a new loan state alongside the allocation breakdown — and what does the returned allocation need to itemise (per-instalment, per-bucket amounts, plus resulting balances and any credit)?
A: Return a new loan state alongside the allocation breakdown — do not mutate in place. The returned allocation must itemise, per instalment and per bucket: amount applied, resulting outstanding balance, any credit_balance created and any tolerance_written_off.

### Round 3
_Step reasoning:_ The stakeholder's own itemisation introduced `tolerance_written_off`, but the write-off policy (threshold and treatment) is an undefined material rule I cannot infer, so the process is not yet complete.

Q: Your itemisation includes a `tolerance_written_off` field, which implies a write-off rule that hasn't been defined yet. When an instalment is left with a tiny residual outstanding after allocation, is there a tolerance threshold below which that residual is written off and the instalment treated as fully settled? If so, what is the threshold (a fixed minor-unit amount, a percentage, or per-bucket), and does the written-off amount come off the interest bucket like the rounding residual or is it tracked separately?
A: Yes. If the total remaining owed on an instalment after allocation is ≤ 0.005 BHD, the instalment is marked fully paid and the residual is written off. The threshold is a fixed amount (0.005 BHD), not a percentage and not per-bucket. The written-off amount is tracked separately as tolerance_written_off — it is not absorbed into the interest component like a rounding residual.

### Round 4
_Step reasoning:_ Round 2 introduced value_date and defined the back-valued case explicitly, leaving the symmetric future-dated case as a genuine, non-inferable policy gap worth closing before design.

Q: You've defined how a back-valued payment (value_date earlier than today) is handled, but not the forward case: can `allocate_payment` receive a future value_date (a post-dated payment)? If so, is interest projected forward to that date before allocation, or are future-dated payments rejected or held until the value_date arrives?
A: [default, not policy] Post-dated payments are rejected — value_date must not be later than the processing date. The caller must submit the payment on or after the value_date.

### Round 5 (process signalled done)
_Step reasoning:_ Every material policy dimension is now pinned (bucket order, cross-instalment order, surplus credit, partial residual, rounding, credit handling, zero/negative input, accrual and back-valuing, return shape, tolerance write-off, post-dating); the last two rounds returned default non-policy answers, signalling diminishing returns, so requirements capture is complete.

(no questions this round)

## Produced specification

# Design specification — payment allocation for loan servicing

## Purpose and context

We are adding payment allocation to the loan servicing system. When a borrower makes a payment against a loan, that money must be applied across what the borrower currently owes. A loan can carry several outstanding instalments at once, and each instalment is made up of four components: fees, penalties, interest and principal. This specification defines a single function, `allocate_payment(payment, loan)`, that decides how an incoming payment is applied and reports both the allocation breakdown and the loan's updated balances.

The function is pure with respect to the loan: it does not mutate the loan passed in. It returns a new loan state alongside an itemised allocation. Everything below records a policy the institution has settled on. Where a point was resolved as a sensible default rather than an explicit policy, that is called out inline.

## Interface

```
allocate_payment(payment, loan) -> { allocation, loan_after }
```

- `payment` carries at least an `amount` and a `value_date` (the date the payment is treated as effective for accrual purposes).
- `loan` carries its outstanding instalments (each with fees, penalties, interest and principal balances and a due date), any existing unallocated `credit_balance`, and whatever accrual inputs are needed to bring penalties and interest up to date.
- The function returns a new loan state (`loan_after`) and the allocation breakdown. The input loan is never mutated in place.

## Input validation and edge cases

**Negative payment.** A negative `amount` is rejected with an error. Allocation does not proceed.

**Zero payment.** A zero `amount` is a no-op: nothing is allocated and no balances change. It is not rejected. A zero-value allocation transaction is still recorded, so the call produces a breakdown itemising zero applied to every bucket.

**Post-dated payment.** `value_date` must not be later than the processing date. A future `value_date` is rejected; the caller must submit the payment on or after the value_date. (Resolved as a default, not an explicit institutional policy: there is no projection of interest forward to a future value_date and no held/post-dated queue.)

## Accrual before allocation

The four component amounts are not fixed at call time. Before any money is drawn down, the instalment balances are brought current as of the payment's `value_date`:

1. **Penalties accrue up to and including the `value_date`.**
2. **For a back-valued payment** (a `value_date` earlier than the processing date), **interest is recomputed to that `value_date`** before allocation.

Allocation then draws down these post-accrual balances. Fees and principal are taken as recorded; penalties and interest reflect the accrual step above.

## Allocation order

**Within a single instalment**, components are paid off in strict bucket order:

1. Fees
2. Penalties
3. Interest
4. Principal

**Across multiple outstanding instalments**, the oldest instalment is cleared in full across all four buckets before any amount moves to the next instalment. There is no cross-instalment sweeping of a single bucket type (for example, penalties are not collected across every instalment first). Oldest-first, fully settled, then move on.

**Partial payments** follow the same strict order. Apply as much as the payment can cover, in bucket order, and leave a residual outstanding on the first bucket the payment cannot fully cover. There is no proportional split across buckets and no hold or rejection when the payment falls short of a component: whatever can be applied is applied, and the rest of that bucket and all later buckets remain outstanding.

## Surplus and existing credit

**Surplus.** If the payment is larger than everything currently owed, the excess is held as an unallocated credit balance on the loan. It is auto-applied when the next instalment falls due. It is never auto-refunded to the borrower.

**Existing credit balance.** `allocate_payment` allocates only the new incoming payment. Any pre-existing unallocated credit on the loan is left untouched by this call; it is applied separately when the next instalment falls due, not combined with the incoming payment here. (Resolved as a default, not an explicit institutional policy.)

## Rounding

The loan is denominated in BHD. All allocation arithmetic rounds half-up to three decimal places (the minor unit for BHD). Any rounding residual produced by allocation is absorbed into the interest component. This absorption is distinct from the tolerance write-off described below.

## Tolerance write-off

After allocation, if the total remaining owed on an instalment is less than or equal to 0.005 BHD, that instalment is marked fully paid and the residual is written off. The threshold is a fixed minor-unit amount (0.005 BHD): it is not a percentage and not evaluated per bucket, but against the instalment's total remaining balance.

The written-off amount is tracked separately, reported as `tolerance_written_off`. Unlike the rounding residual, it is not absorbed into the interest component.

## Return value

The function returns a new loan state (`loan_after`) and an allocation breakdown. It does not mutate the loan in place.

The allocation itemises, per instalment and per bucket (fees, penalties, interest, principal):

- the **amount applied** to that bucket,
- the **resulting outstanding balance** of that bucket,

and, per instalment or per loan as appropriate:

- any **`credit_balance`** created (the unallocated surplus held for the next instalment),
- any **`tolerance_written_off`** (residual written off under the 0.005 BHD tolerance).

For a zero payment, this breakdown is still produced with zero amounts applied, recording the zero-value transaction.

## Testing

Coverage should exercise, at minimum:

- **Bucket order within one instalment**: a payment that stops part-way leaves the residual on the correct bucket, fees before penalties before interest before principal.
- **Oldest-first across instalments**: the oldest instalment is fully settled across all four buckets before the next receives anything.
- **Partial payment**: apply-what-you-can with a residual, no proportional split, no hold.
- **Surplus**: excess becomes an unallocated credit balance, never a refund.
- **Negative payment rejected; zero payment recorded as a zero allocation; post-dated payment rejected.**
- **Back-valued payment**: penalties accrued to value_date and interest recomputed to value_date before draw-down.
- **Rounding**: half-up to three decimals with the residual absorbed into interest.
- **Tolerance write-off**: an instalment left owing ≤ 0.005 BHD is marked fully paid, with the residual reported as `tolerance_written_off` and not folded into interest.
- **No mutation**: the input loan is unchanged; `loan_after` carries the new state.


## Auditor verdict

_The spec matches 13 of 14 reference decisions. It correctly captures all the genuinely bespoke choices (bucket order with fees before penalties, oldest-first full clearance, credit-balance surplus handling, BHD 3-dp precision, half-up rounding, residual-into-interest, back-valued re-accrual, 0.005 BHD tolerance write-off, penalty accrual-then-allocate, and the return shape). The single gap is decision 13: same-day multiple payments (FIFO by receipt timestamp, allocated independently) is never addressed. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Allocation order — Within a single instalment: "1. Fees 2. Penalties 3. Interest 4. Principal" | Spec states strict bucket order fees→penalties→interest→principal, exactly matching the reference (fees deliberately before penalties). |
| 2 | yes | **yes** | "the oldest instalment is cleared in full across all four buckets before any amount moves to the next instalment. There is no cross-instalment sweeping of a single bucket type" | Matches reference: oldest instalment fully settled across all four buckets before touching the next, no bucket-across-instalments sweep. |
| 3 | yes | **yes** | Surplus: "the excess is held as an unallocated credit balance on the loan. It is auto-applied when the next instalment falls due. It is never auto-refunded to the borrower." | Exactly matches: credit balance held, auto-applied at next instalment, never auto-refunded. |
| 4 | yes | **yes** | Rounding: "The loan is denominated in BHD. All allocation arithmetic rounds half-up to three decimal places (the minor unit for BHD)." | Correctly identifies BHD with 3 decimal places as the minor unit, matching the reference. |
| 5 | yes | **yes** | Rounding: "All allocation arithmetic rounds half-up to three decimal places" | Round half-up to the 3-dp minor unit matches the reference rounding method exactly. |
| 6 | yes | **yes** | Rounding: "Any rounding residual produced by allocation is absorbed into the interest component." | Residual destination is the interest component, matching the reference, and explicitly distinguished from tolerance write-off. |
| 7 | yes | **yes** | Accrual before allocation: "For a back-valued payment (a value_date earlier than the processing date), interest is recomputed to that value_date before allocation." | Back-valued payments trigger interest recomputation to the value_date before allocation, exactly as the reference states. |
| 8 | yes | **yes** | Surplus: "the excess is held as an unallocated credit balance on the loan. It is auto-applied when the next instalment falls due." (settles current owed only, no principal prepay) | Surplus becomes a held credit balance rather than reducing principal, so future interest is unchanged; this mechanism matches the reference's early/on-time surplus handling, though 'future interest unchanged' is entailed rather than stated verbatim. |
| 9 | yes | **yes** | "Partial payments follow the same strict order... There is no proportional split across buckets and no hold or rejection when the payment falls short of a component" | Strict in-order fill with no proportional split matches the reference for partial payments below the first bucket. |
| 10 | yes | **yes** | Tolerance write-off: "if the total remaining owed on an instalment is less than or equal to 0.005 BHD, that instalment is marked fully paid and the residual is written off." | ≤ 0.005 BHD threshold against the instalment total, marking fully paid and writing off the residual, matches the reference exactly. |
| 11 | yes | **yes** | "A negative amount is rejected with an error." and "A zero amount is a no-op... A zero-value allocation transaction is still recorded" | Negative rejected with error and zero as a no-op that still records a zero-value allocation transaction both match the reference precisely. |
| 12 | yes | **yes** | "Penalties accrue up to and including the value_date." and "Allocation then draws down these post-accrual balances." | Penalties accrue up to and including the value_date, then allocation runs on post-accrual balances, matching the reference accrue-then-allocate order. |
| 13 | no | no | absent | The spec treats a single incoming payment and never addresses ordering of multiple same-day payments or FIFO by receipt timestamp; the reference FIFO-independent-allocation policy is not covered. |
| 14 | yes | **yes** | Return value: itemises "the amount applied to that bucket, the resulting outstanding balance... any credit_balance created... any tolerance_written_off" per instalment/bucket | Return shape covers per-bucket amount applied, resulting outstanding balances, credit_balance created and tolerance_written_off, matching the reference result shape. |
