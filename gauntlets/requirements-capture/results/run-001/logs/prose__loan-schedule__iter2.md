# prose — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 9 · Captured: 9/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material policy decision (amortisation method, day-count, rounding, instalment dating, stub-period handling); a correct schedule cannot be computed without the institution's specific choices, so I ask before writing.

Q: Amortisation method: should each instalment be a fixed total payment (annuity/EMI style, where principal and interest split shifts over time), equal principal per instalment (declining total payment), or interest-only with a balloon at term end?
A: Equal principal: a constant principal portion each period (P/n), with interest charged on the reducing balance, so the total instalment decreases over the term. Not annuity/EMI style, not interest-only with balloon.

Q: Interest accrual/day-count convention: is periodic interest simply the annual nominal rate divided by 12 applied to the outstanding balance, or should it follow a day-count basis (e.g. 30/360, actual/365, actual/actual) using the actual days between instalment dates?
A: 30/360 day-count: every month is treated as 30 days and the year as 360. Interest is computed once per monthly repayment period (not daily accrual). Periodic interest = annual nominal rate × (30/360) × outstanding balance.

Q: Rounding policy: to what precision are interest and principal amounts rounded (e.g. whole minor currency units / 2 decimal places), what rounding rule applies (half-up, half-even/banker's), and should rounding residues be absorbed into the final instalment so the closing balance is exactly zero?
A: Amounts are denominated in KES to 2 decimal places. Each instalment is rounded to the whole shilling (no cents). Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment. Accumulated rounding differences are settled in the final instalment so the closing balance is exactly zero. [Rounding rule half-up, default, not policy]

Q: Instalment dating: when is the first instalment due relative to the disbursement date (e.g. exactly one month later, or a fixed billing day-of-month), and how are month-end edge cases handled (e.g. disbursement on the 31st, or February)?
A: First instalment is due disbursement date + one month; subsequent instalments monthly thereafter. [Month-end edge cases such as 31st-of-month disbursement or February are not specified policy — default behaviour of clamping to the last day of the month applies until further notice]

Q: First-period interest: if there is a gap between disbursement and the first instalment that differs from a normal period, should interest for that stub period be accrued (short/long first period) or is the first period always treated as a full standard month?
A: A stub period is recognised and charged. If disbursement precedes the first period start, interest accrues from the disbursement date and a partial-period (stub) interest charge is levied for those extra days. Short or long first periods are allowed and charged; the first period is not forced to be a full standard month.

### Round 2
_Step reasoning:_ Round 5 recognised stub interest but left its mechanical treatment and whether principal repayment starts in the first period unresolved; both materially change the numbers.

Q: Stub-period interest treatment: when a short or long first period is charged, how does that stub interest appear in the schedule? Is it (a) added on top of the first regular instalment (first payment = P/n principal + the period's interest inclusive of stub days), (b) billed as a separate line/instalment before the first regular one, or (c) capitalised onto the outstanding principal and amortised across the term?
A: [default, not policy] The stub interest is added on top of the first regular instalment (option a): the first payment comprises the stub-period interest for the partial days plus the normal first principal portion (P/n) and the full first-period interest. It is not billed as a separate line and not capitalised.

Q: Does the constant principal portion (P/n) begin with that first (possibly stub) instalment, or is the first instalment interest-only with the n equal-principal repayments starting from the second instalment?
A: [default, not policy] The constant principal portion (P/n) begins with the first instalment. The first payment is not interest-only; it includes both the stub interest (if any), the first-period regular interest, and the first P/n principal repayment.

### Round 3
_Step reasoning:_ The dating rule (disbursement + one month) appears to leave no gap, yet a stub is charged; I must resolve when a stub arises, how its 30/360 days are counted under month-end clamping, and how it is rounded before writing the spec.

Q: Given that the first instalment is due exactly one month after disbursement, when does a stub period actually arise, and how are its days counted? Concretely: (a) are repayment periods anchored to disbursement+n months, or to a fixed billing day-of-month that can differ from the disbursement day (which is what would create a gap between disbursement and the first period start)? and (b) for the stub charge, how is the day count computed under 30/360 (e.g. disbursed on the 31st then clamped, or a February first instalment), i.e. what is the numerator of days over 360 for those extra partial days?
A: (a) [default, not policy] The answer key does not distinguish between a fixed-billing-day model and a disbursement-anchored model. The most coherent reading of points 5 and 13 together is: repayment periods are anchored to disbursement+n months (so the first due date is always disbursement+1 month), and a stub arises only when the product is configured with a fixed billing day-of-month that differs from the disbursement day — in that case the gap between disbursement and that fixed day-of-month constitutes the stub. If no fixed billing day is configured, the first period is always a full 30/360 month and no stub arises. (b) [default, not policy] Under 30/360 the stub numerator is computed as: (Y2−Y1)×360 + (M2−M1)×30 + (min(D2,30) − min(D1,30)), where D1/M1/Y1 is the disbursement date and D2/M2/Y2 is the first period-start date, with each date component clamped to 30 per standard 30/360 rules. The denominator is 360. No explicit variant (US/European) is specified in policy.

Q: On what balance is the stub interest charged, and is the stub interest rounded to the whole shilling on its own before being combined with the first period's regular interest, or are stub and first-period interest summed and rounded once together?
A: [default, not policy] Stub interest is charged on the full disbursed principal — the outstanding balance at disbursement before any repayment has occurred. Regarding rounding: stub interest and the first-period regular interest are summed first, then the combined figure is rounded to the whole shilling as a single amount; the total first instalment is then that rounded interest sum plus the first P/n principal portion, with the instalment itself also rounded to the whole shilling in the normal way (interest rounded first, principal the remainder). Neither the balance nor the per-component rounding order for stub vs. regular interest is explicit policy.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (amortisation method, 30/360 day-count, rounding and residue settlement, instalment dating, stub-period recognition, treatment, principal timing, anchoring, stub balance and rounding order) are now captured; further questions are returning defaults rather than policy, so the specification can be written.

(no questions this round)

## Produced specification

# Repayment Schedule Engine — Requirements Specification

## 1. Purpose and scope

This specification defines the behaviour of `generate_schedule(loan)`, which computes the full repayment schedule for a disbursed loan. The engine uses an equal-principal amortisation method with 30/360 interest accrual, produces amounts rounded to the whole Kenyan shilling, and guarantees a closing balance of exactly zero. This document is the authoritative source for implementation; where the brief was silent, the resolutions recorded here are binding.

## 2. Inputs

The function accepts a single `loan` object with the following fields:

- `principal` — the disbursed principal amount, denominated in KES. Held to 2 decimal places internally.
- `annual_nominal_rate` — the annual nominal interest rate, expressed as a decimal fraction (for example 0.18 for 18% per annum).
- `term` — the number of monthly instalments, a positive integer `n`.
- `disbursement_date` — the calendar date on which principal was disbursed.
- `billing_day` (optional) — a fixed day-of-month on which instalments fall due. If present and it differs from the disbursement day-of-month, a stub first period arises (see section 6). If absent, no fixed billing day is configured and no stub arises.

## 3. Output

The function returns the repayment schedule: an ordered collection of `n` instalments (or `n` instalments plus the effect of the stub folded into the first, per section 6). Each instalment entry contains:

- the instalment number (1..n),
- the due date,
- the interest due for the period (whole shillings),
- the principal due for the period (whole shillings),
- the total instalment amount (whole shillings),
- the running outstanding balance after the instalment is applied.

The outstanding balance after the final instalment is exactly zero.

## 4. Amortisation method: equal principal

The schedule uses the equal-principal (constant amortisation) method, not annuity/EMI and not interest-only-with-balloon.

- The constant principal portion is `P / n`, where `P` is the disbursed principal and `n` is the term. This constant principal portion is repaid in every instalment, beginning with the first instalment (the first instalment is not interest-only).
- Interest for each period is charged on the outstanding balance at the start of that period, so the interest portion declines over the term.
- Because principal is constant and interest declines, the total instalment amount decreases over the term.

The constant principal `P / n` is rounded per the rules in section 5; residual differences are absorbed into the final instalment so the sum of principal portions equals `P` exactly.

## 5. Interest accrual and day-count convention

Interest accrues under a 30/360 day-count basis. Every month is treated as 30 days and every year as 360 days. Interest is computed once per monthly repayment period, not by daily accrual.

For a full standard monthly period:

    periodic_interest = annual_nominal_rate * (30 / 360) * outstanding_balance

where `outstanding_balance` is the balance outstanding at the start of the period, before that period's principal repayment is applied.

## 6. Instalment dating

- The first instalment is due on `disbursement_date + 1 month`. Subsequent instalments are due monthly thereafter. Repayment periods are anchored to disbursement plus n months; the first due date is always disbursement plus one month.
- Month-end edge cases (for example disbursement on the 31st, or a February due date) are handled by clamping the due date to the last valid day of the target month. This is the default policy and applies until a different policy is set.

## 7. Stub (partial) first period

A stub period is recognised and charged when it arises. Short or long first periods are permitted and charged; the first period is not forced to be a full standard month.

### 7.1 When a stub arises

Repayment periods are anchored to disbursement plus n months, so the first due date is always disbursement plus one month. A stub arises only when the product is configured with a fixed `billing_day` (day-of-month) that differs from the disbursement day-of-month. In that case the gap between the disbursement date and that fixed billing day-of-month constitutes the stub, and stub interest is charged for those extra partial days.

If no fixed billing day is configured, the first period is always a full 30/360 month and no stub arises.

### 7.2 Stub day count under 30/360

The stub day count (the numerator over a denominator of 360) is computed by the standard 30/360 date-difference formula, with each date's day component clamped to 30:

    stub_days = (Y2 - Y1) * 360 + (M2 - M1) * 30 + (min(D2, 30) - min(D1, 30))

where (D1, M1, Y1) is the disbursement date and (D2, M2, Y2) is the first period-start date (the fixed billing day-of-month from which the first regular period is measured). The denominator is 360. No US/European variant beyond this clamping is specified.

    stub_interest_raw = annual_nominal_rate * (stub_days / 360) * P

### 7.3 Balance the stub is charged on

Stub interest is charged on the full disbursed principal `P`, that is the outstanding balance at disbursement before any repayment has occurred.

### 7.4 How the stub appears in the schedule

The stub interest is added on top of the first regular instalment. It is not billed as a separate line and is not capitalised onto principal.

The first instalment therefore comprises:

1. the stub-period interest for the partial days (on `P`), plus
2. the full first regular-period interest (on the balance at the start of the first period, which is `P`), plus
3. the first constant principal portion `P / n`.

## 8. Rounding policy

Amounts are denominated in KES to 2 decimal places internally, but each instalment is rounded to the whole shilling (no cents) for presentation and settlement. The rounding rule is half-up (this is the default; it is not a policy choice recorded by the stakeholder, and may change if a policy is later set).

Within each period:

1. Interest is computed and rounded to the whole shilling first.
2. Principal is the remainder of the rounded instalment (the rounded total instalment less the rounded interest).

### 8.1 Rounding for the first (stub-bearing) instalment

When a stub applies, the stub interest and the first regular-period interest are summed first, then the combined figure is rounded once to the whole shilling as a single amount. The total first instalment is then that single rounded interest sum plus the first constant principal portion `P / n`. The instalment total is itself expressed in whole shillings in the normal way, with interest rounded first and principal the remainder.

### 8.2 Rounding residues and closing balance

Accumulated rounding differences across all periods are settled in the final instalment. The final instalment's principal portion absorbs whatever residue is required so that the outstanding balance after the final instalment is exactly zero. The interest portion of each period (including the final) is computed on the then-current outstanding balance under the rules above.

## 9. Computation procedure

For a loan with principal `P`, term `n`, annual nominal rate `r`, disbursement date `d`, and optional fixed billing day:

1. Set `balance = P`.
2. Determine whether a stub applies (section 7.1) and, if so, compute `stub_days` (section 7.2) and `stub_interest_raw = r * (stub_days / 360) * P` (charged on `P`).
3. For the first period:
   a. Compute the regular first-period interest `regular_interest_raw = r * (30 / 360) * balance` (balance is `P`).
   b. If a stub applies, `interest_1 = round_to_shilling(stub_interest_raw + regular_interest_raw)`; otherwise `interest_1 = round_to_shilling(regular_interest_raw)`.
   c. Principal portion `principal_1 = round_to_shilling(P / n)`.
   d. Total first instalment `= interest_1 + principal_1`.
   e. Reduce `balance` by `principal_1`.
4. For each subsequent period k = 2..n:
   a. `interest_k = round_to_shilling(r * (30 / 360) * balance)`.
   b. `principal_k = round_to_shilling(P / n)` for k < n; for the final period k = n, `principal_n = balance` (the entire remaining balance, absorbing all accumulated rounding residue).
   c. Total instalment k `= interest_k + principal_k`.
   d. Reduce `balance` by `principal_k`.
5. After the final instalment, `balance` is exactly zero.
6. Assign due dates per section 6 (first at `d + 1 month`, monthly thereafter, clamping to the last valid day of the target month).

## 10. Guarantees

- The sum of all principal portions equals the disbursed principal `P` exactly.
- The closing balance after the final instalment is exactly zero.
- Every reported interest, principal, and total amount is a whole-shilling value.
- The total instalment amount is non-increasing over the term for the regular-period component, with the first instalment additionally bearing any stub interest.

## 11. Notes on defaults

Several resolutions above are engine defaults rather than explicit institutional policy, and are subject to change when policy is set: the half-up rounding rule; the clamping of month-end due dates to the last valid day; the treatment of stub interest as added on top of the first instalment (rather than separately billed or capitalised); the constant principal beginning with the first instalment; anchoring periods to disbursement plus n months; charging stub interest on the full disbursed principal; and summing stub and first-period interest before a single rounding. Implementations should keep these behaviours configurable where practical so a future policy change does not require reworking the core computation.

## Auditor verdict

_The spec strongly covers the mechanical accrual and rounding core: decisions 1, 2, 3, 4, 6, 7, 8, 9, and 13 are surfaced and correct (9/14). It fails on the bespoke off-default policies that were never asked about: Rule-of-78 rebate (#10) and partial-prepayment re-amortisation (#11) are entirely absent; the zero/negative validation edge (#12) is not stated. Two surfaced-but-wrong divergences: the stub/interest-start rule (#5) is tied to an invented optional billing_day rather than accruing from disbursement date, and the output shape (#14) omits total cost of credit and the actual/365 disclosed APR quirk. Correct coverage: 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 5: 'Interest for each period is charged on the outstanding balance at the start of that period, so the interest portion declines over the term.' Section 4: 'Interest for each period is charged on the outstanding balance at the start of that period.' | The spec computes interest on the reducing outstanding balance (declining balance on reducing principal), matching the reference exactly. |
| 2 | yes | **yes** | Section 4: 'The schedule uses the equal-principal (constant amortisation) method, not annuity/EMI... The constant principal portion is P / n... Because principal is constant and interest declines, the total instalment amount decreases over the term.' | Spec states equal principal (P/n constant), interest on reducing balance, and total instalment decreasing — an exact match to the reference. |
| 3 | yes | **yes** | Section 5: 'Interest accrues under a 30/360 day-count basis. Every month is treated as 30 days and every year as 360 days.' | Spec explicitly adopts 30/360 with every month 30 days and year 360, matching the reference and rejecting actual/365. |
| 4 | yes | **yes** | Section 5: 'Interest is computed once per monthly repayment period, not by daily accrual.' | Interest calculation period is the same as the repayment period (once per monthly period, not daily), matching the reference. |
| 5 | yes | no | Section 7.1: 'A stub arises only when the product is configured with a fixed billing_day (day-of-month) that differs from the disbursement day-of-month... If no fixed billing day is configured, the first period is always a full 30/360 month and no stub arises.' | The reference says interest accrues from the disbursement date and a stub is levied whenever disbursement precedes the first period start. The spec makes the stub contingent on an optional billing_day rather than on disbursement timing, and defaults to no stub with the first due date always being disbursement + 1 month, so partial-period interest from disbursement is not the governing rule. This diverges from the reference resolution. |
| 6 | yes | **yes** | Section 2/8: 'denominated in KES' and 'Amounts are denominated in KES to 2 decimal places internally.' | Currency is Kenyan shilling (KES) and precision is 2 decimal places internally, matching the reference. |
| 7 | yes | **yes** | Section 8: 'each instalment is rounded to the whole shilling (no cents)... 8.2: Accumulated rounding differences across all periods are settled in the final instalment.' | Each instalment rounded to whole shilling with the accumulated residue settled in the final instalment — an exact match. |
| 8 | yes | **yes** | Section 8: '1. Interest is computed and rounded to the whole shilling first. 2. Principal is the remainder of the rounded instalment.' | Interest is rounded first and principal is the remainder of the rounded instalment, matching the within-period rounding order in the reference. |
| 9 | yes | **yes** | Section 3/8.2/10: 'The outstanding balance after the final instalment is exactly zero.' | The final instalment reconciles so the closing balance is exactly zero, matching the reference. |
| 10 | no | no | absent | The spec covers only schedule generation and says nothing about early full settlement or unearned-interest rebate, so the Rule of 78 policy is neither surfaced nor resolved. |
| 11 | no | no | absent | The spec does not address partial prepayment or re-amortisation strategy (fixed term vs fixed instalment), so this decision is unaddressed. |
| 12 | no | no | absent. Section 2 states 'term — the number of monthly instalments, a positive integer n' but no rejection of zero/negative principal or term is specified. | The spec asserts term is a positive integer but never states that zero/negative principal or term is rejected as invalid with an error, so the edge decision is not surfaced or resolved. |
| 13 | yes | **yes** | Section 6: 'The first instalment is due on disbursement_date + 1 month. Subsequent instalments are due monthly thereafter.' | First due date is disbursement + one month with monthly instalments thereafter, matching the reference exactly. |
| 14 | yes | no | Section 3 lists per-period schedule fields (instalment number, due date, interest, principal, total, running balance) but no total cost of credit and no disclosed APR; section 5 uses 30/360 only. | The spec returns the full per-period schedule but omits the total cost of credit (sum of interest) and, critically, the disclosed APR computed on an actual/365 basis. The 30/360-accrual-but-actual/365-disclosure split is absent, so the resolution does not match the reference. |
