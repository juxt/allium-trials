# allium-elicit — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 14 · Captured: 14/14 · Bespoke captured: 6/6

## Conversation

### Round 1
_Step reasoning:_ First turn: the brief fixes scope and interface but omits every material policy decision, so I surface the core method, interest/day-count convention, rounding and residual, date handling, output shape and edge cases before writing any spec.

Q: What amortisation method does this product use, exactly: equal total instalments (an annuity/French schedule where interest and principal split shifts over time), equal principal per instalment (declining total payment), interest-only with a principal bullet at term end, or something else?
A: Equal principal: a constant principal slice of P/n is repaid each period, interest is charged on the declining outstanding balance, so the total instalment decreases over the term. This is not an annuity/EMI (equal-instalment) schedule, not interest-only, and not a bullet structure.

Q: How is the periodic interest derived from the annual nominal rate and what day-count convention applies: simple nominal-rate-divided-by-12 on the outstanding balance each month, or an actual-days convention (e.g. actual/365, 30/360) that makes each period's interest depend on the calendar length between due dates?
A: The 30/360 day-count convention applies. The annual nominal rate is divided by 12 (each month is treated as exactly 30/360 of a year regardless of calendar length). Interest is computed once per monthly repayment period on the opening balance for that period; there is no daily accrual.

Q: To what precision is each figure computed and rounded (e.g. whole minor currency units / 2 decimal places), which way does rounding go (nearest, up, down/truncate), and where does the accumulated rounding residual land, on the final instalment, spread, or carried in the running balance?
A: Currency is Kenyan shilling (KES). Amounts are carried to 2 decimal places. Each instalment is rounded to the whole shilling (no cents). Within a period, interest is computed and rounded first; principal for that period is the remainder of the rounded instalment. Rounding direction is nearest [default, not policy]. The accumulated rounding residual is settled in the final instalment.

Q: How are the instalment due dates set relative to the disbursement date: is the first instalment exactly one month after disbursement, on a fixed day of the month, and is there any odd/short/long first period whose interest is computed differently from a full period?
A: The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. If disbursement precedes the first period start, a stub interest charge is levied for those extra days using the same 30/360 convention, so a partial first period is allowed and charged rather than absorbed or waived.

Q: What must the returned schedule contain, field by field, for each instalment (e.g. instalment number, due date, opening balance, interest due, principal due, total payment, closing/running balance), and should it include any header/summary figures such as total interest or the constant instalment amount?
A: Per-period fields: due date, opening balance, interest due, principal due, total instalment, closing balance. Summary/header figures: total cost of credit (sum of all interest charges) and the disclosed APR, which is computed on an actual/365 basis even though period accrual uses 30/360.

Q: Should the final instalment's running balance be forced to exactly zero (with the last principal absorbing any residual), and how are degenerate inputs handled: zero interest rate, a single-instalment term, zero or negative principal?
A: Yes — the final instalment is adjusted so the closing balance is exactly zero; the last principal slice absorbs any residual. Zero or negative principal, and zero or negative term, are rejected with an error. Zero interest rate is not addressed by policy; a reasonable default would be to allow it and return a zero-interest schedule [default, not policy].

### Round 2
_Step reasoning:_ Core method, day-count, rounding, dates, degenerate inputs and field list are settled, but the disclosed APR (a figure on a different basis than accrual) is still a one-line answer, the stub interest's presentation in the output is unresolved, and whole-life events have not been asked or ruled out of scope.

Q: The disclosed APR is a figure shown on a different basis (actual/365) than interest accrues (30/360), so I want to pin it down exactly. What is the precise APR method: is it the effective annual rate that discounts the actual scheduled cash flows (each instalment on its actual calendar due date, plus any stub charge) back to the net amount disbursed, solved as an IRR on an actual/365 basis? Does the APR calculation include the stub interest and any fees, or interest only? To what precision is the disclosed APR expressed and which way is it rounded? And how should APR behave in degenerate cases (a single-instalment term, or a zero interest rate)?
A: The APR is the effective annual rate that solves an IRR on the actual calendar cash flows: the net disbursed amount as an outflow at disbursement, then each scheduled instalment (including any stub charge) as an inflow on its actual calendar due date, discounted on an actual/365 basis. The stub charge and all scheduled interest are included; the answer key does not mention fees, so whether origination or other fees enter the APR is not addressed by policy [default, not policy: include them if they are a cost of credit, exclude them if they are separately disclosed]. APR precision and rounding direction are not specified by policy [default, not policy: expressed to two decimal places, rounded to nearest]. For degenerate cases (single instalment, zero interest rate), the APR should still be computed from the same IRR on the actual cash flows; a zero-rate loan with one instalment one month out implies an APR of zero [default, not policy].

Q: How is the stub/partial-first-period interest represented in the returned schedule: is it a separate line item, folded into the first instalment's interest figure, or reported as a separate upfront charge? Is the stub charge rounded to the whole shilling like other interest, does it increase the first total instalment (and if so does the first period still repay a full P/n principal slice), and is it included in the total cost of credit summary?
A: The answer key does not specify the stub's position in the schedule output [default, not policy: represent it as a separate line item prior to period 1, with its own due date equal to the disbursement date or the first period start, showing the stub days, interest amount, zero principal, and zero closing-balance movement; this keeps period 1 clean as a full P/n principal period]. The stub charge is part of the total cost of credit (it is interest) and is rounded to the whole shilling like all other interest figures. The first regular instalment still repays a full P/n principal slice; the stub does not alter principal amortisation.

Q: Is this engine purely a projection produced once at disbursement, so that mid-life events (early/partial prepayment, missed or late payments, restructuring, rate changes, early settlement) are out of scope for generate_schedule, or must the function accommodate any of these?
A: Early full settlement and partial prepayment are explicitly in scope: early full payoff triggers a Rule of 78 rebate of unearned interest; a partial prepayment is applied entirely to principal and the remaining schedule is re-amortised over the original remaining term (reducing the instalment, not the term). Missed or late payments, rate changes, restructuring, and other mid-life events are not addressed by policy and are out of scope for generate_schedule [default, not policy].

### Round 3
_Step reasoning:_ Round 2 pulled early settlement (Rule of 78) and partial prepayment into scope but left their inputs/outputs, rebate base, settlement composition, timing, and re-amortisation mechanics unspecified; the whole-life class demands these be pinned before finishing.

Q: Now that early settlement and partial prepayment are in scope for generate_schedule, how do these events enter and leave the function? Does the loan input carry a list of dated events (partial prepayments, an early full settlement), and does the return value reflect the re-amortised remaining rows plus, for full settlement, a settlement figure? Or are these handled by separate functions with their own signatures and outputs?
A: The answer key does not specify the function interface for these events [default, not policy: model them as separate functions rather than embedding events in generate_schedule. generate_schedule takes a clean loan at origination and returns the initial full schedule. A separate early_settle(schedule, settlement_date) function consumes the existing schedule, computes the Rule of 78 rebate, and returns the settlement figure owed. A separate prepay(schedule, prepayment_date, amount) function applies the principal reduction and returns the re-amortised remaining schedule from that point forward. Keeping these as distinct entry points preserves a clean projection model and avoids overloading generate_schedule with conditional event logic].

Q: For the Rule of 78 early-settlement rebate: over what interest base is the rebate computed (the total cost of credit including the stub, or scheduled interest excluding the stub)? What exactly does the borrower pay to settle (outstanding principal + interest earned to date − rebate, or some other composition)? Can settlement fall on any calendar date or only on a scheduled instalment date, and if any date, how are the elapsed and remaining periods that drive the Rule-of-78 fraction determined?
A: The answer key does not specify the interest base for the Rule of 78 rebate, the exact settlement composition, or whether settlement is restricted to instalment due dates [default, not policy: the rebate is computed over the scheduled periodic interest only, excluding any stub charge — the stub is a discrete charge for actual elapsed days and sits outside the n-period digit sum; the Rule of 78 fraction is remaining_sum_of_digits / total_sum_of_digits applied to that scheduled interest total. The borrower pays: outstanding principal as at the settlement date plus interest accrued from the last instalment date to the settlement date on a 30/360 basis, minus the rebate. Settlement may fall on any calendar date; elapsed periods are the count of instalment periods whose due dates fall on or before the settlement date, and remaining periods are n minus that count, which determines both the rebate fraction and the accrued interest days].

Q: For partial prepayment: can it occur on any calendar date or only on a scheduled instalment due date, and if between due dates is there any interest adjustment for the partial period? After the prepayment is applied to principal, is the new constant principal slice simply remaining balance / remaining original periods (keeping the original final due date)? Are multiple prepayments supported, and is the prepayment amount subject to any minimum or to rounding?
A: The answer key does not specify whether prepayment is restricted to instalment due dates, whether an interest adjustment is made for a between-date prepayment, whether multiple prepayments are supported, or whether a minimum or rounding rule applies to the prepayment amount [default, not policy: prepayment may occur on any calendar date; interest accrued from the last instalment date to the prepayment date is collected at that point using the 30/360 convention, then the prepayment amount is applied in full to the outstanding principal. The new constant principal slice is the reduced outstanding balance divided by the count of original remaining periods, preserving the original final due date exactly as policy requires. Multiple sequential prepayments are supported; each produces a fresh re-amortised tail. No minimum prepayment amount or rounding constraint is specified; the prepayment amount is accepted as given, subject to the existing rule that principal cannot go negative].

### Round 4
_Step reasoning:_ Every other decision class is answered; fees remain the one genuinely open policy item that materially affects two disclosed outputs (total cost of credit and APR), so I must confirm it rather than assume it before finishing.

Q: Does this loan product levy any charges beyond interest, such as an origination, processing, arrangement or disbursement fee? If so: (a) is the fee a flat amount or a percentage of principal, (b) is it deducted from the disbursed amount or added to the balance, (c) does it appear as a line in the returned schedule, (d) is it included in the 'total cost of credit' summary alongside interest, and (e) does it enter the disclosed APR as a cost of credit or is it excluded because it is separately disclosed? If the product charges no fees at all, please confirm that explicitly so I can record fees as out of scope rather than leave it as an assumption.
A: The answer key does not address fees of any kind. Whether this product levies an origination, processing, arrangement or disbursement fee is not specified by policy, so I cannot confirm fees are absent nor define their treatment. [default, not policy: treat fees as out of scope for now; if a fee is later introduced, the recommended defaults would be: flat or percentage of principal are both common, deducted from disbursed amount rather than added to balance, shown as a separate line item in the schedule at period 0, included in total cost of credit, and included in the APR as a cost of credit consistent with the actual/365 IRR approach already specified. Confirm with the product owner before implementing.]

### Round 5
_Step reasoning:_ One genuinely material, policy-bearing ambiguity remains: the stub charge feeds total cost of credit and APR, yet its triggering condition and day-count are internally inconsistent with 'first instalment exactly one month after disbursement', so it needs the core-method treatment before I can conclude.

Q: I want to pin down the stub/partial-first-period charge, since it feeds both the total cost of credit and the disclosed APR and is real interest rather than a default. There seems to be a tension: you said the first instalment is due exactly one month after disbursement (which is a clean 30/360 period with no extra days), yet also that a stub is levied 'if disbursement precedes the first period start' for those extra days. That implies periods are pegged to a fixed schedule anchor (e.g. a fixed day-of-month or a fixed first-period-start date) that can differ from the disbursement date. Which is it: (a) are instalment due dates anchored to disbursement + n months (in which case no stub ever arises), or (b) anchored to a fixed calendar schedule, so a loan disbursed partway through a period incurs a stub for the days from disbursement to the first period start? And when a stub does arise, exactly how are its days counted under 30/360 (30-day months, end-of-month handling), and does the disclosed schedule's first regular period still run a full 30/360 month from that first period start?
A: The answer key contains a tension it does not resolve. Item 13 states the first due date is exactly disbursement date plus one month, with subsequent instalments monthly thereafter — which is model (a): due dates are anchored to disbursement, so no stub period ever arises by construction. Item 5, however, states that if disbursement precedes the first period start a stub is levied for those extra days — language that presupposes model (b), where periods are pinned to a fixed calendar anchor independent of the disbursement date. The key does not specify which model governs, does not define what 'first period start' means relative to disbursement under model (b), and does not specify the 30/360 stub day-count mechanics (e.g. how end-of-month dates are treated). [default, not policy: recommend adopting model (b) — periods are anchored to a fixed day-of-month (e.g. the 1st), the first period start is the first such anchor on or after disbursement, and the stub covers days from the disbursement date to that anchor. Under 30/360, the stub day count uses the standard 30/360 formula: days = (30 − d1) + 30 × (m2 − m1 − 1) + d2 capped at 30, where d1 and d2 are the day-of-month of disbursement and first period start respectively; end-of-month dates are treated as day 30. The first regular period then runs a clean 30-day (30/360) month from the first period start to first due date, and all subsequent periods do the same. This interpretation makes item 5 coherent; item 13 should be read as the general case where disbursement falls on the anchor date, producing a zero-length stub that is simply omitted. Confirm with the product owner which model is intended before implementing.]

### Round 6 (process signalled done)
_Step reasoning:_ Five rounds have surfaced every buried policy with a definite answer (equal-principal method, 30/360 accrual, KES whole-shilling rounding with residual on the final instalment, due-date/stub mechanics, full output shape, actual/365 IRR APR, degenerate-input handling, in-scope early settlement via Rule of 78 and re-amortising partial prepayment, out-of-scope events, and fees); the only remaining ambiguities are ones the answer key itself leaves as defaults or an acknowledged tension the stakeholder cannot resolve, so further questioning would yield nothing new.

(no questions this round)

## Produced specification

-- allium: 3

-- Loan repayment schedule engine.
--
-- Generates an equal-principal amortisation schedule for a Kenyan-shilling
-- term loan, discloses the total cost of credit and an actual/365 APR, and
-- supports two mid-life events: early full settlement (Rule of 78 rebate)
-- and partial prepayment (principal reduction with re-amortisation).
--
-- Provenance note: facts drawn from the stakeholder answer key are stated
-- plainly. Points the key did not settle are marked "(default, not policy)"
-- and, where a genuine contradiction remains, raised as an open question.

-- ---------------------------------------------------------------------------
-- Scalar value types
-- ---------------------------------------------------------------------------

-- KES amount. Carried to two decimal places internally (minor_units are
-- hundredths of a shilling); instalments are rounded to the whole shilling.
value Money { minor_units: Integer }

-- A rate or the disclosed APR, expressed as an exact decimal string
-- (e.g. "0.18" for 18% nominal per annum, "24.53" for a 24.53% APR).
value Decimal { text: String }

config {
    -- Currency and precision (item 3).
    currency: String = "KES"
    amount_precision_dp: Integer = 2              -- amounts carried to 2 dp internally
    instalment_rounding: String = "whole_shilling_nearest"   -- rounded to whole KES, nearest (nearest is default, not policy)

    -- Accrual convention (item 2).
    accrual_day_count: String = "30/360"
    -- Periodic rate = annual nominal rate / 12; each month is exactly 30/360
    -- of a year regardless of calendar length. No daily accrual.

    -- Disclosure basis (items 5 and 7).
    apr_day_count: String = "actual/365"
    apr_precision_dp: Integer = 2                 -- (default, not policy)
    apr_rounding: String = "nearest"              -- (default, not policy)

    -- Schedule anchoring for the stub (see StubModel open question).
    -- (default, not policy) periods anchored to a fixed day-of-month.
    schedule_anchor_day_of_month: Integer = 1
}

-- ---------------------------------------------------------------------------
-- Inputs
-- ---------------------------------------------------------------------------

-- The loan as presented at origination. generate_schedule consumes a clean
-- loan; mid-life events never mutate it (they act on the produced Schedule).
--
-- Derived quantities used throughout (kept as prose to avoid prescribing
-- representation): the periodic rate is annual_nominal_rate / 12 (item 2);
-- the constant principal slice is principal / term_months (item 1); a stub
-- exists exactly when first_period_start is later than disbursement_date.
entity Loan {
    principal: Money                  -- must be > 0 (item 6)
    annual_nominal_rate: Decimal      -- nominal annual rate, e.g. "0.18"; may be zero
    term_months: Integer             -- number of monthly instalments; must be > 0 (item 6)
    disbursement_date: Timestamp

    -- First scheduled period start. Under the default stub model (b) this is
    -- the first schedule anchor on or after disbursement; it equals the
    -- disbursement date when disbursement falls on the anchor, giving a
    -- zero-length stub. See the StubModel open question.
    first_period_start: Timestamp
}

-- ---------------------------------------------------------------------------
-- Outputs
-- ---------------------------------------------------------------------------

-- A single regular instalment row (item 5).
entity ScheduleRow {
    schedule: Schedule
    instalment_number: Integer        -- 1..term_months
    due_date: Timestamp
    opening_balance: Money
    interest_due: Money               -- interest on the opening balance, rounded to whole KES
    principal_due: Money              -- remainder of the rounded instalment; a full P/n slice except the last row
    total_instalment: Money           -- interest_due + principal_due
    closing_balance: Money            -- opening_balance - principal_due
}

-- The stub / partial-first-period interest charge (items 4, 8).
-- (default, not policy) represented as its own line item before instalment 1,
-- with zero principal and no balance movement, keeping period 1 a clean P/n
-- period. The stub is interest and forms part of the total cost of credit.
entity StubCharge {
    schedule: Schedule
    due_date: Timestamp               -- disbursement date or first period start
    stub_days: Integer                -- extra days under 30/360
    interest: Money                   -- rounded to whole KES like all interest
    principal: Money                  -- always zero
    closing_balance_movement: Money   -- always zero
}

-- The full schedule produced at origination.
entity Schedule {
    loan: Loan
    rows: ScheduleRow with schedule = this            -- one row per instalment, ordered by instalment_number
    stub: StubCharge with schedule = this             -- present only when the loan has a partial first period
    total_cost_of_credit: Money        -- sum of all interest, including the stub (item 5)
    apr: Decimal                       -- disclosed APR, actual/365 IRR (items 5, 7)
}

-- The figure owed to settle a loan early (items 9, 11). Returned by early_settle.
entity SettlementQuote {
    schedule: Schedule
    settlement_date: Timestamp
    elapsed_periods: Integer           -- instalment due dates on or before settlement_date
    remaining_periods: Integer         -- term_months - elapsed_periods
    outstanding_principal: Money        -- principal outstanding at settlement_date
    accrued_interest: Money             -- last instalment date -> settlement_date, 30/360
    rebate: Money                       -- Rule of 78 rebate of unearned scheduled interest
    amount_due: Money                   -- outstanding_principal + accrued_interest - rebate
}

-- ---------------------------------------------------------------------------
-- Structural invariant over any produced schedule
-- ---------------------------------------------------------------------------

invariant RowCountMatchesTerm {
    for schedule in Schedules:
        schedule.rows.count = schedule.loan.term_months
}

-- ---------------------------------------------------------------------------
-- The engine contract
-- ---------------------------------------------------------------------------

-- (default, not policy) the three behaviours are modelled as distinct
-- functions rather than events embedded in generate_schedule, keeping a clean
-- projection model at origination.
contract LoanScheduleEngine {

    generate_schedule: (loan: Loan) -> Schedule
    early_settle: (schedule: Schedule, settlement_date: Timestamp) -> SettlementQuote
    prepay: (schedule: Schedule, prepayment_date: Timestamp, amount: Money) -> Schedule

    -- --- Amortisation method (item 1) ---
    @invariant EqualPrincipalMethod
        -- The product uses equal-principal amortisation: a constant principal
        -- slice of P/n is repaid each period. It is NOT an annuity/EMI
        -- (equal-instalment) schedule, NOT interest-only, and NOT a bullet.

    @invariant InterestOnDecliningBalance
        -- Interest is charged on the declining outstanding (opening) balance
        -- each period, so the total instalment decreases over the term.

    -- --- Rate and day count (item 2) ---
    @invariant PeriodicRate
        -- The periodic rate is the annual nominal rate divided by 12. The
        -- 30/360 convention applies: each month is exactly 30/360 of a year
        -- regardless of calendar length.

    @invariant InterestPerPeriod
        -- Interest is computed once per monthly period on that period's opening
        -- balance. There is no daily accrual within a regular period.

    -- --- Rounding (item 3) ---
    @invariant AmountsAndRounding
        -- Amounts are carried to two decimal places (KES). Each instalment is
        -- rounded to the whole shilling (no cents). Within a period, interest
        -- is computed and rounded to the whole shilling FIRST; the principal
        -- for that period is the remainder of the rounded instalment. Rounding
        -- direction is nearest (nearest is default, not policy).

    @invariant ResidualInFinalInstalment
        -- The accumulated rounding residual is settled in the final instalment:
        -- the last principal slice absorbs it so the closing balance is exactly
        -- zero. Every earlier regular period repays a full P/n slice.

    -- --- Structural guarantees on the rows ---
    @invariant RowChaining
        -- Instalment 1's opening balance equals the loan principal. Each row's
        -- closing balance equals its opening balance minus its principal_due,
        -- and each subsequent row's opening balance equals the prior row's
        -- closing balance. total_instalment equals interest_due + principal_due.
        -- No closing balance is ever negative.

    @invariant FinalClosesAtZero
        -- The final row (instalment_number = term_months) has a closing balance
        -- of exactly zero.

    -- --- Due dates and the stub (items 4, 8) ---
    @invariant DueDateCadence
        -- The first regular instalment is due exactly one month after the
        -- disbursement date; subsequent instalments fall monthly thereafter.

    @invariant StubCharging
        -- If disbursement precedes the first period start, a stub interest
        -- charge is levied for those extra days using the same 30/360
        -- convention: a partial first period is charged, not absorbed or
        -- waived. The stub is rounded to the whole shilling like all interest.
        -- (default, not policy) it is a separate line item before instalment 1,
        -- with its own due date, its stub-day count, its interest amount, zero
        -- principal and no balance movement; instalment 1 still repays a full
        -- P/n slice, so the stub does not alter principal amortisation.

    -- --- Summary figures (item 5) ---
    @invariant TotalCostOfCredit
        -- total_cost_of_credit is the sum of all interest charges, including
        -- the stub charge.

    @invariant DisclosedAPR
        -- The disclosed APR is the effective annual rate that solves an IRR on
        -- the actual calendar cash flows on an actual/365 basis: the net
        -- disbursed amount as an outflow at disbursement, then each scheduled
        -- instalment (including the stub charge) as an inflow on its actual
        -- calendar due date. All scheduled interest and the stub are included.
        -- (default, not policy) expressed to two decimal places, rounded to
        -- nearest. Fee treatment is not addressed by policy: include a fee if
        -- it is a cost of credit, exclude it if separately disclosed
        -- (see the Fees open question).

    @invariant APRDegenerateCases
        -- APR in degenerate cases is computed from the same IRR on the actual
        -- cash flows. (default, not policy) a zero-rate loan with a single
        -- instalment one month out implies an APR of zero.

    -- --- Input validation (item 6) ---
    @invariant RejectsBadPrincipal
        -- Zero or negative principal is rejected with an error.

    @invariant RejectsBadTerm
        -- Zero or negative term is rejected with an error.

    @invariant ZeroRateAllowed
        -- (default, not policy) a zero interest rate is allowed and yields a
        -- zero-interest schedule. The answer key does not address it.

    -- --- Early full settlement, Rule of 78 (items 9, 11) ---
    @invariant EarlySettlementRebate
        -- early_settle computes a Rule of 78 rebate of unearned interest.
        -- (default, not policy) the rebate is computed over the SCHEDULED
        -- periodic interest only, excluding the stub (the stub is a discrete
        -- charge for actual elapsed days and sits outside the n-period digit
        -- sum). The rebate fraction is
        --   remaining_sum_of_digits / total_sum_of_digits
        -- applied to that scheduled interest total.

    @invariant SettlementComposition
        -- (default, not policy) the borrower pays: outstanding principal as at
        -- the settlement date, plus interest accrued from the last instalment
        -- date to the settlement date on a 30/360 basis, minus the rebate.

    @invariant SettlementTiming
        -- (default, not policy) settlement may fall on any calendar date.
        -- Elapsed periods are the count of instalment periods whose due dates
        -- fall on or before the settlement date; remaining periods are
        -- term_months minus that count. These drive both the rebate fraction
        -- and the accrued-interest day count.

    -- --- Partial prepayment (items 9, 12) ---
    @invariant PrepaymentAppliesToPrincipal
        -- A partial prepayment is applied in full to the outstanding principal.
        -- The remaining schedule is re-amortised over the ORIGINAL remaining
        -- term, reducing the instalment rather than the term; the original
        -- final due date is preserved exactly. The new constant principal slice
        -- is the reduced outstanding balance divided by the count of original
        -- remaining periods.

    @invariant PrepaymentTiming
        -- (default, not policy) prepayment may occur on any calendar date.
        -- Interest accrued from the last instalment date to the prepayment date
        -- is collected at that point on a 30/360 basis, then the prepayment is
        -- applied to principal.

    @invariant PrepaymentMultiplicity
        -- (default, not policy) multiple sequential prepayments are supported;
        -- each produces a fresh re-amortised tail. No minimum amount or
        -- rounding constraint applies; the amount is accepted as given, subject
        -- to the rule that principal cannot go negative.

    -- --- Out of scope (item 9) ---
    @invariant OutOfScopeEvents
        -- Missed or late payments, rate changes, restructuring and other
        -- mid-life events are not addressed by policy and are out of scope.
}

-- ---------------------------------------------------------------------------
-- Boundary
-- ---------------------------------------------------------------------------

actor EngineClient {
    identified_by: "loan-schedule-engine-caller"
}

-- The code-to-code boundary exposing a generated schedule. The exposed fields
-- are the exact per-row and summary output contract.
surface LoanScheduleAPI {
    facing caller: EngineClient

    context schedule: Schedule

    exposes:
        schedule.total_cost_of_credit
        schedule.apr
        schedule.stub.due_date
        schedule.stub.stub_days
        schedule.stub.interest
        schedule.stub.principal
        schedule.stub.closing_balance_movement
        for row in schedule.rows:
            row.instalment_number
            row.due_date
            row.opening_balance
            row.interest_due
            row.principal_due
            row.total_instalment
            row.closing_balance

    contracts:
        fulfils LoanScheduleEngine

    @guarantee ScheduleClosesAtZero
        -- The final row's closing balance is exactly zero.

    @guarantee InterestDeclines
        -- Because interest tracks the declining opening balance while the
        -- principal slice is constant, each regular total instalment is no
        -- larger than the previous one (equal for a zero-rate loan).
}

-- The early-settlement quote returned to the caller.
surface SettlementQuoteView {
    facing caller: EngineClient

    context quote: SettlementQuote

    exposes:
        quote.settlement_date
        quote.elapsed_periods
        quote.remaining_periods
        quote.outstanding_principal
        quote.accrued_interest
        quote.rebate
        quote.amount_due
}

-- ---------------------------------------------------------------------------
-- Open questions (genuine unresolved contradictions in the answer key)
-- ---------------------------------------------------------------------------

open question "StubModel: the key contradicts itself. Item 13 says the first due date is disbursement + one month, implying due dates anchor to disbursement so no stub ever arises (model a). Item 5 says a stub is levied when disbursement precedes the first period start, implying periods anchor to a fixed calendar date (model b). (default, not policy) adopt model b: periods anchor to a fixed day-of-month, the first period start is the first anchor on or after disbursement, and the stub covers disbursement -> anchor. Under 30/360 the stub day count is days = (30 - d1) + 30 * (m2 - m1 - 1) + d2, with d2 capped at 30 and end-of-month treated as day 30; the first regular period then runs a clean 30-day month. Read item 13 as the special case where disbursement lands on the anchor, giving a zero-length stub that is omitted. Confirm the intended model with the product owner."

open question "Fees: the key does not address origination, processing, arrangement or disbursement fees, so their presence and treatment cannot be confirmed. (default, not policy) treat fees as out of scope for now. If later introduced, recommended defaults: flat or percentage of principal, deducted from the disbursed amount rather than added to the balance, shown as a separate period-0 line item, included in the total cost of credit, and included in the actual/365 APR as a cost of credit. Confirm with the product owner before implementing."


## Auditor verdict

_The specification surfaces and correctly resolves all 14 reference decisions, including the bespoke off-default choices (equal-principal amortisation, 30/360 accrual, per-period interest, disbursement-date stub charging, whole-shilling rounding with interest-first ordering, Rule-of-78 rebate, term-fixed re-amortisation, and the 30/360-accrual-but-actual/365-disclosure split). Coverage = 14/14. Minor caveat: decision 5's stub anchoring is flagged as an open question, but the spec still adopts a model that levies the stub, satisfying the reference._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | @invariant InterestOnDecliningBalance: "Interest is charged on the declining outstanding (opening) balance each period"; @invariant InterestOnDecliningBalance / EqualPrincipalMethod header 'Amortisation method (item 1)' | The spec states interest is charged on the declining/reducing outstanding balance, matching declining-balance on reducing principal. |
| 2 | yes | **yes** | @invariant EqualPrincipalMethod: "a constant principal slice of P/n is repaid each period. It is NOT an annuity/EMI (equal-instalment) schedule"; @guarantee InterestDeclines: "each regular total instalment is no larger than the previous one" | Explicitly equal-principal (P/n constant) with decreasing total instalment, exactly matching the reference and rejecting EMI. |
| 3 | yes | **yes** | config accrual_day_count: String = "30/360"; "each month is exactly 30/360 of a year regardless of calendar length" | 30/360 convention stated verbatim, matching the reference; not actual/365 for accrual. |
| 4 | yes | **yes** | @invariant InterestPerPeriod: "Interest is computed once per monthly period on that period's opening balance. There is no daily accrual within a regular period." | Interest calculation period is same as the repayment period (once monthly), not daily accrual, matching the reference. |
| 5 | yes | **yes** | @invariant StubCharging: "If disbursement precedes the first period start, a stub interest charge is levied for those extra days... a partial first period is charged, not absorbed or waived"; StubCharge entity | Interest accrues from disbursement with a levied stub charge for the extra days; partial-period interest is allowed and charged, matching the reference (despite the spec flagging an anchoring open question, it adopts charging the stub). |
| 6 | yes | **yes** | config currency: String = "KES"; amount_precision_dp: Integer = 2 | Kenyan shilling to 2 decimal places, matching the reference. |
| 7 | yes | **yes** | @invariant AmountsAndRounding: "Each instalment is rounded to the whole shilling (no cents)"; @invariant ResidualInFinalInstalment: "The accumulated rounding residual is settled in the final instalment" | Whole-shilling instalment rounding with accumulated residual absorbed by the final instalment, matching the reference exactly. |
| 8 | yes | **yes** | @invariant AmountsAndRounding: "interest is computed and rounded to the whole shilling FIRST; the principal for that period is the remainder of the rounded instalment" | Interest rounded first, principal as remainder, matching the reference ordering exactly. |
| 9 | yes | **yes** | @invariant FinalClosesAtZero: "The final row (instalment_number = term_months) has a closing balance of exactly zero."; @guarantee ScheduleClosesAtZero | Final instalment reconciles to an exactly zero closing balance, matching the reference. |
| 10 | yes | **yes** | @invariant EarlySettlementRebate: "early_settle computes a Rule of 78 rebate of unearned interest... remaining_sum_of_digits / total_sum_of_digits" | Early full settlement uses the Rule of 78 (sum-of-digits) rebate, matching the reference and not straight-line/actuarial. |
| 11 | yes | **yes** | @invariant PrepaymentAppliesToPrincipal: "applied in full to the outstanding principal. The remaining schedule is re-amortised over the ORIGINAL remaining term, reducing the instalment rather than the term" | Partial prepayment goes entirely to principal, then re-amortises keeping the term fixed (instalment reduces), matching the reference exactly. |
| 12 | yes | **yes** | @invariant RejectsBadPrincipal: "Zero or negative principal is rejected with an error."; @invariant RejectsBadTerm: "Zero or negative term is rejected with an error." | Zero/negative principal and term both rejected as invalid, matching the reference. |
| 13 | yes | **yes** | @invariant DueDateCadence: "The first regular instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter." | First due date is disbursement + one month with monthly cadence, matching the reference. |
| 14 | yes | **yes** | Schedule entity (rows with due_date/opening/interest/principal/instalment/closing, total_cost_of_credit, apr); @invariant DisclosedAPR: APR "on an actual/365 basis" while "accrual uses 30/360" (config apr_day_count "actual/365" vs accrual_day_count "30/360") | Returns the full per-period schedule, total cost of credit, and an APR disclosed on actual/365 while accrual stays 30/360, capturing the non-obvious dual day-count quirk exactly. |

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
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-YgBLh7/spec.allium",
        "line": 60
      },
      "message": "Field 'Loan.annual_nominal_rate' is declared but not referenced elsewhere.",
      "severity": "info"
    },
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg/wpmf
```
