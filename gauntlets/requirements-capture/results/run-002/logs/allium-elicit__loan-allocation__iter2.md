# allium-elicit — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 18 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; surfacing the core allocation-order, rounding, surplus/shortfall, edge-input and output-shape policies that the brief omits and a model cannot reliably infer.

Q: When a payment comes in against a loan with several outstanding instalments, in what order are the instalments satisfied (for example oldest due date first, most delinquent first, or some other priority), and how are ties between equally-ranked instalments broken?
A: Oldest due date first. Each instalment is cleared in full across all four components before any funds touch the next. Ties between instalments sharing the same due date are broken by instalment sequence number ascending [default, not policy].

Q: Within a single instalment, in what order are the four components paid down (penalties, fees, interest, principal), and is that same order applied across all instalments before moving to the next, or is each instalment fully cleared before the next is touched?
A: Within a single instalment the order is: fees, then penalties, then interest, then principal. Each instalment is cleared entirely before the next is touched; the waterfall does not spread across instalments bucket-by-bucket.

Q: What currency unit and precision does the system work in (for example whole cents), and when an allocation step produces a fraction of that unit, which way is it rounded and where does any remainder land?
A: The loan is denominated in BHD. All amounts are expressed to 3 decimal places (fils). Rounding is half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

Q: If the payment is larger than the total currently owed, what happens to the surplus (held as a credit, applied to future instalments or principal, or returned to the borrower)?
A: The surplus is held as an unallocated credit balance. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded to the borrower, and it does not prepay principal or alter future interest.

Q: If the payment is smaller than what is owed, is a partial payment applied as far as it goes down the waterfall, or is it rejected or held until a full instalment can be covered?
A: A partial payment is applied as far as it goes down the waterfall in strict bucket order — fees first, then penalties, then interest, then principal — with no proportional split and no hold. It is not rejected.

Q: How should the function treat edge inputs such as a zero payment, a negative payment, or a payment against a loan with nothing outstanding — rejected, ignored, or processed, and is a record still kept?
A: A negative payment is rejected with an error. A zero payment is treated as a no-op but a zero-value allocation transaction is still recorded. A payment against a loan with nothing outstanding follows the same rules: zero is a recorded no-op; negative is rejected.

Q: Exactly what must allocate_payment return, field by field: the per-component/per-instalment breakdown of how the payment was applied, the loan's updated balances, and any figures (such as remaining balance or a surplus credit) that are reported separately?
A: Per payment the function must return: (a) the amount applied to each bucket (fees, penalties, interest, principal) for each instalment touched, (b) the resulting outstanding balance for each bucket of each instalment after allocation, (c) any credit_balance created from surplus funds, and (d) any tolerance_written_off amount where a residual of ≤ 0.005 BHD caused an instalment to be marked fully paid.

### Round 2
_Step reasoning:_ Core flow is well pinned, but the tolerance write-off rule, instalment eligibility (due vs future), existing-credit interaction, and whole-life events (reversal/correction) remain unasked policy decisions.

Q: You listed `tolerance_written_off` as an output for residuals of ≤ 0.005 BHD, but we haven't defined the rule behind it. Exactly how does the tolerance work: at what point is the check applied (per bucket, per instalment, or after the whole payment is allocated), does a residual at or below the threshold cause the instalment to be marked fully paid by writing off the shortfall, and is that written-off amount recorded anywhere as a loss or adjustment?
A: The tolerance check is applied at the instalment level, after all available funds from the payment have been allocated across that instalment's four buckets. If the total remaining owed on the instalment at that point is ≤ 0.005 BHD, the instalment is marked fully paid and the shortfall is written off rather than left as an open balance. The written-off amount is returned in the tolerance_written_off field of the result. Whether it is also posted to a separate loss or adjustment ledger entry is [default, not policy] — a reasonable default is to record it as a write-off adjustment transaction against the loan.

Q: Which instalments are eligible to receive allocation: only those currently due or overdue, or can the payment also flow into instalments that have not yet fallen due? Put differently, once every due instalment is cleared in full, does any remaining payment move on to the next not-yet-due instalment, or does it go straight to the unallocated credit balance?
A: Only instalments that are currently due or overdue are eligible to receive allocation. Once every due and overdue instalment is fully cleared, any remaining funds become an unallocated credit balance. The payment does not flow forward into instalments that have not yet fallen due.

Q: If the loan already carries an unallocated credit balance when a new payment arrives, is that existing credit combined with the incoming payment before the waterfall runs, or is it kept separate and only auto-applied later when the next instalment falls due?
A: The existing credit balance and the incoming payment are kept separate and are not combined before the waterfall runs. The incoming payment is allocated independently through the waterfall in the normal way; the existing credit balance remains on account and is auto-applied only when the next instalment falls due, as per the standard overpayment rule. [default, not policy]

Q: Does `allocate_payment` need to handle anything over the life of a payment beyond applying a fresh one, for example reversing or correcting a previously applied payment, or reallocating after an instalment's penalties or fees change retroactively? Or is each call a standalone forward application only?
A: Each call to allocate_payment is a standalone forward application only. Reversals, corrections of previously applied payments, and reallocation triggered by retroactive changes to fees or penalties are out of scope for this function. [default, not policy]

### Round 3
_Step reasoning:_ Core waterfall, precision, surplus, edges, output shape and lifecycle are settled, but the eligibility rule hinges on an undefined reference date, and the stated rounding-residual rule has an unresolved edge when no interest bucket exists.

Q: To determine which instalments count as 'currently due or overdue' (and are therefore eligible for allocation), what date does the function evaluate against — the payment's own value/effective date, the date the payment is processed, or the current system date — and does the payment input itself carry that date, or is a reference/as-of date passed in separately?
A: The function evaluates eligibility against the payment's own value_date, which the payment input carries directly. An instalment is due or overdue if its due date is on or before that value_date. This is consistent with rule 7: back-valued payments recompute interest to the value_date before allocation, so the same date governs both interest accrual and instalment eligibility. No separate as-of date parameter is needed. [value_date on the payment input is policy, implied by rule 7; using it for eligibility is the natural consequence rather than a separate policy decision]

Q: Your rounding rule puts any half-up residual into the interest component. In the allocation itself, when does a sub-fil residual actually arise given that instalment balances and the payment are all expressed to 3 dp? And if an instalment being paid has no interest component outstanding (interest bucket already zero), where does the residual land instead?
A: Sub-fil residuals arise during accrual calculations — interest and penalty amounts are computed by applying rates over time, producing results that may not be exact multiples of 0.001 BHD before rounding. The allocation waterfall itself is a sequential fill with no division, so it does not independently introduce residuals; the rounding has already been applied to the instalment balances before allocation runs. If the interest bucket on the target instalment is already zero, the residual lands in the principal component instead. [default, not policy for the zero-interest fallback]

### Round 4
_Step reasoning:_ The core flow, rounding, edge inputs, surplus/shortfall and output shape are all pinned, but rule 7's back-valued interest recomputation introduces an accrual step whose day-count basis and penalty treatment are unasked core-method decisions a model cannot infer.

Q: For back-valued payments you said interest is recomputed to the value_date before allocation (rule 7). Does `allocate_payment` itself perform this accrual recomputation, or does it receive already-accrued balances? If it performs it, what day-count convention and rate basis govern the accrual (for example actual/365, actual/360, or 30/360), and from which reference date is interest accrued forward to the value_date?
A: Rule 7 states that interest is recomputed to the value_date before allocation runs. Whether allocate_payment performs that accrual internally or expects the caller to supply already-recomputed balances is [default, not policy] — a reasonable default is for allocate_payment to receive already-accrued balances so that accrual logic stays in a dedicated accrual layer. The day-count convention, rate basis, and the reference date from which accrual is computed forward are likewise [default, not policy]; common defaults for this region are actual/365 from the last accrual checkpoint.

Q: Penalties also accrue over time. When a payment is back-valued, are outstanding penalties likewise recomputed to the value_date, or are penalty amounts frozen at their existing values with only interest recomputed?
A: Penalties are also recomputed to the value_date. Rule 12 states that penalties accrue up to and including the value_date, and allocation then runs on those post-accrual balances. Penalty amounts are not frozen while interest is recomputed; both are updated to the value_date before the waterfall begins.

### Round 5
_Step reasoning:_ Core method, ordering, precision, surplus/shortfall, edge inputs, timing/accrual and whole-life scope are covered; two genuine gaps remain on the reporting basis of credit_balance and whether the tolerance write-off fires on a zero/no-op payment.

Q: Does the returned `credit_balance` field report only the credit newly created by this payment's surplus, or the loan's total unallocated credit on account after this payment (i.e. newly-created surplus plus any pre-existing credit that was being carried separately)?
A: The `credit_balance` field reports only the credit newly created by this payment's surplus. Any pre-existing credit carried on the loan is kept separate and is not combined with the incoming payment before the waterfall runs (as established in Round 2), so it is not included in this field. [default, not policy]

Q: When `allocate_payment` is called with a zero payment (the recorded no-op), is the instalment-level tolerance check still applied to any pre-existing residual of ≤ 0.005 BHD and the instalment written off, or is the tolerance write-off only ever triggered by a payment that actually moves funds into the instalment?
A: The tolerance write-off is only triggered by a payment that actually moves funds into the instalment. A zero payment is a no-op — no funds are allocated, so the post-allocation residual on the instalment is unchanged and the tolerance check does not fire. [default, not policy]

### Round 6
_Step reasoning:_ Core policies (waterfall order, rounding, surplus/shortfall, eligibility, accrual, edge inputs) are captured and recent answers are now defaults rather than policy, but the output-shape granularity of tolerance_written_off across multiple written-off instalments remains genuinely ambiguous and output shape is in scope by default.

Q: When a single payment touches several instalments and more than one of them ends the allocation with a residual of ≤ 0.005 BHD and is written off under the tolerance rule, is `tolerance_written_off` returned as one aggregate figure for the whole payment, or is it broken down per instalment alongside the per-instalment bucket balances?
A: The answer key does not specify this breakdown. [default, not policy] — a reasonable default is to return tolerance_written_off per instalment, alongside the per-instalment bucket amounts and resulting balances, so each write-off is traceable to the instalment it closed. An aggregate figure could be derived by summing, but the per-instalment form loses no information and matches the granularity of the rest of the result shape.

### Round 7 (process signalled done)
_Step reasoning:_ All material policy classes (waterfall order, precision/rounding, surplus/shortfall, edge inputs, eligibility dates, accrual scope, tolerance, and full return shape) are firmly captured, and the last three rounds have returned predominantly [default, not policy] answers, signalling the scored policy surface is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
-- payment-allocation.allium

-- Scope: Allocation of a single incoming borrower payment across the outstanding
--        instalments of one loan, via the function allocate_payment(payment, loan).
-- Includes:
--   - Eligibility of instalments to receive allocation (due/overdue by value_date)
--   - The waterfall: instalment ordering, within-instalment bucket ordering
--   - Partial payments, surplus (unallocated credit), tolerance write-off
--   - Edge inputs (zero, negative, nothing outstanding)
--   - The result shape returned per payment
-- Excludes (owned by other layers / specifications):
--   - Interest and penalty ACCRUAL. A dedicated accrual layer recomputes interest
--     and penalties up to and including the payment's value_date BEFORE allocate_payment
--     runs; this function receives already-accrued balances. See AccrualLayer (deferred).
--   - Reversals, corrections of previously applied payments, and reallocation triggered
--     by retroactive changes to fees or penalties. Each call is a standalone forward
--     application only.
--   - Refunds to the borrower (credit is never auto-refunded).

-- Boundary note: allocate_payment(payment, loan) is invoked by the loan-servicing
-- process. Two boundary guarantees hold for every call:
--   - Standalone forward application: each call applies one fresh payment forward
--     only; reversals, corrections and retroactive reallocation are out of scope.
--   - Credit is never auto-refunded: surplus is held as unallocated credit on the
--     loan and auto-applied to the next instalment when due, never returned to the
--     borrower.

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

-- The within-instalment payment order is fixed: fees, then penalties, then
-- interest, then principal. Each component is cleared in full before the next
-- receives any funds. See the four *_outstanding fields on Instalment below and
-- the waterfall guidance on ProcessPayment.
entity Loan {
    -- All amounts on this loan are denominated in BHD, to 3 decimal places (fils);
    -- see config.currency / config.decimal_places.

    -- Unallocated credit carried on the loan (surplus from prior payments that
    -- has not yet been auto-applied to an instalment). This balance is NOT fed
    -- into the waterfall of a fresh incoming payment; it is held separately and
    -- auto-applied only when the next instalment falls due. It is never
    -- auto-refunded to the borrower, and it does not prepay principal or alter
    -- future interest.
    credit_balance: Decimal

    instalments: Instalment with loan = this
}

entity Instalment {
    loan: Loan

    -- Ordering keys for the waterfall: oldest due_date first; ties between
    -- instalments sharing the same due_date are broken by sequence_number ascending.
    sequence_number: Integer
    due_date: Timestamp

    -- The four component balances outstanding, each to 3 dp (fils). These are the
    -- POST-accrual balances handed to allocate_payment: interest and penalties
    -- have already been recomputed to the payment's value_date by the accrual layer.
    fees_outstanding: Decimal
    penalties_outstanding: Decimal
    interest_outstanding: Decimal
    principal_outstanding: Decimal

    -- Total still owed across the four buckets. An instalment is fully paid exactly
    -- when this is zero. A tolerance write-off marks an instalment fully paid by
    -- zeroing its residual (see the tolerance guidance on ProcessPayment), so a
    -- written-off instalment also has total_outstanding = 0. An instalment is
    -- eligible to receive allocation only while total_outstanding > 0 and it is
    -- due/overdue relative to a payment's value_date (see ProcessPayment).
    total_outstanding:
        fees_outstanding + penalties_outstanding + interest_outstanding + principal_outstanding

    invariant NonNegativeBalances {
        fees_outstanding >= 0
        and penalties_outstanding >= 0
        and interest_outstanding >= 0
        and principal_outstanding >= 0
    }
}

entity Payment {
    loan: Loan

    -- The gross amount tendered, in BHD to 3 dp. May be zero (no-op) or negative
    -- (rejected). Positive payments run the waterfall.
    amount: Decimal

    -- The payment carries its own value_date. This single date governs BOTH
    -- instalment eligibility (an instalment is due/overdue if due_date <= value_date)
    -- AND the accrual recomputation performed upstream. No separate as-of date is passed.
    value_date: Timestamp
}

-- The result returned by allocate_payment for a single payment. One per call.
entity PaymentAllocation {
    payment: Payment
    loan: Loan

    -- (c) Credit created by THIS payment's surplus only. Reports solely the newly
    -- created surplus; any pre-existing credit carried on the loan is excluded.
    credit_balance: Decimal

    -- True for the recorded zero-payment no-op (no funds moved, no instalment touched).
    is_noop: Boolean

    -- (a)/(b)/(d) The per-instalment breakdown, one record per instalment touched.
    instalment_allocations: InstalmentAllocation with allocation = this

    invariant NonNegativeCredit {
        credit_balance >= 0
    }

    -- A zero-payment no-op moves no funds, so it touches no instalment.
    invariant NoopHasNoAllocations {
        is_noop implies instalment_allocations.count = 0
    }
}

-- Per-instalment breakdown for an instalment that received funds in this payment.
-- Carries the applied amounts, the resulting outstanding balances, and any
-- tolerance written off to close the instalment. Only instalments actually
-- touched by the payment produce one of these.
entity InstalmentAllocation {
    allocation: PaymentAllocation
    instalment: Instalment

    -- (a) Amount applied to each bucket, in waterfall order.
    fees_applied: Decimal
    penalties_applied: Decimal
    interest_applied: Decimal
    principal_applied: Decimal

    -- (b) Resulting outstanding balance for each bucket after allocation.
    fees_remaining: Decimal
    penalties_remaining: Decimal
    interest_remaining: Decimal
    principal_remaining: Decimal

    -- (d) Any residual (<= config.tolerance_threshold) written off to mark this
    -- instalment fully paid. Reported per instalment so each write-off is
    -- traceable to the instalment it closed. Zero when no write-off occurred.
    tolerance_written_off: Decimal

    invariant NonNegativeApplied {
        fees_applied >= 0
        and penalties_applied >= 0
        and interest_applied >= 0
        and principal_applied >= 0
        and tolerance_written_off >= 0
    }

    -- A write-off only ever closes a sub-threshold residual.
    invariant ToleranceWithinThreshold {
        tolerance_written_off <= config.tolerance_threshold
    }
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    -- Instalment-level write-off tolerance. After all available funds have been
    -- allocated across an instalment's four buckets, if the total remaining owed
    -- on that instalment is at or below this threshold, the instalment is marked
    -- fully paid and the shortfall is written off.
    tolerance_threshold: Decimal = 0.005

    -- Currency and precision. The loan is denominated in BHD; all amounts are to
    -- 3 decimal places (fils).
    currency: String = "BHD"
    decimal_places: Integer = 3

    -- Rounding is half-up to 3 dp. Rounding residuals arise during accrual (not
    -- during the allocation fill, which is a sequential subtraction with no
    -- division). The accrual layer absorbs any rounding residual into the interest
    -- component; if an instalment's interest bucket is already zero, the residual
    -- lands in the principal component instead.
    rounding_mode: String = "half_up"

    -- Accrual convention used by the upstream accrual layer to recompute interest
    -- and penalties to the value_date. Out of scope for allocate_payment itself;
    -- recorded here as the settled default for the region. Accrues from the last
    -- accrual checkpoint forward to the value_date.
    accrual_day_count: String = "actual/365"
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

-- A negative payment is rejected with an error. No allocation record is kept.
-- (It matches no processing rule and is rejected; the explicit rule makes the
-- error observable.)
rule RejectNegativePayment {
    when: AllocatePayment(_, payment, loan)
    requires: payment.amount < 0
    ensures: PaymentRejected(payment: payment, loan: loan)

    @guidance
        -- Rejection reason: negative tendered amount. No PaymentAllocation and no
        -- instalment changes are produced.
}

-- A zero payment is a no-op, but a zero-value allocation transaction is still
-- recorded. No funds move, so no bucket changes and the instalment-level tolerance
-- check does NOT fire (it is triggered only by a payment that actually moves funds).
rule ProcessZeroPayment {
    when: AllocatePayment(_, payment, loan)
    requires: payment.amount = 0
    ensures:
        PaymentAllocation.created(
            payment: payment,
            loan: loan,
            credit_balance: 0,
            is_noop: true
        )

    @guidance
        -- Applies whether or not anything is outstanding on the loan. A loan with
        -- nothing outstanding follows the same rule: a zero payment is a recorded
        -- no-op, a negative payment is rejected.
}

-- A positive payment runs the waterfall across the loan's due/overdue instalments.
rule ProcessPayment {
    when: AllocatePayment(_, payment, loan)
    requires: payment.amount > 0

    -- Eligibility: only instalments that still carry a balance and are currently due
    -- or overdue relative to the payment's value_date. Not-yet-due instalments are
    -- excluded.
    let eligible = loan.instalments where total_outstanding > 0 and due_date <= payment.value_date

    ensures:
        let allocation = PaymentAllocation.created(
            payment: payment,
            loan: loan,
            -- Surplus remaining once every eligible instalment is fully cleared,
            -- held as newly created unallocated credit. Only this payment's own
            -- surplus; pre-existing credit is not combined.
            credit_balance: new_credit(payment, eligible),
            is_noop: false
        )

        -- One record per instalment actually touched, in waterfall order
        -- (oldest due_date first, ties by sequence_number ascending). Within each
        -- instalment the fill order is fees, penalties, interest, principal.
        for instalment in touched_instalments(payment, eligible):
            InstalmentAllocation.created(
                allocation: allocation,
                instalment: instalment,
                fees_applied: fees_applied(payment, eligible, instalment),
                penalties_applied: penalties_applied(payment, eligible, instalment),
                interest_applied: interest_applied(payment, eligible, instalment),
                principal_applied: principal_applied(payment, eligible, instalment),
                fees_remaining: fees_remaining(payment, eligible, instalment),
                penalties_remaining: penalties_remaining(payment, eligible, instalment),
                interest_remaining: interest_remaining(payment, eligible, instalment),
                principal_remaining: principal_remaining(payment, eligible, instalment),
                tolerance_written_off: tolerance_written_off(payment, eligible, instalment)
            )

            -- Post-allocation bucket balances. When the instalment-level tolerance
            -- closes the instalment (residual <= config.tolerance_threshold after a
            -- payment that moved funds), every bucket's remaining balance is zero and
            -- the shortfall surfaces in tolerance_written_off; total_outstanding then
            -- becomes zero, which is how an instalment is "marked fully paid".
            instalment.fees_outstanding = fees_remaining(payment, eligible, instalment)
            instalment.penalties_outstanding = penalties_remaining(payment, eligible, instalment)
            instalment.interest_outstanding = interest_remaining(payment, eligible, instalment)
            instalment.principal_outstanding = principal_remaining(payment, eligible, instalment)

        -- Surplus becomes newly created unallocated credit held on the loan,
        -- auto-applied later when the next instalment falls due (see
        -- ApplyCreditWhenInstalmentDue). It is never auto-refunded and does not
        -- prepay principal or alter future interest.
        loan.credit_balance = loan.credit_balance + new_credit(payment, eligible)

    @guidance
        -- WATERFALL (sequential fill; no proportional splitting, no division):
        --
        -- 1. Eligible instalments = open instalments whose due_date <= value_date.
        --    Process them one at a time, oldest due_date first; ties between
        --    instalments sharing a due_date are broken by sequence_number ascending.
        --
        -- 2. Each instalment is cleared ENTIRELY before the next is touched. The
        --    waterfall does not spread across instalments bucket-by-bucket.
        --
        -- 3. Within a single instalment the four buckets are paid down in this
        --    order: fees, then penalties, then interest, then principal. Each
        --    bucket is cleared in full before the next receives any funds.
        --
        -- 4. PARTIAL PAYMENT: a payment smaller than what is owed is applied as far
        --    as it goes down this bucket order, then stops. It is never rejected,
        --    split proportionally, or held pending a full instalment.
        --
        -- 5. TOLERANCE: applied at the instalment level, after all available funds
        --    from the payment have been allocated across that instalment's four
        --    buckets. If the total remaining owed on the instalment is then
        --    <= config.tolerance_threshold (0.005 BHD), the instalment is marked
        --    fully paid and the shortfall is written off (reported in
        --    tolerance_written_off). The check only fires for an instalment that
        --    actually received funds from this payment.
        --
        -- 6. SURPLUS: once every eligible (due/overdue) instalment is fully cleared,
        --    any remaining payment funds become newly created unallocated credit on
        --    the loan. Funds do NOT flow forward into not-yet-due instalments.
        --
        -- 7. ROUNDING: half-up to 3 dp. Residuals originate in accrual, not in this
        --    fill. The accrual layer absorbs a rounding residual into interest, or
        --    into principal if the interest bucket is already zero.
        --
        -- 8. CONSERVATION: across all touched instalments, the sum of the amounts
        --    applied to every bucket plus the newly created credit_balance equals
        --    payment.amount. Tolerance write-offs are not funded by the payment.
}

-- Existing unallocated credit is auto-applied to an instalment when that instalment
-- falls due, following the same within-instalment bucket waterfall. It does not
-- prepay principal or alter future interest, and is never auto-refunded. This is a
-- separate event from allocate_payment (which is a standalone forward application
-- of a fresh incoming payment only).
rule ApplyCreditWhenInstalmentDue {
    when: instalment: Instalment.due_date <= now
    requires: instalment.total_outstanding > 0
    requires: instalment.loan.credit_balance > 0

    let credit_loan = instalment.loan
    let applied = credit_applied_to(instalment)

    ensures:
        credit_loan.credit_balance = credit_loan.credit_balance - applied
        CreditApplied(instalment: instalment, amount: applied)

    @guidance
        -- Applies the loan's held credit to the now-due instalment using the same
        -- fees -> penalties -> interest -> principal order, reducing
        -- loan.credit_balance by the amount applied. It does not prepay principal or
        -- alter future interest, and is never auto-refunded. credit_applied_to is the
        -- amount of held credit the instalment's due buckets can absorb.
}

------------------------------------------------------------
-- Invariants
------------------------------------------------------------

invariant CreditNeverNegative {
    for loan in Loans:
        loan.credit_balance >= 0
}

-- Instalment sequence numbers are unique within a loan; they are the tie-break key
-- when two instalments share a due_date (lower sequence_number first).
invariant UniqueSequenceWithinLoan {
    for a in Instalments:
        for b in Instalments:
            a != b and a.loan = b.loan implies a.sequence_number != b.sequence_number
}

------------------------------------------------------------
-- Deferred Specifications
------------------------------------------------------------

-- Accrual of interest and penalties up to and including the value_date, performed
-- before allocation runs. allocate_payment receives the already-accrued balances.
deferred AccrualLayer.recompute          -- see: accrual.allium

------------------------------------------------------------
-- Open Questions
------------------------------------------------------------

-- These were resolved with reasonable defaults in discussion but flagged as not
-- yet firm policy; confirm with the operator.
open question "Tolerance write-off: besides the tolerance_written_off result field, should the written-off shortfall also post a separate write-off adjustment (loss) ledger transaction against the loan? Default assumed: yes."
open question "Accrual convention for recomputing interest and penalties to value_date (day-count, rate basis, reference checkpoint). Default assumed: actual/365 from the last accrual checkpoint. Owned by the accrual layer, not allocate_payment."
open question "Whether allocate_payment performs accrual recomputation internally or receives already-accrued balances. Default assumed: receives already-accrued balances; accrual stays in a dedicated layer."


## Auditor verdict

_Coverage 13/14 correct. The spec resolves the genuinely bespoke decisions (bucket order fees-before-penalties, credit-balance surplus handling, BHD 3dp precision, half-up rounding, residual→interest, value-date re-accrual, no principal prepay, 0.005 tolerance) and all three inferable ones (strict-order partial, reject-negative/zero-noop, result shape). The single gap is #13: multiple same-day payments are only covered as independent standalone applications, with no FIFO-by-receipt-timestamp ordering and no timestamp field to order by. #6 is a close pass: the primary residual destination matches (interest) with an added principal-when-interest-zero fallback that does not alter the normal case._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "The within-instalment payment order is fixed: fees, then penalties, then interest, then principal. Each component is cleared in full before the next receives any funds." (Loan comment; guidance step 3) | Spec states the exact reference order fees → penalties → interest → principal, including fees before penalties, which is the deliberately non-default choice. |
| 2 | yes | **yes** | "Each instalment is cleared ENTIRELY before the next is touched. The waterfall does not spread across instalments bucket-by-bucket." ... "oldest due_date first; ties ... by sequence_number ascending" (guidance steps 1-2) | Matches 'oldest instalment cleared in full (all four buckets) before any money touches the next.' |
| 3 | yes | **yes** | "Surplus becomes newly created unallocated credit held on the loan, auto-applied later when the next instalment falls due ... It is never auto-refunded and does not prepay principal" (ProcessPayment); ApplyCreditWhenInstalmentDue rule | Matches exactly: held as unallocated credit, auto-applied to next instalment when due, never auto-refunded. |
| 4 | yes | **yes** | config: currency: String = "BHD", decimal_places: Integer = 3; "denominated in BHD, to 3 decimal places (fils)" | Matches BHD, 3 decimal places (fils). |
| 5 | yes | **yes** | config: rounding_mode: String = "half_up"; "Rounding is half-up to 3 dp." | Matches round half-up to the 3 dp minor unit. |
| 6 | yes | **yes** | "The accrual layer absorbs any rounding residual into the interest component; if an instalment's interest bucket is already zero, the residual lands in the principal component instead." (config / guidance step 7) | Primary destination is the interest component, matching the reference ('absorbed into the interest component, not principal'); the spec adds a principal fallback only when interest is zero, a refinement that does not change the normal-case answer. |
| 7 | yes | **yes** | "A dedicated accrual layer recomputes interest and penalties up to and including the payment's value_date BEFORE allocate_payment runs"; "interest and penalties have already been recomputed to the payment's value_date" | Matches: interest is re-accrued to the value_date before allocation, which covers the back-valued (value_date earlier than today) case. |
| 8 | yes | **yes** | eligible = instalments where total_outstanding > 0 and due_date <= value_date (not-yet-due excluded); credit "does not prepay principal or alter future interest" | Matches: payment settles only due instalments, surplus becomes credit per #3, no principal prepayment, future interest unchanged. |
| 9 | yes | **yes** | "PARTIAL PAYMENT: a payment smaller than what is owed is applied as far as it goes down this bucket order, then stops. It is never rejected, split proportionally, or held pending a full instalment." (guidance step 4) | Matches strict in-order fill with explicit rejection of proportional splitting. |
| 10 | yes | **yes** | config tolerance_threshold: Decimal = 0.005; "if the total remaining owed on that instalment is at or below this threshold, the instalment is marked fully paid and the shortfall is written off" | Matches: residual ≤ 0.005 BHD closes the instalment and writes off the shortfall. |
| 11 | yes | **yes** | RejectNegativePayment rule (amount < 0 → PaymentRejected); ProcessZeroPayment: "a zero payment is a no-op, but a zero-value allocation transaction is still recorded" | Matches both: negative rejected with error, zero is a no-op that still records a zero-value allocation transaction. |
| 12 | yes | **yes** | "A dedicated accrual layer recomputes interest and penalties up to and including the payment's value_date BEFORE allocate_payment runs; this function receives already-accrued balances." | Matches: penalties accrue up to and including value_date, then allocation runs on post-accrual balances. |
| 13 | yes | no | "Standalone forward application: each call applies one fresh payment forward only"; Payment entity has only value_date, no receipt timestamp field. | Spec covers independent per-payment application but never states same-day payments are ordered FIFO by receipt timestamp, and no receipt-timestamp field exists to order by; the material ordering rule is absent. |
| 14 | yes | **yes** | PaymentAllocation.credit_balance; InstalmentAllocation fees/penalties/interest/principal_applied, *_remaining, tolerance_written_off | Returned shape includes all four reference elements: per-bucket amounts applied, resulting outstanding balances, credit_balance created, and tolerance_written_off. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.rule.unreachableTrigger",
      "location": {
        "col": 11,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-WJOrIx/spec.allium",
        "line": 200
      },
      "message": "Rule 'RejectNegativePayment' listens for trigger 'AllocatePayment' but no local surface provides or rule emits it.",
      "severity": "info"
    },
    {
      "code": "allium.rule.unreachableTrigger",
      "loca
```
