# bmad — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 9 · Captured: 8/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured prompt didn't go through, so I'll just ask directly. Here are the decisions I need from you before I can specify this correctly. These are the ones the brief leaves open where there are several plausible answers and picking wrong would give the wrong numbers.

**1. Amortisation method.** Which shape of schedule?
- (a) Equal instalments / annuity: fixed total payment each period, interest on the declining balance, principal portion grows over the term. Common for consumer and mortgage loans.
- (b) Equal principal: same principal each period, interest on declining balance, so the total payment falls over time.
- (c) Interest-only with a balloon: interest each period, whole principal due at the end.

**2. Rate convention.** How does the annual nominal rate become the per-instalment rate used to accrue interest?
- (a) Nominal ÷ 12: simple monthly rate, interest = opening balance × (annual/12), calendar days ignored.
- (b) Actual/365: interest accrues on actual days between due dates.
- (c) 30/360: every month treated as 30 days.

**3. Rounding and residual.** How are the money amounts rounded, and where does the rounding drift go?
- (a) Round each row to 2 decimals, half-up, and let the final instalment absorb accumulated drift so the closing balance is exactly zero.
- (b) Same but banker's rounding (half-even).
- (c) Full precision, no rounding, no forced exact-zero close.
- Also: what currency / minor unit is this (2 decimal places, or something else)?

**4. First instalment timing.** When is the first payment due, and does the disbursement date drive an odd first-period interest charge?
- (a) First payment exactly one month after disbursement; every period a whole month; no odd-days interest. Disbursement date only sets the monthly cadence.
- (b) Odd-days / stub interest: the first period accrues on the actual days from disbursement to the first due date, whole months thereafter.
- (c) First due date is an explicit input, with stub interest to that date.

Once I have these four I'll have a couple of shorter follow-ups (month-end and weekend/holiday handling of due dates, and behaviour on edge inputs like a 0% rate).
A: Answers in order:

**1. Amortisation method:** (b) Equal principal. The principal portion is constant each period (P/n); interest is charged on the declining balance; the total instalment falls over the term.

**2. Rate convention:** (c) 30/360. Every month is treated as 30 days, the year as 360. Interest for a period = opening balance × (annual rate × 30/360). Calendar days between due dates are not used for accrual.

**3. Rounding and residual:** Currency is Kenyan shilling (KES). Instalments are rounded to the whole shilling (no cents). Accumulated rounding drift is settled in the final instalment so the closing balance is exactly zero. Within each period, interest is computed and rounded first; the principal portion is the remainder of the rounded instalment.

**4. First instalment timing:** (b) Stub interest applies. Interest accrues from the disbursement date. If disbursement precedes the start of the first full period, a stub charge is levied for those extra days. The first due date is disbursement date plus one month; subsequent instalments fall monthly thereafter.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Two of your answers interact in a way I want to nail down before writing, plus a few remaining edges.

**A. Principal/interest decomposition (resolving a tension between answers 1 and 3).**
Equal principal means the *principal* is the fixed part each period (P/n) and the interest is what varies. But your rounding rule in answer 3 describes the annuity pattern, where the instalment is fixed and principal is the remainder after interest. Those can't both hold. I'm reading your intent as:

- Principal portion = round(P / n) to the whole shilling, constant each period.
- Interest portion = round(opening balance × annual rate × 30/360) to the whole shilling.
- Instalment = principal portion + interest portion (so it declines over the term).
- The final instalment's principal is whatever clears the remaining balance to exactly zero, absorbing all rounding drift.

Is that right? If instead you want the instalment held fixed and principal taken as the remainder, tell me and I'll treat it as annuity, but that contradicts "equal principal", so I assume the above.

**B. Stub mechanics.** You've said the first due date is disbursement + 1 month and interest accrues from disbursement. Under 30/360 a whole month is 30 days, so I need to know when a stub actually arises and how it's charged:
- What triggers the stub? If the first due date is always disbursement + 1 month, the first period is already a full 30/360 month. Is there instead a fixed billing anchor (e.g. a fixed due-day-of-month) and the stub covers disbursement up to the first anchored period? Or does the stub only appear when disbursement lands on a day like the 31st?
- How are stub days counted (30/360 US, treating the 31st as the 30th, or 30E/360 European)?
- Is the stub interest a separate line (an instalment-zero, interest only, no principal), or is it added to the interest of instalment 1? And does it ever include any principal?

**C. Due-date calendar.** For generating the printed due dates: how do you handle a disbursement on the 29th–31st (e.g. 31 Jan + 1 month)? Last-day-of-month, or clamp to the 28th/30th? And do due dates that land on a weekend or Kenyan public holiday roll to the next business day? I expect this only relabels dates and does not change accrual (since 30/360 fixes each period at 30 days), but confirm.

**D. Edge inputs.** What should `generate_schedule` do when:
- the interest rate is 0% (schedule of pure principal, presumably)?
- inputs are invalid, principal ≤ 0, term n < 1, or a negative rate: raise an error, or is there a defined behaviour?
A: **A. Principal/interest decomposition:** Your reading is correct. Principal portion = round(P / n) to the whole shilling, constant each period. Interest portion = round(opening balance × annual rate × 30/360) to the whole shilling. Instalment = their sum, so it declines over the term. The final instalment's principal is whatever is needed to close the balance to exactly zero, absorbing all accumulated rounding drift. The 'remainder' language in my earlier answer 3 was describing that final-period reconciliation, not the general case. Equal principal governs.

**B. Stub mechanics:** Under the first-due-date rule (disbursement + 1 month), the first period is always a full 30/360 month and no stub arises in the standard case. The stub provision applies when a fixed billing anchor determines the first due date instead (for example, all loans falling due on a fixed day of the month), in which case the stub covers disbursement to that anchor. Stub days are counted under the same 30/360 convention (the 31st is treated as the 30th). Whether the stub is a separate instalment-zero line or folded into instalment 1's interest is [default, not policy: treat as a separate interest-only line preceding instalment 1, carrying no principal]. If your implementation uses disbursement + 1 month strictly as the first due date, no stub logic is needed.

**C. Due-date calendar:** End-of-month handling when disbursement falls on the 29th–31st is [default, not policy: roll to the last calendar day of each subsequent month — e.g. 31 Jan + 1 month = 28 Feb or 29 Feb in a leap year]. Weekend and Kenyan public holiday rolling is [default, not policy: roll forward to the next business day for the printed due date only; accrual is unaffected since 30/360 fixes each period at 30 days regardless of the calendar label]. Confirm both with me if they are in scope for the first release.

**D. Edge inputs:** A 0% rate is valid [default, not policy: produce a schedule of equal principal instalments with zero interest, no error]. Principal ≤ 0 or term n < 1: reject as invalid with an error. A negative rate: [default, not policy: reject as invalid with an error].

### Round 3
_Step reasoning:_ (live agent turn)

Q: Good, that resolves the mechanics. One last scoping decision, because it changes how much the engine has to do in the first release, and then I'll write the spec.

You originally said stub interest applies (answer 4b), but your clarification shows a stub only arises under a fixed billing-anchor model, not under the strict "disbursement + 1 month" rule. These are genuinely different engines. I need to know which one release 1 must build.

- **In scope:** the engine supports a fixed billing anchor (e.g. a fixed due-day-of-month), computes a stub interest line when disbursement precedes the first anchored period, and I specify all of the stub, end-of-month, and business-day rules as first-release behaviour.
- **Out of scope:** release 1 uses "first due date = disbursement + 1 month" strictly, so no stub ever arises. I'd specify the stub, anchor, and business-day handling as documented non-goals / future work, and keep the engine to whole monthly 30/360 periods.

Which is it for release 1? And if in scope, is the anchor (the fixed due-day) a per-loan input or an institution-wide setting?

I'll take your "default, not policy" items (separate interest-only stub line, last-day-of-month roll, business-day roll of printed dates only, 0% valid, reject non-positive principal / term < 1 / negative rate) as the specified defaults and record them explicitly as defaults rather than stakeholder policy.
A: Release 1 is out of scope for the fixed billing anchor. Use the strict rule: first due date = disbursement date + one month, subsequent instalments monthly thereafter. No stub ever arises, and you do not need to specify stub, anchor, or business-day-roll behaviour as release-1 requirements. Document them as explicit non-goals and future work. The anchor question therefore does not apply for this release.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in the working directory.

It pins down every policy decision the brief left open, based on your answers:

- **Equal-principal amortisation** with a constant `round(P/n)` principal and a declining instalment.
- **30/360 accrual**, interest computed on the opening balance, calendar days ignored.
- **Whole-shilling KES rounding**, interest rounded first, drift settled on the final instalment so the balance closes to exactly zero.
- **Due dates** at disbursement plus one month, monthly thereafter, no stub.
- **Validation** of the inputs and a defined zero-rate result.

Two things worth flagging in how I wrote it up:

1. I kept your policy decisions separate from the items you delegated. There's a decision log at the end splitting stakeholder policy from delegated defaults (round-half-up, last-day-of-month roll, no business-day roll, zero-rate handling, negative-rate rejection), so anyone revisiting the spec can see which choices were rulings and which were sensible fills.
2. The billing anchor, stub interest and business-day rolling are documented as explicit non-goals with a short note on what they'd entail, rather than silently dropped.

There's a worked example (100,000 KES, 12%, 12 months) with the full table, which doubles as a test vector: `round(100000/12)=8333` leaves 4 KES of drift, absorbed into the final instalment's principal of 8,337, and the balance closes to zero.
A: Noted. The specification looks complete and correctly captures the policy decisions.

## Produced specification

# Repayment schedule engine — requirements specification

## Purpose

Given a disbursed loan, produce its full repayment schedule. For each instalment the
schedule states the interest due, the principal due and the running balance, and the
balance closes to exactly zero on the final instalment. The engine exposes a single
function, `generate_schedule(loan)`, which returns the schedule.

This specification records the policy decisions that govern the numbers. Where a decision
was made by the stakeholder it is stated as policy. Where the stakeholder delegated the
choice it is marked as a **default** so a later reader can see it was not an institutional
ruling and can be revisited.

## Scope

In scope for release 1:

- Equal-principal amortisation over a fixed number of monthly instalments.
- Interest accrual on the 30/360 convention.
- Rounding to the whole Kenyan shilling with final-instalment reconciliation.
- Due dates generated as disbursement date plus one month, monthly thereafter.
- Validation of the loan inputs and a defined result for a zero interest rate.

Out of scope for release 1, recorded as non-goals below:

- Fixed billing anchors and any stub (odd first period) interest.
- Business-day and public-holiday rolling of due dates.
- Prepayment, arrears, restructuring, variable rates and fees.

## Inputs

`generate_schedule(loan)` takes a disbursed loan with these fields.

- `principal`: the disbursed amount in KES. Must be greater than zero.
- `annual_nominal_rate`: the annual nominal interest rate as a decimal fraction, for
  example `0.12` for 12%. Must be zero or greater.
- `term_months`: the number of monthly instalments, `n`. Must be one or greater.
- `disbursement_date`: the date the loan was disbursed.

Currency is the Kenyan shilling (KES). All money amounts in the schedule are whole
shillings. There are no cents.

## Output

The function returns the repayment schedule as an ordered sequence of `term_months`
instalment rows, instalment 1 first. Each row carries:

- `instalment_number`: 1 to `n`.
- `due_date`: the date the instalment falls due.
- `opening_balance`: the outstanding principal at the start of the period.
- `interest`: the interest due for the period, in whole KES.
- `principal`: the principal due for the period, in whole KES.
- `instalment`: the total due, equal to `interest + principal`.
- `closing_balance`: the outstanding principal after the payment.

The `closing_balance` of instalment `n` is exactly zero. The `opening_balance` of
instalment 1 equals `principal`, and each row's `opening_balance` equals the previous
row's `closing_balance`.

## Amortisation method — equal principal

The principal is repaid in equal parts across the term. The interest is charged on the
declining balance, so the total instalment falls over the term.

For each period other than the last:

- `principal` = `round(principal / n)` to the whole shilling, constant across the term.
- `interest` = `round(opening_balance × annual_nominal_rate × 30 / 360)` to the whole
  shilling.
- `instalment` = `principal + interest`.
- `closing_balance` = `opening_balance − principal`.

Interest is computed and rounded first. The principal portion is the fixed `round(P / n)`
amount, not a remainder. The instalment is their sum.

### Final instalment reconciliation

On the last instalment the principal portion is whatever is needed to close the balance to
exactly zero, that is `principal` = `opening_balance` of the final period. This absorbs all
accumulated rounding drift, so the constant `round(P / n)` amount does not apply to the last
row. Interest on the final row is computed by the same rule as every other row, on that
row's opening balance. The final instalment is again `interest + principal`.

## Interest accrual — 30/360

Every month is treated as 30 days and the year as 360 days. Interest for a period is
`opening_balance × annual_nominal_rate × 30 / 360`, which reduces to `opening_balance ×
annual_nominal_rate / 12` for a whole month. The actual number of calendar days between
due dates is not used for accrual. Because each period is a whole 30/360 month, the calendar
labelling of due dates never changes the interest charged.

## Rounding

- All money amounts are rounded to the whole shilling.
- Rounding mode is round half up **(default, delegated by the stakeholder)**.
- Within a period, interest is rounded first; principal is the fixed `round(P / n)` amount;
  the instalment is their sum.
- Accumulated rounding drift is settled on the final instalment through the principal
  reconciliation described above, so the schedule always closes to zero.

## Due dates

The first instalment falls due on the disbursement date plus one calendar month. Each
subsequent instalment falls due one calendar month after the previous one.

When the disbursement day of the month has no counterpart in a later month, for example the
31st in February, the due date rolls to the last calendar day of that month **(default,
delegated by the stakeholder)**. So a loan disbursed on 31 January has its first due date on
28 February, or 29 February in a leap year.

Due dates are not adjusted for weekends or public holidays in release 1. See non-goals.

## Edge cases and validation

- **Zero interest rate.** A rate of `0` is valid. The schedule is equal-principal with
  zero interest in every row, and the final row still reconciles to a zero balance
  **(default, delegated by the stakeholder)**.
- **Invalid principal.** `principal` of zero or less is rejected as invalid with an error.
- **Invalid term.** `term_months` below one is rejected as invalid with an error.
- **Negative rate.** A rate below zero is rejected as invalid with an error **(default,
  delegated by the stakeholder)**.

An error means the function does not return a schedule for that input. The specific error
type and message are an implementation detail.

## Worked example

Principal 100,000 KES, annual nominal rate 12% (`0.12`), term 12 months.

The monthly rate is `0.12 × 30 / 360 = 0.01`. The constant principal portion is
`round(100000 / 12) = 8333`. `8333 × 12 = 99,996`, so 4 KES of drift is carried and settled
on the final instalment, whose principal is 8,337.

| # | Opening | Interest | Principal | Instalment | Closing |
|---|---------|----------|-----------|------------|---------|
| 1 | 100,000 | 1,000 | 8,333 | 9,333 | 91,667 |
| 2 | 91,667 | 917 | 8,333 | 9,250 | 83,334 |
| 3 | 83,334 | 833 | 8,333 | 9,166 | 75,001 |
| 4 | 75,001 | 750 | 8,333 | 9,083 | 66,668 |
| 5 | 66,668 | 667 | 8,333 | 9,000 | 58,335 |
| 6 | 58,335 | 583 | 8,333 | 8,916 | 50,002 |
| 7 | 50,002 | 500 | 8,333 | 8,833 | 41,669 |
| 8 | 41,669 | 417 | 8,333 | 8,750 | 33,336 |
| 9 | 33,336 | 333 | 8,333 | 8,666 | 25,003 |
| 10 | 25,003 | 250 | 8,333 | 8,583 | 16,670 |
| 11 | 16,670 | 167 | 8,333 | 8,500 | 8,337 |
| 12 | 8,337 | 83 | 8,337 | 8,420 | 0 |

Interest on each row is `round(opening × 0.01)`. Instalment 11 leaves 8,337 outstanding,
which instalment 12 clears in full. The closing balance reaches exactly zero.

## Non-goals and future work

The following are explicitly out of scope for release 1 and are noted so they are not
assumed present.

- **Fixed billing anchor and stub interest.** A model where the first due date is set by a
  fixed day of the month rather than disbursement plus one month, with a stub interest line
  covering disbursement up to the first anchored period. Release 1 uses the strict
  disbursement-plus-one-month rule, under which no stub ever arises.
- **Business-day and holiday rolling.** Adjusting a printed due date that lands on a weekend
  or a Kenyan public holiday to the next business day. Under 30/360 this would relabel due
  dates only and would not change accrual.
- **Equal-instalment (annuity) amortisation**, prepayments, arrears and penalties, fees,
  variable or compounding rates, and multi-currency support.

## Decision log — policy versus default

Stakeholder policy for release 1:

- Equal-principal amortisation, constant `round(P / n)` principal, declining instalment.
- 30/360 interest accrual, no use of actual calendar days.
- Whole-shilling KES rounding, interest rounded first, drift settled on the final
  instalment so the balance closes to zero.
- First due date is disbursement plus one month, monthly thereafter, no stub.
- Principal of zero or less and term below one are invalid.

Delegated defaults, chosen here and open to revision:

- Round half up as the rounding mode.
- Last-day-of-month roll when the disbursement day has no counterpart in a later month.
- No business-day or holiday rolling of due dates.
- Zero rate is valid and yields a zero-interest equal-principal schedule.
- Negative rate is rejected as invalid.


## Auditor verdict

_The spec correctly resolves 8 of 14 decisions (1, 2, 3, 4, 7, 9, 12, 13), covering the interest method, equal-principal amortisation, 30/360 convention, per-period interest, whole-shilling instalment rounding, zero closing balance, input validation and first-due-date rule. It fails 6: it explicitly excludes stub/disbursement-date interest (5, contradicting the reference), sets whole-shilling rather than 2dp currency precision (6), makes principal a fixed P/n rather than the remainder of the instalment (8, contradicting the ordering resolution), omits the Rule-of-78 early-settlement rebate (10) and the principal-first fixed-term re-amortisation for partial prepayment (11) by declaring prepayment out of scope, and gives the schedule rows but omits both the total cost of credit and the actual/365 disclosed APR (14). Coverage = 8/14 ≈ 0.57, with the gap concentrated on the bespoke off-default decisions (5, 8, 10, 11, 14) plus the precision detail (6)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "The interest is charged on the declining balance, so the total instalment falls over the term." (Amortisation section) | Spec states interest is charged on the reducing/declining balance, matching the reference interest method exactly. |
| 2 | yes | **yes** | "Amortisation method — equal principal ... The principal is repaid in equal parts across the term ... so the total instalment falls over the term." | Spec specifies equal-principal amortisation with constant P/n principal and a decreasing total instalment, and explicitly excludes equal-instalment/EMI, matching the reference. |
| 3 | yes | **yes** | "Interest accrual — 30/360 ... Every month is treated as 30 days and the year as 360 days." | Spec adopts the 30/360 convention exactly, not actual/365, matching the reference. |
| 4 | yes | **yes** | "Interest for a period is opening_balance × annual_nominal_rate × 30 / 360 ... The actual number of calendar days between due dates is not used for accrual." | Interest is computed once per monthly repayment period rather than by daily accrual, matching the reference's same-as-repayment-period choice. |
| 5 | yes | no | "Out of scope for release 1 ... any stub (odd first period) interest"; "Release 1 uses the strict disbursement-plus-one-month rule, under which no stub ever arises." | Reference requires interest to accrue from the disbursement date with a stub charge for pre-period days; the spec explicitly excludes stub interest and charges none, directly contradicting the reference. |
| 6 | yes | no | "Currency is the Kenyan shilling (KES). All money amounts in the schedule are whole shillings. There are no cents." | Currency (KES) matches, but the reference sets precision at 2 decimal places whereas the spec states amounts have no cents (whole shillings, 0 dp); the precision value does not match literally. |
| 7 | yes | **yes** | "Rounding to the whole Kenyan shilling with final-instalment reconciliation ... Accumulated rounding drift is settled on the final instalment." | Instalments round to the whole shilling and the accumulated rounding difference is absorbed by the final instalment, matching the reference exactly. |
| 8 | yes | no | "Interest is computed and rounded first. The principal portion is the fixed round(P / n) amount, not a remainder." | Spec matches the 'interest rounded first' ordering, but the reference states principal is the remainder of the rounded instalment, whereas the spec explicitly makes principal a fixed round(P/n) and 'not a remainder', contradicting the reference resolution. |
| 9 | yes | **yes** | "The closing_balance of instalment n is exactly zero."; "the schedule always closes to zero." | The final instalment reconciles the closing balance to exactly zero, matching the reference. |
| 10 | no | no | absent (only "prepayments" listed among out-of-scope items; Rule of 78 / early settlement rebate never mentioned) | The reference requires a Rule-of-78 rebate on early full settlement; the spec neither surfaces the rebate-method decision nor resolves it, merely bundling prepayment into out-of-scope. |
| 11 | no | no | absent ("Prepayment, arrears, restructuring ... Out of scope for release 1") | Reference requires partial prepayment applied to principal with re-amortisation keeping the term fixed; the spec declares prepayment out of scope and does not surface or resolve the strategy. |
| 12 | yes | **yes** | "principal of zero or less is rejected as invalid with an error."; "term_months below one is rejected as invalid with an error." | Zero or negative principal and zero/sub-one term are rejected as invalid, matching the reference. |
| 13 | yes | **yes** | "The first instalment falls due on the disbursement date plus one calendar month. Each subsequent instalment falls due one calendar month after the previous one." | First due date is disbursement date + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | no | Output section lists per-row due_date, opening_balance, interest, principal, instalment, closing_balance; total cost of credit and disclosed APR are absent. | The per-period schedule shape matches, but the reference also requires the total cost of credit (sum of interest) and a disclosed APR on an actual/365 basis; both are entirely absent, so the resolution does not match. |
