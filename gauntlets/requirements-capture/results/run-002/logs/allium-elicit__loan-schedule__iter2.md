# allium-elicit — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 20 · Captured: 13/14 · Bespoke captured: 6/6

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; I must elicit the omitted material policy decisions (amortisation method, interest/day-count convention, first-instalment timing and stub handling, rounding, residual absorption, and exact output shape) before writing any spec.

Q: Which amortisation method does this product use: equal total instalments (annuity / French amortisation, where each payment is the same and the interest/principal split shifts over the term), equal principal repayment (straight-line principal with declining interest and a declining total payment), or interest-only with a principal balloon at the end?
A: Equal principal repayment (straight-line / declining-payment). Each period carries a constant principal portion of P/n; interest is charged on the outstanding balance that period; the total instalment therefore decreases over the term. Equal-instalment (annuity/French) and interest-only balloon are not used.

Q: How is the per-instalment interest derived from the annual nominal rate? Is it a flat periodic rate (annual rate / 12 applied to the outstanding balance each month), or is it computed on actual elapsed days using a day-count convention (e.g. actual/365, actual/360, 30/360)? If day-count based, which convention?
A: A flat periodic rate: the annual nominal rate divided by 12, applied to the opening outstanding balance each month. The day-count convention is 30/360 (every month treated as 30 days, year as 360). Interest is computed once per monthly period, not via daily accrual.

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month after, or on a fixed day of the month), and if the gap between disbursement and the first due date is not a whole period, how is interest for that first ('stub') period handled, charged pro-rata, as a full period, or capitalised?
A: The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. If disbursement occurs before the first period start, a stub interest charge is levied for those extra days at the same periodic rate pro-rata. Partial-period interest is allowed and charged; it is not capitalised or waived.

Q: What currency precision and rounding apply to each computed figure (interest, principal, instalment)? Which rounding direction (half-up, half-even, truncate) and to how many decimal places?
A: Currency is Kenyan shilling (KES). Interest is computed and rounded first, to the whole shilling (no cents). The instalment is also rounded to the whole shilling. Principal for the period is the remainder after subtracting the rounded interest from the rounded instalment. Rounding direction is half-up to the nearest whole shilling.

Q: The running balance must close to exactly zero at the final instalment. Where does the accumulated rounding residual get absorbed, into the final instalment's principal (and total), spread across instalments, or handled some other way?
A: The accumulated rounding residual is absorbed entirely into the final instalment. The final instalment is adjusted so that the closing balance after it is exactly zero; it is not spread across earlier periods.

Q: What exactly must each row of the returned schedule contain, field by field (e.g. instalment number, due date, opening balance, interest due, principal due, total payment, closing balance)? And should the function also return any summary figures such as total interest, total repayable, or a disclosed APR/effective rate computed on a different basis from the accrual rate?
A: Each row must contain: due date, opening balance, interest due, principal due, total instalment (payment), and closing balance. The function must also return two summary figures: total cost of credit (sum of all interest charges across the schedule) and a disclosed APR computed on an actual/365 basis, even though accrual itself uses 30/360.

### Round 2
_Step reasoning:_ Core policy decisions are captured, but several reliably-skipped classes remain unasked: the stub period has an internal contradiction, and due-date rolling, exact APR method, whole-life events, and degenerate inputs are all still material and unresolved.

Q: On the stub period: you said the first instalment falls exactly one month after disbursement, yet also that a stub interest charge applies 'for the extra days' if disbursement occurs before the first period start. These seem to conflict. Can you clarify when a stub actually arises, how its days are counted under 30/360, what pro-rata fraction is used, and where the stub interest appears in the schedule (folded into the first instalment, shown as its own row, or reported separately)?
A: The answer key states two things that sit in tension: first due date = disbursement date + one month (so period 1 always spans exactly that interval), and that a stub charge applies 'if disbursement precedes the first period start'. The key does not explicitly define what the 'first period start' is when it differs from the disbursement date, so the precise trigger for a stub is not fully resolved by policy. What the key does confirm: (a) interest accrues from the disbursement date; (b) if any extra pre-period days exist, a stub charge is levied for them at the same periodic rate, pro-rated; (c) partial-period interest is charged, not capitalised or waived. Under 30/360 the stub fraction would be stub_days/360 applied to the opening principal. Where the stub appears in the schedule is not specified in the key — [default, not policy]: fold it into the first instalment row as an additional interest line, so the first row shows opening balance, stub interest + first-period interest, constant principal portion P/n, combined instalment, and closing balance.

Q: On monthly due dates: when disbursement falls on the 29th, 30th or 31st, how are subsequent monthly due dates set in shorter months (roll to the last day of the month, roll forward to the next month, or fixed day-of-month)? And does the 30/360 interest calculation ever change as a result, or is every period always treated as a full 30 days regardless of the actual due dates?
A: The key does not address date-rolling for disbursements on the 29th, 30th or 31st — [default, not policy]: roll to the last calendar day of the target month when the target month is shorter (end-of-month convention). Regardless of what the actual due dates resolve to, the 30/360 convention means every monthly period is always treated as exactly 30 days for interest calculation purposes; the actual calendar gap between due dates does not alter the interest arithmetic.

Q: On the disclosed APR (actual/365 basis): what exactly is the method? Is it the internal rate of return (IRR) of the net cash flows annualised, or another formula? Which cash flows are included (does it include the stub interest and any fees), what is the disbursement/time-zero convention, and to what precision and rounding direction is the disclosed APR figure reported?
A: The key says the APR is 'computed on an actual/365 basis' but does not specify the formula beyond that. [default, not policy]: use the IRR (internal rate of return) of the net cash flows, annualised on actual/365 — specifically, solve for the rate r such that the present value of all scheduled instalments (and the stub charge if any) discounted at r, using actual day counts from disbursement date, equals the disbursement amount. Time-zero is the disbursement date. All cash flows that the borrower pays are included; fees are not addressed by the key so [default, not policy]: exclude fees unless separately specified. Precision and rounding of the disclosed APR figure are not in the key — [default, not policy]: report to four decimal places (e.g. 0.2456 meaning 24.56%), rounded half-up.

Q: On the whole life of the loan: is this engine purely a projection produced once at disbursement, or must it also handle later events, early/partial prepayment, missed or late instalments, early settlement/payoff, cancellation, or restructuring? For each that applies, what recomputes and what happens to the remaining balance and schedule?
A: The key addresses two post-disbursement events explicitly. Early full settlement: unearned interest is rebated by the Rule of 78 (sum-of-the-digits); the settlement amount is the outstanding principal plus any interest due for the current period less the Rule-of-78 rebate on future periods. Partial prepayment (loan continues): the prepayment is applied entirely to reduce principal; the schedule is then re-amortised over the remaining original term (term is fixed, instalment reduces). Missed or late instalments, penalty interest, cancellation, and restructuring are not addressed by the key — [default, not policy]: out of scope for this engine in its current specification; treat as future requirements.

Q: On degenerate and edge inputs: how should the engine behave for a zero (0%) annual interest rate, a single-instalment term (n = 1), a principal that does not divide evenly by n, and any invalid inputs (zero or negative principal, zero or negative term)? For each, is it computed normally, rejected, or handled specially?
A: Zero interest rate (0% p.a.): not in the key — [default, not policy]: compute normally; every period's interest is zero, the instalment equals P/n (subject to rounding), and the schedule closes to zero in the standard way. Single-instalment term (n = 1): not in the key — [default, not policy]: compute normally; one row with the full principal plus one period's interest as the instalment. Principal not evenly divisible by n: handled by the existing rounding rules (key points 7–9); each period's principal portion is rounded to the whole shilling, the final instalment absorbs the accumulated residual so the closing balance is exactly zero — no special case needed. Zero or negative principal, zero or negative term: rejected as invalid with an error (key point 12).

### Round 3
_Step reasoning:_ Two whole-life recomputations (Rule of 78, partial prepayment) and the summary/output shape still hold unresolved policy specifics (rebate base, re-amortisation mechanics, timing, and whether stub interest flows into the totals) that cannot be safely inferred.

Q: On the two summary figures and the stub: does the reported 'total cost of credit' include the stub interest charge, and is the disclosed APR's cash-flow set inclusive of the stub? Separately, should each schedule row ever surface the stub as its own line/field, or is it only ever folded into the first row and the summary totals?
A: The key defines total cost of credit as the sum of all interest charges across the schedule; stub interest is an interest charge, so it is included. The APR cash-flow set likewise includes all amounts the borrower pays, so the stub charge is included there too. The key does not specify a dedicated stub field or row; the prior-round default stands: fold the stub into the first instalment row. No standalone stub line is required by policy.

Q: On the Rule-of-78 early settlement rebate: exactly which interest figure is the sum-of-the-digits computed over, the total scheduled interest across the whole term, or only the interest in the remaining (future) periods? Does the digit count include the stub period, and is the current period's interest treated as fully earned (not rebated) at settlement?
A: The key states the settlement amount is 'outstanding principal plus any interest due for the current period less the Rule-of-78 rebate on future periods.' This confirms two things: current-period interest is fully earned and is not rebated; and the sum-of-the-digits is applied only to the future (remaining, unearned) periods, not to the whole-term scheduled interest. Concretely, if n periods remain after the current one, the digits run from 1 to n and the rebate fraction is applied to the sum of those future periods' scheduled interest. Whether the stub counts as a separate digit in the sequence is not in the key — [default, not policy]: treat the stub as part of period 1; if settlement occurs after period 1 has started, its interest (stub plus regular) is already earned and outside the rebate.

Q: On partial prepayment under the equal-principal method: when the loan is re-amortised over the remaining original term, how is the new per-period figure set, is it the reduced outstanding principal divided by the remaining number of instalments (so the constant principal portion shrinks), with interest still on the opening balance each period? And at the moment of prepayment, is the current period's interest charged first before the payment reduces principal, or is the payment applied to principal immediately?
A: Under the equal-principal method, re-amortisation after a partial prepayment sets the new constant principal portion as the reduced outstanding principal divided by the remaining number of instalments, with interest on the opening balance each period — the same mechanics as the original schedule, just over a smaller principal. The key does not specify the sequencing of interest charge versus principal reduction at the moment of prepayment — [default, not policy]: charge and settle the current period's accrued interest first, then apply the prepayment amount in full to reduce the outstanding principal, then re-amortise the new balance over the remaining original term.

Q: On partial prepayment limits and timing: is there a minimum prepayment amount or any threshold below which it is ignored or treated as a normal payment, and does a prepayment take effect on the date received or only at the next instalment date?
A: Minimum prepayment amount and effective date are not in the key — [default, not policy]: there is no minimum threshold; any positive amount is accepted as a prepayment. The prepayment takes effect on the date received: interest is recalculated to that date, the principal is reduced, and the remaining schedule is re-amortised from that point.

### Round 4
_Step reasoning:_ Most policy is pinned, but three genuinely unasked items remain across the edge-input, output-shape and thresholds/whole-life classes: negative-rate handling, a row sequence identifier, and multiple-prepayment support and limits.

Q: Edge input — a negative annual interest rate: you specified handling for a 0% rate (computed normally) and rejection of zero/negative principal and zero/negative term, but a negative rate was not addressed. Should a negative annual nominal rate be rejected as invalid, or computed normally (producing negative interest that reduces the balance faster than principal)?
A: A negative annual nominal rate is not addressed in the key — [default, not policy]: reject it as invalid with an error, in the same category as zero or negative principal and zero or negative term. A negative rate has no coherent lending interpretation for this product and would produce a schedule where interest offsets principal, which the engine is not designed to handle.

Q: Output shape — each row currently carries due date, opening balance, interest due, principal due, total instalment and closing balance, but no sequence identifier. Must each row also include an instalment/period number, and in what form is the due date represented (e.g. a calendar date value)? If the stub is folded into row 1, does that row still count as instalment number 1?
A: The key does not specify a period/instalment number field or the representation format for due dates — [default, not policy]: include a 1-indexed integer period number in each row, and represent the due date as an ISO 8601 calendar date (YYYY-MM-DD). The stub is folded into row 1, so that row carries period number 1; no stub-specific numbering is needed.

Q: Partial prepayment over the whole life — is more than one partial prepayment supported across the loan's life, with the schedule re-amortised afresh over the remaining original term each time? And is there any cap on the number of prepayments, or any limit on the total amount prepaid short of full settlement, beyond which it is treated as early settlement instead?
A: Multiple partial prepayments are not addressed in the key — [default, not policy]: multiple partial prepayments are supported across the loan's life; the schedule is re-amortised afresh over the remaining original term on each occasion. There is no cap on the number of prepayments. If a prepayment amount equals or exceeds the outstanding principal (plus accrued interest to that date), the engine treats it as early full settlement and applies the Rule-of-78 rebate rather than re-amortising.

### Round 5
_Step reasoning:_ Nearly complete, but the completeness gate requires naming each distinct whole-life event; transfer/novation, suspension/payment holiday, and reversal/correction remain unasked and are distinct from the already-excluded restructuring set, so one final closure round is warranted before declaring done.

Q: To close the whole-life checklist, three lifecycle events remain that are distinct from the missed-payment/penalty/cancellation/restructuring set already ruled out of scope, and I want to confirm each explicitly rather than assume: (a) loan transfer or novation to another borrower or book — does the engine handle it, and if so what recomputes? (b) payment holiday or suspension/deferral of instalments mid-term — in scope, and if so does interest continue to accrue and how is the schedule reshaped? (c) reversal or correction of a previously posted prepayment or settlement (error correction) — must the engine unwind and re-amortise, or is that out of scope? For each, is it in scope with defined behaviour, or out of scope as a future requirement?
A: (a) Loan transfer or novation is not in the key — [default, not policy]: out of scope as a future requirement. The engine produces and re-amortises schedules tied to a single loan entity; transferring obligor or book ownership is an operational event that sits outside the calculation engine. (b) Payment holiday or instalment deferral is not in the key — [default, not policy]: out of scope as a future requirement, in the same category as missed payments and restructuring already ruled out. (c) Reversal or correction of a previously posted prepayment or settlement is not in the key — [default, not policy]: out of scope as a future requirement. Error correction requires audit-trail and posting-reversal logic that is outside the engine's current specification; the engine is a forward-looking projection tool, not a ledger.

### Round 6
_Step reasoning:_ Rounds 4-5 returned only non-policy defaults, suggesting the policy surface is nearly exhausted, but the whole-life checklist still has one named lifecycle event (renewal/extension/top-up) I have not explicitly put to the stakeholder, so I close that gap before concluding.

Q: On the loan's whole life, one lifecycle event remains that I haven't put to you explicitly and that is distinct from the restructuring already ruled out: renewal, extension, or top-up — i.e. extending the term, or disbursing additional principal onto an existing live loan. Is either in scope for this engine, and if so, what recomputes (does a top-up re-amortise the combined principal over a new or remaining term, and does a term extension recompute the constant principal portion P/n over the new n)? Or are renewal, extension and top-up all out of scope as future requirements?
A: Renewal, extension, and top-up are not in the key — [default, not policy]: all three are out of scope as future requirements. The engine is a forward-looking projection tool for a single disbursement; extending the term or adding principal onto a live loan involves origination-level decisions outside the current specification.

### Round 7 (process signalled done)
_Step reasoning:_ Six rounds have put every relevant completeness-gate class to the stakeholder — core method, interest basis, stub, rounding/residual, output shape, APR, edge inputs, and the full whole-life event set; rounds 5-6 returned only out-of-scope defaults, signalling the policy content is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
-- loan-schedule.allium

-- Scope: Repayment schedule engine for a single disbursed loan.
--   Given a disbursed loan (principal, annual nominal rate, term in monthly
--   instalments, disbursement date), produce the full repayment schedule plus
--   two summary figures, and recompute it under two post-disbursement events.
-- Includes:
--   - generate_schedule: the projected repayment schedule at disbursement
--   - Per-instalment rows (field-by-field) and summary figures
--   - Early full settlement (Rule-of-78 rebate)
--   - Partial prepayment (re-amortisation over the remaining original term)
--   - Input validation / edge inputs
-- Excludes (confirmed out of scope — future requirements, not silent omissions):
--   - Missed or late instalments, penalty interest
--   - Cancellation and restructuring
--   - Loan transfer / novation to another borrower or book
--   - Payment holiday / deferral / suspension of instalments
--   - Reversal or correction of a previously posted prepayment or settlement
--   - Renewal, term extension, and top-up (additional disbursement)
--   - Fees (not addressed by policy; excluded from APR and totals until specified)
-- Nature: forward-looking projection engine, NOT a ledger. It does not track
--   posted payments over the life of the loan beyond the two events above.
--
-- Currency: Kenyan shilling (KES), whole shillings only (no cents).
--
-- Defaults applied where policy was silent (flagged to the operator, not invented policy):
--   - Stub interest (if any) is folded into the first instalment row; no standalone
--     stub row or field. (See open question below — the stub *trigger* is unresolved.)
--   - Month-end date rolling: when disbursement falls on the 29th/30th/31st and a
--     target month is shorter, the due date rolls to that month's last calendar day.
--     The 30/360 convention means every monthly period is treated as exactly 30 days
--     for interest regardless of the actual calendar gap between due dates.
--   - Disclosed APR method: internal rate of return (IRR) of the net cash flows,
--     annualised on actual/365, time-zero = disbursement date; includes the stub
--     charge; excludes fees; reported to 4 decimal places, rounded half-up.
--   - Rule-of-78 rebate applies only to future (remaining) periods; the current
--     period's interest is fully earned; the stub is part of period 1.
--   - Partial prepayment: no minimum threshold (any positive amount accepted);
--     takes effect on the date received (interest recalculated to that date);
--     multiple prepayments supported, each re-amortised afresh over the remaining
--     original term; a prepayment >= outstanding (plus accrued interest) is treated
--     as early full settlement.
--   - Edge inputs: 0% rate computes normally; n = 1 computes normally; principal
--     not evenly divisible by n is handled by the standard rounding/residual rules.
--   - Invalid inputs rejected with an error: principal <= 0, term <= 0, rate < 0.

------------------------------------------------------------
-- Value Types
------------------------------------------------------------

-- One row of the returned schedule. The field set is the authoritative output shape.
value InstalmentRow {
    period_number: Integer       -- 1-indexed; the stub (if any) is folded into period 1
    due_date: Timestamp          -- ISO 8601 calendar date (YYYY-MM-DD)
    opening_balance: Decimal     -- KES, whole shillings
    interest_due: Decimal        -- KES; for period 1 includes any stub interest
    principal_due: Decimal       -- KES; constant P/n for all but the final row
    total_instalment: Decimal    -- KES; the payment due this period
    closing_balance: Decimal     -- KES; zero on the final row
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    periods_per_year: Integer = 12        -- monthly instalments; periodic rate = annual / 12
    accrual_days_per_period: Integer = 30 -- 30/360: every month treated as 30 days
    accrual_days_per_year: Integer = 360  -- 30/360 year basis for accrual
    apr_days_per_year: Integer = 365      -- disclosed APR uses actual/365
    apr_decimal_places: Integer = 4       -- disclosed APR reported to 4 dp (half-up)
    rounding_unit_minor: Integer = 1      -- round to the whole shilling (half-up)
}

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

-- A disbursed loan the engine operates on. Disbursement itself is upstream (out of
-- scope). The engine holds the mutable balance only to support re-amortisation and
-- settlement; it is not a payment ledger.
entity Loan {
    principal: Decimal                 -- disbursed principal, KES
    annual_nominal_rate: Decimal       -- annual nominal rate (e.g. 0.24 = 24%)
    term_months: Integer               -- original number of monthly instalments (n)
    disbursement_date: Timestamp       -- ISO 8601 calendar date

    outstanding_principal: Decimal     -- current principal balance (= principal at disbursement)
    is_settled: Boolean                -- true once the loan is fully settled early

    -- Periodic (monthly) rate applied to the opening balance each period, 30/360:
    -- annual_nominal_rate / config.periods_per_year. Computed inside the engine's
    -- black boxes (which receive the annual rate and periods_per_year directly).
    -- First instalment is due exactly one month after disbursement (month-end rolled).
    first_due_date: month_after_eom(disbursement_date, 1)

    schedule: RepaymentSchedule with loan = this
}

-- The returned repayment schedule: ordered rows plus the two summary figures.
entity RepaymentSchedule {
    loan: Loan
    rows: List<InstalmentRow>
    total_cost_of_credit: Decimal   -- sum of all interest charges across the schedule (incl. stub)
    disclosed_apr: Decimal          -- actual/365 IRR of the borrower's cash flows, 4 dp

    -- The running balance must close to exactly zero at the final instalment; the
    -- accumulated rounding residual is absorbed entirely into the final instalment.
    invariant FinalBalanceClosesToZero {
        rows.last.closing_balance = 0
    }

    -- Total cost of credit is, by definition, the sum of every period's interest.
    invariant TotalCostIsSumOfInterest {
        total_cost_of_credit = sum_interest(rows)
    }
}

-- The quote produced when a loan is settled early (or a prepayment clears it).
entity SettlementQuote {
    loan: Loan
    as_of: Timestamp                   -- settlement date (ISO 8601)
    outstanding_principal: Decimal     -- principal still owed
    current_period_interest: Decimal   -- interest due for the current period (fully earned)
    rebate: Decimal                    -- Rule-of-78 rebate on future (unearned) periods
    settlement_amount: Decimal         -- outstanding_principal + current_period_interest - rebate
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

-- Produce the full repayment schedule at disbursement. This is generate_schedule(loan).
rule GenerateSchedule {
    when: GenerateSchedule(loan)

    requires: loan.principal > 0
    requires: loan.term_months > 0
    requires: loan.annual_nominal_rate >= 0
    requires: not exists loan.schedule

    let rows = generate_rows(
        loan.outstanding_principal,
        loan.annual_nominal_rate,
        config.periods_per_year,
        loan.term_months,
        loan.first_due_date,
        loan.disbursement_date,
        config.accrual_days_per_period,
        config.accrual_days_per_year,
        config.rounding_unit_minor
    )

    ensures: RepaymentSchedule.created(
        loan: loan,
        rows: rows,
        total_cost_of_credit: sum_interest(rows),
        disclosed_apr: disclosed_apr(
            loan.disbursement_date,
            loan.outstanding_principal,
            rows,
            config.apr_days_per_year,
            config.apr_decimal_places
        )
    )

    @guidance
        -- Amortisation method: EQUAL PRINCIPAL REPAYMENT (straight-line / declining
        -- payment). Not annuity/French, not interest-only balloon.
        --   * Constant principal portion per period = principal / term_months.
        --   * Interest per period = opening outstanding balance * monthly_rate, where
        --     monthly_rate = annual_nominal_rate / 12 (flat periodic rate, 30/360:
        --     every month is 30 days, the year is 360). Interest is computed once per
        --     monthly period, not via daily accrual. The total instalment therefore
        --     declines over the term.
        -- First period / stub: the first instalment is due exactly one month after
        --   disbursement. Interest accrues from the disbursement date; if extra
        --   pre-period days exist, a stub charge is levied for them pro-rata at the
        --   same periodic rate (stub_days / 30 of a monthly period == annual rate *
        --   stub_days / 360), charged (never capitalised or waived) and folded into
        --   the first row's interest_due.
        -- Rounding: compute and round INTEREST first, half-up to the whole shilling;
        --   round the instalment half-up to the whole shilling; the period's principal
        --   is the remainder (rounded instalment - rounded interest). KES, no cents.
        -- Closing: the final instalment absorbs the entire accumulated rounding
        --   residual so the closing balance is exactly zero.
        -- Edge inputs: rate = 0% -> every period's interest is zero, instalment = P/n
        --   (subject to rounding); term n = 1 -> a single row with full principal plus
        --   one period's interest; principal not divisible by n -> handled by the
        --   rounding/residual rules above. No special cases.
        -- Invalid inputs (principal <= 0, term <= 0, rate < 0) fail the requires
        --   clauses and the action is rejected with an error.
}

-- Early full settlement: unearned interest rebated by the Rule of 78.
rule EarlySettlement {
    when: EarlySettlement(loan, as_of)

    requires: not loan.is_settled
    requires: loan.outstanding_principal > 0

    let current_interest = current_period_interest(loan, as_of)
    let rebate = rule_of_78_rebate(loan, as_of)

    ensures:
        loan.is_settled = true
        SettlementQuote.created(
            loan: loan,
            as_of: as_of,
            outstanding_principal: loan.outstanding_principal,
            current_period_interest: current_interest,
            rebate: rebate,
            settlement_amount: loan.outstanding_principal + current_interest - rebate
        )

    @guidance
        -- Settlement amount = outstanding principal + interest due for the CURRENT
        -- period (fully earned, not rebated) - Rule-of-78 rebate on FUTURE periods.
        -- The sum-of-the-digits is computed over the remaining (future, unearned)
        -- periods only: if k periods remain after the current one, the digits run
        -- 1..k and the rebate fraction is applied to the sum of those future periods'
        -- scheduled interest. The stub is part of period 1; once period 1 has begun
        -- its interest (stub plus regular) is earned and outside the rebate.
}

-- Partial prepayment that leaves the loan live: re-amortise over the remaining term.
rule PartialPrepaymentReamortise {
    when: PartialPrepayment(loan, amount, as_of)

    requires: not loan.is_settled
    requires: amount > 0
    requires: amount < loan.outstanding_principal + current_period_interest(loan, as_of)

    let new_principal = loan.outstanding_principal - amount
    let rows = generate_rows(
        new_principal,
        loan.annual_nominal_rate,
        config.periods_per_year,
        remaining_instalments(loan, as_of),
        next_due_after(loan, as_of),
        as_of,
        config.accrual_days_per_period,
        config.accrual_days_per_year,
        config.rounding_unit_minor
    )

    ensures:
        loan.outstanding_principal = new_principal
        not exists loan.schedule
        RepaymentSchedule.created(
            loan: loan,
            rows: rows,
            total_cost_of_credit: sum_interest(rows),
            disclosed_apr: disclosed_apr(
                as_of,
                new_principal,
                rows,
                config.apr_days_per_year,
                config.apr_decimal_places
            )
        )

    @guidance
        -- Sequencing at the moment of prepayment: charge and settle the current
        -- period's accrued interest first, then apply the prepayment amount in full
        -- to reduce the outstanding principal, then re-amortise.
        -- Re-amortisation keeps the equal-principal mechanics: the new constant
        -- principal portion = reduced outstanding principal / remaining number of
        -- instalments (the term is fixed, the instalment shrinks), with interest on
        -- the opening balance each period. The prepayment takes effect on the date
        -- received. Multiple prepayments are supported, each re-amortised afresh.
}

-- A prepayment that meets or exceeds the payoff amount is treated as early settlement.
rule PartialPrepaymentSettles {
    when: PartialPrepayment(loan, amount, as_of)

    requires: not loan.is_settled
    requires: amount >= loan.outstanding_principal + current_period_interest(loan, as_of)

    let current_interest = current_period_interest(loan, as_of)
    let rebate = rule_of_78_rebate(loan, as_of)

    ensures:
        loan.is_settled = true
        SettlementQuote.created(
            loan: loan,
            as_of: as_of,
            outstanding_principal: loan.outstanding_principal,
            current_period_interest: current_interest,
            rebate: rebate,
            settlement_amount: loan.outstanding_principal + current_interest - rebate
        )

    @guidance
        -- When the prepayment amount >= outstanding principal plus accrued interest
        -- to the date, the engine settles the loan (Rule-of-78 rebate) rather than
        -- re-amortising, identical to EarlySettlement.
}

------------------------------------------------------------
-- Invariants
------------------------------------------------------------

-- The disbursed principal is always positive (invalid loans are rejected before use).
invariant PositivePrincipal {
    for l in Loans:
        l.principal > 0
}

-- Every settlement amount is the payoff identity.
invariant SettlementAmountIdentity {
    for q in SettlementQuotes:
        q.settlement_amount = q.outstanding_principal + q.current_period_interest - q.rebate
}

-- Output shape (what generate_schedule(loan) returns). generate_schedule(loan)
-- corresponds to the GenerateSchedule rule. The result is a RepaymentSchedule:
--   * rows: ordered list of InstalmentRow, each carrying period_number, due_date,
--     opening_balance, interest_due, principal_due, total_instalment, closing_balance.
--   * total_cost_of_credit: sum of all interest charges (including any stub).
--   * disclosed_apr: actual/365 IRR of the borrower's cash flows, 4 dp (half-up).

------------------------------------------------------------
-- Open Questions
------------------------------------------------------------

-- The policy both states the first instalment falls exactly one month after
-- disbursement (so period 1 spans a whole month) AND that a stub charge applies for
-- days before the "first period start". The trigger for a stub, and the definition
-- of "first period start" when it differs from the disbursement date, is unresolved.
-- Default applied: fold any stub interest into the first instalment row.
open question "When exactly does a stub period arise, and what is the 'first period start' relative to the disbursement date?"


## Auditor verdict

_The spec resolves 13 of 14 decisions to the reference values, including the bespoke off-default choices (equal-principal amortisation, 30/360, per-period interest, charged stub, interest-first rounding with remainder principal, Rule-of-78 rebate, term-fixed re-amortisation, and the 30/360-accrual/actual-365-disclosure split). The only miss is #6: currency KES is correct but the spec adopts whole-shilling (0 dp) precision throughout rather than the reference's 2 decimal places, so the precision value does not match. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | @guidance GenerateSchedule: "Interest per period = opening outstanding balance * monthly_rate" | Interest charged on the reducing opening balance each period is declining balance on the reducing principal, matching the reference. |
| 2 | yes | **yes** | @guidance: "Amortisation method: EQUAL PRINCIPAL REPAYMENT... Constant principal portion per period = principal / term_months... The total instalment therefore declines over the term." | Explicitly equal-principal (P/n constant, interest on reducing balance, declining instalment), and explicitly not annuity/EMI, exactly as the reference requires. |
| 3 | yes | **yes** | config: accrual_days_per_period=30, accrual_days_per_year=360; @guidance: "30/360: every month is 30 days, the year is 360" | 30/360 convention stated unambiguously, matching the reference. |
| 4 | yes | **yes** | @guidance: "Interest is computed once per monthly period, not via daily accrual." | Interest calculation period equals the repayment period rather than daily accrual, matching the reference. |
| 5 | yes | **yes** | @guidance: "Interest accrues from the disbursement date; if extra pre-period days exist, a stub charge is levied for them pro-rata... charged (never capitalised or waived) and folded into the first row's interest_due." | Accrual from disbursement plus a charged partial-period stub matches the reference; the open question only concerns the precise trigger, not the resolved policy. |
| 6 | yes | no | Header: "Currency: Kenyan shilling (KES), whole shillings only (no cents)." InstalmentRow fields: "KES, whole shillings" | Currency KES is correct, but the reference sets base amount precision at 2 decimal places; the spec instead states whole shillings/no cents everywhere (0 dp), so the precision value does not match. |
| 7 | yes | **yes** | @guidance: "round the instalment half-up to the whole shilling... the final instalment absorbs the entire accumulated rounding residual so the closing balance is exactly zero." | Each instalment rounded to whole shilling with the accumulated residual settled in the final instalment, matching the reference. |
| 8 | yes | **yes** | @guidance: "compute and round INTEREST first, half-up to the whole shilling... the period's principal is the remainder (rounded instalment - rounded interest)." | Interest computed and rounded first with principal as the remainder, matching the reference ordering. |
| 9 | yes | **yes** | invariant FinalBalanceClosesToZero { rows.last.closing_balance = 0 } | Final instalment reconciles to an exactly-zero closing balance, matching the reference. |
| 10 | yes | **yes** | rule EarlySettlement: "unearned interest rebated by the Rule of 78"; let rebate = rule_of_78_rebate(...) | Early payoff rebates unearned interest by the Rule of 78 (sum-of-digits), matching the reference. |
| 11 | yes | **yes** | @guidance PartialPrepaymentReamortise: "apply the prepayment amount in full to reduce the outstanding principal, then re-amortise... the term is fixed, the instalment shrinks." | Prepayment applied wholly to principal then re-amortised over the fixed remaining term with a reduced instalment, matching the reference. |
| 12 | yes | **yes** | "Invalid inputs rejected with an error: principal <= 0, term <= 0, rate < 0." plus requires clauses in GenerateSchedule | Zero/negative principal and zero/negative term are rejected as invalid, matching the reference. |
| 13 | yes | **yes** | entity Loan: first_due_date = month_after_eom(disbursement_date, 1); @guidance: "first instalment is due exactly one month after disbursement" | First due date is disbursement plus one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | **yes** | InstalmentRow fields (due_date, opening_balance, interest_due, principal_due, total_instalment, closing_balance); total_cost_of_credit = sum_interest(rows); disclosed_apr "actual/365" while accrual uses 30/360 | Full per-period schedule, total cost of credit as sum of interest, and disclosed APR on actual/365 despite 30/360 accrual all match the reference, including the dual day-count disclosure quirk. |

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
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-HHWNQS/spec.allium",
        "line": 136
      },
      "message": "Rule 'GenerateSchedule' listens for trigger 'GenerateSchedule' but no local surface provides or rule emits it.",
      "severity": "info"
    },
    {
      "code": "allium.rule.unreachableTrigger",
      "location
```
