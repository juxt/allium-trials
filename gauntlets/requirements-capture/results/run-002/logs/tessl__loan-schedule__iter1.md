# tessl — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 7 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ Start with the highest-impact, unanswered policy decision — the amortisation method — since it determines the entire shape of the schedule; one question at a time per the process.

Q: How should each instalment be computed: equal total payments over the term (annuity-style, where principal and interest shares vary each period) or equal principal repayments (where the principal share is constant and the total payment declines)?
A: Equal principal repayments: the principal portion is constant each period (P/n), interest is charged on the reducing balance, and the total instalment decreases over the term. Not annuity/EMI style.

### Round 2
_Step reasoning:_ Computation method is settled; the next highest-impact unknown is the interest accrual basis (monthly rate vs day-count), which materially changes every interest figure.

Q: How is the periodic interest computed from the annual nominal rate: a flat monthly rate of (annual rate / 12) applied to the outstanding balance each period, or a day-count-based accrual (e.g. actual days in period over 365/360) that varies with the calendar and the disbursement date?
A: A flat monthly rate of (annual rate / 12) applied to the outstanding balance each period. Day-count convention is 30/360 — every month counts as 30 days, the year as 360 — so the periodic rate is always exactly annual rate / 12. No calendar-based variation.

### Round 3
_Step reasoning:_ Amortization method and interest accrual are settled; rounding and residual-closing policy is the next uninferrable, high-impact gap before edge cases.

Q: How should monetary amounts be rounded, and how is any residual handled: are interest and principal each rounded to the minor currency unit (e.g. 2 decimal places) every period, and is the final instalment adjusted so the running balance closes exactly at zero?
A: Currency is KES, amounts to 2 decimal places. Each instalment is rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is the remainder of the rounded instalment. The accumulated rounding difference is settled in the final instalment, which is adjusted so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ Scope, interest, and rounding are settled, but the schedule still needs a due-date policy, which is institution-specific and cannot be reliably inferred.

Q: How are the instalment due dates derived from the disbursement date: is the first instalment due exactly one month after disbursement with each subsequent instalment on the same day of month, and how are month-end edge cases (e.g. disbursement on the 31st) handled?
A: The first instalment is due one month after the disbursement date; subsequent instalments fall monthly thereafter on the same day of month. Handling of month-end edge cases (e.g. disbursement on the 31st falling into a shorter month) is not specified in policy — [default, not policy]: clamp to the last day of the target month (e.g. 31 Jan → 28/29 Feb).

### Round 5
_Step reasoning:_ The four material policy axes (amortisation method, interest/day-count, rounding/residual, due dates) are resolved; the process now requires summarising and obtaining explicit stakeholder approval before completion.

Q: Before I hand these off for spec authoring, please confirm this summary of the clarified requirements is accurate and complete.

Scope — included: a `generate_schedule(loan)` function taking principal, annual nominal rate, term (months) and disbursement date, returning a per-instalment schedule with, for each instalment, the due date, interest due, principal due, and running balance. Excluded: fees, grace periods, prepayment/early settlement, and any variation of the stated conventions.

Core behaviour: equal-principal (reducing-balance) amortisation — constant principal portion P/n each period, interest on the outstanding balance, total instalment declining over the term. Periodic rate is a flat annual rate / 12 under a 30/360 day count (every month = 30 days, year = 360), so the rate is always exactly annual/12 with no calendar variation. Interest is charged in arrears on the balance outstanding during the period.

Rounding and residual: currency KES, 2 dp. Each instalment is rounded to the whole shilling. Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment. Accumulated rounding difference is settled in the final instalment, which is adjusted so the closing balance is exactly zero.

Due dates: first instalment one month after disbursement, subsequent instalments monthly on the same day of month. Month-end overflow (e.g. the 31st into a shorter month) clamps to the last day of the target month — noted as an implementation default, not stated policy.

Is this correct and complete, or is there anything to add or change before spec authoring?
A: Correct and complete within the stated scope. One addition before spec authoring: the schedule output must also include the total cost of credit (sum of all interest payments) and a disclosed APR computed on an actual/365 basis — even though accrual uses 30/360. This is a required output field, not an optional disclosure.

### Round 6
_Step reasoning:_ The stakeholder's Round 5 answer introduced a new required output (disclosed APR on actual/365) whose computation method is materially ambiguous and cannot be safely inferred, so one bounded clarifying question is needed before completion.

Q: For the disclosed APR on an actual/365 basis: how should it be derived — as the internal rate of return (effective annualised rate) that discounts the actual-dated instalment cash flows back to the disbursed principal, using actual calendar days between dates over a 365-day year; or as a simpler nominal figure (e.g. total interest / principal / term, annualised)? And should it be expressed as an annual percentage rounded to a set number of decimal places?
A: The APR derivation method and rounding precision are not specified in policy. [default, not policy]: derive it as the IRR — the effective annualised rate that discounts the actual-dated instalment cash flows back to the disbursed principal using actual calendar days over a 365-day year. Express it as an annual percentage rounded to 2 decimal places.

### Round 7
_Step reasoning:_ Two required outputs (total cost of credit, APR) were added after the last confirmation and the APR method is an unstated default, so the revised summary must be re-confirmed before I can close out.

Q: Here is the updated summary incorporating the two new required outputs; please confirm it is accurate and complete before spec authoring.

Scope — included: generate_schedule(loan) taking principal, annual nominal rate, term (months) and disbursement date, returning a per-instalment schedule (due date, interest due, principal due, running balance) plus two schedule-level outputs: the total cost of credit (sum of all interest payments) and a disclosed APR. Excluded: fees, grace periods, prepayment/early settlement, and any variation of the stated conventions.

Core behaviour: equal-principal (reducing-balance) amortisation — constant principal P/n each period, interest on the outstanding balance, total instalment declining over the term. Periodic rate is flat annual/12 under 30/360 (every month = 30 days, year = 360), no calendar variation; interest charged in arrears.

Rounding and residual: KES, 2 dp. Each instalment rounded to the whole shilling; within a period interest is computed and rounded first, principal is the remainder of the rounded instalment. Accumulated rounding difference settled in the final instalment so the closing balance is exactly zero.

Due dates: first instalment one month after disbursement, subsequent monthly on the same day of month; month-end overflow clamps to the last day of the target month (implementation default, not stated policy).

Total cost of credit: sum of all interest payments across the schedule.

Disclosed APR: required output field. Derivation method and precision are not stated in policy; implementation default is the IRR — the effective annualised rate discounting the actual-dated instalment cash flows back to the disbursed principal using actual calendar days over a 365-day year — expressed as an annual percentage rounded to 2 dp.

Is this correct and complete, or is there anything to add or change?
A: Correct and complete. Nothing to add or change before spec authoring.

### Round 8 (process signalled done)
_Step reasoning:_ The stakeholder explicitly confirmed the final summary (incorporating total cost of credit and disclosed APR) is correct and complete with nothing to add or change, so requirement gathering is finished.

(no questions this round)

## Produced specification

# Repayment Schedule Engine — Requirements Specification

## 1. Overview

This specification defines the repayment schedule engine for a loan product. The engine exposes a single function, `generate_schedule(loan)`, which takes a disbursed loan and returns its full repayment schedule together with two schedule-level disclosure outputs.

All requirements below were confirmed with the stakeholder. Where a decision was not stated in policy, it is marked explicitly as an implementation default; such defaults are still binding on the implementation but are flagged so they can be revisited if policy is later established.

## 2. Scope

### In scope
- A function `generate_schedule(loan)` that accepts a loan with:
  - `principal` — the disbursed principal amount
  - `annual_nominal_rate` — the annual nominal interest rate
  - `term` — the term expressed as a number of monthly instalments
  - `disbursement_date` — the date the loan was disbursed
- A per-instalment schedule where each instalment records:
  - due date
  - interest due
  - principal due
  - running (outstanding) balance after the instalment
- Two schedule-level outputs:
  - total cost of credit (sum of all interest payments across the schedule)
  - disclosed APR

### Out of scope
- Fees of any kind
- Grace periods
- Prepayment and early settlement
- Any variation of the conventions stated in this specification

## 3. Core behaviour: amortisation method

The schedule uses **equal-principal (reducing-balance) amortisation**, not annuity/EMI style:
- The principal portion is constant each period, equal to `principal / term` (P/n), subject to the rounding rules in section 5.
- Interest is charged on the outstanding balance during the period (interest in arrears).
- Because interest falls as the balance reduces while the principal portion stays constant, the total instalment declines over the term.

## 4. Interest computation

- The periodic (monthly) rate is a **flat `annual_nominal_rate / 12`**, applied to the outstanding balance each period.
- The day-count convention is **30/360**: every month counts as 30 days and the year as 360 days. The periodic rate is therefore always exactly `annual_nominal_rate / 12`, with no calendar-based variation and no dependence on the disbursement date or the number of actual days in a period.
- Interest for each period is computed on the balance outstanding during that period, before that period's principal repayment is applied.

## 5. Rounding and residual handling

- Currency is **KES**. Monetary amounts are held to 2 decimal places.
- Each instalment is **rounded to the whole shilling** (no cents).
- Within each period, the order of computation and rounding is:
  1. Compute the interest for the period and round it (to the whole shilling).
  2. The principal portion for the period is the **remainder of the rounded instalment** (rounded instalment minus rounded interest).
- The accumulated rounding difference is **settled in the final instalment**. The final instalment is adjusted so that the closing running balance is **exactly zero**.

## 6. Due dates

- The **first instalment** is due **one month after the disbursement date**.
- Each **subsequent instalment** falls monthly thereafter, on the **same day of month** as the first.
- **Month-end overflow** (e.g. a disbursement on the 31st when the target month is shorter) is handled by **clamping to the last day of the target month** (e.g. 31 January maps to 28 or 29 February).
  - *[Implementation default, not stated policy.]* Month-end edge-case handling was not specified by the stakeholder; this clamping rule is the implementation's resolution and should be revisited if policy is later defined.

## 7. Schedule-level outputs

### 7.1 Total cost of credit
- A required output field equal to the **sum of all interest payments** across the schedule.

### 7.2 Disclosed APR
- A **required output field** (not an optional disclosure).
- Derivation method and rounding precision were **not specified in policy**. The following is the implementation default:
  - *[Implementation default, not stated policy.]* The APR is derived as the **internal rate of return (IRR)**: the effective annualised rate that discounts the **actual-dated** instalment cash flows back to the disbursed principal, using **actual calendar days between dates over a 365-day year (actual/365)**.
  - Note that this actual/365 basis applies **only to the APR disclosure**; interest accrual for the schedule itself uses 30/360 as defined in section 4.
  - The APR is expressed as an **annual percentage rounded to 2 decimal places**.

## 8. Edge cases and boundary conditions

- Interest is computed on the reducing balance each period; the final period's interest is computed on the then-outstanding balance before the residual adjustment.
- The final instalment absorbs the accumulated rounding difference so that the closing balance is exactly zero; this means the final instalment's total may differ from the strict declining-instalment trend by the residual amount.
- No behaviour is defined for inputs outside the stated scope (fees, grace periods, prepayment, or any variation of the stated conventions); these are explicitly excluded.

## 9. Decisions explicitly settled

1. Amortisation: equal-principal (reducing balance), not annuity/EMI. *(stakeholder policy)*
2. Periodic rate: flat annual/12 under 30/360, no calendar variation. *(stakeholder policy)*
3. Rounding: KES, whole-shilling instalments; interest rounded first, principal is the remainder; residual settled in the final instalment to close at zero. *(stakeholder policy)*
4. Due dates: first instalment one month after disbursement, monthly on the same day of month. *(stakeholder policy)*
5. Month-end overflow: clamp to last day of target month. *(implementation default, not policy)*
6. Total cost of credit: sum of all interest payments, required output. *(stakeholder policy)*
7. Disclosed APR: required output; IRR on actual/365 of actual-dated cash flows, rounded to 2 dp. *(implementation default for derivation and precision; the requirement to disclose APR is stakeholder policy)*

The stakeholder confirmed this set of requirements as correct and complete within the stated scope, with nothing further to add or change before spec authoring.

## Auditor verdict

_The spec covers 11 of 14 decisions correctly. It nails the core bespoke method, convention, rounding and ordering decisions (2, 3, 4, 7, 8) plus the anchors (1, 6, 9, 13) and, notably, the non-obvious 30/360-accrual-but-actual/365-disclosure quirk (14). It fails on the three decisions it pushed out of scope or ignored: the stub/disbursement-date interest (#5, actively contradicted by removing disbursement-date dependence), the Rule-of-78 early-settlement rebate (#10), and the fixed-term re-amortisation on partial prepayment (#11), plus it omits zero/negative input validation (#12). Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the outstanding balance during the period" (s3); "applied to the outstanding balance each period" (s4) | The spec repeatedly applies interest to the reducing outstanding balance, which is declining-balance interest. Matches the reference. |
| 2 | yes | **yes** | "equal-principal (reducing-balance) amortisation, not annuity/EMI style ... The principal portion is constant each period, equal to principal / term (P/n) ... the total instalment declines over the term" (s3) | Explicitly states constant principal P/n, interest on reducing balance, decreasing total instalment. Exact match to the reference's equal-principal definition. |
| 3 | yes | **yes** | "The day-count convention is 30/360: every month counts as 30 days and the year as 360 days" (s4) | States 30/360 explicitly, matching the reference value. |
| 4 | yes | **yes** | "with no calendar-based variation and no dependence on the disbursement date or the number of actual days in a period" (s4); "Interest for each period is computed on the balance outstanding during that period" (s4) | Interest is computed once per monthly period with no daily accrual, matching 'same as the repayment period'. |
| 5 | yes | no | "no dependence on the disbursement date" (s4); "interest in arrears" (s3); prepayment/early settlement out of scope but stub interest not addressed | The reference requires interest to accrue from disbursement with a stub charge for partial periods before the first period. The spec explicitly removes any dependence on disbursement date and charges interest in arrears from period start, contradicting the stub-period rule. |
| 6 | yes | **yes** | "Currency is KES. Monetary amounts are held to 2 decimal places" (s5) | KES and 2 decimal places stated exactly, matching the reference. |
| 7 | yes | **yes** | "Each instalment is rounded to the whole shilling (no cents)" and "The accumulated rounding difference is settled in the final instalment" (s5) | Whole-shilling instalment rounding with the residual settled in the final instalment matches the reference exactly. |
| 8 | yes | **yes** | "Compute the interest for the period and round it ... The principal portion for the period is the remainder of the rounded instalment" (s5) | Interest computed and rounded first, principal as the remainder of the rounded instalment, matching the reference ordering exactly. |
| 9 | yes | **yes** | "The final instalment is adjusted so that the closing running balance is exactly zero" (s5) | Closing balance of exactly zero via the final instalment matches the reference. |
| 10 | no | no | "Prepayment and early settlement" listed as out of scope (s2); "Prepayment" excluded (s8) | Early full settlement rebate is explicitly placed out of scope, so the Rule of 78 policy is neither surfaced nor resolved. |
| 11 | no | no | "Prepayment and early settlement" listed as out of scope (s2); "prepayment" excluded (s8) | Partial prepayment handling is explicitly excluded, so the re-amortise-keeping-term-fixed policy is not addressed. |
| 12 | no | no | "No behaviour is defined for inputs outside the stated scope" (s8); no mention of zero/negative principal or term validation | The spec does not address rejecting zero/negative principal or term; invalid-input validation is absent. |
| 13 | yes | **yes** | "The first instalment is due one month after the disbursement date" and "Each subsequent instalment falls monthly thereafter" (s6) | First due date of disbursement + one month with monthly instalments thereafter matches the reference. |
| 14 | yes | **yes** | "total cost of credit (sum of all interest payments)" (s7.1); "disclosed APR ... actual calendar days between dates over a 365-day year (actual/365) ... interest accrual for the schedule itself uses 30/360" (s7.2); per-instalment schedule with due date, interest, principal, balance (s2) | Full schedule, total cost of credit, and APR disclosed on actual/365 while accrual uses 30/360 all match the reference, including the non-obvious dual day-count split. |
