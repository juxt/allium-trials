# superpowers — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 5 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ Architectural work under the brainstorming process; the amortisation method is the first material policy the brief omits and cannot be safely inferred, so I ask one focused question before proposing any design.

Q: Before I design this, one foundational question about the repayment structure: what kind of schedule is this product? An equal-total-instalment (annuity) schedule where each payment is the same and the interest/principal split shifts over the term, an equal-principal schedule where principal is constant and the total payment declines, or something else your institution has standardised on?
A: Equal-principal schedule: the principal portion is constant each period (P/n), interest is charged on the reducing balance, so the total instalment decreases over the term. Not an annuity/EMI structure.

### Round 2
_Step reasoning:_ Schedule type is settled; the next foundational policy I cannot infer is how per-period interest is derived from the annual nominal rate (flat rate/12 vs a day-count convention), and I ask one question at a time per the process.

Q: Now the interest basis: how is each period's interest computed from the annual nominal rate on the reducing balance? Specifically, do you apply a simple monthly rate of (annual nominal rate / 12) to the outstanding balance regardless of month length, or a day-count convention (e.g. actual/365, actual/360, 30/360) that makes each period's interest depend on the actual number of days between instalment dates?
A: 30/360 day-count convention: every month counts as 30 days, the year as 360. The monthly rate applied to the outstanding balance is therefore (annual nominal rate × 30 / 360), i.e. exactly 1/12 of the annual rate regardless of actual month length. Not actual/365 or actual/360.

### Round 3
_Step reasoning:_ Schedule type and day-count are fixed; rounding precision, rounding rule, and residual handling remain material undetermined policies that cannot be inferred and must be confirmed before specifying.

Q: On rounding and the final instalment: monetary amounts need rounding to the currency's minor unit (e.g. cents), and a constant principal of P/n rarely divides evenly, so the rounded principal portions won't sum exactly to P and interest amounts will carry fractions. How does your institution handle this? Specifically, (a) to how many decimal places do you round the principal and interest of each instalment, using which rounding rule (half-up, half-even/banker's, truncate)? and (b) where does the accumulated rounding residual go, so the running balance reaches exactly zero, is the final instalment's principal adjusted to clear the remaining balance, or is the residual distributed some other way?
A: (a) Each instalment is rounded to the whole Kenyan shilling — no cents. Rounding rule is half-up [default, not policy]. Within each period, interest on the reducing balance is computed and rounded first; principal is then taken as the remainder of the rounded instalment, so the two components always sum exactly to the rounded instalment without a separate rounding step on principal. (b) The accumulated rounding residual is settled entirely in the final instalment: the last principal portion is whatever is needed to clear the exact remaining balance, so the schedule closes at exactly zero.

### Round 4
_Step reasoning:_ The disbursement date is a declared input yet no captured policy consumes it; the first-period/stub-interest and due-date convention are material, non-inferable decisions still outstanding.

Q: The brief gives the disbursement date as an input, but nothing so far uses it. Two things turn on it: (a) the instalment due dates, is the first instalment due exactly one calendar month after disbursement, with subsequent instalments on the same day-of-month each month, and are those dates part of what generate_schedule returns? and (b) the first period's interest, does interest accrue only from the first instalment onward (every period a full 30/360 month), or is there a stub period between disbursement and the first instalment date where interest is charged on days actually elapsed before the regular monthly schedule begins?
A: (a) Yes: the first instalment is due exactly one calendar month after the disbursement date, with subsequent instalments on the same day-of-month each month thereafter. Due dates are part of generate_schedule's output — each row in the returned schedule includes the due date alongside opening balance, interest, principal, instalment, and closing balance. (b) Interest accrues from the disbursement date itself. Because the first due date is defined as disbursement + one month, the first period is always a full 30/360 month and no stub arises in the standard case. However, if disbursement ever precedes a fixed first-period-start date (i.e. the two differ), a stub interest charge is levied for those extra days at the daily rate implied by 30/360 — partial-period interest is explicitly permitted and charged rather than waived.

### Round 5
_Step reasoning:_ Four material policies (schedule type, day-count, rounding/residual, dates+stub) are settled, but month-end day-of-month rollover is a distinct, non-inferable date-convention decision the institution must specify before the schedule is fully determined.

Q: One remaining date-convention edge that turns on institution policy and can't be inferred: when the disbursement day-of-month doesn't exist in a later month, how is the due date resolved? For example, disbursement on the 31st (first due the 31st where it exists) landing in a 30-day month or February, or disbursement on the 29th/30th hitting February. Do you roll to the last day of the short month, roll forward to the 1st of the next month, or always anchor to the last day of the month once a month-end date is hit? And does the 30/360 interest for that period stay a full month regardless of the actual calendar dates chosen?
A: [default, not policy] Roll to the last day of the short month — so a disbursement on the 29th, 30th or 31st that falls in a month where that day does not exist produces a due date of the last calendar day of that month. Once a due date has been pinned to month-end in this way, all subsequent due dates also fall on the last day of their respective months (end-of-month anchor convention). Under 30/360 the interest for every regular period remains exactly annual-rate × 30/360 regardless of the actual calendar dates chosen, so no adjustment to the interest amount arises from the date roll.

### Round 6 (process signalled done)
_Step reasoning:_ All five material, non-inferable policy axes (schedule type, day-count, rounding/residual, due-date derivation and stub interest, month-end roll) are now settled, so requirements elicitation is complete and the next brainstorming stage is design synthesis, not further stakeholder questions.

(no questions this round)

## Produced specification

# Repayment schedule engine — design specification

Date: 2026-09-28
Status: approved for planning

## Purpose and intended outcome

Build the repayment schedule engine for the loan product. Given a disbursed loan, `generate_schedule(loan)` returns the full repayment schedule: for each instalment, its due date, opening balance, interest due, principal due, total instalment, and closing (running) balance. The schedule must close at exactly zero.

The design brief named only the domain and the interface. Every material policy decision below was settled with the stakeholder and is recorded here as the authoritative source. Two points were not covered by institution policy and are resolved by sensible default; both are flagged explicitly.

## Inputs

A `loan` carrying:

- `principal` — the disbursed amount, denominated in Kenyan shillings (KES).
- `annual_nominal_rate` — the annual nominal interest rate.
- `term` — the number of monthly instalments, `n`.
- `disbursement_date` — the date the loan was disbursed.

An optional `first_period_start_date` supports the stub case described under "Dates and the first period". In the standard case it is absent and the first period start equals the disbursement date.

## Output

The schedule is an ordered collection of `n` rows, one per instalment. Each row contains:

- `due_date`
- `opening_balance`
- `interest`
- `principal`
- `instalment` (interest + principal)
- `closing_balance`

The first row's opening balance is the loan principal; each subsequent opening balance is the prior closing balance; the final row's closing balance is exactly zero.

## Schedule structure — equal principal

This is an equal-principal (constant amortisation) schedule, not an annuity/EMI schedule.

- The principal portion is constant at `P / n` each period.
- Interest is charged on the reducing outstanding balance.
- The total instalment therefore declines over the term as the balance falls.

The final period departs from the constant `P / n` only to absorb the accumulated rounding residual (see "Rounding and the final instalment").

## Interest basis — 30/360

Interest uses the 30/360 day-count convention. Every month counts as 30 days and every year as 360 days. The monthly rate applied to the outstanding balance is:

    monthly_rate = annual_nominal_rate * 30 / 360

which is exactly one twelfth of the annual nominal rate, independent of the actual number of days in any calendar month. This is not actual/365 or actual/360.

Each regular period's interest is `opening_balance * monthly_rate`, computed on the reducing balance.

## Rounding and the final instalment

All monetary amounts are rounded to the whole Kenyan shilling. There are no cents.

The rounding rule is half-up. This was not fixed by institution policy and is adopted as the default; it is the only default of consequence in the numeric computation and should be confirmed before release.

Within each regular period:

1. Interest on the reducing balance is computed and rounded to the whole shilling first.
2. Principal is then taken as the remainder of the rounded instalment, so interest and principal always sum exactly to the rounded instalment. Principal is not rounded in a separate step.

The accumulated rounding residual is settled entirely in the final instalment. The last period's principal portion is whatever is required to clear the exact remaining balance, so the running balance reaches exactly zero. No residual is distributed across earlier instalments.

## Dates and the first period

Due dates are part of the returned schedule; each row carries its `due_date`.

- The first instalment is due exactly one calendar month after the disbursement date.
- Every subsequent instalment falls on the same day-of-month, one month after the previous, subject to the month-end rule below.

Interest accrues from the disbursement date itself. Because the first due date is defined as disbursement plus one month, the first period is a full 30/360 month in the standard case and no stub arises.

Stub period: if the disbursement date ever precedes a distinct `first_period_start_date` (the two differ), a stub interest charge is levied for those extra days at the daily rate implied by 30/360, before the regular monthly schedule begins. Partial-period interest is explicitly permitted and charged, never waived. In the standard case the two dates coincide and no stub is produced.

## Month-end date resolution

When the disbursement day-of-month does not exist in a later month, the due date rolls to the last day of that short month. A disbursement on the 29th, 30th or 31st landing in a month without that day (for example February, or a 30-day month for the 31st) produces a due date of the last calendar day of that month.

Once a due date has been pinned to month-end this way, all subsequent due dates also fall on the last day of their respective months (end-of-month anchor convention).

This roll-to-month-end behaviour was not fixed by institution policy and is adopted as the default; confirm before release.

Under 30/360 the interest for every regular period remains exactly `annual_nominal_rate * 30 / 360` regardless of the actual calendar dates chosen, so the date roll never changes an interest amount.

## Error handling

- A non-positive `principal` or `term` is invalid and rejected.
- A negative `annual_nominal_rate` is invalid; a zero rate is valid and yields zero interest in every period, with equal principal instalments.
- A missing or unparseable `disbursement_date` is rejected.
- A `first_period_start_date` earlier than the disbursement date is invalid; equal dates give the standard no-stub case, a later date gives the stub case.

Validation happens before any schedule rows are produced.

## Testing

- Equal-principal shape: principal portion constant at `P / n` for every regular period; total instalment strictly declining while the rate is positive.
- 30/360 interest: each regular period's interest equals `opening_balance * annual_nominal_rate / 12`, independent of calendar month length.
- Closure: rounded principal and interest sum to the instalment each period; the final closing balance is exactly zero; the final principal absorbs the whole residual.
- Rounding: amounts are whole shillings with half-up behaviour at the boundary.
- Due dates: first due one calendar month after disbursement; subsequent dates on the same day-of-month; month-end anchor holds once a short month forces the roll (29th/30th/31st into February and 30-day months).
- Stub: when `first_period_start_date` is later than disbursement, a stub interest charge for the extra days at the 30/360 daily rate precedes the regular schedule; standard case produces no stub.
- Edge cases: zero rate; term of one; a principal that divides evenly by `n` versus one that does not.

## Decisions settled

1. Equal-principal schedule, constant `P / n`, interest on the reducing balance, declining total instalment. Not annuity/EMI.
2. 30/360 day-count; monthly rate is exactly one twelfth of the annual nominal rate.
3. Round to whole Kenyan shilling, half-up (default, not stated policy). Interest rounded first; principal is the remainder of the rounded instalment.
4. Accumulated rounding residual settled entirely in the final instalment; schedule closes at exactly zero.
5. First instalment due one calendar month after disbursement; same day-of-month thereafter; due dates are part of the output; each row carries due date, opening balance, interest, principal, instalment, closing balance.
6. Interest accrues from the disbursement date; standard first period is a full 30/360 month with no stub; a stub interest charge applies only when disbursement precedes a distinct first-period-start date, at the 30/360 daily rate, and is charged not waived.
7. Non-existent day-of-month rolls to the last day of the short month; month-end anchor holds for all subsequent due dates (default, not stated policy); 30/360 interest stays a full month regardless of the dates chosen.

## Auditor verdict

_The spec correctly resolves 10 of 14 decisions (1,2,3,4,5,7,8,9,12,13), including all of the bespoke method/rounding/temporal choices it addresses. It misses precision on #6 (states whole-shilling/no-cents rather than the reference's 2 decimal places), and fails to surface the two prepayment/settlement policies (#10 Rule of 78 rebate, #11 fixed-term re-amortisation) and the disclosure half of #14 (total cost of credit and actual/365 APR). Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the reducing outstanding balance"; "interest on the reducing balance" (Schedule structure / Interest basis). | The spec explicitly uses declining balance on the reducing principal, matching the reference exactly. |
| 2 | yes | **yes** | "This is an equal-principal (constant amortisation) schedule, not an annuity/EMI schedule. The principal portion is constant at P / n each period... The total instalment therefore declines over the term." | Equal-principal with constant P/n, interest on reducing balance, and declining instalment; explicitly not EMI. Matches the reference precisely. |
| 3 | yes | **yes** | "Interest uses the 30/360 day-count convention. Every month counts as 30 days and every year as 360 days... This is not actual/365 or actual/360." | 30/360 stated explicitly with the off-default flag, matching the reference. |
| 4 | yes | **yes** | "Each regular period's interest is opening_balance * monthly_rate, computed on the reducing balance"; monthly_rate = annual * 30/360 (Interest basis). | Interest is computed once per monthly period on the balance, not by daily accrual, so the calculation period equals the repayment period as required. |
| 5 | yes | **yes** | "Interest accrues from the disbursement date itself"; "if the disbursement date ever precedes a distinct first_period_start_date... a stub interest charge is levied for those extra days at the daily rate implied by 30/360... Partial-period interest is explicitly permitted and charged, never waived." | Accrual from disbursement and a charged stub for pre-period days match the reference exactly. |
| 6 | yes | no | "denominated in Kenyan shillings (KES)"; but "All monetary amounts are rounded to the whole Kenyan shilling. There are no cents." | Currency (KES) matches, but the reference sets precision at 2 decimal places, whereas the spec declares no cents / whole-shilling precision throughout, so the precision resolution does not match. |
| 7 | yes | **yes** | "All monetary amounts are rounded to the whole Kenyan shilling"; "The accumulated rounding residual is settled entirely in the final instalment." | Instalments rounded to the whole shilling with the residual absorbed by the final instalment, matching the reference. |
| 8 | yes | **yes** | "Interest on the reducing balance is computed and rounded to the whole shilling first. Principal is then taken as the remainder of the rounded instalment." | Interest rounded first, principal as the remainder, exactly the reference ordering. |
| 9 | yes | **yes** | "the final row's closing balance is exactly zero"; "the running balance reaches exactly zero." | The final instalment reconciles to a closing balance of exactly zero, matching the reference. |
| 10 | no | no | absent | The spec never mentions early full settlement, payoff, or any unearned-interest rebate, so the Rule of 78 policy is entirely unaddressed. |
| 11 | no | no | absent | No mention of partial prepayment, extra payments, or re-amortisation, so the principal-first / fixed-term re-amortisation policy is unaddressed. |
| 12 | yes | **yes** | "A non-positive principal or term is invalid and rejected." | Zero or negative principal/term rejected as invalid, matching the reference. |
| 13 | yes | **yes** | "The first instalment is due exactly one calendar month after the disbursement date. Every subsequent instalment falls on the same day-of-month, one month after the previous." | First due date is disbursement + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | no | Output section lists per-row due_date, opening_balance, interest, principal, instalment, closing_balance; but no total cost of credit and no APR disclosure appear anywhere. | The full per-period schedule shape is delivered, but the total cost of credit (sum of interest) and the disclosed APR on an actual/365 basis are entirely absent, so the compound decision is not correctly resolved. |
