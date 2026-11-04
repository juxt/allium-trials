# kiro — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 7 · Captured: 8/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits amortisation method, rate derivation, rounding, residual handling and instalment timing; each has several plausible answers and must be confirmed with the stakeholder before writing requirements.

Q: How is the schedule amortised: equal total instalments (annuity-style, so principal and interest vary each period) or equal principal per instalment (so the total payment declines)?
A: Equal principal per instalment: a constant principal portion (P/n) each period, with interest charged on the reducing balance. The total instalment therefore decreases over the term.

Q: How is the periodic interest rate derived from the annual nominal rate: simple division (annual / 12) or a day-count convention (e.g. actual days in period / 365)?
A: 30/360 day-count: every month is treated as 30 days and the year as 360, so the periodic rate is simply the annual nominal rate divided by 12.

Q: What rounding convention applies to interest and principal amounts (e.g. round to 2 decimal places / minor currency units, half-up)?
A: Instalments are rounded to the whole shilling (zero decimal places, no cents). Within each period, interest is computed and rounded first; principal is then the remainder of the rounded instalment.

Q: Where does any rounding residual go so the running balance reaches exactly zero: absorbed into the final instalment, or spread across instalments?
A: The accumulated rounding difference is absorbed entirely into the final instalment, ensuring the closing balance is exactly zero.

Q: When is the first instalment due relative to the disbursement date (e.g. one month after disbursement), and does the disbursement date's day-of-month drive each due date?
A: The first instalment is due one month after the disbursement date; subsequent instalments fall monthly on the same day-of-month thereafter, so the disbursement date's day-of-month drives the entire schedule.

### Round 2
_Step reasoning:_ All five prior policy decisions are settled, but the day-of-month due-date rule breaks down for month-end/short-month cases and cannot be safely inferred, so one targeted clarification remains before requirements are complete.

Q: When the disbursement day-of-month has no counterpart in a later month (e.g. disbursed on the 31st, or the 29th/30th falling in February), what date does that instalment take: the last day of the shorter month, roll forward to the first of the next month, or some other rule?
A: [default, not policy] Use the last day of the shorter month (end-of-month clamping): if the target day does not exist in that month, the due date falls on the final day of that month.

### Round 3
_Step reasoning:_ Core policy levers (amortisation, day-count, rounding, residual, first-due-date, month-end clamping) are captured; business-day adjustment of due dates is the one remaining genuine policy an institution picks and cannot be inferred.

Q: When an instalment's due date falls on a weekend or public holiday, is the date adjusted (e.g. roll forward to the next business day, roll back to the previous one) or left unchanged, and if adjusted does the interest accrual period change accordingly?
A: [default, not policy] Due dates are left unchanged: no weekend or public-holiday adjustment is applied, and the interest accrual period is not affected.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (amortisation method, day-count, rounding, residual placement, first-instalment timing) are captured; the last two rounds returned only defaults rather than institution-specific policy, signalling elicitation is complete and it's time to draft the requirements document for review.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This document specifies the repayment schedule engine for our loan product. Given a disbursed loan, the engine produces a complete repayment schedule covering the full term. For every instalment the schedule states the interest due, the principal due, and the running balance after the payment.

The schedule uses an **equal-principal** (declining-balance) amortisation method: a constant principal portion is repaid each period, interest is charged on the reducing balance, and the total instalment therefore decreases over the term. The public interface is a single function, `generate_schedule(loan)`, which accepts a disbursed loan and returns the schedule.

A loan is defined by four inputs: the principal, an annual nominal interest rate, a term expressed as a whole number of monthly instalments, and a disbursement date. All monetary amounts are denominated in whole shillings (no cents).

The requirements below capture every policy decision settled with the stakeholder: the amortisation method, the interest-rate day-count convention, the rounding convention, the treatment of the rounding residual, and the due-date schedule. Two subsidiary date-handling rules (short-month clamping and weekend/holiday non-adjustment) were resolved as sensible defaults rather than stated institutional policy, and are recorded as such.

## Requirements

### Requirement 1

**User Story:** As a loan servicing operator, I want the engine to return a full instalment-by-instalment repayment schedule for a disbursed loan, so that the borrower's obligations over the whole term are known in advance.

#### Acceptance Criteria

1. WHEN `generate_schedule(loan)` is called with a valid disbursed loan THEN the system SHALL return a schedule containing exactly one entry per instalment, with the number of entries equal to the loan term in monthly instalments.
2. WHEN the schedule is produced THEN the system SHALL include, for each instalment, the interest due, the principal due, the total instalment amount, the due date, and the running (closing) balance after that instalment.
3. WHEN the schedule is produced THEN the system SHALL order the instalments chronologically from the first due date to the last.
4. WHEN the final instalment has been applied THEN the system SHALL ensure the running balance is exactly zero.

### Requirement 2

**User Story:** As a loan product owner, I want repayments amortised on an equal-principal basis, so that a constant amount of principal is retired each period and the total payment declines over the term.

#### Acceptance Criteria

1. WHEN the schedule is computed THEN the system SHALL repay a constant principal portion of the original principal divided by the number of instalments (P / n) in each period, before any rounding residual adjustment.
2. WHEN interest for a period is computed THEN the system SHALL charge interest on the outstanding balance remaining at the start of that period (the reducing balance).
3. WHEN successive instalments are compared THEN the system SHALL produce total instalment amounts that decrease over the term, because the interest portion falls as the balance reduces while the principal portion stays constant.
4. WHEN each instalment is applied THEN the system SHALL reduce the running balance by the principal portion of that instalment.

### Requirement 3

**User Story:** As a finance controller, I want interest derived from the annual nominal rate using a 30/360 day-count convention, so that periodic interest is calculated consistently regardless of actual calendar days.

#### Acceptance Criteria

1. WHEN the periodic interest rate is derived from the annual nominal rate THEN the system SHALL treat every month as 30 days and the year as 360 days (30/360 day-count).
2. WHEN the 30/360 convention is applied THEN the system SHALL compute the periodic rate as the annual nominal rate divided by 12.
3. WHEN period interest is computed THEN the system SHALL apply this periodic rate to the outstanding balance at the start of the period, so the actual number of calendar days between due dates SHALL NOT affect the interest charged.

### Requirement 4

**User Story:** As a finance controller, I want all instalment amounts rounded to the whole shilling with a defined interest-then-principal order, so that the schedule contains no fractional currency and every figure is reproducible.

#### Acceptance Criteria

1. WHEN any monetary amount is placed in the schedule THEN the system SHALL round it to the whole shilling (zero decimal places, no cents).
2. WHEN a period is computed THEN the system SHALL compute and round the interest portion first.
3. WHEN the interest portion has been rounded THEN the system SHALL set the principal portion to the remainder of the rounded instalment for that period (rounded instalment minus rounded interest).
4. WHEN amounts are rounded THEN the system SHALL apply the rounding consistently so that the reported interest, principal, and running balance reconcile for every period.

### Requirement 5

**User Story:** As a finance controller, I want the accumulated rounding difference absorbed into the final instalment, so that the loan closes at exactly zero without spreading adjustments across the schedule.

#### Acceptance Criteria

1. WHEN rounding across the term produces a residual difference between the sum of the rounded principal portions and the original principal THEN the system SHALL absorb the entire accumulated difference into the final instalment.
2. WHEN the final instalment is computed THEN the system SHALL adjust its principal portion so that the closing running balance is exactly zero.
3. WHEN the residual is absorbed THEN the system SHALL NOT spread the rounding difference across earlier instalments.
4. WHEN the final instalment differs from the regular equal-principal amount because of residual absorption THEN the system SHALL still report its interest, principal, total, and closing balance in the same form as every other instalment.

### Requirement 6

**User Story:** As a borrower, I want my first instalment due one month after disbursement and each later instalment on the same day of the month, so that my payment dates are predictable and anchored to my disbursement date.

#### Acceptance Criteria

1. WHEN due dates are assigned THEN the system SHALL set the first instalment due date to one month after the disbursement date.
2. WHEN subsequent due dates are assigned THEN the system SHALL fall monthly on the same day-of-month as the disbursement date, so the disbursement date's day-of-month SHALL drive the entire schedule.
3. WHEN each successive instalment date is derived THEN the system SHALL advance one calendar month from the previous instalment's anchor day-of-month.

### Requirement 7

**User Story:** As a loan servicing operator, I want a defined rule for months that lack the anchor day-of-month, so that due dates are unambiguous for loans disbursed near the end of a month.

#### Acceptance Criteria

1. IF the disbursement day-of-month has no counterpart in a later month (for example the 31st, or the 29th or 30th falling in February) THEN the system SHALL set that instalment's due date to the last day of that shorter month (end-of-month clamping).
2. WHEN clamping is applied for a short month THEN the system SHALL continue to anchor later instalments to the original disbursement day-of-month rather than to the clamped day.
3. NOTE: This rule was resolved as a sensible default rather than stated institutional policy; it should be confirmed with the stakeholder before production use.

### Requirement 8

**User Story:** As a loan servicing operator, I want due dates left unadjusted for weekends and public holidays, so that the schedule and its interest accrual stay simple and deterministic.

#### Acceptance Criteria

1. IF an instalment's due date falls on a weekend or a public holiday THEN the system SHALL leave the due date unchanged (no roll-forward or roll-back adjustment).
2. WHEN a due date falls on a non-business day THEN the system SHALL NOT alter the interest accrual period as a result.
3. NOTE: This rule was resolved as a sensible default rather than stated institutional policy; it should be confirmed with the stakeholder before production use.

### Requirement 9

**User Story:** As a developer integrating the engine, I want a single well-defined `generate_schedule(loan)` function, so that I can obtain the schedule from a loan record with a stable interface.

#### Acceptance Criteria

1. WHEN the engine is invoked THEN the system SHALL expose the function `generate_schedule(loan)` as the entry point.
2. WHEN `generate_schedule(loan)` receives a loan THEN the system SHALL read the principal, the annual nominal interest rate, the term in monthly instalments, and the disbursement date from it.
3. WHEN computation completes THEN the system SHALL return the schedule as an ordered collection of instalment entries as described in Requirement 1.


## Auditor verdict

_The spec covers the core schedule mechanics well: amortisation (2), interest method (1), 30/360 day-count (3), interest calculation period (4), rounding convention and order (7, 8), residual absorption and zero closing (9), and due-date scheduling (13) all match the reference. It misses the bespoke lifecycle and disclosure decisions entirely: disbursement-date/stub interest (5), Rule-of-78 early settlement rebate (10), and partial-prepayment re-amortisation (11) are absent, and zero/negative validation (12) is unaddressed. Currency precision (6) is wrong (whole shillings, not 2 dp KES) and output shape (14) omits total cost of credit and the actual/365 disclosed APR. Coverage: 9/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "equal-principal (declining-balance) amortisation method" (Introduction); Req 2.2 "charge interest on the outstanding balance remaining at the start of that period (the reducing balance)" | The spec explicitly uses declining balance on the reducing principal, matching the reference exactly. |
| 2 | yes | **yes** | Req 2.1 "repay a constant principal portion of the original principal divided by the number of instalments (P / n) in each period"; Req 2.3 total instalment amounts "decrease over the term" | Equal-principal with constant P/n, interest on reducing balance, decreasing total instalment — matches the reference precisely, explicitly not EMI. |
| 3 | yes | **yes** | Req 3.1 "treat every month as 30 days and the year as 360 days (30/360 day-count)" | 30/360 stated exactly as in the reference. |
| 4 | yes | **yes** | Req 3.2 "compute the periodic rate as the annual nominal rate divided by 12"; Req 3.3 "the actual number of calendar days between due dates SHALL NOT affect the interest charged" | Interest computed once per monthly period (rate/12 applied per period), not daily accrual — matches same-as-repayment-period. |
| 5 | no | no | absent | The spec never addresses interest accruing from the disbursement date or any stub/partial-period interest charge when disbursement precedes the first period start. |
| 6 | yes | no | "All monetary amounts are denominated in whole shillings (no cents)" (Introduction); Req 4.1 "round it to the whole shilling (zero decimal places, no cents)" | The spec names shillings but explicitly uses whole-shilling precision (0 dp), not KES to 2 decimal places; the currency-and-precision decision requires 2 dp, so the resolution does not match. |
| 7 | yes | **yes** | Req 4.1 whole-shilling rounding; Req 5.1 "absorb the entire accumulated difference into the final instalment" | Instalments rounded to whole shilling with the accumulated rounding difference settled in the final instalment — matches exactly. |
| 8 | yes | **yes** | Req 4.2 "compute and round the interest portion first"; Req 4.3 "set the principal portion to the remainder of the rounded instalment (rounded instalment minus rounded interest)" | Interest computed and rounded first, principal as the remainder — matches the reference ordering exactly. |
| 9 | yes | **yes** | Req 1.4 "ensure the running balance is exactly zero"; Req 5.2 "closing running balance is exactly zero" | Final instalment reconciles to a closing balance of exactly zero, as required. |
| 10 | no | no | absent | The spec says nothing about early full settlement or any unearned-interest rebate, so the Rule of 78 policy is not addressed. |
| 11 | no | no | absent | No mention of partial prepayment, re-amortisation, or whether term or instalment is held fixed. |
| 12 | no | no | absent | The spec refers to a "valid disbursed loan" but never defines rejection of zero/negative principal or term as invalid. |
| 13 | yes | **yes** | Req 6.1 "set the first instalment due date to one month after the disbursement date"; Req 6.2 monthly on same day-of-month | First due date is disbursement + one month, subsequent instalments monthly — matches exactly. |
| 14 | yes | no | Req 1.2 lists interest, principal, total instalment, due date, and closing balance per instalment; no total cost of credit or APR disclosure mentioned | The full per-period schedule shape is present, but the spec omits the total cost of credit and the actual/365-basis disclosed APR, so the output decision is only partially covered and does not match the reference. |
