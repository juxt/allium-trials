# kiro — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 11 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits several policy decisions (amortisation method, interest accrual/day-count, first-payment timing, rounding and final-instalment reconciliation) that cannot be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/EMI, where each payment is the same and the principal/interest split shifts over time), equal principal (principal is constant and interest declines), or something else?
A: Equal principal: a fixed principal slice (P/n) each period, with interest charged on the declining balance, so the total instalment decreases over the term. Not an annuity/EMI structure.

Q: How is the periodic interest rate derived from the annual nominal rate, and what day-count convention applies: simple annual/12 per month, or an actual/365, actual/360, or 30/360 accrual based on days between instalments?
A: 30/360 day-count: every month is treated as 30 days and the year as 360. The periodic rate is therefore the nominal annual rate divided by 12, applied once per monthly period. There is no daily accrual and no actual-day counting for accrual purposes (APR disclosure uses actual/365 but that is separate from the accrual mechanic).

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month after, or on a fixed day of the following month), and can there be a short or long stub first period if the dates don't align to a whole month?
A: The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. If disbursement falls before the first period start, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged.

Q: To what precision are interest, principal, and the running balance rounded (e.g. to the currency minor unit / 2 decimal places), and how is any residual rounding difference reconciled — is the final instalment adjusted so the closing balance is exactly zero?
A: Amounts are in KES to 2 decimal places. Each instalment is then rounded to the whole shilling (no cents): interest is computed and rounded first; principal is the remainder of that rounded instalment. The accumulated rounding difference across all periods is reconciled in the final instalment so the closing balance is exactly zero.

Q: Should the schedule account for any fees, insurance, or charges added to the instalment, or is it purely principal plus interest on the disbursed amount?
A: Purely principal plus interest on the disbursed amount. No fees, insurance, or other charges are included in the schedule. [default, not policy]

### Round 2
_Step reasoning:_ Every other material policy is pinned, but the stub-period mechanics conflict with the 'first instalment exactly one month after disbursement' rule and materially affect the schedule, so I need one clarification before finalising.

Q: On the stub period: since you said the first instalment falls exactly one month after disbursement, when does a stub actually arise, and how is it charged? Concretely — (a) are instalments anchored to a fixed calendar day so disbursement can precede the first period start, producing extra days before the one-month point; (b) how are the stub days counted under 30/360; (c) is the stub interest billed as a separate up-front charge or folded into the first instalment; and (d) does the stub affect the principal split or only add interest?
A: (a) A stub arises when the schedule anchors period starts to a fixed calendar day (e.g. the 1st of each month) and the disbursement date falls before that anchor. In that case disbursement precedes the first period start, and the days between them are the stub. The first instalment then falls one month after the first period start, not one month after disbursement itself. Where disbursement coincidentally lands on the period-start day there is no stub.

### Round 3
_Step reasoning:_ Round 2 answered only part (a) of the stub question; the stub's day-counting, billing, principal treatment, anchor-day definition, and rounding remain open and are material policy that cannot be safely inferred.

Q: On the stub period, your last answer covered when a stub arises (part a) but left the mechanics open. (b) How are the stub days counted under 30/360 — actual calendar days between disbursement and the first period start, or the 30/360 day difference — and what is the stub interest formula (principal x nominal annual rate x stub_days/360)?
A: Under 30/360 the stub day-count uses the 30/360 day-difference formula (Y2−Y1)×360 + (M2−M1)×30 + (D2−D1), where day values are capped at 30. For a within-month stub this equals actual calendar days. The stub interest formula is: principal × (nominal_annual_rate / 360) × stub_days. [default, not policy]

Q: (c) Is the stub interest billed as a separate up-front charge on the disbursement/first-period-start date, or folded into the amount of the first instalment?
A: The stub interest is folded into the first instalment; it is not billed as a separate up-front charge on or around disbursement. [default, not policy]

Q: (d) Does the stub only add interest, or does it also change the principal split — i.e. is period 1's principal still exactly P/n, or is it adjusted?
A: The stub adds interest only. Period 1's principal slice remains exactly P/n, unchanged by the stub. [default, not policy]

Q: What fixes the anchor day for period starts: a fixed institutional day (e.g. always the 1st of the month), the disbursement day-of-month, or a value supplied on the loan? Your earlier answer used 'e.g. the 1st' but did not pin it down.
A: The anchor day is a value supplied on the loan (i.e. a nominated period-start day, such as the 1st, agreed at origination). It is not derived automatically from the disbursement day-of-month and is not a fixed institutional constant. [default, not policy]

Q: How is the stub interest rounded — same whole-shilling rule as instalments (rounded to the nearest KES), and does it enter the final-instalment rounding reconciliation?
A: The same whole-shilling rounding rule applies to the stub interest amount. It is rounded to the nearest KES and any rounding difference is included in the accumulated total that is reconciled in the final instalment. [default, not policy]

### Round 4 (process signalled done)
_Step reasoning:_ The material policy decisions a model cannot infer (equal-principal amortisation, 30/360 day-count with rate/12, first-instalment timing and stub mechanics, whole-shilling rounding with interest-first and final-instalment reconciliation, and no fees) have all been settled; the last two rounds returned only '[default, not policy]' answers, signalling diminishing returns, so requirements gathering is complete.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the repayment schedule engine for our loan product. Given a disbursed loan, it produces the complete repayment schedule: for each monthly instalment the interest due, the principal due, and the running balance, ending at a closing balance of exactly zero.

The schedule uses an **equal-principal** amortisation method. A fixed principal slice of `P / n` is repaid each period, interest is charged on the declining balance, and the total instalment therefore decreases over the term. This is not an annuity/EMI structure.

Interest accrues on a **30/360** day-count basis: every month is treated as 30 days and the year as 360 days, so the periodic rate is the nominal annual rate divided by 12, applied once per monthly period. There is no daily accrual and no actual-day counting for the accrual mechanic. (APR disclosure may use actual/365, but that is a separate concern and out of scope here.)

Period starts are anchored to a nominated period-start day supplied on the loan. When the disbursement date falls before the first period start, the intervening days form a **stub period** whose interest is folded into the first instalment.

All amounts are in Kenyan shillings (KES). Amounts are computed to two decimal places and each instalment is then rounded to the whole shilling; the accumulated rounding difference is reconciled in the final instalment so the loan closes exactly.

The public interface is a function `generate_schedule(loan)` that returns the full schedule.

## Requirements

### Requirement 1

**User Story:** As a loan servicing operator, I want the schedule computed by the equal-principal method, so that each instalment repays a fixed principal slice with interest on the declining balance.

#### Acceptance Criteria

1. WHEN a schedule is generated for a loan with principal `P` and term `n` monthly instalments THEN the system SHALL assign a scheduled principal repayment of `P / n` to each of the `n` instalments, before any final-instalment rounding reconciliation.
2. WHEN interest is charged for a period THEN the system SHALL compute it on the balance outstanding at the start of that period (the declining balance), not on the original principal.
3. WHEN the instalments are compared across the term THEN the system SHALL produce a total instalment amount that decreases over the term, because the fixed principal slice is combined with declining interest.
4. The system SHALL NOT use an annuity/EMI structure (equal total instalments with a shifting principal/interest split).

### Requirement 2

**User Story:** As a finance controller, I want interest derived from the annual nominal rate on a 30/360 basis, so that accrual is deterministic and matches our stated accrual policy.

#### Acceptance Criteria

1. WHEN the periodic interest rate is derived from the annual nominal rate `r` THEN the system SHALL use `r / 12` as the monthly periodic rate.
2. WHEN interest is charged for a regular monthly period THEN the system SHALL apply the periodic rate once per period to the outstanding balance, treating every month as 30 days and the year as 360 days.
3. The system SHALL NOT perform daily accrual or actual-day counting for the accrual mechanic.

### Requirement 3

**User Story:** As a loan servicing operator, I want the instalment dates anchored to a nominated period-start day, so that repayment dates follow the schedule agreed at origination.

#### Acceptance Criteria

1. The system SHALL take the anchor day (the nominated period-start day, such as the 1st) as a value supplied on the loan.
2. The system SHALL NOT derive the anchor day automatically from the disbursement day-of-month, and SHALL NOT treat it as a fixed institutional constant.
3. WHEN the schedule is generated THEN the system SHALL set the first period start to the anchor day, the first instalment SHALL fall exactly one month after the first period start, and each subsequent instalment SHALL fall monthly thereafter.
4. WHEN the disbursement date coincides with the period-start (anchor) day THEN the system SHALL produce no stub period, and the first instalment SHALL fall exactly one month after disbursement.

### Requirement 4

**User Story:** As a finance controller, I want a stub interest charge when disbursement precedes the first period start, so that the borrower is charged for the extra days of borrowing.

#### Acceptance Criteria

1. WHEN the disbursement date falls before the first period start THEN the system SHALL treat the days between disbursement and the first period start as a stub period.
2. WHEN counting stub days THEN the system SHALL use the 30/360 day-difference formula `(Y2 − Y1) × 360 + (M2 − M1) × 30 + (D2 − D1)`, with day values capped at 30, between the disbursement date and the first period start. (For a within-month stub this equals the actual calendar days.)
3. WHEN stub interest is computed THEN the system SHALL apply the formula `principal × (nominal_annual_rate / 360) × stub_days`, using the disbursed principal.
4. WHEN a stub period exists THEN the system SHALL fold the stub interest into the first instalment, and SHALL NOT bill it as a separate up-front charge on or around the disbursement date.
5. WHEN a stub period exists THEN the system SHALL add interest only: the principal slice of the first instalment SHALL remain exactly `P / n`, unchanged by the stub.

### Requirement 5

**User Story:** As a finance controller, I want amounts rounded to the whole shilling with residuals reconciled at the end, so that the schedule is billable in whole KES and closes at exactly zero.

#### Acceptance Criteria

1. The system SHALL express all amounts in KES, computing to two decimal places before applying the whole-shilling rounding rule.
2. WHEN an instalment is rounded THEN the system SHALL round the interest component to the whole shilling first, and SHALL derive the principal component as the remainder of the rounded instalment amount.
3. WHEN a stub period exists THEN the system SHALL round the stub interest amount to the nearest KES under the same whole-shilling rule.
4. WHEN the schedule is generated THEN the system SHALL accumulate the rounding differences arising across all periods (including any stub rounding difference) and reconcile the total in the final instalment.
5. WHEN the schedule is complete THEN the closing running balance SHALL be exactly zero.

### Requirement 6

**User Story:** As a finance controller, I want the schedule to cover principal and interest only, so that it reflects the disbursed amount without other charges.

#### Acceptance Criteria

1. The system SHALL include only principal and interest on the disbursed amount in the schedule.
2. The system SHALL NOT include fees, insurance, or any other charges in the schedule.

### Requirement 7

**User Story:** As a developer integrating the engine, I want `generate_schedule(loan)` to return the full schedule with a running balance, so that I can display and reconcile the loan.

#### Acceptance Criteria

1. WHEN `generate_schedule(loan)` is called with a loan carrying principal, annual nominal interest rate, term in monthly instalments, disbursement date, and the nominated anchor day THEN the system SHALL return a schedule with one entry per instalment.
2. WHEN each schedule entry is produced THEN the system SHALL include the interest due, the principal due, and the running balance after that instalment.
3. WHEN the running balance is reported for an entry THEN the system SHALL equal the prior balance less the principal repaid in that entry, with the first entry reducing from the disbursed principal and the final entry reaching exactly zero.

## Auditor verdict

_The spec matches 9 of 14 reference decisions (coverage 9/14 ≈ 0.64). It correctly captures the core accrual and rounding mechanics: declining balance (1), equal-principal amortisation (2), 30/360 (3), per-period calculation (4), disbursement-date stub interest (5), KES/2dp (6), whole-shilling instalment rounding with final-instalment reconciliation (7), interest-first/principal-remainder ordering (8), and exact-zero closing (9). It misses the three bespoke method choices around loan lifecycle events — Rule-of-78 rebate (10), principal-first term-fixed re-amortisation on prepayment (11) — and the invalid-input edge case (12), all absent. Two surfaced-but-wrong: the first due date (13) is anchored to a nominated period-start day rather than disbursement + one month, and the output/disclosure requirement (14) omits total cost of credit and explicitly puts the actual/365 APR disclosure out of scope. The gap concentrates on the off-default, non-inferable decisions, consistent with the reference design intent._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "interest is charged on the declining balance" (Introduction); Req 1.2: "compute it on the balance outstanding at the start of that period (the declining balance), not on the original principal." | Spec explicitly uses declining-balance interest on the reducing principal, matching the reference. |
| 2 | yes | **yes** | "The schedule uses an equal-principal amortisation method. A fixed principal slice of P / n is repaid each period... the total instalment therefore decreases over the term. This is not an annuity/EMI structure." (Introduction); Req 1.1, 1.3, 1.4. | Spec states equal principal (P/n), interest on reducing balance, decreasing total instalment, and explicitly rules out EMI — an exact match to the bespoke reference answer. |
| 3 | yes | **yes** | "Interest accrues on a 30/360 day-count basis: every month is treated as 30 days and the year as 360 days." (Introduction); Req 2.2. | Spec adopts 30/360 with the exact month=30/year=360 definition, matching the reference and rejecting actual/365. |
| 4 | yes | **yes** | "the periodic rate is the nominal annual rate divided by 12, applied once per monthly period. There is no daily accrual" (Introduction); Req 2.2 "apply the periodic rate once per period"; Req 2.3 rejects daily accrual. | Spec computes interest once per monthly period rather than by daily accrual, matching the same-as-repayment-period reference. |
| 5 | yes | **yes** | Req 4.1: "WHEN the disbursement date falls before the first period start THEN... treat the days between disbursement and the first period start as a stub period"; Req 4.3 charges stub interest on principal; Req 4.4 folds it into the first instalment. | Spec levies a partial-period stub interest charge for days between disbursement and the first period start, matching the reference's accrual-from-disbursement rule. |
| 6 | yes | **yes** | "All amounts are in Kenyan shillings (KES). Amounts are computed to two decimal places" (Introduction); Req 5.1. | Spec states KES and computation to two decimal places, matching the reference currency and precision. |
| 7 | yes | **yes** | "each instalment is then rounded to the whole shilling; the accumulated rounding difference is reconciled in the final instalment" (Introduction); Req 5.4 accumulates differences and reconciles in the final instalment. | Spec rounds each instalment to the whole shilling and settles the accumulated residual in the final instalment, matching the reference exactly. |
| 8 | yes | **yes** | Req 5.2: "the system SHALL round the interest component to the whole shilling first, and SHALL derive the principal component as the remainder of the rounded instalment amount." | Spec fixes the within-period order as interest-rounded-first, principal-as-remainder, matching the reference's ordering (despite some tension with the fixed-P/n principal claim in Req 1.1). |
| 9 | yes | **yes** | "ending at a closing balance of exactly zero" (Introduction); Req 5.5: "the closing running balance SHALL be exactly zero"; Req 7.3 final entry reaches exactly zero. | Spec requires the final instalment to close the balance at exactly zero, matching the reference. |
| 10 | no | no | absent | The spec covers only scheduled repayment; it says nothing about early full settlement or any interest rebate, let alone the Rule of 78. |
| 11 | no | no | absent | No mention of partial prepayment, its application to principal, or re-amortisation strategy (term-fixed vs instalment-fixed). |
| 12 | no | no | absent | The spec never addresses validation of zero/negative principal or term, nor rejection of invalid loans. |
| 13 | yes | no | Req 3.3: "set the first period start to the anchor day, the first instalment SHALL fall exactly one month after the first period start"; Req 3.2 forbids deriving the anchor from the disbursement day-of-month. | Spec addresses the first due date but anchors it to a nominated period-start day (first instalment = anchor + one month), which only equals the reference's disbursement + one month in the no-stub case; in general it diverges, so it fails the strict-match test. |
| 14 | yes | no | Req 7.2 includes only "interest due, the principal due, and the running balance"; "APR disclosure may use actual/365, but that is a separate concern and out of scope here" (Introduction). No total cost of credit. | Spec addresses output shape but omits due date/opening balance per entry, omits the total cost of credit, and explicitly puts the actual/365 APR disclosure out of scope, so it does not match the reference's full output-and-disclosure requirement. |
