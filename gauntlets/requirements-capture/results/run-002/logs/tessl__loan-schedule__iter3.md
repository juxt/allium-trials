# tessl — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 8 · Captured: 10/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ Starting with the single highest-impact question — the amortisation method — since it determines the entire shape of the schedule before edge cases matter.

Q: Should each instalment be a fixed equal total payment (standard amortising annuity, where principal and interest vary over the term), or equal principal per instalment with interest charged on the declining balance?
A: Equal principal per instalment: each period the principal portion is a constant P/n, interest is charged on the declining balance, so the total instalment decreases over the term. Not a fixed equal total payment (annuity/EMI).

### Round 2
_Step reasoning:_ Equal-principal method is fixed; the next highest-impact gap is the exact per-period interest calculation (periodic rate and day-count convention), which materially changes every interest figure.

Q: How is each period's interest computed from the annual nominal rate: a simple monthly rate of (annual rate / 12) applied to the opening balance each instalment, or a day-count convention (e.g. actual/365 or 30/360) based on the actual days in each period?
A: 30/360 day-count convention: every month is treated as 30 days, the year as 360. Interest is computed once per monthly period (not daily accrual), applied to the opening balance for that period.

### Round 3
_Step reasoning:_ Amortisation method and interest day-count are settled; rounding precision and residual handling are the next material, non-inferable policy affecting every schedule figure.

Q: To what precision are the interest, principal, and instalment amounts rounded (e.g. 2 decimal places / minor currency units), and how is the cumulative rounding residual handled so the schedule fully amortises — for example, adjust the final instalment's principal so the closing balance is exactly zero?
A: Amounts are in Kenyan shilling (KES), rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is the remainder of the rounded instalment. The accumulated rounding difference across all periods is settled in the final instalment, so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ Amortisation method, day-count and rounding are settled; the first-instalment timing and how due dates derive from the disbursement date remain materially ambiguous and drive both the dates and the first period's interest.

Q: Relative to the disbursement date, when does the first instalment fall and how are the per-instalment due dates derived: is the first instalment due exactly one month after disbursement (and each subsequent instalment on the same day-of-month thereafter), with every period treated as a full 30/360 month so the opening period accrues a full month's interest — or is there a stub/odd first period (e.g. interest from the disbursement date to the first due date) handled differently?
A: The first instalment falls due exactly one month after the disbursement date, with subsequent instalments on the same day-of-month each month thereafter. Each regular period is treated as a full 30/360 month and accrues a full month's interest. However, if the disbursement date precedes the first period start date, a stub period applies: interest accrues from the disbursement date to the first period start, and a separate stub interest charge is levied for those extra days (partial-period interest is permitted and charged). The regular monthly schedule then runs from the first period start.

### Round 5
_Step reasoning:_ Round 4 introduced a stub period but left its day-count basis and collection/accounting treatment unspecified, both material and non-inferable.

Q: For the stub period, how is the partial-period interest computed and collected: (a) what day-count rule gives the stub's day fraction — 30/360 (where each whole month counts 30 days and the stub fraction is stub_days/360 on the principal) or actual days — and (b) is the stub interest added to the first regular instalment, billed as a separate charge on the first period start date, or capitalised into the opening balance?
A: (a) 30/360: the stub day-count follows the same convention as the rest of the schedule — stub days are counted under 30/360 rules and the fraction applied to principal is stub_days/360. (b) [default, not policy] The stub interest is added to the first regular instalment (i.e. the first payment collected from the borrower covers both the stub interest charge and the first period's regular instalment).

### Round 6
_Step reasoning:_ Rounding precision is fixed but the rounding mode is still unspecified and is an institution-specific policy that materially changes each period's interest, principal split, and the final residual.

Q: When interest is rounded to the whole shilling each period, which rounding mode applies — round half up (0.5 rounds away from zero), round half to even (banker's rounding), or round down/truncate toward zero?
A: [default, not policy] Round half up — 0.5 rounds away from zero.

### Round 7
_Step reasoning:_ Policy decisions appear covered (last two rounds hit non-policy defaults); the process requires presenting a summary for explicit stakeholder confirmation before completing, and I flag two possible residual gaps.

Q: Before I close out requirement gathering, please confirm this summary is accurate and complete. SCOPE: generate_schedule(loan) takes principal, annual nominal rate, term in monthly instalments, and disbursement date, and returns the full schedule (per instalment: interest due, principal due, running balance). CORE BEHAVIOUR: equal-principal method, with a constant principal portion of P/n each period and interest on the declining opening balance, so total instalments decline over the term. Interest uses 30/360 (every month 30 days, year 360), computed once per monthly period on the opening balance. The first instalment falls due exactly one month after disbursement, subsequent instalments on the same day-of-month, each regular period a full 30/360 month accruing a full month's interest. STUB: if the disbursement date precedes the first period start, a stub charge accrues from disbursement to first period start at 30/360 (fraction = stub_days/360 on principal), added to the first regular instalment. ROUNDING: amounts in whole KES (no cents); each period interest is computed and rounded first (round half up, 0.5 away from zero), principal is the remainder of the rounded instalment; the accumulated rounding residual is settled in the final instalment so the closing balance is exactly zero. Is all of this correct, and is there any further material policy (e.g. end-of-month / day-of-month handling when disbursement falls on the 29th-31st, or input validation for zero-rate / zero-term loans) that should be pinned down before I treat requirements as final?
A: The summary is accurate as stated. Two policy items from the answer key are not yet reflected and should be pinned before you treat requirements as final. First, output shape: generate_schedule must return, per period, the due date, opening balance, interest, principal, instalment total, and closing balance — not just interest, principal, and running balance — plus the total cost of credit (sum of all interest charges) and the disclosed APR computed on an actual/365 basis even though accrual uses 30/360. Second, input validation: zero or negative principal or term is rejected as invalid with an error. On end-of-month handling when disbursement falls on the 29th–31st: [default, not policy] clamp to the last day of the month when the target month is shorter (e.g. 31 Jan + 1 month → 28/29 Feb).

### Round 8
_Step reasoning:_ Summary confirmed and two new policy items supplied, but the disclosed APR (actual/365) computation method is still genuinely underspecified and material, so I pin it before closing.

Q: On the two newly added items I'll treat as pinned: (1) output shape now includes, per period, due date, opening balance, interest, principal, instalment total, and closing balance, plus the total cost of credit (sum of all interest) and a disclosed APR; (2) zero or negative principal or term is rejected as invalid. My one remaining gap is the APR computation itself: you specified it is disclosed on an actual/365 basis even though accrual uses 30/360. How exactly should the disclosed APR be derived — is it the annualised internal rate of return (effective rate) that equates the discounted actual-date cash flows (instalments, including any stub charge) to the disbursed principal, solved so that discounting uses actual days between each due date and disbursement over 365; and does it include the stub interest and use the net amount disbursed as the present value? Please confirm the precise APR definition so I can treat requirements as final.
A: [default, not policy] Yes: the disclosed APR is the annualised internal rate of return (IRR / XIRR-style) that equates the present value of all actual cash flows to the net disbursed principal. Concretely: solve for the annual rate r such that the sum of each payment (instalments plus any stub interest charge, at their actual calendar due dates) discounted by (1 + r)^(d/365) — where d is the actual number of days from disbursement to that due date — equals the principal disbursed. The stub interest is included as part of the first payment, and the present value anchor is the gross disbursed principal (no origination fees are in scope unless later specified). The answer key confirms only that actual/365 is used for the APR disclosure; the IRR solver definition above is the standard reading of that requirement and is the approach to treat as final.

### Round 9 (process signalled done)
_Step reasoning:_ All material policy decisions (equal-principal method, 30/360 accrual, whole-KES round-half-up rounding with residual settled in final instalment, one-month-after-disbursement due dates with 30/360 stub added to first instalment, output shape, zero/negative input rejection, and the actual/365 IRR-based APR) have been elicited and confirmed as final, so requirement gathering is complete.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## Status

Requirements confirmed by the stakeholder (Round 7 summary confirmed; Rounds 8 additions pinned). Ready for spec authoring and implementation. Every policy below is either stated by the stakeholder or, where flagged, resolved by the documented default rule for decisions neither asked nor covered by the brief.

## 1. Scope

### In scope

A single function, `generate_schedule(loan)`, that takes a disbursed loan and returns its full repayment schedule.

The `loan` input carries:

- principal (KES)
- annual nominal interest rate
- term, expressed as a number of monthly instalments
- disbursement date

The function returns, for each instalment: due date, opening balance, interest due, principal due, instalment total, and closing balance. It also returns two schedule-level figures: the total cost of credit (the sum of all interest charged, including any stub interest) and the disclosed APR computed on an actual/365 basis.

### Out of scope

- The annuity / EMI method (a fixed equal total payment each period).
- Daily interest accrual.
- Origination or any other fees. These do not enter the APR present-value anchor and may be added under a later requirement.
- Any currency other than KES, and any rate input other than the single annual nominal rate.

## 2. Core behaviour

### 2.1 Repayment method

Equal principal per instalment. The principal portion is a constant P/n each period, where P is the principal and n is the term in instalments. Interest is charged on the declining opening balance, so the total instalment decreases over the term. This is not a fixed equal total payment.

### 2.2 Interest computation

Interest uses the 30/360 day-count convention: every month is treated as 30 days and the year as 360 days. Interest is computed once per monthly period, not accrued daily, and is applied to the opening balance for that period.

For a full regular period the day fraction is 30/360, so the period interest equals the opening balance multiplied by (annual nominal rate / 12).

### 2.3 Due dates

The first instalment falls due exactly one month after the disbursement date. Each subsequent instalment falls due on the same day-of-month thereafter. Every regular period is treated as a full 30/360 month and accrues a full month's interest.

When the target month is shorter than the disbursement day-of-month (disbursement on the 29th, 30th or 31st), the due date clamps to the last day of that month. For example, 31 January plus one month gives 28 or 29 February. [Default rule, not stakeholder policy.]

### 2.4 Stub period

If the disbursement date precedes the first period start date, a stub period applies. Interest accrues from the disbursement date to the first period start, and a separate stub interest charge is levied for those extra days. Partial-period interest is permitted and charged. The regular monthly schedule then runs from the first period start.

The stub day-count follows the same 30/360 convention as the rest of the schedule: stub days are counted under 30/360 rules and the fraction applied to the principal is stub_days / 360.

The stub interest is added to the first regular instalment. The first payment collected from the borrower therefore covers both the stub interest charge and the first period's regular instalment. [The actual/365 vs 30/360 point and the 'added to first instalment' collection method were confirmed; the collection method is the documented default reading.]

When the disbursement date coincides with the first period start, there is no stub and no stub charge.

### 2.5 Rounding

All amounts are in Kenyan shillings (KES), rounded to the whole shilling with no cents.

Within each period, interest is computed and rounded first, then the principal portion is taken. The rounding mode is round half up: 0.5 rounds away from zero. [The round-half-up mode is the documented default; all other rounding mechanics are stakeholder policy.]

The principal portion is the constant P/n rounded to the whole shilling. The instalment total for a period is the rounded principal plus the rounded interest. The closing balance is the opening balance minus the principal portion.

The accumulated rounding residual across all periods is settled in the final instalment: the final instalment's principal is adjusted so that the closing balance is exactly zero. The schedule fully amortises.

### 2.6 Total cost of credit

The total cost of credit is the sum of all interest charges across the schedule, including any stub interest.

### 2.7 Disclosed APR

The disclosed APR is computed on an actual/365 basis even though interest accrual uses 30/360.

It is the annualised internal rate of return (an IRR / XIRR-style figure) that equates the present value of all actual cash flows to the net disbursed principal. Concretely, solve for the annual rate r such that the sum over all payments of payment / (1 + r)^(d/365) equals the principal disbursed, where d is the actual number of calendar days from the disbursement date to that payment's due date, and each payment is taken at its actual calendar due date.

The payments are the instalments plus any stub interest charge. The stub interest is included as part of the first payment. The present-value anchor is the gross disbursed principal; no origination fees are in scope unless later specified. [The IRR solver definition is the documented standard reading of the confirmed actual/365 requirement and is to be treated as final.]

## 3. Edge cases and boundary conditions

- **Stub present vs absent.** When disbursement precedes the first period start, charge stub interest per section 2.4 and fold it into the first instalment. When they coincide, no stub applies.
- **Short target months.** Due dates clamp to the last day of the month when the disbursement day-of-month exceeds the days in the target month (section 2.3).
- **Final instalment reconciliation.** The final instalment's principal absorbs the accumulated rounding residual so the closing balance is exactly zero (section 2.5).
- **Input validation.** Zero or negative principal is rejected as invalid with an error. Zero or negative term is rejected as invalid with an error.

## 4. Constraints

- **Currency and precision.** All monetary outputs are whole KES.
- **Accrual vs disclosure.** Interest accrual uses 30/360; the disclosed APR uses actual/365. The two conventions coexist by design.
- **Determinism.** Given the same loan input, the schedule and all derived figures are fully determined by the policies above.
- **Amortisation guarantee.** The schedule must fully amortise the principal, with the final closing balance exactly zero.

## 5. Output shape (per the confirmed requirements)

For each instalment, in order:

- due date
- opening balance
- interest due
- principal due
- instalment total
- closing balance

Schedule-level:

- total cost of credit (sum of all interest, including stub interest)
- disclosed APR (actual/365 IRR as defined in section 2.7)

## 6. Provenance notes

The following items were resolved by the authoring process's default rules rather than stated as stakeholder policy, and are flagged inline above: the round-half-up rounding mode; the collection of stub interest within the first regular instalment; end-of-month clamping for disbursement on the 29th to 31st; and the precise IRR/XIRR definition of the actual/365 APR. All other decisions are stakeholder policy confirmed during requirement gathering. No decision outside the brief and the stakeholder conversation has been invented; matters not raised (for example, handling of a zero or negative nominal rate beyond the stated principal and term validation) are left unspecified.

## Auditor verdict

_The spec is strong: 10 of 14 decisions correct (coverage 10/14). It captures every bespoke method/temporal/output decision including the subtle dual day-count APR disclosure (#14), stub interest (#5), equal-principal amortisation (#2), 30/360 (#3), and whole-shilling rounding with final-instalment residual (#7, #9). Two decisions are surfaced but mismatched: #6 (precision stated as whole shilling/no cents rather than 2 decimal places) and #8 (principal treated as independently rounded P/n with the instalment as the sum, not as the remainder of the rounded instalment). Two decisions are entirely absent: #10 (Rule-of-78 early-settlement rebate) and #11 (partial-prepayment re-amortisation keeping term fixed), both off-default method choices never raised in the brief._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 2.1: "Interest is charged on the declining opening balance"; 2.2 references the declining balance method. | The spec explicitly charges interest on the reducing/declining opening balance, matching declining-balance on reducing principal. |
| 2 | yes | **yes** | Section 2.1: "Equal principal per instalment. The principal portion is a constant P/n each period... the total instalment decreases over the term. This is not a fixed equal total payment." | Matches the reference exactly: constant P/n principal, interest on reducing balance, decreasing instalment, explicitly not EMI. |
| 3 | yes | **yes** | Section 2.2: "Interest uses the 30/360 day-count convention: every month is treated as 30 days and the year as 360 days." | States 30/360 precisely, matching the reference and explicitly not actual/365. |
| 4 | yes | **yes** | Section 2.2: "Interest is computed once per monthly period, not accrued daily, and is applied to the opening balance for that period." | Interest calculation period equals the repayment period (once per month, not daily), matching the reference. |
| 5 | yes | **yes** | Section 2.4: "Interest accrues from the disbursement date to the first period start, and a separate stub interest charge is levied for those extra days. Partial-period interest is permitted and charged." | Accrual from disbursement with a charged stub for extra days and allowed partial-period interest matches the reference. |
| 6 | yes | no | Section 2.5: "All amounts are in Kenyan shillings (KES), rounded to the whole shilling with no cents." | Currency KES is correct, but the reference precision is 2 decimal places; the spec states whole shilling with no cents (0 dp), contradicting the 2 dp value, so the precision does not match. |
| 7 | yes | **yes** | Section 2.5: "rounded to the whole shilling with no cents... The accumulated rounding residual across all periods is settled in the final instalment." | Whole-shilling instalment rounding with the accumulated residual settled in the final instalment matches the reference exactly. |
| 8 | yes | no | Section 2.5: "interest is computed and rounded first, then the principal portion is taken... The principal portion is the constant P/n rounded to the whole shilling. The instalment total for a period is the rounded principal plus the rounded interest." | The spec rounds interest first but then makes principal an independently rounded P/n with the instalment as their sum, whereas the reference makes principal the remainder of the rounded instalment; this is a plausible-but-different resolution. |
| 9 | yes | **yes** | Section 2.5 / Section 4: "the final instalment's principal is adjusted so that the closing balance is exactly zero." | Final instalment reconciles to an exactly zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or any interest rebate, so Rule of 78 is neither surfaced nor resolved. |
| 11 | no | no | absent | The spec never addresses partial prepayment or re-amortisation, so the apply-to-principal/term-fixed policy is not surfaced. |
| 12 | yes | **yes** | Section 3: "Zero or negative principal is rejected as invalid with an error. Zero or negative term is rejected as invalid with an error." | Zero/negative principal or term rejected as invalid matches the reference. |
| 13 | yes | **yes** | Section 2.3: "The first instalment falls due exactly one month after the disbursement date. Each subsequent instalment falls due on the same day-of-month thereafter." | First due date = disbursement + one month with monthly instalments thereafter matches the reference. |
| 14 | yes | **yes** | Section 5 lists per-period due date, opening balance, interest due, principal due, instalment total, closing balance; 2.6 "sum of all interest charges"; 2.7 "disclosed APR is computed on an actual/365 basis even though interest accrual uses 30/360." | Full per-period schedule fields, total cost of credit as summed interest, and the 30/360-accrual-but-actual/365-disclosure split all match the reference, including the non-obvious dual day-count quirk. |
