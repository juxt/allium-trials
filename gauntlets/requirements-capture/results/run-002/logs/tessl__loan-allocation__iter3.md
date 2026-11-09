# tessl — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 7 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ Allocation order across components and instalments is the core policy the brief omits and cannot be inferred, so I ask that highest-impact question first, one at a time.

Q: When a payment is applied, in what order should it absorb the outstanding components, and does that order run per-instalment or across all instalments at once? For example: oldest instalment first, settling penalties then fees then interest then principal within each before moving to the next; or sweep one component type across every instalment before the next type?
A: Oldest instalment first, cleared in full across all four buckets before any money touches the next instalment. Within each instalment the order is: fees, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Allocation order is settled; the next highest-impact gap is what happens to an overpayment that exceeds total amounts owed.

Q: If the payment is larger than the total currently outstanding across all instalments, how should the excess be handled: returned/refunded to the borrower, held as an unapplied credit on the loan, applied as an early prepayment of principal on future (not-yet-due) instalments, or something else?
A: Surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay principal on future instalments.

### Round 3
_Step reasoning:_ Order and surplus are settled; rounding/precision materially changes every returned figure and cannot be inferred, so I clarify it before moving to remaining edge cases.

Q: How should rounding be handled during allocation: to what precision are the figures carried (e.g. whole currency minor units/cents, or more decimal places), what rounding rule applies (half-up, half-even, truncate), and if rounding leaves a residual within an instalment, which bucket absorbs it?
A: Figures are carried and rounded to 3 decimal places (BHD fils). The rounding rule is half-up. Any residual within an instalment caused by rounding is absorbed into the interest bucket.

### Round 4
_Step reasoning:_ Order, surplus and rounding are settled, but instalment eligibility (the scope boundary between due and not-yet-due instalments) is still ambiguous and the surplus answer only gestured at it.

Q: Which instalments is an incoming payment allowed to settle: only those currently due or overdue as of the payment date, or every outstanding instalment including ones not yet due? Your surplus answer implied future instalments aren't touched by the main allocation, so I want to pin down exactly what makes an instalment eligible to receive the payment.
A: Only instalments that are due or overdue as of the payment value_date are eligible for allocation. Future instalments that have not yet fallen due are not touched. Any surplus beyond what is owed on eligible instalments becomes a credit balance, applied automatically when the next instalment reaches its due date.

### Round 5
_Step reasoning:_ Core order, surplus, rounding and eligibility are pinned; the one remaining material, non-inferable policy is how a pre-existing credit balance interacts with a fresh payment during allocation.

Q: At the moment a new payment arrives, if the loan already carries an unallocated credit balance from a previous overpayment, how should `allocate_payment` treat it: is the existing credit combined with the incoming payment and allocated together against the eligible instalments, applied first (before the new money) only if an instalment has since become due, or left entirely untouched so that this call allocates only the incoming payment amount?
A: The existing credit balance is left entirely untouched by `allocate_payment`. The call allocates only the incoming payment amount against eligible instalments. Auto-application of any credit balance is a separate mechanism triggered when an instalment reaches its due date, not by the arrival of a new payment. [default, not policy — the key specifies auto-apply on due date but does not address interaction with a concurrent incoming payment call]

### Round 6
_Step reasoning:_ Core policies (order, surplus, rounding, eligibility, credit interaction) are settled; whether interest is accrued to value_date or taken as recorded is a material, non-inferable policy still open.

Q: Are the four component figures (fees, penalties, interest, principal) on each eligible instalment taken as the static amounts already recorded on the instalment as of the value_date, or should `allocate_payment` first accrue/recalculate interest (and any penalties) up to the value_date before allocating against them?
A: Allocate_payment accrues both interest and penalties up to and including the value_date first; allocation then runs against those post-accrual balances, not the static figures already recorded.

### Round 7
_Step reasoning:_ Core allocation, surplus, rounding, eligibility, credit interaction and accrual are pinned; the remaining material policy gap is the contract for the payment input itself (zero, negative, reversals), which is institution-chosen and not inferable.

Q: Can the incoming `payment` amount be zero or negative, and should `allocate_payment` ever handle a reversal or clawback (money taken back off the loan), or is its contract strictly a single positive payment where zero/negative inputs are rejected as an error?
A: Negative amounts are rejected with an error. Zero is accepted as a no-op: no buckets are touched, but a zero-value allocation transaction is still recorded. Reversals and clawbacks are outside the contract of `allocate_payment`; that function handles only incoming payments. [default, not policy — the key does not define a reversal mechanism]

### Round 8 (process signalled done)
_Step reasoning:_ Seven rounds have pinned every material allocation policy — component and instalment ordering, surplus/credit handling, rounding, eligibility, accrual timing, credit interaction and input validation — and the last two answers already fell into 'default, not policy' territory, signalling the policy space is exhausted; remaining details are inferable implementation choices, so the interview is complete.

(no questions this round)

## Produced specification

# Requirements Specification — `allocate_payment(payment, loan)`

## 1. Overview

We are adding payment allocation to the loan servicing system. When a borrower makes a payment, `allocate_payment(payment, loan)` applies the money across what the borrower currently owes and returns both how the payment was applied and the loan's updated balances.

A loan may carry several outstanding instalments. Each instalment has four component buckets: fees, penalties, interest and principal. This specification records every policy decision confirmed with the stakeholder during requirement gathering, and resolves anything left open strictly as the gathering process dictates (open points are either carried as stated defaults or flagged as out of scope — no stakeholder answers have been invented).

## 2. Scope

### In scope
- Allocating a single incoming positive payment across eligible outstanding instalments.
- Accruing interest and penalties up to the value_date before allocation.
- Ordering allocation across instalments and across buckets within an instalment.
- Handling surplus (payment larger than total owed on eligible instalments).
- Rounding of all figures during allocation.
- Accepting a zero payment as a recorded no-op.
- Returning the applied breakdown and the loan's updated balances.

### Out of scope
- Reversals and clawbacks (money taken back off the loan). `allocate_payment` handles only incoming payments. [default, not policy — no reversal mechanism was defined]
- Auto-application of an existing credit balance. That is a separate mechanism triggered when an instalment reaches its due date, not by this function.
- Prepayment of principal on future (not-yet-due) instalments.
- Refunding money to the borrower.

## 3. Core behaviour (happy path)

Given a positive `payment` and a `loan` with one or more instalments:

1. **Validate the payment amount** (see §6).
2. **Determine eligibility.** Select only instalments that are due or overdue as of the payment `value_date`. Instalments that have not yet fallen due are not eligible and are not touched.
3. **Accrue to value_date.** For each eligible instalment, accrue both interest and penalties up to and including the `value_date`. Allocation runs against these post-accrual balances, not the static figures already recorded on the instalment.
4. **Allocate oldest instalment first.** Process eligible instalments from oldest to newest. An instalment must be cleared in full across all four buckets before any money touches the next instalment.
5. **Within each instalment, allocate in bucket order:** fees, then penalties, then interest, then principal. Each bucket is filled (up to its outstanding amount) before moving to the next.
6. **Handle surplus.** Any amount remaining after every eligible instalment is fully settled is held as an unallocated credit balance on the loan. It is never auto-refunded, and it does not prepay principal on future instalments. It will be auto-applied to the next instalment when that instalment falls due (by the separate due-date mechanism, not by this function).
7. **Return** the allocation breakdown and the loan's updated balances (see §7).

## 4. Allocation order (authoritative)

- **Across instalments:** oldest first. Fully settle an instalment across all four buckets before any money reaches the next instalment.
- **Within an instalment:** fees → penalties → interest → principal.

This order is per-instalment: the full four-bucket waterfall completes on the oldest eligible instalment before the next instalment is considered. It is not a sweep of one component type across all instalments.

## 5. Rounding and precision

- All figures are carried and rounded to **3 decimal places** (BHD fils).
- The rounding rule is **half-up**.
- If rounding leaves a residual within an instalment, the residual is absorbed into the **interest** bucket of that instalment.

## 6. Input validation and edge cases

- **Negative payment:** rejected with an error.
- **Zero payment:** accepted as a no-op. No buckets are touched, but a zero-value allocation transaction is still recorded. [default, not policy — the key does not define a reversal mechanism; zero handling confirmed by stakeholder]
- **Payment exceeds total owed on eligible instalments:** the excess becomes an unallocated credit balance on the loan (see §3.6).
- **No eligible instalments (none due or overdue):** the entire payment becomes an unallocated credit balance; no buckets are touched.

## 7. Interaction with an existing credit balance

When a new payment arrives, if the loan already carries an unallocated credit balance from a previous overpayment:

- The existing credit balance is **left entirely untouched** by `allocate_payment`.
- The call allocates **only the incoming payment amount** against eligible instalments.
- Auto-application of any credit balance is a separate mechanism triggered when an instalment reaches its due date, not by the arrival of a new payment. [default, not policy — the key specifies auto-apply on due date but does not address interaction with a concurrent incoming payment call]

## 8. Output

`allocate_payment` returns:
- **Application breakdown:** how the payment was applied, per eligible instalment and per bucket (fees, penalties, interest, principal), reflecting post-accrual balances.
- **Updated loan balances:** the remaining outstanding amounts per instalment and bucket after allocation.
- **Unallocated credit balance:** any surplus newly held on the loan as a result of this call (added to, but kept distinct from, any pre-existing untouched credit balance).
- **Allocation transaction record:** always recorded, including the zero-value transaction for a zero payment.

## 9. Constraints

- **Precision/rounding:** 3 decimal places, half-up, interest absorbs residuals (§5).
- **Eligibility:** strictly instalments due or overdue as of `value_date` (§3.2).
- **Accrual:** interest and penalties accrued up to and including `value_date` before allocation (§3.3).
- **Compatibility:** `allocate_payment` is strictly a single incoming-payment contract; reversals, clawbacks, refunds and future-instalment prepayment are excluded (§2).

## Auditor verdict

_The spec covers 11 of 14 decisions correctly. It nails the genuinely bespoke policy choices (bucket order with fees-first, oldest-in-full, credit-balance surplus handling, BHD 3 dp, half-up, residual-into-interest, value-date accrual, no principal prepay) as well as the inferable ones (strict order #9, negative-reject/zero-noop #11). The gap is the write-off tolerance (#10, entirely absent), same-day FIFO ordering (#13, not addressed since the spec is single-payment and never states receipt-timestamp ordering), and the result shape (#14, which omits tolerance_written_off as a consequence of #10). Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §4: "Within an instalment: fees → penalties → interest → principal." | Spec states the exact bucket order including fees before penalties, matching the reference's deliberately non-default sequence. |
| 2 | yes | **yes** | §3.4 / §4: "An instalment must be cleared in full across all four buckets before any money touches the next instalment." | Matches the reference: oldest instalment cleared in full across all buckets before any money reaches the next; explicitly not a per-bucket sweep. |
| 3 | yes | **yes** | §3.6: "held as an unallocated credit balance on the loan. It is never auto-refunded... It will be auto-applied to the next instalment when that instalment falls due." | Captures all three reference elements: credit balance, auto-apply on next due instalment, never auto-refunded. |
| 4 | yes | **yes** | §5: "All figures are carried and rounded to 3 decimal places (BHD fils)." | Spec explicitly names BHD and 3 dp precision, matching the reference exactly. |
| 5 | yes | **yes** | §5: "The rounding rule is half-up." | Half-up rounding to the minor unit matches the reference. |
| 6 | yes | **yes** | §5: "the residual is absorbed into the interest bucket of that instalment." | Residual destination is the interest component, matching the reference. |
| 7 | yes | **yes** | §3.3: "accrue both interest and penalties up to and including the value_date. Allocation runs against these post-accrual balances, not the static figures already recorded." | Accruing to value_date before allocation produces the back-valued recomputation the reference requires when value_date is earlier than today, though the spec does not call out the earlier-than-today case by name. |
| 8 | yes | **yes** | §2 out of scope: "Prepayment of principal on future (not-yet-due) instalments"; §3.6: surplus "does not prepay principal on future instalments." | Eligibility (§3.2) limits settlement to due/overdue instalments and surplus becomes a credit balance without prepaying principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | §3.5: "Each bucket is filled (up to its outstanding amount) before moving to the next"; §4 authoritative order. | Strict in-order bucket filling, no proportional split, matches the reference. |
| 10 | no | no | absent | No write-off tolerance is defined anywhere; §5's residual-into-interest rule is a rounding residual, not a tolerance write-off of near-complete payments. |
| 11 | yes | **yes** | §6: "Negative payment: rejected with an error. Zero payment: accepted as a no-op... a zero-value allocation transaction is still recorded." | Both branches match the reference: negative rejected, zero a no-op that still records a zero-value transaction. |
| 12 | yes | **yes** | §3.3: "accrue both interest and penalties up to and including the value_date. Allocation runs against these post-accrual balances." | Penalties accrue up to and including the value date, then allocation runs on post-accrual balances — matches the reference accrue-then-allocate order. |
| 13 | no | no | absent | The spec treats each call as a single incoming payment and §7 says it allocates only the incoming amount, but it never addresses ordering of multiple same-day payments by receipt timestamp (FIFO), which is the material non-inferable element. |
| 14 | yes | no | §8: application breakdown per instalment/bucket, updated loan balances, unallocated credit balance, allocation transaction record. | Three of the four reference fields are present (bucket breakdown, outstanding balances, credit_balance), but tolerance_written_off is absent from the result shape, so it does not fully match. |
