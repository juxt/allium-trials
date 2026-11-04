# allium-elicit — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 28 · Captured: 14/14 · Bespoke captured: 8/8

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material allocation policy, so I must elicit the core method (component and instalment ordering), units/rounding, surplus/shortfall handling, edge inputs, timing, whole-life events, and the exact result shape before writing any spec.

Q: Scope and result shape first: `allocate_payment(payment, loan)` should return how the payment was applied and the loan's updated balances. Can you tell me exactly what fields that result must contain, field by field, both the per-component/per-instalment breakdown of how the payment was applied and the full set of updated balances you expect back?
A: Return a single object containing: (1) an `allocations` array — one entry per instalment touched, each with the instalment identifier, and the amount applied to each of the four buckets (`fees_applied`, `penalties_applied`, `interest_applied`, `principal_applied`); (2) an `outstanding_balances` object — per-instalment, per-bucket remaining balances after allocation; (3) a `credit_balance` field — the unallocated surplus held on the loan (zero if none created); (4) a `tolerance_written_off` field — any residual forgiven under the write-off tolerance rule (zero if none). No additional top-level fields are required by policy.

Q: Within a single instalment, in what order are the four components paid down, penalties, fees, interest and principal? Is it always that fixed order, or configurable?
A: Fixed order, not configurable: fees first, then penalties, then interest, then principal. Fees come before penalties.

Q: Across multiple outstanding instalments, in what order are they satisfied, oldest due date first, or some other priority? And what breaks a tie when two instalments rank equally (e.g. same due date)?
A: Oldest due date first. Clear all four buckets of the oldest instalment in full before any money touches the next. Tie-breaking on same due date is not defined by policy — use a stable secondary sort on instalment ID or sequence number as a tiebreaker [default, not policy].

Q: What currency unit and precision do amounts use (e.g. whole cents/pennies), and when an allocation produces a fractional sub-unit, which way does it round and where does any remainder land?
A: The loan is denominated in BHD. All amounts use 3 decimal places (fils). Rounding is round-half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

Q: What happens to a surplus when the payment exceeds everything currently owed, is it held on the loan as a credit, returned, or carried to future instalments not yet due? And on a shortfall (partial payment), do you allocate as far as the money goes and leave the rest outstanding?
A: Surplus (payment exceeds total owed): held on the loan as an unallocated credit balance, automatically applied to the next instalment when it falls due. It is never auto-refunded, and it does not prepay principal or change future interest. Shortfall (partial payment): allocate strictly in bucket order as far as the money reaches; leave the rest outstanding. No proportional splitting.

Q: How should the function treat edge inputs for the payment amount, specifically zero, negative, and a payment larger than the total owed, is each rejected, ignored, or processed, and is a record still kept?
A: Negative payment amount: rejected with an error, no allocation recorded. Zero payment: treated as a no-op but a zero-value allocation transaction is still recorded. Payment larger than total owed: processed normally; the surplus becomes a credit balance as described above.

Q: Does the payment carry an effective date that matters here (e.g. recomputing interest accrued up to the payment date, or back-dating), or is allocation purely against the balances as they stand at call time?
A: The payment carries an effective value_date. If value_date is earlier than today (back-valued), interest is recomputed (re-accrued) to that value_date before allocation runs. Penalties also accrue up to and including value_date, and allocation runs on those post-accrual balances. Allocation is not purely against balances as they stand at call time.

Q: Does this function need to handle anything beyond a normal forward payment over the loan's life, for example reversals or corrections of a prior payment, and if so should that be in scope for `allocate_payment` or handled elsewhere?
A: Reversals and corrections of prior payments are out of scope for `allocate_payment`. That function handles only forward allocation. Reversals should be handled by a separate operation [default, not policy].

### Round 2
_Step reasoning:_ Core flow is settled, but the write-off tolerance rule is an output field that was never defined, and the accrual method, no-interest residual fallback, pre-existing credit handling and future-dated value_date remain unasked assumptions.

Q: The result shape includes a `tolerance_written_off` field for residual forgiven under a write-off tolerance rule, but we haven't defined that rule. What is the exact tolerance: what threshold triggers a write-off (e.g. an absolute amount in fils, or a fraction), is it applied per instalment, per bucket, or to the whole-loan residual, and at what point in allocation is the check made? What is the sign of the residual it forgives (a tiny remaining balance the payment couldn't quite clear, a tiny leftover payment too small to matter, or both)?
A: The threshold is an absolute amount: residual owed after allocation ≤ 0.005 BHD triggers a write-off. It is applied per instalment — checked after all four buckets of that instalment have been allocated, not per-bucket and not as a whole-loan residual. The residual it forgives is a tiny remaining balance the payment could not quite clear (i.e. the instalment is nearly fully paid but a sub-fils rounding gap remains). A tiny leftover payment too small to matter is not covered by this rule; that surplus would become a credit balance per the overpayment rule.

Q: When re-accruing interest and penalties to a back-valued `value_date`, what exact method is used: for interest, the day-count convention (e.g. actual/365, actual/360, 30/360) and the rate source; for penalties, the accrual basis (per-day flat amount, percentage of overdue balance, etc.)? Or does the loan carry these already-computed and allocate_payment only reads them?
A: The loan carries pre-computed accrued balances; allocate_payment reads those balances rather than deriving them from a rate and day-count convention itself. Re-accrual to value_date is the responsibility of the accrual layer that must be called before allocate_payment runs — the day-count convention, rate source, and penalty accrual basis are inputs to that layer, not to this function. [default, not policy]

Q: The rounding residual is absorbed into the interest component. What happens when the instalment being paid has no interest bucket, or interest is already zero, at the point the residual needs to land? Does it fall to the next component, get written off, or something else?
A: If the interest bucket is already zero for the instalment at the point the rounding residual needs to land, the residual falls to the principal bucket instead. If principal is also zero (fully paid), the residual is absorbed via the write-off tolerance mechanism if within the 0.005 BHD threshold; otherwise it remains outstanding. [default, not policy]

Q: Does allocate_payment consume any credit balance already held on the loan at call time (adding it to the incoming payment before allocation), or does the function only ever create/increase a credit balance and never spend an existing one, that being a separate operation?
A: allocate_payment consumes any existing credit balance held on the loan at call time by adding it to the incoming payment amount before allocation begins. The function both spends existing credit and creates new credit; it is not split into separate operations. [default, not policy]

Q: How is a future-dated `value_date` (later than today) treated, rejected, clamped to today, or processed with accrual only up to today?
A: A future-dated value_date (later than today) is rejected with an error. The function does not clamp to today or accrue forward. [default, not policy]

### Round 3
_Step reasoning:_ Nearly complete, but a genuine contradiction between the zero-payment no-op and call-time credit consumption remains unresolved, and whole-life closure/payoff signalling is still an unasked class.

Q: Two of your answers appear to interact: a zero payment is a recorded no-op, yet allocate_payment consumes any existing credit balance by adding it to the incoming payment before allocation begins. When the incoming payment is zero but the loan already holds a positive credit balance, which rule wins, is it a strict no-op that leaves the credit untouched and records a zero-value transaction, or does the existing credit get applied to the outstanding instalments and produce real allocations?
A: The existing credit balance wins. A zero payment amount means no new money is being tendered, but the credit-consumption step runs first: the existing credit is added to the incoming amount (0 + credit_balance), producing a positive working total. Allocation then proceeds normally against outstanding instalments. The zero-value allocation transaction is not recorded in this case, because real allocations occur. The no-op rule applies only when both the payment amount and any existing credit balance are zero, leaving nothing to allocate. [default, not policy]

Q: Over the loan's whole life, when a payment (possibly combined with consumed credit) clears every outstanding instalment so nothing is owed, does allocate_payment signal loan-level closure or payoff in any way (a status, a flag, an event), or is loan settlement state entirely outside this function, with the result carrying only the four fields already specified?
A: Loan settlement state is entirely outside allocate_payment. The function returns only the four fields already specified: allocations, outstanding_balances, credit_balance, and tolerance_written_off. If those balances are all zero and credit_balance is zero, a separate process or caller is responsible for interpreting that state as loan closure and acting on it. No status flag, payoff marker, or event is emitted by this function. [default, not policy]

### Round 4
_Step reasoning:_ Logic and edge cases are thoroughly covered, but three output-shape details the process insists on pinning down hard remain genuinely ambiguous: the scope of outstanding_balances, how a tolerance write-off is represented and reconciled, and the exact meaning of the returned credit_balance.

Q: The `outstanding_balances` object gives per-instalment, per-bucket remaining balances after allocation. Does it cover every instalment on the loan (those touched, those due but left untouched by a shortfall, and those not yet due), or only the instalments this call actually touched? And are not-yet-due instalments represented at all here, given the surplus is only applied to them when they later fall due?
A: outstanding_balances covers only the instalments this call actually touched. Untouched instalments — whether overdue but unreached due to a shortfall, or not yet due — are not represented in the returned outstanding_balances. Not-yet-due instalments are excluded because their balances are unchanged and any future credit application happens when they fall due, not at this call. [default, not policy]

Q: When a per-instalment residual is forgiven under the 0.005 BHD tolerance, how is it represented across the result? Does the forgiven amount appear anywhere in the `allocations` buckets, or solely in `tolerance_written_off`, and is that instalment's entry in `outstanding_balances` then reported as zero? In other words, for a touched instalment should `allocations` + `tolerance_written_off` + remaining `outstanding_balances` reconcile exactly to what was owed?
A: The forgiven residual appears solely in tolerance_written_off, not in any allocations bucket. The instalment is marked fully paid, so its entry in outstanding_balances is reported as zero. The reconciliation identity holds per touched instalment: amount_owed_before_call = sum(allocations buckets) + tolerance_written_off + outstanding_balance_after. [default, not policy]

Q: The `credit_balance` field is the unallocated surplus held on the loan after this call. Since any pre-existing credit is consumed into the working total before allocation, is the returned `credit_balance` the loan's new total credit (i.e. just the newly created surplus), rather than a delta or the pre-call figure?
A: credit_balance is the loan's new total credit balance after this call — not a delta and not the pre-call figure. Because the pre-existing credit was consumed into the working total before allocation, any pre-call credit is already spent; what is returned is solely the newly created surplus (if any) left after allocation exhausted all reachable outstanding instalments. [default, not policy]

### Round 5
_Step reasoning:_ All computation, rounding, ordering, thresholds, surplus/shortfall, edge inputs, output shape and scope boundaries are pinned; the one remaining material, non-inferable policy is which instalments are eligible for allocation and the reference date used to judge 'due' under back-valuation.

Q: Which instalments are eligible for allocation in a single call: only those already due (due date reached), or every instalment carrying an outstanding balance including ones not yet due? Given surplus is held as credit rather than prepaying, I read it as due-only, but I want to confirm the boundary explicitly.
A: Only instalments with a due date on or before the effective date of the payment are eligible for allocation in a single call. Not-yet-due instalments are excluded — surplus is held as a credit balance and applied when each instalment falls due, which is consistent with the overpayment and early-payment rules already defined. [default, not policy]

Q: When the payment is back-valued, is an instalment's 'due' status judged as of the value_date or as of today? Concretely, an instalment that fell due between value_date and today: is it in scope for this back-valued payment or excluded?
A: Due status is judged as of value_date, not today. The back-valued payment is treated as if it occurred at value_date, so an instalment that fell due between value_date and today is not yet due from the perspective of this call and is excluded from allocation. It would be reachable by a subsequent payment or credit-application on or after its actual due date. [default, not policy]

### Round 6
_Step reasoning:_ Real policy was captured in rounds 1-2; rounds 3-5 returned mostly defaults, signalling diminishing returns, but two material classes remain genuinely unasked — the no-eligible-instalment degenerate boundary and where recorded transactions/persistence live — so I close those before concluding.

Q: Degenerate case: when the working total is positive (from the incoming payment and/or consumed credit) but no instalment is eligible because none is due as of value_date, what does the function return — the entire working amount as credit_balance with an empty allocations array and empty outstanding_balances, and is any allocation transaction recorded in that case?
A: When the working total is positive but no instalment is eligible as of value_date, the entire working amount is returned as credit_balance, with an empty allocations array and empty outstanding_balances. Whether a transaction is recorded in this case is not defined by policy — a reasonable default is that a transaction is still recorded as an audit entry (showing the incoming amount and the resulting credit_balance) even though no allocation buckets were touched, but this is [default, not policy].

Q: You noted a true no-op records a zero-value allocation transaction, yet the result carries only the four specified fields (none a transaction record). Where does that recorded transaction live — is it a side effect persisted on the loan outside the returned object — and does allocate_payment itself mutate/persist the loan's stored per-bucket balances and credit_balance, or does it only compute and return them for the caller to persist?
A: The recorded transaction is a side effect that lives outside the returned object — it is not one of the four specified return fields. Whether allocate_payment itself persists anything (loan balances, credit_balance, transaction records) or is a pure compute function that returns values for the caller to persist is not defined by policy. A reasonable default is that allocate_payment is a pure computation: it returns the four fields and the caller is responsible for persisting all mutations — updated per-bucket balances, the new credit_balance, and any transaction records including the zero-value one — but this is [default, not policy].

### Round 7
_Step reasoning:_ Core method, units, rounding, ordering, thresholds, timing, surplus/shortfall, scope, and output shape are all pinned; the remaining unasked completeness classes are concurrency/sequencing, degenerate loan-structure edge inputs, and status-based eligibility, each a plausible institution-specific policy.

Q: Concurrency and sequencing: if two payments carry the same value_date on the same loan (or arrive in quick succession), does allocate_payment assume it is invoked once against a single consistent snapshot with ordering handled by the caller, or must it define an order in which same-value_date payments apply, and can that order change the outcome?
A: Same-value_date payments are applied FIFO by receipt timestamp, each allocated independently in turn. allocate_payment assumes it is invoked against a single consistent snapshot — ordering by receipt timestamp is the defined rule, not something delegated entirely to the caller. Order can change the outcome: the first payment may clear an instalment that the second then finds already settled, altering how far down the instalment queue the second payment reaches.

Q: Edge inputs on loan structure (as opposed to the payment amount, which we've covered): what should the function do when the loan has no instalments at all, when a due instalment is missing one of the four bucket balances, or when instalment records carry duplicate identifiers, is each rejected, treated as zero, or otherwise handled?
A: All three are not defined by policy. Reasonable defaults: a loan with no instalments returns an empty allocations array, empty outstanding_balances, and the full working total as credit_balance [default, not policy]. A missing bucket balance on a due instalment is treated as zero for that bucket [default, not policy]. Duplicate instalment identifiers are rejected with an error before allocation begins [default, not policy].

Q: Eligibility beyond the due-date test: can an instalment that is due as of value_date and carries a positive balance still be excluded from allocation because of its own status, for example already settled, written off, in dispute, frozen, or in a grace period, or are all due instalments with a positive balance unconditionally eligible?
A: Instalment status beyond the due-date test is not defined by policy. A reasonable default is that instalments already marked settled or written off are excluded (their balances are zero and they should not appear as targets), while instalments in dispute or frozen status are also excluded from allocation until the hold is lifted. A grace-period instalment would remain eligible — grace affects penalty accrual timing, not allocation eligibility — but all of these are [default, not policy].

### Round 8
_Step reasoning:_ One final round remains; closing genuine unasked policy gaps on back-valuation limits, write-off aggregate caps/authorisation, and re-accrual-induced underpayment rather than declaring done prematurely.

Q: Is there a limit on how far a payment's `value_date` may be back-dated, and is there any accounting-period cut-off after which back-valuation into a closed period is rejected rather than re-accrued?
A: No limit on back-dating and no accounting-period cut-off are defined by policy. A reasonable default is that allocate_payment itself imposes no maximum look-back, and that rejection of back-valuation into a closed or locked accounting period is enforced by the calling system or accrual layer before allocate_payment is invoked — not by this function. [default, not policy]

Q: Does the 0.005 BHD write-off tolerance apply per touched instalment with no aggregate ceiling, or is there a cap on total residual auto-forgiven per payment or per loan (and does crossing any such cap require authorisation rather than silent write-off)?
A: The 0.005 BHD tolerance applies per touched instalment with no aggregate ceiling. There is no cap on total residual auto-forgiven per payment or per loan, and no authorisation step is required. The silent write-off at the instalment level is the complete rule as defined.

Q: When back-valuation re-accrues interest and penalties, can the recomputed balances exceed what a caller believed was owed such that the tendered payment now underpays; if so is that simply allocated as far as it reaches (shortfall rule), or must the function flag that re-accrual increased the debt?
A: Yes, re-accrued balances can exceed what the caller expected, leaving the tendered payment short. In that case the shortfall rule applies without modification: allocate strictly in bucket order as far as the money reaches and leave the rest outstanding. The function does not flag or specially surface that re-accrual was the cause of the shortfall. [default, not policy]

## Produced specification

-- allium: 3

-- =====================================================================
-- Loan payment allocation
--
-- Behaviour of allocate_payment(payment, loan): how an incoming payment
-- (optionally combined with credit already held on the loan) is applied
-- across a loan's outstanding instalments, and the balances returned.
--
-- Money unit: the loan is denominated in BHD to 3 decimal places (fils).
-- All amounts in this spec are held as whole fils (Integer minor units;
-- 1 BHD = 1000 fils), so "round-half-up to 3 dp" is rounding to a whole
-- fils. This spec captures the domain decisions settled with the
-- stakeholder. Items marked "(default, not policy)" were not settled by
-- stakeholder policy and are resolved here as reasonable defaults.
-- =====================================================================

config {
    settlement_currency: String = "BHD"
    amount_precision_dp: Integer = 3          -- fils, 3 decimal places
    rounding_mode: String = "half_up"          -- round-half-up to 3 dp (to whole fils)
    write_off_tolerance: Integer = 5           -- 0.005 BHD = 5 fils, per touched instalment
}

-- ---------------------------------------------------------------------
-- Domain entities
-- ---------------------------------------------------------------------

-- The loan carries pre-computed accrued balances and any unallocated
-- credit. Re-accrual to a back-valued value_date is the responsibility of
-- the accrual layer, invoked before allocate_payment (default, not policy).
entity Loan {
    currency: String                             -- "BHD"
    credit_balance: Integer                       -- unallocated credit held on the loan, in fils
    instalments: Instalment with loan = this
    outstanding_instalments: instalments where status = outstanding
    has_credit: credit_balance > 0
}

-- Each instalment holds four separately-tracked outstanding buckets.
-- is_due is supplied by the caller/accrual layer and reflects due status
-- as of the payment's value_date (not today) for a back-valued payment.
entity Instalment {
    loan: Loan
    identifier: String
    sequence: Integer
    due_date: Timestamp
    fees_outstanding: Integer
    penalties_outstanding: Integer
    interest_outstanding: Integer
    principal_outstanding: Integer
    in_grace_period: Boolean                      -- affects penalty accrual timing only, not eligibility
    is_due: Boolean                               -- due as of the effective value_date
    status: outstanding | settled | written_off | in_dispute | frozen

    -- Derived
    total_outstanding: fees_outstanding + penalties_outstanding + interest_outstanding + principal_outstanding
    is_settled_in_full: total_outstanding <= 0
    eligible_for_allocation: is_due and status = outstanding
    within_writeoff_tolerance: total_outstanding <= config.write_off_tolerance
    penalty_accrual_suspended: in_grace_period

    transitions status {
        outstanding -> settled
        outstanding -> written_off
        outstanding -> in_dispute
        outstanding -> frozen
        in_dispute -> outstanding
        frozen -> outstanding
        terminal: settled, written_off
    }
}

-- An incoming forward payment. Reversals and corrections of prior
-- payments are out of scope for allocate_payment; they are a separate
-- operation (default, not policy).
entity Payment {
    loan: Loan
    amount: Integer                               -- fils; may be negative (rejected) or zero
    value_date: Timestamp                          -- effective date; may be back-valued
    received_at: Timestamp                         -- receipt timestamp, orders same-value_date payments

    -- Derived
    is_rejected: amount < 0 or value_date > now    -- negative amount, or future-dated value_date
}

-- ---------------------------------------------------------------------
-- Result value types
-- ---------------------------------------------------------------------

-- One entry per instalment actually touched by the call: the amount
-- applied to each of the four buckets, in fils.
value InstalmentAllocation {
    instalment: Instalment
    fees_applied: Integer
    penalties_applied: Integer
    interest_applied: Integer
    principal_applied: Integer
}

-- Per-instalment, per-bucket balances remaining after allocation, for the
-- touched instalments only, in fils.
value InstalmentBalance {
    instalment: Instalment
    fees_outstanding: Integer
    penalties_outstanding: Integer
    interest_outstanding: Integer
    principal_outstanding: Integer
}

-- The single object returned by allocate_payment. No additional top-level
-- fields are required by policy.
value AllocationResult {
    allocations: List<InstalmentAllocation>
    outstanding_balances: List<InstalmentBalance>
    credit_balance: Integer                        -- loan's new total credit after this call, in fils
    tolerance_written_off: Integer                  -- residual forgiven under the write-off tolerance, in fils
}

-- ---------------------------------------------------------------------
-- Operation contract
-- ---------------------------------------------------------------------

contract PaymentAllocation {
    allocate_payment: (payment: Payment, loan: Loan) -> AllocationResult

    @invariant ResultShape
        -- Returns a single AllocationResult with exactly four fields:
        -- allocations, outstanding_balances, credit_balance and
        -- tolerance_written_off. No additional top-level fields.
        -- credit_balance is zero if no surplus is created;
        -- tolerance_written_off is zero if nothing is forgiven.

    @invariant WithinInstalmentBucketOrder
        -- Within a single instalment the four components are paid down in a
        -- fixed, non-configurable order: fees first, then penalties, then
        -- interest, then principal. Fees come before penalties.

    @invariant AcrossInstalmentOrder
        -- Across multiple eligible instalments, oldest due date first. All
        -- four buckets of the oldest instalment are cleared in full before
        -- any money touches the next instalment. Ties on the same due date
        -- are broken by a stable secondary sort on sequence, then
        -- identifier (default, not policy).

    @invariant AmountPrecisionAndRounding
        -- The loan is denominated in BHD; all amounts use 3 decimal places
        -- (fils). Rounding is round-half-up to 3 dp. Any rounding residual
        -- is absorbed into the interest component, not principal.

    @invariant RoundingResidualLanding
        -- If the interest bucket is already zero when the rounding residual
        -- must land, it falls to the principal bucket instead. If principal
        -- is also zero (instalment fully paid), the residual is absorbed via
        -- the write-off tolerance mechanism when within the 0.005 BHD
        -- threshold; otherwise it remains outstanding (default, not policy).

    @invariant ShortfallAllocation
        -- On a partial payment, allocate strictly in bucket order as far as
        -- the money reaches and leave the rest outstanding. No proportional
        -- splitting across buckets or instalments.

    @invariant SurplusBecomesCredit
        -- When the working total exceeds everything currently owed, the
        -- surplus is held on the loan as an unallocated credit balance. It
        -- is automatically applied to the next instalment when that
        -- instalment falls due. It is never auto-refunded, and it neither
        -- prepays principal nor changes future interest.

    @invariant CreditConsumedFirst
        -- allocate_payment consumes any credit balance already held on the
        -- loan at call time by adding it to the incoming payment amount
        -- before allocation begins. The function both spends existing
        -- credit and creates new credit; it is not split into separate
        -- operations (default, not policy).

    @invariant CreditBalanceReturned
        -- The returned credit_balance is the loan's new total credit after
        -- this call, not a delta and not the pre-call figure. Pre-existing
        -- credit was already consumed into the working total, so what is
        -- returned is solely the newly created surplus, if any, remaining
        -- after allocation exhausted all reachable instalments (default,
        -- not policy).

    @invariant Eligibility
        -- Only instalments with a due date on or before the effective
        -- value_date are eligible for allocation in a single call.
        -- Not-yet-due instalments are excluded; surplus is held as credit
        -- and applied when each instalment later falls due (default, not
        -- policy).

    @invariant EligibilityAsOfValueDate
        -- Due status is judged as of value_date, not today. A back-valued
        -- payment is treated as if it occurred at value_date, so an
        -- instalment that fell due between value_date and today is not yet
        -- due from this call's perspective and is excluded. It becomes
        -- reachable by a later payment or credit application on or after its
        -- actual due date (default, not policy).

    @invariant InstalmentStatusEligibility
        -- Beyond the due-date test: instalments marked settled or
        -- written_off are excluded (their balances are zero and they are not
        -- allocation targets). Instalments in_dispute or frozen are excluded
        -- until the hold is lifted. A grace-period instalment remains
        -- eligible; grace affects penalty accrual timing, not allocation
        -- eligibility (default, not policy).

    @invariant ValueDateReAccrual
        -- The payment carries an effective value_date. When value_date is
        -- earlier than today (back-valued), interest is re-accrued to
        -- value_date and penalties accrue up to and including value_date
        -- before allocation runs. Allocation runs on those post-accrual
        -- balances, not on balances as they stand at call time.

    @invariant AccrualLayerBoundary
        -- The loan carries pre-computed accrued balances; allocate_payment
        -- reads them rather than deriving them from a rate and day-count
        -- convention. Day-count convention, rate source and penalty accrual
        -- basis are inputs to the accrual layer, which must be invoked to
        -- re-accrue to value_date before allocate_payment runs (default,
        -- not policy).

    @invariant ReAccrualMayUnderpay
        -- Re-accrued balances can exceed what the caller expected, leaving
        -- the tendered payment short. The shortfall rule then applies
        -- unmodified: allocate in bucket order as far as the money reaches
        -- and leave the rest outstanding. The function does not flag that
        -- re-accrual was the cause of the shortfall (default, not policy).

    @invariant FutureValueDateRejected
        -- A value_date later than today is rejected with an error. The
        -- function does not clamp to today and does not accrue forward
        -- (default, not policy).

    @invariant BackDatingUnbounded
        -- allocate_payment imposes no maximum look-back on back-dating and
        -- no accounting-period cut-off. Rejection of back-valuation into a
        -- closed or locked accounting period is enforced by the calling
        -- system or accrual layer before this function is invoked (default,
        -- not policy).

    @invariant NegativePaymentRejected
        -- A negative payment amount is rejected with an error and no
        -- allocation is recorded.

    @invariant ZeroPaymentBehaviour
        -- When both the incoming amount and any existing credit balance are
        -- zero, the call is a no-op and a zero-value allocation transaction
        -- is still recorded. When the incoming amount is zero but the loan
        -- holds a positive credit balance, the credit-consumption step runs
        -- first (0 + credit_balance), producing a positive working total;
        -- allocation then proceeds normally and no zero-value transaction is
        -- recorded because real allocations occur (default, not policy).

    @invariant OverpaymentProcessed
        -- A payment larger than the total owed is processed normally; the
        -- surplus becomes a credit balance as in SurplusBecomesCredit.

    @invariant NoEligibleInstalments
        -- When the working total is positive but no instalment is eligible
        -- as of value_date, the entire working amount is returned as
        -- credit_balance, with an empty allocations array and empty
        -- outstanding_balances. A transaction is still recorded as an audit
        -- entry showing the incoming amount and resulting credit_balance,
        -- even though no allocation buckets were touched (default, not policy).

    @invariant WriteOffTolerance
        -- After all four buckets of a touched instalment have been
        -- allocated, if the residual owed on that instalment is <= 0.005 BHD
        -- (5 fils) it is written off. The check is per instalment, not per
        -- bucket and not on a whole-loan residual. It forgives only a tiny
        -- remaining balance the payment could not quite clear (a sub-fils
        -- rounding gap); a tiny leftover payment too small to matter is not
        -- covered and instead becomes a credit balance. The tolerance
        -- applies per touched instalment with no aggregate ceiling: no cap
        -- per payment or per loan, and no authorisation step. Silent
        -- write-off at the instalment level is the complete rule.

    @invariant WriteOffRepresentation
        -- A forgiven residual appears solely in tolerance_written_off, never
        -- in any allocations bucket. The instalment is marked fully paid, so
        -- its outstanding_balances entry is reported as zero (default, not
        -- policy).

    @invariant PerInstalmentReconciliation
        -- For each touched instalment the identity holds:
        --   amount_owed_before_call
        --     = fees_applied + penalties_applied + interest_applied
        --       + principal_applied
        --     + tolerance_written_off_for_this_instalment
        --     + outstanding_balance_after
        -- (default, not policy).

    @invariant OutstandingBalancesCoverage
        -- outstanding_balances covers only the instalments this call
        -- actually touched. Untouched instalments, whether overdue but
        -- unreached due to a shortfall or not yet due, are not represented.
        -- Not-yet-due instalments are excluded because their balances are
        -- unchanged (default, not policy).

    @invariant PureComputation
        -- allocate_payment is a pure computation: it returns the four
        -- fields and the caller is responsible for persisting all mutations,
        -- including updated per-bucket balances, the new credit_balance and
        -- any transaction records (including the zero-value one). Any
        -- recorded transaction is a side effect that lives outside the
        -- returned object (default, not policy).

    @invariant LoanSettlementOutOfScope
        -- Loan-level closure or payoff is entirely outside allocate_payment.
        -- No status flag, payoff marker or event is emitted. If all touched
        -- balances and credit_balance are zero, a separate process or caller
        -- interprets that state as loan closure (default, not policy).

    @invariant SameValueDateOrdering
        -- Payments sharing a value_date on the same loan are applied FIFO by
        -- receipt timestamp, each allocated independently in turn.
        -- allocate_payment assumes it is invoked against a single consistent
        -- snapshot. Order can change the outcome: an earlier payment may
        -- clear an instalment the next then finds already settled, altering
        -- how far down the queue the next payment reaches.

    @invariant LoanStructureEdges
        -- A loan with no instalments returns an empty allocations array,
        -- empty outstanding_balances and the full working total as
        -- credit_balance. A missing bucket balance on a due instalment is
        -- treated as zero for that bucket. Duplicate instalment identifiers
        -- are rejected with an error before allocation begins (default, not
        -- policy).

    @invariant ReversalsOutOfScope
        -- allocate_payment handles only forward allocation. Reversals and
        -- corrections of prior payments are handled by a separate operation
        -- (default, not policy).
}

-- ---------------------------------------------------------------------
-- Boundary surface
-- ---------------------------------------------------------------------

-- The operation is a code-to-code boundary: a caller invokes
-- allocate_payment against a loan snapshot and persists the result.
surface PaymentAllocationBoundary {
    facing loan: Loan

    context loan: Loan

    exposes:
        loan.credit_balance
        loan.has_credit

    contracts:
        fulfils PaymentAllocation

    @guarantee SnapshotConsistency
        -- The caller invokes allocate_payment against a single consistent
        -- loan snapshot and is responsible for ordering same-value_date
        -- payments FIFO by receipt timestamp and for persisting all
        -- resulting mutations.
}

-- ---------------------------------------------------------------------
-- Reactive behaviour: held credit applied when an instalment falls due
-- ---------------------------------------------------------------------

-- Surplus held as credit is not applied to not-yet-due instalments at
-- allocation time. When an instalment later becomes due, any held credit
-- is applied to it. This is a separate operation from allocate_payment.
rule HeldCreditAppliedWhenInstalmentBecomesDue {
    when: instalment: Instalment.is_due becomes true
    requires: instalment.status = outstanding and instalment.loan.credit_balance > 0
    ensures: HeldCreditApplied(instalment.loan, instalment)
    @guidance
        -- The held credit is applied following the same bucket order and
        -- rules as allocate_payment (fees, penalties, interest, principal).
        -- allocate_payment itself never prepays a not-yet-due instalment.
}

-- ---------------------------------------------------------------------
-- Invariants over stored state
-- ---------------------------------------------------------------------

invariant NonNegativeInstalmentBalances {
    for i in Instalments:
        i.fees_outstanding >= 0 and i.penalties_outstanding >= 0 and i.interest_outstanding >= 0 and i.principal_outstanding >= 0
}

invariant NonNegativeCreditBalance {
    for l in Loans:
        l.credit_balance >= 0
}

invariant LoanCurrencyIsSettlementCurrency {
    for l in Loans:
        l.currency = config.settlement_currency
}

-- ---------------------------------------------------------------------
-- Deferred: the accrual layer that must run before a back-valued call
-- ---------------------------------------------------------------------

deferred AccrualLayer.reaccrue    -- see: accrual/reaccrual.allium


## Auditor verdict

_The specification surfaces and correctly resolves all 14 reference decisions, including the genuinely bespoke ones (fees-before-penalties order, BHD 3-dp precision, interest-absorbed rounding residual, value-date re-accrual, credit-balance overpayment handling with no principal prepay, and the 0.005 BHD write-off tolerance). Coverage = 14/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | @invariant WithinInstalmentBucketOrder: "fees first, then penalties, then interest, then principal. Fees come before penalties." | Spec states the exact order fees → penalties → interest → principal, including the deliberate fees-before-penalties choice, matching the reference. |
| 2 | yes | **yes** | @invariant AcrossInstalmentOrder: "oldest due date first. All four buckets of the oldest instalment are cleared in full before any money touches the next instalment." | Matches the reference strategy of clearing the oldest instalment entirely (all four buckets) before touching the next. |
| 3 | yes | **yes** | @invariant SurplusBecomesCredit: "surplus is held on the loan as an unallocated credit balance. It is automatically applied to the next instalment when that instalment falls due. It is never auto-refunded..." | All three elements (held credit balance, auto-applied when next instalment falls due, never auto-refunded) match exactly. |
| 4 | yes | **yes** | config { settlement_currency: String = "BHD"; amount_precision_dp: Integer = 3 } and "denominated in BHD to 3 decimal places (fils)". | Spec explicitly sets BHD at 3 dp (fils), the exact non-default precision in the reference. |
| 5 | yes | **yes** | config { rounding_mode: String = "half_up" } and AmountPrecisionAndRounding: "Rounding is round-half-up to 3 dp." | Round-half-up to the minor unit matches the reference rounding method. |
| 6 | yes | **yes** | @invariant AmountPrecisionAndRounding: "Any rounding residual is absorbed into the interest component, not principal." | Residual absorbed into interest, explicitly not principal, matches the reference exactly (the additional zero-interest fallback does not contradict the primary rule). |
| 7 | yes | **yes** | @invariant ValueDateReAccrual: "When value_date is earlier than today (back-valued), interest is re-accrued to value_date... before allocation runs." | Back-valued payments trigger re-accrual to the value date before allocation, matching the reference. |
| 8 | yes | **yes** | @invariant SurplusBecomesCredit: surplus "neither prepays principal nor changes future interest"; @invariant Eligibility limits allocation to due instalments. | Early/on-time surplus settles only the current due instalment and becomes credit without prepaying principal or altering future interest, matching the reference. |
| 9 | yes | **yes** | @invariant ShortfallAllocation: "allocate strictly in bucket order as far as the money reaches... No proportional splitting across buckets or instalments." | Strict in-order fill with explicit rejection of proportional splitting matches the reference. |
| 10 | yes | **yes** | config write_off_tolerance = 5 (5 fils = 0.005 BHD); @invariant WriteOffTolerance: "if the residual owed on that instalment is <= 0.005 BHD (5 fils) it is written off... instalment is marked fully paid." | Per-instalment tolerance of 0.005 BHD with the instalment marked fully paid matches the reference threshold and behaviour exactly. |
| 11 | yes | **yes** | @invariant NegativePaymentRejected: "rejected with an error"; @invariant ZeroPaymentBehaviour: "the call is a no-op and a zero-value allocation transaction is still recorded." | Negative rejected with error and zero as a no-op that still records a zero-value allocation transaction match both halves of the reference. |
| 12 | yes | **yes** | @invariant ValueDateReAccrual: "penalties accrue up to and including value_date before allocation runs. Allocation runs on those post-accrual balances, not on balances as they stand at call time." | Accrue-then-allocate on post-accrual balances, penalties inclusive of the value date, matches the reference decision. |
| 13 | yes | **yes** | @invariant SameValueDateOrdering: "Payments sharing a value_date on the same loan are applied FIFO by receipt timestamp, each allocated independently in turn." | FIFO by receipt timestamp with independent per-payment allocation matches the reference exactly. |
| 14 | yes | **yes** | value AllocationResult { allocations: List<InstalmentAllocation>; outstanding_balances: List<InstalmentBalance>; credit_balance; tolerance_written_off }, where InstalmentAllocation holds per-bucket applied amounts. | Result exposes per-instalment per-bucket applied amounts, resulting outstanding balances, credit_balance created, and tolerance_written_off, matching all four elements of the reference shape. |

## Allium checker (spec-side, not scored)

check reported issues:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-zHG5oN/spec.allium",
        "line": 36
      },
      "message": "Field 'Loan.outstanding_instalments' is declared but not referenced elsewhere.",
      "severity": "info"
    },
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg/
```
