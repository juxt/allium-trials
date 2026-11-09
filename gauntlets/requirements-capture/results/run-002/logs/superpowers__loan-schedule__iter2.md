# superpowers — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 7 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ Architectural work on a new engine; the brief omits several material policy decisions (amortisation method, interest/day-count convention, rounding and residual handling, first-instalment timing, fees) that cannot be reliably inferred and must be confirmed with the stakeholder before specifying.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/French amortisation, where each payment is the same and the principal/interest split shifts over time), equal principal per instalment (straight-line, where principal is constant and the total payment declines), or interest-only with a balloon principal repayment at the end?
A: Equal principal per instalment (straight-line / declining balance). A constant principal portion of P/n is applied each period; interest is calculated on the reducing outstanding balance; the total instalment therefore decreases over the term. Annuity/EMI and interest-only balloon structures are not used.

Q: How should the periodic (monthly) interest be derived from the annual nominal rate, and what day-count convention applies: a simple nominal split (annual rate / 12 applied to the outstanding balance each period), or interest accrued on actual days between instalment dates using a convention such as 30/360, actual/365, or actual/actual?
A: Simple nominal split: the annual nominal rate is divided by 12 and applied to the outstanding balance once per monthly period. The day-count convention is 30/360 — every month is treated as 30 days and the year as 360. Interest is not accrued on actual days between dates; it is computed once per repayment period.

Q: What are the money-rounding rules: to how many decimal places should each interest and principal amount be rounded, which rounding mode (e.g. round half up, banker's rounding), and how should the rounding residual be absorbed so the final balance closes exactly to zero (typically adjusting the last instalment)?
A: All amounts are in KES rounded to the whole shilling (zero decimal places — no cents). Within each period, interest is computed and rounded first; the principal component is the remainder of that period's rounded instalment. Rounding mode is round-half-up [default, not policy]. Accumulated rounding differences across the schedule are absorbed entirely in the final instalment, which is adjusted so the closing balance is exactly zero.

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month after disbursement, or on a fixed billing day), and is there any grace period or an odd/stub first period where interest accrues from the disbursement date to the first payment date over a non-standard number of days?
A: The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. If disbursement occurs before the nominal start of the first period, a stub interest charge is levied for those extra days — partial-period interest is permitted and is charged to the borrower.

Q: Are there any additional fees or charges that belong in the schedule (origination fee, per-instalment service fee, insurance), or should the schedule reflect principal and interest only?
A: The schedule covers principal and interest only. No origination fees, per-instalment service charges, or insurance premiums are defined as schedule line items [default, not policy — confirm with product team if any such fees exist in the product terms].

### Round 2
_Step reasoning:_ Core policies are settled; two material, non-inferable gaps remain around stub-interest presentation/effect and the month-end date-roll plus 30/360 stub day-count.

Q: For the stub interest when disbursement precedes the first period's nominal start: how is that partial-period charge presented in the schedule, and does it alter the regular instalments? Specifically, is it (a) a separate upfront line item, (b) added onto the first instalment's interest, or (c) capitalised into principal; and is the constant principal portion still P/n over exactly n instalments regardless of the stub?
A: The answer key confirms that stub interest is charged but does not specify its presentation. The regular principal portion remains P/n over exactly n instalments regardless of any stub — the stub does not alter the amortisation count or the constant principal slice. As for how the stub charge appears: it is added onto the first instalment's interest (option b), so the first instalment carries a slightly higher interest component than subsequent first-period interest would, while principal and all later instalments follow the normal schedule [default, not policy — confirm presentation format with product team].

Q: How is the monthly due date resolved when the disbursement day has no counterpart in a later month (e.g. disbursed on the 31st, or 29th-31st feeding into February): roll to the last day of the month, roll forward to the next month, or fix on a set billing day? And since day-count is 30/360, how are the stub's 'extra days' counted (actual calendar days, or 30/360 day difference)?
A: Month-end date rolling is not defined in the answer key. A reasonable default: roll to the last day of the target month (e.g. a 31st-of-month disbursement produces due dates on the last calendar day of each subsequent month) [default, not policy]. For counting the stub's extra days: since the operative convention is 30/360, the stub day count is computed as the 30/360 day difference between the disbursement date and the nominal first-period start date — not actual calendar days [default, not policy — confirm with product team].

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions with specific institutional answers are captured (straight-line amortisation, nominal/12 with 30/360, whole-shilling half-up rounding with residual in the final instalment, first instalment one month out with stub interest added to the first instalment's interest, P&I only); remaining open points returned as explicit non-policy defaults, so further questions would only fish beyond the answer key.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Purpose and scope

This specifies `generate_schedule(loan)`, the function that produces the full repayment schedule for a disbursed loan. Given a loan's principal, annual nominal interest rate, term in monthly instalments, and disbursement date, it returns the schedule: for each instalment, the interest due, the principal due, and the running outstanding balance.

The schedule covers principal and interest only. No origination fees, per-instalment service charges, or insurance premiums are schedule line items. [Default, not stated policy — the stakeholder did not define any such fees; confirm with the product team whether the product terms carry fees that belong in the schedule.]

## 2. Inputs

`loan` carries:

- **Principal** (`P`) — the disbursed amount, in KES.
- **Annual nominal interest rate** — the quoted yearly rate.
- **Term** (`n`) — the number of monthly instalments.
- **Disbursement date** — the date the loan was paid out.

## 3. Amortisation method

Equal principal per instalment (straight-line / declining-balance). A constant principal portion of `P / n` is applied each period. Interest is computed on the reducing outstanding balance, so the total instalment decreases over the term. Annuity/EMI (equal total instalments) and interest-only balloon structures are explicitly not used.

The regular principal portion remains `P / n` over exactly `n` instalments. Nothing below (including any stub interest) alters the amortisation count or the constant principal slice.

## 4. Interest derivation and day-count

Interest uses a simple nominal split: the annual nominal rate is divided by 12 to give the monthly rate, which is applied to the outstanding balance once per monthly period. Interest is computed once per repayment period, not accrued on actual days between instalment dates.

The day-count convention is 30/360: every month is treated as 30 days and the year as 360 days.

## 5. Rounding

- All amounts are in KES, rounded to the whole shilling (zero decimal places, no cents).
- Within each period, interest is computed and rounded first. The principal component is then the remainder of that period's rounded instalment (the regular principal portion being `P / n`).
- Rounding mode is round-half-up. [Default, not stated policy — the stakeholder did not specify a mode; confirm whether banker's rounding is required.]
- Accumulated rounding differences across the whole schedule are absorbed entirely in the final instalment, which is adjusted so the closing balance is exactly zero.

## 6. Instalment timing

- The first instalment is due exactly one month after the disbursement date. Subsequent instalments fall monthly thereafter.
- Month-end roll: when the disbursement day has no counterpart in a later month (e.g. disbursed on the 31st, or the 29th–31st feeding into February), the due date rolls to the last calendar day of the target month. [Default, not stated policy — the answer key does not define month-end rolling; confirm with the product team.]

## 7. Stub (odd first-period) interest

If disbursement occurs before the nominal start of the first period, a stub interest charge is levied for those extra days. Partial-period interest is permitted and is charged to the borrower.

- **Day counting for the stub:** the extra days are counted as the 30/360 day difference between the disbursement date and the nominal first-period start date, consistent with the operative convention. Actual calendar days are not used. [Default, not stated policy — confirm with the product team.]
- **Presentation:** the stub charge is added onto the first instalment's interest component (option b). The first instalment therefore carries a slightly higher interest component than its ordinary first-period interest alone, while its principal portion and all later instalments follow the normal schedule. [Default, not stated policy — the answer key confirms the stub is charged but does not fix its presentation; confirm the presentation format with the product team.]
- The stub does not change the principal slice (`P / n`) or the number of instalments (`n`).

## 8. Output

`generate_schedule(loan)` returns the full schedule as an ordered collection of `n` instalment rows. Each row contains:

- The instalment number (1 through `n`).
- The due date (per section 6).
- The interest due for the period (per sections 4 and 5; for instalment 1, inclusive of any stub interest per section 7).
- The principal due for the period (`P / n`, with the final instalment adjusted per section 5).
- The running outstanding balance after the instalment, reaching exactly zero at instalment `n`.

## 9. Worked rules summary

1. Compute the constant principal slice `P / n`.
2. For each period, compute interest as `outstanding_balance * (annual_rate / 12)`, under 30/360; round interest to the whole shilling (round-half-up).
3. For instalment 1, if disbursement precedes the nominal first-period start, add stub interest (30/360 day difference, charged to the borrower) onto that period's interest.
4. Apply the principal slice, reducing the outstanding balance.
5. In the final instalment, absorb all accumulated rounding differences so the closing balance is exactly zero.

## 10. Decisions recorded as defaults (not confirmed policy)

Resolved by the authoring process, not by the stakeholder, and flagged for product-team confirmation: round-half-up rounding mode; absence of any fees; month-end date roll to the last day of the target month; 30/360 counting of stub extra days; and presentation of the stub as an addition to the first instalment's interest. No stakeholder answers beyond those given have been invented.

## Auditor verdict

_Coverage = 9/14 correct. The spec nails the core method and arithmetic decisions (1-5, 7-9, 13), including the hardest bespoke ones: equal-principal amortisation (2), 30/360 (3), per-period interest (4), stub interest (5), whole-shilling rounding with residual in the final instalment (7), and interest-first rounding order (8). It fails on five: currency precision (6) is stated as zero decimals, contradicting the reference's 2dp; the three lifecycle decisions — Rule-of-78 rebate (10), term-fixed re-amortisation on prepayment (11), and zero/negative validation (12) — are wholly absent; and the output/disclosure decision (14) covers the schedule rows but omits both the total cost of credit and the actual/365 APR disclosure quirk. The gap concentrates on scope the function's narrow framing never reached (early payoff, prepayment, validation, regulatory disclosure) rather than on the schedule mechanics._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "Interest is computed on the reducing outstanding balance"; §4: monthly rate "applied to the outstanding balance once per monthly period". | Declining balance on reducing principal is explicitly stated and matches the reference (an inferable anchor). |
| 2 | yes | **yes** | §3: "Equal principal per instalment... A constant principal portion of P / n is applied each period... the total instalment decreases over the term. Annuity/EMI (equal total instalments)... explicitly not used." | Equal-principal (P/n), interest on reducing balance, decreasing total instalment, EMI ruled out — exactly the reference value. |
| 3 | yes | **yes** | §4: "The day-count convention is 30/360: every month is treated as 30 days and the year as 360 days." | 30/360 stated verbatim, matching the off-default reference answer. |
| 4 | yes | **yes** | §4: "applied to the outstanding balance once per monthly period... Interest is computed once per repayment period, not accrued on actual days between instalment dates." | Interest calculation period = repayment period, no daily accrual — matches the reference exactly. |
| 5 | yes | **yes** | §7: "If disbursement occurs before the nominal start of the first period, a stub interest charge is levied for those extra days. Partial-period interest is permitted and is charged to the borrower." | Stub interest from the disbursement date, partial-period interest allowed and charged — the reference position is stated. |
| 6 | yes | no | §2 lists amounts "in KES"; §5: "All amounts are in KES, rounded to the whole shilling (zero decimal places, no cents)." | Currency (KES) is correct, but the reference holds currency precision at 2 decimal places as a distinct decision from instalment rounding; the spec instead states zero decimal places for all amounts, contradicting the 2dp value, so the resolution does not match. |
| 7 | yes | **yes** | §5: "rounded to the whole shilling (zero decimal places, no cents)... Accumulated rounding differences across the whole schedule are absorbed entirely in the final instalment." | Whole-shilling instalments with the residual settled in the final instalment — matches the reference. |
| 8 | yes | **yes** | §5: "Within each period, interest is computed and rounded first. The principal component is then the remainder of that period's rounded instalment." | Interest rounded first, principal as the remainder — the reference ordering is stated (despite mild internal tension with the fixed P/n slice). |
| 9 | yes | **yes** | §5: "adjusted so the closing balance is exactly zero"; §8: "reaching exactly zero at instalment n." | Final instalment reconciles to an exactly-zero closing balance, matching the reference (an inferable anchor). |
| 10 | no | no | absent | The spec never addresses early full settlement or interest rebate; Rule of 78 is not mentioned. |
| 11 | no | no | absent | No treatment of partial prepayment, principal application, or re-amortisation strategy anywhere in the spec. |
| 12 | no | no | absent | The spec specifies no validation or rejection of zero/negative principal or term. |
| 13 | yes | **yes** | §6: "The first instalment is due exactly one month after the disbursement date. Subsequent instalments fall monthly thereafter." | First due date = disbursement + one month, monthly thereafter — matches the reference (an inferable anchor). |
| 14 | yes | no | §8 lists rows: "instalment number... due date... interest due... principal due... running outstanding balance." No mention of total cost of credit or disclosed APR. | Partial output shape is given (though opening balance and an explicit instalment total column are missing), but the reference's distinctive requirements — total cost of credit and the APR disclosed on an actual/365 basis despite 30/360 accrual — are entirely absent, so the resolution does not match. |
