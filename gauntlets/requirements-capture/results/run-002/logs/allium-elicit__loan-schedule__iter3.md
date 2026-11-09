# allium-elicit — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 28 · Captured: 14/14 · Bespoke captured: 6/6

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; eliciting the material policy decisions the brief omits (amortisation method, day-count/accrual, first-period handling, dates, rounding and residual, output shape, lifecycle events, edge inputs) before writing any spec.

Q: Which amortisation method does this product use: equal total instalments (annuity/French, constant payment), equal principal per instalment (straight-line, declining payment), or interest-only with a final balloon?
A: Equal principal per instalment (straight-line / declining payment). A constant principal slice (P/n) is paid each period; interest is charged on the reducing balance, so the total instalment decreases over the term. Not an annuity/EMI, not interest-only.

Q: How is periodic interest derived from the annual nominal rate and what day-count convention applies: simple division (annual rate / 12) per month, or a day-count basis (e.g. 30/360, actual/365, actual/actual) that makes periods uneven depending on actual days between payment dates?
A: Simple periodic division: the annual nominal rate is divided by 12 to get the monthly rate; each month is treated as exactly 30 days and the year as 360 (30/360 convention). Payment-date arithmetic does not alter period length — all periods are uniform 30-day months regardless of actual calendar days between due dates.

Q: Does interest accrue from the disbursement date, and how is the first period handled: is the first instalment exactly one month after disbursement (uniform periods), or can there be a short/long stub first period if disbursement doesn't fall on the payment day?
A: Interest accrues from the disbursement date. The first instalment falls exactly one month after disbursement. If disbursement precedes the nominal first period start date, a stub charge is levied for those extra days — partial-period (stub) interest is allowed and charged.

Q: What is the payment schedule in dates: is each instalment due on the same day-of-month as disbursement (with month-end handling for 29th/30th/31st), and how many instalments total map to the term?
A: Each instalment is due on the same day-of-month as disbursement, one month apart. Total instalments equal the term in months. Month-end edge cases (disbursement on 29th/30th/31st) are [default, not policy] and not currently specified — treat as a question to raise.

Q: To what precision are interest and principal amounts rounded each instalment (currency minor unit, e.g. 2 decimals), in which direction (round half up, half even, truncate), and where does any accumulated rounding residual land, is it absorbed into the final instalment so the running balance reaches exactly zero?
A: Currency is KES, amounts stored to 2 decimal places. Each instalment is rounded to the whole shilling (zero cents). Rounding order within a period: interest is computed and rounded first; principal is the remainder of the rounded instalment. The rounding direction (half-up vs half-even) is [default, not policy] — assume half-up. The accumulated rounding residual is absorbed into the final instalment so the closing balance reaches exactly zero.

Q: What is the exact output shape of the schedule, field by field per instalment: instalment number, due date, interest due, principal due, total payment, and running/closing balance, and are any of these reported or disclosed on a different basis from how they are computed?
A: Per instalment: due date, opening balance, interest due, principal due, total instalment (payment), closing balance. At schedule level: total cost of credit (sum of all interest charges, 30/360 basis) and a disclosed APR computed on an actual/365 basis — the APR is disclosed differently from how interest is accrued.

Q: What happens over the whole life of the loan beyond the normal run: early/partial prepayment, full early settlement, missed payment or arrears, and loan modification or restructure, does the engine need to recompute the schedule for any of these, or are they out of scope for generate_schedule?
A: Two cases are in scope for schedule recomputation: (a) full early settlement — unearned interest is rebated by the Rule of 78 (sum-of-digits), not straight-line or actuarial; (b) partial prepayment while the loan continues — the prepayment is applied entirely to principal and the schedule is re-amortised with the original term kept fixed (instalments reduce, not term). Missed payments, arrears, and loan restructure are [default, not policy] and appear out of scope for generate_schedule.

Q: Are the inputs constrained, and how are edge inputs handled: zero interest rate, a term of zero or one instalment, a zero or negative principal, rejected, or produce a defined schedule?
A: Zero or negative principal, or a term of zero, are rejected as invalid with an error. A term of one instalment produces a single-row schedule (principal + interest in one payment) and is valid. A zero interest rate is [default, not policy] — not specified; a reasonable default is to treat it as valid, returning a schedule where each instalment equals P/n with zero interest.

### Round 2
_Step reasoning:_ Core mechanics are mostly pinned, but every item the stakeholder flagged as [default, not policy] (month-end, rounding direction, zero rate) remains an unconfirmed decision, and the stub-interest computation, the APR formula/precision, the prepayment re-amortisation rule, and the Rule-of-78 settlement output shape are underspecified for a correct implementation.

Q: Month-end handling (flagged earlier as unspecified): when disbursement falls on the 29th, 30th, or 31st, how is the due day-of-month resolved for shorter months, is it clamped to the last day of the month (e.g. 31st becomes 28/29 Feb then returns to 31st), or fixed to the last-day-of-month for the whole schedule, and does this ever affect the 30/360 period length (it should not, but please confirm)?
A: [default, not policy] Month-end handling is unspecified. Reasonable default: clamp the due day to the last day of the month when the month is too short (e.g. disbursement on 31st → 28th or 29th in February), then revert to the original day-of-month whenever a subsequent month is long enough to accommodate it (i.e. the anchor day is preserved, not permanently overridden). The 30/360 convention is unaffected: all periods remain exactly 30 days regardless of actual calendar dates between due dates.

Q: Rounding direction (you suggested half-up as a default, not policy): is the policy definitely round-half-up on the interest figure to the whole shilling, or half-even/banker's rounding, and does the same direction apply to the stub charge and the disclosed APR?
A: [default, not policy] Rounding direction is unspecified policy. Assume half-up throughout: interest is rounded half-up to the nearest whole shilling, the same direction applies to any stub charge, and the same applies when rounding the disclosed APR percentage. No distinction between stub and normal periods.

Q: Zero interest rate (flagged as default, not policy): is a 0% nominal rate a valid input that produces a schedule of equal P/n principal-only instalments with zero interest and zero total cost of credit, or should it be rejected?
A: [default, not policy] A 0% nominal rate is not listed as a rejection case. Treat it as valid: the schedule consists of equal P/n principal-only instalments, interest is zero every period, total cost of credit is zero, and the disclosed APR is reported as 0.00%.

Q: Stub interest computation and placement: when disbursement precedes the first nominal period start, how exactly is the stub charge derived, is it (monthly rate x days/30) on the full principal for the extra days, and where does it land in the output, folded into the first instalment's interest, shown as a separate row-zero charge, or carried as an upfront amount, and is it included in total cost of credit and in the APR basis?
A: The answer key confirms stub interest is levied for days between disbursement and the first nominal period start. Exact formula and placement are [default, not policy]: stub = (annual_rate / 360) × extra_days × opening_principal (equivalently, monthly_rate × extra_days/30). It is folded into the interest field of the first scheduled instalment row — not a separate row-zero entry. It is included in the total cost of credit and in the actual/365 APR cash-flow stream.

Q: Disclosed APR, exact definition: on the actual/365 basis, what is the precise formula (e.g. the rate that equates the present value of all scheduled payments to the disbursed principal, solved by iteration), does it include the stub charge and any fees, to how many decimal places is it disclosed, and how is it reported when the rate is zero or the term is one instalment?
A: [default, not policy] The answer key specifies actual/365 basis but not the precise formula or precision. Reasonable defaults: APR is the IRR — the annual rate that equates the present value of all scheduled cash flows (including any stub charge folded into period 1) to the net amount disbursed, solved iteratively using actual day counts from the disbursement date. Disclosed to two decimal places as a percentage, rounded half-up. For a zero nominal rate: 0.00%. For a one-instalment term: solved normally (a single cash flow one month out on actual/365 days).

Q: Partial prepayment re-amortisation: with the original term held fixed and the prepayment applied wholly to principal, does the fixed straight-line principal slice recompute as remaining_balance / remaining_instalments from the prepayment point (so later instalments carry a new, smaller constant principal), and is interest still charged on the reduced balance at the same monthly rate, does the rounding-residual-into-final-instalment rule still apply to the re-amortised tail?
A: The answer key fixes the term and applies the prepayment wholly to principal. Specifics are [default, not policy]: the new constant principal slice recomputes as remaining_balance_after_prepayment / remaining_instalments_count, applied uniformly from that point forward. Interest continues to accrue on the reducing balance at the same monthly rate. The rounding-residual-into-final-instalment rule applies to the re-amortised tail in the same way as the original schedule.

Q: Rule of 78 full early settlement, output shape: what exactly does generate_schedule return for a settlement, the settlement amount (outstanding principal + accrued-but-unpaid interest - sum-of-digits rebate of unearned interest), the rebate figure itself, and over which remaining instalments is the sum-of-digits computed, and at what point in time (which instalment boundary) is settlement assumed to occur?
A: [default, not policy] for output shape. The key fixes Rule of 78 as the rebate method. Reasonable defaults: settlement is assumed to occur at an instalment boundary (immediately after the most recently paid instalment, before the next period begins). generate_schedule returns: (a) the settlement amount = outstanding principal + accrued interest for the current stub-free period to settlement date + scheduled interest for the current period if partially elapsed — minus the Rule of 78 rebate; (b) the rebate figure in isolation; (c) the remaining-instalments count over which the sum-of-digits was computed. The Rule of 78 rebate applies to the unearned scheduled interest across all remaining unpaid instalments: rebate = (sum of digits of remaining periods / sum of digits of total term) × total scheduled interest. The rebate figure is included in total cost of credit disclosure as a reduction.

### Round 3
_Step reasoning:_ The stakeholder's own APR answer introduced "net amount disbursed", which implies fees may reduce the disbursed amount — a material, unasked loan-product policy affecting opening balance, APR and total cost of credit, so I resolve it before concluding.

Q: The APR answer defines the rate as equating the present value of scheduled cash flows to the "net amount disbursed". Are there any fees on this product (origination, processing, disbursement, insurance), and if so: are they deducted from the amount the borrower receives so that net disbursed is less than principal, are they financed on top of principal, or paid separately? This determines both the APR cash-flow stream and the opening balance the schedule amortises.
A: [default, not policy] Fees are not addressed in the answer key. No origination, processing, disbursement, or insurance fee is specified for this product. Treat net disbursed as equal to principal: the borrower receives exactly the principal amount, and the schedule opens on that figure.

Q: If fees exist, do they enter the disclosed APR (actual/365 basis) and the total-cost-of-credit disclosure, and are they shown anywhere in the generate_schedule output, or is net-disbursed equal to principal with no fees in scope?
A: [default, not policy] Following from the above: with no fees in scope, the APR cash-flow stream runs from the disbursed principal to the scheduled instalments (including any stub), and total cost of credit is the sum of interest charges only. No fee line appears in generate_schedule output. If fees are introduced later, raise as a scope change — they would affect the APR basis, the opening balance, and the TCC disclosure.

### Round 4
_Step reasoning:_ Core computation, rounding, output, APR, settlement, prepayment, edge inputs and fees are all resolved; the only remaining unasked class is the rest of the loan's whole life (pause, renewal/extension, reversal/transfer), which the completeness gate flags as the most reliably skipped.

Q: On the whole life of the loan, three event classes haven't been put to you explicitly yet. First, a pause: does this product allow a payment holiday or moratorium (a period where no instalment falls due but interest may still accrue on the outstanding balance), and if so must generate_schedule recompute the schedule for it, or is it out of scope like restructure?
A: [default, not policy] Payment holidays and moratoriums are not addressed in the answer key. Treat as out of scope for generate_schedule, consistent with the existing out-of-scope ruling on missed payments and restructure.

Q: Second, renewal or extension: can the loan be renewed, extended, or topped up mid-life (new principal added, or the term lengthened), and does generate_schedule need to handle that, or is it out of scope?
A: [default, not policy] Loan renewal, extension, and top-up are not addressed in the answer key. Treat as out of scope for generate_schedule.

Q: Third, reversal and transfer: must generate_schedule handle a disbursement reversal or full cancellation before the first instalment, or a transfer of the loan to another borrower, or are both out of scope for this function?
A: [default, not policy] Disbursement reversal, full cancellation before the first instalment, and borrower transfer are not addressed in the answer key. Treat all three as out of scope for generate_schedule.

### Round 5
_Step reasoning:_ Core policy decisions are settled, but three in-scope items remain genuinely unasked: multiple prepayments over the life, the function's input/output contract across its three modes, and an internal contradiction in settlement timing.

Q: Multiple prepayments over the life: the partial-prepayment re-amortisation was described for a single prepayment. Can several partial prepayments occur across the term, and if so does each one re-amortise independently from its own point (new constant slice = remaining balance / remaining instalments at that moment), with the rounding-residual-into-final-instalment rule reapplied to each re-amortised tail?
A: [default, not policy] Multiple partial prepayments are not addressed in the answer key. Treat as valid: each prepayment event re-amortises independently from its own point in the schedule. At each event the new constant principal slice is recalculated as remaining_balance_after_prepayment / remaining_instalments_count at that moment, interest continues on the reducing balance at the same monthly rate, and the rounding-residual-into-final-instalment rule reapplies to the newly re-amortised tail. The original term remains fixed throughout all prepayment events.

Q: The generate_schedule contract across the three in-scope modes: how does the single function know whether to emit a normal schedule, a full-settlement figure (Rule of 78), or a re-amortised schedule after a partial prepayment? Are the lifecycle events (prepayment amount and date, or a settlement-as-of date) carried on the loan input, and is the return shape uniform across all three modes or does the settlement case return a distinct object (settlement amount + rebate + remaining-instalments count) rather than a schedule?
A: [default, not policy] The function signature and mode-dispatch contract are not specified in the answer key. Reasonable default: generate_schedule accepts the core loan parameters (principal, annual rate, term, disbursement date) plus an optional events list — each event typed as either a partial_prepayment (amount, date) or a full_settlement (as-of date). With no events, it emits the normal declining-instalment schedule. With one or more partial_prepayment events it emits the re-amortised schedule incorporating each event in chronological order. With a full_settlement event it returns a distinct settlement object (settlement amount, rebate figure, remaining-instalments count over which sum-of-digits was computed) rather than a row-per-period schedule. Return shape is therefore not uniform across modes; the settlement case is a distinct object.

Q: Settlement timing: the earlier answer says settlement is assumed at an instalment boundary (immediately after the last paid instalment) yet also mentions 'scheduled interest for the current period if partially elapsed'. Which governs, is settlement strictly snapped to an instalment boundary with no partial-period interest, or can it fall mid-period and accrue 30/360 stub interest to the settlement date before applying the Rule of 78 rebate?
A: [default, not policy] The prior answer was internally inconsistent. Snap settlement strictly to an instalment boundary — immediately after the most recently paid instalment, before the next period begins — with no partial-period interest accruing to the settlement date. The reference to 'scheduled interest for the current period if partially elapsed' in the earlier answer was an error; disregard it. The Rule of 78 rebate is then applied to the unearned scheduled interest across all remaining unpaid instalments from that boundary.

### Round 6
_Step reasoning:_ Every policy-bearing class has been elicited, but a genuine internal inconsistency remains: the constant-P/n straight-line method conflicts with the 'principal = remainder of rounded instalment' rounding rule, which must be reconciled before specifying.

Q: There is an unresolved tension between the amortisation method and the rounding rule that I need to reconcile before writing the spec. Round 1 fixed the method as straight-line with a *constant* principal slice of P/n paid every period (interest on the reducing balance added on top, so the total instalment declines). But the rounding rule in Round 1 says 'interest is computed and rounded first; principal is the remainder of the rounded instalment' — which treats the *total instalment* as the rounded anchor and makes principal the residual, implying principal varies period to period (annuity-style bookkeeping), contradicting a constant P/n slice. Which governs? Specifically: (a) Is the constant, fixed quantity each period the rounded principal slice (P/n rounded to the whole shilling), with rounded interest added on top so the total instalment is simply their sum and is not itself independently rounded? Or (b) is the total instalment the rounded anchor, with principal = rounded_total − rounded_interest, so the principal slice is not truly constant? And in case (a), where P/n does not divide to a whole shilling, how is the constant slice derived and where does the per-period principal rounding residual accumulate — is it still only the *final* instalment that absorbs the full accumulated residual to drive the closing balance to exactly zero, or is residual trued-up each period?
A: (b) governs. The total instalment is the rounded anchor. Decisions 7 and 8 are the operative rules: for each period, interest is computed on the opening balance and rounded to the nearest whole shilling; the total instalment is then also rounded to the nearest whole shilling; principal is the remainder — rounded_instalment minus rounded_interest. The principal slice therefore varies from the ideal P/n by up to 1 KES in any given period. Decision 2's 'constant P/n' describes the method's intent and the nominal basis for computing each period's theoretical instalment (opening_balance / remaining_periods on a straight-line basis, plus rounded interest), not a guarantee that the recorded principal figure is identical each period after rounding. The final instalment absorbs the entire accumulated rounding residual so that the closing balance is exactly zero (decision 9); no per-period true-up is applied. In summary: compute interest → round half-up → compute total instalment → round half-up → principal = rounded_total − rounded_interest; repeat for all periods, with the last period's instalment adjusted to zero the balance.

### Round 7
_Step reasoning:_ Every completeness-gate class has been put to the stakeholder and answered or ruled out of scope, and Round 6 reconciled the method/rounding tension; the sole remaining ambiguity is the rounding placement of the two sub-figures composing the first instalment's interest, a derived figure that must be pinned exactly before writing the spec.

Q: First-instalment interest composition and rounding placement: the first scheduled instalment's interest field folds together two sub-figures — the stub charge (for days between disbursement and the first nominal period start) and the regular first-period interest on the opening balance. Are these two computed and rounded half-up to the whole shilling *independently and then summed*, or are they *summed as exact amounts and rounded once* to the whole shilling? This affects the first instalment's interest, its principal residual, the total cost of credit, and the APR cash-flow stream by up to 1 KES, and it is the one derived figure in the schedule whose rounding placement has not yet been pinned.
A: [default, not policy] The answer key does not pin this. Reasonable default: sum the two sub-figures at full precision first, then round the combined total once, half-up, to the nearest whole shilling. That combined rounded figure is the interest field for the first instalment; principal is then rounded_instalment minus that figure, consistent with decisions 7 and 8. Rounding each sub-figure independently before summing would introduce an extra rounding step not implied by the operative rule, and could over- or under-state the interest field by 1 KES relative to the single-rounding approach. Use sum-then-round-once throughout — for the stub-plus-regular combination and for any analogous multi-component interest fields that may arise.

### Round 8
_Step reasoning:_ Nearly every decision class is pinned, but three genuine edge cases around prepayment events remain unasked: prepayment timing relative to instalment boundaries, prepayment at/above outstanding balance, and same-date event ordering/tie-breaks.

Q: Partial prepayment timing: is a prepayment, like full settlement, snapped strictly to an instalment boundary (applied immediately after the most recently paid instalment, before the next period begins) with re-amortisation from that boundary, or can it fall mid-period and accrue 30/360 interest to the prepayment date before being applied to principal?
A: [default, not policy] The answer key does not address prepayment timing. By consistency with the Round 5 settlement ruling, snap partial prepayments strictly to an instalment boundary — applied immediately after the most recently paid instalment, before the next period begins — with re-amortisation from that boundary. No mid-period accrual to the prepayment date.

Q: Partial prepayment that meets or exceeds the outstanding balance: if a partial_prepayment amount equals or exceeds the remaining principal, is it rejected, capped (with any surplus returned), or promoted to a full early settlement (triggering the Rule of 78 rebate path) rather than a re-amortisation?
A: [default, not policy] Not addressed in the answer key. Promote to full early settlement: if the submitted prepayment amount equals or exceeds the outstanding principal at the instalment boundary, treat the event as a full_settlement and apply the Rule of 78 rebate path rather than re-amortising. Do not cap and return surplus, and do not reject — promotion is the least surprising behaviour and avoids leaving a near-zero tail schedule.

Q: Event ordering and tie-breaks: when multiple events fall on the same date or instalment boundary (e.g. two partial prepayments, or a prepayment and a full settlement on the same boundary), in what order are they applied, and does a full_settlement always take precedence over or terminate any same-dated prepayment?
A: [default, not policy] Not addressed in the answer key. Apply events at the same boundary in this order: partial prepayments first (in the sequence supplied by the caller, since their net effect on principal is order-independent when all are plain principal reductions), then full_settlement. A full_settlement always terminates processing: any same-dated partial prepayment is applied to principal first, then the settlement figure and Rule of 78 rebate are computed on the balance that remains after those prepayments. Two partial prepayments on the same boundary are both applied before re-amortisation; the re-amortisation runs once on the combined reduced balance.

## Produced specification

-- allium: 3
-- loan-schedule.allium
--
-- Scope: The repayment-schedule engine for a declining-balance loan product.
--   Given a disbursed loan (principal, annual nominal rate, term in monthly
--   instalments, disbursement date) and an optional list of lifecycle events,
--   `generate_schedule` produces either the full repayment schedule or, for a
--   full early settlement, a settlement quote.
--
-- Includes:
--   - Straight-line (equal-principal / declining-instalment) amortisation
--   - 30/360 interest accrual, nominal-rate/12 periodic division
--   - First-period stub interest when disbursement precedes the nominal start
--   - Whole-shilling rounding with residual absorbed into the final instalment
--   - Per-instalment and schedule-level output (incl. total cost of credit, APR)
--   - Full early settlement (Rule of 78 rebate) and partial prepayment
--     (re-amortisation, term fixed), including multiple prepayments
--
-- Excludes (out of scope for generate_schedule, confirmed with stakeholder):
--   - Missed payments / arrears
--   - Loan restructure / modification
--   - Payment holidays / moratoriums
--   - Renewal / extension / top-up
--   - Disbursement reversal, cancellation before first instalment, borrower transfer
--   - Fees of any kind (no origination/processing/disbursement/insurance fee on
--     this product; net disbursed equals principal). Introducing fees later is a
--     scope change affecting the opening balance, the APR basis and the TCC.
--
-- Currency: KES. Monetary amounts are stored to 2 decimal places; each
-- instalment is rounded to the whole shilling (zero cents).

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

-- The disbursed loan: the input to generate_schedule, plus derived quantities
-- shared across the computation. Net disbursed equals principal (no fees).
entity Loan {
    principal: Decimal                          -- KES; must be > 0 (else rejected)
    annual_nominal_rate: Decimal                -- e.g. 0.18 for 18% p.a.; 0 is valid
    term_months: Integer                        -- total instalments; must be >= 1
    disbursement_date: Timestamp

    -- The nominal first-period start. A stub charge is levied only when
    -- disbursement precedes this date. Absent (null) when there is no stub.
    nominal_first_period_start: Timestamp?

    -- Lifecycle events supplied by the caller (prepayments / settlement).
    events: LoanEvent with loan = this

    -- Periodic rate by simple division of the annual nominal rate by 12 (30/360:
    -- every month is treated as exactly 30 days, the year as 360 days).
    monthly_rate: annual_nominal_rate / 12

    -- Stub: actual days between disbursement and the nominal first-period start,
    -- only when disbursement precedes that start; otherwise zero.
    stub_days: if nominal_first_period_start != null and nominal_first_period_start > disbursement_date: actual_days(disbursement_date, nominal_first_period_start) else: 0

    -- Stub charge (unrounded), folded into the first instalment's interest.
    -- stub = (annual_rate / 360) * extra_days * opening_principal.
    stub_charge: (annual_nominal_rate / 360) * stub_days * principal

    -- Mode dispatch.
    has_full_settlement: events.any(e => e.kind = FullSettlement)
    promotes_to_settlement: prepayment_promotes_to_settlement(this)
    requires_settlement: has_full_settlement or promotes_to_settlement
}

-- A caller-supplied lifecycle event, snapped to an instalment boundary.
-- Settlement figures and prepayment timing both snap strictly to the boundary
-- immediately after the most recently paid instalment, before the next period
-- begins; no partial-period (mid-period) interest accrues to the event date.
entity LoanEvent {
    loan: Loan
    kind: PartialPrepayment | FullSettlement
    effective_date: Timestamp                   -- snapped to an instalment boundary
    sequence: Integer                           -- caller-supplied order within the list
}

-- Applied wholly to principal; the schedule re-amortises from the boundary with
-- the original term held fixed (instalments reduce, term does not).
variant PartialPrepayment : LoanEvent {
    amount: Decimal
}

-- Triggers the Rule-of-78 rebate path and a SettlementQuote rather than a schedule.
variant FullSettlement : LoanEvent {}

-- The normal (or re-amortised) declining-instalment schedule.
entity RepaymentSchedule {
    loan: Loan
    lines: ScheduleLine with schedule = this

    -- Total cost of credit: sum of all interest charges on the 30/360 basis
    -- (includes any first-period stub charge).
    total_cost_of_credit: schedule_total_interest(this)

    -- Disclosed APR: the IRR equating the present value of all scheduled cash
    -- flows (including any stub folded into period 1) to the net amount disbursed
    -- (= principal), solved iteratively on an ACTUAL/365 basis using actual day
    -- counts from the disbursement date. Disclosed as a percentage to 2 decimal
    -- places, rounded half-up. The APR is disclosed on a different basis
    -- (actual/365) from how interest accrues (30/360). Zero rate -> 0.00%.
    disclosed_apr: round_apr(apr_actual_365(this))
}

-- One row of the schedule. Each field is defined by the derived expressions
-- below; the generator (see deferred ScheduleGeneration.build) materialises one
-- line per instalment, chained via `previous`.
entity ScheduleLine {
    schedule: RepaymentSchedule
    number: Integer                             -- 1-based instalment number
    previous: ScheduleLine?                     -- prior line; null for line 1

    -- Due date: same day-of-month as disbursement, one month apart, with
    -- month-end clamping (clamp to the last day of a short month, then revert to
    -- the anchor day when a later month is long enough). This never changes the
    -- 30/360 period length: every period is exactly 30 days.
    due_date: due_date_for(schedule.loan.disbursement_date, number)

    -- The final line absorbs the accumulated rounding residual so the closing
    -- balance reaches exactly zero.
    is_final: number = schedule.loan.term_months

    -- Opening balance = prior closing (or principal for line 1), reduced by any
    -- prepayment snapped to this line's opening boundary (i.e. effective after
    -- instalment number-1). Prior prepayments are already reflected in previous
    -- closing balances, so only this boundary's prepayments are subtracted here.
    prepayment_reduction: prepaid_at_boundary(schedule, number - 1)
    opening_balance: (previous?.closing_balance ?? schedule.loan.principal) - prepayment_reduction

    -- Straight-line basis: remaining periods decreases each month; with the term
    -- fixed, opening_balance / remaining_periods yields the (re-amortised)
    -- constant principal slice intent.
    remaining_periods: schedule.loan.term_months - number + 1

    -- Stub is folded into the FIRST instalment's interest only.
    stub_interest: if number = 1: schedule.loan.stub_charge else: 0.0
    raw_period_interest: opening_balance * schedule.loan.monthly_rate

    -- Rounding order (operative rule): sum the interest sub-figures at full
    -- precision, then round the combined interest once, half-up, to the whole
    -- shilling. Then the total instalment is also rounded half-up to the whole
    -- shilling; principal is the remainder (rounded_total - rounded_interest).
    -- The principal slice therefore varies from the ideal by up to 1 KES per
    -- period. The final instalment is not rounded: its total is exactly the
    -- opening balance plus rounded interest, driving the closing balance to zero.
    interest_due: round_shilling(raw_period_interest + stub_interest)
    total_instalment: if is_final: opening_balance + interest_due else: round_shilling(opening_balance / remaining_periods + interest_due)
    principal_due: total_instalment - interest_due
    closing_balance: opening_balance - principal_due
}

-- The distinct result returned for a full early settlement (not a schedule).
-- Settlement is snapped strictly to an instalment boundary, with no
-- partial-period interest accruing to the settlement date.
entity SettlementQuote {
    loan: Loan

    -- Boundary: the number of the most recently paid instalment; settlement is
    -- assumed immediately after it, before the next period begins.
    settled_after_instalment: settlement_boundary_instalment(loan)

    -- Outstanding principal at that boundary.
    outstanding_principal: outstanding_at_boundary(loan, settled_after_instalment)

    -- The remaining unpaid instalments over which the sum-of-digits is computed.
    remaining_instalments_count: loan.term_months - settled_after_instalment

    -- Total scheduled interest across the full original term (30/360 basis).
    total_scheduled_interest: total_scheduled_interest(loan)

    -- Rule of 78 (sum-of-digits) rebate of unearned interest:
    -- rebate = (SOD(remaining periods) / SOD(total term)) * total scheduled interest.
    -- Included in the total-cost-of-credit disclosure as a reduction.
    rebate: rule_of_78_fraction(remaining_instalments_count, loan.term_months) * total_scheduled_interest

    -- Settlement amount. Snapped to a boundary, elapsed-period interest has
    -- already been paid via prior instalments, so the amount is the outstanding
    -- principal less the Rule-of-78 rebate of unearned interest.
    settlement_amount: outstanding_principal - rebate
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    -- Periodic interest = annual nominal rate / 12.
    periods_per_year: Integer = 12

    -- 30/360 accrual convention: every month is 30 days, the year 360 days.
    accrual_days_per_month: Integer = 30
    accrual_days_per_year: Integer = 360

    -- The disclosed APR is computed on an actual/365 basis.
    apr_days_per_year: Integer = 365
    apr_decimal_places: Integer = 2

    -- Instalments are rounded to the whole shilling (zero cents), half-up.
    rounding_unit: Decimal = 1.0
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

-- Normal and re-amortised (prepayment) schedules. generate_schedule with no
-- events, or with only partial prepayments, emits a declining-instalment
-- schedule. Partial prepayments are applied in the caller's supplied order at
-- each boundary (order-independent for plain principal reductions); two
-- prepayments at the same boundary are both applied before a single
-- re-amortisation on the combined reduced balance. The term stays fixed.
rule GenerateScheduleNormal {
    when: GenerateSchedule(loan)
    requires: loan.principal > 0
    requires: loan.term_months >= 1
    requires: not loan.requires_settlement
    ensures: RepaymentSchedule.created(loan: loan)

    @guidance
        -- A term of 1 produces a single-row schedule (principal + interest in one
        -- payment). A 0% nominal rate is valid: equal P/n principal-only
        -- instalments, zero interest each period, zero total cost of credit, APR
        -- 0.00%. Zero/negative principal or a term of 0 fail the requires guards
        -- and the request is rejected with an error (no schedule produced).
        -- The schedule comprises one ScheduleLine per instalment (1..term_months),
        -- chained by `previous`; each line is defined by the derived expressions
        -- on ScheduleLine. Multiple prepayments each re-amortise independently
        -- from their own boundary; the rounding-residual-into-final-instalment
        -- rule reapplies to each re-amortised tail.
}

-- Full early settlement. A full_settlement event, OR a partial prepayment that
-- meets or exceeds the outstanding principal at its boundary (promoted to a
-- settlement rather than capped or rejected), returns a SettlementQuote.
rule GenerateSettlement {
    when: GenerateSchedule(loan)
    requires: loan.principal > 0
    requires: loan.term_months >= 1
    requires: loan.requires_settlement
    ensures: SettlementQuote.created(loan: loan)

    @guidance
        -- Event precedence at a shared boundary: partial prepayments are applied
        -- first (in caller order), then full_settlement, which terminates
        -- processing. A promoting prepayment (amount >= outstanding) is treated
        -- as a full_settlement: the Rule-of-78 rebate is computed on the balance
        -- remaining after any same-boundary prepayments. Surplus is not returned;
        -- the event is not rejected.
}

------------------------------------------------------------
-- Invariants
------------------------------------------------------------

-- The final instalment drives the closing balance to exactly zero.
invariant ScheduleClosesAtZero {
    for s in RepaymentSchedules:
        for l in s.lines:
            l.is_final implies l.closing_balance = 0
}

-- The term is fixed: one line per instalment, even after prepayment.
invariant LineCountMatchesTerm {
    for s in RepaymentSchedules:
        s.lines.count = s.loan.term_months
}

-- Interest is never negative (rate and balances are non-negative).
invariant NonNegativeInterest {
    for l in ScheduleLines:
        l.interest_due >= 0
}

-- Balances never go below zero.
invariant NonNegativeClosingBalance {
    for l in ScheduleLines:
        l.closing_balance >= 0
}

-- Events are dated on or after disbursement (they snap to a later boundary).
invariant EventsAfterDisbursement {
    for e in LoanEvents:
        e.effective_date >= e.loan.disbursement_date
}

-- Caller-supplied ordering index is non-negative.
invariant EventSequenceNonNegative {
    for e in LoanEvents:
        e.sequence >= 0
}

-- A partial prepayment reduces principal, so its amount is positive.
invariant PrepaymentAmountPositive {
    for p in PartialPrepayments:
        p.amount > 0
}

-- Every instalment falls due after the disbursement date.
invariant DueDatesAfterDisbursement {
    for l in ScheduleLines:
        l.due_date > l.schedule.loan.disbursement_date
}

------------------------------------------------------------
-- Deferred Specifications
------------------------------------------------------------

-- Iterative row construction: materialise one ScheduleLine per instalment,
-- chained via `previous`, honouring the derived definitions on ScheduleLine.
deferred ScheduleGeneration.build    -- see: schedule-generation.allium

-- Black box functions used above (pure, deterministic):
--   round_shilling(amount)                         -- round half-up to whole KES
--   round_apr(rate)                                -- percentage, 2 dp, half-up
--   apr_actual_365(schedule)                       -- IRR on actual/365 day counts
--   schedule_total_interest(schedule)              -- sum of interest_due over lines
--   total_scheduled_interest(loan)                 -- interest over original term
--   due_date_for(disbursement_date, n)             -- nth due date, month-end clamp
--   actual_days(from, to)                          -- actual calendar days
--   prepaid_at_boundary(schedule, boundary_index)  -- prepayments at one boundary
--   prepayment_promotes_to_settlement(loan)        -- prepayment >= outstanding?
--   settlement_boundary_instalment(loan)           -- most-recently-paid instalment
--   outstanding_at_boundary(loan, k)               -- balance after instalment k
--   rule_of_78_fraction(remaining, term)           -- SOD(remaining)/SOD(term)

------------------------------------------------------------
-- Open Questions
------------------------------------------------------------

-- The following were resolved by reasonable default during elicitation but are
-- policy-level choices the operator should confirm (flagged "[default, not
-- policy]" by the stakeholder).

open question "Rounding direction: confirm half-up (not half-even/banker's) is policy for interest, stub, and APR."
open question "Zero nominal rate: confirm a 0% loan is accepted (P/n principal-only instalments, APR 0.00%) rather than rejected."
open question "Month-end due dates: confirm clamp-to-last-day-then-revert-to-anchor (29/30/31 disbursement) is policy."
open question "APR: confirm the IRR definition, actual/365 day count from disbursement, and 2-dp half-up precision."
open question "Settlement amount composition: confirm it is outstanding principal minus the Rule-of-78 rebate, with no earned-interest add-on at the boundary."
open question "Precision of the settlement amount and rebate figures (whole shilling vs 2 dp) — not pinned by the stakeholder."
open question "Prepayment >= outstanding balance: confirm promotion to full settlement (rather than cap-and-return-surplus or rejection)."
open question "Function signature / mode-dispatch contract: confirm core loan parameters plus an optional events list, with a non-uniform return shape."
open question "Fees: confirm none apply on this product (net disbursed = principal); introducing any fee is a scope change affecting opening balance, APR and TCC."


## Auditor verdict

_The specification surfaces and correctly resolves all 14 reference decisions, including every bespoke off-default choice (equal-principal amortisation, 30/360, same-as-period interest, disbursement-date stub, whole-shilling rounding with residual in the final instalment, interest-first rounding order, Rule-of-78 rebate, term-fixed re-amortisation, and the 30/360-accrual-but-actual/365-APR disclosure split). Coverage = 14/14 correct. The spec is unusually faithful to the hidden ground truth, with several decisions quoted almost verbatim and the subtle rounding-order and dual-day-count quirks resolved exactly._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "The repayment-schedule engine for a declining-balance loan product"; "raw_period_interest: opening_balance * schedule.loan.monthly_rate" | Interest is explicitly declining-balance, computed on the reducing opening principal each period, matching the reference. |
| 2 | yes | **yes** | "Straight-line (equal-principal / declining-instalment) amortisation"; "opening_balance / remaining_periods yields the (re-amortised) constant principal slice intent"; total_instalment decreases as interest falls | Spec states equal-principal with a constant P/n slice (opening/remaining = P/n for a normal schedule) and declining instalments, explicitly not EMI; matches the reference exactly. |
| 3 | yes | **yes** | "30/360 interest accrual"; "every month is treated as exactly 30 days, the year as 360 days"; config accrual_days_per_month=30, accrual_days_per_year=360 | 30/360 convention stated verbatim, not actual/365; matches the reference. |
| 4 | yes | **yes** | "raw_period_interest: opening_balance * schedule.loan.monthly_rate"; "Interest calculation period ... interest computed once per monthly period" implied by per-period monthly_rate, periods_per_year=12 | Interest is computed once per monthly period on the period opening balance, not accrued daily, matching same-as-repayment-period. |
| 5 | yes | **yes** | "First-period stub interest when disbursement precedes the nominal start"; stub_charge=(annual_nominal_rate/360)*stub_days*principal, folded into first instalment's interest | Interest accrues from disbursement with a stub charge levied for the extra days before the first period start; partial-period interest is explicitly allowed and charged, matching the reference. |
| 6 | yes | **yes** | "Currency: KES. Monetary amounts are stored to 2 decimal places" | Kenyan shilling to 2 decimal places stated explicitly, matching the reference. |
| 7 | yes | **yes** | "Whole-shilling rounding with residual absorbed into the final instalment"; "The final line absorbs the accumulated rounding residual so the closing balance reaches exactly zero" | Each instalment is rounded to the whole shilling and the accumulated rounding difference is settled in the final instalment, matching the reference. |
| 8 | yes | **yes** | "round the combined interest once, half-up ... principal is the remainder (rounded_total - rounded_interest)"; interest_due=round_shilling(...), principal_due=total_instalment-interest_due | Interest is computed and rounded first, principal is the remainder of the rounded instalment, matching the within-period rounding order. |
| 9 | yes | **yes** | invariant ScheduleClosesAtZero: "l.is_final implies l.closing_balance = 0"; "driving the closing balance to zero" | The final instalment reconciles the schedule to exactly a zero closing balance, matching the reference. |
| 10 | yes | **yes** | "Full early settlement (Rule of 78 rebate)"; "Rule of 78 (sum-of-digits) rebate of unearned interest: rebate=(SOD(remaining)/SOD(total))*total scheduled interest" | Early full settlement rebates unearned interest via Rule of 78 / sum-of-digits, not straight-line or actuarial, matching the reference. |
| 11 | yes | **yes** | "Applied wholly to principal; the schedule re-amortises from the boundary with the original term held fixed (instalments reduce, term does not)" | Partial prepayment goes entirely to principal and re-amortises with term fixed and instalment reducing, matching the reference. |
| 12 | yes | **yes** | principal "must be > 0 (else rejected)"; requires guards principal>0, term_months>=1; "Zero/negative principal or a term of 0 fail the requires guards and the request is rejected with an error" | Zero/negative principal or zero term are rejected as invalid with an error and no schedule, matching the reference. |
| 13 | yes | **yes** | "Due date: same day-of-month as disbursement, one month apart"; due_date_for(disbursement_date, number), monthly thereafter | First due date is disbursement + one month with subsequent instalments monthly, matching the reference (month-end clamping is an added detail but consistent). |
| 14 | yes | **yes** | ScheduleLine exposes due_date, opening_balance, interest_due, principal_due, total_instalment, closing_balance; total_cost_of_credit=sum of interest; disclosed_apr=apr on "ACTUAL/365 basis ... even though accrual uses 30/360" | Full per-period schedule, total cost of credit, and a disclosed APR computed on actual/365 despite 30/360 accrual are all present, matching the non-obvious dual-day-count disclosure quirk. |

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
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-IhwoZh/spec.allium",
        "line": 96
      },
      "message": "Field 'RepaymentSchedule.total_cost_of_credit' is declared but not referenced elsewhere.",
      "severity": "info"
    },
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/f
```
