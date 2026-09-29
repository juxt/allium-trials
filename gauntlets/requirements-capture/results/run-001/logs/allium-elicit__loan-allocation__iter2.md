# allium-elicit — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 20 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material policy decision, so I open with scope, result shape, and the core allocation method before edge cases.

Q: What is the boundary of this specification, and is the result shape in scope: what exactly must `allocate_payment` return, field by field (the applied breakdown, the loan's updated balances, any receipt or record)?
A: `allocate_payment` is the boundary of the specification. The result shape is in scope. Per payment, return: the amount applied to each bucket (fees, penalties, interest, principal) for each instalment touched; the resulting outstanding balance per instalment after allocation; any `credit_balance` created; and any `tolerance_written_off` amount.

Q: When a payment is applied, in what order are the four components taken within a single instalment: penalties, fees, interest, principal? Is that order fixed, or configurable?
A: Fixed order, not configurable: fees first, then penalties, then interest, then principal.

Q: When several instalments are outstanding, in what order are they paid off (oldest-due first, most-overdue first, something else), and does the whole payment work through one instalment's components before moving to the next, or clear one component type across all instalments first?
A: Oldest-due instalment first. All four buckets of that instalment are cleared in full before any money moves to the next instalment.

Q: What unit and precision are amounts held in (currency minor units, decimal places), and when a split leaves a remainder, which way does it round and where does the remainder land?
A: The loan is denominated in BHD; amounts are held to 3 decimal places (fils). Rounding is half-up to 3 dp. Any rounding residual is absorbed into the interest component.

Q: What happens with an overpayment (payment exceeds total owed): is the surplus refunded, held as a credit, applied to future instalments, or applied to principal early? And what about a partial payment that only covers some of what's due?
A: Overpayment: surplus is held as an unallocated credit balance, auto-applied to the next instalment when it falls due, and never auto-refunded. It does not prepay principal; future interest is unchanged. Partial payment: strict bucket order applies — fill each bucket in sequence with no proportional split.

Q: How should edge inputs be handled: zero, negative, or a payment against a loan with nothing outstanding (fully paid or closed)? Rejected, ignored, or recorded?
A: Negative payments are rejected with an error. A zero payment is a no-op but still records a zero-value allocation transaction. Payment against a fully paid or closed loan: [default, not policy] — treat as overpayment; surplus goes to credit balance.

Q: Is this purely the normal-course allocation, or must it also handle events over the loan's life: early payoff, reversal or correction of a prior payment, back-dated or effective-dated payments, and interest that has accrued since the last instalment? Which of these are in scope?
A: Back-dated payments (value_date earlier than today) are in scope: interest is recomputed to that value_date and penalties accrue up to and including it, then allocation runs on the post-accrual balances. Early payoff and reversal or correction of prior payments are [default, not policy] out of scope for this specification.

### Round 2
_Step reasoning:_ Several material policy classes remain unasked: the tolerance write-off rule (a field is returned but its policy was never defined), the day-count and penalty accrual convention for back-dated recomputation, the oldest-due tie-break, and how credit auto-application actually runs.

Q: The result shape includes a `tolerance_written_off` amount, but the write-off policy was never established. Under what condition is a residual shortfall written off to `tolerance_written_off` rather than left outstanding? Is there a tolerance threshold (an absolute BHD/fils amount, or a proportion), does it apply per bucket, per instalment, or per whole payment, and once an amount is written off is that instalment then treated as fully settled?
A: Residual owed after allocation that is less than or equal to 0.005 BHD causes the instalment to be marked fully paid and the residual recorded as `tolerance_written_off`. The threshold is absolute (0.005 BHD), applies per instalment, and once written off the instalment is treated as fully settled.

Q: For back-dated payments you said interest is recomputed and penalties accrue up to the value_date. What day-count convention governs the interest recomputation (e.g. 30/360, actual/360, actual/365), and what is the penalty accrual method and rate? Also, are these accrued figures computed inside `allocate_payment`, or supplied on the loan/instalment as already-accrued values as of the value_date (i.e. outside this boundary)?
A: The day-count convention, penalty rate, and accrual method are [default, not policy] — not established in policy. On boundary: the accrued interest and penalty figures as of the value_date are supplied to `allocate_payment` as already-computed values on the instalment; recomputation is performed outside this specification's boundary before calling `allocate_payment`.

Q: You said instalments are paid oldest-due first. When two outstanding instalments share the same due date, what breaks the tie (e.g. lowest instalment number, largest balance, some other key)?
A: Tie-breaking between two instalments sharing the same due date is [default, not policy] — use lowest instalment number as the tiebreaker.

Q: When a held credit balance is auto-applied to the next instalment as it falls due, does that application follow the same fees -> penalties -> interest -> principal bucket order, and is it performed by `allocate_payment` itself or by a separate process outside this specification's boundary?
A: The bucket order (fees → penalties → interest → principal) and the auto-application mechanics for a held credit balance are [default, not policy] — not established in policy. The trigger and execution of that auto-application (whether by `allocate_payment` or a separate process) is also [default, not policy] — outside this specification's boundary.

### Round 3
_Step reasoning:_ Core policies are captured, but two material within-boundary decisions remain unasked: whether an existing credit balance is consumed alongside the incoming payment, and exactly which instalments count as eligible as of value_date.

Q: When `allocate_payment` runs on a loan that already holds a `credit_balance` from a prior overpayment, is that pre-existing credit combined with the incoming payment and allocated together, or is only the new payment amount allocated and the existing credit left untouched (its auto-application being out of boundary)?
A: Only the new payment amount is allocated; the pre-existing credit_balance is left untouched by this call. As established in Round 2, the auto-application of a held credit is outside this specification's boundary.

Q: As of the value_date, which instalments does the allocation walk consider 'outstanding' and eligible: only instalments whose due date has passed, or every instalment carrying any balance (including a not-yet-due current instalment)? You said surplus becomes credit rather than prepaying principal, so I want to confirm a normal payment never reaches a future instalment's buckets directly.
A: Only instalments whose due date falls on or before the value_date are eligible. A payment never reaches a future (not-yet-due) instalment's buckets directly — any surplus becomes a credit balance, as established.

### Round 4
_Step reasoning:_ Core policy, units, ordering, thresholds, timing, edge inputs, surplus/shortfall and whole-life events are all settled; two genuinely material and unasked points remain: whether persistence sits inside the boundary and the exact result shape on rejection.

Q: Is `allocate_payment` a pure function that returns the allocation breakdown for the caller to persist, or does it itself record/persist the allocation transaction? I ask because you said a zero payment 'still records a zero-value allocation transaction' — I want to confirm whether recording/persistence sits inside this specification's boundary or outside it (the function returns the breakdown and a separate process writes it).
A: Recording sits inside this specification's boundary. `allocate_payment` itself records the allocation transaction — the zero-payment case makes this explicit: a zero-value allocation transaction is recorded even though no buckets are touched.

Q: When a negative payment is rejected 'with an error', how is that surfaced in the result shape: does `allocate_payment` raise/throw and return nothing, or return its normal result object with an error indicator and no allocation? And is any transaction recorded for a rejected negative payment, or nothing at all?
A: Negative payments: `allocate_payment` raises/throws an error and returns nothing — no normal result object is produced. No transaction is recorded for a rejected negative payment. [default, not policy on the specific error surface mechanism.]

### Round 5
_Step reasoning:_ Core policy is thoroughly covered, but two genuine result-shape/threshold ambiguities remain: reporting granularity of tolerance_written_off and credit_balance across multiple touched instalments, and whether tolerance write-off is unconditional on the cause of the residual.

Q: The result shape lists `tolerance_written_off` and `credit_balance` as per-payment figures, but the tolerance threshold applies per instalment and a single payment can walk several instalments (each potentially written off). Are `tolerance_written_off` and the newly-created `credit_balance` reported as single aggregate amounts for the whole payment, or broken down per instalment alongside the per-instalment bucket amounts?
A: Both `tolerance_written_off` and `credit_balance` are reported as single aggregate amounts for the whole payment, not broken down per instalment. The per-instalment breakdown covers only the bucket amounts (fees, penalties, interest, principal) and resulting outstanding balances; the write-off and credit figures are rolled up to payment level.

Q: Confirm the tolerance write-off is unconditional: does any per-instalment residual of 0.005 BHD or less after allocation get written off and the instalment marked fully paid regardless of why the shortfall arose, including a deliberate partial payment that happens to leave a few fils owing (so a borrower underpaying by <=0.005 per instalment would have each forgiven), or does the write-off apply only when the payment was otherwise sufficient to settle that instalment?
A: The write-off is unconditional. Any per-instalment residual of 0.005 BHD or less after allocation is written off and the instalment marked fully paid, regardless of why the shortfall arose. A deliberate partial payment leaving a few fils owing per instalment would have each such instalment forgiven. The threshold is a hard rule on the post-allocation residual, not a gate that checks whether the payment was 'intended' to settle in full.

### Round 6
_Step reasoning:_ Core policy is well-covered, but two genuinely unasked material ambiguities remain: where a rounding residual lands when the interest bucket cannot absorb it, and whether tolerance write-off fires on eligible instalments the payment never reached (including the zero-payment case) — both affect balances and the result shape.

Q: The rounding residual is absorbed into the interest component. What happens when the instalment being settled has a zero (or already fully paid) interest bucket, so there is nothing to absorb the residual into — does the residual then fall to another bucket (e.g. principal), get written off, or can this situation not arise given how amounts reach `allocate_payment`?
A: [default, not policy] The answer key does not address this edge case. As a default: if the interest bucket is zero or already fully paid when the rounding residual must be absorbed, the residual falls to the principal bucket instead. The situation should be rare given that accrued-interest figures are supplied pre-computed, but the fallback is principal rather than a silent write-off.

Q: Is the tolerance write-off evaluated against every eligible (due-on-or-before-value_date) instalment on each call, or only against instalments the payment actually reached? Concretely: for a zero payment, or for an eligible instalment lying beyond the point where the payment was exhausted, that already carries a residual of 0.005 BHD or less — is that instalment written off and marked fully paid even though no money reached it, or left untouched?
A: The tolerance check applies only to instalments the payment actually reached (i.e. where allocation ran and produced a post-allocation residual). An eligible instalment that the payment never reached — because funds were exhausted earlier — is left untouched; its existing balance is not re-evaluated for write-off by this call. A zero payment reaches no instalments, so no write-off is triggered regardless of any pre-existing small balances.

Q: The reported `resulting outstanding balance` is given 'per instalment touched'. For an instalment that is written off under tolerance without the payment reaching it (if that is possible per the previous question), and for eligible instalments the payment never reached, are those included in the per-instalment result rows or omitted entirely?
A: Only instalments the payment actually touched appear in the per-instalment result rows, consistent with the established result shape ('per instalment touched'). Eligible instalments the payment never reached are omitted entirely from the result. If, per the previous answer, a write-off can only arise on an instalment the payment reached, no additional row type is needed; if a future policy decision allows write-off on untouched instalments, those would then need their own rows, but that is not current policy.

### Round 7 (process signalled done)
_Step reasoning:_ Six rounds have resolved every relevant decision class (bucket and instalment ordering, tie-break, unit/precision/rounding and its fallback, overpayment/credit, partial payment, edge inputs, back-dating and eligibility, tolerance write-off scope and unconditionality, persistence, error surface, and aggregate-vs-per-instalment result shape); remaining probes return 'not policy', signalling the institutional policy surface is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
-- loan-allocation.allium

-- Scope: Payment allocation for a BHD-denominated instalment loan.
-- Boundary: the `allocate_payment` operation only. It takes one incoming
--   payment for a loan and produces a recorded allocation transaction: the
--   amount applied to each bucket of each instalment touched, the resulting
--   outstanding balance per instalment, any credit balance created and any
--   tolerance written off.
-- Includes:
--   - Allocation of a single incoming payment across eligible instalments
--   - Fixed bucket order (fees, penalties, interest, principal)
--   - Oldest-due-first instalment order with lowest-number tie-break
--   - Half-up rounding to 3 decimal places (fils), residual into interest
--   - Per-instalment tolerance write-off of residuals at or below 0.005 BHD
--   - Overpayment surplus held as an aggregate credit balance
--   - Back-dated payments allocated on pre-accrued balances as of value_date
--   - Recording of the allocation transaction (including the zero-payment case)
-- Excludes:
--   - Early payoff (out of boundary)
--   - Reversal or correction of a prior payment (out of boundary)
--   - Auto-application of a held credit balance to a future instalment: its
--     trigger and mechanics are outside this boundary
--   - Recomputation of accrued interest and penalties: the accrued figures as
--     of value_date are supplied pre-computed on each instalment
--   - Day-count convention, penalty rate and penalty accrual method: upstream
--     of this boundary, not established in policy
-- Amounts: all Decimal, denominated in BHD and held to 3 decimal places
--   (fils). Rounding is half-up to 3 dp.

config {
    -- Per-instalment post-allocation residual at or below this is written off.
    tolerance_threshold: Decimal = 0.005
}

entity Loan {
    reference: String

    -- Credit held from prior overpayment. This call never consumes or
    -- reallocates a pre-existing balance; it only adds any new surplus.
    credit_balance: Decimal

    instalments: Instalment with loan = this
}

entity Instalment {
    loan: Loan
    instalment_number: Integer
    due_date: Timestamp

    -- Outstanding balance per bucket. For a back-dated payment these already
    -- reflect interest and penalties accrued up to and including value_date;
    -- the accrual itself happens upstream of this boundary. An instalment is
    -- outstanding while total_outstanding > 0 and fully settled at 0; a
    -- tolerance write-off drives the residual to 0 (see ToleranceWriteOff).
    fees_outstanding: Decimal
    penalties_outstanding: Decimal
    interest_outstanding: Decimal
    principal_outstanding: Decimal

    total_outstanding: fees_outstanding + penalties_outstanding + interest_outstanding + principal_outstanding
}

entity Payment {
    loan: Loan
    amount: Decimal
    value_date: Timestamp
}

-- The recorded result of allocate_payment: the return value made durable.
entity AllocationTransaction {
    payment: Payment
    lines: List<InstalmentAllocation>

    -- Aggregate figures for the whole payment, not broken down per instalment.
    credit_balance_created: Decimal
    tolerance_written_off: Decimal
}

-- One row per instalment the payment actually touched. Eligible instalments
-- the payment never reached are omitted entirely.
entity InstalmentAllocation {
    instalment: Instalment

    fees_applied: Decimal
    penalties_applied: Decimal
    interest_applied: Decimal
    principal_applied: Decimal

    resulting_fees_outstanding: Decimal
    resulting_penalties_outstanding: Decimal
    resulting_interest_outstanding: Decimal
    resulting_principal_outstanding: Decimal

    resulting_total_outstanding: resulting_fees_outstanding + resulting_penalties_outstanding + resulting_interest_outstanding + resulting_principal_outstanding
}

rule AllocatePayment {
    when: AllocatePayment(l, payment)
    requires: payment.loan = l and payment.amount >= 0

    -- Only instalments whose due date falls on or before the value_date and
    -- still carry a balance are eligible. A payment never reaches a future
    -- (not-yet-due) instalment.
    let eligible = l.instalments where due_date <= payment.value_date and total_outstanding > 0

    ensures: AllocationTransaction.created(
        payment: payment,
        credit_balance_created: Allocation.surplus(
            considering: { payment.amount, eligible }
        ),
        tolerance_written_off: Allocation.toleranceWriteOff(
            considering: { eligible, config.tolerance_threshold }
        )
    )

    -- Any surplus is held on the loan as unallocated credit. The pre-existing
    -- credit_balance is left untouched; only the new surplus is added.
    ensures: l.credit_balance = l.credit_balance + Allocation.surplus(
        considering: { payment.amount, eligible }
    )

    @guidance
        -- The allocation walks eligible instalments oldest-due-first,
        -- clearing all four buckets of one instalment in the fixed order
        -- fees, penalties, interest, principal before moving to the next.
        -- Each applied and resulting amount is rounded half-up to 3 dp, with
        -- the rounding residual absorbed into the interest component (or
        -- principal where the interest bucket is zero or already paid).
}

invariant NonNegativeOutstanding {
    for i in Instalments:
        i.fees_outstanding >= 0
        and i.penalties_outstanding >= 0
        and i.interest_outstanding >= 0
        and i.principal_outstanding >= 0
        and i.total_outstanding >= 0
}

invariant NonNegativeCredit {
    for loan in Loans:
        loan.credit_balance >= 0
}

-- The boundary contract: what allocate_payment accepts.
surface PaymentAllocation {
    facing l: Loan

    context payment: Payment where loan = l

    exposes:
        l.reference
        payment.amount
        payment.value_date

    provides:
        AllocatePayment(l, payment)
            when payment.amount >= 0

    @guarantee NegativePaymentRejected
        -- A negative payment is rejected: allocate_payment raises an error and
        -- returns nothing. No allocation transaction is recorded.

    @guarantee ZeroPaymentRecorded
        -- A zero payment is a no-op that touches no buckets and reaches no
        -- instalment, yet still records a zero-value allocation transaction
        -- (no lines, zero credit created, zero written off).

    @guarantee RecordingInBoundary
        -- allocate_payment records the allocation transaction itself.
        -- Recording is inside this boundary, not a separate downstream step.

    @guarantee BucketOrderWithinInstalment
        -- Within a single instalment the payment fills buckets in the fixed
        -- order fees, then penalties, then interest, then principal. The order
        -- is not configurable.

    @guarantee InstalmentOrder
        -- Outstanding instalments are paid oldest-due-first. Ties on due date
        -- break to the lowest instalment number. All four buckets of one
        -- instalment are cleared in full before any money reaches the next.

    @guarantee EligibilityByValueDate
        -- Only instalments due on or before the value_date are eligible. A
        -- payment never reaches a future instalment's buckets directly; any
        -- surplus becomes credit instead.

    @guarantee StrictFillNoProportionalSplit
        -- A partial payment fills each bucket in sequence with no proportional
        -- split. A bucket is filled in full before the next is touched.

    @guarantee RoundingHalfUp
        -- Amounts are held to 3 decimal places (fils) and rounded half-up.
        -- Any rounding residual is absorbed into the interest component, or
        -- into principal where the interest bucket is zero or already paid.

    @guarantee OverpaymentHeldAsCredit
        -- Surplus beyond everything owed on eligible instalments is held as an
        -- unallocated credit balance, reported as a single aggregate for the
        -- payment. It is never auto-refunded, does not prepay principal, and
        -- leaves future interest unchanged.

    @guarantee PreExistingCreditUntouched
        -- When the loan already holds a credit balance, only the new payment
        -- amount is allocated. The held balance is neither consumed nor
        -- reallocated by this call; its auto-application is out of boundary.

    @guarantee ToleranceWriteOff
        -- After allocation, for any instalment the payment actually reached,
        -- a residual total at or below tolerance_threshold (0.005 BHD) is
        -- written off: the instalment is marked fully paid and the residual is
        -- added to the aggregate tolerance_written_off. The threshold is
        -- absolute and per instalment. The rule is unconditional on the
        -- post-allocation residual, regardless of why the shortfall arose,
        -- so a deliberate underpayment of a few fils per instalment is
        -- forgiven the same way.

    @guarantee ToleranceOnlyOnReachedInstalments
        -- The tolerance check applies only to instalments the payment reached.
        -- An eligible instalment the payment never reached, because funds were
        -- exhausted earlier, is left untouched and not re-evaluated. A zero
        -- payment reaches no instalment, so it triggers no write-off.

    @guarantee BackDatedAllocation
        -- The value_date may precede today. Interest and penalties are already
        -- accrued to value_date on the instalment before this call; allocation
        -- then runs on those post-accrual balances. Recomputation is upstream.

    @guarantee ResultShape
        -- Per-instalment result rows cover only the instalments the payment
        -- touched, each carrying the four applied bucket amounts and the
        -- resulting outstanding balance. credit_balance_created and
        -- tolerance_written_off are single aggregates for the whole payment.

    @guarantee CreditAutoApplicationOutOfScope
        -- The trigger and mechanics of applying a held credit balance to the
        -- next instalment when it falls due are outside this boundary.

    related:
        AllocationResult(l)
}

-- The boundary contract: what allocate_payment returns, made durable as the
-- recorded transaction.
surface AllocationResult {
    facing l: Loan

    context transaction: AllocationTransaction where payment.loan = l

    exposes:
        for line in transaction.lines:
            line.instalment.instalment_number
            line.instalment.due_date
            line.fees_applied
            line.penalties_applied
            line.interest_applied
            line.principal_applied
            line.resulting_fees_outstanding
            line.resulting_penalties_outstanding
            line.resulting_interest_outstanding
            line.resulting_principal_outstanding
            line.resulting_total_outstanding
        transaction.credit_balance_created
        transaction.tolerance_written_off
}


## Auditor verdict

_The spec covers 13 of 14 decisions and resolves 12 correctly. The bespoke policy choices (bucket order, credit-balance handling, BHD 3dp precision, half-up rounding, residual-to-interest, tolerance threshold, strict fill, result shape) are all captured accurately. Two miss: #7 (back-valued payment) and #12 (penalty accrual on the allocation date) are surfaced but resolved WRONG — the spec pushes interest/penalty recomputation and accrual upstream, out of boundary, whereas the reference requires the operation itself to re-accrue to value_date before allocating. #13 (same-day multiple payments, FIFO by timestamp) is entirely absent, as the spec scopes to a single payment per call. Coverage = 12/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | @guarantee BucketOrderWithinInstalment: "fills buckets in the fixed order fees, then penalties, then interest, then principal" | The spec states the exact bucket order fees → penalties → interest → principal, matching the reference (fees before penalties). |
| 2 | yes | **yes** | @guarantee InstalmentOrder: "Outstanding instalments are paid oldest-due-first... All four buckets of one instalment are cleared in full before any money reaches the next." | Matches the reference: oldest instalment cleared in full across all four buckets before touching the next. |
| 3 | yes | **yes** | @guarantee OverpaymentHeldAsCredit: "Surplus... is held as an unallocated credit balance... never auto-refunded, does not prepay principal"; CreditAutoApplicationOutOfScope acknowledges auto-application to next instalment | Spec states surplus held as unallocated credit, never auto-refunded, matching the reference. The auto-apply-to-next-instalment mechanism is noted but explicitly out of boundary, which is consistent with the reference behaviour. |
| 4 | yes | **yes** | Header: "all amounts and rounding are to 3 dp"; "denominated in BHD and held to 3 decimal places (fils)" | Spec explicitly states BHD, 3 decimal places (fils), matching the reference exactly. |
| 5 | yes | **yes** | @guarantee RoundingHalfUp: "Amounts are held to 3 decimal places (fils) and rounded half-up." | Spec states half-up rounding to 3 dp minor unit, matching the reference. |
| 6 | yes | **yes** | @guarantee RoundingHalfUp: "Any rounding residual is absorbed into the interest component, or into principal where the interest bucket is zero or already paid." | Spec directs the rounding residual into interest, matching the reference. The fallback to principal when interest is zero is an additional refinement but does not contradict the reference destination. |
| 7 | yes | no | @guarantee BackDatedAllocation: "Interest and penalties are already accrued to value_date on the instalment before this call... Recomputation is upstream."; Excludes: "Recomputation of accrued interest and penalties" | The reference requires that interest be recomputed (re-accrued) to the earlier value_date as part of this behaviour. The spec explicitly places recomputation UPSTREAM and out of boundary, treating accruals as pre-supplied. This does not match the reference's decision that the operation itself re-accrues to value_date; it is a different resolution. |
| 8 | yes | **yes** | @guarantee OverpaymentHeldAsCredit: "does not prepay principal, and leaves future interest unchanged"; EligibilityByValueDate: "A payment never reaches a future instalment's buckets directly; any surplus becomes credit" | Spec states surplus becomes credit, does not prepay principal, future interest unchanged, and payments settle only eligible (current/past-due) instalments, matching the reference for early/on-time surplus. |
| 9 | yes | **yes** | @guarantee StrictFillNoProportionalSplit: "A partial payment fills each bucket in sequence with no proportional split. A bucket is filled in full before the next is touched." | Spec states strict in-order fill with no proportional split, matching the reference exactly. |
| 10 | yes | **yes** | @guarantee ToleranceWriteOff: "a residual total at or below tolerance_threshold (0.005 BHD) is written off: the instalment is marked fully paid"; config tolerance_threshold: Decimal = 0.005 | Spec sets the write-off threshold at ≤ 0.005 BHD, marks the instalment fully paid, matching the reference exactly. |
| 11 | yes | **yes** | @guarantee NegativePaymentRejected: "A negative payment is rejected: allocate_payment raises an error"; @guarantee ZeroPaymentRecorded: "a zero payment is a no-op... yet still records a zero-value allocation transaction" | Spec rejects negatives with an error and treats zero as a no-op that still records a zero-value transaction, matching both halves of the reference. |
| 12 | yes | no | Excludes: "Day-count convention, penalty rate and penalty accrual method: upstream of this boundary"; balances "already reflect interest and penalties accrued up to and including value_date; the accrual itself happens upstream" | The reference requires penalties to accrue up to and including the value_date and then allocation to run on post-accrual balances as part of this behaviour. The spec assumes accruals are pre-computed upstream and explicitly excludes penalty accrual from the boundary, so the operation itself does not perform the accrue-then-allocate step. Although the post-accrual-balance ordering is echoed, the accrual decision is pushed out of scope rather than resolved here. |
| 13 | no | no | absent | The spec addresses one incoming payment per call and never states how multiple payments on the same day are ordered (FIFO by receipt timestamp) or that each is allocated independently in turn. No timestamp or same-day sequencing is mentioned. |
| 14 | yes | **yes** | @guarantee ResultShape and surface AllocationResult: per-line applied bucket amounts, resulting outstanding balances, transaction.credit_balance_created, transaction.tolerance_written_off | Spec returns per-instalment applied amounts per bucket, resulting outstanding balances, aggregate credit_balance_created and tolerance_written_off, matching the reference result shape. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-L2OlOb/spec.allium"
}

```
