# tessl — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 6 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ Start with the highest-impact scope question — the amortisation method — since it determines the entire per-instalment computation, before moving to day-count, rounding, and edge cases.

Q: For the repayment schedule, which instalment structure should the engine use: a fixed equal total payment each period (standard amortisation, where principal and interest split shifts over the term), or equal principal each period with interest charged on the declining balance (so the total payment falls over time)?
A: Equal principal each period: a constant principal portion (P/n) per period, with interest charged on the declining balance, so the total instalment decreases over the term. Not equal total payments (EMI/standard amortisation).

### Round 2
_Step reasoning:_ Interest basis is the next highest-impact policy: it changes every interest figure and cannot be inferred from the equal-principal choice alone.

Q: How should per-period interest be computed: as a flat monthly rate of annual_nominal_rate / 12 applied to the outstanding balance each instalment, or by an actual-days day-count convention (e.g. actual/365 or 30/360) using the calendar dates between instalments?
A: Use a 30/360 day-count convention: every month counts as 30 days, the year as 360. Interest for each period is computed as (annual_nominal_rate × 30 / 360) × opening balance — not actual/365 and not a simple annual_rate/12 shortcut (though for whole months these coincide). The period is always one month.

### Round 3
_Step reasoning:_ Interest convention and instalment structure are settled, but rounding precision and remainder allocation remain unspecified and materially change every schedule row, so I ask that next before edge cases like timing.

Q: To what precision should the amounts be rounded, and how should any rounding residue be handled: specifically, should the constant principal portion (P/n) and each interest amount be rounded to the currency's minor unit (e.g. 2 decimal places), and if P does not divide evenly by n (or rounding leaves a residue), should the shortfall/overage be absorbed into the final instalment so the running balance reaches exactly zero?
A: Currency is KES. Each instalment is rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is then the remainder of the rounded instalment (not independently rounded). Any accumulated rounding residue is absorbed into the final instalment so the closing balance reaches exactly zero.

### Round 4
_Step reasoning:_ Disbursement date is an explicit input yet unused so far; the first-instalment offset and whether due dates appear in the output are material and cannot be reliably inferred.

Q: The disbursement date is given as an input, but nothing so far uses it: how should it drive the instalment due dates? Specifically, is the first instalment due exactly one calendar month after the disbursement date (and each subsequent instalment one month after the previous), and should each schedule row include its due date as an output field?
A: Yes: the first instalment is due exactly one calendar month after the disbursement date, and each subsequent instalment falls one calendar month after the previous due date. The due date is an output field on every schedule row.

### Round 5
_Step reasoning:_ Core policies (structure, day-count, rounding, dates) are settled; the only remaining ambiguity is the exact output row schema, which I confirm before finishing.

Q: Just to nail the output contract: should each schedule row expose exactly these fields — instalment number, due date, opening balance, interest due, principal due, total instalment, and closing balance — with all monetary values as whole KES integers; and should the schedule be returned as an ordered list of n rows (one per instalment) with no separate summary object?
A: Mostly yes on the row fields: each row should include instalment number, due date, opening balance, interest due, principal due, total instalment and closing balance, and all monetary values are whole KES integers (no cents). However, the schedule should NOT be the only return value — alongside the ordered list of n rows the response must also carry a summary with at least the total cost of credit (sum of all interest charged) and the disclosed APR (computed on an actual/365 basis). So the top-level return shape is an object with a schedule array and a summary object, not a bare list.

### Round 6
_Step reasoning:_ Scope, core behaviour, rounding, dates and output contract are all confirmed; the one remaining inferrable-ambiguity is month-end rollover for due dates, which the institution must have a fixed policy on.

Q: One edge case on the due dates: when the disbursement date is near month-end (e.g. the 31st, or 29-31 January), how should 'one calendar month later' resolve for months that are shorter, should the due date clamp to the last day of the shorter month (31 Jan -> 28/29 Feb) and then continue from that clamped day, or should it anchor to the original day-of-month wherever the month is long enough?
A: [default, not policy] Anchor to the original day-of-month: each due date targets the same day-of-month as the disbursement date, clamping to the last day of the month only when that month is too short. Subsequent months then re-anchor to the original day wherever possible. For example, disbursement on 31 Jan gives due dates of 28/29 Feb, 31 Mar, 30 Apr, 31 May, and so on — not a permanent drift to the 28th or 29th.

### Round 7 (process signalled done)
_Step reasoning:_ All six material policy decisions (instalment structure, 30/360 day-count, whole-KES rounding with residue in the final instalment, monthly due dates, return shape with cost-of-credit and actual/365 APR summary) plus the month-end date-resolution edge case are now resolved, leaving no ambiguous requirements to clarify.

(no questions this round)

## Produced specification

# Requirements specification — repayment schedule engine

## Overview

Build `generate_schedule(loan)`, a function that takes a disbursed loan and returns its full repayment schedule together with a summary. The loan input carries a principal, an annual nominal interest rate, a term expressed as a number of monthly instalments (n), and a disbursement date. Every decision below was confirmed with the stakeholder; nothing here is inferred beyond what was stated.

## Scope

### Included
- Computing the complete repayment schedule for a single disbursed loan.
- Producing, for each instalment, the opening balance, interest due, principal due, total instalment, closing balance, due date and instalment number.
- Producing a summary alongside the schedule, carrying at least the total cost of credit and the disclosed APR.

### Excluded / not specified
- No behaviour was specified for prepayment, arrears, late payment, restructuring or fees. These were neither asked nor answered and must not be assumed.
- No currency other than KES was specified.
- No validation rules for malformed input (e.g. zero or negative principal, zero term) were specified.

## Inputs

The `loan` argument provides:
- **principal** (P) — the disbursed amount.
- **annual nominal interest rate** — the nominal annual rate used for interest accrual.
- **term** (n) — the number of monthly instalments.
- **disbursement date** — the calendar date the loan was disbursed; drives the instalment due dates.

## Instalment structure

The engine uses **equal principal** repayment, not equal total payments (no EMI / standard amortisation).

- A constant principal portion of P/n applies each period.
- Interest is charged on the declining (opening) balance each period.
- The total instalment therefore decreases over the term.

## Interest calculation

Interest uses a **30/360 day-count convention**: every month counts as 30 days and the year as 360 days. The period is always exactly one month.

- Per-period interest = (annual_nominal_rate × 30 / 360) × opening balance.
- This is not actual/365 and not a plain annual_rate/12 shortcut, though for whole months the 30/360 result coincides with annual_rate/12.

## Rounding and precision

Currency is **KES**. All monetary values are whole shillings (integers, no cents).

Within each period, in order:
1. Compute the interest and round it to the nearest whole shilling first.
2. The principal due is then the remainder of the rounded instalment; it is not rounded independently. The constant principal portion derives from P/n, and rounding the interest and the instalment total to whole shillings makes the principal the remainder so that total instalment = interest due + principal due exactly in integers.
3. Any accumulated rounding residue over the term is absorbed into the **final instalment**, so the closing balance reaches exactly zero.

## Due dates

The disbursement date drives the instalment due dates.

- The first instalment is due exactly one calendar month after the disbursement date.
- Each subsequent instalment is due one calendar month after the previous due date.
- The due date is an output field on every schedule row.

### Month-end handling

Each due date anchors to the same day-of-month as the disbursement date, clamping to the last day of the month only when that month is too short. Subsequent months re-anchor to the original day wherever the month is long enough; there is no permanent drift to the shorter day. For example, disbursement on 31 January gives due dates of 28/29 February, 31 March, 30 April, 31 May, and so on.

## Output contract

`generate_schedule(loan)` returns an object with two top-level members, not a bare list:

### `schedule`

An ordered list of n rows, one per instalment. Each row exposes exactly these fields:
- **instalment number**
- **due date**
- **opening balance**
- **interest due**
- **principal due**
- **total instalment**
- **closing balance**

All monetary values are whole KES integers.

### `summary`

An object carrying at least:
- **total cost of credit** — the sum of all interest charged across the schedule.
- **disclosed APR** — computed on an actual/365 basis (distinct from the 30/360 basis used for accrual).

## Success criteria

- The schedule holds n rows with a constant principal portion (P/n), interest charged on the declining balance, and a total instalment that falls over the term.
- Interest each period follows the 30/360 convention on the opening balance.
- All monetary values are whole KES shillings, interest rounded before principal, with residue absorbed into the final instalment so the final closing balance is exactly zero.
- Due dates follow the one-calendar-month rule from the disbursement date, with original-day anchoring and month-end clamping.
- The return value is an object with a `schedule` array and a `summary` object, the summary reporting total cost of credit and an actual/365 APR.

## Auditor verdict

_The spec correctly resolves 9 of 14 decisions (1, 2, 3, 4, 7, 8, 9, 13, 14), including several bespoke off-default choices (equal-principal amortisation, 30/360, per-period accrual, interest-first rounding order, and the actual/365-disclosure-vs-30/360-accrual split). It misses the stub/disbursement-date interest (5), the Rule-of-78 rebate (10), and the term-fixed re-amortisation on partial prepayment (11), all left unspecified as out of scope. It deviates on currency precision (6): KES is right but the spec declares all values whole shillings (0 dp) rather than the reference's 2 dp. Zero/negative principal or term (12) is flagged as unspecified rather than resolved as rejected. Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the declining (opening) balance each period." and "interest charged on the declining balance" | The spec explicitly uses declining-balance interest on the reducing principal, matching the reference method. |
| 2 | yes | **yes** | "The engine uses **equal principal** repayment, not equal total payments (no EMI / standard amortisation)." "A constant principal portion of P/n applies each period... The total instalment therefore decreases over the term." | Equal principal (P/n) with interest on the reducing balance and a decreasing total instalment matches the reference exactly, including the explicit rejection of EMI. |
| 3 | yes | **yes** | "Interest uses a **30/360 day-count convention**: every month counts as 30 days and the year as 360 days." | The spec states 30/360 and explicitly rejects actual/365, matching the reference. |
| 4 | yes | **yes** | "The period is always exactly one month." "Per-period interest = (annual_nominal_rate × 30 / 360) × opening balance." | Interest is computed once per monthly repayment period (not daily accrual), matching the same-as-repayment-period convention. |
| 5 | no | no | absent | The spec fixes the first instalment at exactly one month after disbursement and never addresses interest accruing from the disbursement date or a stub/partial-period interest charge for extra days. |
| 6 | yes | no | "Currency is **KES**. All monetary values are whole shillings (integers, no cents)." | Currency KES is right, but the reference sets the currency precision at 2 decimal places; the spec instead declares all monetary values whole shillings (0 dp), contradicting the stated precision, so the resolution does not match. |
| 7 | yes | **yes** | "All monetary values are whole shillings" and "Any accumulated rounding residue over the term is absorbed into the **final instalment**" | Instalments rounded to whole shillings with the accumulated rounding difference settled in the final instalment matches the reference precisely. |
| 8 | yes | **yes** | "1. Compute the interest and round it to the nearest whole shilling first. 2. The principal due is then the remainder of the rounded instalment; it is not rounded independently." | Interest computed and rounded first, principal taken as the remainder, matches the within-period rounding order exactly. |
| 9 | yes | **yes** | "residue is absorbed into the **final instalment**, so the closing balance reaches exactly zero" | The final instalment reconciles to an exactly zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec explicitly excludes prepayment/early settlement behaviour and never mentions any rebate, let alone the Rule of 78. |
| 11 | no | no | absent | Prepayment is listed as excluded and unspecified; no re-amortisation strategy or term-fixed behaviour is stated. |
| 12 | no | no | "No validation rules for malformed input (e.g. zero or negative principal, zero term) were specified." | The spec names the case but explicitly declines to resolve it; it does not state that zero/negative principal or term is rejected as invalid, so the reference answer is not given. |
| 13 | yes | **yes** | "The first instalment is due exactly one calendar month after the disbursement date. Each subsequent instalment is due one calendar month after the previous due date." | First due date = disbursement + one month with monthly instalments thereafter matches the reference. |
| 14 | yes | **yes** | schedule rows expose "instalment number, due date, opening balance, interest due, principal due, total instalment, closing balance"; summary has "total cost of credit — the sum of all interest" and "disclosed APR — computed on an actual/365 basis (distinct from the 30/360 basis used for accrual)" | Full per-period schedule, total cost of credit as sum of interest, and APR disclosed on actual/365 while accrual uses 30/360 — the non-obvious dual day-count quirk is captured exactly. |
