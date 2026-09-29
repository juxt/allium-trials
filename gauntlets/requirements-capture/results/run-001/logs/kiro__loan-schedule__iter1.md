# kiro — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits several policy decisions that cannot be reliably inferred (amortisation method, interest/day-count basis, first-instalment timing, stub-period handling, rounding and residual treatment), so I must ask the stakeholder before drafting requirements.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/French), equal principal repayments with declining interest, or interest-only with a final principal balloon?
A: Equal principal repayments with declining interest: a constant principal portion (P/n) is repaid each period, interest is charged on the reducing balance, so the total instalment decreases over the term. Equal-instalment (annuity/EMI) and interest-only balloon methods are not used.

Q: How is periodic interest derived from the annual nominal rate: simply rate/12 applied to the outstanding balance each month, or a day-count convention (e.g. actual/365, actual/360, 30/360) based on the disbursement and instalment dates?
A: 30/360 day-count convention: every month is treated as 30 days and the year as 360 days, so the periodic rate is the annual nominal rate × (30/360). Interest is computed once per monthly period against the outstanding balance — there is no daily accrual.

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month later, or aligned to a fixed billing day), and is there any grace period before interest or principal begins accruing?
A: The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. There is no grace period before interest or principal begins accruing.

Q: If the gap between disbursement and the first instalment is not a whole month, how should the stub period be handled: charge pro-rata interest for the partial period, ignore it, or roll it into the first instalment?
A: A stub interest charge is levied for the partial days between the disbursement date and the start of the first full period. Pro-rata interest for those extra days is computed and charged; it is not ignored or deferred.

Q: What rounding rule applies to the interest, principal, and instalment amounts (e.g. round to 2 decimal places / smallest currency unit), and where should any accumulated rounding residual be absorbed (typically an adjustment to the final instalment so the balance closes to exactly zero)?
A: Amounts are denominated in KES to 2 decimal places, but each instalment is rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is then the remainder of the rounded instalment. Accumulated rounding differences across all periods are absorbed in the final instalment so that the closing balance is exactly zero.

### Round 2
_Step reasoning:_ The stub-interest answer contradicts the 'exactly one month after disbursement' timing, and the stub's trigger, treatment, and day-count basis are material, non-inferable policy decisions still unresolved.

Q: The first-instalment timing (exactly one month after disbursement, monthly thereafter) and the stub-interest charge seem to conflict: if every instalment is exactly one month apart there is never a partial period. Are subsequent instalments actually anchored to a fixed billing day of the month, so the stub is the gap between the disbursement date and that first billing anchor? Please describe precisely when the stub period arises.
A: The stub arises because instalments are anchored to a fixed billing day of the month (the 'first period start'), not floating one calendar month from the disbursement date. When disbursement falls before that anchor — for example, disbursement on the 10th with a billing anchor on the 1st of the following month — the gap (10th to 1st) is the stub period. Subsequent instalments then fall monthly from that anchor. If disbursement happens to fall exactly on the anchor day there is no stub and the first due date is simply one month later. [The exact mechanism of how the anchor day is chosen — e.g. fixed product day, next 1st of month, or contractual — is not in policy; default: first day of the month following disbursement.]

Q: Is the stub interest a separate charge paid up front (or on the first billing date) as its own line, or is it folded into the first regular instalment? And does it affect the principal schedule at all, or is it interest-only on top of the P/n principal steps?
A: The stub interest is interest-only: it does not affect the principal schedule. The P/n principal steps begin with the first regular instalment against the opening principal. How the stub charge is presented — as a separate up-front line item on the first billing date versus folded into the first instalment total — is [default, not policy]; default: treated as a separate interest line due on the first billing date, shown distinctly in the schedule rather than blended into the regular instalment.

Q: Because 30/360 flattens every month to 30 days, how should the stub's partial days be counted and its rate derived: actual calendar days over 360, 30/360 day-count between the disbursement and anchor dates, or some other basis? And is the stub interest rounded to the whole shilling like the regular instalments?
A: The stub day count and rounding are [default, not policy]. Default: count actual calendar days in the stub gap and divide by 360 (consistent with the 30/360 year basis used for regular periods), giving stub interest = principal × annual rate × (actual stub days / 360). The stub interest is rounded to the whole shilling on the same basis as regular instalments.

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions (amortisation method, day-count, first-instalment anchoring, stub arising and treatment, rounding) are now resolved; the only open items are explicitly flagged non-policy defaults, so requirements gathering is complete.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the repayment schedule engine for our loan product. Given a disbursed loan defined by its principal, an annual nominal interest rate, a term expressed as a number of monthly instalments, and a disbursement date, the engine produces the complete repayment schedule. The public interface is a single function, `generate_schedule(loan)`, which returns the schedule.

The schedule reports, for each instalment period, the interest due, the principal due, the total instalment, and the running (closing) outstanding balance. It also reports any stub interest arising from a partial period between disbursement and the first billing anchor.

The institution has settled the following policy: amortisation is by equal principal repayments with declining interest (not annuity/EMI, not interest-only balloon); interest is derived on a 30/360 basis for full periods; instalments are anchored to a fixed billing day so a partial stub period can arise before the first full period; stub interest is charged as an interest-only line; and amounts are denominated in KES but each instalment is rounded to the whole shilling, with accumulated rounding residual absorbed in the final instalment so the balance closes to exactly zero.

Where a detail was neither given in the brief nor fixed by the stakeholder, the default recorded by the stakeholder is adopted and is marked as a default in the acceptance criteria below.

## Requirements

### Requirement 1: Loan input and schedule output

**User Story:** As a loan servicing engineer, I want `generate_schedule(loan)` to accept a disbursed loan and return its full repayment schedule, so that downstream billing and statements have a single authoritative source of instalment amounts.

#### Acceptance Criteria

1. WHEN `generate_schedule(loan)` is called THEN the system SHALL accept a loan defined by principal, annual nominal interest rate, term as a number of monthly instalments, and disbursement date.
2. WHEN the schedule is produced THEN the system SHALL return, for each regular instalment period, the interest due, the principal due, the total instalment, and the running outstanding balance after that instalment.
3. WHEN a stub period exists THEN the system SHALL include the stub interest as a distinct line in the returned schedule (see Requirement 5).
4. WHEN the final instalment is applied THEN the system SHALL return a closing outstanding balance of exactly zero.

### Requirement 2: Amortisation by equal principal repayments

**User Story:** As a product owner, I want the schedule to use equal principal repayments with declining interest, so that each period retires a constant share of principal and the total instalment falls over the term.

#### Acceptance Criteria

1. WHEN the schedule is computed THEN the system SHALL repay a constant principal portion of `principal / n` in each of the `n` regular instalment periods, before any final-instalment rounding adjustment.
2. WHEN each regular period's interest is computed THEN the system SHALL charge interest on the outstanding balance at the start of that period (the reducing balance).
3. WHEN successive periods are compared THEN the system SHALL produce a total instalment that decreases across the term, because the principal portion is constant and the interest portion declines.
4. The system SHALL NOT use the equal-instalment (annuity/EMI) method and SHALL NOT use the interest-only-with-balloon method.

### Requirement 3: Periodic interest on a 30/360 basis

**User Story:** As a finance controller, I want regular-period interest derived on a 30/360 day-count, so that every month accrues a uniform, predictable interest charge.

#### Acceptance Criteria

1. WHEN a regular period's interest is computed THEN the system SHALL apply a periodic rate equal to the annual nominal rate multiplied by 30/360 (i.e. every month is treated as 30 days and the year as 360 days).
2. WHEN interest for a regular period is computed THEN the system SHALL charge it once per monthly period against the outstanding balance, with no daily accrual.

### Requirement 4: Instalment timing and billing anchor

**User Story:** As a borrower, I want my instalments to fall on a fixed monthly billing day, so that my due dates are regular and predictable.

#### Acceptance Criteria

1. WHEN instalment due dates are determined THEN the system SHALL anchor them to a fixed billing day of the month (the first period start), with subsequent instalments falling monthly from that anchor.
2. IF the billing anchor day is not otherwise specified THEN the system SHALL default the anchor to the first day of the month following the disbursement date (recorded as a default, not stakeholder policy).
3. IF disbursement falls exactly on the anchor day THEN the system SHALL treat the first due date as one month after disbursement and SHALL NOT create a stub period.
4. WHEN principal and regular interest begin THEN the system SHALL apply no grace period; principal and interest begin with the first regular instalment.

### Requirement 5: Stub period for a partial gap before the first full period

**User Story:** As a finance controller, I want interest charged for the partial days between disbursement and the first billing anchor, so that the institution is not under-charging for the funds outstanding during the stub.

#### Acceptance Criteria

1. WHEN disbursement falls before the billing anchor THEN the system SHALL treat the gap from the disbursement date to the first period start as a stub period.
2. WHEN a stub period exists THEN the system SHALL levy a stub interest charge for that partial period and SHALL NOT ignore or defer it.
3. WHEN stub interest is computed THEN the system SHALL treat it as interest-only and SHALL NOT alter the principal schedule; the `principal / n` steps SHALL begin with the first regular instalment against the opening principal.
4. WHEN the stub interest is presented THEN the system SHALL, by default, show it as a separate interest line due on the first billing date, shown distinctly rather than blended into the first regular instalment (recorded as a default, not stakeholder policy).

### Requirement 6: Stub interest calculation and rounding

**User Story:** As a finance controller, I want the stub interest computed on a defined day-count and rounded consistently, so that the stub charge is auditable and matches the treatment of regular instalments.

#### Acceptance Criteria

1. WHEN stub days are counted THEN the system SHALL, by default, count the actual calendar days in the stub gap (recorded as a default, not stakeholder policy).
2. WHEN stub interest is computed THEN the system SHALL, by default, compute it as `principal * annual_rate * (actual_stub_days / 360)`, consistent with the 360-day year used for regular periods (recorded as a default, not stakeholder policy).
3. WHEN stub interest is rounded THEN the system SHALL round it to the whole shilling on the same basis as regular instalments.

### Requirement 7: Currency, rounding, and closing to zero

**User Story:** As a finance controller, I want each instalment rounded to the whole shilling with residuals absorbed at the end, so that customers are billed in whole shillings and the loan closes to exactly zero.

#### Acceptance Criteria

1. WHEN amounts are represented THEN the system SHALL denominate them in KES to 2 decimal places, but SHALL round each instalment to the whole shilling (no cents).
2. WHEN a period's amounts are computed THEN the system SHALL compute and round the interest first, then SHALL derive the principal as the remainder of the rounded instalment.
3. WHEN the term completes THEN the system SHALL absorb the accumulated rounding differences across all periods in the final instalment, so that the closing balance is exactly zero.

### Requirement 8: Edge cases and integrity

**User Story:** As a loan servicing engineer, I want the schedule to remain internally consistent under boundary conditions, so that the output can be trusted without manual reconciliation.

#### Acceptance Criteria

1. WHEN the sum of all principal portions across regular instalments is taken THEN the system SHALL equal the original principal exactly, after the final-instalment rounding adjustment.
2. WHEN each period's running balance is computed THEN the system SHALL equal the prior balance less that period's principal portion, and SHALL never be negative.
3. IF disbursement falls exactly on the anchor day THEN the schedule SHALL contain no stub line and SHALL consist solely of the `n` regular instalments.
4. WHEN the schedule is returned THEN the number of regular instalment periods SHALL equal the term `n`.

---

Do the requirements look good? If so, we can move on to the design.

## Auditor verdict

_The spec faithfully captures the bespoke calculation-method and rounding decisions (1-9): equal-principal amortisation, 30/360, once-per-period interest, stub interest from disbursement, KES/2dp, whole-shilling rounding with residual in the final instalment, interest-first rounding order, and exact-zero closing. It entirely misses the lifecycle-event policies — early-settlement Rule-of-78 rebate (10), partial prepayment re-amortisation (11) — and input validation for zero/negative principal or term (12). First due date (13) diverges: the spec defaults to the first of the following month rather than disbursement + one month. Output/disclosure (14) is only partially handled: per-period fields are present but total cost of credit and the actual/365-basis APR disclosure quirk are absent. Coverage: 10/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | R2.2: 'charge interest on the outstanding balance at the start of that period (the reducing balance)'; R3.1 applies periodic rate to outstanding balance. | Spec explicitly charges interest on the reducing/outstanding principal balance, matching declining-balance interest method. |
| 2 | yes | **yes** | R2.1: 'repay a constant principal portion of `principal / n`'; R2.3 total instalment 'decreases across the term'; R2.4 'SHALL NOT use the equal-instalment (annuity/EMI) method'. | Spec specifies constant P/n principal, interest on reducing balance, decreasing total instalment, and explicitly rejects EMI — an exact match to equal-principal amortisation. |
| 3 | yes | **yes** | R3.1: 'apply a periodic rate equal to the annual nominal rate multiplied by 30/360 (i.e. every month is treated as 30 days and the year as 360 days)'. | Spec states 30/360 day-count for regular periods verbatim, matching the reference. |
| 4 | yes | **yes** | R3.2: 'charge it once per monthly period against the outstanding balance, with no daily accrual'. | Spec computes interest once per monthly (repayment) period with no daily accrual, matching same-as-repayment-period calculation. |
| 5 | yes | **yes** | R5.1-5.2: 'treat the gap from the disbursement date to the first period start as a stub period' and 'levy a stub interest charge for that partial period and SHALL NOT ignore or defer it'. | Spec charges partial-period (stub) interest for the days between disbursement and the first period start, matching the reference's partial-period-interest-charged decision. |
| 6 | yes | **yes** | R7.1: 'denominate them in KES to 2 decimal places'. | Spec states currency KES and 2 decimal precision, matching the reference exactly. |
| 7 | yes | **yes** | R7.1 'round each instalment to the whole shilling (no cents)'; R7.3 'absorb the accumulated rounding differences ... in the final instalment'. | Spec rounds instalments to whole shillings and settles the accumulated rounding residual in the final instalment, matching the reference. |
| 8 | yes | **yes** | R7.2: 'compute and round the interest first, then SHALL derive the principal as the remainder of the rounded instalment'. | Spec fixes the within-period order as interest-first-then-principal-as-remainder, matching the reference exactly. |
| 9 | yes | **yes** | R1.4 'return a closing outstanding balance of exactly zero'; R7.3 'closing balance is exactly zero'. | Spec requires the final instalment to reconcile to an exactly-zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec covers only the disbursement-to-term schedule; it says nothing about early full settlement, unearned-interest rebate, or the Rule of 78. |
| 11 | no | no | absent | No mention of partial prepayment, applying extra payment to principal, or re-amortising with a fixed term; the spec does not address prepayment at all. |
| 12 | no | no | absent | R8's 'never be negative' concerns the running balance, not input validation; the spec never states that zero/negative principal or term is rejected as invalid. |
| 13 | yes | no | R4.2 defaults the anchor to 'the first day of the month following the disbursement date'; only R4.3 (disbursement on anchor) yields 'one month after disbursement'. | Reference sets first due date at disbursement + one month, but the spec's default rule anchors to the first of the following month (with a stub), which does not match disbursement + one month except in the special on-anchor case. |
| 14 | yes | no | R1.2 returns 'interest due, the principal due, the total instalment, and the running outstanding balance'; no total cost of credit, no APR, no actual/365 disclosure. Opening balance and per-period due date not enumerated. | Spec addresses per-period output shape only partially and omits the material, non-obvious elements: total cost of credit and the APR disclosed on an actual/365 basis alongside 30/360 accrual. |
