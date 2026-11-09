# allium-elicit — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 23 · Captured: 13/14 · Bespoke captured: 6/6

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material policy (amortisation method, day-count/accrual, rounding and residue, first-payment timing, output shape, edge cases), none reliably inferable, so I elicit these before writing any spec.

Q: What amortisation method should the schedule use: equal total instalments (annuity/fixed payment), equal principal with declining interest, interest-only with a final balloon, or something else your institution has standardised on?
A: Equal principal: a constant principal slice of P/n each period, with interest charged on the declining outstanding balance. The total instalment therefore decreases each period. Not an annuity/fixed-payment (EMI) method.

Q: How is the periodic interest computed from the annual nominal rate: simple division by 12, or a day-count convention (e.g. 30/360, actual/365, actual/actual)? If day-count, which one, and does interest accrue on the outstanding balance each period?
A: 30/360 day-count: every month counts as 30 days, the year as 360. Interest is computed once per monthly repayment period on the opening outstanding balance — not daily accrual.

Q: What are the rounding rules: to what precision (e.g. whole cents) is each instalment's interest and principal rounded, which direction (round half up, half even, truncate), and where does any accumulated rounding residue land (absorbed into the final instalment, the first, or spread)?
A: Each instalment is rounded to the whole shilling (no cents). Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment after subtracting that rounded interest. Any accumulated rounding residue is settled in the final instalment.

Q: How is timing handled: when is the first instalment due relative to the disbursement date, and is interest accrued for any partial period between disbursement and the first scheduled payment (a broken/stub period), or does the schedule assume clean monthly periods?
A: First instalment due = disbursement date plus one month; subsequent instalments monthly thereafter. Interest accrues from the disbursement date. If disbursement falls before the first scheduled period start, a stub (partial-period) interest charge is levied for those extra days — partial-period interest is allowed and charged.

Q: What exactly must the schedule return, field by field, for each instalment (e.g. instalment number, due date, opening balance, interest due, principal due, total payment, closing/running balance) and any schedule-level totals, and are any reported figures expressed on a different basis than they are computed?
A: Per-period fields: due date, opening balance, interest, principal, instalment, closing balance. Schedule-level totals: total cost of credit (sum of all interest charges). Also disclose the APR, computed on an actual/365 basis — even though all accrual uses 30/360.

Q: How should degenerate and edge inputs be handled: zero or negative principal, a zero interest rate, a one-instalment term, and ensuring the final running balance closes exactly to zero?
A: Zero or negative principal or term: rejected as invalid with an error. Final instalment: reconciled so the closing balance is exactly zero. Zero interest rate and one-instalment term are not covered by policy [default, not policy]: a zero rate yields equal principal-only payments with zero interest rows; a one-instalment term returns a single row repaying full principal plus any stub interest.

### Round 2
_Step reasoning:_ Rounding direction was never actually answered, the stub mechanics and output placement are ambiguous, APR precision/fee-inclusion is unpinned, and whole-of-life events remain an unasked class.

Q: Rounding direction was left open: when interest is rounded to the whole shilling each period, which way does it go — round half up, round half to even, or truncate toward zero? The same question applies to the APR and the total cost of credit.
A: Rounding direction is not specified in policy [default, not policy]: round half up (round-half-away-from-zero) for each period's interest charge. The same convention applies to the APR and total cost of credit.

Q: On the stub period: given the first instalment is due disbursement date plus one month, in which cases does a stub actually arise, how are the stub days counted under 30/360 (e.g. disbursement on the 31st, or month-end conventions), and where does the stub interest appear in the output — a separate period-zero row, folded into the first instalment's interest, or a distinct charge?
A: A stub arises whenever the disbursement date does not coincide with the start of the first full monthly period — in practice, any disbursement date other than the first day of the period. Under 30/360, stub days are counted by treating each month as 30 days: if the disbursement day is 31 it is treated as 30, and the first period start is day 1 of the following month (also treated as 30 if needed), consistent with US 30/360 end-of-month conventions [default, not policy for the specific convention]. Where the stub appears in output is not specified by policy [default, not policy]: it is levied as a separate period-zero row prior to the first regular instalment, with its own due date, interest charge equal to the stub interest, zero principal, and an opening/closing balance that carries into period 1.

Q: For the disclosed APR on an actual/365 basis: to what precision is it expressed, and does it incorporate any fees or charges (arrangement, disbursement) or only the interest cash flows? Does the total cost of credit likewise exclude fees?
A: APR precision and fee inclusion are not specified by policy [default, not policy]: the APR is expressed to two decimal places (e.g. 24.50 %). It is computed solely from the contractual interest cash flows on an actual/365 basis; arrangement or disbursement fees are not incorporated unless separately instructed. The total cost of credit likewise covers only the sum of interest charges and excludes any fees.

Q: Beyond generating the schedule at disbursement, must the engine handle events over the loan's life — early/partial prepayment or full early settlement, missed or late payments and arrears, restructuring or rate changes mid-term — by recomputing the schedule, or is it a one-shot projection and those events are out of scope?
A: Early full settlement is in scope: unearned interest is rebated by the Rule of 78. Partial prepayment is in scope: the prepayment reduces principal, then the schedule is re-amortised with the term held fixed so the instalment decreases. Missed or late payments, arrears handling, and mid-term restructuring or rate changes are not covered by policy [default, not policy]: the engine is a one-shot projection at disbursement (or at the point of a prepayment event); arrears and rate changes are out of scope.

### Round 3
_Step reasoning:_ Round 1-2 pinned the core method; the newly-opened lifecycle events (Rule of 78 settlement, partial prepayment) and the APR cash-flow definition still hide material, non-inferable policy, so I continue before closing.

Q: Early settlement by the Rule of 78: over how many instalments is the sum-of-the-digits computed (does any stub period count as an instalment in that sum), and does the rebate apply only to the regular periodic interest or also to any stub interest already charged? What figure is actually disclosed to the customer as the settlement amount: outstanding principal plus earned (non-rebated) interest, or something else?
A: The sum-of-digits is computed over the number of regular scheduled instalments (n), not including any stub period. Whether the stub counts as an instalment in that sum is not covered by policy [default, not policy]: the stub is excluded from the digit sequence. The rebate applies only to unearned regular periodic interest; stub interest already charged at disbursement is not rebated, as it was earned at that point [default, not policy]. The settlement amount disclosed to the customer is the outstanding principal balance plus the earned (non-rebated) portion of interest for the remaining periods — i.e. total interest originally scheduled minus the Rule of 78 rebate, with the rebate reducing the amount owed [default, not policy].

Q: Partial prepayment timing and application: must a prepayment land exactly on an instalment due date, or can it occur mid-period, and if mid-period is 30/360 interest accrued to the prepayment date and settled before the payment is applied to principal? Is the payment applied to principal only (interest first), and is there any minimum prepayment amount or threshold below which it is ignored or held?
A: Prepayment timing and minimum thresholds are not covered by policy [default, not policy]. Reasonable defaults: a prepayment may occur on any date, not only on an instalment due date. If mid-period, 30/360 interest accrues from the last instalment date to the prepayment date and is settled first; the remainder of the payment is then applied entirely to principal, consistent with the policy that prepayment reduces principal. The re-amortisation then proceeds from the new lower balance over the remaining term. There is no minimum prepayment amount or threshold specified; any positive amount is accepted.

Q: APR cash-flow construction: on the actual/365 basis, which cash flows enter the solve and at which dates: the disbursed principal as the initial outflow on the disbursement date, each instalment (interest + principal) at its actual calendar due date, and the separate stub interest at its own date? And when disbursement or a due date falls on a month-end (e.g. disbursed on the 31st, or a February due date), how is the actual calendar due date set for both the schedule and the APR day-counts?
A: The cash flows entering the APR solve are: the disbursed principal as the initial inflow to the borrower on the actual disbursement date, then each instalment (interest plus principal for that period) as an outflow at its actual calendar due date, and the stub interest charge (if any) as a separate outflow at the stub due date — all consistent with the output schedule. How actual calendar due dates are determined when disbursement or a scheduled date falls on a month-end (e.g. the 31st, or February shortfall) is not covered by policy [default, not policy]: dates are rolled to the last calendar day of the relevant month if the calculated date does not exist (e.g. 31 March plus one month becomes 30 April), and that rolled calendar date is used for both the schedule due date and the actual/365 day-count in the APR computation.

### Round 4
_Step reasoning:_ Three rounds have pinned method, day-count, rounding, timing/stub, edge inputs, output shape, and whole-life events, but the APR's annualisation convention (effective vs nominal) is a material, non-inferable choice that changes the disclosed figure and remains unasked.

Q: For the disclosed APR on an actual/365 basis: how is the solved rate annualised and expressed? Specifically, is the APR the effective annual rate implied by discounting the dated cash flows (an XIRR-style solve where the actual/365 day-counts yield an effective annualised figure), or a nominal annualised rate (e.g. a periodic rate multiplied up by the number of periods)? And does the stub interest charge count toward the disclosed total cost of credit, or is that total only the sum of the regular periodic interest?
A: APR annualisation method is not covered by policy [default, not policy]: use an XIRR-style solve — discount all dated cash flows (disbursement as inflow, each scheduled payment including any stub as outflow, at their actual calendar dates) and solve for the rate r such that NPV = 0, where each cash flow is discounted by (1 + r)^(days/365). The result is an effective annual rate, not a nominal rate multiplied by the number of periods.

### Round 5
_Step reasoning:_ One directly-asked question (stub interest in total cost of credit) went unanswered, and the re-amortisation mechanics after prepayment remain underspecified; both are material output/whole-life decisions, so elicitation is not complete.

Q: The total cost of credit figure: does it include the stub-period interest charge, or is it only the sum of the regular periodic interest? (This was asked last round but the reply only addressed APR annualisation and left it open.) Relatedly, is the disclosed total cost of credit a fixed disbursement-time projection, or is it restated after a partial prepayment or early settlement to reflect interest actually charged?
A: The stub-period interest charge is included in the total cost of credit; it is an interest charge and the total is the sum of all interest charges across all periods, including any stub row. Whether the disclosed total is restated after a partial prepayment or early settlement is not covered by policy [default, not policy]: at disbursement it is a projection; after a partial prepayment the total cost of credit is recomputed as the sum of interest actually charged to date plus the interest in the re-amortised forward schedule; after an early full settlement it reflects interest actually charged plus the earned (non-rebated) portion, with the Rule of 78 rebate reducing the total.

Q: On re-amortisation after a partial prepayment with the term held fixed: how is the constant principal slice recomputed — new outstanding balance divided by the number of remaining regular instalments — and do the same rounding rules apply (interest rounded first, principal as the remainder, accumulated residue settled in the final instalment)? Do the re-amortised instalments stay on the original monthly due-date cycle, and can more than one partial prepayment occur over the loan's life?
A: Re-amortisation after a partial prepayment uses the new outstanding principal balance divided by the number of remaining regular instalments as the new constant principal slice. The same rounding rules apply: interest is computed and rounded first each period, principal is the remainder of the rounded instalment, and accumulated rounding residue settles in the final instalment. The re-amortised instalments remain on the original monthly due-date cycle. Whether more than one partial prepayment can occur over the loan's life is not covered by policy [default, not policy]: multiple prepayments are permitted, each triggering the same re-amortisation logic from the new outstanding balance over the remaining term at that point.

### Round 6
_Step reasoning:_ Core method, timing, rounding, APR and life-cycle events are pinned, but the precision/basis of three disclosed or derived figures (Rule of 78 rebate, settlement amount, post-event APR, and stub/mid-period interest rounding) remain unpinned and are genuine policy choices.

Q: Rounding of disclosed settlement and rebate figures: the per-instalment rounding rule (whole shilling, half up, interest-first, residue to final instalment) was pinned, but the early-settlement outputs were not. To what precision and in which direction are (a) the Rule of 78 rebate and (b) the disclosed settlement amount rounded, and if rounding the rebate leaves the settlement off principal-plus-earned-interest by a shilling, where does that residue land?
A: Rounding of the Rule of 78 rebate and the settlement amount is not covered by policy [default, not policy]. Applying the established whole-shilling, round-half-up convention: (a) the Rule of 78 rebate is rounded to the whole shilling, half up. (b) The disclosed settlement amount — outstanding principal plus earned (non-rebated) interest — is independently rounded to the whole shilling, half up. If rounding the rebate produces a settlement figure that differs from principal-plus-earned-interest by a shilling, the settlement amount as rounded is the authoritative figure presented to the customer; no secondary residue adjustment is made.

Q: After a partial prepayment or an early full settlement, is a new APR disclosed/restated on the actual-calendar re-amortised (or settled) cash flows, or does the APR disclosed at disbursement stand unchanged for the life of the loan?
A: Whether a restated APR is disclosed after a partial prepayment or early full settlement is not covered by policy [default, not policy]. The APR disclosed at disbursement stands unchanged for the life of the loan; no new APR is computed or issued at the point of a prepayment or settlement event.

Q: Is the stub-period interest charge subject to the same rounding as regular periods (whole shilling, round half up), and when a partial prepayment occurs mid-period, is the 30/360 accrued interest settled at prepayment also rounded to the whole shilling on the same basis?
A: Whether stub-period and mid-period prepayment interest charges are subject to the same rounding rule is not covered by policy [default, not policy]. Applying the established convention consistently: stub-period interest is rounded to the whole shilling, half up, in the same way as a regular period's interest charge. When a partial prepayment occurs mid-period, the 30/360 accrued interest from the last instalment date to the prepayment date is likewise rounded to the whole shilling, half up, before the remainder of the payment is applied to principal.

### Round 7
_Step reasoning:_ The pinned rounding rule contradicts the equal-principal method and the on-due-date prepayment/settlement ordering is a genuine sequencing gap; both are institution-specific and cannot be safely inferred.

Q: The equal-principal rounding mechanic needs reconciling. You specified 'interest is computed and rounded first; principal is the remainder of the rounded instalment after subtracting that rounded interest.' But under equal principal the principal slice (P/n) is the fixed quantity and interest is the variable one, so 'principal as the remainder' reads like an annuity mechanic. Which is authoritative each period: (a) the principal slice is round(P/n) to the whole shilling and the instalment = that rounded principal + rounded interest; or (b) the instalment is computed and rounded first and principal = instalment − rounded interest? And in case (a), what exactly carries the accumulated residue into the final instalment — a principal adjustment, so the final principal slice differs from P/n?
A: Per item 8 of the answer key, (b) is authoritative: interest is computed and rounded first each period; the instalment is then the rounded interest plus the nominal principal slice (P/n), and that total is itself rounded to the whole shilling; principal for the period is the rounded instalment minus the rounded interest. The principal slice is therefore not independently rounded to P/n — it absorbs any intra-period rounding difference. Accumulated residue across all periods lands in the final instalment's principal component, so the final principal slice may differ from P/n by the total accumulated rounding difference, ensuring the closing balance is exactly zero.

Q: When a partial prepayment or a full early settlement lands exactly on a scheduled instalment due date, what is the ordering: is that period's regular instalment (interest + principal slice) taken first and then the prepayment/settlement applied to the resulting balance, or is the prepayment/settlement applied first and the scheduled instalment skipped or recomputed?
A: Ordering when a prepayment or full early settlement falls exactly on a scheduled due date is not covered by policy [default, not policy]. The regular instalment for that period is processed first — interest on the opening balance is computed and rounded, the scheduled principal slice is applied, and the period closes — then the prepayment or settlement amount is applied to the resulting post-instalment balance. The prepayment or settlement is not applied before the scheduled instalment, and the scheduled instalment is not skipped or recomputed.

### Round 8
_Step reasoning:_ Nearly everything is pinned, but early-settlement mid-period accrual and the Rule-of-78 base after prior prepayments remain genuine unasked policy decisions; this is the last round to close them.

Q: Early full settlement timing and basis: can a full early settlement occur mid-period as well as on a due date, and if mid-period is 30/360 interest accrued (and rounded, half up) from the last instalment date to the settlement date and added to the settlement figure, in the same way as a partial prepayment? And is the Rule of 78 rebate computed from the original disbursement-time schedule, or — if one or more partial prepayments have already occurred — from the most recent re-amortised schedule (its remaining term and its remaining scheduled interest)?
A: Early full settlement mid-period and the Rule of 78 basis are not covered by policy [default, not policy]. By analogy with the established partial-prepayment treatment: a full early settlement may occur on any date, not only on a scheduled due date. If mid-period, 30/360 interest accrues from the last instalment date to the settlement date, is rounded to the whole shilling half up, and is added to the settlement figure before the Rule of 78 rebate is applied to the remaining unearned interest — in the same manner as a mid-period partial prepayment. Where one or more partial prepayments have already occurred, the Rule of 78 rebate is computed from the most recent re-amortised schedule in force at the point of settlement (its remaining term and its remaining scheduled interest), not from the original disbursement-time schedule.

Q: When an early full settlement follows one or more partial prepayments, what is the digit base (n) and the total-scheduled-interest base for the Rule of 78 rebate: the original n and original total interest, or the remaining regular instalments and remaining scheduled interest of the current re-amortised schedule at the point of settlement?
A: Not covered by policy [default, not policy]. The digit base n is the number of remaining regular instalments in the current re-amortised schedule at the point of settlement, and the total-scheduled-interest base is the sum of the interest charges across those remaining periods in that same re-amortised schedule. The original n and original total interest are not used once a re-amortisation has occurred.

## Produced specification

-- allium: 3
-- loan-schedule.allium

-- Scope: Repayment schedule engine for a monthly-instalment loan product.
--   Given a disbursed loan (principal, annual nominal interest rate, term in
--   monthly instalments, disbursement date), produce the full repayment
--   schedule and the disclosed figures, and recompute it on the two in-scope
--   life events (partial prepayment, early full settlement).
-- Includes:
--   - Schedule generation at disbursement (the generate_schedule(loan) function)
--   - Equal-principal amortisation with 30/360 interest on the opening balance
--   - Whole-shilling rounding with residue reconciliation to the final instalment
--   - A stub (partial-period) interest charge when disbursement is off-cycle
--   - Disclosed total cost of credit and disclosed APR (actual/365, XIRR)
--   - Partial prepayment (re-amortise, term fixed) and early full settlement
--     (Rule of 78 rebate)
-- Excludes (confirmed out of scope by the operator, not silent omissions):
--   - Missed or late payments and arrears handling
--   - Mid-term restructuring and interest-rate changes
--   - Arrangement, disbursement or any other fees (interest cash flows only);
--     neither the APR nor the total cost of credit incorporates fees unless
--     separately instructed
-- Units: all amounts are whole shillings (no cents / minor units). Every figure
--   reduced to a shilling is rounded half up (round half away from zero).
-- Day-count: 30/360 for all accrual (every month = 30 days, year = 360 days);
--   actual/365 is used ONLY for the disclosed APR.

------------------------------------------------------------
-- Value Types
------------------------------------------------------------

-- One line of the repayment schedule. Period 0 is the stub row (when present);
-- periods 1..n are the regular equal-principal instalments. `instalment` is the
-- total payment for the period (interest + principal) as disclosed.
value ScheduleRow {
    period_number: Integer          -- 0 = stub, 1..n = regular instalments
    is_stub: Boolean
    due_date: Timestamp
    opening_balance: Decimal
    interest: Decimal               -- rounded to the whole shilling, half up
    principal: Decimal              -- rounded instalment minus rounded interest
    instalment: Decimal             -- total payment = interest + principal
    closing_balance: Decimal        -- opening_balance - principal
}

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

-- A disbursed loan. Its contractual terms are immutable for the life of the
-- loan; prepayments reduce the outstanding balance tracked on the current
-- RepaymentSchedule, not the Loan's principal field.
entity Loan {
    principal: Decimal              -- P, the disbursed amount
    annual_nominal_rate: Decimal    -- annual nominal rate, e.g. 0.24 for 24 %
    term_months: Integer            -- n, number of regular monthly instalments
    disbursement_date: Timestamp

    status: active | settled | completed

    transitions status {
        active -> settled           -- early full settlement
        active -> completed         -- ran to the end of term
        terminal: settled, completed
    }

    -- 30/360 periodic rate: one month's interest factor on the opening balance.
    -- Equivalent to annual_nominal_rate * 30 / 360.
    monthly_periodic_rate: annual_nominal_rate / 12

    -- Nominal equal-principal slice P/n (before any rounding). The actual
    -- principal component of each row is derived from the rounded instalment;
    -- see GenerateSchedule guidance for the authoritative rounding mechanic.
    nominal_principal_slice: principal / term_months

    -- Stub (partial-period) interest. A stub arises whenever the disbursement
    -- date is not the first day of the first full monthly period (i.e. any date
    -- other than the period start). Days are counted under 30/360 (day 31 is
    -- treated as 30; US 30/360 end-of-month conventions). Rounded half up to the
    -- whole shilling, the same as a regular period's interest charge. Zero when
    -- there is no stub (stub_days = 0).
    stub_days: stub_day_count_30_360(disbursement_date)
    stub_interest: round_shilling(principal * annual_nominal_rate * stub_days / 360)

    -- First regular instalment is due disbursement date + one month; subsequent
    -- instalments monthly thereafter. The final regular instalment falls at
    -- disbursement date + term_months. Non-existent calendar dates roll to the
    -- last day of the month (e.g. 31 Mar + 1 month -> 30 Apr).
    first_due_date: add_one_month(disbursement_date)
    final_due_date: add_months(disbursement_date, term_months)

    -- Disclosed APR: actual/365, XIRR-style effective annual rate, two decimal
    -- places, round half up. A pure function of the loan's contractual interest
    -- cash flows, so it is fixed at disbursement and is NOT restated after any
    -- partial prepayment or early settlement (see ApplyPrepayment / SettleEarly).
    disclosed_apr: solve_apr_actual_365(this)

    invariant PositivePrincipalAndTerm {
        -- Zero or negative principal, or zero or negative term, is rejected as
        -- invalid with an error; a valid Loan always satisfies this.
        principal > 0 and term_months > 0
    }
}

-- The repayment schedule currently in force for a loan. A fresh one is produced
-- at disbursement and again after each partial prepayment (re-amortised).
entity RepaymentSchedule {
    loan: Loan
    rows: List<ScheduleRow>         -- ordered: stub row (if any), then 1..n
    is_re_amortised: Boolean        -- false at disbursement, true after prepayment
    disclosed_apr: Decimal          -- copied from the loan; never restated

    -- Total cost of credit: the sum of ALL interest charges across every row,
    -- INCLUDING any stub row. At disbursement this is a projection; after a
    -- partial prepayment it is interest actually charged to date plus the
    -- interest in the re-amortised forward schedule; after early settlement it
    -- reflects interest actually charged plus the earned (non-rebated) portion.
    total_cost_of_credit: Decimal

    invariant ClosesToZero {
        -- The final instalment is reconciled so the running balance closes
        -- exactly to zero; accumulated rounding residue lands in the final
        -- instalment's principal component.
        rows.last.closing_balance = 0.0
    }
}

-- A partial prepayment, recorded by the operator. Its engine-computed figures
-- are derived; re-amortisation is driven by ApplyPrepayment.
entity PartialPrepayment {
    loan: Loan
    amount: Decimal                 -- any positive amount; no minimum threshold
    paid_on: Timestamp              -- any date, on or between instalment due dates

    -- Mid-period 30/360 interest from the last instalment date to paid_on,
    -- rounded half up to the whole shilling, settled FIRST.
    accrued_interest_settled: round_shilling(accrued_interest_30_360(loan, paid_on))

    -- The remainder of the payment is applied entirely to principal.
    principal_reduction: amount - accrued_interest_settled
}

-- An early full settlement, recorded by the operator. Its disclosed figures are
-- derived; SettleEarly terminates the loan.
entity EarlySettlement {
    loan: Loan
    settled_on: Timestamp           -- any date, on or between instalment due dates

    -- Mid-period 30/360 interest from the last instalment date to settled_on,
    -- rounded half up to the whole shilling (zero when settled on a due date),
    -- added to the settlement figure before the Rule of 78 rebate is applied.
    accrued_interest: round_shilling(accrued_interest_30_360(loan, settled_on))

    -- Rule of 78 rebate of unearned REGULAR interest, rounded half up to the
    -- whole shilling. Computed over the schedule in force at settlement (the
    -- most recent re-amortised schedule if prepayments have occurred): digit
    -- base n = remaining regular instalments, sum-of-digits = n*(n+1)/2, total
    -- base = sum of interest over those remaining periods. The stub period is
    -- excluded from the digit sequence and stub interest is never rebated.
    rule_of_78_rebate: round_shilling(rule_of_78_rebate_amount(loan, settled_on))

    -- Earned (non-rebated) interest for the remaining periods.
    earned_interest: remaining_scheduled_interest_amount(loan, settled_on) - rule_of_78_rebate

    -- Disclosed settlement amount = outstanding principal + earned interest +
    -- mid-period accrued interest, independently rounded half up to the whole
    -- shilling. If this differs from principal-plus-earned-interest by a
    -- shilling, this rounded figure is authoritative; no secondary adjustment.
    settlement_amount:
        round_shilling(outstanding_principal_amount(loan, settled_on) + earned_interest + accrued_interest)
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

rule GenerateSchedule {
    when: loan: Loan.created
    requires: loan.principal > 0
    requires: loan.term_months > 0

    let rows = amortise(
        loan,
        loan.monthly_periodic_rate,
        loan.nominal_principal_slice,
        loan.stub_interest,
        loan.first_due_date
    )

    ensures:
        loan.status = active
        RepaymentSchedule.created(
            loan: loan,
            rows: rows,
            is_re_amortised: false,
            disclosed_apr: loan.disclosed_apr,
            total_cost_of_credit: sum_interest(rows)
        )

    @guidance
        -- AMORTISATION METHOD: equal principal (constant-amortisation), NOT an
        -- annuity / fixed-payment (EMI) method. A constant principal slice P/n is
        -- repaid each regular period, interest is charged on the declining
        -- opening balance, so the total instalment decreases period to period.
        --
        -- 30/360 INTEREST: each regular period's interest is charged once, on the
        -- opening outstanding balance, as opening_balance * monthly_periodic_rate
        -- where monthly_periodic_rate = annual_nominal_rate / 12. No daily accrual.
        --
        -- ROUNDING MECHANIC (authoritative; round-half-up to the whole shilling),
        -- for each regular period k:
        --   1. interest_k   = round_shilling(opening_balance_k * monthly_periodic_rate)
        --   2. instalment_k = round_shilling(interest_k + nominal_principal_slice)   (P/n)
        --   3. principal_k  = instalment_k - interest_k
        --   4. closing_balance_k = opening_balance_k - principal_k
        -- Interest is computed and rounded FIRST; the principal slice is NOT
        -- independently rounded to P/n -- it absorbs the intra-period rounding
        -- difference. Accumulated residue across all periods lands in the FINAL
        -- instalment's principal component, so the final principal slice may
        -- differ from P/n and the closing balance is exactly zero.
        --
        -- STUB ROW: when loan.stub_days > 0, amortise prepends a period-0 row:
        -- due date = disbursement date, interest = loan.stub_interest, principal
        -- = 0, and an opening/closing balance equal to the full principal that
        -- carries unchanged into period 1. Interest accrues from the disbursement
        -- date; the first regular instalment is due disbursement date + one month.
        --
        -- PER-ROW OUTPUT FIELDS: due_date, opening_balance, interest, principal,
        -- instalment (total payment), closing_balance.
        --
        -- SCHEDULE-LEVEL OUTPUTS: total_cost_of_credit = sum of every interest
        -- charge across all rows, INCLUDING the stub row; and disclosed_apr,
        -- computed on an actual/365 basis.
        --
        -- APR CASH FLOWS (solve_apr_actual_365): initial inflow to the borrower of
        -- the disbursed principal on the disbursement date; each instalment
        -- (interest + principal) as an outflow at its actual rolled calendar due
        -- date; the stub interest (if any) as a separate outflow at the stub due
        -- date. Solve for r such that NPV = 0, each flow discounted by
        -- (1 + r)^(days/365); r is an effective annual rate (XIRR-style), not a
        -- nominal periodic rate scaled up. Only contractual interest cash flows
        -- enter; no fees. Expressed to two decimal places, round half up.
        --
        -- DEGENERATE INPUTS (defaults, not operator policy):
        --   - Zero or negative principal or term: rejected as invalid (see the
        --     PositivePrincipalAndTerm invariant); no schedule is produced.
        --   - Zero interest rate: equal principal-only payments of P/n, all
        --     interest rows zero.
        --   - One-instalment term (n = 1): a single regular row repaying the full
        --     principal, plus a stub row if disbursement is off-cycle.
}

rule ApplyPrepayment {
    when: prepayment: PartialPrepayment.created
    requires: prepayment.loan.status = active
    requires: prepayment.amount > 0

    let loan = prepayment.loan
    let new_rows = re_amortise(loan, prepayment.paid_on, prepayment.principal_reduction)

    ensures:
        RepaymentSchedule.created(
            loan: loan,
            rows: new_rows,
            is_re_amortised: true,
            disclosed_apr: loan.disclosed_apr,
            total_cost_of_credit:
                interest_charged_to_date(loan, prepayment.paid_on) + sum_interest(new_rows)
        )

    @guidance
        -- A prepayment may land on any date, on or between instalment due dates;
        -- no minimum threshold, any positive amount is accepted. If mid-period,
        -- 30/360 interest accrues from the last instalment date to paid_on,
        -- rounded half up to the whole shilling, and is settled FIRST
        -- (prepayment.accrued_interest_settled); the remainder
        -- (prepayment.principal_reduction) is applied entirely to principal.
        --
        -- RE-AMORTISATION (term held fixed): the new constant principal slice is
        -- the new outstanding principal balance divided by the number of
        -- remaining regular instalments. The same rounding rules apply (interest
        -- computed and rounded first, principal the remainder of the rounded
        -- instalment, accumulated residue settled in the final instalment). The
        -- re-amortised instalments stay on the original monthly due-date cycle and
        -- the total instalment decreases.
        --
        -- ORDERING ON A DUE DATE (default): if the prepayment falls exactly on a
        -- scheduled due date, that period's regular instalment is processed first
        -- (interest on the opening balance, scheduled principal slice, period
        -- closes), then the prepayment is applied to the resulting post-instalment
        -- balance. The scheduled instalment is not skipped or recomputed.
        --
        -- MULTIPLE PREPAYMENTS are permitted; each triggers the same
        -- re-amortisation from the then-current outstanding balance over the
        -- remaining term. The disclosed APR is not restated.
}

rule SettleEarly {
    when: settlement: EarlySettlement.created
    requires: settlement.loan.status = active

    let loan = settlement.loan

    ensures:
        loan.status = settled
        CustomerSettlementQuoted(
            loan: loan,
            settled_on: settlement.settled_on,
            settlement_amount: settlement.settlement_amount
        )

    @guidance
        -- Early full settlement may occur on any date. If mid-period, 30/360
        -- interest accrues from the last instalment date to settled_on, rounded
        -- half up to the whole shilling (settlement.accrued_interest), and is
        -- added to the settlement figure before the Rule of 78 rebate is applied.
        --
        -- RULE OF 78 REBATE of unearned interest (settlement.rule_of_78_rebate):
        --   - Basis: the schedule in force at settlement. If one or more partial
        --     prepayments have occurred, use the most recent re-amortised schedule
        --     -- its remaining regular instalments and remaining scheduled
        --     interest -- NOT the original disbursement-time schedule.
        --   - Digit base n = number of remaining regular instalments in that
        --     current schedule; sum-of-digits = n*(n+1)/2. The stub period is
        --     excluded from the digit sequence.
        --   - Total-scheduled-interest base = sum of interest over those remaining
        --     regular periods.
        --   - Applies only to unearned REGULAR interest. Stub interest charged at
        --     disbursement is already earned and is never rebated.
        --
        -- SETTLEMENT AMOUNT disclosed to the customer (settlement.settlement_amount)
        -- = outstanding principal + earned (non-rebated) interest for the
        -- remaining periods (= remaining scheduled interest - rebate) + any
        -- mid-period accrued interest; the rebate reduces the amount owed.
        --
        -- ROUNDING (defaults): the rebate is rounded half up to the whole
        -- shilling; the settlement amount is independently rounded half up to the
        -- whole shilling. If the two differ by a shilling, the rounded settlement
        -- amount is authoritative; no secondary residue adjustment is made.
        --
        -- ORDERING ON A DUE DATE (default): if settlement falls exactly on a
        -- scheduled due date, that period's regular instalment is processed first,
        -- then the settlement is applied to the resulting balance.
        --
        -- The total cost of credit then reflects interest actually charged plus
        -- the earned (non-rebated) portion, with the rebate reducing the total.
        -- The disclosed APR is not restated.
}

rule CompleteAtTerm {
    when: loan: Loan.final_due_date <= now
    requires: loan.status = active
    ensures: loan.status = completed
    @guidance
        -- The loan runs its full term: the final regular instalment falls due and
        -- the balance has closed to zero.
}


## Auditor verdict

_13 of 14 decisions are both surfaced and correct. All bespoke off-default decisions (2, 3, 4, 5, 7, 8, 10, 11, 14) are captured precisely, including the subtle 30/360-accrual-but-actual/365-disclosure split and the interest-first/principal-remainder rounding order. The sole miss is #6: the spec gets the currency (shilling) right but sets amount precision to whole shillings (no cents), contradicting the reference's 2-decimal-place precision. Coverage = 13/14 ≈ 0.93._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "interest is charged on the declining opening balance"; "30/360 interest on the opening balance" | The spec charges interest on the reducing opening balance, matching declining-balance interest. |
| 2 | yes | **yes** | "AMORTISATION METHOD: equal principal (constant-amortisation), NOT an annuity / fixed-payment (EMI) method. A constant principal slice P/n is repaid each regular period... so the total instalment decreases period to period." | Exactly matches equal-principal: constant P/n principal, interest on reducing balance, decreasing instalment, explicitly not EMI. |
| 3 | yes | **yes** | "Day-count: 30/360 for all accrual (every month = 30 days, year = 360 days)" | 30/360 stated explicitly for all accrual, matching the reference. |
| 4 | yes | **yes** | "each regular period's interest is charged once, on the opening outstanding balance... No daily accrual." | Interest computed once per monthly period, no daily accrual, matching same-as-repayment-period calculation. |
| 5 | yes | **yes** | "A stub (partial-period) interest charge when disbursement is off-cycle"; "Interest accrues from the disbursement date"; stub_interest formula on principal * rate * stub_days / 360 | Interest accrues from disbursement; off-cycle disbursement levies a partial-period stub charge, matching the reference. |
| 6 | yes | no | "Units: all amounts are whole shillings (no cents / minor units)" | Currency (shilling/KES) is addressed, but the reference precision is 2 decimal places on amounts; the spec explicitly uses whole shillings (0 dp, no cents), contradicting the stated precision, so the precision half does not match. |
| 7 | yes | **yes** | "Whole-shilling rounding with residue reconciliation to the final instalment"; "Accumulated residue across all periods lands in the FINAL instalment's principal component" | Each instalment rounds to whole shilling with accumulated residue settled in the final instalment, matching exactly. |
| 8 | yes | **yes** | "1. interest_k = round_shilling(...)"; "3. principal_k = instalment_k - interest_k"; "Interest is computed and rounded FIRST; the principal slice ... absorbs the intra-period rounding difference" | Interest rounded first, principal taken as the remainder of the rounded instalment, matching the reference ordering. |
| 9 | yes | **yes** | invariant ClosesToZero: "rows.last.closing_balance = 0.0" | The final instalment reconciles the closing balance to exactly zero. |
| 10 | yes | **yes** | "early full settlement (Rule of 78 rebate)"; "RULE OF 78 REBATE of unearned interest... sum-of-digits = n*(n+1)/2" | Early payoff rebates unearned interest by the Rule of 78 (sum-of-digits), matching the reference method. |
| 11 | yes | **yes** | "RE-AMORTISATION (term held fixed): the new constant principal slice is the new outstanding principal balance divided by the number of remaining regular instalments... the total instalment decreases"; "remainder... applied entirely to principal" | Prepayment goes entirely to principal and the schedule re-amortises with the term fixed so the instalment reduces, matching exactly. |
| 12 | yes | **yes** | invariant PositivePrincipalAndTerm; "Zero or negative principal or term: rejected as invalid (see the PositivePrincipalAndTerm invariant); no schedule is produced." | Zero or negative principal/term is rejected as invalid with an error, matching the reference. |
| 13 | yes | **yes** | "First regular instalment is due disbursement date + one month; subsequent instalments monthly thereafter." | First due date is disbursement + one month with monthly instalments thereafter, matching exactly. |
| 14 | yes | **yes** | ScheduleRow fields (due_date, opening_balance, interest, principal, instalment, closing_balance); "total_cost_of_credit = sum of every interest charge"; "disclosed_apr, computed on an actual/365 basis"; "actual/365 is used ONLY for the disclosed APR" while accrual is 30/360 | Full per-period schedule, total cost of credit as sum of interest, and APR disclosed on actual/365 while accrual uses 30/360, matching the non-obvious dual day-count split. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-fqNP1M/spec.allium"
}

```
