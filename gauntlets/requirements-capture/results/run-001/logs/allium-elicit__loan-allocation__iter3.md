# allium-elicit — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 18 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; elicit process requires surfacing the omitted allocation policies (order, instalment sequencing, rounding, surplus/shortfall, edge inputs, output shape, timing) before writing any spec.

Q: What's the boundary of this specification: just the `allocate_payment` function's allocation logic, or does it also cover how payments enter the system, reversals, and reporting? And does code already exist, or is this greenfield?
A: The specification covers only the `allocate_payment` function's allocation logic. How payments enter the system, reversals, and reporting are out of scope. Whether code already exists is [default, not policy] — treat it as greenfield unless you hear otherwise.

Q: When a payment is applied, what order are the four components (penalties, fees, interest, principal) paid down in? Is that order fixed, or configurable?
A: The fixed order is: fees first, then penalties, then interest, then principal. It is not configurable.

Q: Across multiple outstanding instalments, which instalment does a payment go to first (oldest due first, most overdue, current, or something else), and do you fully satisfy one instalment across all its components before moving to the next, or pay the same component across all instalments first?
A: Oldest overdue instalment is cleared first. One instalment is fully satisfied across all four of its buckets before any money touches the next instalment.

Q: What currency and unit are amounts held in (e.g. whole cents/pence, or fractional), and to what precision are interest and other derived components computed?
A: Amounts are held in BHD (Bahraini dinar). The minor unit is the fils — 3 decimal places — and all amounts and derived components are computed and stored to 3 dp.

Q: When a computed component (e.g. interest) needs rounding to the unit, which direction does it round, and where does any remainder land?
A: Round half-up to 3 decimal places. Any rounding residual is absorbed into the interest component, not principal.

Q: What happens to an overpayment: is the surplus held as a credit, returned to the borrower, applied to future instalments, or something else?
A: Surplus is held as an unallocated credit balance. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded to the borrower.

Q: What happens with a partial payment that doesn't cover everything owed: does it apply as far as it goes down the order, and is a partial component allowed (e.g. paying half the interest on an instalment)?
A: Payment applies strictly down the bucket order, filling each bucket as far as the money allows before moving to the next. A partial component is permitted — for example, paying half the interest on an instalment is valid. There is no proportional split.

Q: What are the edge inputs and how is each handled: zero payment, negative payment, payment on a loan with nothing outstanding, and a payment larger than the entire remaining balance?
A: Zero payment: a no-op, but a zero-value allocation transaction is still recorded. Negative payment: rejected with an error. Payment on a loan with nothing outstanding: [default, not policy] — the full amount becomes a credit balance. Payment larger than the entire remaining balance: overpayment rules apply — surplus becomes a credit balance; additionally, any residual ≤ 0.005 BHD after allocation is written off and the instalment marked fully paid.

Q: Exactly what must `allocate_payment` return, field by field: the breakdown of how the payment was split, the loan's updated balances per instalment and per component, any leftover/credit, and anything else the caller or borrower is shown?
A: Return, per payment: the amount applied to each bucket of each instalment touched; the resulting outstanding balance per bucket per instalment; any credit_balance created; any tolerance_written_off amount.

Q: Does timing matter: is allocation computed as of the payment date, can payments be back-dated, and does interest accrue up to the payment date before allocation?
A: Allocation runs as of the payment's value_date. Payments may be back-dated (value_date earlier than today), in which case interest is recomputed (re-accrued) to that value_date before allocation begins. Penalties also accrue up to and including the value_date, and allocation then runs on those post-accrual balances.

### Round 2
_Step reasoning:_ Core policy is well covered, but the completeness gate flags material unasked classes: existing-credit interaction on entry, the equal-overdue tie-break, the exact scope of the tolerance write-off, and whether re-accrual is in scope for this function.

Q: When `allocate_payment` runs, might the loan already carry an unallocated credit balance from a prior overpayment? If so, is that existing credit consumed first (or combined with the incoming payment) before allocation begins, or does this call only allocate the incoming payment and leave any pre-existing credit untouched?
A: The answer key specifies that a credit balance is auto-applied when the next instalment falls due, not when the next payment arrives. Therefore [default, not policy]: `allocate_payment` only allocates the incoming payment amount; any pre-existing credit balance is left untouched by this call and will be applied separately at instalment due-date time.

Q: When two outstanding instalments are equally overdue (identical due date), what breaks the tie for which one is cleared first?
A: Not in the answer key. [default, not policy]: tie-broken by instalment sequence number, ascending (lower sequence number cleared first).

Q: The tolerance write-off (residual ≤ 0.005 BHD): does it apply to every instalment as it is satisfied during allocation, or only once to the final residual after the whole payment is allocated? And can it clear a residual left in any bucket, or only in principal?
A: The answer key states 'residual owed after allocation ≤ 0.005 BHD → instalment marked fully paid, residual written off', which is phrased per instalment. The tolerance check therefore applies to each instalment as it is satisfied during allocation, not only once at the end. Which bucket the residual sits in is not specified; [default, not policy]: the write-off clears whatever remains across any bucket, not principal only.

Q: For back-dated payments where interest and penalties are re-accrued to the value_date: does `allocate_payment` treat that re-accrual as a given input (a black box producing the post-accrual balances it works from), or must the allocation logic itself compute the accrual, and if so what accrual method (rate basis, day-count) applies?
A: The answer key states that interest and penalties are re-accrued 'before allocation', and that 'allocation runs on post-accrual balances'. This implies `allocate_payment` receives post-accrual balances as a given input and does not itself compute accrual. The accrual method (rate basis, day-count convention) is out of scope for this specification. [default, not policy] for those details.

### Round 3
_Step reasoning:_ Nearly all completeness-gate classes are covered, but there's a genuine unresolved policy tension over whether allocation reaches not-yet-due instalments or stops at overdue ones and treats the rest as credit.

Q: The overpayment rule says surplus beyond what's owed becomes a credit balance that's auto-applied to the next instalment 'when it falls due', but the larger-than-balance edge case refers to a payment exceeding the 'entire remaining balance'. These are in tension. Concretely: does allocation only ever touch instalments that are currently due or overdue (with any money left after those cleared becoming credit), or does it also pay down instalments that are outstanding but not yet due before creating a credit balance?
A: Allocation only touches instalments that are currently due or overdue. Any surplus after those are cleared becomes a credit balance — it does not prepay outstanding-but-not-yet-due instalments. The phrase 'entire remaining balance' in the edge-case description refers to the total of all currently due and overdue balances, not the full lifetime loan balance. Future instalments are left untouched and their interest is unaffected.

### Round 4
_Step reasoning:_ Core allocation policies, precision, rounding, ordering, overpayment, partial payment, edges, timing and return fields are all captured; two genuine gaps remain on payment-input precision handling and the exact reporting shape (including the zero-payment no-op), so I ask those before concluding.

Q: If an incoming payment amount carries more precision than the fils (more than 3 decimal places), is it rejected outright, or rounded to 3 dp before allocation begins? If rounded, in which direction (half-up, like derived components, or something else)?
A: Not in the answer key. [default, not policy]: a payment amount with more than 3 decimal places is rounded to 3 dp (half-up, consistent with the rounding method for derived components) before allocation begins; it is not rejected outright.

Q: For the returned breakdown, does it include only the instalments and buckets the payment actually touched, or does it also list currently-due/overdue instalments that received nothing? And for the zero-payment no-op, what exactly does the recorded zero-value allocation transaction contain (empty breakdown, or all-zero entries)?
A: The answer key uses the word 'touched' in the return-shape description, so the breakdown includes only instalments and buckets the payment actually touched; instalments that received nothing are omitted. What the zero-value allocation transaction contains for the no-op case is not in the answer key. [default, not policy]: it records the payment metadata (value_date, amount = 0.000 BHD) with an empty instalment breakdown, no credit_balance, and no tolerance_written_off.

### Round 5
_Step reasoning:_ Nearly every completeness-gate class has been answered with real policy; the one genuinely material output-shape item still unconfirmed is whether an explicit per-instalment 'fully paid' status is part of the return, since the tolerance rule references marking an instalment fully paid.

Q: For the returned breakdown, when an instalment is fully satisfied (either paid down to zero across all four buckets, or cleared via the ≤ 0.005 BHD tolerance write-off), does the return convey a per-instalment status such as 'fully paid' versus 'partially paid', or does the caller infer that solely from the resulting outstanding balances being zero? In other words, is instalment status an explicit field in the returned shape or not?
A: The answer key lists the return shape as: amount applied to each bucket of each instalment, resulting outstanding balances per bucket per instalment, any credit_balance created, and any tolerance_written_off. No explicit per-instalment status field (e.g. 'fully_paid' / 'partially_paid') appears in that list. [default, not policy]: the caller infers instalment status from the resulting outstanding balances — all buckets at zero (including any tolerance write-off) implies fully paid; any non-zero bucket implies partially paid. No status enum is returned.

### Round 6 (process signalled done)
_Step reasoning:_ Every relevant completeness-gate class has been put to the stakeholder and answered; the last two rounds returned only non-policy defaults, signalling the policy-bearing decisions (bucket order, instalment order, precision, rounding, overpayment/credit, partial application, edge inputs, timing/back-dating, tie-break, tolerance, re-accrual boundary, and full return shape) are now exhausted.

(no questions this round)

## Produced specification

-- allium: 3

-- Loan payment allocation: the `allocate_payment` function.
--
-- Scope: the allocation logic of `allocate_payment` only. How payments enter the
-- system, reversals and reporting are out of scope. Treated as greenfield.
--
-- Money: all amounts are BHD (Bahraini dinar). The minor unit is the fils, 3
-- decimal places. All amounts and derived components are computed and stored to
-- 3 dp, rounded half-up. Any rounding residual is absorbed into the interest
-- component, never principal.
--
-- Accrual (interest and penalties) is out of scope: allocate_payment receives
-- post-accrual balances as input and does not itself compute accrual. The rate
-- basis and day-count convention are not specified here.
--
-- Items marked [default] were not settled by stakeholders and are resolved by
-- process default, not policy.

config {
    write_off_tolerance: Decimal = 0.005    -- residual at or below this is written off (BHD)
    minor_unit_places: Integer = 3          -- fils: 3 decimal places
}

-- ---------------------------------------------------------------------------
-- Domain model
-- ---------------------------------------------------------------------------

entity Loan {
    instalments: Instalment with loan = this
    credit_balance: Decimal                 -- unallocated credit from prior overpayments
}

entity Instalment {
    loan: Loan
    sequence: Integer                       -- ascending; lower is earlier
    due_date: Timestamp
    fees_outstanding: Decimal
    penalties_outstanding: Decimal
    interest_outstanding: Decimal
    principal_outstanding: Decimal

    total_outstanding: fees_outstanding + penalties_outstanding + interest_outstanding + principal_outstanding
    is_settled: total_outstanding = 0
}

entity Payment {
    loan: Loan
    amount: Decimal                         -- rounded to 3 dp (half-up) before allocation
    value_date: Timestamp                   -- may be back-dated (earlier than today)

    result: AllocationResult? with payment = this
}

-- The return of allocate_payment. `credit_balance` and `tolerance_written_off`
-- are optional because either may be absent from a given allocation.
entity AllocationResult {
    payment: Payment
    applications: BucketApplication with result = this
    credit_balance: Decimal?
    tolerance_written_off: Decimal?
}

-- One entry per (instalment, bucket) the payment actually touched. Instalments
-- and buckets that received nothing are omitted from the breakdown.
entity BucketApplication {
    result: AllocationResult
    instalment: Instalment
    bucket: fees | penalties | interest | principal
    amount_applied: Decimal
    resulting_outstanding: Decimal
}

-- A negative payment produces a rejection rather than an allocation.
entity PaymentRejection {
    payment: Payment
    reason: String
}

actor Caller {
    identified_by: name
}

-- ---------------------------------------------------------------------------
-- Allocation rules
-- ---------------------------------------------------------------------------

rule RejectNegativePayment {
    when: AllocatePayment(_, payment)
    requires: payment.amount < 0
    ensures: PaymentRejection.created(payment: payment, reason: "negative amount")
    @guidance
        -- A negative payment is rejected with an error. No allocation is
        -- performed and no AllocationResult is created.
}

rule AllocateZeroPayment {
    when: AllocatePayment(_, payment)
    requires: payment.amount = 0
    ensures: AllocationResult.created(
        payment: payment,
        credit_balance: 0,
        tolerance_written_off: 0
    )
    @guidance
        -- A zero payment is a no-op, but a zero-value allocation transaction is
        -- still recorded: payment metadata (value_date, amount = 0.000 BHD) with
        -- an empty breakdown (no BucketApplication entries), no credit balance
        -- and nothing written off. [default] for the exact zero-transaction shape.
}

rule AllocatePositivePayment {
    when: AllocatePayment(_, payment)
    requires: payment.amount > 0

    -- Allocation only ever touches instalments that are currently due or overdue
    -- as of the value_date. Future (not-yet-due) instalments are left untouched.
    let due = payment.loan.instalments where due_date <= payment.value_date

    ensures: AllocationResult.created(payment: payment)

    @guidance
        -- Allocation runs as of payment.value_date on the post-accrual balances
        -- supplied as input (interest and penalties already re-accrued to the
        -- value_date; allocate_payment does not compute accrual).
        --
        -- `due` is the set of currently due and overdue instalments.
        --
        -- Instalment order: clear the oldest overdue instalment first (earliest
        -- due_date). Ties (identical due_date) are broken by sequence number
        -- ascending [default]. One instalment is fully satisfied across all four
        -- of its buckets before any money touches the next instalment.
        --
        -- Bucket order within an instalment (fixed, not configurable): fees, then
        -- penalties, then interest, then principal. Money fills each bucket as far
        -- as it allows before moving to the next. A partial component is permitted
        -- (e.g. paying half an instalment's interest). There is no proportional
        -- split.
        --
        -- Tolerance write-off: applied per instalment as it is satisfied. When the
        -- residual still owed on an instalment is at or below write_off_tolerance
        -- (0.005 BHD), that residual is written off, the instalment is marked fully
        -- paid, and the amount is added to the result's tolerance_written_off. The
        -- write-off clears whatever remains across any bucket [default], not
        -- principal only.
        --
        -- Overpayment / surplus: any money left after all currently due and overdue
        -- instalments are cleared becomes an unallocated credit balance on the loan
        -- (result.credit_balance). It does NOT prepay not-yet-due instalments and
        -- does not affect their interest. Surplus is never auto-refunded to the
        -- borrower. "Entire remaining balance" means the total of all currently due
        -- and overdue balances, not the full lifetime loan balance.
        --
        -- Nothing outstanding: if there are no due or overdue instalments, the full
        -- payment amount becomes credit balance [default].
        --
        -- This call allocates only the incoming payment. Any pre-existing credit
        -- balance on the loan is left untouched here [default]; it is applied
        -- separately when the next instalment falls due (see CreditAppliedAtDueDate).
        --
        -- Precision: a payment amount carrying more than 3 dp is rounded to 3 dp,
        -- half-up, before allocation begins; it is not rejected [default]. Derived
        -- components round half-up to 3 dp with the residual absorbed into interest.
}

-- Counterpart to the "leave pre-existing credit untouched" default: a credit
-- balance is auto-applied when the next instalment falls due, not when the next
-- payment arrives. This sits at the edge of scope (allocate_payment itself does
-- not consume credit) but records a settled behavioural decision.
rule CreditAppliedAtDueDate {
    when: instalment: Instalment.due_date <= now
    requires: instalment.loan.credit_balance > 0
    requires: not instalment.is_settled
    ensures: instalment.loan.credit_balance = 0
    @guidance
        -- When an instalment falls due, existing loan credit is applied to it
        -- following the same bucket order (fees, penalties, interest, principal)
        -- and tolerance rules as a payment. Any credit remaining after the
        -- instalment is satisfied stays as credit for the following due instalment.
        -- Credit is never auto-refunded to the borrower.
}

-- ---------------------------------------------------------------------------
-- Global properties
-- ---------------------------------------------------------------------------

invariant OutstandingNeverNegative {
    for i in Instalments:
        i.fees_outstanding >= 0 and
        i.penalties_outstanding >= 0 and
        i.interest_outstanding >= 0 and
        i.principal_outstanding >= 0
}

invariant CreditNeverNegative {
    for l in Loans:
        l.credit_balance >= 0
}

invariant AppliedAmountsPositive {
    for a in BucketApplications:
        a.amount_applied > 0 and a.resulting_outstanding >= 0
}

-- ---------------------------------------------------------------------------
-- Boundary contract for allocate_payment
-- ---------------------------------------------------------------------------

surface PaymentAllocation {
    facing caller: Caller
    context payment: Payment

    provides:
        AllocatePayment(caller, payment)

    exposes:
        for a in payment.result.applications:
            a.instalment.sequence
            a.bucket
            a.amount_applied
            a.resulting_outstanding
        payment.result.credit_balance
        payment.result.tolerance_written_off

    @guarantee ConservationOfPayment
        -- The sum of amounts applied across all buckets, plus any credit_balance
        -- created, equals the (3 dp, half-up rounded) payment amount. Tolerance
        -- write-offs reduce outstanding balances but are not funded by the payment.

    @guarantee FixedBucketOrder
        -- Within an instalment, money fills buckets in the fixed order fees,
        -- penalties, interest, principal. This order is not configurable.

    @guarantee OldestInstalmentFirst
        -- The oldest overdue instalment is cleared first, fully across all four
        -- buckets, before any money touches the next instalment. Equal due dates
        -- are broken by ascending sequence number.

    @guarantee OnlyDueOrOverdueTouched
        -- Allocation only touches instalments due or overdue as of the value_date.
        -- Surplus becomes loan credit rather than prepaying future instalments.

    @guarantee ToleranceWriteOff
        -- As each instalment is satisfied, a residual at or below 0.005 BHD is
        -- written off and the instalment marked fully paid.

    @guarantee BreakdownIncludesOnlyTouched
        -- The returned breakdown lists only the instalments and buckets the
        -- payment actually touched. Instalment status is inferred from the
        -- resulting outstanding balances; no status enum is returned.
}


## Auditor verdict

_The spec covers 13 of 14 decisions correctly, including all the genuinely bespoke ones (bucket order with fees-before-penalties, credit-balance handling, BHD 3 dp, half-up, residual-to-interest, value-date re-accrual, no-prepay surplus, and the 0.005 tolerance). The only gap is #13: same-day multiple payments and FIFO-by-timestamp ordering is never addressed — the spec only asserts each call allocates one payment. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Bucket order within an instalment (fixed, not configurable): fees, then penalties, then interest, then principal." and @guarantee FixedBucketOrder | Spec fixes the order fees→penalties→interest→principal, matching the reference exactly including fees before penalties. |
| 2 | yes | **yes** | "clear the oldest overdue instalment first (earliest due_date)... One instalment is fully satisfied across all four of its buckets before any money touches the next instalment." | Matches the reference: oldest instalment cleared in full across all buckets before touching the next. |
| 3 | yes | **yes** | "any money left after all currently due and overdue instalments are cleared becomes an unallocated credit balance on the loan... Surplus is never auto-refunded"; CreditAppliedAtDueDate applies credit "when the next instalment falls due" | Surplus held as credit balance, auto-applied at next due date, never refunded — matches the reference on all three points. |
| 4 | yes | **yes** | "all amounts are BHD (Bahraini dinar). The minor unit is the fils, 3 decimal places." | Spec sets BHD with 3 dp minor unit, exactly the reference value. |
| 5 | yes | **yes** | "computed and stored to 3 dp, rounded half-up." | Half-up rounding to the 3 dp minor unit matches the reference. |
| 6 | yes | **yes** | "Any rounding residual is absorbed into the interest component, never principal." | Residual destination is interest, exactly matching the reference. |
| 7 | yes | **yes** | "Allocation runs as of payment.value_date on the post-accrual balances supplied as input (interest and penalties already re-accrued to the value_date...)" | Spec captures the decision that interest is re-accrued to the (possibly back-dated) value_date before allocation, matching the reference; the computation itself is delegated but the policy is stated. |
| 8 | yes | **yes** | "It does NOT prepay not-yet-due instalments and does not affect their interest." and @guarantee OnlyDueOrOverdueTouched | Early/surplus payment settles due instalments only, surplus becomes credit and does not prepay principal or change future interest — matches the reference. |
| 9 | yes | **yes** | "Money fills each bucket as far as it allows before moving to the next. A partial component is permitted... There is no proportional split." | Strict in-order fill with explicit no-proportional-split, matching the reference. |
| 10 | yes | **yes** | "When the residual still owed on an instalment is at or below write_off_tolerance (0.005 BHD), that residual is written off, the instalment is marked fully paid..." | Tolerance of 0.005 BHD with instalment marked fully paid and residual written off matches the reference exactly. |
| 11 | yes | **yes** | RejectNegativePayment (reason: "negative amount") and AllocateZeroPayment: "a zero-value allocation transaction is still recorded... no credit balance and nothing written off." | Negative rejected with error, zero is a no-op that still records a zero-value transaction — matches both halves of the reference. |
| 12 | yes | **yes** | "penalties already re-accrued to the value_date; allocate_payment does not compute accrual" and "Allocation runs... on the post-accrual balances" | Spec states penalties accrue to the value_date and allocation then runs on post-accrual balances, matching the accrue-then-allocate ordering of the reference. |
| 13 | no | no | absent | Spec says "This call allocates only the incoming payment" but never addresses ordering of multiple same-day payments or FIFO by receipt timestamp; the FIFO decision is not stated. |
| 14 | yes | **yes** | AllocationResult with applications (BucketApplication: instalment, bucket, amount_applied, resulting_outstanding), credit_balance, tolerance_written_off; surface exposes all of these | Result shape returns per-bucket per-instalment amounts applied, resulting outstanding balances, credit_balance and tolerance_written_off — matches all four elements of the reference. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-eGjmQk/spec.allium"
}

```
