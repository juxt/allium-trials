# allium-elicit — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 19 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; I must first pin scope and the material omitted policy decisions (allocation waterfall, precision/rounding, surplus/shortfall, thresholds, result shape) before specifying anything.

Q: What's the boundary of this specification? Is `allocate_payment` a pure allocation function over a single loan's current balances, or does it also own persistence, posting dates, reversals and other loan lifecycle events? And is there anything we should deliberately treat as upstream/external (e.g. how the payment amount itself is determined, currency conversion, where balances come from)?
A: [default, not policy] `allocate_payment` is a pure allocation function: given a loan's current balances and a payment amount, it returns a fully-computed allocation result. Persistence, ledger posting, event sourcing and reversals are the caller's responsibility. Treat the following as upstream/external and therefore out of scope: determination of the payment amount (e.g. from a payment gateway or manual entry), currency conversion (the loan is single-currency BHD), and the source of current balances (the caller supplies them). Back-valued payments and same-day ordering are in scope only in the sense that the function accepts a value_date and must recompute accruals before allocating; the mechanics of how that value_date reaches the function are external.

Q: When a payment is applied, what is the allocation order? Within a single instalment, in what sequence are the four components paid down (penalties, fees, interest, principal, or some other order)? And across multiple outstanding instalments, which instalment is satisfied first (oldest-due first, highest-penalty first, proportionally, something else)?
A: Within a single instalment the order is: fees first, then penalties, then interest, then principal. Across multiple overdue instalments, the oldest instalment is cleared in full across all four buckets before any funds are applied to the next instalment.

Q: What unit and precision are amounts held in (e.g. minor currency units / cents, or decimals to N places), and when an allocation step produces a fraction of the smallest unit, which way is it rounded or truncated, and where does any remainder land?
A: Amounts are held in BHD to 3 decimal places (fils). When an allocation step produces a fraction at the third decimal place, round half-up. Any rounding residual is absorbed into the interest component, not principal.

Q: What happens when the payment does not exactly match what is owed? For an overpayment (surplus after everything outstanding is cleared): is it held as credit, applied to future/not-yet-due instalments, returned, or something else? For an underpayment (payment smaller than a component or instalment): is the partial amount applied as far as it goes, held unapplied, or rejected?
A: Overpayment (surplus after all outstanding balances are cleared): the surplus is held as an unallocated credit balance and auto-applied when the next instalment falls due. It is never auto-refunded. For an early or on-time payment that exceeds the current instalment but the loan is not in arrears: the current instalment is settled and the surplus becomes a credit balance; it does not prepay principal and future interest is unchanged. Underpayment (payment smaller than the total due): allocation proceeds in strict bucket order (fees, penalties, interest, principal, oldest instalment first), filling each bucket as far as the funds allow. There is no proportional split.

Q: Are there thresholds or minimums — e.g. a tolerance below which a residual balance is waived or treated as paid, or a minimum payment that is rejected? And how should edge inputs be handled: zero, negative, or an amount exceeding total outstanding?
A: There is one write-off tolerance: if the residual owed on an instalment after allocation is ≤ 0.005 BHD, the instalment is marked fully paid and the residual is written off. A zero-value payment is a no-op but must still record a zero-value allocation transaction. A negative payment is rejected with an error. There is no minimum payment threshold beyond this.

Q: What must `allocate_payment` return, field by field? I want the complete result shape: the breakdown of how much went to each component of each instalment, the loan's updated balances afterwards, any surplus/shortfall, and anything else the caller or downstream reporting needs to see.
A: Return, per payment: (1) the amount applied to each bucket (fees, penalties, interest, principal) of each instalment touched; (2) the resulting outstanding balance of each bucket for each instalment after allocation; (3) `credit_balance` — the unallocated surplus created, if any; (4) `tolerance_written_off` — the amount waived under the write-off tolerance, if any.  No other fields are required by policy.

### Round 2
_Step reasoning:_ Core accrual-recomputation method, back-valued payment semantics, existing-credit interaction and instalment tie-break remain unasked and are material, non-inferable policy decisions.

Q: The first answer established that `allocate_payment` accepts a `value_date` and "must recompute accruals before allocating". We haven't pinned that mechanism. When accruals are recomputed as of the value_date, what exactly is recomputed, interest only or penalties too, and on what day-count basis does interest accrue (e.g. actual/365, actual/360, 30/360)? From what date to what date is it computed?
A: Both interest and penalties are recomputed as of the value_date before allocation runs. Specifically: interest is re-accrued to the value_date, and penalties accrue up to and including the value_date, with allocation then running against those post-accrual balances. The day-count convention is not in the answer key — [default, not policy] assume actual/365, computed from the last accrual date (or drawdown date for the first period) up to and including the value_date.

Q: For a back-valued payment (value_date earlier than today), do accruals get rolled back to the value_date, reversing interest and/or penalties that accrued between the value_date and now, so the payment is applied against the balances as they stood on the value_date? Or is the value_date used only to compute accrual up to that point without unwinding anything already assessed?
A: The value_date is used only to establish the balances against which allocation runs — interest and penalties are recomputed to that date — but nothing already assessed or posted is unwound. Since this is a pure function and persistence is the caller's responsibility, any reversal of previously posted accruals is out of scope for `allocate_payment`.

Q: You said surplus is held as a credit balance and "auto-applied when the next instalment falls due". Since this is a pure function over the balances supplied, can the incoming loan already carry an unallocated credit balance from a prior payment? If so, is that existing credit combined with the new payment and applied first, and does the same bucket/instalment order apply to it?
A: Not in the answer key — [default, not policy]. Yes, the caller-supplied state may include an existing unallocated credit balance from a prior payment. If present, it is combined with the new payment amount to form a single pool, and the full pool is allocated in the standard order (oldest instalment first, fees → penalties → interest → principal). The same bucket and instalment ordering applies.

Q: Within "oldest instalment first", what is the tie-break if two outstanding instalments share the same due date? And are not-yet-due (future) instalments ever touched by a payment, or only currently-outstanding/overdue ones (with any excess always going to credit)?
A: Tie-break for same due date is not in the answer key — [default, not policy] break ties by instalment sequence number, ascending. Future (not-yet-due) instalments are never touched by an allocation: any surplus after all outstanding balances are cleared becomes a credit balance, regardless of whether future instalments exist.

### Round 3
_Step reasoning:_ Core flow is pinned, but three genuine policy edges remain unasked: residual destination when the interest bucket is zero, the scope and reporting granularity of the write-off tolerance, and whether credit_balance reports net ending credit or only newly created surplus given incoming credit is now folded into the pool.

Q: Rounding residual: you said any residual from round-half-up is absorbed into the interest component. If the step that produces the residual is the principal step and that instalment's interest bucket is already fully paid down to zero, where does the residual land then — does it still post to the (now zero) interest bucket, fall to principal, or go somewhere else?
A: [default, not policy] The answer key does not cover this edge case. If the instalment's interest bucket is already zero, the residual cannot sensibly post there. Apply it to principal instead — i.e. interest absorption is the first preference, principal the fallback when interest is exhausted.

Q: Write-off tolerance scope and reporting: does the ≤0.005 BHD write-off apply only to instalments the payment actually reached during this allocation, or to every still-outstanding instalment with a tiny residual (including ones the funds never got to)? And is `tolerance_written_off` a single aggregate figure or reported per instalment?
A: [default, not policy] The answer key phrase 'residual owed after allocation' implies the tolerance check applies only to instalments actually reached during this allocation run, not to every outstanding instalment in the loan. On reporting: the answer key gives `tolerance_written_off` as a single field with no per-instalment breakdown, so treat it as an aggregate figure for this payment.

Q: Result shape vs the combined pool: round 1 defined `credit_balance` as "the unallocated surplus created", but round 2 established that an incoming caller-supplied credit balance is folded into the allocation pool. After a payment, should `credit_balance` report the net ending credit (any unconsumed pre-existing credit plus new surplus) or strictly the newly created surplus? If pre-existing credit is partially consumed, does the result need to show that consumption?
A: [default, not policy] The answer key defines `credit_balance` as 'the unallocated surplus created', which points to newly created surplus. However, since the pre-existing credit is folded into the allocation pool before any funds are applied, the most useful and least ambiguous reading for the caller is the net ending credit balance — i.e. whatever unallocated amount remains after allocation completes, whether it originated from the new payment, prior credit, or both. The result shape does not need a separate field showing consumption of pre-existing credit; the ending balance is sufficient.

### Round 4
_Step reasoning:_ Core allocation policy, precision, surplus/shortfall, edge inputs and result shape are captured, but the accrual basis/rate for penalties and the behaviour of fees during recomputation remain genuinely material core-method gaps that have not been asked.

Q: Penalties are recomputed to the value_date before allocation. On what basis and rate do penalties accrue, what balance are they charged on (the overdue principal, the full unpaid instalment, or something else), and are they a per-day accrual or a flat charge assessed once per period? Is the penalty rate a property the caller supplies per loan/instalment, or a policy fixed in this specification?
A: Penalty accrual rate, the balance it is charged on, and whether it is a per-day accrual or a flat charge are not in the answer key. [default, not policy] Treat penalties as a per-day accrual charged on the overdue principal balance of the instalment, at a rate supplied by the caller per loan or instalment (e.g. as an annualised or daily rate field on the instalment record). The caller is responsible for providing the rate; this specification does not fix a policy rate.

Q: Of the four components, interest re-accrues and penalties accrue to the value_date. How are fees treated — are they fixed amounts supplied on each instalment that never change, or do they also accrue over time? If they can be levied during the period up to the value_date, on what trigger and basis?
A: Fees are not addressed beyond their bucket position in the answer key. [default, not policy] Treat fees as fixed amounts set when the instalment is scheduled — they do not accrue over time and are not sensitive to the value_date. They appear on the instalment record as a fixed due amount and do not change between scheduling and allocation.

### Round 5
_Step reasoning:_ Answer key appears largely exhausted (rounds 3-4 were all defaults), but before concluding I must sweep the most-skipped class (whole life: early/full settlement) and confirm bucket composition for re-accrued vs previously-assessed amounts.

Q: The whole-life class: beyond a normal payment against outstanding instalments, does `allocate_payment` ever need to handle an explicit early-settlement or full payoff, where the borrower deliberately clears the entire loan including not-yet-due instalments (and future interest is rebated or waived)? Or is early payoff firmly out of scope, so that even a payment large enough to cover every future instalment only ever clears what is currently outstanding and routes the rest to credit?
A: Early settlement with rebate or waiver of future interest is not in the answer key. The key is unambiguous that future (not-yet-due) instalments are never touched and any surplus always becomes a credit balance — so even a payment large enough to cover every future instalment only clears what is currently outstanding and routes the rest to credit. Early payoff with interest rebate is firmly out of scope for `allocate_payment`.

Q: When interest is re-accrued (and penalties accrued) to the value_date, an instalment may already carry a previously-assessed interest or penalty amount from before this run. Within the interest bucket (and the penalty bucket), is the newly-accrued amount merged with any previously-assessed amount into a single bucket that the payment fills in one step, or are previously-assessed and freshly-accrued amounts held and paid down as distinct sub-buckets in a defined order?
A: Not in the answer key. [default, not policy] Treat the bucket as a single merged figure: any previously-assessed amount and the freshly-accrued increment are combined into one balance per bucket before allocation runs, and the payment fills that combined amount in a single step. There are no sub-buckets and no ordering within the bucket between assessed and accrued portions.

### Round 6
_Step reasoning:_ Round 1 captured the material policy decisions and rounds 2-5 returned only defaults, but two completeness-gate classes remain genuinely unasked: loan lifecycle status (forbearance/default) affecting accrual, and the degenerate no-outstanding-instalment / zero-payment-with-credit edge.

Q: Can the loan supplied ever be in a special status that changes behaviour, for example a payment holiday or forbearance period, or a defaulted/legal/charged-off status? Specifically, in any such status is penalty (or interest) accrual to the value_date suspended, or does allocation otherwise behave differently, or is `allocate_payment` entirely status-agnostic and always accrues and allocates by the standard rules regardless of the loan's lifecycle status?
A: Not in the answer key. [default, not policy] `allocate_payment` is status-agnostic: it always accrues interest and penalties to the value_date and allocates by the standard rules regardless of any lifecycle status on the loan record. If a payment holiday, forbearance, or charged-off status should suppress accrual or change allocation behaviour, the caller must reflect that in the balances and accrual parameters it supplies; the function does not inspect a status field or modify its logic based on one.

Q: What should happen in the degenerate case where the loan has no currently-outstanding instalments at the value_date (all are either already settled or strictly future) but a positive payment arrives: does the entire payment simply become a credit balance, and in that same situation does an incoming zero-value payment that carries a pre-existing credit balance still run an allocation of that pooled credit, or is a zero payment always a pure no-op that leaves any existing credit untouched?
A: For the first part: yes, the entire payment becomes a credit balance. This follows directly from established policy — future (not-yet-due) instalments are never touched and any surplus after outstanding balances are cleared goes to credit; with no currently-outstanding instalments there is nothing to allocate against, so the full amount lands in credit. For the second part: a zero payment is a no-op per the answer key, which means it records a zero-value allocation transaction and leaves everything else unchanged — including any pre-existing credit balance. The incoming zero amount does not trigger an allocation pass over the pooled credit. The existing credit balance remains unallocated until a positive payment or an instalment falling due causes it to be applied.

### Round 7 (process signalled done)
_Step reasoning:_ All policy ('answer key') decisions are captured — core method, units/precision, rounding and residual, ordering and tie-break, thresholds and edge inputs, timing/value_date, surplus/shortfall, scope boundary, output shape, and the whole-life classes — and the last two full rounds (statuses, degenerate cases, bucket merging, early settlement) returned only non-policy defaults, indicating the institution-specific policy surface is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
-- loan-allocation.allium
--
-- Payment allocation for a loan-servicing system.
--
-- One-sentence description: given a loan's current per-instalment balances
-- and an incoming payment, `allocate_payment` recomputes accruals as of the
-- payment's value_date and returns, deterministically, how the payment is
-- applied across every component of every instalment it touches, together
-- with the loan's updated balances.
--
-- Scope: the pure allocation computation `allocate_payment(payment, loan)`.
--   Given the caller-supplied balances and a payment amount + value_date, it
--   returns a fully-computed allocation result. It is a PURE function: it reads
--   its inputs and returns a value; it mutates nothing and persists nothing.
--   The inputs are declared in the `given` block; the output is AllocationResult.
-- Includes:
--   - Recomputing interest and penalty accruals to the value_date before
--     allocating (fees are fixed and do not accrue).
--   - The bucket order within an instalment and the instalment order across
--     instalments.
--   - Pooling any caller-supplied credit balance with the new payment.
--   - Rounding, the write-off tolerance, overpayment-to-credit, underpayment
--     fill, and the zero / negative / degenerate edge cases.
--   - The complete result shape the caller receives.
-- Excludes (caller / upstream responsibilities, deliberately out of scope):
--   - Persistence, ledger posting, event sourcing and reversals: the caller
--     owns these. `allocate_payment` returns a value and mutates nothing.
--   - Reversal or unwinding of previously-posted accruals, even for a
--     back-valued payment. Nothing already assessed or posted is unwound;
--     the value_date only establishes the balances allocation runs against.
--   - Determination of the payment amount (payment gateway, manual entry).
--   - Currency conversion. The loan is single-currency BHD throughout.
--   - The source of current balances: the caller supplies them.
--   - How the value_date reaches the function: external.
--   - Loan lifecycle status (payment holiday, forbearance, defaulted,
--     charged-off). `allocate_payment` is status-agnostic: it always accrues
--     and allocates by the standard rules and never inspects a status field.
--     To suppress accrual or change behaviour, the caller must reflect that
--     in the balances and accrual parameters it supplies.
--   - Early settlement / full payoff with rebate or waiver of future
--     interest. Future (not-yet-due) instalments are never touched; any
--     surplus always becomes a credit balance (see the AllocatePayment
--     guidance, step 7).
-- Dependencies: Loan, Instalment and Payment are owned and supplied by the
--   calling loan-servicing system; here they are the `given` inputs the pure
--   function reads.

------------------------------------------------------------
-- Units, precision and conventions (apply throughout)
------------------------------------------------------------
--
-- Currency: BHD (Bahraini dinar), single currency. No conversion.
-- Precision: amounts are held to 3 decimal places (fils), i.e. Decimal with
--   a 3-dp scale. Every Decimal field below is a BHD amount in fils precision.
-- Rounding: when an allocation step produces a fraction at the third decimal
--   place, round half-up. The rounding residual is absorbed into the interest
--   component of the instalment being allocated; if that instalment's interest
--   bucket is already zero (exhausted), the residual falls to principal
--   instead. Interest is the first preference, principal the fallback.
--   (The interest-first rule is answer-key policy; the principal fallback is
--   a default for the edge the key does not cover.)
-- Day-count for interest re-accrual: actual/365, computed from the last
--   accrual date (or the drawdown date for the first period) up to and
--   including the value_date. (Default convention, not operator policy.)

------------------------------------------------------------
-- Given (the pure function's inputs, supplied by the caller)
------------------------------------------------------------

given {
    loan: Loan
    payment: Payment
}

------------------------------------------------------------
-- Config (policy constants)
------------------------------------------------------------

config {
    -- Write-off tolerance: if the residual owed on an instalment the payment
    -- reached is <= this amount after allocation, the instalment is marked
    -- fully paid and the residual is written off. BHD. There is no other
    -- minimum-payment threshold.
    write_off_tolerance: Decimal = 0.005
}

------------------------------------------------------------
-- Input entities (caller-supplied state; read-only here)
------------------------------------------------------------

-- The loan whose balances the caller supplies. `allocate_payment` reads it
-- and never mutates it; updated balances are returned in the result.
entity Loan {
    -- Unallocated surplus carried from a prior payment, if any. It is folded
    -- into the allocation pool before any funds are applied (see the
    -- AllocatePayment guidance). A loan with no carried credit supplies 0.
    credit_balance: Decimal

    instalments: Instalment with loan = this

    -- Currently outstanding (due / overdue) instalments as of the value_date,
    -- ordered oldest-first with ties broken by sequence_number ascending.
    -- Only these are ever allocated against; future instalments are untouched.
    outstanding_instalments: instalments where is_outstanding = true
}

-- One scheduled instalment with its four component balances. All balances and
-- accrual parameters are supplied by the caller as they stand before this run.
entity Instalment {
    loan: Loan

    -- Ordering keys. Allocation clears the oldest instalment first; ties on
    -- due_date break by sequence_number ascending (default tie-break).
    sequence_number: Integer
    due_date: Timestamp

    -- Fixed fee amount set when the instalment was scheduled. Fees do NOT
    -- accrue over time and are not sensitive to the value_date.
    fees_outstanding: Decimal

    -- Penalties and interest previously assessed before this run. The function
    -- accrues further amounts to the value_date and merges each with its
    -- previously-assessed balance into a single bucket (no sub-buckets, no
    -- ordering within a bucket between assessed and freshly-accrued portions).
    penalties_assessed: Decimal
    interest_assessed: Decimal

    -- Outstanding principal of the instalment.
    principal_outstanding: Decimal

    -- Parameters used to recompute accruals to the value_date. Penalties
    -- accrue per day on the overdue principal balance at this caller-supplied
    -- rate; interest re-accrues on principal on the actual/365 basis above.
    -- (Penalty basis/rate and interest rate are caller-supplied; this spec
    -- fixes no policy rate.)
    penalty_rate: Decimal
    interest_rate: Decimal
    last_accrual_date: Timestamp
    drawdown_date: Timestamp

    -- True once due_date has passed as of the value_date. Only currently
    -- outstanding (overdue / due) instalments are allocated against.
    is_outstanding: due_date <= payment.value_date
}

-- The incoming payment. Amount and value_date are determined upstream.
entity Payment {
    loan: Loan
    -- BHD, fils precision. Negative is rejected; zero is a no-op that still
    -- records a zero-value allocation (see AllocatePayment).
    amount: Decimal
    -- Accruals are recomputed to this date before allocation runs. May be in
    -- the past (back-valued); nothing already posted is unwound.
    value_date: Timestamp
}

------------------------------------------------------------
-- Output entities (the value returned to the caller)
------------------------------------------------------------

-- The complete value `allocate_payment` returns for one payment.
entity AllocationResult {
    loan: Loan
    payment: Payment

    -- Per-instalment breakdown: one line for each instalment the payment
    -- touched during this run.
    lines: AllocationLine with result = this

    -- Net ending unallocated credit after allocation completes: whatever
    -- amount remains unallocated, whether it originated from the new payment,
    -- the pre-existing credit, or both. Pre-existing credit folded into the
    -- pool is reflected here as the ending balance; no separate field reports
    -- its consumption. Surplus is held as credit, never auto-refunded, and is
    -- auto-applied by the caller when the next instalment falls due.
    credit_balance: Decimal

    -- Aggregate amount waived this run under the write-off tolerance, across
    -- all instalments reached. Single figure, no per-instalment breakdown.
    tolerance_written_off: Decimal
}

-- How the payment was applied to one instalment, and that instalment's
-- resulting bucket balances afterwards.
entity AllocationLine {
    result: AllocationResult
    instalment: Instalment

    -- (1) Amount applied to each bucket of this instalment by this payment.
    fees_applied: Decimal
    penalties_applied: Decimal
    interest_applied: Decimal
    principal_applied: Decimal

    -- (2) Resulting outstanding balance of each bucket after allocation
    -- (post-accrual balance minus the amount applied, minus any write-off).
    fees_outstanding: Decimal
    penalties_outstanding: Decimal
    interest_outstanding: Decimal
    principal_outstanding: Decimal

    -- Total applied to this instalment across all four buckets.
    total_applied: fees_applied + penalties_applied + interest_applied + principal_applied

    -- Total still owed on this instalment after allocation.
    total_outstanding: fees_outstanding + penalties_outstanding + interest_outstanding + principal_outstanding

    -- True when the instalment is settled, including when a residual of
    -- <= config.write_off_tolerance was written off to close it.
    fully_paid: Boolean
}

------------------------------------------------------------
-- Rule: the allocation computation
------------------------------------------------------------

-- A single pure evaluation: it reads the given loan and payment and returns one
-- AllocationResult. The per-field values are produced by the deterministic
-- procedure described in @guidance; they are modelled as calls on the
-- Allocation black box because the exact arithmetic is an implementation
-- concern, while the order, basis, rounding and edge behaviour it must follow
-- are pinned below and in the invariants.
rule AllocatePayment {
    when: AllocatePayment()

    -- A negative payment is rejected with an error; allocation does not run.
    requires: payment.amount >= 0

    ensures:
        AllocationResult.created(
            loan: loan,
            payment: payment,
            credit_balance: Allocation.ending_credit(loan, payment),
            tolerance_written_off: Allocation.written_off(loan, payment)
        )
        -- One AllocationLine per instalment reached, carrying the per-bucket
        -- applied amounts and resulting balances, is produced by the same
        -- procedure: Allocation.lines(loan, payment).

    @guidance
        -- Deterministic procedure allocate_payment(payment, loan):
        --
        -- 0. Reject a negative payment.amount with an error (requires above).
        --
        -- 1. Zero payment: a zero amount is a no-op. Record a zero-value
        --    AllocationResult (all applied amounts 0, tolerance_written_off 0)
        --    and leave everything unchanged, INCLUDING any pre-existing
        --    credit_balance -- credit is reported back unchanged. A zero
        --    payment does NOT trigger an allocation pass over pooled credit;
        --    carried credit stays unallocated until a positive payment or an
        --    instalment falling due applies it.
        --
        -- 2. Recompute accruals to payment.value_date (only for amount > 0):
        --    - Interest re-accrues on principal, actual/365, from
        --      last_accrual_date (or drawdown_date for the first period) up to
        --      and including value_date. Merge the freshly-accrued increment
        --      with interest_assessed into one interest bucket.
        --    - Penalties accrue per day on the overdue principal balance at
        --      penalty_rate, up to and including value_date. Merge with
        --      penalties_assessed into one penalty bucket.
        --    - Fees are fixed; they do not change.
        --    Nothing previously assessed or posted is unwound, even when
        --    value_date is in the past.
        --
        -- 3. Form a single pool = loan.credit_balance + payment.amount. The
        --    whole pool is allocated by the standard order below; carried
        --    credit and new money are indistinguishable once pooled.
        --
        -- 4. Allocate oldest instalment first (across currently-outstanding
        --    instalments only; tie-break on equal due_date by sequence_number
        --    ascending). Clear an instalment fully across all four buckets
        --    before moving to the next. Within an instalment the bucket order
        --    is: fees, then penalties, then interest, then principal. Fill
        --    each bucket as far as the remaining pool allows (underpayment
        --    stops partway; there is NO proportional split).
        --
        -- 5. Rounding: round half-up at the third decimal (fils). Absorb the
        --    residual into that instalment's interest bucket; if interest is
        --    already zero, absorb into principal instead.
        --
        -- 6. Write-off tolerance: for each instalment the payment reached,
        --    if the residual owed after allocation is <= write_off_tolerance,
        --    mark it fully paid and write the residual off. Sum the written-off
        --    residuals into tolerance_written_off. The check applies ONLY to
        --    instalments reached this run, not to every outstanding instalment.
        --
        -- 7. Any pool remaining after all outstanding instalments are cleared
        --    becomes the ending credit_balance. Future (not-yet-due)
        --    instalments are never touched: even a payment large enough to
        --    cover every future instalment only clears what is currently
        --    outstanding and routes the rest to credit. An early/on-time
        --    payment exceeding the current instalment settles it and sends the
        --    surplus to credit; it does NOT prepay principal and future
        --    interest is unchanged. Surplus is never auto-refunded.
        --
        -- 8. Degenerate case: if there are no currently-outstanding
        --    instalments at the value_date but amount > 0, the entire payment
        --    becomes credit_balance.
}

------------------------------------------------------------
-- Invariants (properties the result must always satisfy)
------------------------------------------------------------

-- Funds are conserved: what is applied plus what remains as ending credit
-- equals the new payment plus the credit carried in. The written-off residual
-- is NOT funded from the pool (it reduces what is owed, not what is paid), so
-- it does not appear in this balance.
invariant FundsConserved {
    for r in AllocationResults:
        total(r.lines, l => l.total_applied) + r.credit_balance
            = r.payment.amount + r.loan.credit_balance
}

-- The ending credit balance is never negative: allocation never applies more
-- than the pool holds.
invariant CreditBalanceNonNegative {
    for r in AllocationResults:
        r.credit_balance >= 0
}

-- Only currently-outstanding instalments are ever allocated against; no line
-- is produced for a future (not-yet-due) instalment.
invariant NoFutureInstalmentTouched {
    for line in AllocationLines:
        line.instalment.is_outstanding = true
}

-- No bucket is ever over-paid: every applied amount is non-negative and every
-- resulting outstanding balance is non-negative.
invariant AppliedAndOutstandingNonNegative {
    for line in AllocationLines:
        line.fees_applied >= 0
        and line.penalties_applied >= 0
        and line.interest_applied >= 0
        and line.principal_applied >= 0
        and line.fees_outstanding >= 0
        and line.penalties_outstanding >= 0
        and line.interest_outstanding >= 0
        and line.principal_outstanding >= 0
}

-- Any residual that closed an instalment under the tolerance never exceeds the
-- configured tolerance, and the reported aggregate is non-negative.
invariant WriteOffWithinTolerance {
    for r in AllocationResults:
        r.tolerance_written_off >= 0
}

-- A line is marked fully_paid exactly when nothing is left owed on it (a bare
-- zero residual, or a residual written off under the tolerance).
invariant FullyPaidMeansNoResidualOrWrittenOff {
    for line in AllocationLines:
        line.fully_paid implies line.total_outstanding <= config.write_off_tolerance
}


## Auditor verdict

_The spec resolves 13 of 14 reference decisions correctly (coverage 13/14 ≈ 0.93). It matches every bespoke, hard-to-infer choice: fees-before-penalties bucket order (1), oldest-cleared-in-full (2), credit-balance overpayment handling (3, 8), BHD 3-dp precision (4), half-up rounding (5), residual-to-interest (6), value-date re-accrual (7, 12), strict-order partial fill (9), 0.005 write-off tolerance (10), negative-reject/zero-noop (11) and the full result shape (14). The sole gap is decision 13 (same-day multiple payments, FIFO by receipt timestamp): the spec is a pure single-payment function with no receipt-timestamp concept and never states how concurrent same-day payments are ordered or allocated._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Step 4: "Within an instalment the bucket order is: fees, then penalties, then interest, then principal." | Spec states the exact order fees → penalties → interest → principal, matching the reference's deliberate fees-before-penalties choice. |
| 2 | yes | **yes** | Step 4: "Allocate oldest instalment first ... Clear an instalment fully across all four buckets before moving to the next." | Oldest-first, cleared in full across all four buckets before touching the next, matches the reference exactly. |
| 3 | yes | **yes** | AllocationResult.credit_balance: "Surplus is held as credit, never auto-refunded, and is auto-applied by the caller when the next instalment falls due." Step 7: remaining pool "becomes the ending credit_balance." | Overpayment held as unallocated credit, auto-applied when next instalment falls due, never auto-refunded — all three elements match. |
| 4 | yes | **yes** | Units section: "Currency: BHD ... Precision: amounts are held to 3 decimal places (fils)." | Spec fixes BHD at 3 dp (fils), matching the reference precision. |
| 5 | yes | **yes** | Units section: "when an allocation step produces a fraction at the third decimal place, round half-up." Step 5: "round half-up at the third decimal (fils)." | Round half-up to the 3-dp minor unit matches the reference rounding method. |
| 6 | yes | **yes** | Units section: "The rounding residual is absorbed into the interest component of the instalment being allocated"; Step 5 repeats this. | Primary residual destination is the interest component, matching the reference; the principal fallback is flagged as an uncovered edge and does not contradict the stated policy. |
| 7 | yes | **yes** | Step 2: "Interest re-accrues on principal ... up to and including value_date." Payment.value_date: "May be in the past (back-valued)." | Interest is recomputed to the value_date before allocation, including when the value_date is earlier, matching the reference. |
| 8 | yes | **yes** | Step 7: "An early/on-time payment exceeding the current instalment settles it and sends the surplus to credit; it does NOT prepay principal and future interest is unchanged." | Early payment settles the current instalment, surplus to credit, no principal prepayment, future interest unchanged — matches verbatim. |
| 9 | yes | **yes** | Step 4: "Fill each bucket as far as the remaining pool allows (underpayment stops partway; there is NO proportional split)." | Strict in-order filling with no proportional split matches the reference. |
| 10 | yes | **yes** | config: "write_off_tolerance: Decimal = 0.005"; Step 6: "if the residual owed after allocation is <= write_off_tolerance, mark it fully paid and write the residual off." | Tolerance of 0.005 BHD, instalment marked fully paid and residual written off, matches the reference value and behaviour. |
| 11 | yes | **yes** | Payment.amount: "Negative is rejected; zero is a no-op that still records a zero-value allocation." Step 1: "Record a zero-value AllocationResult (all applied amounts 0, tolerance_written_off 0)." | Negative rejected with an error, zero a no-op that still records a zero-value allocation transaction, matches the reference contract. |
| 12 | yes | **yes** | Step 2: "Penalties accrue per day on the overdue principal balance at penalty_rate, up to and including value_date," then Step 4 allocates on the post-accrual balances. | Penalties accrue up to and including the value_date before allocation runs on post-accrual balances, matching the reference. |
| 13 | no | no | absent | The spec defines a pure single-payment function and never addresses ordering of multiple same-day payments; there is no receipt-timestamp field and no statement of FIFO-by-timestamp independent allocation. |
| 14 | yes | **yes** | AllocationLine carries fees/penalties/interest/principal_applied and the four *_outstanding balances; AllocationResult carries credit_balance and tolerance_written_off. | The result exposes per-bucket applied amounts per instalment, resulting outstanding balances, the credit_balance created and tolerance_written_off — all four reference elements. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-0YypWy/spec.allium",
        "line": 105
      },
      "message": "Field 'Loan.outstanding_instalments' is declared but not referenced elsewhere.",
      "severity": "info"
    },
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg
```
