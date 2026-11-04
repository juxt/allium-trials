# allium-elicit — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 21 · Captured: 13/14 · Bespoke captured: 5/6

## Conversation

### Round 1
_Step reasoning:_ Elicit process forbids assuming omitted policy; I must ask the stakeholder to pin the core amortisation method, interest basis, rounding, dates and result shape before specifying.

Q: What amortisation method does this product use: equal total instalments (annuity, where each payment is the same and the principal/interest split shifts over time), equal principal (constant principal per instalment with declining interest), or interest-only with a final balloon of principal?
A: Equal principal: each period carries a constant principal portion (P/n), interest is charged on the declining outstanding balance, so the total instalment decreases over the term. Not an annuity/EMI structure, not interest-only with a balloon.

Q: How is the interest for each instalment computed: is it simply the annual nominal rate divided by 12 applied to the outstanding balance, or is it accrued on actual days elapsed between instalment dates under a day-count convention (e.g. actual/365, actual/360, 30/360)?
A: Interest is computed once per monthly period using the 30/360 day-count convention (every month treated as 30 days, year as 360). It is not daily accrual. The periodic rate is the annual nominal rate × (30/360), applied to the opening balance of each period.

Q: To what precision are the interest, principal and balance figures rounded (e.g. whole currency minor units / 2 decimal places), which direction does rounding go, and where does any accumulated rounding remainder land (typically absorbed into the final instalment)?
A: Amounts are denominated in KES to 2 decimal places. Within each period, interest is computed and rounded first; principal is then the remainder of the (rounded) instalment. Each instalment is rounded to the whole shilling (no cents). Any accumulated rounding difference across all periods is absorbed into the final instalment, which is reconciled so the closing balance is exactly zero.

Q: When is the first instalment due relative to the disbursement date (e.g. one month after, or on a fixed day-of-month), and how are subsequent due dates derived, especially for month-end and short-month cases?
A: The first instalment is due on disbursement date + one month; subsequent instalments fall monthly on that same day-of-month thereafter. Specific month-end and short-month edge-case handling (e.g. disbursed on the 31st into a 28-day month) is not defined by policy — apply a reasonable convention such as clamping to the last day of the month [default, not policy].

Q: What exactly must each row of the returned schedule contain, field by field (e.g. instalment number, due date, opening balance, interest due, principal due, total payment, closing/running balance), and should the schedule guarantee the final closing balance is exactly zero?
A: Each schedule row must contain: due date, opening balance, interest due, principal due, total instalment (interest + principal), and closing balance. The schedule must guarantee the final closing balance is exactly zero (the last instalment is adjusted to absorb any rounding remainder). The schedule is accompanied by the total cost of credit (sum of all interest charges) and the disclosed APR computed on an actual/365 basis.

### Round 2
_Step reasoning:_ Core method, precision, rounding, dating and output shape are pinned, but whole-life events, the exact APR definition (disclosed on a different basis), and degenerate inputs remain unasked assumptions the completeness gate requires me to put to the stakeholder.

Q: Scope of the whole life: is `generate_schedule` only ever computing the schedule as at disbursement, or must it also handle later events — early/partial prepayment and settlement, missed payments and arrears, restructuring or rate changes, cancellation? For each, is it in scope for this spec or explicitly excluded?
A: generate_schedule computes the schedule as at disbursement. Two post-disbursement events are in scope: (a) early full settlement — unearned interest rebated by the Rule of 78 (sum-of-the-digits); (b) partial prepayment where the loan continues — the prepayment amount is applied entirely to principal, then the schedule is re-amortised keeping the original term fixed (the instalment reduces, not the term). Missed payments and arrears tracking, restructuring, rate changes within a live loan, and cancellation are not defined by policy and are out of scope for this spec.

Q: How exactly is the disclosed APR computed on the actual/365 basis? Is it the internal rate of return that equates the disbursed principal to the actual dated cashflows (the real due dates), solved to what precision and expressed as what (effective annual rate, nominal annualised)? Since it is disclosed on a different basis than interest accrues, please pin the exact definition.
A: The disclosed APR is the internal rate of return — the discount rate that equates the net disbursement (principal advanced) to the present value of the actual dated cashflows (each instalment on its real due date), computed under an actual/365 day-count. It is expressed as an effective annual rate. Solving precision and exact solver algorithm are not defined by policy [default, not policy: solve to at least 4 decimal places, e.g. 12.34%, using Newton–Raphson or bisection]. Note: this rate is disclosed only; interest accrual uses 30/360 throughout.

Q: How are degenerate inputs handled: a zero (or negative) annual interest rate, a term of exactly one instalment, and a zero or non-positive principal — is each computed normally, rejected, or out of scope?
A: A zero or negative principal is rejected as invalid with an error. A zero or negative term (number of instalments) is rejected as invalid with an error. A term of exactly one instalment is not explicitly excluded — compute it normally [default, not policy]. A zero annual interest rate is not addressed by policy — treat it as valid and produce a schedule with zero interest charges [default, not policy]. A negative annual interest rate is not addressed by policy — reject it as invalid [default, not policy].

Q: Is the annual nominal rate always the input, with the periodic rate derived as rate × 30/360, and is that rate fixed for the whole term (no scheduled rate changes within a single loan)?
A: Yes on both counts. The annual nominal rate is always the input; the periodic rate for each month is derived as annual_rate × (30/360). The rate is fixed for the whole term of a single loan — no scheduled rate changes within one loan are defined by policy. This is consistent with the equal-principal structure where the only variables per period are the opening balance and the (fixed) principal portion.

### Round 3
_Step reasoning:_ Core method, precision, output shape, APR, degenerate inputs and whole-life events are settled, but rounding direction, the exact Rule-of-78 rebate mechanics, and partial-prepayment timing/re-amortisation detail remain genuinely underspecified policy decisions with multiple plausible answers.

Q: Rounding direction: each instalment (and the interest figure computed first) is rounded to the whole shilling — but in which direction? Round half up, round half to even (banker's), always round down (floor), or always up? And when interest is rounded to the whole shilling before principal is taken as the remainder, does that same direction apply?
A: Rounding direction for instalments and interest is not defined by policy [default, not policy: round half up — standard arithmetic rounding, i.e. 0.5 rounds away from zero — applied consistently to both the interest figure and the resulting total instalment in each period].

Q: For early full settlement under the Rule of 78: please pin the exact rebate mechanics. Is the rebate fraction the sum-of-digits of the remaining periods divided by the sum-of-digits of all n periods, applied to the total contractual interest? Is the fraction based on the number of instalments already paid (so settlement between due dates rounds to a whole period), or pro-rated within a period? And what does the settlement figure comprise, field by field: outstanding principal, plus any earned-but-unpaid interest, minus the rebate — and is it rounded on the same whole-shilling basis?
A: The Rule of 78 rebate fraction is the sum-of-the-digits of remaining periods divided by the sum-of-the-digits of all n periods (e.g. for n=12, denominator is 78), applied to the total contractual interest charged over the full term. Whether settlement between due dates is treated as a whole period or pro-rated within a period is not defined by policy [default, not policy: round to the nearest whole period — a settlement occurring after the k-th due date but before the (k+1)-th counts k periods as paid, n−k as remaining]. The settlement figure is not broken down field by field by policy [default, not policy: outstanding principal balance, plus any interest earned in the current period up to the settlement date but not yet paid, minus the rebate on unearned future interest; the net settlement amount is rounded to the whole shilling on the same basis as instalments].

Q: For partial prepayment with the term kept fixed: at what point can it occur — only on a scheduled due date, or on any date (and if mid-period, is any interest accrued to that date first)? After applying the prepayment to principal, how is the new constant principal portion derived — remaining outstanding balance divided by the number of remaining instalments? Is there a minimum prepayment amount, or a cap on how many partial prepayments a loan may take?
A: Timing of a partial prepayment is not defined by policy [default, not policy: permitted only on a scheduled due date, after the regular instalment for that period has been applied, so no mid-period interest accrual is required]. After the prepayment is applied to principal, the new constant principal portion for remaining periods is the updated outstanding balance divided by the number of remaining instalments — consistent with the equal-principal structure with term fixed. A minimum prepayment amount and a cap on the number of partial prepayments are not defined by policy [default, not policy: no minimum, no cap, except that the prepayment may not exceed the outstanding principal balance].

### Round 4
_Step reasoning:_ Core method, fees/net-disbursement composition, and post-event disclosure recomputation remain genuinely ambiguous or unasked; notably an unresolved contradiction between the equal-principal definition and the stated principal-as-remainder rounding rule.

Q: The equal-principal structure defines a constant principal portion (P/n) per period, with interest charged on the declining balance and the total instalment falling over the term. But the Round 1 rounding answer described principal as "the remainder of the (rounded) instalment" (interest rounded first, then principal = instalment − interest), which is annuity-style logic. These conflict. Which governs: is the principal portion P/n rounded to the whole shilling each period and the rounded interest added on top to form the total instalment, or is a total instalment figure rounded first with principal taken as the remainder after interest?
A: Item 8 governs the within-period mechanics. Interest is computed on the opening balance, rounded first to the whole shilling. The total instalment is then rounded to the whole shilling. Principal for that period is the remainder: rounded instalment minus rounded interest. The equal-principal structure (P/n) defines the nominal base from which the instalment is built, but the per-period principal figure in the schedule is derived as the remainder after rounding — not P/n rounded directly. Any cumulative deviation from strict P/n equality is absorbed in the final instalment, which is reconciled so the closing balance is exactly zero.

Q: Are there any fees or charges (arrangement, origination, disbursement, insurance, or similar) that form part of the total cost of credit, enter the APR cashflows, or reduce the net disbursement below the principal advanced? The APR definition referred to "net disbursement", which implies deductions may exist. If there are none, please confirm the net disbursement equals the principal exactly and interest is the only cost of credit.
A: No fees or charges of any kind are defined by policy. The net disbursement equals the principal advanced exactly. Interest is the sole cost of credit. The total cost of credit is the sum of all interest charges appearing on the schedule.

Q: Are the total cost of credit and the disclosed APR computed once against the schedule as generated at disbursement, or are they recomputed after an in-scope partial prepayment re-amortisation (which reduces future interest)? And is the total cost of credit the sum of the rounded interest figures actually appearing on the schedule rows?
A: Whether TCC and APR are recomputed after a partial prepayment re-amortisation is not defined by policy [default, not policy: recompute both against the revised schedule after each re-amortisation event; the TCC is the sum of the rounded interest figures as they appear on the current schedule rows, and the APR is re-solved against the revised dated cashflows from the re-amortisation date forward]. For the original schedule at disbursement, both are computed once against the generated schedule. The TCC is the sum of the rounded interest figures as they appear on the schedule rows.

### Round 5
_Step reasoning:_ Every major decision class is pinned, but the whole-life interaction between the two in-scope post-disbursement events (Rule of 78 base and period-count after a re-amortisation) is materially ambiguous and not yet asked; policy could reasonably differ here.

Q: We have two in-scope post-disbursement events: partial prepayment (re-amortise, term fixed) and early full settlement (Rule of 78 rebate). How do they compose over a loan's life? Specifically: (a) can a loan take a partial prepayment and then later be settled early, and can multiple partial prepayments precede a settlement? (b) When early settlement follows one or more partial prepayments, is the Rule of 78 rebate computed against the *original* schedule's contractual interest and original n, or against the *revised* (re-amortised) schedule's remaining contractual interest and its remaining periods? (c) Does the settlement's 'periods paid vs remaining' count reset or re-base at the re-amortisation date, or keep counting from original disbursement?
A: Composition of the two events is not defined by policy for any of the sub-questions in this round. The following are defaults, not policy. (a) [default, not policy] Yes: a loan may take one or more partial prepayments and subsequently be settled early; multiple partial prepayments before settlement are permitted, subject only to the existing constraint that no single prepayment may exceed the outstanding principal balance. (b) [default, not policy] After one or more partial prepayments, the Rule of 78 rebate for early full settlement is computed against the *revised* (re-amortised) schedule in force at the time of settlement: the denominator is the sum-of-the-digits of the remaining instalments on that revised schedule, and the total contractual interest figure to which the fraction is applied is the sum of the remaining interest charges on that same revised schedule — not the original schedule's figures. (c) [default, not policy] The 'periods paid vs remaining' count does not reset at a re-amortisation date; it continues from original disbursement. Periods paid equals the number of scheduled instalments that have fallen due and been paid since disbursement (across all re-amortisation events); remaining periods equals the total number of remaining scheduled instalments on the current revised schedule. The sum-of-the-digits denominator is computed over those remaining periods only, consistent with (b) above.

### Round 6
_Step reasoning:_ Policy space is nearly drained, but Round 3 left a genuine unresolved conflict between whole-period settlement counting and a mid-period earned-interest component, and the re-amortised schedule's rounding/reconciliation mechanics were never confirmed — both material before concluding.

Q: On early full settlement timing and the earned-interest component: Round 3 said settlement counts whole periods (k paid, n−k remaining, no pro-rating) yet the settlement figure was described as outstanding principal plus 'interest earned in the current period up to the settlement date but not yet paid'. These conflict — if periods are counted whole, is any partial current-period interest ever charged? Please pin: (a) can settlement occur on any date or only on a scheduled due date (as partial prepayment is restricted)? (b) If mid-period settlement is allowed, is current-period earned-but-unpaid interest charged, and on what day-count basis (30/360 pro-rata, actual days, or none)? (c) Does the settlement quote comprise exactly: outstanding principal + earned-unpaid interest (if any) − Rule-of-78 rebate, with nothing else?
A: Settlement timing is not defined by policy, and the Round 3 defaults are internally inconsistent as written. To resolve the conflict, the following consistent defaults apply — none are policy. (a) [default, not policy] Settlement may occur on any date, not only on a scheduled due date. (b) [default, not policy] If settlement occurs mid-period, the current partial period's earned-but-unpaid interest is charged separately from the Rule of 78 rebate calculation. The two are not in conflict: the Rule of 78 fraction is determined by counting k whole periods paid (no pro-rating), while the partial current-period interest is an additional component charged for days elapsed since the last due date, computed on the same 30/360 pro-rata basis used for stub periods at disbursement (annual rate × (days elapsed / 360), where each month is treated as 30 days). (c) [default, not policy] The settlement quote comprises exactly three components and nothing else: outstanding principal balance, plus earned-but-unpaid interest for the partial current period (zero if settlement falls on a due date), minus the Rule of 78 rebate on unearned future interest. The net amount is rounded to the whole shilling on the same basis as instalments.

Q: On the revised schedule produced by a partial prepayment re-amortisation: do the same within-period mechanics apply — interest computed on opening balance and rounded to the whole shilling first, total instalment rounded, principal taken as the remainder — and is the same final-instalment reconciliation reapplied so the revised schedule's closing balance is also exactly zero? And is the new constant principal (balance ÷ remaining instalments) recomputed afresh at each successive prepayment?
A: The same within-period mechanics apply to every schedule, original or revised — this follows from the policy items already established, not from separate rules for re-amortised schedules. Interest is computed on the opening balance and rounded to the whole shilling first; the total instalment is rounded to the whole shilling; principal for that period is taken as the remainder (rounded instalment minus rounded interest). The final-instalment reconciliation is reapplied on the revised schedule so that its closing balance is also exactly zero. At each successive partial prepayment, the new constant nominal principal base is recomputed afresh as the updated outstanding balance divided by the number of remaining instalments at that point; prior re-amortisation bases are discarded.

### Round 7
_Step reasoning:_ Core method, rounding, whole-life events and output fields are pinned, but the due-date calendar/business-day adjustment (a real timing-class policy affecting APR cashflow dates) and the exact return-object shape (row numbering, where TCC/APR live) remain genuinely unasked.

Q: When a scheduled instalment due date falls on a weekend or public (Kenyan) holiday, is the due date adjusted under a business-day convention (following business day, modified following, or preceding), or is it left unadjusted on the calendar day? And if dates do shift, does the shift change the dated cashflows used for the actual/365 APR calculation (the 30/360 interest itself being date-independent)?
A: Business-day adjustment for due dates falling on weekends or Kenyan public holidays is not defined by policy [default, not policy: due dates are left unadjusted on the calendar day — no business-day convention is applied]. If a convention were applied, shifted dates would change the actual dated cashflows and therefore the actual/365 APR calculation, while the 30/360 interest accrual for each period would remain unaffected (the periodic rate is date-independent under 30/360).

Q: Output shape: must each schedule row also carry an instalment sequence number (1..n) as a required field, and are the total cost of credit and the disclosed APR returned as fields of the object that generate_schedule returns, or as separate values accompanying the schedule?
A: An instalment sequence number (1..n) is not listed as a required field by policy [default, not policy: include it as a convenience field on each row]. The total cost of credit and the disclosed APR are fields of the same object that generate_schedule returns, alongside the schedule array — not separate return values.

### Round 8
_Step reasoning:_ Every other decision class in the completeness gate has been answered; the one genuinely material, still-unasked item is whether an irregular/stub first period exists, which the invented Round 6 wording implied but Round 1 seemed to exclude, and it affects first-period interest, the schedule and the APR.

Q: One point still open before I close out: is the period from disbursement to the first instalment always exactly one full 30/360 month (so every period, including the first, carries a full month's interest at annual_rate × 30/360), or can the loan have an irregular first period? The Round 6 answer referred to '30/360 pro-rata basis used for stub periods at disbursement', which implies a broken/stub first period may exist, yet Round 1 fixed the first instalment at disbursement + one month on the same day-of-month, which yields no stub. Please pin: (a) does this product ever have a long or short first period (e.g. disbursement on the 5th but instalments due on a fixed day such as month-end), and if so, how is that first period's interest computed and rounded; or (b) is the first period always a full period so no stub interest ever arises?
A: (b): the first period is always a full period — no stub arises. The schedule is anchored to the disbursement date: the first instalment falls on disbursement date + one month (item 13), so the first interest period is exactly one full 30/360 month (annual_rate × 30/360 applied to the opening principal). The stub-period provision in item 5 — 'if disbursement precedes the first period start, a stub interest charge is levied' — is a conditional that is never triggered under this product's schedule definition, because the period start IS the disbursement date. The Round 6 reference to '30/360 pro-rata used for stub periods at disbursement' was describing the day-count method that would apply to partial-period interest on mid-period early settlement, not an assertion that a stub first period can occur.

## Produced specification

-- allium: 3
--
-- Loan repayment schedule generation for a KES equal-principal product.
--
-- Provenance tags used throughout:
--   [policy]              settled by the stakeholder as product policy
--   [default, not policy] a reasonable convention adopted where policy is silent
--
-- The core operation is generate_schedule, computed as at disbursement. Two
-- post-disbursement events are in scope: partial prepayment (re-amortise, term
-- fixed) and early full settlement (Rule of 78 rebate). Missed payments and
-- arrears, restructuring, mid-loan rate changes and cancellation are out of
-- scope. [policy]
--
-- Amounts are Decimal shillings (KES). The product denominates to 2 decimal
-- places but interest and instalments are rounded to the whole shilling; the
-- rounding rules are stated on the generation rule. Dates are Timestamps.

config {
    currency: String = "KES"                    -- amounts denominated in KES [policy]
    amount_precision: Integer = 2               -- KES carries 2 decimal places [policy]
    instalment_unit: Integer = 1                -- interest and instalments round to the whole shilling [policy]
    interest_period_days: Integer = 30          -- 30/360 day count: every month is 30 days [policy]
    interest_year_days: Integer = 360           -- 30/360 day count: the year is 360 days [policy]
    apr_year_days: Integer = 365                -- APR is disclosed on an actual/365 basis [policy]
    apr_precision: Integer = 4                   -- APR solved to at least 4 decimal places [default, not policy]
}

-- ---------------------------------------------------------------------------
-- Inputs and validation
-- ---------------------------------------------------------------------------

-- A request to generate a schedule. The annual nominal rate is always the
-- input; there are no fees of any kind, so the net disbursement equals the
-- principal advanced exactly and interest is the sole cost of credit. [policy]
entity ScheduleRequest {
    principal: Decimal                          -- principal advanced (net disbursement)
    annual_rate: Decimal                        -- annual nominal interest rate
    term: Integer                               -- number of monthly instalments (n)
    disbursement_date: Timestamp

    -- Outcome of validation. Modelled as an outcome enum (not a lifecycle
    -- `status`) since a request is validated once and does not transition
    -- further.
    outcome: accepted | rejected
}

-- Zero or negative principal is invalid. [policy]
rule RejectNonPositivePrincipal {
    when: r: ScheduleRequest.created
    requires: r.principal <= 0
    ensures: r.outcome = rejected
}

-- Zero or negative term is invalid. [policy]
rule RejectNonPositiveTerm {
    when: r: ScheduleRequest.created
    requires: r.principal > 0 and r.term <= 0
    ensures: r.outcome = rejected
}

-- A negative annual rate is rejected. [default, not policy]
rule RejectNegativeRate {
    when: r: ScheduleRequest.created
    requires: r.principal > 0 and r.term > 0 and r.annual_rate < 0
    ensures: r.outcome = rejected
}

-- A valid request is accepted and the loan is disbursed. A term of exactly one
-- instalment is computed normally [default, not policy]; a zero annual rate is
-- valid and yields a schedule with zero interest charges [default, not policy].
rule AcceptScheduleRequest {
    when: r: ScheduleRequest.created
    requires: r.principal > 0 and r.term > 0 and r.annual_rate >= 0
    ensures: r.outcome = accepted
    ensures: Loan.created(
        principal: r.principal,
        annual_rate: r.annual_rate,
        term: r.term,
        disbursement_date: r.disbursement_date,
        outstanding_principal: r.principal,
        remaining_instalments: r.term,
        settled: false
    )
}

-- ---------------------------------------------------------------------------
-- The loan and its live balance
-- ---------------------------------------------------------------------------

entity Loan {
    principal: Decimal                          -- original principal advanced
    annual_rate: Decimal                        -- annual nominal rate, fixed for the whole term [policy]
    term: Integer                               -- original number of instalments (n)
    disbursement_date: Timestamp

    -- Live balance at the point of any in-scope event. Payment and arrears
    -- tracking as such is out of scope; these fields carry only the state the
    -- in-scope events read and update.
    outstanding_principal: Decimal
    remaining_instalments: Integer

    -- The loan is live until it is fully settled early. Modelled as a boolean
    -- rather than a lifecycle `status`; missed payments, arrears, restructuring,
    -- rate changes and cancellation are out of scope. [policy]
    settled: Boolean

    -- The periodic rate is the annual nominal rate scaled by the 30/360 month.
    -- Fixed for the whole term; no scheduled rate changes occur. [policy]
    periodic_rate: annual_rate * config.interest_period_days / config.interest_year_days

    -- The equal-principal nominal base: constant principal portion per period.
    -- The base from which each instalment is built; the per-row principal figure
    -- is derived as a rounding remainder, not this value rounded directly. [policy]
    nominal_principal_base: principal / term

    schedules: Schedule with loan = this
    prepayments: PartialPrepayment with loan = this
    settlements: EarlySettlement with loan = this
}

-- ---------------------------------------------------------------------------
-- The schedule and its rows
-- ---------------------------------------------------------------------------

-- The object returned by generate_schedule: the rows, plus the total cost of
-- credit and the disclosed APR as fields of the same object. [policy] A new
-- Schedule with origin = reamortisation is produced by each partial prepayment;
-- the most recent one is the schedule in force.
entity Schedule {
    loan: Loan
    origin: disbursement | reamortisation

    -- Total cost of credit: the sum of the rounded interest figures as they
    -- appear on this schedule's rows. Interest is the sole cost of credit. [policy]
    total_cost_of_credit: Decimal

    -- Disclosed APR: the internal rate of return equating the net disbursement
    -- to the present value of the actual dated cashflows on their real due dates,
    -- under actual/365, expressed as an effective annual rate. Disclosed only;
    -- accrual uses 30/360 throughout. [policy]
    disclosed_apr: Decimal

    -- The last row's closing balance, guaranteed exactly zero. [policy]
    final_closing_balance: Decimal

    rows: ScheduleRow with schedule = this
}

-- One instalment period.
entity ScheduleRow {
    schedule: Schedule
    sequence: Integer                           -- instalment number 1..n [default, not policy: convenience field]
    due_date: Timestamp
    opening_balance: Decimal
    interest_due: Decimal                       -- rounded to the whole shilling
    principal_due: Decimal                      -- rounded instalment minus rounded interest
    total_instalment: Decimal                   -- interest_due + principal_due, rounded to the whole shilling
    closing_balance: Decimal
}

-- ---------------------------------------------------------------------------
-- Generation at disbursement
-- ---------------------------------------------------------------------------

rule GenerateScheduleAtDisbursement {
    when: loan: Loan.created
    ensures: Schedule.created(
        loan: loan,
        origin: disbursement,
        final_closing_balance: 0
    )
    @guidance
        -- Equal-principal amortisation. Not an annuity/EMI, not interest-only
        -- with a balloon. Each period carries a constant nominal principal
        -- portion P/n; interest is charged on the declining opening balance, so
        -- the total instalment decreases over the term. [policy]
        --
        -- Dates. The first instalment falls on disbursement_date + one month;
        -- subsequent instalments fall monthly on that same day-of-month. The
        -- first interest period is therefore always exactly one full 30/360
        -- month, so no stub period ever arises. [policy] For a day-of-month that
        -- does not exist in a shorter month, clamp to the last day of that
        -- month. [default, not policy] Due dates are left unadjusted on the
        -- calendar day; no weekend or Kenyan-holiday business-day convention is
        -- applied. [default, not policy]
        --
        -- Per-period mechanics, applied identically to every row:
        --   interest_due     = round(opening_balance * annual_rate * 30 / 360)
        --   total_instalment = round(nominal_principal_base + interest_due)
        --   principal_due    = total_instalment - interest_due
        --   closing_balance  = opening_balance - principal_due
        -- Interest is computed on the opening balance and rounded first; the
        -- total instalment is then rounded; principal is the remainder. Both
        -- roundings are to the whole shilling. [policy] Rounding direction is
        -- round half up (0.5 away from zero), applied to both interest and the
        -- total instalment. [default, not policy]
        --
        -- Row 1's opening balance is the principal; each subsequent row opens at
        -- the prior row's closing balance.
        --
        -- Final-instalment reconciliation. Any accumulated rounding difference is
        -- absorbed into the final instalment: its principal_due clears the whole
        -- remaining opening balance and its total_instalment is that principal
        -- plus its interest, so the final closing balance is exactly zero. [policy]
        --
        -- Zero annual rate yields zero interest on every row. [default, not policy]
        --
        -- Total cost of credit = sum of the rounded interest_due figures across
        -- the rows. [policy]
        --
        -- Disclosed APR = the IRR (effective annual rate) that equates the
        -- principal to the present value of the dated instalment cashflows on
        -- their real due dates under actual/365, solved to at least 4 decimal
        -- places, e.g. by Newton-Raphson or bisection. The definition is policy;
        -- the solver and precision are [default, not policy].
}

-- ---------------------------------------------------------------------------
-- Partial prepayment: re-amortise, term fixed
-- ---------------------------------------------------------------------------

-- A partial prepayment permitted only on a scheduled due date, after that
-- period's regular instalment has been applied, so no mid-period interest
-- accrues. [default, not policy] No minimum and no cap on the number of
-- prepayments; the only constraint is that a prepayment may not exceed the
-- outstanding principal. [default, not policy]
entity PartialPrepayment {
    loan: Loan
    on_due_date: Timestamp
    amount: Decimal
}

rule ApplyPartialPrepayment {
    when: p: PartialPrepayment.created
    requires: p.amount <= p.loan.outstanding_principal
    let new_balance = p.loan.outstanding_principal - p.amount
    ensures: p.loan.outstanding_principal = new_balance
    ensures: Schedule.created(
        loan: p.loan,
        origin: reamortisation,
        final_closing_balance: 0
    )
    @guidance
        -- The prepayment is applied entirely to principal, then the loan is
        -- re-amortised keeping the original term fixed: the instalment reduces,
        -- not the term. The new constant nominal principal base is the updated
        -- outstanding balance divided by the number of remaining instalments,
        -- recomputed afresh at each successive prepayment (prior bases are
        -- discarded). [policy]
        --
        -- The revised schedule uses the same per-period mechanics and the same
        -- final-instalment reconciliation as generation at disbursement, so its
        -- closing balance is also exactly zero. [policy]
        --
        -- Total cost of credit and disclosed APR are recomputed against the
        -- revised schedule: the TCC is the sum of the rounded interest on the
        -- revised rows, and the APR is re-solved against the revised dated
        -- cashflows from the re-amortisation date forward. [default, not policy]
}

-- ---------------------------------------------------------------------------
-- Early full settlement: Rule of 78 rebate
-- ---------------------------------------------------------------------------

-- Early full settlement may occur on any date. [default, not policy] A loan may
-- take one or more partial prepayments and subsequently be settled. [default,
-- not policy]
entity EarlySettlement {
    loan: Loan
    settlement_date: Timestamp
    quote: Decimal                              -- net amount to clear the loan, rounded to the whole shilling
}

rule SettleEarly {
    when: s: EarlySettlement.created
    requires: not s.loan.settled
    ensures: s.loan.settled = true
    @guidance
        -- The settlement quote comprises exactly three components and nothing
        -- else, netted and rounded to the whole shilling on the same basis as
        -- instalments: [default, not policy]
        --   (1) outstanding principal balance; plus
        --   (2) earned-but-unpaid interest for the partial current period (zero
        --       if settlement falls on a due date), charged on a 30/360 pro-rata
        --       basis, annual_rate * days_elapsed / 360 with each month treated
        --       as 30 days; minus
        --   (3) the Rule of 78 rebate on unearned future interest.
        --
        -- Rule of 78 rebate. The rebate fraction is the sum-of-the-digits of the
        -- remaining periods divided by the sum-of-the-digits of all periods on
        -- the schedule in force, applied to that schedule's total contractual
        -- interest. Periods are counted whole: a settlement after the k-th due
        -- date but before the (k+1)-th counts k periods paid and n-k remaining,
        -- with no pro-rating of the fraction itself. The Rule of 78 itself is
        -- policy; whole-period counting is [default, not policy].
        --
        -- Composition after prepayments. When settlement follows one or more
        -- partial prepayments, the rebate is computed against the revised
        -- schedule in force at settlement: the denominator is the sum-of-the-
        -- digits of the remaining instalments on that revised schedule, and the
        -- interest figure is the sum of the remaining interest on that same
        -- revised schedule. The periods-paid-versus-remaining count does not
        -- reset at a re-amortisation date; it continues from original
        -- disbursement, with remaining periods being the remaining scheduled
        -- instalments on the current revised schedule. [default, not policy]
}

-- ---------------------------------------------------------------------------
-- Structural guarantees on every schedule, original or revised
-- ---------------------------------------------------------------------------

invariant InstalmentIsInterestPlusPrincipal {
    for row in ScheduleRows:
        row.total_instalment = row.interest_due + row.principal_due
}

invariant ClosingIsOpeningMinusPrincipal {
    for row in ScheduleRows:
        row.closing_balance = row.opening_balance - row.principal_due
}

invariant InterestNonNegative {
    for row in ScheduleRows:
        row.interest_due >= 0
}

invariant PrincipalNonNegative {
    for row in ScheduleRows:
        row.principal_due >= 0
}

-- Every schedule clears exactly: the final instalment absorbs the accumulated
-- rounding remainder. [policy]
invariant ScheduleClearsToZero {
    for s in Schedules:
        s.final_closing_balance = 0
}

-- ---------------------------------------------------------------------------
-- Boundary contract
-- ---------------------------------------------------------------------------

contract ScheduleService {
    generate_schedule: (principal: Decimal, annual_rate: Decimal, term: Integer, disbursement_date: Timestamp) -> Schedule
    prepay: (loan: Loan, on_due_date: Timestamp, amount: Decimal) -> Schedule
    settle: (loan: Loan, settlement_date: Timestamp) -> EarlySettlement

    @invariant NoFees
        -- No fees or charges of any kind. The net disbursement equals the
        -- principal advanced exactly; interest is the sole cost of credit.

    @invariant DisclosedAprBasis
        -- The APR is disclosed on actual/365 as an effective-annual IRR against
        -- the real dated cashflows; interest still accrues on 30/360 throughout.
}

-- ---------------------------------------------------------------------------
-- Returned shape
-- ---------------------------------------------------------------------------

-- The exact data a caller sees for a loan: the schedule(s) in force with their
-- per-row fields, and the total cost of credit and disclosed APR carried on the
-- same object. The original schedule (origin = disbursement) plus one revised
-- schedule per partial prepayment (origin = reamortisation) are all reachable;
-- the most recent is the schedule in force. [policy]
surface LoanScheduleStatement {
    facing loan: Loan

    exposes:
        loan.periodic_rate
        loan.nominal_principal_base
        loan.outstanding_principal
        loan.remaining_instalments
        loan.settled
        for schedule in loan.schedules:
            schedule.origin
            schedule.total_cost_of_credit
            schedule.disclosed_apr
            schedule.final_closing_balance
            for row in schedule.rows:
                row.sequence
                row.due_date
                row.opening_balance
                row.interest_due
                row.principal_due
                row.total_instalment
                row.closing_balance
        for prepayment in loan.prepayments:
            prepayment.on_due_date
            prepayment.amount
        for settlement in loan.settlements:
            settlement.settlement_date
            settlement.quote

    contracts:
        fulfils ScheduleService
}


## Auditor verdict

_The spec surfaces all 14 decisions and correctly resolves 13. Coverage = 13/14. The single miss is decision 5 (interest start / stub period): the reference requires a stub interest charge to be levied when disbursement precedes the first period start, whereas the spec anchors the first period to disbursement (first due date = disbursement + one month) and explicitly states no stub period ever arises, the opposite resolution. All bespoke off-default choices (equal-principal amortisation, 30/360, same-as-repayment period, whole-shilling rounding, interest-first rounding order, Rule of 78 rebate, term-fixed re-amortisation, and the 30/360-accrual-but-actual/365-disclosure split) are captured correctly._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "interest is charged on the declining opening balance"; "interest_due = round(opening_balance * annual_rate * 30 / 360)" | Interest is computed on the reducing opening balance each period, which is declining-balance on the reducing principal. Matches the reference. |
| 2 | yes | **yes** | "Equal-principal amortisation. Not an annuity/EMI... Each period carries a constant nominal principal portion P/n; interest is charged on the declining opening balance, so the total instalment decreases over the term. [policy]" | Explicitly names equal-principal with constant P/n, interest on the reducing balance, and a decreasing total instalment, and rules out EMI. Exact match. |
| 3 | yes | **yes** | config interest_period_days: 30, interest_year_days: 360; "30/360 day count: every month is 30 days" | The 30/360 convention (every month 30 days, year 360) is stated explicitly, not actual/365. Match. |
| 4 | yes | **yes** | "interest_due = round(opening_balance * annual_rate * 30 / 360)" applied per row; "Per-period mechanics, applied identically to every row" | Interest is computed once per monthly period on the opening balance (rate × 30/360), i.e. same-as-repayment-period, not daily accrual. Match. |
| 5 | yes | no | "The first instalment falls on disbursement_date + one month... The first interest period is therefore always exactly one full 30/360 month, so no stub period ever arises. [policy]" | The reference requires interest to accrue from disbursement with a stub charge levied for extra days when disbursement precedes the first period start (partial-period interest charged). The spec instead anchors the first period to disbursement so no stub ever arises, the opposite resolution. Surfaced but contradicts the reference. |
| 6 | yes | **yes** | config currency: "KES", amount_precision: 2; "amounts denominated in KES"; "KES carries 2 decimal places" | Kenyan shilling with 2 decimal places, exactly as the reference. |
| 7 | yes | **yes** | instalment_unit: 1 "interest and instalments round to the whole shilling"; "Any accumulated rounding difference is absorbed into the final instalment" | Instalments round to the whole shilling and the accumulated rounding difference is settled in the final instalment. Exact match. |
| 8 | yes | **yes** | "Interest is computed on the opening balance and rounded first; the total instalment is then rounded; principal is the remainder." | Interest rounded first, principal is the remainder of the rounded instalment. Exact match on ordering. |
| 9 | yes | **yes** | final_closing_balance: 0; invariant ScheduleClearsToZero "s.final_closing_balance = 0"; "the final closing balance is exactly zero" | The final instalment reconciles so the closing balance is exactly zero. Match. |
| 10 | yes | **yes** | "Rule of 78 rebate. The rebate fraction is the sum-of-the-digits of the remaining periods divided by the sum-of-the-digits of all periods on the schedule in force, applied to that schedule's total contractual interest." | Unearned interest rebated by Rule of 78 (sum-of-digits), not straight-line/actuarial. Exact match. |
| 11 | yes | **yes** | "The prepayment is applied entirely to principal, then the loan is re-amortised keeping the original term fixed: the instalment reduces, not the term. [policy]" | Prepayment applied wholly to principal, then re-amortise with term fixed and instalment reduced. Exact match. |
| 12 | yes | **yes** | rule RejectNonPositivePrincipal ("principal <= 0" -> rejected); rule RejectNonPositiveTerm ("term <= 0" -> rejected) | Zero or negative principal and zero or negative term are both rejected as invalid. Match. |
| 13 | yes | **yes** | "The first instalment falls on disbursement_date + one month; subsequent instalments fall monthly on that same day-of-month. [policy]" | First due date is disbursement + one month, monthly thereafter. Exact match. |
| 14 | yes | **yes** | Schedule fields total_cost_of_credit and disclosed_apr; ScheduleRow fields (due_date, opening_balance, interest_due, principal_due, total_instalment, closing_balance); "APR is disclosed on an actual/365 basis" while "accrual uses 30/360 throughout" | Returns the full per-period schedule, total cost of credit as sum of interest, and disclosed APR on actual/365 while accrual stays 30/360. Captures the dual day-count disclosure quirk exactly. |

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
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-mMTnvM/spec.allium",
        "line": 152
      },
      "message": "Field 'ScheduleRow.schedule' is declared but not referenced elsewhere.",
      "severity": "info"
    }
  ],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-mMTnvM/spec.allium
```
