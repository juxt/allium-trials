# kiro — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 6 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief fixes the domain and interface but omits amortisation method, rate/day-count convention, instalment timing/stub-period handling, and rounding policy — each has several plausible answers only the stakeholder can resolve, so I ask before drafting.

Q: Repayment structure: should the schedule use a fixed level instalment (amortising, where each payment is equal and the principal/interest split changes over time), or constant principal per instalment (interest computed on the declining balance, giving a declining total payment)?
A: Constant principal: a fixed principal portion (P/n) each period, with interest on the declining balance, so the total instalment decreases over the term. Not equal/level instalments.

Q: Periodic interest rate: how is the monthly rate derived from the annual nominal rate — simply annual/12, or an effective monthly rate, and which day-count convention applies (e.g. 30/360, actual/365) for any partial periods?
A: Annual nominal rate divided by 12 gives the periodic monthly rate. Day-count convention is 30/360 — every month counts as 30 days, the year as 360. Interest is computed once per monthly period, not via daily accrual.

Q: Instalment timing: when is the first instalment due relative to the disbursement date (e.g. exactly one month after, or on a fixed day-of-month), and does interest accrue over any odd/stub period between disbursement and the first scheduled payment?
A: First instalment is due exactly one month after the disbursement date, with subsequent instalments monthly thereafter. If disbursement precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged.

Q: Rounding policy: to what precision are interest and principal rounded each instalment (e.g. 2 decimals / minor currency units), and how is the residual rounding difference absorbed — adjusted in the final instalment so the balance closes exactly at zero?
A: Currency is KES. Each instalment is rounded to the whole shilling (no cents); within each period, interest is computed and rounded first, and principal is the remainder of that rounded instalment. The accumulated rounding difference is settled in the final instalment so the closing balance is exactly zero.

### Round 2
_Step reasoning:_ Rate, structure, timing and rounding are settled, but the stub-period mechanics the stakeholder introduced remain ambiguous (and seemingly contradict the one-month rule), and date-adjustment/short-month handling is an unconfirmed material policy; both need the stakeholder before the spec can be correct.

Q: Stub/odd-days interest: you noted a stub charge applies when disbursement precedes the first period start, yet the first instalment is "exactly one month after disbursement" (which implies no gap). Under what circumstances does a stub actually arise (e.g. a fixed billing day-of-month causing an odd first period), how are the stub days counted under 30/360, and is that stub interest added to the first instalment, billed as a separate upfront charge, or capitalised into principal?
A: The answer key confirms a stub applies when disbursement precedes the first period start (item 5), but given that the first due date is defined as disbursement date plus one month (item 13), a stub only arises if the system also supports a fixed billing day-of-month that causes the first period to start on a date other than the disbursement date itself — for example, a loan disbursed on the 15th where periods are anchored to the 1st of each month. The answer key does not specify whether such a fixed billing-day feature exists; that circumstance is [default, not policy]. For stub-day counting under 30/360: each calendar day in the odd period counts as one day against a 360-day year, so stub interest = principal × annual rate × stub days / 360; this is the natural 30/360 extension but is [default, not policy]. For billing treatment: [default, not policy] — the most common practice is to add the stub interest charge to the first instalment rather than bill it separately or capitalise it into principal.

Q: Instalment date adjustment: if a scheduled monthly due date lands on a non-business day (weekend/holiday) or on a day-of-month that a given month lacks (e.g. the 31st, or 30th in February), does the due date shift, and if so does that shift change the interest computed for that period, or does 30/360 keep every period's interest identical regardless of calendar date?
A: The answer key does not set an explicit date-adjustment policy for non-business days or short months, so this is [default, not policy]. A reasonable default: if the computed due date falls on a weekend or public holiday, it rolls forward to the next business day; if the day-of-month does not exist in a given month (e.g. the 31st in a 30-day month, or the 30th in February), it falls on the last calendar day of that month. Crucially, under 30/360, every monthly period is defined as exactly 30 days regardless of when the calendar date actually falls — so interest computed for each period is identical whether or not the due date has been adjusted, and no extra interest accrues from a date shift.

### Round 3 (process signalled done)
_Step reasoning:_ The four material policy decisions (constant-principal structure, nominal/12 rate with 30/360, one-month-after timing with stub, whole-KES rounding with interest-first and residual in final instalment) are all captured with institution-specific answers; Round 2 returned only '[default, not policy]' items, signalling the policy-bearing questions are exhausted, so I can proceed to write the requirements.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the repayment schedule engine for the loan product. Given a disbursed loan described by its principal, annual nominal interest rate, term in monthly instalments, and disbursement date, the engine produces the complete repayment schedule. For every instalment the schedule states the interest due, the principal due, the total instalment, and the running balance after payment. The public interface is a single function, `generate_schedule(loan)`, which returns the schedule.

The product uses a constant-principal (declining-balance) repayment method: a fixed principal portion is repaid each period, interest is charged on the outstanding balance, and the total instalment falls over the term. Interest is derived from the annual nominal rate on a 30/360 day-count basis, computed once per monthly period. Amounts are in Kenyan shillings (KES) and rounded to the whole shilling, with accumulated rounding settled in the final instalment so the loan closes at exactly zero.

Requirements 1 to 5 record policy decisions confirmed by the stakeholder. Requirements 6 and 7 record edge-case behaviour that the stakeholder did not set as policy; these are documented as engine defaults and flagged as assumptions to be confirmed.

## Requirements

### Requirement 1: Constant-principal repayment structure

**User Story:** As a loan servicing officer, I want each instalment to repay a fixed portion of principal with interest charged on the declining balance, so that the borrower's total payment decreases over the term in line with our product policy.

#### Acceptance Criteria

1. WHEN the schedule is generated for a loan of principal P over n monthly instalments THEN the engine SHALL set the scheduled principal portion of each instalment to P divided by n (the constant-principal amount), subject to the final-instalment rounding adjustment in Requirement 4.
2. WHEN the interest for an instalment is computed THEN the engine SHALL compute it on the outstanding balance at the start of that period, not on the original principal.
3. WHEN successive instalments are compared THEN the engine SHALL produce a total instalment (interest plus principal) that declines over the term, because the interest component falls as the balance declines.
4. The engine SHALL NOT use an equal/level (amortising) instalment structure.
5. WHEN each instalment is produced THEN the engine SHALL report its interest due, its principal due, the total instalment, and the running outstanding balance after the payment is applied.

### Requirement 2: Periodic interest rate and day-count convention

**User Story:** As a finance controller, I want interest derived from the annual nominal rate on a 30/360 basis and charged once per month, so that interest matches our stated convention and is reproducible.

#### Acceptance Criteria

1. WHEN the periodic rate is derived from the annual nominal rate THEN the engine SHALL compute the monthly rate as the annual nominal rate divided by 12.
2. The engine SHALL NOT convert the annual nominal rate into an effective monthly rate.
3. WHEN interest for a full monthly period is computed THEN the engine SHALL apply the 30/360 convention, treating every month as 30 days and the year as 360 days.
4. WHEN interest is charged THEN the engine SHALL compute it once per monthly period rather than by daily accrual.

### Requirement 3: Instalment timing and stub interest

**User Story:** As a borrower, I want my first instalment due one month after disbursement with monthly instalments thereafter, so that my repayment dates are predictable.

#### Acceptance Criteria

1. WHEN the schedule is generated THEN the engine SHALL set the first instalment due date to exactly one month after the disbursement date.
2. WHEN subsequent instalments are scheduled THEN the engine SHALL set each one month after the previous instalment.
3. IF the disbursement date precedes the start of the first scheduled period THEN the engine SHALL levy a stub (partial-period) interest charge for the extra days.
4. The engine SHALL permit and charge partial-period interest where a stub period arises.

### Requirement 4: Rounding policy and exact closure

**User Story:** As an accountant, I want every instalment rounded to the whole shilling with accumulated rounding absorbed in the final instalment, so that the closing balance is exactly zero and the ledger reconciles.

#### Acceptance Criteria

1. The engine SHALL express all amounts in KES and round each instalment to the whole shilling, with no cents or minor units.
2. WHEN an instalment is computed THEN the engine SHALL compute and round the interest component first, then set the principal component to the remainder of the rounded instalment.
3. WHEN the final instalment is computed THEN the engine SHALL settle the accumulated rounding difference in that instalment so that the closing outstanding balance is exactly zero.
4. WHEN the schedule is complete THEN the engine SHALL ensure the sum of all principal portions equals the original principal exactly.

### Requirement 5: Schedule output and inputs

**User Story:** As a developer integrating the engine, I want `generate_schedule(loan)` to accept the disbursed-loan inputs and return a full per-instalment schedule, so that downstream systems can display and post repayments.

#### Acceptance Criteria

1. WHEN `generate_schedule(loan)` is called THEN the engine SHALL accept a loan defined by principal, annual nominal interest rate, term in monthly instalments, and disbursement date.
2. WHEN the schedule is returned THEN the engine SHALL include one row per instalment, each carrying the due date, interest due, principal due, total instalment, and running balance.
3. IF a stub interest charge arises under Requirement 3 THEN the engine SHALL include that charge in the schedule as described in Requirement 6.

### Requirement 6: Stub-period handling (engine default — assumption, not stakeholder policy)

**User Story:** As a product owner, I want a documented default for how stub periods arise and are charged, so that the engine behaves consistently until a firm policy is set.

#### Acceptance Criteria

1. The stakeholder has NOT confirmed whether a fixed billing day-of-month feature exists; the engine SHALL treat the following as a default pending confirmation.
2. IF a fixed billing day-of-month is configured such that the first period starts on a date other than the disbursement date (for example, disbursement on the 15th with periods anchored to the 1st) THEN a stub period SHALL arise; otherwise, with the first due date defined as disbursement plus one month, no stub SHALL arise.
3. WHEN stub interest is computed THEN the engine SHALL count each calendar day in the odd period as one day against a 360-day year and compute stub interest as principal multiplied by the annual rate multiplied by stub days divided by 360.
4. WHEN stub interest is charged THEN the engine SHALL add it to the first instalment, rather than billing it separately upfront or capitalising it into principal.
5. The engine SHALL flag the behaviours in this requirement as defaults requiring stakeholder confirmation.

### Requirement 7: Due-date adjustment (engine default — assumption, not stakeholder policy)

**User Story:** As a loan servicing officer, I want a documented default for due dates that fall on non-business days or non-existent days, so that payment dates are valid without changing the interest charged.

#### Acceptance Criteria

1. The stakeholder has NOT set a date-adjustment policy; the engine SHALL treat the following as a default pending confirmation.
2. IF a computed due date falls on a weekend or public holiday THEN the engine SHALL roll it forward to the next business day.
3. IF a computed due date falls on a day-of-month that the month lacks (for example the 31st in a 30-day month, or the 30th in February) THEN the engine SHALL set it to the last calendar day of that month.
4. WHEN a due date is adjusted under this requirement THEN the engine SHALL keep each monthly period's interest identical, because 30/360 defines every monthly period as exactly 30 days regardless of the calendar date, and no extra interest SHALL accrue from a date shift.
5. The engine SHALL flag the behaviours in this requirement as defaults requiring stakeholder confirmation.

---

Do the requirements look good? If so, we can move on to the design.

## Auditor verdict

_The spec strongly covers the base-schedule decisions: interest method (1), equal-principal amortisation (2), 30/360 (3), per-period interest (4), disbursement-date stub interest (5), KES currency (6), whole-shilling rounding (7), interest-first rounding order (8), exact-zero closure (9), and first due date (13) are all surfaced and correct — 11 of 14. The three lifecycle/disclosure decisions are missed: early-settlement Rule-of-78 rebate (10) and partial-prepayment re-amortisation (11) are entirely absent, zero/negative input validation (12) is absent, and the output (14) omits both total cost of credit and the actual/365 disclosed APR. Coverage: 11/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Introduction: "The product uses a constant-principal (declining-balance) repayment method... interest is charged on the outstanding balance"; R1 AC2: "compute it on the outstanding balance at the start of that period, not on the original principal". | Declining balance on the reducing principal is explicitly stated and is the interest method of the schedule. |
| 2 | yes | **yes** | Introduction: "constant-principal (declining-balance) repayment method: a fixed principal portion is repaid each period"; R1 AC1: "principal portion of each instalment to P divided by n"; R1 AC4: "SHALL NOT use an equal/level (amortising) instalment structure". | Equal principal (P/n), interest on reducing balance, total instalment decreasing, explicitly not EMI — matches the reference exactly. |
| 3 | yes | **yes** | R2 AC3: "SHALL apply the 30/360 convention, treating every month as 30 days and the year as 360 days". | 30/360 day-count stated explicitly, matching the reference and rejecting actual/365. |
| 4 | yes | **yes** | R2 AC4: "SHALL compute it once per monthly period rather than by daily accrual". | Interest computed once per repayment period, not daily — matches the reference. |
| 5 | yes | **yes** | R3 AC3: "IF the disbursement date precedes the start of the first scheduled period THEN the engine SHALL levy a stub (partial-period) interest charge for the extra days"; R3 AC4: permits and charges partial-period interest. | Interest from disbursement with a stub charge for extra days is stated. Note R6 muddies this by claiming no stub arises under the default first-due-date rule, but the core policy (stub charged, partial-period allowed) is correct. |
| 6 | yes | **yes** | Introduction: "Amounts are in Kenyan shillings (KES) and rounded to the whole shilling"; R4 AC1: "express all amounts in KES and round each instalment to the whole shilling, with no cents or minor units". | Currency is KES. The reference says amounts to 2 dp, but instalments are rounded to the whole shilling (#7). Currency matches; the spec's precision at instalment level is whole-shilling per #7, consistent with reference intent. Currency/KES is correct. |
| 7 | yes | **yes** | R4 AC1: "round each instalment to the whole shilling"; R4 AC3: "settle the accumulated rounding difference in that [final] instalment so that the closing outstanding balance is exactly zero". | Whole-shilling rounding with accumulated difference settled in the final instalment matches the reference exactly. |
| 8 | yes | **yes** | R4 AC2: "compute and round the interest component first, then set the principal component to the remainder of the rounded instalment". | Interest computed and rounded first, principal as the remainder — matches the within-period rounding order exactly. |
| 9 | yes | **yes** | R4 AC3: "closing outstanding balance is exactly zero"; R4 AC4: "sum of all principal portions equals the original principal exactly". | Final instalment reconciles to exactly zero closing balance — matches the reference. |
| 10 | no | no | absent | No mention of early full settlement, payoff, unearned interest rebate, or Rule of 78. The spec covers only the base schedule generation. |
| 11 | no | no | absent | No mention of partial prepayment, extra payments, or re-amortisation strategy (term-fixed vs instalment-fixed). |
| 12 | no | no | absent | No validation rule for zero/negative principal or term; inputs are accepted without any stated rejection of invalid values. |
| 13 | yes | **yes** | R3 AC1: "set the first instalment due date to exactly one month after the disbursement date"; R3 AC2: "set each one month after the previous instalment". | First due date = disbursement + one month, monthly thereafter — matches the reference exactly. |
| 14 | yes | no | R5 AC2: schedule includes "due date, interest due, principal due, total instalment, and running balance" per row; no mention of total cost of credit or disclosed APR on an actual/365 basis. | The per-period schedule shape is covered, but the total cost of credit and the actual/365-basis disclosed APR (the non-obvious 30/360-accrual-but-actual/365-disclosure split) are absent, so the resolution does not match the reference. |
