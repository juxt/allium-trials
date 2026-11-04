# allium-elicit — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 22 · Captured: 14/14 · Bespoke captured: 6/6

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material policy decision (repayment method, day-count, first-period stub, rounding and residual handling, output shape, lifecycle scope), so I elicit these before writing any spec.

Q: When you say the schedule gives interest and principal for each instalment, what repayment method is this loan on: equal total instalments (amortising, where each payment is the same and the principal/interest split shifts over the term), equal principal instalments (principal fixed, total payment declines), or interest-only with a principal bullet at the end?
A: Equal principal instalments. A constant principal portion (P/n) is repaid each period; interest is charged on the reducing balance, so the total instalment decreases over the term. This is not equal/level instalments (EMI) and not interest-only.

Q: How is the periodic interest derived from the annual nominal rate, and on what day-count basis: a simple nominal/12 per month, or an accrual by actual days in the period (and if so, actual/365, actual/360, or 30/360)?
A: Simple nominal rate divided by 12 gives the monthly rate, applied once per monthly period — not daily accrual. The day-count convention is 30/360: every month counts as 30 days, the year as 360.

Q: Does the disbursement date affect the first instalment, i.e. is there a stub or broken first period (interest accrued from disbursement to the first payment date, which may be longer or shorter than a month), or is every period treated as a whole month regardless of the disbursement date?
A: Yes, there is a stub period. Interest accrues from the disbursement date. If disbursement precedes the first period start date, a partial-period (stub) interest charge is levied for those extra days. Partial-period interest is allowed and charged.

Q: What are the instalment due dates: a fixed day of the month, one month after disbursement rolling forward, and how are month-end and non-business days handled?
A: The first due date is disbursement date plus one month; subsequent instalments fall monthly thereafter. Handling of month-end dates and non-business day roll conventions is not covered by policy — [default, not policy]: roll forward to the next business day, and use the actual rolled date for that period's due date.

Q: To what precision is each amount computed and stated (currency minor units, e.g. 2 decimal places), which way does rounding go (half-up, half-even, truncate), and does interest round per instalment or accrue unrounded and round only on display?
A: Currency is Kenyan shilling (KES). Amounts are stated to 2 decimal places. Each instalment is rounded to the whole shilling (no cents). Rounding direction is [default, not policy]: half-up. Interest is computed and rounded first per instalment; principal is the remainder of the rounded instalment for that period.

Q: Rounding across a full amortising schedule almost never sums exactly to the principal: where does the residual land, is the final instalment adjusted to force the closing balance to exactly zero, or is any drift spread another way?
A: The final instalment is adjusted to reconcile so the closing balance is exactly zero. The accumulated rounding difference across all prior instalments is settled in the final instalment.

Q: What is the exact output shape of generate_schedule: for each instalment, which fields (instalment number, due date, opening balance, interest due, principal due, total payment, closing balance), plus any schedule-level totals (total interest, total repaid)?
A: Per period: due date, opening balance, interest due, principal due, total instalment, closing balance. Schedule-level totals: total cost of credit (sum of all interest charges) and the disclosed APR, computed on an actual/365 basis even though accrual uses 30/360. Instalment number is [default, not policy]: included as a sequence field.

Q: Beyond the normal run to completion, do we need to handle any mid-life events in this engine, prepayment or early settlement, missed or partial payments, or is the scope strictly the originally scheduled forecast at disbursement with those events out of scope?
A: Two mid-life events are in scope. Early full settlement: unearned interest is rebated by the Rule of 78 (sum-of-the-digits). Partial prepayment (loan continues): the prepayment is applied entirely to principal, then the schedule is re-amortised keeping the original term fixed so the instalment reduces. Missed or partial payments are out of scope.

### Round 2
_Step reasoning:_ The core method is well-pinned, but the disclosed-APR basis, both in-scope mid-life events' result shapes and interface, the stub trigger, and edge inputs remain unasked assumptions the completeness gate flags.

Q: The disclosed APR is computed on actual/365 while accrual uses 30/360 — since it's a figure disclosed on a different basis than it's computed, pin it exactly: what is the precise APR definition (the internal rate of return that equates the disbursed principal to the discounted instalment cash flows, or a nominal/effective conversion), does the APR calculation include the stub-period charge and any fees, and to what precision is the APR stated (e.g. one or two decimal places, and rounded which way)?
A: APR basis is actual/365 (from policy). The precise definition, whether IRR or a nominal/effective conversion, is [default, not policy]: the IRR that equates the disbursed principal to the present value of all scheduled instalment cash flows, consistent with the XIRR / Newton-Raphson approach on actual calendar dates. The stub-period charge is a cash flow at its actual date and is [default, not policy]: included in the APR calculation. Fees are not mentioned in policy; [default, not policy]: include any origination fee disbursed net of principal or paid up-front as a day-0 cash flow. Precision is [default, not policy]: stated to two decimal places, rounded half-up, expressed as a percentage (e.g. 24.35%).

Q: For early full settlement with a Rule of 78 rebate: what exactly is the settlement figure the function returns, field by field (outstanding principal balance plus interest earned to date, minus the Rule-of-78 unearned-interest rebate, or some other composition), on what date can settlement occur (only on a due date, or any date with interest to the settlement date), and is the Rule-of-78 rebate computed over the full original term's total interest or only the remaining scheduled interest?
A: Settlement figure is [default, not policy]: outstanding principal balance at the settlement date, plus interest accrued from the last period start to the settlement date (computed on the 30/360 basis used for accrual), minus the Rule-of-78 unearned-interest rebate, giving the net amount the borrower must pay. Settlement can fall on any date, not only a due date [default, not policy]. The Rule-of-78 rebate is computed over the full original term's total scheduled interest: rebate = total_scheduled_interest × (remaining_periods × (remaining_periods + 1)) / (n × (n + 1)), where n is the original number of periods and remaining_periods is the count of instalments not yet due at settlement [default, not policy].

Q: For partial prepayment that re-amortises keeping the term fixed: how is the reduced instalment recomputed (constant principal portion reset to remaining balance divided by remaining periods, with interest on the reducing balance as before), can a prepayment fall on any date or only a due date (and if mid-period, is interest accrued to that date first), and is there a minimum prepayment amount?
A: The reduced instalment is recomputed as follows (following directly from the equal-principal methodology in policy): the new constant principal portion equals the remaining outstanding balance divided by the number of periods still outstanding after the prepayment; interest continues to be charged on the reducing balance at the same monthly rate. This is the natural re-amortisation of the same method, keeping the original total period count fixed per policy. Whether a prepayment may fall on any date or only a due date is [default, not policy]: any date is permitted; if mid-period, interest is accrued to the prepayment date first, the prepayment is applied to principal, and re-amortisation proceeds from that point. Minimum prepayment amount is [default, not policy]: none specified; any positive amount is accepted.

Q: How are these mid-life events actually supplied to generate_schedule(loan) — does the function take an optional list of dated events (prepayments, settlement) as input and return the resulting schedule, or are early settlement and prepayment separate entry points? I need the interface boundary pinned, not assumed.
A: The interface boundary is [default, not policy]. Recommended design: generate_schedule(loan) returns the original forecast and accepts no event parameters; early_settlement(loan, settled_date) and apply_prepayment(loan, prepayment_date, amount) are separate entry points that return, respectively, the settlement figure and a revised schedule object. The loan parameter carries current outstanding balance, original term, rate, disbursement date, and remaining periods so either function has all state it needs without re-running the original schedule.

Q: On the stub period: given the first due date is disbursement plus one month, under what circumstances does a stub actually arise (is there a fixed billing-cycle day of the month separate from the disbursement date that creates a broken first period), and when a stub charge is levied, is it folded into the first instalment's interest or reported as a separate line, and does it affect the first period's principal portion at all?
A: Given that policy sets the first due date as disbursement-date plus one month, a stub only arises when there is a contractually fixed period-start date separate from the disbursement date — for example, a billing cycle anchored to the first of each month, so a loan disbursed on the 10th has its first period start on the 1st of the following month and its first due date one month after that. The exact trigger (whether a fixed billing-cycle day exists) is [default, not policy]: assume no fixed billing-cycle day unless the caller supplies one; if the caller supplies a first_period_start date later than disbursement, the stub charge covers the days from disbursement to first_period_start at the daily 30/360 rate. Presentation of the stub is [default, not policy]: folded into the first instalment's interest field, not reported as a separate schedule line. The first period's principal portion is unaffected: it remains P/n as normal, and the instalment for period 1 equals (P/n rounded) plus (regular period-1 interest plus stub interest), with the combined interest rounded first per the rounding-order policy.

Q: Edge inputs: how should the engine treat a zero (0%) interest rate, a single-instalment term (n = 1), and a principal that divides evenly by n with no rounding residual — are any of these rejected, or all processed normally?
A: Zero or negative principal or term is rejected with an error (policy). A zero interest rate is [default, not policy]: processed normally — interest charges are zero every period, each instalment equals P/n rounded, and the final instalment reconciles any rounding residual. A single-instalment term (n = 1) is [default, not policy]: processed normally — the one instalment covers the full principal plus one period's interest, and the closing balance is zero by construction. A principal that divides evenly by n with no rounding residual is [default, not policy]: processed normally — the final instalment equals every other instalment with no adjustment needed.

### Round 3
_Step reasoning:_ Core mechanics are fully pinned, but fees (which the APR/total-cost defaults treat inconsistently) and the composition of mid-life events over a full loan life remain material unasked policy classes.

Q: Does this loan product carry any fees (origination, processing, or similar)? If so, what are they, when are they charged, and do they enter the 'total cost of credit' figure, or is that strictly the sum of interest charges as first stated? The APR default folded an origination fee in as a day-0 cash flow, so I need to know whether fees exist at all and how the two disclosed figures treat them.
A: Fees are not defined in policy. Total cost of credit is strictly the sum of all interest charges, as stated; it does not include fees. The APR treatment of an origination fee as a day-0 cash flow was given as [default, not policy] — if no fee exists, omit it from the APR calculation entirely.

Q: When early full settlement follows one or more partial prepayments, the Rule-of-78 rebate formula uses 'total_scheduled_interest', 'n', and 'remaining_periods' — do these refer to the original disbursement schedule, or to the re-amortised schedule in force at settlement? Re-amortisation changes the interest profile, so the rebate basis needs pinning.
A: Not covered by policy. [default, not policy]: use the re-amortised schedule in force at the time of settlement. After each prepayment the loan's interest profile changes; the rebate should reflect the total scheduled interest, term, and remaining periods of the schedule actually governing the loan at settlement, not the original disbursement schedule.

Q: Can apply_prepayment be called more than once over the life of the loan, and if so does each call simply re-amortise from the then-current balance and remaining period count? And is there any interaction to define if a prepayment lands on the same date as a scheduled instalment?
A: Not covered by policy. [default, not policy]: yes, apply_prepayment may be called more than once; each call re-amortises from the then-current outstanding balance and remaining period count, exactly as the first call does. If a prepayment falls on the same date as a scheduled instalment, [default, not policy]: apply the regular instalment first (closing that period and reducing the balance), then apply the prepayment to the resulting principal balance, and re-amortise from that point forward.

### Round 4
_Step reasoning:_ Core method, rounding, edge inputs and event mechanics are pinned, but the reporting shape of the two mid-life entry points (especially whether APR and total cost of credit are recomputed and re-disclosed after prepayment) and the exact 30/360 partial-month day-count for intra-period accrual remain material, unasked assumptions.

Q: Output shape of the two mid-life entry points, field by field: does early_settlement return only the single net settlement figure, or an itemised breakdown (outstanding principal, gross accrued interest to settlement date, Rule-of-78 unearned rebate, net payable)? And does apply_prepayment return a revised schedule object with the same per-period fields as generate_schedule PLUS recomputed schedule-level totals, i.e. is a new total cost of credit and a new disclosed APR recomputed and re-disclosed on the re-amortised schedule, or do those disclosure figures stay fixed at their original-disbursement values?
A: Not covered by policy. [default, not policy]: early_settlement returns an itemised breakdown with four fields — outstanding_principal (the principal balance at the settlement date), accrued_interest (interest accrued from the last period start to the settlement date on the 30/360 basis), rule_of_78_rebate (the unearned-interest rebate), and net_payable (outstanding_principal + accrued_interest − rule_of_78_rebate). apply_prepayment returns a revised schedule object with the same per-period fields as generate_schedule (due date, opening balance, interest, principal, instalment, closing balance) plus recomputed schedule-level disclosures: a new total cost of credit (sum of interest on the re-amortised schedule) and a new disclosed APR computed on actual/365 over the re-amortised cash flows. The original-disbursement figures are not re-disclosed; the object returned reflects the schedule as it actually stands after the prepayment.

Q: The mid-period accrual 'on the 30/360 basis' for settlement (and for the interest accrued before a mid-period prepayment) needs its day-count pinned exactly: between the last period start and an arbitrary intra-month date, which 30/360 variant counts the days, US/NASD 30/360 or European 30E/360, and how are the 31st and month-end handled? A partial month under 30/360 is where the accrued figure quietly diverges.
A: Not covered by policy. [default, not policy]: use US/NASD 30/360. Day-count between two dates D1 and D2: if D1 falls on the 31st, adjust it to 30; if D2 falls on the 31st and D1 is already 30 or 31 (after adjustment), adjust D2 to 30; then days = 360×(Y2−Y1) + 30×(M2−M1) + (D2−D1). Month-end dates other than the 31st (including February 28/29) are left unadjusted under US 30/360.

Q: At a mid-period prepayment, the interest accrued to the prepayment date, is it collected as a cash payment on that date (and therefore a dated cash flow), added to the outstanding balance, or deferred into the next instalment, and does it alter the size of the immediately following instalment beyond the re-amortisation of principal?
A: Not covered by policy. [default, not policy]: the accrued interest to the prepayment date is collected as a cash payment on that date — it is a dated cash outflow from the borrower at the moment of prepayment, not capitalised into the balance and not deferred. After collection, the prepayment amount is applied to reduce the outstanding principal. The immediately following instalment is then set by re-amortisation of the reduced principal over the remaining periods in the normal way; the only change to subsequent instalments comes from the principal reduction, not from any deferred interest component.

### Round 5
_Step reasoning:_ The core method, precision, rounding, timing, output shape and most mid-life events are fully pinned, but two material forks remain unasked: prepayment that meets or exceeds the balance (a surplus case with a genuine settlement-vs-cap fork) and date validity/back-dating for the mid-life entry points.

Q: For apply_prepayment: what happens when the prepayment amount equals or exceeds the outstanding principal balance? Is it rejected, capped at the balance so the loan closes immediately (and if so, is a Rule-of-78 rebate applied as in early settlement, or is the full accrued interest simply collected), or treated as an early full settlement routed through that logic? A prepayment that clears the balance is a surplus case with a real policy fork, and it hasn't been pinned.
A: Not covered by policy. [default, not policy]: if the prepayment amount equals or exceeds the outstanding principal balance, treat it as an early full settlement — reject apply_prepayment and route the caller to early_settlement instead (or, if the engine handles it internally, apply the early_settlement logic automatically). A Rule-of-78 rebate is applied on the re-amortised schedule in force at that date, exactly as in the early_settlement path. Any surplus above the net payable figure is not disbursed; the loan closes with a zero balance. Capping silently and collecting only accrued interest without a rebate is not the default — the rebate entitlement exists regardless of how settlement is triggered.

Q: Are the dates supplied to early_settlement and apply_prepayment validated against the loan's life, i.e. is a settlement or prepayment date before the disbursement date, or after the final scheduled due date (past maturity), rejected, or processed? And can these events be back-dated to a point earlier than a prepayment already applied?
A: Not covered by policy. [default, not policy]: both functions validate the supplied date. A date before the disbursement date is rejected with an error. A date after the final scheduled due date (past maturity) is also rejected — the loan no longer exists on its own terms at that point, and accepting a post-maturity date would require arrears logic that is out of scope. Back-dating to a point earlier than a prepayment already applied to the loan is rejected: events must be supplied in chronological order, and the engine does not support retroactive re-sequencing of mid-life events.

### Round 6 (process signalled done)
_Step reasoning:_ All material policy classes are covered — method, day-count, stub, rounding and residual, disclosures, and the full life including both mid-life events with their interfaces, edge inputs, surplus/shortfall and date validation; rounds 4-5 returned only defaults, signalling the operator's actual policy is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
--
-- Loan repayment schedule engine.
--
-- An equal-principal (constant P/n) amortising loan. A constant principal
-- portion is repaid each period; interest is charged on the reducing balance,
-- so the total instalment declines over the term. Three entry points:
-- generate_schedule (the original forecast), early_settlement (Rule-of-78
-- rebate) and apply_prepayment (re-amortise with the term held fixed).
--
-- Each requirement below is tagged [policy] where the stakeholder confirmed it
-- as product policy, or [default] where it was resolved as a documented default
-- because policy was silent.

config {
    currency: String = "KES"                    -- Kenyan shilling [policy]
    months_per_year: Integer = 12               -- monthly rate = annual nominal / 12 [policy]
    amount_decimal_places: Integer = 2          -- amounts stated to 2 dp [policy]
    instalment_rounding_unit: Decimal = 1       -- instalments rounded to the whole shilling [policy]
    apr_decimal_places: Integer = 2             -- APR stated to 2 dp [default]
}

-- The loan supplied to the engine. It carries both origination inputs and the
-- current mid-life state, so early_settlement and apply_prepayment have all the
-- state they need without re-running the original schedule. [default: interface]
entity Loan {
    principal: Decimal                          -- original disbursed principal P
    annual_nominal_rate: Decimal                -- annual nominal rate
    term: Integer                               -- original number of periods n [policy]
    disbursement_date: Timestamp                -- date funds are disbursed

    -- Optional contractually fixed first-period start. When absent, no fixed
    -- billing-cycle day is assumed and no stub arises. When present and later
    -- than disbursement, a stub period runs from disbursement to this date. [default]
    first_period_start: Timestamp?

    -- Current mid-life state. Equal to principal and term at origination;
    -- updated by each prepayment. [default: interface]
    outstanding_balance: Decimal                -- current outstanding principal
    remaining_periods: Integer                  -- instalments not yet due
}

-- One row of the repayment schedule.
value Instalment {
    sequence: Integer                           -- 1-based instalment number [default]
    due_date: Timestamp                         -- period due date
    opening_balance: Decimal                    -- balance at period start
    interest_due: Decimal                       -- interest charged this period
    principal_due: Decimal                      -- principal repaid this period
    total_instalment: Decimal                   -- interest_due + principal_due
    closing_balance: Decimal                    -- opening_balance - principal_due
}

-- The full schedule returned by generate_schedule and apply_prepayment.
entity Schedule {
    loan: Loan
    instalments: List<Instalment>
    total_cost_of_credit: Decimal               -- sum of all interest_due [policy]
    disclosed_apr: Decimal                      -- actual/365 APR, percent [policy]
}

-- The itemised figure returned by early_settlement. [default]
entity SettlementFigure {
    loan: Loan
    outstanding_principal: Decimal              -- principal balance at the settlement date
    accrued_interest: Decimal                   -- interest last-period-start -> settlement (30/360)
    rule_of_78_rebate: Decimal                  -- unearned-interest rebate
    net_payable: Decimal                        -- outstanding_principal + accrued_interest - rebate
}

-- Structural guarantees the checker can range over.
invariant PositiveTerm {
    for loan in Loans:
        loan.term >= 1
}

invariant RemainingPeriodsWithinTerm {
    for loan in Loans:
        loan.remaining_periods >= 0 and loan.remaining_periods <= loan.term
}

invariant OutstandingWithinPrincipal {
    for loan in Loans:
        loan.outstanding_balance <= loan.principal
}

-- The engine's three operations and the behaviour each must satisfy.
contract LoanScheduleEngine {
    generate_schedule: (loan: Loan) -> Schedule
    early_settlement: (loan: Loan, settled_date: Timestamp) -> SettlementFigure
    apply_prepayment: (loan: Loan, prepayment_date: Timestamp, amount: Decimal) -> Schedule

    @invariant RepaymentMethod
        -- Equal-principal instalments [policy]. A constant principal portion of
        -- P / n is repaid each period, where P is the principal and n the term.
        -- Interest is charged on the reducing balance, so the total instalment
        -- decreases over the term. This is NOT equal/level instalments (EMI) and
        -- NOT interest-only with a bullet.

    @invariant InterestDerivation
        -- The periodic (monthly) rate is the simple annual nominal rate divided
        -- by 12 [policy]. It is applied once per whole monthly period, not by
        -- daily accrual. A whole period's interest is opening_balance * monthly
        -- rate. The regular day-count convention is 30/360: every month counts
        -- as 30 days and the year as 360. [policy]

    @invariant StubPeriod
        -- Interest accrues from the disbursement date [policy]. A stub arises
        -- only when a contractually fixed period-start date exists that is
        -- separate from disbursement. In this engine the caller signals it by
        -- supplying loan.first_period_start later than disbursement_date; absent
        -- that field, no fixed billing-cycle day is assumed and no stub arises.
        -- [default]
        -- When a stub applies, a partial-period interest charge covers the days
        -- from disbursement_date to first_period_start at the daily 30/360 rate
        -- (monthly rate applied pro rata over 30-day months). Partial-period
        -- interest is allowed and charged. [policy]
        -- The stub charge is folded into the first instalment's interest_due
        -- field; it is NOT reported as a separate schedule line. [default]
        -- The first period's principal portion is unaffected: it remains P / n.
        -- Instalment 1 = (P / n rounded) + interest, where interest is the
        -- regular period-1 interest plus the stub interest, the two combined and
        -- then rounded together per the rounding-order rule. [default]

    @invariant DueDates
        -- The first due date is disbursement_date plus one month; subsequent
        -- instalments fall monthly thereafter. [policy]
        -- Month-end and non-business-day handling is not covered by policy.
        -- [default] Roll a due date forward to the next business day, and use the
        -- actual rolled date as that period's due date.

    @invariant RoundingAndPrecision
        -- Currency is KES; amounts are stated to 2 decimal places. [policy]
        -- Each instalment is rounded to the whole shilling (no cents). [policy]
        -- Rounding direction is half-up. [default]
        -- Rounding order [policy]: within a period interest is computed and
        -- rounded FIRST; the principal portion is then the remainder of the
        -- rounded instalment for that period. (For a stub period the regular and
        -- stub interest are summed before rounding, per StubPeriod.)

    @invariant FinalInstalmentReconciliation
        -- Rounding across the schedule will not sum exactly to the principal.
        -- The final instalment is adjusted so the closing balance is exactly
        -- zero: the accumulated rounding difference across all prior instalments
        -- is settled in the final instalment. [policy]

    @invariant ScheduleOutputShape
        -- Per period the schedule states: sequence (instalment number) [default],
        -- due_date, opening_balance, interest_due, principal_due,
        -- total_instalment and closing_balance. [policy]
        -- Schedule-level totals: total_cost_of_credit (the sum of all interest
        -- charges) and disclosed_apr. [policy]

    @invariant TotalCostOfCredit
        -- total_cost_of_credit is strictly the sum of all interest charges on
        -- the schedule. It does NOT include fees. [policy] No fees are defined by
        -- this product.

    @invariant DisclosedApr
        -- The disclosed APR is computed on an actual/365 basis even though
        -- accrual uses 30/360. [policy]
        -- Definition [default]: the internal rate of return that equates the
        -- disbursed principal to the present value of all scheduled instalment
        -- cash flows, discounted on actual calendar dates (an XIRR /
        -- Newton-Raphson solution).
        -- The stub-period charge is a cash flow at its actual date and is
        -- included in the APR calculation. [default]
        -- Fees are not defined by this product, so no fee cash flow enters the
        -- APR. (Had an origination fee existed it would enter as a day-0 cash
        -- flow, but it does not.) [policy/default]
        -- APR is stated to 2 decimal places, rounded half-up, expressed as a
        -- percentage (e.g. 24.35%). [default]

    @invariant InputValidation
        -- Zero or negative principal, or zero or negative term, is rejected with
        -- an error. [policy]
        -- A zero interest rate is processed normally: interest is zero every
        -- period, each instalment equals P / n rounded, and the final instalment
        -- reconciles any rounding residual. [default]
        -- A single-instalment term (n = 1) is processed normally: the one
        -- instalment covers the full principal plus one period's interest and the
        -- closing balance is zero by construction. [default]
        -- A principal that divides evenly by n is processed normally: the final
        -- instalment equals every other instalment, with no adjustment needed.
        -- [default]

    @invariant GenerateScheduleScope
        -- generate_schedule(loan) returns the original forecast at disbursement
        -- and accepts no event parameters. Missed or partial payments are out of
        -- scope. [default interface / policy scope]

    @invariant EarlySettlementFigure
        -- early_settlement(loan, settled_date) returns an itemised
        -- SettlementFigure with four fields [default]:
        --   outstanding_principal: the principal balance at settled_date;
        --   accrued_interest: interest from the last period start to settled_date
        --     on the 30/360 basis used for accrual;
        --   rule_of_78_rebate: the unearned-interest rebate;
        --   net_payable = outstanding_principal + accrued_interest
        --                 - rule_of_78_rebate.
        -- Settlement may fall on any date, not only a due date. [default]
        -- Rule-of-78 (sum-of-the-digits) rebate (a Rule-of-78 rebate applies is
        -- [policy]; the formula is [default]):
        --   rebate = total_scheduled_interest
        --            * (m * (m + 1)) / (n * (n + 1))
        -- where n is the number of periods and m (remaining_periods) is the count
        -- of instalments not yet due at settlement.
        -- When settlement follows one or more prepayments, total_scheduled_interest,
        -- n and m are taken from the re-amortised schedule in force at settlement,
        -- NOT from the original disbursement schedule. [default]

    @invariant PartialPrepayment
        -- apply_prepayment(loan, prepayment_date, amount) applies the whole
        -- prepayment to principal, then re-amortises with the ORIGINAL total
        -- period count held fixed, so the instalment reduces. [policy]
        -- Re-amortisation [policy, following the equal-principal method]: the new
        -- constant principal portion equals the remaining outstanding balance
        -- divided by the number of periods still outstanding after the
        -- prepayment; interest continues to be charged on the reducing balance at
        -- the same monthly rate.
        -- A prepayment may fall on any date. [default] If mid-period, interest is
        -- accrued to prepayment_date first (US/NASD 30/360, see DayCount30360),
        -- collected as a dated cash payment on that date (NOT capitalised into the
        -- balance and NOT deferred into the next instalment); the prepayment is
        -- then applied to reduce principal, and re-amortisation proceeds from that
        -- point. The immediately following instalment changes only through the
        -- principal reduction, never through a deferred-interest component. [default]
        -- No minimum prepayment amount; any positive amount is accepted. [default]
        -- apply_prepayment may be called more than once; each call re-amortises
        -- from the then-current outstanding balance and remaining period count,
        -- exactly as the first. [default]
        -- If a prepayment falls on the same date as a scheduled instalment, the
        -- regular instalment is applied first (closing that period and reducing the
        -- balance), then the prepayment is applied to the resulting principal
        -- balance, and re-amortisation proceeds from there. [default]

    @invariant PrepaymentRevisedDisclosures
        -- apply_prepayment returns a revised Schedule with the same per-period
        -- fields as generate_schedule PLUS recomputed schedule-level disclosures:
        -- a new total_cost_of_credit (sum of interest on the re-amortised
        -- schedule) and a new disclosed_apr on actual/365 over the re-amortised
        -- cash flows. The original-disbursement figures are not re-disclosed; the
        -- returned object reflects the schedule as it stands after the prepayment.
        -- [default]

    @invariant PrepaymentClearsBalance
        -- If the prepayment amount equals or exceeds the outstanding principal
        -- balance, it is treated as an early full settlement: apply_prepayment
        -- rejects and routes the caller to early_settlement (or applies the
        -- early_settlement logic internally). A Rule-of-78 rebate is applied on
        -- the re-amortised schedule in force at that date, exactly as on the
        -- early_settlement path. Any surplus above net_payable is not disbursed;
        -- the loan closes with a zero balance. It is NOT silently capped and it is
        -- NOT settled without a rebate. [default]

    @invariant DayCount30360
        -- The mid-period accrual for settlement, and the interest accrued before
        -- a mid-period prepayment, use US/NASD 30/360. [default]
        -- Day-count between D1 and D2: if D1 is the 31st, adjust it to 30; if D2
        -- is the 31st and D1 is 30 or 31 after adjustment, adjust D2 to 30; then
        --   days = 360 * (Y2 - Y1) + 30 * (M2 - M1) + (D2 - D1).
        -- Month-end dates other than the 31st (including February 28/29) are left
        -- unadjusted.

    @invariant EventDateValidation
        -- Both early_settlement and apply_prepayment validate the supplied date.
        -- [default]
        -- A date before disbursement_date is rejected with an error.
        -- A date after the final scheduled due date (past maturity) is rejected;
        -- accepting it would require out-of-scope arrears logic.
        -- Back-dating to a point earlier than a prepayment already applied is
        -- rejected: events must be supplied in chronological order and the engine
        -- does not support retroactive re-sequencing of mid-life events.
}

-- Boundary: the computed schedule as disclosed to the loan holder. Binds the
-- Schedule and SettlementFigure result shapes to the engine contract.
surface ScheduleDisclosure {
    facing viewer: Loan

    context schedule: Schedule where loan = viewer

    exposes:
        schedule.loan.principal
        schedule.loan.annual_nominal_rate
        schedule.loan.term
        schedule.loan.disbursement_date
        schedule.loan.first_period_start
        schedule.loan.outstanding_balance
        schedule.loan.remaining_periods
        for line in schedule.instalments:
            line.sequence
            line.due_date
            line.opening_balance
            line.interest_due
            line.principal_due
            line.total_instalment
            line.closing_balance
        schedule.total_cost_of_credit
        schedule.disclosed_apr

    contracts:
        fulfils LoanScheduleEngine
}

-- Boundary: the itemised early-settlement figure disclosed to the loan holder.
surface SettlementDisclosure {
    facing viewer: Loan

    context figure: SettlementFigure where loan = viewer

    exposes:
        figure.loan.remaining_periods
        figure.outstanding_principal
        figure.accrued_interest
        figure.rule_of_78_rebate
        figure.net_payable
}

-- Missed or partial payments are out of scope for this engine. [policy]


## Auditor verdict

_The specification surfaces and correctly resolves all 14 reference decisions, including the nine bespoke off-default choices (equal-principal amortisation, 30/360 day-count, same-as-period interest, disbursement-date stub, whole-shilling instalment rounding, interest-first rounding order, Rule-of-78 rebate, term-fixed re-amortisation, and the 30/360-accrual-but-actual/365-disclosure split). Coverage = 14/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | InterestDerivation/RepaymentMethod: "Interest is charged on the reducing balance"; header "interest is charged on the reducing balance". | Declining balance on the reducing principal is stated explicitly across the header and two invariants. Matches the reference exactly. |
| 2 | yes | **yes** | RepaymentMethod: "Equal-principal instalments... A constant principal portion of P / n is repaid each period... the total instalment decreases over the term. This is NOT equal/level instalments (EMI)". | Equal-principal (constant P/n, declining total instalment) is named and explicitly contrasted with EMI, matching the off-default reference answer. |
| 3 | yes | **yes** | InterestDerivation: "The regular day-count convention is 30/360: every month counts as 30 days and the year as 360." | 30/360 is stated verbatim, matching the reference and rejecting actual/365. |
| 4 | yes | **yes** | InterestDerivation: "applied once per whole monthly period, not by daily accrual. A whole period's interest is opening_balance * monthly rate." | Interest is computed once per repayment period rather than daily-accrued, exactly the reference resolution. |
| 5 | yes | **yes** | StubPeriod: "Interest accrues from the disbursement date... a partial-period interest charge covers the days from disbursement_date to first_period_start at the daily 30/360 rate... Partial-period interest is allowed and charged." | Accrual from disbursement plus a charged stub for the extra days matches the reference, including that partial-period interest is levied. |
| 6 | yes | **yes** | config: currency "KES" [policy]; amount_decimal_places 2. | Kenyan shilling and 2 decimal places both stated, matching the reference. |
| 7 | yes | **yes** | RoundingAndPrecision: "Each instalment is rounded to the whole shilling (no cents)"; FinalInstalmentReconciliation: "the accumulated rounding difference across all prior instalments is settled in the final instalment." | Whole-shilling instalment rounding with the residual settled in the final instalment matches both halves of the reference answer. |
| 8 | yes | **yes** | RoundingAndPrecision: "within a period interest is computed and rounded FIRST; the principal portion is then the remainder of the rounded instalment for that period." | Interest rounded first, principal as the remainder, exactly the reference ordering rule. |
| 9 | yes | **yes** | FinalInstalmentReconciliation: "The final instalment is adjusted so the closing balance is exactly zero". | Final instalment reconciles the balance to exactly zero, matching the reference. |
| 10 | yes | **yes** | EarlySettlementFigure: "Rule-of-78 (sum-of-the-digits) rebate" with formula total_scheduled_interest * (m*(m+1))/(n*(n+1)). | Early full settlement rebates unearned interest by Rule of 78, not straight-line/actuarial, matching the reference. |
| 11 | yes | **yes** | PartialPrepayment: "applies the whole prepayment to principal, then re-amortises with the ORIGINAL total period count held fixed, so the instalment reduces." | Entire prepayment to principal then re-amortise keeping the term fixed (instalment reduces) matches the reference, and explicitly contrasts with the instalment-fixed alternative. |
| 12 | yes | **yes** | InputValidation: "Zero or negative principal, or zero or negative term, is rejected with an error." | Zero/negative principal or term rejected as invalid, exactly the reference. |
| 13 | yes | **yes** | DueDates: "The first due date is disbursement_date plus one month; subsequent instalments fall monthly thereafter." | First due date at disbursement + one month with monthly cadence matches the reference (added business-day rolling is a default overlay, not a contradiction). |
| 14 | yes | **yes** | ScheduleOutputShape lists per-period due_date/opening/interest/principal/total/closing plus total_cost_of_credit and disclosed_apr; DisclosedApr: "computed on an actual/365 basis even though accrual uses 30/360." | Full per-period schedule, total cost of credit, and an actual/365 disclosed APR distinct from the 30/360 accrual all present, capturing the non-obvious dual-day-count disclosure quirk. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-Y3rmlt/spec.allium"
}

```
