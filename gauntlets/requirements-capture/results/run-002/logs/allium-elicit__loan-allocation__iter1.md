# allium-elicit — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 28 · Captured: 14/14 · Bespoke captured: 8/8

## Conversation

### Round 1
_Step reasoning:_ Brief omits the allocation waterfall, partial/overpayment policy, rounding, edge inputs, timing and output shape, none reliably inferable, so I elicit these material decisions before specifying.

Q: Within a single instalment, in what order is the payment applied across its four components (penalties, fees, interest, principal), and across multiple outstanding instalments, in what order are they paid (e.g. oldest instalment fully before the next, or the same component across all instalments first)?
A: Within a single instalment the order is: fees, then penalties, then interest, then principal. Across multiple outstanding instalments: clear the oldest instalment in full across all four of its buckets before any money touches the next instalment.

Q: When the payment is less than the total owed, how is a partial amount applied: must it clear whole components or whole instalments, or can it part-pay a component, and where does any indivisible remainder land?
A: Strict sequential fill. The payment is applied bucket by bucket in order until it is exhausted; a component may be partially paid and the remainder stays in that bucket. There is no proportional splitting and no special treatment of a remainder — the payment simply stops wherever the funds run out.

Q: When the payment exceeds everything currently owed, what happens to the surplus: held as an unapplied credit, applied to reduce future/principal balance, or returned to the borrower?
A: The surplus is held as an unallocated credit balance. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded to the borrower.

Q: What currency and smallest unit are amounts measured in, and when a computed split does not divide evenly to that unit, which way is it rounded and which component or instalment absorbs the rounding remainder?
A: The loan is denominated in BHD (Bahraini Dinar); the minor unit is the fils, three decimal places. Rounding is half-up to three decimal places. Any rounding residual is absorbed into the interest component.

Q: How should degenerate inputs be handled: a zero payment, a negative payment, and a payment against a loan with nothing outstanding?
A: A negative payment is rejected with an error. A zero payment is a no-op but a zero-value allocation transaction is still recorded. A payment against a loan with nothing outstanding is [default, not policy] treated as a pure overpayment — the full amount becomes a credit balance per the overpayment rule.

Q: Does the allocation depend on an effective date or timing (for example interest or penalties accruing up to the payment date), or is it applied purely against the balances as they currently stand?
A: Yes, timing is material. Penalties accrue up to and including the value_date before allocation runs on the post-accrual balances. For a back-valued payment whose value_date is earlier than today, interest is recomputed (re-accrued) to that value_date before allocation.

Q: What exactly must the function return, field by field: the breakdown of how much went to each component of each instalment, the loan's updated balances, any surplus/credit, and anything else the caller or borrower is shown?
A: Per payment, return: the amount applied to each bucket (fees, penalties, interest, principal) of each instalment touched; the resulting outstanding balance per bucket per instalment; any credit_balance created; and any tolerance_written_off (a residual of 0.005 BHD or less is written off and the instalment marked fully paid).

### Round 2
_Step reasoning:_ Core waterfall, precision, surplus and output are settled, but the whole-life class (reversal/correction), credit-balance application mechanics, forward-date bounds, the accrual scope boundary and tolerance granularity remain unasked and are non-inferable policy.

Q: Can an allocated payment later be reversed, corrected or adjusted, and if so how does the allocation unwind, specifically does reversing a payment also reverse any credit_balance it created and any tolerance_written_off, and does it re-open instalments that were marked fully paid?
A: [default, not policy] Reversal is a full unwind: the allocation is reversed bucket by bucket, any credit_balance created by the payment is reversed, any tolerance_written_off is reinstated as a live balance, and instalments that were marked fully paid are re-opened to their pre-payment outstanding balances.

Q: When the held credit_balance is auto-applied to the next instalment as it falls due, does it follow the same fees then penalties then interest then principal waterfall, and if the credit exceeds that instalment does the excess remain as credit or cascade into subsequent instalments?
A: The credit_balance follows the same fees-then-penalties-then-interest-then-principal waterfall when auto-applied. If the credit exceeds the instalment due, the excess remains as a credit_balance and is not cascaded immediately into subsequent instalments; it waits until the next instalment falls due.

Q: How is a value_date in the future (later than today) handled, rejected or allowed, and is there any limit on how far back a back-valued value_date may be set?
A: [default, not policy] A value_date in the future is rejected with an error. There is no defined limit on how far back a back-valued value_date may be set.

Q: Does allocate_payment itself perform the penalty accrual and interest re-accrual to the value_date, or does it receive a loan whose balances are already accrued to that date and only allocate against them?
A: [default, not policy] allocate_payment itself performs the penalty accrual and interest re-accrual to the value_date before running allocation; it does not assume the caller has pre-accrued the balances.

Q: Is the 0.005 BHD write-off tolerance assessed per bucket, per whole instalment, or per payment, and is it applied only when it would leave the instalment otherwise fully paid?
A: The tolerance is assessed per instalment, against the total residual remaining across all buckets of that instalment after allocation, and it is applied only when the residual is all that stands between the instalment and fully-paid status — i.e. the write-off closes the instalment.

### Round 3
_Step reasoning:_ Accrual methods were pulled into scope (allocate_payment performs them) but their conventions/rate sources are unpinned, and the interaction with a pre-existing credit balance plus the oldest-instalment tie-break remain unasked material decisions.

Q: You've said allocate_payment itself re-accrues interest to the value_date. On what basis is that interest computed, specifically the day-count convention (e.g. actual/360, actual/365, 30/360) and the rate source (fixed rate held on the loan, per-instalment schedule, or supplied in)? And when a back-valued value_date is earlier than the last accrual, does re-accrual reduce previously accrued interest downward, or only ever add?
A: [default, not policy] The day-count convention is actual/365; the rate used is the fixed annual rate held on the loan record. When a back-valued value_date is earlier than the date to which interest was last accrued, re-accrual recomputes the interest for the affected period from that earlier date forward, which can reduce previously accrued interest downward — it is a full recomputation to value_date, not a one-way addition.

Q: Likewise, how exactly do penalties accrue up to the value_date, a per-diem rate on the overdue amount, a flat charge per missed instalment, or a stepped schedule, and where does that rate/parameter come from (held on the loan, on each instalment, or passed in)?
A: [default, not policy] Penalties accrue as a per-diem charge on the total overdue outstanding balance of each late instalment. The per-diem rate (expressed as an annual rate divided by the day-count basis) is held on the loan record. Accrual runs from the day after each instalment's due date up to and including the value_date, and each overdue instalment accrues independently.

Q: If the loan already holds an unallocated credit_balance at the moment allocate_payment runs, is that pre-existing credit combined with the incoming payment and run through the same fees-penalties-interest-principal waterfall, and if so is the credit consumed before or after the new funds?
A: [default, not policy] A pre-existing credit_balance is applied first, before the incoming payment funds, through the same fees-then-penalties-then-interest-then-principal waterfall against the oldest outstanding instalment. The incoming payment amount is then applied to whatever remains after the credit is consumed. The two are not pooled into a single notional sum; credit is drawn down first, new funds second.

Q: What defines instalment age for the oldest-first ordering (due date, instalment sequence number, or origination order), and what is the tie-break when two outstanding instalments share the same due date?
A: [default, not policy] Instalment age is determined by due date, oldest due date first. Where two outstanding instalments share the same due date, the tie-break is instalment sequence number, lower sequence number first.

### Round 4
_Step reasoning:_ Core waterfall, timing, rounding, ordering, reversal and output are all covered; before concluding I need to close three still-unasked material classes: interest accrual scope/placement (and downward recompute conflicts), early-settlement/prepayment rebate handling, and same-day concurrency ordering.

Q: When interest is (re-)accrued to the value_date, on what balance does it accrue: only the overdue instalments (as penalties do), or the whole outstanding principal including instalments not yet due? And is the accrued interest added to each instalment's own interest bucket, or to a single loan-level interest figure? Relatedly, if a back-valued recomputation reduces interest below an amount already allocated to that bucket by an earlier payment, how is that handled?
A: [default, not policy] Interest accrues on the total outstanding principal balance across all instalments, including those not yet due — not only on overdue amounts as penalties do. The resulting interest is held in each instalment's own interest bucket, apportioned in proportion to each instalment's share of outstanding principal. If a back-valued recomputation would reduce an instalment's accrued interest below an amount already allocated to that bucket by a prior payment, the value_date supplied pre-dates the effective date of that earlier payment; this situation is rejected with an error — the system does not support retroactive reduction of already-allocated interest.

Q: When a single payment is large enough to settle the entire remaining loan ahead of schedule, including instalments not yet due, is there any special handling, for example an interest rebate for the unexpired period or a settlement/prepayment figure computed differently from the normal outstanding balances, or is it simply ordinary allocation against currently-outstanding balances with future instalments left untouched and any excess held as credit?
A: No special handling. A payment large enough to cover the entire remaining loan is applied through the normal oldest-first, fees-then-penalties-then-interest-then-principal waterfall against currently-outstanding balances only. Future instalments are left untouched. There is no interest rebate for the unexpired period and no separately computed settlement or prepayment figure. Any surplus beyond what is currently outstanding becomes a credit balance per the standard overpayment rule.

Q: If more than one payment is posted on the same loan with the same value_date, what determines the order in which they are allocated, and can allocation of one payment see the balance changes made by another posted the same day?
A: Same-day payments are applied FIFO by receipt timestamp, each allocated independently in turn. The second payment therefore sees the balance state as left by the first; there is no pooling or simultaneous settlement.

### Round 5
_Step reasoning:_ Core method and units classes are largely covered, but the penalty day-count basis is unpinned and the penalty accrual base (whether it compounds onto prior penalties/interest) is ambiguous, both material convention choices with several plausible answers.

Q: For penalty accrual you said the per-diem rate is an annual rate divided by the day-count basis, but the basis itself isn't pinned. Which day-count convention applies to penalties, actual/365 as with interest, actual/360, or something else, and is it the same basis the loan uses for interest?
A: [default, not policy] The same actual/365 basis as interest.

Q: When penalties accrue per-diem on the 'total overdue outstanding balance' of a late instalment, does that base include previously accrued-but-unpaid penalties and interest on that instalment (so penalties compound onto penalties and interest), or is the base restricted to overdue principal and non-penalty buckets only?
A: [default, not policy] The base is restricted to the overdue principal and fees buckets of that instalment only. Previously accrued-but-unpaid penalties and interest are excluded from the penalty accrual base; penalties do not compound onto penalties or onto accrued interest.

### Round 6
_Step reasoning:_ Nearly complete, but the fees component (first in the waterfall) has never had its origin/accrual basis established, and the whole-life fate of a residual credit balance at loan closure is still an unasked policy class.

Q: The fees bucket is the first in the waterfall and one of the four components, but we've never established how it is populated: are fees fixed charges set when the instalment is created, or do they accrue or change over the instalment's life (like penalties and interest do), and where does the amount or rate come from, held on the instalment, on the loan, or passed in?
A: [default, not policy] Fees are fixed charges set at instalment creation — origination fees, administration charges, or similar. They do not accrue or change over the instalment's life. The amount is held on the instalment record directly; there is no rate to apply and no periodic computation.

Q: When the final instalment is cleared and the loan is fully paid off, what becomes of any remaining unallocated credit_balance: does it sit indefinitely (never auto-refunded, per the overpayment rule), trigger a manual refund or write-off, and does the loan itself move to a closed/settled state that changes how a subsequent payment against it is handled?
A: [default, not policy] Once all instalments are cleared and the loan is fully paid off, the loan moves to a closed/settled state. Any remaining credit_balance sits on the closed loan record; it is never auto-refunded per the standard overpayment rule, and with no future instalments due there is nothing for the auto-apply mechanism to trigger against. Disposition of that residual credit (manual refund or write-off) is an operational matter outside the scope of allocate_payment. A subsequent payment posted against a closed loan is rejected with an error rather than treated as a new overpayment.

### Round 7
_Step reasoning:_ Two material policy classes remain unasked: whether penalty accrual recomputes downward on back-valuation symmetrically with interest, and what triggers the credit auto-apply when no payment is posted (scope boundary of allocate_payment).

Q: You've established that a back-valued value_date earlier than the last interest accrual recomputes interest downward (and is rejected if that would undercut interest already allocated by a prior payment). Do penalties behave symmetrically, is the overdue period recomputed to the earlier value_date so accrued penalties can also reduce downward, and is the same rejection applied if that would reduce penalties below an amount already allocated by a prior payment? Or are penalties only ever added, never reduced, on back-valuation?
A: [default, not policy] Penalties behave symmetrically. Accrual runs from the day after each instalment's due date up to and including the value_date, so a back-valued value_date shortens the accrual window and can reduce previously accrued penalties. The same rejection rule applies: if the recomputed penalty balance would fall below an amount already allocated to that bucket by a prior payment, the value_date is rejected with an error.

Q: The held credit_balance is 'auto-applied to the next instalment when that instalment falls due.' When no new payment is being posted, what actually triggers that auto-application, is it performed inside allocate_payment (and if so, invoked how, given the function's signature is payment plus loan), or is it a separate scheduled process outside this function's scope that we should treat as external?
A: [default, not policy] The auto-application is a separate scheduled process outside allocate_payment's scope. allocate_payment is invoked only when a payment is being posted; it has no mechanism to fire on a due-date event with no accompanying payment. The credit auto-apply on instalment due date is handled by an external scheduling or event-driven process that should be treated as outside this function's boundary.

### Round 8
_Step reasoning:_ Three material policy points remain genuinely unasked: whether a zero payment triggers accrual, where the cross-instalment interest-apportionment rounding residual lands, and how/where accrual-level rounding is applied.

Q: Does a zero payment still run the penalty accrual and interest re-accrual to the value_date before recording its zero-value allocation (so the loan's balances can change even though nothing is applied), or is a zero payment a true no-op that skips accrual entirely and leaves balances untouched?
A: [default, not policy] A zero payment still runs penalty accrual and interest re-accrual to the value_date before recording its zero-value allocation transaction. Balances may therefore change even though no funds are applied. It is not a true no-op at the accrual layer; it is a no-op only at the allocation layer.

Q: When the re-accrued interest is apportioned across instalments in proportion to each instalment's share of outstanding principal, the split will not divide evenly to the fils and leaves a cross-instalment residual. Which instalment's interest bucket absorbs that apportionment residual: the oldest, the one with the largest principal share, or the last?
A: [default, not policy] The apportionment residual is absorbed into the last instalment's interest bucket (highest instalment sequence number among those with outstanding principal).

Q: Do the per-diem interest and penalty accrual computations themselves round half-up to the fils, and does the 'rounding residual absorbed into the interest component' rule apply to that accrual rounding, or only to the rounding that arises when splitting a payment across buckets?
A: [default, not policy] Per-diem accrual computations round half-up to the fils at the point each instalment's daily charge is computed. The 'rounding residual absorbed into the interest component' rule applies only to rounding that arises when splitting a payment across buckets at allocation time, not to accrual rounding; the rounded accrual figure is simply recorded in its respective bucket (interest or penalty) with no separate residual to route.

## Produced specification

-- allium: 3
-- loan-allocation.allium

-- Scope: Payment allocation for the loan servicing system — the function
--   allocate_payment(payment, loan): applies an incoming payment across what a
--   borrower currently owes and reports how it was applied plus the updated balances.
-- Includes:
--   - Value-date accrual of penalties and interest run before allocation
--   - The fees -> penalties -> interest -> principal waterfall, oldest instalment first
--   - Pre-existing credit draw-down, surplus credit, per-instalment write-off tolerance
--   - The returned allocation breakdown (per bucket, per instalment) and updated balances
--   - Payment reversal (full unwind) and loan closure
-- Excludes:
--   - The external scheduled process that auto-applies a held credit_balance to the
--     next instalment on its due date (fires on a due-date event with no payment;
--     allocate_payment is invoked only when a payment is posted). Out of this boundary.
--   - Disposition of a residual credit_balance left on a closed/settled loan
--     (manual refund or write-off) — an operational matter outside allocate_payment.
--   - Origination of loans and instalments; fees are fixed at instalment creation.
-- Currency: all amounts are BHD (Bahraini Dinar); the minor unit is the fils
--   (three decimal places). Rounding is half-up to three decimal places.

------------------------------------------------------------
-- External Entities
------------------------------------------------------------

-- The party that invokes allocation / reversal is a servicing system (code),
-- modelled minimally so surfaces can name the boundary.
external entity Operator {
    active: Boolean
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    -- Money representation. Amounts are BHD measured to the fils (3 dp).
    currency: String = "BHD"
    minor_unit_decimals: Integer = 3

    -- A per-instalment residual of this much or less is written off, closing the
    -- instalment, only when the write-off is all that stands between the instalment
    -- and fully-paid status.
    write_off_tolerance: Decimal = 0.005

    -- Day-count basis for BOTH interest and penalty per-diem accrual: actual/365.
    day_count_basis: Integer = 365
}

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

entity Loan {
    status: active | closed

    -- Fixed annual rates held on the loan record (not on instalments, not passed in).
    annual_interest_rate: Decimal          -- fixed; drives interest re-accrual (actual/365)
    penalty_annual_rate: Decimal           -- per-diem penalty rate = this / day_count_basis

    -- Unallocated credit held against the loan. Never auto-refunded. On a payment it is
    -- drawn down first (before incoming funds). Auto-application to the next instalment
    -- on its due date is performed by an EXTERNAL scheduled process (out of scope here).
    credit_balance: Decimal

    -- The date interest has been accrued up to. A back-valued payment whose value_date
    -- is earlier than this re-accrues (recomputes) interest to the earlier date.
    interest_accrued_to: Timestamp

    instalments: Instalment with loan = this

    all_instalments_paid: instalments.all(i => i.status = paid)

    invariant NonNegativeCredit {
        credit_balance >= 0
    }

    -- A loan is closed only once every instalment is cleared.
    invariant ClosedImpliesAllPaid {
        status = closed implies instalments.all(i => i.status = paid)
    }
}

entity Instalment {
    loan: Loan

    -- Age ordering for oldest-first allocation is by due_date (oldest first);
    -- the tie-break for equal due_dates is sequence_number (lower first).
    due_date: Timestamp
    sequence_number: Integer

    status: outstanding | paid

    -- The four components ("buckets"), each an outstanding BHD balance (fils precision).
    -- Fees are fixed charges set at instalment creation (origination, administration, etc.);
    -- they do not accrue or change over the instalment's life and carry no rate.
    fees_outstanding: Decimal
    -- Penalties accrue per-diem up to and including the value_date; see AllocatePayment.
    penalties_outstanding: Decimal
    -- Interest is (re-)accrued to the value_date; apportioned here per principal share.
    interest_outstanding: Decimal
    principal_outstanding: Decimal

    total_outstanding: fees_outstanding + penalties_outstanding + interest_outstanding + principal_outstanding

    -- Base for per-diem penalty accrual: overdue principal and fees ONLY. Previously
    -- accrued-but-unpaid penalties and interest are excluded — penalties never compound
    -- onto penalties or onto accrued interest.
    penalty_base: principal_outstanding + fees_outstanding

    is_overdue: status = outstanding and due_date < now

    invariant NonNegativeBuckets {
        fees_outstanding >= 0 and penalties_outstanding >= 0
        and interest_outstanding >= 0 and principal_outstanding >= 0
    }

    -- A paid instalment has nothing left standing (any tolerated residual was written off).
    invariant PaidImpliesCleared {
        status = paid implies total_outstanding = 0
    }
}

entity Payment {
    loan: Loan
    -- BHD, fils precision. A negative amount is rejected; zero is accepted (accrual runs,
    -- a zero-value allocation is recorded, nothing is applied at the allocation layer).
    amount: Decimal
    -- Effective date of the payment. A future value_date (later than today) is rejected;
    -- there is no limit on how far back a back-valued value_date may be set.
    value_date: Timestamp
    -- Receipt timestamp. Same-day payments are applied FIFO by this timestamp, each
    -- allocated independently in turn; a later payment sees balances left by the earlier.
    received_at: Timestamp
}

-- The allocation transaction: this IS the function's return value.
entity Allocation {
    payment: Payment
    loan: Loan
    status: applied | reversed

    -- Pre-existing credit drawn down first, before the incoming payment funds.
    credit_consumed: Decimal
    -- Surplus beyond everything currently outstanding, held as new unallocated credit.
    credit_balance_created: Decimal
    -- Total residual written off across instalments closed under the tolerance rule.
    tolerance_written_off: Decimal

    lines: AllocationLine with allocation = this

    transitions status {
        applied -> reversed
        terminal: reversed
    }
}

-- One line per instalment touched: how much went to each bucket and what remains.
entity AllocationLine {
    allocation: Allocation
    instalment: Instalment

    -- Amount applied to each bucket this allocation (strict sequential fill order:
    -- fees, then penalties, then interest, then principal).
    fees_applied: Decimal
    penalties_applied: Decimal
    interest_applied: Decimal
    principal_applied: Decimal

    -- Resulting outstanding balance per bucket after this allocation.
    fees_outstanding_after: Decimal
    penalties_outstanding_after: Decimal
    interest_outstanding_after: Decimal
    principal_outstanding_after: Decimal
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

rule AllocatePayment {
    when: AllocatePayment(payment, loan)

    -- Rejected inputs (precondition failure => the caller receives an error):
    requires: loan.status = active                                           -- payment against a closed/settled loan is rejected
    requires: payment.amount >= 0                                            -- a negative payment is rejected
    requires: payment.value_date <= now                                     -- a future value_date is rejected
    requires: not would_reduce_allocated_interest(loan, payment.value_date)  -- back-value below already-allocated interest is rejected
    requires: not would_reduce_allocated_penalties(loan, payment.value_date) -- back-value below already-allocated penalties is rejected

    ensures:
        -- Step 1 — accrual to the value_date. Penalties accrue and interest re-accrues up
        -- to and including the value_date on the post-accrual balances. Runs for every
        -- accepted payment, INCLUDING a zero payment (no-op only at the allocation layer).
        ValueDateAccrued(loan: loan, value_date: payment.value_date)

        -- Step 2 — record the allocation transaction (the return value), with its summary
        -- figures. For a zero payment all three are zero and no funds/credit are applied.
        let allocation = Allocation.created(
            payment: payment,
            loan: loan,
            status: applied,
            credit_consumed: credit_drawn_down(loan, payment),
            credit_balance_created: resulting_credit(loan, payment),
            tolerance_written_off: tolerance_total(loan, payment)
        )

        -- Step 3 — per-instalment breakdown and updated balances. The waterfall fills
        -- pre-existing credit first then incoming funds, fees -> penalties -> interest ->
        -- principal, oldest instalment fully before the next. Each _after value is the
        -- resulting outstanding (post-accrual, post-allocation, post-write-off).
        for inst in loan.instalments:
            AllocationLine.created(
                allocation: allocation,
                instalment: inst,
                fees_applied: applied_fees(inst, loan, payment),
                penalties_applied: applied_penalties(inst, loan, payment),
                interest_applied: applied_interest(inst, loan, payment),
                principal_applied: applied_principal(inst, loan, payment),
                fees_outstanding_after: fees_after(inst, loan, payment),
                penalties_outstanding_after: penalties_after(inst, loan, payment),
                interest_outstanding_after: interest_after(inst, loan, payment),
                principal_outstanding_after: principal_after(inst, loan, payment)
            )
            inst.fees_outstanding = fees_after(inst, loan, payment)
            inst.penalties_outstanding = penalties_after(inst, loan, payment)
            inst.interest_outstanding = interest_after(inst, loan, payment)
            inst.principal_outstanding = principal_after(inst, loan, payment)
            if is_fully_paid_after(inst, payment):
                inst.status = paid

        -- Step 4 — the loan's unallocated credit becomes whatever remains after the run,
        -- and the interest accrual watermark advances to the value_date.
        loan.credit_balance = resulting_credit(loan, payment)
        loan.interest_accrued_to = payment.value_date

    @guidance
        -- WATERFALL ORDER
        --   Within one instalment, funds fill its buckets in order: fees, then penalties,
        --   then interest, then principal. Across instalments, the oldest instalment is
        --   cleared in full across all four buckets before any money touches the next.
        --   Instalment age is by due_date (oldest first); ties break on sequence_number
        --   (lower first).
        -- STRICT SEQUENTIAL FILL
        --   The available funds fill bucket by bucket in order until exhausted. A component
        --   may be partially paid and the remainder stays in that bucket. There is no
        --   proportional splitting and no special treatment of a remainder — filling simply
        --   stops where the funds run out.
        -- CREDIT FIRST, THEN FUNDS
        --   Any pre-existing credit_balance is drawn down first, through the same waterfall
        --   against the oldest outstanding instalment, before the incoming payment amount is
        --   applied to whatever remains. The two are not pooled: credit is consumed first,
        --   new funds second.
        -- SURPLUS
        --   Anything beyond everything currently outstanding (including on a payment that
        --   would clear the entire remaining loan ahead of schedule) is held as
        --   credit_balance_created. It is never auto-refunded. Auto-application to the next
        --   instalment on its due date is an EXTERNAL scheduled process, out of scope here;
        --   excess credit is not cascaded immediately into later instalments.
        --   A payment with nothing outstanding becomes a pure overpayment / credit balance.
        -- NO EARLY-SETTLEMENT SPECIAL CASE
        --   A payment large enough to settle the whole loan is ordinary allocation against
        --   currently-outstanding balances only. Future (not-yet-due) instalments are left
        --   untouched; there is no interest rebate for the unexpired period and no separately
        --   computed settlement/prepayment figure.
        -- INTEREST RE-ACCRUAL (actual/365, loan.annual_interest_rate)
        --   Interest accrues on the TOTAL outstanding principal across ALL instalments,
        --   including those not yet due (not only overdue amounts). The result is held in
        --   each instalment's interest bucket, apportioned in proportion to each instalment's
        --   share of outstanding principal. The cross-instalment apportionment residual is
        --   absorbed into the LAST instalment's interest bucket (highest sequence_number
        --   among those with outstanding principal). A back-valued value_date recomputes
        --   interest to that earlier date — a full recomputation that can reduce previously
        --   accrued interest downward; if it would fall below an amount already allocated to
        --   that bucket by a prior payment, the payment is rejected (see requires).
        -- PENALTY ACCRUAL (actual/365, loan.penalty_annual_rate)
        --   Per-diem on each late instalment's penalty_base (overdue principal + fees only;
        --   excludes accrued penalties and interest; no compounding), from the day after the
        --   due_date up to and including the value_date. Each overdue instalment accrues
        --   independently. Symmetric on back-valuation: a back-valued value_date shortens the
        --   window and can reduce penalties; if it would fall below an amount already
        --   allocated to that bucket by a prior payment, the payment is rejected.
        -- ACCRUAL ROUNDING
        --   Each instalment's daily per-diem charge is rounded half-up to the fils at the
        --   point it is computed, and the rounded figure is recorded in its bucket. The
        --   "rounding residual absorbed into interest" rule (below) applies ONLY to the
        --   rounding that arises when splitting a payment across buckets at allocation time.
        -- ALLOCATION ROUNDING
        --   Splits are rounded half-up to the fils; any rounding residual at allocation time
        --   is absorbed into the interest component.
        -- WRITE-OFF TOLERANCE
        --   Assessed per instalment against the total residual remaining across all four
        --   buckets after allocation. A residual of write_off_tolerance (0.005 BHD) or less
        --   is written off and the instalment marked fully paid, but only when that write-off
        --   is all that stands between the instalment and fully-paid status.
        -- ZERO PAYMENT
        --   Accrual still runs and a zero-value Allocation is recorded; no funds and no
        --   pre-existing credit are applied (no-op at the allocation layer only).
        -- CONCURRENCY
        --   Multiple payments posted the same day on the same loan are applied FIFO by
        --   received_at, each allocated independently; the later sees the earlier's result.
}

rule CloseLoan {
    -- When the last instalment clears, the loan moves to a closed/settled state. Any
    -- remaining credit_balance stays on the closed loan (never auto-refunded; nothing due
    -- for the external auto-apply to act against). A later payment on it is rejected
    -- (see AllocatePayment: requires loan.status = active).
    when: loan: Loan.all_instalments_paid
    requires: loan.status = active
    ensures: loan.status = closed
}

rule ReverseAllocation {
    -- Reversal is a full unwind of a previously applied allocation.
    when: ReverseAllocation(servicer, allocation)
    requires: allocation.status = applied

    let loan = allocation.loan

    ensures:
        allocation.status = reversed

        -- Reverse any credit this allocation created and restore any credit it consumed.
        loan.credit_balance = loan.credit_balance - allocation.credit_balance_created + allocation.credit_consumed

        -- Restore each touched instalment bucket by bucket (add back what was applied) and
        -- re-open instalments that this allocation had marked fully paid.
        for line in allocation.lines:
            line.instalment.status = outstanding
            line.instalment.fees_outstanding = line.instalment.fees_outstanding + line.fees_applied
            line.instalment.penalties_outstanding = line.instalment.penalties_outstanding + line.penalties_applied
            line.instalment.interest_outstanding = line.instalment.interest_outstanding + line.interest_applied
            line.instalment.principal_outstanding = line.instalment.principal_outstanding + line.principal_applied

        -- If this allocation had closed the loan, re-open it.
        if loan.status = closed:
            loan.status = active

    @guidance
        -- The allocation is reversed bucket by bucket; any credit_balance it created is
        -- reversed; any tolerance_written_off is reinstated as a live balance on the
        -- instalment it closed; and instalments marked fully paid are re-opened to their
        -- pre-payment outstanding balances. Reversal unwinds the application of money, not
        -- the value-date accrual.
}

------------------------------------------------------------
-- Invariants
------------------------------------------------------------

invariant CreditBalancesNonNegative {
    for loan in Loans:
        loan.credit_balance >= 0
}

invariant InstalmentBucketsNonNegative {
    for inst in Instalments:
        inst.fees_outstanding >= 0 and inst.penalties_outstanding >= 0
        and inst.interest_outstanding >= 0 and inst.principal_outstanding >= 0
}

invariant ClosedLoansFullyPaid {
    for loan in Loans:
        loan.status = closed implies loan.instalments.all(i => i.status = paid)
}

------------------------------------------------------------
-- Actor Declarations
------------------------------------------------------------

actor Servicer {
    identified_by: Operator where active
}

------------------------------------------------------------
-- Surfaces
------------------------------------------------------------

surface PaymentAllocationResult {
    facing servicer: Servicer
    context allocation: Allocation

    exposes:
        allocation.status
        allocation.credit_consumed
        allocation.credit_balance_created
        allocation.tolerance_written_off
        for line in allocation.lines:
            line.instalment.sequence_number
            line.fees_applied
            line.penalties_applied
            line.interest_applied
            line.principal_applied
            line.fees_outstanding_after
            line.penalties_outstanding_after
            line.interest_outstanding_after
            line.principal_outstanding_after

    provides:
        ReverseAllocation(servicer, allocation) when allocation.status = applied
}


## Auditor verdict

_The specification correctly resolves all 14 reference decisions, including the genuinely bespoke ones (fees-before-penalties order, BHD 3-dp precision, residual-to-interest, back-valued re-accrual, no-prepay early settlement, 0.005 write-off tolerance, credit-balance surplus handling). Every material policy choice is stated explicitly and literally matches the reference values. Coverage = 14/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "The fees -> penalties -> interest -> principal waterfall" (scope); @guidance WATERFALL ORDER: "funds fill its buckets in order: fees, then penalties, then interest, then principal" | Spec states the exact order with fees before penalties, matching the reference's deliberately non-default sequence. |
| 2 | yes | **yes** | @guidance: "the oldest instalment is cleared in full across all four buckets before any money touches the next"; age by due_date, tie-break sequence_number | Matches oldest-instalment-fully-first strategy exactly, including all four buckets before moving on. |
| 3 | yes | **yes** | @guidance SURPLUS: "held as credit_balance_created. It is never auto-refunded. Auto-application to the next instalment on its due date is an EXTERNAL scheduled process" | Surplus held as unallocated credit, never auto-refunded, auto-applied to next instalment by an external process on due date — matches the reference mechanism. |
| 4 | yes | **yes** | config: currency "BHD", minor_unit_decimals 3; scope: "the minor unit is the fils (three decimal places)" | Correctly identifies BHD as a 3-decimal-place currency, not the default 2 dp. |
| 5 | yes | **yes** | "Rounding is half-up to three decimal places" (scope); @guidance ALLOCATION ROUNDING: "Splits are rounded half-up to the fils" | States half-up rounding to the minor unit, matching the reference. |
| 6 | yes | **yes** | @guidance ALLOCATION ROUNDING: "any rounding residual at allocation time is absorbed into the interest component" | The allocation-time rounding residual is absorbed into interest, exactly as the reference specifies (and the spec carefully scopes this to allocation splitting). |
| 7 | yes | **yes** | entity Loan interest_accrued_to comment: "A back-valued payment whose value_date is earlier than this re-accrues (recomputes) interest to the earlier date"; @guidance INTEREST RE-ACCRUAL: "A back-valued value_date recomputes interest to that earlier date" | Interest is recomputed to an earlier value_date before allocation, matching the reference. |
| 8 | yes | **yes** | @guidance NO EARLY-SETTLEMENT SPECIAL CASE: "Future (not-yet-due) instalments are left untouched; there is no interest rebate..."; SURPLUS: surplus becomes credit_balance | An early payment settles outstanding only, surplus becomes credit, no principal prepayment, future interest unchanged — matches reference. |
| 9 | yes | **yes** | @guidance STRICT SEQUENTIAL FILL: "There is no proportional splitting and no special treatment of a remainder — filling simply stops where the funds run out" | Strict in-order bucket fill with no proportional split, matching the reference. |
| 10 | yes | **yes** | config write_off_tolerance 0.005; @guidance WRITE-OFF TOLERANCE: "A residual of write_off_tolerance (0.005 BHD) or less is written off and the instalment marked fully paid" | Tolerance of ≤ 0.005 BHD written off to close the instalment, matching the reference value and behaviour. |
| 11 | yes | **yes** | entity Payment: "A negative amount is rejected; zero is accepted (accrual runs, a zero-value allocation is recorded, nothing is applied...)"; requires payment.amount >= 0 | Negative rejected with error, zero is a no-op that still records a zero-value allocation transaction — matches reference exactly. |
| 12 | yes | **yes** | ensures Step 1: "Penalties accrue and interest re-accrues up to and including the value_date on the post-accrual balances"; @guidance PENALTY ACCRUAL: "up to and including the value_date" | Penalties accrue up to and including value_date, then allocation runs on post-accrual balances, matching the reference ordering. |
| 13 | yes | **yes** | entity Payment received_at comment and @guidance CONCURRENCY: "Multiple payments posted the same day... are applied FIFO by received_at, each allocated independently" | Same-day payments applied FIFO by receipt timestamp, each allocated independently in turn — matches reference. |
| 14 | yes | **yes** | entity Allocation with credit_consumed, credit_balance_created, tolerance_written_off, and AllocationLine per instalment with fees/penalties/interest/principal _applied and _outstanding_after | Return shape gives per-instalment per-bucket applied amounts, resulting outstanding balances, credit created, and tolerance written off — all four reference elements present. |

## Allium checker (spec-side, not scored)

check reported issues:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.externalEntity.missingSourceHint",
      "location": {
        "col": 17,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-wDhcFz/spec.allium",
        "line": 29
      },
      "message": "External entity 'Operator' has no obvious governing specification import in this module.",
      "severity": "warning"
    },
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
```
